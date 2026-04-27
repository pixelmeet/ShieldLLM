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
import uuid

import collections

class RateLimiter:
    def __init__(self, requests_per_minute=20, max_clients=10000):
        self.requests_per_minute = requests_per_minute
        self.requests = {}
        self.locks = {}
        self.max_clients = max_clients
        
    def _get_lock(self, client_id: str):
        if client_id not in self.locks:
            self.locks[client_id] = asyncio.Lock()
        return self.locks[client_id]

    async def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        lock = self._get_lock(client_id)
        
        async with lock:
            if client_id not in self.requests:
                if len(self.requests) >= self.max_clients:
                    # Fairness fix: TTL-based cleanup to prioritize inactive clients
                    cutoff = now - 60
                    inactive = [k for k, v in self.requests.items() if not v or v[-1] < cutoff]
                    if inactive:
                        for k in inactive[:50]:
                            self.requests.pop(k, None)
                            self.locks.pop(k, None)
                    else:
                        # Fallback to oldest active if no inactive found
                        oldest = min(self.requests.keys(), key=lambda k: self.requests[k][-1] if self.requests[k] else 0)
                        self.requests.pop(oldest, None)
                        self.locks.pop(oldest, None)
                self.requests[client_id] = []
                
            # Sliding window cleanup
            self.requests[client_id] = [r for r in self.requests[client_id] if now - r < 60]
            
            if len(self.requests[client_id]) < self.requests_per_minute:
                self.requests[client_id].append(now)
                return True
            return False

rate_limiter = RateLimiter(requests_per_minute=20)

class MetricsTracker:
    def __init__(self):
        self.total_requests = 0
        self.total_failures = 0
        self.request_timestamps = collections.deque()
        self._lock = asyncio.Lock()
        
    async def record_request(self):
        async with self._lock:
            self.total_requests += 1
            now = time.time()
            self.request_timestamps.append(now)
            while self.request_timestamps and now - self.request_timestamps[0] > 60:
                self.request_timestamps.popleft()
                
    async def record_failure(self):
        async with self._lock:
            self.total_failures += 1
            
    async def get_metrics_snapshot(self):
        async with self._lock:
            now = time.time()
            while self.request_timestamps and now - self.request_timestamps[0] > 60:
                self.request_timestamps.popleft()
            return {
                "requests_per_minute": len(self.request_timestamps),
                "total_requests": self.total_requests,
                "total_failures": self.total_failures
            }

metrics = MetricsTracker()

class CircuitBreaker:
    def __init__(self, failure_threshold=5, success_threshold=2, reset_timeout=300):
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.reset_timeout = reset_timeout
        self.failures = 0
        self.successes = 0
        self.last_failure_time = 0
        self.state = "CLOSED"
        self.half_open_probes = 0
        self.lock = asyncio.Lock()

    async def acquire(self) -> bool:
        async with self.lock:
            if self.state == "CLOSED":
                return True
            if self.state == "OPEN":
                if time.time() - self.last_failure_time >= self.reset_timeout:
                    self.state = "HALF-OPEN"
                    self.successes = 0
                    self.half_open_probes = 1
                    return True
                return False
            if self.state == "HALF-OPEN":
                if self.half_open_probes < self.success_threshold:
                    self.half_open_probes += 1
                    return True
                return False
            return False

    async def record_success(self):
        async with self.lock:
            if self.state == "HALF-OPEN":
                self.successes += 1
                if self.successes >= self.success_threshold:
                    self.state = "CLOSED"
                    self.failures = 0
                    self.successes = 0
            elif self.state == "CLOSED":
                self.failures = 0

    async def record_failure(self):
        async with self.lock:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.state == "HALF-OPEN" or self.failures >= self.failure_threshold:
                self.state = "OPEN"
                self.half_open_probes = 0

circuit_breaker = CircuitBreaker()

def compute_advanced_divergence(p_data: dict, s_data: dict) -> dict:
    """Weighted divergence scoring based on intent and risk gaps."""
    if not s_data:
        return {"divergence_score": float(p_data.get("risk_score", 0)), "reason": "none"}
    
    score = float(p_data.get("risk_score", 0))
    reason = "none"
    
    p_intent = str(p_data.get("intent", "")).strip().lower()
    s_intent = str(s_data.get("intent", "")).strip().lower()
    
    # Weight 1: Intent Mismatch (only if meaningful)
    if p_intent and s_intent and p_intent != s_intent:
        score = max(score, 75.0)
        reason = "intent_mismatch"
    
    # Weight 2: Risk Delta
    s_risk = float(s_data.get("risk_score", 0))
    risk_delta = abs(score - s_risk)
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
        "metrics": "/metrics",
        "llm_status": "/llm-status",
        "debug_llm": "GET /debug/llm",
        "analyze": "POST /analyze",
    }

@app.get("/metrics")
async def get_metrics():
    from llm_client import get_llm_metrics
    stats = await metrics.get_metrics_snapshot()
    stats.update(get_llm_metrics())
    stats["circuit_state"] = circuit_breaker.state
    return stats


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


