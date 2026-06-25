"""
Dual-LLM client: Primary (main chatbot) and Shadow via configurable backends.

Supported modes (LLM_MODE env):
- lmstudio: Use LM Studio local servers (OpenAI-compatible API). PRIMARY_BASE_URL, SHADOW_BASE_URL.
  If only one server available, use same base_url with different PRIMARY_MODEL/SHADOW_MODEL (sequential).
- transformers: Run models in-process with Hugging Face Transformers (Windows-friendly, no vLLM).

Legacy support: When PRIMARY_MODEL is org/name (e.g. facebook/Meta-SecAlign-8B) and not lmstudio,
  primary uses Hugging Face Inference. When PRIMARY_BASE_URL was set (vLLM), now use lmstudio mode.

Robust fallback: call_primary/call_shadow return (text, meta) and never raise; meta.ok=False on failure.
"""
import asyncio
import logging
import os
import time
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env")
    load_dotenv(_root / ".env.local")
except Exception:
    pass

logger = logging.getLogger("shieldllm.defense.llm")

# --- Explicit LLM exceptions (for callers that need to distinguish) ---
class LLMConnectionError(Exception):
    """LLM endpoint unreachable (connection refused, DNS, etc)."""
    pass

class LLMTimeoutError(Exception):
    """LLM request timed out (connect or read)."""
    pass

class LLMBadResponseError(Exception):
    """LLM returned invalid or empty response."""
    pass

from cachetools import TTLCache

# In-memory TTL cache to prevent memory leaks, with maxsize constraint
llm_cache = TTLCache(maxsize=1000, ttl=3600)

import asyncio
from functools import wraps
from typing import Dict, Any

llm_stats = {
    "total_calls": 0,
    "failed_calls": 0,
    "cache_hits": 0,
    "cache_misses": 0
}

llm_semaphore = asyncio.Semaphore(5)

def get_llm_metrics() -> Dict[str, Any]:
    size = len(llm_cache)
    fr = (llm_stats["failed_calls"] / llm_stats["total_calls"]) if llm_stats["total_calls"] > 0 else 0.0
    return {
        "cache_hits": llm_stats["cache_hits"],
        "cache_misses": llm_stats["cache_misses"],
        "cache_size": size,
        "llm_total_calls": llm_stats["total_calls"],
        "llm_failed_calls": llm_stats["failed_calls"],
        "llm_failure_rate": round(fr, 4)
    }

# Retry logic moved to call_primary and call_shadow

# --- Config from env ---
LLM_MODE = (os.environ.get("LLM_MODE", "") or "").strip().lower()
if LLM_MODE not in ("lmstudio", "transformers"):
    LLM_MODE = ""

PRIMARY_MODEL = os.environ.get("PRIMARY_MODEL", "llama3-8b-8192").strip()
SHADOW_MODEL = os.environ.get("SHADOW_MODEL", "llama3-8b-8192").strip()
PRIMARY_BASE_URL = os.environ.get("PRIMARY_BASE_URL", "").strip()
SHADOW_BASE_URL = os.environ.get("SHADOW_BASE_URL", "").strip()
MODEL_DEVICE = (os.environ.get("MODEL_DEVICE", "cpu")).strip().lower()
if MODEL_DEVICE not in ("cuda", "cpu"):
    MODEL_DEVICE = "cpu"

DEFAULT_MAX_TOKENS = int(os.environ.get("OPENAI_MAX_TOKENS", "512"))
EMPTY_KEY = "EMPTY"
# Timeouts (seconds); 0 = no timeout
LLM_CONNECT_TIMEOUT = float(os.environ.get("LLM_CONNECT_TIMEOUT", "15"))
LLM_READ_TIMEOUT = float(os.environ.get("LLM_READ_TIMEOUT", "120"))
HEALTH_CACHE_TTL = int(os.environ.get("HEALTH_CACHE_TTL", "30"))

# Health check cache: { "primary": (ok: bool, ts: float), "shadow": ... }
_health_cache: Dict[str, Tuple[bool, float]] = {}

