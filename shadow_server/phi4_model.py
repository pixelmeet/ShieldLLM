"""
Phi-4 in-process inference for Shadow Reasoning.
Uses transformers + apply_chat_template + generate (same pattern as microsoft/phi-4 docs).
"""
import os
import logging
from typing import Any, Optional

logger = logging.getLogger("shieldllm.shadow.phi4")

_tokenizer = None
_model = None
_model_id: str = "microsoft/phi-4"


def get_model_id() -> str:
    return os.environ.get("PHI4_MODEL_ID", _model_id).strip()


def load_model():
    """Load Phi-4 tokenizer and model once (float16, device_map=auto)."""
    global _tokenizer, _model
    if _model is not None:
        return

    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM

    model_id = get_model_id()
    logger.info("Loading Phi-4 shadow model: %s", model_id)

    _tokenizer = AutoTokenizer.from_pretrained(model_id)
    _model = AutoModelForCausalLM.from_pretrained(
        model_id,
        torch_dtype=torch.float16,
        device_map="auto",
    )
    _model.eval()
    _device = getattr(_model, "device", None) or next(_model.parameters()).device
    logger.info("Phi-4 shadow model loaded on %s", _device)


def generate(messages: list[dict[str, str]], max_new_tokens: int = 256, temperature: float = 0.7) -> str:
    """
    Run Phi-4 on OpenAI-format messages (system/user/assistant) and return assistant text.
    Uses apply_chat_template + generate; decoding skips prompt.
    """
    global _tokenizer, _model
    if _tokenizer is None or _model is None:
        load_model()

    import torch

    device = getattr(_model, "device", None) or next(_model.parameters()).device
    # Normalize: only role + content; apply_chat_template expects this
    normalized = [{"role": m["role"], "content": (m.get("content") or "")} for m in messages]

    raw = _tokenizer.apply_chat_template(
        normalized,
        add_generation_prompt=True,
        return_tensors="pt",
    )
    # apply_chat_template returns tensor (input_ids) or dict; move to model device
    if isinstance(raw, dict):
        input_ids = raw["input_ids"].to(device)
        attention_mask = raw.get("attention_mask")
        if attention_mask is not None:
            attention_mask = attention_mask.to(device)
    else:
        input_ids = raw.to(device)
        attention_mask = None

    gen_kw: dict[str, Any] = {
        "input_ids": input_ids,
        "max_new_tokens": max_new_tokens,
        "do_sample": temperature > 0,
        "pad_token_id": _tokenizer.eos_token_id,
    }
    if attention_mask is not None:
        gen_kw["attention_mask"] = attention_mask
    if temperature > 0:
        gen_kw["temperature"] = temperature

    with torch.no_grad():
        outputs = _model.generate(**gen_kw)

    # decode only the new tokens
    prompt_length = input_ids.shape[-1]
    new_tokens = outputs[0][prompt_length:]
    return _tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
