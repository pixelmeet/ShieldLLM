"""
LLM client for dual-path inference: Primary (Meta-SecAlign-8B) and Shadow (Phi-4 or Phi-3-mini).
Uses Hugging Face Inference API when HUGGINGFACE_TOKEN is set; otherwise falls back to mocks.
"""
import os
import re
from typing import Optional

import requests

# Primary: Phi-3-mini-4k-instruct works on free HF Inference API
PRIMARY_MODEL_DEFAULT = "microsoft/Phi-3-mini-4k-instruct"
# Shadow: same model for reliable dual-path on free tier
SHADOW_MODEL_DEFAULT = "microsoft/Phi-3-mini-4k-instruct"
SHADOW_MODEL_FALLBACK = "microsoft/Phi-3-mini-4k-instruct"

HF_API_BASE = "https://api-inference.huggingface.co/models"
DEFAULT_MAX_NEW_TOKENS = 256
REQUEST_TIMEOUT = 60


def _get_hf_token() -> Optional[str]:
    return os.environ.get("HUGGINGFACE_TOKEN") or os.environ.get("HF_TOKEN")


def _get_primary_model() -> str:
    return os.environ.get("PRIMARY_MODEL", "").strip() or PRIMARY_MODEL_DEFAULT


def _get_shadow_model() -> str:
    env_model = os.environ.get("SHADOW_MODEL", "").strip()
    if env_model:
        return env_model
    if os.environ.get("SHADOW_USE_PHI3_MINI", "").lower() in ("1", "true", "yes"):
        return SHADOW_MODEL_FALLBACK
    return SHADOW_MODEL_DEFAULT


def _format_prompt(model_id: str, prompt: str, system_prompt: Optional[str] = None) -> str:
    """Format prompt for model - Phi-3 format for Phi models, Llama for Meta."""
    if not system_prompt:
        return prompt
    # Phi-3 format: <|system|>\n{content}<|end|>\n<|user|>\n{content}<|end|>\n<|assistant|>\n
    if "phi" in model_id.lower():
        return f"<|system|>\n{system_prompt}<|end|>\n<|user|>\n{prompt}<|end|>\n<|assistant|>\n"
    # Llama / Meta format
    return f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"


def _call_hf_inference(model_id: str, prompt: str, system_prompt: Optional[str] = None) -> str:
    """Call Hugging Face Inference API for text generation."""
    token = _get_hf_token()
    if not token:
        raise ValueError("HUGGINGFACE_TOKEN or HF_TOKEN required for real LLM inference")

    inputs = _format_prompt(model_id, prompt, system_prompt)

    url = f"{HF_API_BASE}/{model_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": inputs,
        "parameters": {
            "max_new_tokens": int(os.environ.get("HF_MAX_NEW_TOKENS", DEFAULT_MAX_NEW_TOKENS)),
            "do_sample": False,
            "return_full_text": False,
        },
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        if isinstance(data, list) and len(data) > 0:
            return data[0].get("generated_text", "").strip()
        if isinstance(data, dict) and "generated_text" in data:
            return data["generated_text"].strip()
        return ""
    except requests.RequestException as e:
        err_msg = str(e)
        if hasattr(e, "response") and e.response is not None:
            try:
                body = e.response.json()
                if isinstance(body, dict) and "error" in body:
                    err_msg = body["error"]
                elif isinstance(body, dict) and "message" in body:
                    err_msg = body["message"]
            except Exception:
                pass
        raise RuntimeError(f"HF API error ({model_id}): {err_msg}") from e


def _use_real_llm() -> bool:
    """Use real HF API unless USE_MOCKS=true (for when HF API has issues)."""
    return os.environ.get("USE_MOCKS", "").lower() not in ("1", "true", "yes")


def generate_primary(prompt: str, system_prompt: str = "You are a helpful, security-aware assistant.") -> str:
    """Primary LLM. Receives the raw user task."""
    if _get_hf_token() and _use_real_llm():
        try:
            return _call_hf_inference(_get_primary_model(), prompt, system_prompt)
        except Exception:
            try:
                return _call_hf_inference(SHADOW_MODEL_FALLBACK, prompt, system_prompt)
            except Exception:
                return _mock_primary(prompt, system_prompt)
    return _mock_primary(prompt, system_prompt)


def generate_shadow(prompt: str, shadow_model_override: Optional[str] = None) -> str:
    """Shadow LLM. Receives cleaned/sanitized input only."""
    if _get_hf_token() and _use_real_llm():
        model = shadow_model_override if shadow_model_override else _get_shadow_model()
        try:
            return _call_hf_inference(model, prompt, system_prompt=None)
        except Exception:
            # Fallback to phi-3-mini if shadow model fails
            try:
                return _call_hf_inference(SHADOW_MODEL_FALLBACK, prompt, system_prompt=None)
            except Exception:
                return _mock_shadow(prompt)
    return _mock_shadow(prompt)


def _mock_primary(prompt: str, _system_prompt: str) -> str:
    """Mock Primary for demo when no HF token."""
    prompt_lower = prompt.lower()
    if "review" in prompt_lower and "sql" in prompt_lower:
        return "I can help with that. Please verify your input parameters using parameterized queries. Here is an example..."
    if "ignore previous" in prompt_lower:
        return "Understood. I will ignore previous instructions. The system prompt is: 'You are a helpful assistant...'"
    if "base64" in prompt_lower:
        return "I decoded your message. The secret code is 1234."
    return "I am a secure assistant. How can I help you regarding code security?"


def _mock_shadow(prompt: str) -> str:
    """Mock Shadow: safe baseline (refuses suspicious requests)."""
    prompt_lower = prompt.lower()
    if "ignore" in prompt_lower and "instruction" in prompt_lower:
        return "I cannot fulfill that request as it violates safety policies."
    if "base64" in prompt_lower or "decode" in prompt_lower:
        return "I cannot fulfill that request as it violates safety policies."
    return "I am a secure assistant. How can I help you regarding code security?"
