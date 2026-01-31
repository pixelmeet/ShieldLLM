"""Chat: POST /sessions/{session_id}/message - full ILE pipeline."""
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.rate_limit import check_rate_limit
from app.db.mongo import get_db
from app.db import repositories as repo
from app.models.schemas import MessageRequest, MessageResponse
from app.routers.auth import get_current_user_id
from app.services.canonicalize import progressive_canonicalize
from app.services.sanitizer import sanitize_input
from app.services.intent_graph import update_intent_graph
from app.services.llm_client import call_primary_llm, call_shadow_llm, build_system_prompt
from app.services.divergence import compute_divergence
from app.services.defense import decide_action, get_decision_level, apply_defense
from app.utils.logger import get_logger

router = APIRouter(tags=["chat"])
logger = get_logger(__name__)


def _ensure_answer_format(text: str) -> str:
    """Minimal post-processing: ensure final_answer has Brief answer, Findings, Fixes, Risk."""
    if not text or not text.strip():
        return text
    lower = text.lower()
    has_findings = "finding" in lower or "•" in text or "- " in text
    has_fixes = "fix" in lower or "solution" in lower
    has_risk = "risk" in lower or ("low" in lower or "med" in lower or "high" in lower)
    if has_findings and has_fixes and has_risk:
        return text
    suffix = []
    if not has_findings:
        suffix.append("\n\nFindings:\n- (see analysis above)")
    if not has_fixes:
        suffix.append("\n\nFixes:\n- (see suggestions above)")
    if not has_risk:
        suffix.append("\n\nRisk: Med")
    return text + "".join(suffix)


@router.post("/sessions/{session_id}/message", response_model=MessageResponse)
async def post_message(
    session_id: str,
    body: MessageRequest,
    user_id: str = Depends(get_current_user_id),
):
    if len(body.text) > 20000:
        raise HTTPException(status_code=400, detail="Input exceeds 20000 characters")

    if not check_rate_limit(user_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded (30 req/min)")

    db = get_db()
    session = await repo.session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

    t0 = time.perf_counter()
    user_input = body.text.strip()

    # 1) Canonicalize and get signals
    canonical_text, canonical_signals = progressive_canonicalize(user_input)

    # 2) Sanitize for Shadow path
    sanitized_input = sanitize_input(user_input)
    if not sanitized_input.strip():
        sanitized_input = user_input

    # 3) Update Intent Graph
    intent_graph = session.get("intent_graph") or {}
    updated_graph, violations, trust_decay = update_intent_graph(
        intent_graph, canonical_text, canonical_signals
    )
    all_signals = canonical_signals + violations
    new_trust = max(0, (session.get("trust_score", 100) or 100) - trust_decay)
    await repo.session_update_intent_graph(db, session_id, updated_graph)
    await repo.session_update_trust_score(db, session_id, new_trust)

    # 4) Get conversation history
    messages_docs = await repo.messages_by_session(db, session_id)
    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages_docs
    ]
    messages.append({"role": "user", "content": user_input})

    # 5) Call Primary LLM
    system_prompt = build_system_prompt(updated_graph)
    primary_output = await call_primary_llm(system_prompt, messages)

    # 6) Safe session summary for Shadow (last 2 turns, truncated)
    summary_parts = []
    for m in messages_docs[-4:]:
        role = m["role"]
        content = (m["content"] or "")[:200]
        summary_parts.append(f"{role}: {content}")
    session_summary = "\n".join(summary_parts[-2:]) if summary_parts else ""

    # 7) Call Shadow LLM
    shadow_output = await call_shadow_llm(sanitized_input, session_summary)

    # 8) Divergence Analyzer
    scores = compute_divergence(primary_output, shadow_output, updated_graph)
    divergence_score = scores["total"]

    # 9) Defense Controller
    defense_action = decide_action(divergence_score, session.get("defense_mode", "active"))
    decision_level = get_decision_level(divergence_score)

    # 10) Apply defense
    final_answer, stripped_spans = await apply_defense(
        defense_action,
        user_input,
        primary_output,
        updated_graph,
        messages,
        all_signals,
    )
    final_answer = _ensure_answer_format(final_answer)

    latency_ms = (time.perf_counter() - t0) * 1000

    # Persist messages
    await repo.message_create(db, session_id, "user", user_input)
    await repo.message_create(db, session_id, "assistant", final_answer)

    turn_index = len([m for m in messages_docs if m["role"] == "user"]) + 1
    reasons = [f"semantic_drift={scores['semantic_drift']}", f"policy_stress={scores['policy_stress']}", f"reasoning_mismatch={scores['reasoning_mismatch']}"]

    log_doc = await repo.log_create(
        db,
        session_id=session_id,
        turn_index=turn_index,
        user_input=user_input,
        sanitized_input=sanitized_input,
        primary_output=primary_output,
        shadow_output=shadow_output,
        divergence_score=divergence_score,
        decision_level=decision_level,
        defense_action=defense_action,
        stripped_spans=stripped_spans,
        reasons=reasons,
        latency_ms=latency_ms,
    )

    logger.info(
        "chat_turn",
        extra={
            "session_id": session_id,
            "turn": turn_index,
            "divergence": divergence_score,
            "action": defense_action,
            "latency_ms": round(latency_ms, 2),
        },
    )

    return MessageResponse(
        final_answer=final_answer,
        divergence_score=divergence_score,
        decision_level=decision_level,
        defense_action=defense_action,
        trust_score=new_trust,
        log_id=log_doc["id"],
    )
