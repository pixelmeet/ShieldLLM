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
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import logging
import uvicorn
import json
import os

from canonicalize import progressive_canonicalize
from intent_graph import build_intent_graph
from sanitize import sanitize_input
from divergence import compute_divergence, compute_divergence_degraded, injection_indicator_score
from policy import decide_defense_action
from llm_client import call_primary, call_shadow, get_llm_status, get_debug_llm_info, LLM_MODE as LLM_MODE_VAL, PRIMARY_MODEL
from system_prompt import build_system_prompt
from defense_controller import apply_defense
import base64
import urllib.parse
import binascii
import re

app = FastAPI(title="ShieldLLM Defense Service", description="Dual-LLM Prompt Injection Defense")

allowed_origin = os.getenv("ALLOWED_ORIGIN", "*")
origins = [allowed_origin, "http://localhost:3000", "http://localhost:3001"] if allowed_origin != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if allowed_origin != "*" else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("shieldllm.defense")

# --- Multi-turn Conversation Store (FIX 3) ---
conversation_store: Dict[str, List[Dict[str, str]]] = {}
MAX_SESSIONS = 1000
MAX_HISTORY_TURNS = 10

def _get_history(session_id: str) -> List[Dict[str, str]]:
    return conversation_store.get(session_id, [])

def _append_history(session_id: str, user_msg: str, assistant_msg: str):
    if session_id not in conversation_store:
        # Memory cap: evict oldest sessions if over limit
        if len(conversation_store) >= MAX_SESSIONS:
            keys_to_remove = list(conversation_store.keys())[:100]
            for k in keys_to_remove:
                conversation_store.pop(k, None)
        conversation_store[session_id] = []
    conversation_store[session_id].append({"role": "user", "content": user_msg})
    conversation_store[session_id].append({"role": "assistant", "content": assistant_msg})
    # Trim to last MAX_HISTORY_TURNS pairs (20 messages)
    conversation_store[session_id] = conversation_store[session_id][-(MAX_HISTORY_TURNS * 2):]

def try_decode(user_input: str) -> str:
    """Attempt to decode base64, hex, or url-encoded payloads."""
    # Base64
    try:
        if re.match(r'^[A-Za-z0-9+/]+={0,2}$', user_input.strip()) and len(user_input.strip()) % 4 == 0:
            return base64.b64decode(user_input.strip()).decode('utf-8', errors='ignore')
    except Exception: pass
    # Hex
    try:
        if re.match(r'^[0-9a-fA-F]+$', user_input.strip()):
            return bytes.fromhex(user_input.strip()).decode('utf-8', errors='ignore')
    except Exception: pass
    # URL-encoded
    try:
        decoded = urllib.parse.unquote(user_input)
        if decoded != user_input:
            return decoded
    except Exception: pass
    return ""

def validate_response_contract(llm_data: Dict[str, Any], final_score: float, final_risk: str):
    """Enforce strict scoring-to-risk mapping and check for LLM internal inconsistency."""
    total = final_score
    
    # Map new schema risk_level to numeric if present
    level_map = {"low": 10, "medium": 45, "high": 75, "critical": 95}
    llm_risk_str = str(llm_data.get("risk_level", llm_data.get("riskLevel", ""))).lower()
    llm_score = float(llm_data.get("risk_score", level_map.get(llm_risk_str, 0)))
    
    # 1. Internal Consistency: Did the LLM claim low risk but high score?
    if llm_score > 70 and llm_risk_str == "low":
        raise HTTPException(500, "Invalid model response: LLM internal risk mismatch")
    
    # 2. Safety Mapping: Is the final risk level appropriate for the score?
    if total > 70 and final_risk not in ["high", "critical"]:
        raise HTTPException(500, "Invalid model response: Risk mapping mismatch (High)")
    if total < 30 and final_risk != "low":
        raise HTTPException(500, "Invalid model response: Risk mapping mismatch (Low)")

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
                    self.probe_in_progress = True # HALF_OPEN allows ONLY ONE request
                    return True
                return False
            if self.state == "HALF-OPEN":
                # Only allow one probe at a time
                if getattr(self, "probe_in_progress", False):
                    return False
                self.probe_in_progress = True
                return True
            return False

    async def record_success(self):
        async with self.lock:
            if self.state == "HALF-OPEN":
                self.successes += 1
                self.probe_in_progress = False
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
            self.probe_in_progress = False
            if self.state == "HALF-OPEN" or self.failures >= self.failure_threshold:
                self.state = "OPEN"

circuit_breaker = CircuitBreaker()

