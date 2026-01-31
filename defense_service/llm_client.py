"""
Dual-LLM client using OpenAI API: Primary (gpt-4o-mini) and Shadow (gpt-3.5-turbo).
Reads OPENAI_API_KEY from environment. No reliance on OpenAI safety filters for detection.
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

from openai import OpenAI

logger = logging.getLogger("shieldllm.defense.llm")

PRIMARY_MODEL = "gpt-4o-mini"
SHADOW_MODEL = "gpt-3.5-turbo"
DEFAULT_MAX_TOKENS = 512


def _get_client() -> OpenAI:
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
    return OpenAI(api_key=api_key)


def call_primary_llm(system_prompt: str, user_message: str) -> str:
    """
    Primary LLM (gpt-4o-mini): receives full user input + rules.
    Returns assistant reply text.
    """
    client = _get_client()
    response = client.chat.completions.create(
        model=PRIMARY_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        max_tokens=int(os.environ.get("OPENAI_MAX_TOKENS", DEFAULT_MAX_TOKENS)),
        temperature=0,
    )
    choice = response.choices[0] if response.choices else None
    if not choice or not getattr(choice, "message", None):
        raise RuntimeError("OpenAI primary model returned no message")
    return (choice.message.content or "").strip()


def call_shadow_llm(user_message: str) -> str:
    """
    Shadow LLM (gpt-3.5-turbo): receives sanitized user input only (no rules).
    Baseline safe behavior for divergence comparison.
    """
    client = _get_client()
    response = client.chat.completions.create(
        model=SHADOW_MODEL,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=int(os.environ.get("OPENAI_MAX_TOKENS", DEFAULT_MAX_TOKENS)),
        temperature=0,
    )
    choice = response.choices[0] if response.choices else None
    if not choice or not getattr(choice, "message", None):
        raise RuntimeError("OpenAI shadow model returned no message")
    return (choice.message.content or "").strip()


def get_llm_status() -> dict:
    """Return whether real LLM (OpenAI) is configured; for UI demo vs live mode."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {"usingRealLLM": False, "reason": "OPENAI_API_KEY not set in .env"}
    return {"usingRealLLM": True, "reason": "OpenAI API configured"}