@app.post("/analyze", response_model_exclude_none=False)
async def analyze_turn(req: TurnRequest, x_forwarded_for: Optional[str] = Header(None, alias="X-Forwarded-For")):
    from fastapi.responses import JSONResponse
    req_id = str(uuid.uuid4())
    client_ip = (x_forwarded_for or "unknown").split(",")[0].strip()
    
    await metrics.record_request()
    
    if not await rate_limiter.is_allowed(client_ip):
        logger.warning(json.dumps({
            "request_id": req_id, "client_id": client_ip, "error": "Rate limit exceeded"
        }))
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute.")

    # Circuit Breaker check
    if not await circuit_breaker.acquire():
        logger.warning(json.dumps({
            "request_id": req_id, "client_id": client_ip, "circuit_state": circuit_breaker.state, "error": "Circuit breaker OPEN"
        }))
        return JSONResponse(status_code=200, content={
            "status": "degraded",
            "decision": "unverified",
            "message": "LLM unavailable, request not verified"
        })

    try:
        # Prevent queue DoS by adding a timeout for execution
        try:
            async with asyncio.timeout(30.0): # Python 3.11+ 
                res = await _analyze_turn_impl(req, req_id, client_ip)
                if isinstance(res, JSONResponse):
                    # Indicates LLM failure after retries
                    await circuit_breaker.record_failure()
                    await metrics.record_failure()
                else:
                    await circuit_breaker.record_success()
                return res
        except (asyncio.TimeoutError, TimeoutError):
            logger.error(json.dumps({
                "request_id": req_id, "client_id": client_ip, "error": "Timeout executing LLM"
            }))
            await circuit_breaker.record_failure()
            await metrics.record_failure()
            raise HTTPException(status_code=503, detail="Server overloaded. Please try again later.")
            
    except HTTPException:
        # Proper HTTP exceptions
        await circuit_breaker.record_failure()
        await metrics.record_failure()
        raise
    except Exception as e:
        # ALL other generic internal exceptions MUST increment circuit breaker and raise 503
        logger.exception(json.dumps({
            "request_id": req_id, "client_id": client_ip, "error": f"Unhandled analyze error: {str(e)}"
        }))
        await circuit_breaker.record_failure()
        await metrics.record_failure()
        raise HTTPException(status_code=503, detail="Internal Defense Error")

def parse_llm_json(text: str) -> Dict[str, Any]:
    """Extract and parse JSON from LLM response."""
    try:
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
        return json.loads(text)
    except Exception:
        # Safe fallback, avoiding false positives on poor parsing
        return {"risk_score": 0, "action": "unknown", "intent": "parse_error", "answer": text}


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


async def _analyze_turn_impl(req: TurnRequest, req_id: str, client_ip: str):
    from fastapi.responses import JSONResponse
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
    
    retry_budget = {"remaining": 3}
    primary_meta = {}
    risk_score = 0
    inj_score = injection_indicator_score(user_input)
    
    if inj_score >= 80:
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
        primary_text, primary_meta = await call_primary(primary_messages, retry_budget=retry_budget)
        if not primary_meta.get("ok"):
            # Return explicit degraded response if LLM fails after retries
            return JSONResponse(content={
                "status": "degraded",
                "decision": "unverified",
                "message": "LLM unavailable, request not verified"
            })
        
        primary_ok = True
        primary_data = parse_llm_json(primary_text)
        primary_output = primary_data.get("answer", primary_text)
        risk_score = primary_data.get("risk_score", 0)
        
        shadow_ok = False
        shadow_output, shadow_data = "", {}
        
        # Tier 3: Conditional Shadow Validation (Ambiguous Risk)
        if 30 <= risk_score <= 80 or (risk_score < 30 and inj_score > 40):
            shadow_messages = [{"role": "user", "content": sanitized_user or user_input}]
            s_text, shadow_meta = await call_shadow(shadow_messages, retry_budget=retry_budget)
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
        "signals": all_signals + [div_results["reason"]] if div_results.get("reason") and div_results["reason"] != "none" else all_signals
    })

    sanitized_text = final_answer if defense_action == "contain" else None
    defense_action_taken = defense_action in ("sanitize_rerun", "contain")
    rerun_with_cleaned = defense_action == "sanitize_rerun"

    log_data = {
        "request_id": req_id,
        "client_id": client_ip,
        "cache_hit": getattr(primary_meta, "get", lambda x, y: y)("latency_ms", 1) < 5 if primary_meta else False,
        "circuit_state": circuit_breaker.state,
        "risk_score": risk_score,
        "divergence_score": divergence_score,
        "decision": defense_action,
        "llm_provider_used": getattr(primary_meta, "get", lambda x, y: y)("model", PRIMARY_MODEL) if primary_meta else "none",
        "latency_ms": getattr(primary_meta, "get", lambda x, y: y)("latency_ms", 0) if primary_meta else 0,
        "error": getattr(primary_meta, "get", lambda x, y: y)("error_message", "") if primary_meta else ""
    }
    logger.info(json.dumps(log_data))

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

    return AnalysisResponse(
        canonicalText=canonical_text,
        signals=all_signals,
        updatedGraph=updated_graph,
        scores={"total": divergence_score},
        riskLevel=risk_level,
        action=defense_action,
        sanitizedText=sanitized_text,
        primaryOutput=final_answer,
        shadowOutput=shadow_output,
        divergenceLog=divergence_log,
        final_answer=final_answer,
        divergence_score=divergence_score,
        defense_action=defense_action,
        log=log_data
    )


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
