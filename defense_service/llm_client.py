"""
Dual-LLM client: Primary via Hugging Face (when PRIMARY_MODEL is org/name) or OpenAI; Shadow via OpenAI.
Uses huggingface_hub.login(new_session=False) and HF InferenceClient for primary when PRIMARY_MODEL is a HF model id.
"""
import logging
import os
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env")
    load_dotenv(_root / ".env.local")
except Exception:
    pass

from openai import AsyncOpenAI

logger = logging.getLogger("shieldllm.defense.llm")

# Primary: from env (e.g. facebook/Meta-SecAlign-8B for HF, or gpt-4o-mini for OpenAI)
PRIMARY_MODEL = os.environ.get("PRIMARY_MODEL", "gpt-4o-mini").strip()
SHADOW_MODEL = os.environ.get("SHADOW_MODEL", "gpt-3.5-turbo").strip()
# When set, primary uses vLLM at this URL (overrides HF/OpenAI)
PRIMARY_BASE_URL = os.environ.get("PRIMARY_BASE_URL", "").strip()
# When set, shadow uses this URL (e.g. Phi-4 shadow server or vLLM at http://localhost:8001/v1)
SHADOW_BASE_URL = os.environ.get("SHADOW_BASE_URL", "").strip()
DEFAULT_MAX_TOKENS = 512

# Use vLLM for primary when PRIMARY_BASE_URL is set (takes precedence)
USE_PRIMARY_BASE_URL = bool(PRIMARY_BASE_URL)
# Use Hugging Face for primary when PRIMARY_MODEL looks like "org/model-name" (if not using base_url)
USE_HF_PRIMARY = "/" in PRIMARY_MODEL and not USE_PRIMARY_BASE_URL
# Use local shadow (Phi-4 server / vLLM) when SHADOW_BASE_URL is set
USE_SHADOW_BASE_URL = bool(SHADOW_BASE_URL)

# One-time HF login (uses HF_TOKEN from env or existing CLI login)
if USE_HF_PRIMARY:
    try:
        from huggingface_hub import login
        token = os.environ.get("HF_TOKEN", "").strip()
        login(token=token if token else None, new_session=False)
    except Exception as e:
        logger.warning("Hugging Face login skipped or failed: %s", e)

_hf_client = None
_primary_client: Optional[AsyncOpenAI] = None
_shadow_client: Optional[AsyncOpenAI] = None

# vLLM / Phi-4 shadow server use api_key="EMPTY" when no auth
EMPTY_KEY = "EMPTY"


def _get_primary_client() -> AsyncOpenAI:
    """Primary: vLLM at PRIMARY_BASE_URL when set."""
    global _primary_client
    if _primary_client is None:
        _primary_client = AsyncOpenAI(base_url=PRIMARY_BASE_URL, api_key=EMPTY_KEY)
    return _primary_client


def _get_shadow_client() -> AsyncOpenAI:
    """Shadow: local Phi-4 server or vLLM when SHADOW_BASE_URL is set; else OpenAI API."""
    global _shadow_client
    if _shadow_client is None:
        if USE_SHADOW_BASE_URL:
            _shadow_client = AsyncOpenAI(base_url=SHADOW_BASE_URL, api_key=EMPTY_KEY)
        else:
            _shadow_client = _get_openai_client()
    return _shadow_client


def _get_hf_client():
    """Lazy InferenceClient for Hugging Face primary model."""
    global _hf_client
    if _hf_client is None:
        from huggingface_hub import AsyncInferenceClient
        token = os.environ.get("HF_TOKEN", "").strip()
        _hf_client = AsyncInferenceClient(token=token if token else None)
    return _hf_client


def _get_openai_client() -> AsyncOpenAI:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY is required. Add it to .env or .env.local. "
            "Get a key at https://platform.openai.com/account/api-keys"
        )
    if api_key in ("sk-...", "sk-proj-xxxx") or "xxxx" in api_key.lower() or len(api_key) < 30:
        raise ValueError(
            "OPENAI_API_KEY looks like a placeholder. Replace with a real key from "
            "https://platform.openai.com/account/api-keys and add it to .env or .env.local"
        )
    return AsyncOpenAI(api_key=api_key)


async def call_primary_llm(system_prompt: str, user_message: str) -> str:
    """
    Primary LLM: vLLM (PRIMARY_BASE_URL) or Hugging Face (org/model) or OpenAI.
    Receives full user input + rules. Returns assistant reply text.
    """
    max_tokens = int(os.environ.get("OPENAI_MAX_TOKENS", DEFAULT_MAX_TOKENS))
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    if USE_PRIMARY_BASE_URL:
        client = _get_primary_client()
        response = await client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0,
        )
        choice = response.choices[0] if response.choices else None
        if not choice or not getattr(choice, "message", None):
            raise RuntimeError("Primary model returned no message")
        return (choice.message.content or "").strip()
        
    elif USE_HF_PRIMARY:
        client = _get_hf_client()
        # HF AsyncInferenceClient chat_completion
        response = await client.chat_completion(
            model=PRIMARY_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.1, # HF sometimes needs non-zero
            seed=42
        )
        choice = response.choices[0]
        return (choice.message.content or "").strip()
    else:
        client = _get_openai_client()
        response = await client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0,
        )
        choice = response.choices[0] if response.choices else None
        if not choice or not getattr(choice, "message", None):
            raise RuntimeError("Primary model returned no message")
        return (choice.message.content or "").strip()


async def call_shadow_llm(user_message: str) -> str:
    """
    Shadow LLM: receives sanitized user input only (no rules).
    When SHADOW_BASE_URL is set, uses that (Phi-4 shadow server or vLLM); else OpenAI API.
    """
    client = _get_shadow_client()
    response = await client.chat.completions.create(
        model=SHADOW_MODEL,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=int(os.environ.get("OPENAI_MAX_TOKENS", DEFAULT_MAX_TOKENS)),
        temperature=0,
    )
    choice = response.choices[0] if response.choices else None
    if not choice or not getattr(choice, "message", None):
        raise RuntimeError("Shadow model returned no message")
    return (choice.message.content or "").strip()


def get_llm_status() -> dict:
    """Return whether real LLM is configured; for UI demo vs live mode."""
    need_openai_key = (not USE_PRIMARY_BASE_URL and not USE_HF_PRIMARY) or not USE_SHADOW_BASE_URL
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if need_openai_key and not api_key:
        return {"usingRealLLM": False, "reason": "OPENAI_API_KEY not set (required for primary or shadow)"}
    parts = []
    if USE_PRIMARY_BASE_URL:
        parts.append(f"Primary: {PRIMARY_BASE_URL} ({PRIMARY_MODEL})")
    elif USE_HF_PRIMARY:
        parts.append(f"Hugging Face primary: {PRIMARY_MODEL}")
    else:
        parts.append("OpenAI primary")
    if USE_SHADOW_BASE_URL:
        parts.append(f"Shadow: {SHADOW_BASE_URL} ({SHADOW_MODEL})")
    else:
        parts.append(f"Shadow: OpenAI ({SHADOW_MODEL})")
    return {"usingRealLLM": True, "reason": "; ".join(parts)}
