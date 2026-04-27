"""
Dual-LLM Prompt Injection Defense System using OpenAI API.
Pipeline: User Input -> Intent Graph -> Sanitize -> Dual LLM -> Divergence -> Defense Controller.
Detection from intent graph + output divergence only; no reliance on OpenAI safety filters.
"""
from pathlib import Path
from dotenv import load_dotenv

_root = Path(__file__).resolve().parent.parent
load_dotenv(_root / ".env")       # defaults
load_dotenv(_root / ".env.local") # secrets (Next.js convention, gitignored)

from fastapi import FastAPI, HTTPException, Body, Header
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import logging
import uvicorn

from canonicalize import progressive_canonicalize
from intent_graph import build_intent_graph
from sanitize import sanitize_input
from divergence import compute_divergence, compute_divergence_degraded, injection_indicator_score
from policy import decide_defense_action
from llm_client import call_primary, call_shadow, get_llm_status, get_debug_llm_info, LLM_MODE as LLM_MODE_VAL
from system_prompt import build_system_prompt
from defense_controller import apply_defense

app = FastAPI(title="ShieldLLM Defense Service", description="Dual-LLM Prompt Injection Defense")
logger = logging.getLogger("shieldllm.defense")


@app.get("/")
def root():
    """Root endpoint so GET http://localhost:8000 returns a valid response."""
    print("[defense/root] GET / called")
    return {
        "service": "ShieldLLM Defense",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "llm_status": "/llm-status",
        "debug_llm": "GET /debug/llm",
        "analyze": "POST /analyze",
    }


# --- Request / Response models (keep API shape for frontend) ---
class TurnRequest(BaseModel):
    userText: str
    intentGraph: Dict[str, Any]
    defenseMode: str
    policy: Dict[str, Any]
    modelType: Optional[str] = None

class DivergenceLog(BaseModel):
    divergenceScore: float
    action: str
    defenseActionTaken: bool
    rerunWithCleaned: bool
    user_input: Optional[str] = None
    sanitized_input: Optional[str] = None
    primary_output: Optional[str] = None
    shadow_output: Optional[str] = None
    primary_error: Optional[str] = None
    shadow_error: Optional[str] = None
    primary_ok: Optional[bool] = None
    shadow_ok: Optional[bool] = None
    llm_mode: Optional[str] = None

class AnalysisResponse(BaseModel):
    canonicalText: str
    signals: List[str]
    updatedGraph: Dict[str, Any]
    scores: Dict[str, float]
    riskLevel: str
    action: str
    sanitizedText: Optional[str] = None
    primaryOutput: str
    shadowOutput: str
    divergenceLog: DivergenceLog
    final_answer: Optional[str] = None
    divergence_score: Optional[float] = None
    defense_action: Optional[str] = None
    log: Optional[Dict[str, Any]] = None


@app.post("/analyze", response_model=AnalysisResponse, response_model_exclude_none=False)
async def analyze_turn(req: TurnRequest):
    print(f"[defense/analyze] POST /analyze called")
    print(f"[defense/analyze] Request data: userText={req.userText[:100] if req.userText else 'None'}...")
    print(f"[defense/analyze] defenseMode={req.defenseMode}, modelType={req.modelType}")
    try:
        result = await _analyze_turn_impl(req)
        print(f"[defense/analyze] SUCCESS: action={result.get('action')}, divergence={result.get('divergence_score')}")
        return result
    except Exception as e:
        logger.exception("Analyze failed (returning containment): %s", e)
        # Never crash: return safe containment response (no stack trace or secrets to user)
        sanitized_user = sanitize_input(req.userText or "")
        err_safe = "Request failed"
        if any(x in str(e).lower() for x in ["connection", "timeout", "unreachable"]):
            err_safe = "Service temporarily unavailable"
        return _make_containment_response(
            req=req,
            final_answer="The analysis service encountered an unexpected error. Please try again later. Avoid running untrusted code or approving changes without manual review.",
            divergence_score=100.0,
            primary_output="",
            shadow_output="",
            primary_ok=False,
            shadow_ok=False,
            primary_err=err_safe,
            shadow_err="",
            sanitized_user=sanitized_user,
        )