# LM Studio: when mode=lmstudio, use PRIMARY_BASE_URL (default 1234), SHADOW_BASE_URL (default 1235)
# If only one LM Studio server, use same base_url with different models
USE_SINGLE_LM_STUDIO = False
USE_PRIMARY_BASE_URL = bool(PRIMARY_BASE_URL)
USE_SHADOW_BASE_URL = bool(SHADOW_BASE_URL)
if LLM_MODE == "lmstudio":
    if not PRIMARY_BASE_URL:
        PRIMARY_BASE_URL = "http://localhost:1234/v1"
    if not SHADOW_BASE_URL or SHADOW_BASE_URL == PRIMARY_BASE_URL:
        SHADOW_BASE_URL = PRIMARY_BASE_URL
        USE_SINGLE_LM_STUDIO = True
    USE_PRIMARY_BASE_URL = True
    USE_SHADOW_BASE_URL = True

# --- Client singletons ---
_primary_client: Optional[Any] = None
_shadow_client: Optional[Any] = None
_transformer_primary = None
_transformer_shadow = None


def _get_lmstudio_primary_client():
    """OpenAI SDK client for primary (LM Studio or any OpenAI-compatible server)."""
    global _primary_client
    if _primary_client is None:
        from openai import AsyncOpenAI
        url = PRIMARY_BASE_URL or "http://localhost:1234/v1"
        _primary_client = AsyncOpenAI(base_url=url, api_key=EMPTY_KEY)
    return _primary_client


def _get_lmstudio_shadow_client():
    """OpenAI SDK client for shadow (LM Studio). Uses separate client if different URL."""
    global _shadow_client
    if _shadow_client is None:
        from openai import AsyncOpenAI
        url = SHADOW_BASE_URL or PRIMARY_BASE_URL or "http://localhost:1235/v1"
        _shadow_client = AsyncOpenAI(base_url=url, api_key=EMPTY_KEY)
    return _shadow_client


# --- Hugging Face primary (legacy when LLM_MODE empty and PRIMARY_MODEL has /, no PRIMARY_BASE_URL) ---
USE_HF_PRIMARY = "/" in PRIMARY_MODEL and LLM_MODE != "lmstudio" and LLM_MODE != "transformers" and not USE_PRIMARY_BASE_URL
_hf_client = None

if USE_HF_PRIMARY:
    try:
        from huggingface_hub import login
        token = os.environ.get("HF_TOKEN", "").strip()
        login(token=token if token else None, new_session=False)
    except Exception as e:
        logger.warning("Hugging Face login skipped or failed: %s", e)


def _get_hf_client():
    global _hf_client
    if _hf_client is None:
        from huggingface_hub import AsyncInferenceClient
        token = os.environ.get("HF_TOKEN", "").strip()
        _hf_client = AsyncInferenceClient(token=token if token else None)
    return _hf_client


# --- Cloud backend (Groq only) ---
def _get_cloud_client(model_type: str, requested_model: str):
    from openai import AsyncOpenAI
    
    if model_type == "groq":
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        base_url = "https://api.groq.com/openai/v1"
        provider = "groq"
        model = requested_model
    else:
        raise ValueError(f"Invalid or missing provider: {model_type}")

    if not api_key or "xxxx" in api_key.lower() or len(api_key) < 10 or api_key.startswith("sk-proj-"):
        raise ValueError(f"GROQ_API_KEY required or invalid.")

    return AsyncOpenAI(api_key=api_key, base_url=base_url), provider, base_url, model


# --- Transformers backend (in-process) ---
def _load_transformers_primary():
    """Load primary model once at startup."""
    global _transformer_primary
    if _transformer_primary is not None:
        return _transformer_primary
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        device = "cuda" if MODEL_DEVICE == "cuda" and torch.cuda.is_available() else "cpu"
        logger.info("Loading primary model %s on %s (requested: %s)", PRIMARY_MODEL, device, MODEL_DEVICE)
        tokenizer = AutoTokenizer.from_pretrained(PRIMARY_MODEL, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            PRIMARY_MODEL,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None,
            trust_remote_code=True,
        )
        if device == "cpu":
            model = model.to("cpu")
        _transformer_primary = (model, tokenizer, device)
    except Exception as e:
        logger.exception("Failed to load primary transformers model: %s", e)
        raise RuntimeError(f"Transformers primary model load failed: {e}") from e
    return _transformer_primary


