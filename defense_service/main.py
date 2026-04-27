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
import json

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

# --- Hardening Utilities ---
from collections import defaultdict
import time

class RateLimiter:
    def __init__(self, requests_per_minute=20):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        self.requests[client_id] = [r for r in self.requests[client_id] if now - r < 60]
        if len(self.requests[client_id]) < self.requests_per_minute:
            self.requests[client_id].append(now)
            return True
        return False

rate_limiter = RateLimiter(requests_per_minute=20)
llm_semaphore = asyncio.Semaphore(5)  # Limit parallel LLM calls
failure_counter = {"count": 0, "last_failure": 0}

def compute_advanced_divergence(p_data: dict, s_data: dict) -> dict:
    """Weighted divergence scoring based on intent and risk gaps."""
    if not s_data:
        return {"divergence_score": p_data.get("risk_score", 0), "reason": "primary_only"}
    
    score = float(p_data.get("risk_score", 0))
    reason = "risk_gap"
    
    # Weight 1: Intent Mismatch (High impact)
    if p_data.get("intent") != s_data.get("intent"):
        score = max(score, 75.0)
        reason = "intent_mismatch"
    
    # Weight 2: Risk Delta (Medium impact)
    risk_delta = abs(score - float(s_data.get("risk_score", 0)))
    if risk_delta > 40:
        score = max(score, 80.0)
        reason = "both" if reason == "intent_mismatch" else "risk_gap"
        
    return {"divergence_score": score, "reason": reason}


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
async def analyze_turn(req: TurnRequest, x_forwarded_for: Optional[str] = Header(None, alias="X-Forwarded-For")):
    client_ip = x_forwarded_for or "unknown"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute.")

    # Fallback mode for repeated 503 errors
    if failure_counter["count"] > 5 and (time.time() - failure_counter["last_failure"] < 300):
        logger.warning("Service in fallback mode due to repeated LLM failures")
        sanitized = sanitize_input(req.userText)
        return {
            "canonicalText": req.userText[:500],
            "signals": ["fallback_mode_active"],
            "updatedGraph": req.intentGraph,
            "scores": {"total": 100},
            "riskLevel": "critical",
            "action": "contain",
            "sanitizedText": "Service is under maintenance. Please try a simpler request later.",
            "primaryOutput": "Service temporarily degraded.",
            "shadowOutput": "",
            "final_answer": "Service temporarily degraded.",
            "divergence_score": 100,
            "defense_action": "contain",
            "log": {"mode": "fallback"}
        }

    try:
        async with llm_semaphore:
            return await _analyze_turn_impl(req)
    except HTTPException:
        failure_counter["count"] += 1
        failure_counter["last_failure"] = time.time()
        raise
    except Exception as e:
        logger.exception("Analyze failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Defense service error: {str(e)}")