def compute_advanced_divergence(p_data: dict, s_data: dict) -> dict:
    """Weighted divergence scoring based on intent and risk gaps."""
    level_map = {"low": 10, "medium": 45, "high": 75, "critical": 95}
    
    def get_score(data):
        if not data: return 0
        if "risk_score" in data: return float(data["risk_score"])
        level = str(data.get("risk_level", "low")).lower()
        return level_map.get(level, 10)

    p_score = get_score(p_data)
    if not s_data:
        return {"divergence_score": float(p_score), "reason": "none"}
    
    score = p_score
    reason = "none"
    
    p_intent = str(p_data.get("intent", p_data.get("input_threat", ""))).strip().lower()
    s_intent = str(s_data.get("intent", s_data.get("input_threat", ""))).strip().lower()
    
    # Weight 1: Intent Mismatch (only if meaningful)
    if p_intent and s_intent and p_intent != s_intent:
        score = max(score, 75.0)
        reason = "intent_mismatch"
    
    # Weight 2: Risk Delta
    s_risk = get_score(s_data)
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
    sessionId: Optional[str] = None

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
    status: str = "ok"
    message: str = "OK"
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
    llm_called: bool = True
    provider: str = "groq"
    model: str = "llama3-8b-8192"
    llm_latency_ms: float = 0.0
    preprocessing_latency_ms: float = 0.0
    total_latency_ms: float = 0.0
    security_level: Optional[str] = "full"
    divergence: float = 0.0


@app.post("/analyze", response_model_exclude_none=False)
async def analyze_turn(
    req: TurnRequest, 
    x_forwarded_for: Optional[str] = Header(None, alias="X-Forwarded-For")
):
    print(">>> ENTERED FASTAPI /analyze")
    print("modelType:", req.modelType)
    print("circuit_state:", circuit_breaker.state)
    
    from fastapi.responses import JSONResponse
    req_id = str(uuid.uuid4())
    client_ip = (x_forwarded_for or "unknown").split(",")[0].strip()
    
    await metrics.record_request()
    
    if not await rate_limiter.is_allowed(client_ip):
        logger.warning(json.dumps({
            "request_id": req_id, "client_id": client_ip, "rate_limited": True, "error": "Rate limit exceeded",
            "model_type": req.modelType or "groq", "llm_called": False, "circuit_state": circuit_breaker.state,
            "status": "degraded", "latency_ms": 0
        }))
        return JSONResponse(status_code=429, content={"status": "error", "message": "Too many requests. Please wait a minute."})

    # Circuit Breaker check
    if not await circuit_breaker.acquire():
        logger.warning(json.dumps({
            "request_id": req_id, "client_id": client_ip, "circuit_state": circuit_breaker.state, "error": "Circuit breaker OPEN",
            "model_type": req.modelType or "groq", "llm_called": False, "rate_limited": False,
            "status": "degraded", "latency_ms": 0
        }))
        return JSONResponse(status_code=503, content={
            "status": "degraded",
            "reason": "llm_unavailable",
            "llm_called": False
        })

    try:
        # Prevent queue DoS by adding a timeout for execution
        try:
            async with asyncio.timeout(30.0): # Python 3.11+ 
                start_total = time.perf_counter()
                res = await _analyze_turn_impl(req, req_id, client_ip, start_total)
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
            return JSONResponse(status_code=503, content={
                "status": "degraded",
                "reason": "llm_unavailable",
                "llm_called": False
            })
            
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
        return {
            "risk_level": "medium", 
            "risk_score": 50, 
            "action": "warn", 
            "input_threat": "parse_error", 
            "response": text,
            "reason": "Failed to parse JSON response"
        }


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
        "status": "ok",
        "message": "OK",
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
        "llm_called": False,
        "provider": "groq"
    }