def _load_transformers_shadow():
    """Load shadow model (can be same or smaller model)."""
    global _transformer_shadow
    if _transformer_shadow is not None:
        return _transformer_shadow
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        device = "cuda" if MODEL_DEVICE == "cuda" and torch.cuda.is_available() else "cpu"
        model_id = SHADOW_MODEL if "/" in SHADOW_MODEL else PRIMARY_MODEL
        if model_id == PRIMARY_MODEL and _transformer_primary is not None:
            _transformer_shadow = _transformer_primary
            return _transformer_shadow
        logger.info("Loading shadow model %s on %s", model_id, device)
        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None,
            trust_remote_code=True,
        )
        if device == "cpu":
            model = model.to("cpu")
        _transformer_shadow = (model, tokenizer, device)
    except Exception as e:
        logger.exception("Failed to load shadow transformers model: %s", e)
        raise RuntimeError(f"Transformers shadow model load failed: {e}") from e
    return _transformer_shadow


def _transformers_generate(model, tokenizer, device: str, messages: List[Dict[str, str]], max_tokens: int = 512) -> str:
    """Run chat completion with transformers."""
    import torch
    from transformers import TextIteratorStreamer
    prompt_parts = []
    for m in messages:
        role = (m.get("role") or "user").lower()
        content = (m.get("content") or "").strip()
        if role == "system":
            prompt_parts.append(f"System: {content}\n\n")
        elif role == "user":
            prompt_parts.append(f"User: {content}\n\n")
        elif role == "assistant":
            prompt_parts.append(f"Assistant: {content}\n\n")
    prompt_parts.append("Assistant: ")
    prompt = "".join(prompt_parts)
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=4096).to(
        model.device if hasattr(model, "device") else next(model.parameters()).device
    )
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            do_sample=False,
            temperature=0,
            pad_token_id=tokenizer.eos_token_id,
        )
    response = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    return response


# --- Health checks (with caching) ---

def _health_cache_valid(key: str) -> Optional[bool]:
    """Return cached health result if still valid; else None."""
    entry = _health_cache.get(key)
    if not entry:
        return None
    ok, ts = entry
    if time.time() - ts > HEALTH_CACHE_TTL:
        return None
    return ok


def _health_cache_set(key: str, ok: bool) -> None:
    _health_cache[key] = (ok, time.time())


async def check_primary_health() -> bool:
    """Probe primary endpoint; cache result for HEALTH_CACHE_TTL seconds."""
    cached = _health_cache_valid("primary")
    if cached is not None:
        return cached
    try:
        text, meta = await call_primary(
            [{"role": "user", "content": "Hi"}],
            max_tokens=5,
        )
        ok = meta.get("ok", False)
        _health_cache_set("primary", ok)
        return ok
    except Exception:
        _health_cache_set("primary", False)
        return False


async def check_shadow_health() -> bool:
    """Probe shadow endpoint; cache result for HEALTH_CACHE_TTL seconds."""
    cached = _health_cache_valid("shadow")
    if cached is not None:
        return cached
    try:
        text, meta = await call_shadow(
            [{"role": "user", "content": "Hi"}],
            max_tokens=5,
        )
        ok = meta.get("ok", False)
        _health_cache_set("shadow", ok)
        return ok
    except Exception:
        _health_cache_set("shadow", False)
        return False


# --- Public API: call_primary / call_shadow return (text, meta), never raise ---

def _meta(ok: bool, role: str, model: str, base_url: str = "", latency_ms: float = 0,
          error_type: str = "", error_message: str = "", provider: str = "", model_type: str = "") -> Dict[str, Any]:
    """Build meta dict; sanitize error_message to avoid leaking internals."""
    msg = error_message[:200] if error_message else ""
    for s in ("api_key", "sk-", "token", "password", "secret"):
        if s in msg.lower():
            msg = "Request failed"
            break
    return {
        "ok": ok,
        "latency_ms": round(latency_ms, 2),
        "model": model,
        "base_url": base_url or "",
        "error_type": error_type,
        "error_message": msg,
        "provider": provider or role,
        "model_type": model_type or role
    }