def parse_llm_json(text: str) -> Dict[str, Any]:
    """Extract and parse JSON from LLM response."""
    try:
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
        return json.loads(text)
    except Exception:
        # Fallback if LLM fails to return valid JSON
        return {"risk_score": 50, "action": "block", "answer": text, "intent": "unknown"}


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

    # 1. Preprocessing (Non-blocking)
    canonical_res = await asyncio.to_thread(progressive_canonicalize, user_input)
    canonical_text, canonical_signals = canonical_res
    sanitized_user = await asyncio.to_thread(sanitize_input, user_input)

    # 2. Intent Graph Builder (Non-blocking)
    conversation_for_graph = {
        "intent_graph": req.intentGraph,
        "user_text": user_input,
        "signals": canonical_signals,
    }
    graph_res = await asyncio.to_thread(build_intent_graph, conversation_for_graph)
    updated_graph, violations = graph_res
    all_signals = canonical_signals + violations

    # 3. Prepare prompts
    system_prompt = build_system_prompt(updated_graph)
    primary_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input},
    ]

    # 4. Hybrid Confidence-Based Execution
    model_type = (req.modelType or "").strip().lower()
    
    # Tier 1: Heuristic / Rule check (Lightweight)
    inj_score = injection_indicator_score(user_input)
    if inj_score >= 80:
        logger.info("Heuristic trigger: high risk detected (%s)", inj_score)
        primary_data = {"intent": "attack", "risk_score": 95, "action": "block", "answer": "Request blocked by safety filters."}
        primary_ok, shadow_ok = True, False
        primary_output, shadow_output, shadow_data = primary_data["answer"], "", {}
    elif model_type == "simulated":
        primary_output = f"[Simulated] I understand your request: {user_input[:100]}..."
        primary_data = {"intent": "simulated", "risk_score": 0, "action": "allow", "answer": primary_output}
        primary_ok, shadow_ok = True, True
        shadow_output, shadow_data = "", {}
    else:
        # Tier 2: Primary LLM Evaluation
        primary_text, primary_meta = await call_primary(primary_messages)
        if not primary_meta.get("ok"):
            raise HTTPException(status_code=503, detail=f"Primary LLM unavailable: {primary_meta.get('error_message')}")
        
        failure_counter["count"] = 0 # Reset on success
        primary_ok = True
        primary_data = parse_llm_json(primary_text)
        primary_output = primary_data.get("answer", primary_text)
        risk_score = primary_data.get("risk_score", 0)
        
        shadow_ok = False
        shadow_output, shadow_data = "", {}
        
        # Tier 3: Conditional Shadow Validation (Ambiguous Risk)
        if 30 <= risk_score <= 80 or (risk_score < 30 and inj_score > 40):
            shadow_messages = [{"role": "user", "content": sanitized_user or user_input}]
            s_text, shadow_meta = await call_shadow(shadow_messages)
            if shadow_meta.get("ok"):
                shadow_ok = True
                shadow_data = parse_llm_json(s_text)
                shadow_output = shadow_data.get("answer", s_text)

    # 5. Advanced Divergence & Decision Logic
    thresholds = (req.policy or {}).get("divergenceThresholds") or {"low": 10, "medium": 30, "high": 60, "critical": 85}
    div_results = compute_advanced_divergence(primary_data, shadow_data)
    divergence_score = div_results["divergence_score"]
    
    defense_action = decide_defense_action(divergence_score, thresholds, req.defenseMode or "active")
    
    # Tier 4: Blocking Override
    if primary_data.get("action") == "block" and divergence_score > thresholds["low"]:
        defense_action = "contain"

    risk_map = {"allow": "low", "clarify": "medium", "sanitize_rerun": "high", "contain": "critical"}
    risk_level = risk_map.get(defense_action, "medium")
    
    final_answer = apply_defense(defense_action, {
        "user_input": user_input,
        "primary_output": primary_output,
        "system_prompt": system_prompt,
        "signals": all_signals + [div_results["reason"]] if div_results.get("reason") else all_signals
    })

    sanitized_text = final_answer if defense_action == "contain" else None
    defense_action_taken = defense_action in ("sanitize_rerun", "contain")
    rerun_with_cleaned = defense_action == "sanitize_rerun"

    # Log object (includes failure metadata)
    log_obj = {
        "user_input": user_input,
        "sanitized_input": sanitized_user,
        "primary_output": primary_output,
        "shadow_output": shadow_output,
        "primary_ok": primary_ok,
        "shadow_ok": shadow_ok,
        "llm_mode": LLM_MODE_VAL or "legacy",
        "primary_intent": primary_data.get("intent"),
        "shadow_intent": shadow_data.get("intent") if shadow_ok else None
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
        primary_ok=primary_ok,
        shadow_ok=shadow_ok,
        llm_mode=LLM_MODE_VAL or "legacy",
    )

    return {
        "canonicalText": canonical_text,
        "signals": all_signals,
        "updatedGraph": updated_graph,
        "scores": {"total": divergence_score},
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