def _make_containment_response(
    req: TurnRequest,
    final_answer: str,
    divergence_score: float,
    primary_output: str,
    shadow_output: str,
    primary_ok: bool,
    shadow_ok: bool,
    primary_err: str,
    shadow_err: str,
    sanitized_user: str,
) -> Dict[str, Any]:
    """Build a valid AnalysisResponse for containment/error cases."""
    user_input = req.userText or ""
    updated_graph = req.intentGraph or {}
    all_signals: List[str] = []
    scores = {"semanticDrift": 100, "policyStress": 100, "reasoningMismatch": 100, "total": divergence_score}
    log_obj = {
        "user_input": user_input,
        "sanitized_input": sanitized_user,
        "primary_output": primary_output,
        "shadow_output": shadow_output,
        "primary_error": primary_err or None,
        "shadow_error": shadow_err or None,
        "primary_ok": primary_ok,
        "shadow_ok": shadow_ok,
        "llm_mode": LLM_MODE_VAL or "legacy",
    }
    divergence_log = DivergenceLog(
        divergenceScore=divergence_score,
        action="contain",
        defenseActionTaken=True,
        rerunWithCleaned=False,
        user_input=user_input,
        sanitized_input=sanitized_user,
        primary_output=primary_output,
        shadow_output=shadow_output,
        primary_error=primary_err or None,
        shadow_error=shadow_err or None,
        primary_ok=primary_ok,
        shadow_ok=shadow_ok,
        llm_mode=LLM_MODE_VAL or "legacy",
    )
    return {
        "canonicalText": user_input[:500],
        "signals": all_signals,
        "updatedGraph": updated_graph,
        "scores": scores,
        "riskLevel": "critical",
        "action": "contain",
        "sanitizedText": final_answer,
        "primaryOutput": final_answer,
        "shadowOutput": shadow_output,
        "divergenceLog": divergence_log,
        "final_answer": final_answer,
        "divergence_score": divergence_score,
        "defense_action": "contain",
        "log": log_obj,
    }