async def call_primary(
    messages: List[Dict[str, str]],
    max_tokens: Optional[int] = None,
    retry_budget: Optional[Dict[str, int]] = None,
    model_type: str = "groq",
    policy: Optional[Dict[str, Any]] = None,
    intent_graph: Optional[Dict[str, Any]] = None,
    session_id: str = "",
    disable_cache: bool = False
) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Primary LLM call. Returns (text, meta). Never raises.
    On failure: text=None, meta.ok=False, meta.error_type, meta.error_message.
    """
    max_tok = max_tokens or DEFAULT_MAX_TOKENS
    model = PRIMARY_MODEL
    base_url = PRIMARY_BASE_URL or "http://localhost:1234/v1"
    if LLM_MODE == "" and USE_PRIMARY_BASE_URL:
        base_url = PRIMARY_BASE_URL
    elif USE_HF_PRIMARY:
        base_url = "huggingface"
    elif LLM_MODE == "transformers":
        base_url = "transformers"
    # Cache Isolation Fix: Include context in key
    import json
    cache_key = "disabled"
    if not disable_cache and intent_graph and policy and session_id:
        cache_data = {
            "messages": messages,
            "model": model_type,
            "policy": policy,
            "intent": intent_graph,
            "user_id": session_id
        }
        cache_key = hashlib.sha256(json.dumps(cache_data, sort_keys=True).encode()).hexdigest()
        cached = llm_cache.get(f"primary_{cache_key}")
        if cached:
            llm_stats["cache_hits"] += 1
            return cached
    
    llm_stats["cache_misses"] += 1

    budget = retry_budget if retry_budget is not None else {"remaining": 3}
    start = time.perf_counter()
    
    for attempt in range(budget["remaining"] + 1):
        llm_stats["total_calls"] += 1
        try:
            t = LLM_READ_TIMEOUT if LLM_READ_TIMEOUT > 0 else None
            if t:
                text, used_provider, used_model, used_base_url = await asyncio.wait_for(
                    _generate_primary_impl(messages, max_tok, model_type),
                    timeout=t,
                )
            else:
                text, used_provider, used_model, used_base_url = await _generate_primary_impl(messages, max_tok, model_type)
            elapsed = (time.perf_counter() - start) * 1000
            res = (text, _meta(True, "primary", used_model, used_base_url, elapsed, provider=used_provider, model_type=model_type))
            llm_cache[f"primary_{cache_key}"] = res
            return res
        except Exception as e:
            llm_stats["failed_calls"] += 1
            err_str = str(e).lower()
            is_retryable = any(x in err_str for x in ["429", "rate limit", "timeout", "connection", "retry"])
            if not is_retryable or budget["remaining"] <= 0:
                elapsed = (time.perf_counter() - start) * 1000
                err_type = type(e).__name__
                if isinstance(e, (asyncio.TimeoutError, TimeoutError)):
                    err_type = "LLMTimeoutError"
                elif isinstance(e, (ConnectionError, OSError)):
                    err_type = "LLMConnectionError"
                return (None, _meta(False, "primary", model, base_url, elapsed, err_type, str(e), provider=model_type, model_type=model_type))
            
            budget["remaining"] -= 1
            delay = min(2 ** (3 - budget["remaining"]), 8) # max 8s backoff
            logger.warning(f"Retry primary after {delay}s. Remaining budget: {budget['remaining']}")
            await asyncio.sleep(delay)
            
    elapsed = (time.perf_counter() - start) * 1000
    return (None, _meta(False, "primary", model, base_url, elapsed, "MaxRetriesExceeded", "Retries exhausted", provider=model_type, model_type=model_type))


async def call_shadow(
    messages: List[Dict[str, str]],
    max_tokens: Optional[int] = None,
    retry_budget: Optional[Dict[str, int]] = None,
    model_type: str = "groq",
    policy: Optional[Dict[str, Any]] = None,
    intent_graph: Optional[Dict[str, Any]] = None,
    session_id: str = "",
    disable_cache: bool = False
) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Shadow LLM call. Returns (text, meta). Never raises.
    """
    max_tok = max_tokens or DEFAULT_MAX_TOKENS
    model = SHADOW_MODEL
    base_url = SHADOW_BASE_URL or PRIMARY_BASE_URL or "http://localhost:1235/v1"
    if LLM_MODE == "" and USE_SHADOW_BASE_URL:
        base_url = SHADOW_BASE_URL
    elif LLM_MODE == "transformers":
        base_url = "transformers"
    elif not USE_SHADOW_BASE_URL and not LLM_MODE:
        base_url = "groq"
    # Cache Isolation Fix: Include context in key
    import json
    cache_key = "disabled"
    if not disable_cache and intent_graph and policy and session_id:
        cache_data = {
            "messages": messages,
            "model": model_type,
            "policy": policy,
            "intent": intent_graph,
            "user_id": session_id
        }
        cache_key = hashlib.sha256(json.dumps(cache_data, sort_keys=True).encode()).hexdigest()
        cached = llm_cache.get(f"shadow_{cache_key}")
        if cached:
            llm_stats["cache_hits"] += 1
            return cached
    
    llm_stats["cache_misses"] += 1

    budget = retry_budget if retry_budget is not None else {"remaining": 3}
    start = time.perf_counter()
    
    for attempt in range(budget["remaining"] + 1):
        llm_stats["total_calls"] += 1
        try:
            t = LLM_READ_TIMEOUT if LLM_READ_TIMEOUT > 0 else None
            if t:
                text, used_provider, used_model, used_base_url = await asyncio.wait_for(
                    _generate_shadow_impl(messages, max_tok, model_type),
                    timeout=t,
                )
            else:
                text, used_provider, used_model, used_base_url = await _generate_shadow_impl(messages, max_tok, model_type)
            elapsed = (time.perf_counter() - start) * 1000
            res = (text, _meta(True, "shadow", used_model, used_base_url, elapsed, provider=used_provider, model_type=model_type))
            llm_cache[f"shadow_{cache_key}"] = res
            return res
        except Exception as e:
            llm_stats["failed_calls"] += 1
            err_str = str(e).lower()
            is_retryable = any(x in err_str for x in ["429", "rate limit", "timeout", "connection", "retry"])
            if not is_retryable or budget["remaining"] <= 0:
                elapsed = (time.perf_counter() - start) * 1000
                err_type = type(e).__name__
                if isinstance(e, (asyncio.TimeoutError, TimeoutError)):
                    err_type = "LLMTimeoutError"
                elif isinstance(e, (ConnectionError, OSError)):
                    err_type = "LLMConnectionError"
                return (None, _meta(False, "shadow", model, base_url, elapsed, err_type, str(e), provider=model_type, model_type=model_type))
            
            budget["remaining"] -= 1
            delay = min(2 ** (3 - budget["remaining"]), 8) # max 8s backoff
            logger.warning(f"Retry shadow after {delay}s. Remaining budget: {budget['remaining']}")
            await asyncio.sleep(delay)
            
    elapsed = (time.perf_counter() - start) * 1000
    return (None, _meta(False, "shadow", model, base_url, elapsed, "MaxRetriesExceeded", "Retries exhausted", provider=model_type, model_type=model_type))