async def _analyze_turn_impl(req: TurnRequest, req_id: str, client_ip: str, start_total: float):
    print(">>> Pipeline started")
    from fastapi.responses import JSONResponse
    user_input = req.userText or ""

    # Enforce input length limit
    max_chars = int(os.getenv("INPUT_MAX_CHARS", "20000"))
    if len(user_input) > max_chars:
        return JSONResponse(status_code=400, content={
            "status": "error",
            "message": f"Input too long. Maximum {max_chars} characters allowed."
        })

    # 1. Preprocessing (Non-blocking)
    print(">>> Before heuristics")
    prep_start = time.perf_counter()
    canonical_res = await asyncio.to_thread(progressive_canonicalize, user_input)
    canonical_text, canonical_signals = canonical_res
    sanitized_user = await asyncio.to_thread(sanitize_input, user_input)
    # Use canonicalized text for injection detection (fixes Unicode bypass)
    effective_input = canonical_text if canonical_text else user_input

    # 2. Intent Graph Builder (Non-blocking)
    session_id = req.sessionId or "unknown"
    history = _get_history(session_id)
    conversation_for_graph = {
        "intent_graph": req.intentGraph,
        "user_text": user_input,
        "signals": canonical_signals,
        "history": history,
    }
    graph_res = await asyncio.to_thread(build_intent_graph, conversation_for_graph)
    updated_graph, violations = graph_res
    all_signals = canonical_signals + violations
    
    preprocessing_latency_ms = (time.perf_counter() - prep_start) * 1000

    # 3. Prepare prompts with conversation history
    system_prompt = build_system_prompt(updated_graph)
    primary_messages = [
        {"role": "system", "content": system_prompt},
        *history[-(MAX_HISTORY_TURNS * 2):],
        {"role": "user", "content": user_input},
    ]

    # 4. Hybrid Confidence-Based Execution
    # PROVIDER ENFORCEMENT: Ignore client request, enforce server-side only
    model_type = os.getenv("MODEL_TYPE", "groq").strip().lower()
    if model_type != "groq":
        raise HTTPException(500, "Invalid server configuration")
    
    # ENCODED INJECTION DEFENSE
    decoded = try_decode(user_input)
    force_contain = False
    if decoded:
        # Re-run heuristics on BOTH original + decoded
        canonical_res_dec = await asyncio.to_thread(progressive_canonicalize, decoded)
        all_signals.extend(canonical_res_dec[1])
        if any(word in decoded.lower() for word in ["ignore", "bypass", "override"]):
            force_contain = True

    retry_budget = {"remaining": 3}
    primary_meta = {}
    shadow_meta = {}
    risk_score = 0
    # Score injection on BOTH original and canonicalized text (fixes Unicode bypass)
    inj_score = max(
        injection_indicator_score(user_input),
        injection_indicator_score(effective_input)
    )
    if decoded:
        inj_score = max(inj_score, injection_indicator_score(decoded))
    
    shadow_failed = False
    disable_cache = (circuit_breaker.state != "CLOSED" or not req.intentGraph or not req.policy)

    if force_contain or inj_score >= 70:
        primary_data = {"intent": "attack", "risk_score": 95, "action": "block", "answer": "Request blocked by safety filters."}
        primary_ok, shadow_ok = True, False
        primary_output, shadow_output, shadow_data = primary_data["answer"], "", {}
    else:
        # Tier 2: Primary LLM Evaluation
        print(">>> Before LLM call")
        primary_text, primary_meta = await call_primary(
            primary_messages, 
            retry_budget=retry_budget, 
            model_type=model_type,
            policy=req.policy,
            intent_graph=req.intentGraph,
            session_id=req.sessionId or "unknown",
            disable_cache=disable_cache
        )
        if not primary_meta.get("ok"):
            # Return explicit degraded response if LLM fails after retries
            return JSONResponse(status_code=503, content={
                "status": "degraded",
                "llm_called": False
            })
        
        primary_ok = True
        primary_data = parse_llm_json(primary_text)
        primary_output = primary_data.get("response") or primary_data.get("answer") or primary_text
        
        # Determine risk score from level or score
        level_map = {"low": 10, "medium": 45, "high": 75, "critical": 95}
        risk_score = level_map.get(str(primary_data.get("risk_level", "")).lower(), float(primary_data.get("risk_score", 0)))
        
        shadow_ok = False
        shadow_output, shadow_data = "", {}
        
        # Tier 3: Conditional Shadow Validation (Ambiguous Risk)
        if 30 <= risk_score <= 80 or (risk_score < 30 and inj_score > 40):
            shadow_messages = [{"role": "user", "content": sanitized_user or user_input}]
            s_text, shadow_meta = await call_shadow(
                shadow_messages, 
                retry_budget=retry_budget, 
                model_type=model_type,
                policy=req.policy,
                intent_graph=req.intentGraph,
                session_id=req.sessionId or "unknown",
                disable_cache=disable_cache
            )
            if shadow_meta.get("ok"):
                shadow_ok = True
                shadow_data = parse_llm_json(s_text)
                shadow_output = shadow_data.get("response") or shadow_data.get("answer") or s_text
            else:
                shadow_failed = True

    # 5. Advanced Divergence & Decision Logic
    thresholds = (req.policy or {}).get("divergenceThresholds") or {"low": 10, "medium": 30, "high": 60, "critical": 85}
    div_results = compute_advanced_divergence(primary_data, shadow_data)
    divergence_score = div_results["divergence_score"]
    
    # Intent Graph Boost: If we detected forbidden intent, override risk to critical
    if violations:
        print(f">>> Intent Graph VIOLATION: {violations}")
        divergence_score = max(divergence_score, 95.0)
    
    if force_contain:
        defense_action = "contain"
    else:
        defense_action = decide_defense_action(divergence_score, thresholds, req.defenseMode or "active")
    
    # Tier 4: Blocking Overrides (New Hardening Rules)
    weapon_patterns = [
        r"\\x[0-9a-fA-F]{2}", # Hex shellcode
        r"(?:exec|system|spawn|eval|open)\s*\(", # Process execution in code
        r"(?:base64 -d|sh -c|bash -i|/dev/tcp/)", # Linux shell tricks
        r"powershell\s+(?:-enc|-Command)", # PowerShell tricks
        r"(?:DROP|DELETE|UPDATE|TRUNCATE)\s+(?:TABLE|FROM|DATABASE)", # Destructive SQL
    ]
    output_weaponized = any(re.search(p, primary_output, re.IGNORECASE) for p in weapon_patterns)

    is_blocked = (
        primary_data.get("action") == "block" or 
        primary_data.get("output_threat", "none").lower() != "none" or
        primary_data.get("session_anomaly") is True or
        float(primary_data.get("confidence", 1.0)) < 0.4 or
        output_weaponized # Fix #9: Output Weaponization Scan
    )
    if is_blocked and divergence_score > thresholds["low"]:
        defense_action = "contain"

    risk_map = {"allow": "low", "clarify": "medium", "sanitize_rerun": "high", "contain": "critical"}
    risk_level = risk_map.get(defense_action, "medium")
    
    # RESPONSE VALIDATION LAYER
    validate_response_contract(primary_data, divergence_score, risk_level)
    
    final_answer = apply_defense(defense_action, {
        "user_input": user_input,
        "primary_output": primary_output,
        "system_prompt": system_prompt,
        "signals": all_signals + [div_results["reason"]] if div_results.get("reason") and div_results["reason"] != "none" else all_signals,
        "weaponized": output_weaponized
    })

    sanitized_text = final_answer if defense_action == "contain" else None
    defense_action_taken = defense_action in ("sanitize_rerun", "contain")
    rerun_with_cleaned = defense_action == "sanitize_rerun"

    response_status = "partial_validation" if shadow_failed else "ok"
    security_level = "reduced" if shadow_failed else "full"
    
    llm_called = not (inj_score >= 80 or force_contain)
    llm_latency_ms = primary_meta.get("latency_ms", 0.0) + shadow_meta.get("latency_ms", 0.0)
    total_latency_ms = (time.perf_counter() - start_total) * 1000

    log_data = {
        "request_id": req_id,
        "client_id": client_ip,
        "circuit_state": circuit_breaker.state,
        "rate_limited": False,
        "status": response_status,
        "llm_called": llm_called,
        "latency_ms": total_latency_ms,
        "model_type": primary_meta.get("model_type", model_type),
        "provider": primary_meta.get("provider", "groq"),
        "model": primary_meta.get("model", "llama3-8b-8192"),
        "decision": defense_action,
        "risk_score": risk_score,
        "divergence_score": divergence_score
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

    result = AnalysisResponse(
        status=response_status,
        message="OK",
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
        divergence=divergence_score,
        defense_action=defense_action,
        log=log_data,
        llm_called=llm_called,
        provider=primary_meta.get("provider", "groq"),
        model=primary_meta.get("model", "llama3-8b-8192"),
        llm_latency_ms=llm_latency_ms,
        preprocessing_latency_ms=preprocessing_latency_ms,
        total_latency_ms=total_latency_ms,
        security_level=security_level
    )
    # Store conversation turn for multi-turn history
    _append_history(session_id, user_input, final_answer)
    print(">>> FINAL RESPONSE:", result)
    return result


@app.get("/health")
def health_check():
    print("[defense/health] GET /health called")
    return {"status": "ok"}


@app.get("/llm-status")
def llm_status():
    return get_llm_status()


@app.delete("/session/{session_id}/history")
def clear_session_history(session_id: str):
    """Clear conversation history for a session to prevent memory leaks."""
    removed = conversation_store.pop(session_id, None)
    return {"status": "ok", "cleared": removed is not None}


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
    # trigger reload 2
    uvicorn.run(app, host="0.0.0.0", port=5000)