async def _analyze_turn_impl(req: TurnRequest):
    user_input = req.userText or ""

    # 1. Canonicalization (for signals; canonical text used in graph)
    canonical_text, canonical_signals = progressive_canonicalize(user_input)

    # 2. Sanitize for shadow path (remove injection phrases)
    sanitized_user = sanitize_input(user_input)

    # 3. Intent Graph Builder
    conversation_for_graph = {
        "intent_graph": req.intentGraph,
        "user_text": user_input,
        "signals": canonical_signals,
    }
    updated_graph, violations = build_intent_graph(conversation_for_graph)
    all_signals = canonical_signals + violations

    # 4. Prepare prompts: primary = full user input + rules; shadow = sanitized user input only
    system_prompt = build_system_prompt(updated_graph)
    primary_user_message = user_input
    shadow_user_message = sanitized_user if sanitized_user.strip() else user_input

    # 5. Call both models (or simulated); never raise - use fallback on failure
    import asyncio
    from llm_client import LLM_MODE as LLM_MODE_VAL

    model_type = (req.modelType or "").strip().lower()
    primary_output: Optional[str] = None
    shadow_output: Optional[str] = None
    primary_meta: Dict[str, Any] = {}
    shadow_meta: Dict[str, Any] = {}
    primary_ok = False
    shadow_ok = False
    primary_err = ""
    shadow_err = ""

    if model_type == "simulated":
        logger.info("Using simulated mode (no LLM): modelType=%s", req.modelType)
        primary_output = f"[Simulated] I understand your request: {user_input[:100]}{'...' if len(user_input) > 100 else ''}. In a real session, I would assist with {req.intentGraph.get('goal', 'your task')}."
        shadow_output = primary_output
        primary_ok = True
        shadow_ok = True
    else:
        primary_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": primary_user_message},
        ]
        shadow_messages = [{"role": "user", "content": shadow_user_message}]
        (p_text, primary_meta), (s_text, shadow_meta) = await asyncio.gather(
            call_primary(primary_messages),
            call_shadow(shadow_messages),
        )
        primary_ok = primary_meta.get("ok", False)
        shadow_ok = shadow_meta.get("ok", False)
        primary_output = (p_text or "").strip() if primary_ok else ""
        shadow_output = (s_text or "").strip() if shadow_ok else ""
        primary_err = primary_meta.get("error_message", "") or primary_meta.get("error_type", "")
        shadow_err = shadow_meta.get("error_message", "") or shadow_meta.get("error_type", "")

        if not primary_ok:
            logger.warning("Primary LLM failed: %s", primary_err[:100])
        if not shadow_ok:
            logger.warning("Shadow LLM failed: %s", shadow_err[:100])

    # 6. Apply fallback logic when models fail
    thresholds = (req.policy or {}).get("divergenceThresholds") or {}
    if not primary_ok:
        # Primary failed: containment (both-fail or primary-fail)
        divergence_score = 100.0
        scores = {"semanticDrift": 100, "policyStress": 100, "reasoningMismatch": 100, "total": 100.0}
        defense_action = "contain"
        risk_level = "critical"
        primary_output = primary_output or ""
        shadow_output = shadow_output or ""
        conversation_for_defense = {
            "user_input": user_input,
            "primary_output": primary_output,
            "system_prompt": system_prompt,
            "signals": all_signals,
            "llm_unavailable": True,
        }
        final_answer = apply_defense(defense_action, conversation_for_defense)
        defense_action_taken = True
        rerun_with_cleaned = False
    elif not shadow_ok:
        # Shadow failed: degraded mode - use primary, score from heuristics
        scores = compute_divergence_degraded(
            primary_output or "",
            user_input,
            intent_graph=updated_graph,
            thresholds=thresholds,
        )
        divergence_score = scores.get("total", 0.0)
        inj_score = injection_indicator_score(user_input)
        defense_action = decide_defense_action(
            divergence_score,
            thresholds,
            req.defenseMode or "active",
        )
        if defense_action == "allow" and inj_score >= 30:
            defense_action = "clarify"
        risk_map = {"allow": "low", "clarify": "medium", "sanitize_rerun": "high", "contain": "critical"}
        risk_level = risk_map.get(defense_action, "medium")
        conversation_for_defense = {
            "user_input": user_input,
            "primary_output": primary_output or "",
            "system_prompt": system_prompt,
            "signals": all_signals,
        }
        final_answer = apply_defense(defense_action, conversation_for_defense)
        defense_action_taken = defense_action in ("sanitize_rerun", "contain")
        rerun_with_cleaned = defense_action == "sanitize_rerun"
    else:
        # Both ok: normal flow
        scores = compute_divergence(
            primary_output or "",
            shadow_output or "",
            intent_graph=updated_graph,
            thresholds=thresholds,
        )
        divergence_score = scores.get("total", 0.0)
        defense_action = decide_defense_action(
            divergence_score,
            thresholds,
            req.defenseMode or "active",
        )
        defense_action_taken = defense_action in ("sanitize_rerun", "contain")
        rerun_with_cleaned = defense_action == "sanitize_rerun"
        risk_map = {"allow": "low", "clarify": "medium", "sanitize_rerun": "high", "contain": "critical"}
        risk_level = risk_map.get(defense_action, "medium")
        conversation_for_defense = {
            "user_input": user_input,
            "primary_output": primary_output or "",
            "system_prompt": system_prompt,
            "signals": all_signals,
        }
        final_answer = apply_defense(defense_action, conversation_for_defense)

    sanitized_text = None
    if defense_action == "contain":
        sanitized_text = final_answer

    # Log object per spec (includes failure metadata)
    log_obj = {
        "user_input": user_input,
        "sanitized_input": sanitized_user,
        "primary_output": primary_output or "",
        "shadow_output": shadow_output or "",
        "primary_error": primary_err if not primary_ok else None,
        "shadow_error": shadow_err if not shadow_ok else None,
        "primary_ok": primary_ok,
        "shadow_ok": shadow_ok,
        "llm_mode": LLM_MODE_VAL or "legacy",
    }

    divergence_log = DivergenceLog(
        divergenceScore=divergence_score,
        action=defense_action,
        defenseActionTaken=defense_action_taken,
        rerunWithCleaned=rerun_with_cleaned,
        user_input=user_input,
        sanitized_input=sanitized_user,
        primary_output=primary_output or "",
        shadow_output=shadow_output or "",
        primary_error=primary_err if not primary_ok else None,
        shadow_error=shadow_err if not shadow_ok else None,
        primary_ok=primary_ok,
        shadow_ok=shadow_ok,
        llm_mode=LLM_MODE_VAL or "legacy",
    )

    logger.info(
        "divergence_score=%.2f action=%s defense_action_taken=%s",
        divergence_score, defense_action, defense_action_taken,
    )

    return {
        "canonicalText": canonical_text,
        "signals": all_signals,
        "updatedGraph": updated_graph,
        "scores": scores,
        "riskLevel": risk_level,
        "action": defense_action,
        "sanitizedText": sanitized_text,
        "primaryOutput": final_answer,
        "shadowOutput": shadow_output,
        "divergenceLog": divergence_log,
        "final_answer": final_answer,
        "divergence_score": divergence_score,
        "defense_action": defense_action,
        "log": log_obj,
    }


@app.get("/health")
def health_check():
    print("[defense/health] GET /health called")
    return {"status": "ok"}


@app.get("/llm-status")
def llm_status():
    return get_llm_status()


@app.get("/debug/llm")
def debug_llm(x_debug_key: Optional[str] = Header(None, alias="X-Debug-Key")):
    """Protected debug endpoint: returns active mode and confirms both Primary+Shadow paths (no secrets).
    Set DEBUG_LLM_KEY in env to require X-Debug-Key header; otherwise open for local dev."""
    import os
    debug_key = os.environ.get("DEBUG_LLM_KEY", "").strip()
    if debug_key and (not x_debug_key or x_debug_key != debug_key):
        raise HTTPException(status_code=403, detail="Invalid or missing X-Debug-Key header")
    return get_debug_llm_info()


if __name__ == "__main__":
    # Use port 5000 to match DEFENSE_SERVICE_URL and npm run dev:defense
    uvicorn.run(app, host="0.0.0.0", port=5000)