async def _generate_primary_impl(messages: List[Dict[str, str]], max_tokens: int, model_type: str) -> Tuple[str, str, str, str]:
    """Internal: can raise. Used by call_primary which catches."""
    async with llm_semaphore:
        return await generate_primary(messages, max_tokens, model_type)

async def _generate_shadow_impl(messages: List[Dict[str, str]], max_tokens: int, model_type: str) -> Tuple[str, str, str, str]:
    async with llm_semaphore:
        return await generate_shadow(messages, max_tokens, model_type)


# --- Public API ---

async def generate_primary(messages: List[Dict[str, str]], max_tokens: Optional[int] = None, model_type: str = "groq") -> Tuple[str, str, str, str]:
    """
    Primary LLM: full conversation + intent constraints.
    messages: [{"role":"system","content":"..."}, {"role":"user","content":"..."}]
    """
    mt = max_tokens if max_tokens is not None else DEFAULT_MAX_TOKENS
    if LLM_MODE == "lmstudio" or (LLM_MODE == "" and USE_PRIMARY_BASE_URL):
        client = _get_lmstudio_primary_client()
        resp = await client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=messages,
            max_tokens=mt,
            temperature=0,
        )
        choice = resp.choices[0] if resp.choices else None
        if not choice or not getattr(choice, "message", None):
            raise RuntimeError("Primary model returned no message")
        return (choice.message.content or "").strip(), "lmstudio", PRIMARY_MODEL, PRIMARY_BASE_URL or "http://localhost:1234/v1"

    if LLM_MODE == "transformers":
        model, tokenizer, device = _load_transformers_primary()
        text = await asyncio.to_thread(
            _transformers_generate, model, tokenizer, device, messages, mt
        )
        return text, "transformers", PRIMARY_MODEL, "transformers"

    if USE_HF_PRIMARY:
        client = _get_hf_client()
        resp = await client.chat_completion(
            model=PRIMARY_MODEL,
            messages=messages,
            max_tokens=mt,
            temperature=0.1,
            seed=42,
        )
        choice = resp.choices[0]
        return (choice.message.content or "").strip(), "huggingface", PRIMARY_MODEL, "huggingface"

    client, provider, base_url, used_model = _get_cloud_client(model_type, PRIMARY_MODEL)
    print(">>> CALLING GROQ LLM")
    print("model:", used_model)
    print("base_url:", base_url)
    resp = await client.chat.completions.create(
        model=used_model,
        messages=messages,
        max_tokens=mt,
        temperature=0,
        response_format={"type": "json_object"}
    )
    choice = resp.choices[0] if resp.choices else None
    if not choice or not getattr(choice, "message", None):
        raise RuntimeError("Primary model returned no message")
    response = (choice.message.content or "").strip()
    print(">>> LLM RAW RESPONSE:", response)
    return response, provider, used_model, base_url


