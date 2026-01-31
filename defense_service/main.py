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

from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import uvicorn

from canonicalize import progressive_canonicalize
from intent_graph import build_intent_graph
from sanitize import sanitize_input
from divergence import compute_divergence
from policy import decide_defense_action
from llm_client import call_primary_llm, call_shadow_llm, get_llm_status
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


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_turn(req: TurnRequest):
    print(f"[defense/analyze] POST /analyze called")
    print(f"[defense/analyze] Request data: userText={req.userText[:100] if req.userText else 'None'}...")
    print(f"[defense/analyze] defenseMode={req.defenseMode}, modelType={req.modelType}")
    try:
        result = await _analyze_turn_impl(req)
        print(f"[defense/analyze] SUCCESS: action={result.get('action')}, divergence={result.get('divergence_score')}")
        return result
    except Exception as e:
        err_msg = str(e)
        logger.exception("Analyze failed: %s", e)
        print(f"[defense/analyze] ERROR: {err_msg}")  # console.log equivalent
        import traceback
        print(f"[defense/analyze] TRACEBACK:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=err_msg)


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

    # 5. Call both OpenAI models (or use simulated responses when modelType is simulated)
    import asyncio
    model_type = (req.modelType or "").strip().lower()
    if model_type == "simulated":
        logger.info("Using simulated mode (no LLM): modelType=%s", req.modelType)
        primary_output = f"[Simulated] I understand your request: {user_input[:100]}{'...' if len(user_input) > 100 else ''}. In a real session, I would assist with {req.intentGraph.get('goal', 'your task')}."
        shadow_output = primary_output  # Same output = low divergence in demo
    else:
        try:
            primary_output, shadow_output = await asyncio.gather(
                call_primary_llm(system_prompt, primary_user_message),
                call_shadow_llm(shadow_user_message)
            )
        except Exception as llm_err:
            err_msg = str(llm_err).lower()
            if "connection" in err_msg or "econnrefused" in err_msg or "connect" in err_msg or "unreachable" in err_msg:
                raise RuntimeError(
                    "Primary or shadow LLM backend is not running or unreachable. "
                    "Start vLLM backends (PRIMARY_BASE_URL / SHADOW_BASE_URL in .env) or create a session with Model Backend: Simulated."
                ) from llm_err
            raise

    # 6. Divergence Analyzer (semantic + policy + reasoning)
    thresholds = (req.policy or {}).get("divergenceThresholds") or {}
    scores = compute_divergence(
        primary_output,
        shadow_output,
        intent_graph=updated_graph,
        thresholds=thresholds,
    )
    divergence_score = scores.get("total", 0.0)

    # 7. Defense Controller decision
    defense_action = decide_defense_action(
        divergence_score,
        thresholds,
        req.defenseMode or "active",
    )

    # 8. Apply defense: allow / clarify / sanitize_rerun / contain
    defense_action_taken = False
    rerun_with_cleaned = False
    conversation_for_defense = {
        "user_input": user_input,
        "primary_output": primary_output,
        "system_prompt": system_prompt,
        "signals": all_signals,
    }
    final_answer = apply_defense(defense_action, conversation_for_defense)

    if defense_action in ("sanitize_rerun", "contain"):
        defense_action_taken = True
        if defense_action == "sanitize_rerun":
            rerun_with_cleaned = True

    risk_map = {
        "allow": "low",
        "clarify": "medium",
        "sanitize_rerun": "high",
        "contain": "critical",
    }
    risk_level = risk_map.get(defense_action, "medium")

    sanitized_text = None
    if defense_action == "contain":
        sanitized_text = final_answer

    # Log object per spec
    log_obj = {
        "user_input": user_input,
        "sanitized_input": sanitized_user,
        "primary_output": primary_output,
        "shadow_output": shadow_output,
    }

    divergence_log = DivergenceLog(
        divergenceScore=divergence_score,
        action=defense_action,
        defenseActionTaken=defense_action_taken,
        rerunWithCleaned=rerun_with_cleaned,
        user_input=user_input,
        sanitized_input=sanitized_user,
        primary_output=primary_output,
        shadow_output=shadow_output,
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


if __name__ == "__main__":
    # Use port 5000 to match DEFENSE_SERVICE_URL and npm run dev:defense
    uvicorn.run(app, host="0.0.0.0", port=5000)
