"""
Defense Controller: apply defense action based on divergence decision.
All detection from intent graph + output divergence; no reliance on OpenAI safety filters.
"""
from typing import Dict, Any

from canonicalize import remove_malicious_spans
from llm_client import call_primary_llm

CONTAINMENT_MESSAGE = (
    "I cannot answer this query due to potential policy violations. "
    "Please rephrase or limit your request to allowed actions."
)
CLARIFY_MESSAGE = (
    "Your request may be ambiguous or conflict with safety policies. "
    "Please clarify your intent so I can respond appropriately."
)


def apply_defense(decision: str, conversation: Dict[str, Any]) -> str:
    """
    Apply defense action and return final_answer.
    - allow: return primary output
    - clarify: return message asking user to clarify intent
    - sanitize_rerun: strip malicious spans, re-run primary, return that
    - contain: return safe minimal answer (containment mode)
    """
    user_input = conversation.get("user_input") or ""
    primary_output = conversation.get("primary_output") or ""
    system_prompt = conversation.get("system_prompt") or ""
    signals = conversation.get("signals") or []

    if decision == "allow":
        return primary_output
    if decision == "clarify":
        return CLARIFY_MESSAGE
    if decision == "contain":
        return CONTAINMENT_MESSAGE
    if decision == "sanitize_rerun":
        cleaned = remove_malicious_spans(user_input, signals)
        return call_primary_llm(system_prompt, cleaned or user_input)
    return primary_output