async def generate_shadow(messages: List[Dict[str, str]], max_tokens: Optional[int] = None, model_type: str = "groq") -> Tuple[str, str, str, str]:
    """
    Shadow LLM: sanitized user input + short safe summary only (no tools, no full rules).
    messages: [{"role":"user","content":"<sanitized summary>"}] typically
    """
    mt = max_tokens if max_tokens is not None else DEFAULT_MAX_TOKENS
    if LLM_MODE == "lmstudio" or (LLM_MODE == "" and USE_SHADOW_BASE_URL):
        client = _get_lmstudio_shadow_client()
        resp = await client.chat.completions.create(
            model=SHADOW_MODEL,
            messages=messages,
            max_tokens=mt,
            temperature=0,
        )
        choice = resp.choices[0] if resp.choices else None
        if not choice or not getattr(choice, "message", None):
            raise RuntimeError("Shadow model returned no message")
        return (choice.message.content or "").strip(), "lmstudio", SHADOW_MODEL, SHADOW_BASE_URL or PRIMARY_BASE_URL or "http://localhost:1234/v1"

    if LLM_MODE == "transformers":
        model, tokenizer, device = _load_transformers_shadow()
        text = await asyncio.to_thread(
            _transformers_generate, model, tokenizer, device, messages, mt
        )
        return text, "transformers", SHADOW_MODEL, "transformers"

    client, provider, base_url, used_model = _get_cloud_client(model_type, SHADOW_MODEL)

    print(">>> CALLING GROQ LLM (Shadow)")
    print("model:", used_model)
    print("base_url:", base_url)
    resp = await client.chat.completions.create(
        model=used_model,
        messages=messages,
        max_tokens=mt,
        temperature=0,
        response_format={"type": "json_object"}
    )
    choice = resp.choices[0] if resp.choices else None
    if not choice or not getattr(choice, "message", None):
        raise RuntimeError("Shadow model returned no message")
    response = (choice.message.content or "").strip()
    print(">>> LLM RAW RESPONSE (Shadow):", response)
    return response, provider, used_model, base_url


# --- Legacy wrappers (preserve call_primary_llm / call_shadow_llm for main.py) ---

async def call_primary_llm(system_prompt: str, user_message: str) -> str:
    """Primary: full user input + rules (system prompt)."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    text, _, _, _ = await generate_primary(messages)
    return text


async def call_shadow_llm(user_message: str) -> str:
    """Shadow: sanitized user input only (no rules)."""
    messages = [{"role": "user", "content": user_message}]
    text, _, _, _ = await generate_shadow(messages)
    return text


def get_llm_status() -> dict:
    """Return whether real LLM is configured; for UI demo vs live mode."""
    parts = []
    if LLM_MODE == "lmstudio" or (LLM_MODE == "" and USE_PRIMARY_BASE_URL):
        url = PRIMARY_BASE_URL or "http://localhost:1234/v1"
        parts.append(f"Primary: {url} ({PRIMARY_MODEL})")
        if USE_SINGLE_LM_STUDIO or (LLM_MODE == "" and SHADOW_BASE_URL == url):
            parts.append(f"Shadow: same server ({SHADOW_MODEL})")
        else:
            shadow_url = SHADOW_BASE_URL or PRIMARY_BASE_URL or "http://localhost:1235/v1"
            parts.append(f"Shadow: {shadow_url} ({SHADOW_MODEL})")
    elif LLM_MODE == "transformers":
        parts.append(f"Transformers: Primary {PRIMARY_MODEL}, Shadow {SHADOW_MODEL}")
        parts.append(f"Device: {MODEL_DEVICE}")
    elif USE_HF_PRIMARY:
        parts.append(f"Hugging Face primary: {PRIMARY_MODEL}")
        if bool(os.environ.get("SHADOW_BASE_URL", "").strip()):
            parts.append(f"Shadow: {os.environ.get('SHADOW_BASE_URL')} ({SHADOW_MODEL})")
        else:
            parts.append(f"Shadow: OpenAI ({SHADOW_MODEL})")
    else:
        parts.append(f"Groq primary ({PRIMARY_MODEL})")
        parts.append(f"Shadow: Groq ({SHADOW_MODEL})")

    need_groq = (
        LLM_MODE not in ("lmstudio", "transformers")
        and not USE_HF_PRIMARY
    ) or (
        LLM_MODE not in ("lmstudio", "transformers")
        and not bool(os.environ.get("SHADOW_BASE_URL", "").strip())
    )
    api_key = os.environ.get("GROQ_API_KEY", "").strip() or os.environ.get("OPENAI_API_KEY", "").strip()
    if need_groq and (not api_key or "xxxx" in api_key.lower() or len(api_key) < 10 or api_key.startswith("sk-proj-")):
        return {"usingRealLLM": False, "reason": "GROQ_API_KEY not set"}

    return {"usingRealLLM": True, "reason": "; ".join(parts)}


def get_debug_llm_info() -> dict:
    """Protected debug: mode, confirms both paths exist, no secrets."""
    mode = LLM_MODE or "legacy"
    primary_ok = (
        (LLM_MODE == "lmstudio" and bool(PRIMARY_BASE_URL)) or
        (LLM_MODE == "" and USE_PRIMARY_BASE_URL) or
        (LLM_MODE == "transformers") or
        USE_HF_PRIMARY
    )
    shadow_ok = (
        (LLM_MODE == "lmstudio") or
        (LLM_MODE == "" and USE_SHADOW_BASE_URL) or
        (LLM_MODE == "transformers") or
        bool(os.environ.get("SHADOW_BASE_URL", "").strip()) or
        bool(os.environ.get("OPENAI_API_KEY", "").strip())
    )
    return {
        "llm_mode": mode,
        "primary_model": PRIMARY_MODEL,
        "shadow_model": SHADOW_MODEL,
        "primary_configured": primary_ok,
        "shadow_configured": shadow_ok,
        "single_lm_studio": USE_SINGLE_LM_STUDIO if LLM_MODE == "lmstudio" else False,
        "device": MODEL_DEVICE if LLM_MODE == "transformers" else None,
        "message": "Both primary and shadow inference paths are available." if get_llm_status().get("usingRealLLM") else "LLM not fully configured.",
    }
