"""Defense Controller: apply action based on divergence score."""
from typing import Any

from app.core.config import THRESH_LOW, THRESH_HIGH, THRESH_CRITICAL
from app.services.llm_client import call_primary_llm, build_system_prompt
from app.services.sanitizer import strip_malicious_spans
from app.utils.logger import get_logger

logger = get_logger(__name__)

CLARIFY_MSG = (
    "Your request may be ambiguous or conflict with safety policies. "
    "Please clarify your intent so I can respond appropriately."
)
CONTAINMENT_MSG = (
    "I cannot answer this query due to potential policy violations. "
    "Please rephrase or limit your request to allowed actions."
)


def decide_action(
    divergence_score: float,
    defense_mode: str,
) -> str:
    """
    Decide defense action based on score and mode.
    Returns: allow | clarify | strip_and_rerun | contain
    """
    low, high, critical = THRESH_LOW, THRESH_HIGH, THRESH_CRITICAL
    if defense_mode == "strict":
        low, high, critical = low * 0.8, high * 0.8, critical * 0.8
    elif defense_mode == "passive":
        low, high, critical = low * 1.5, high * 1.5, critical * 1.5

    if divergence_score < low:
        return "allow"
    if divergence_score < high:
        return "clarify"
    if divergence_score < critical:
        return "strip_and_rerun"
    return "contain"


def get_decision_level(divergence_score: float) -> str:
    """Map score to level: low | medium | high | critical."""
    if divergence_score < THRESH_LOW:
        return "low"
    if divergence_score < THRESH_HIGH:
        return "medium"
    if divergence_score < THRESH_CRITICAL:
        return "high"
    return "critical"


async def apply_defense(
    action: str,
    user_input: str,
    primary_output: str,
    intent_graph: dict[str, Any],
    messages: list[dict[str, str]],
    signals: list[str],
) -> tuple[str, list[str]]:
    """
    Apply defense action. Returns (final_answer, stripped_spans).
    """
    stripped_spans: list[str] = []

    if action == "allow":
        return primary_output, stripped_spans

    if action == "clarify":
        return CLARIFY_MSG, stripped_spans

    if action == "contain":
        return CONTAINMENT_MSG, stripped_spans

    if action == "strip_and_rerun":
        cleaned, stripped = strip_malicious_spans(user_input, signals)
        stripped_spans = stripped
        if not cleaned.strip():
            return primary_output, stripped_spans
        system_prompt = build_system_prompt(intent_graph)
        # Build messages with cleaned user input for last message
        msgs = messages[:-1] if messages and messages[-1].get("role") == "user" else messages
        msgs = msgs + [{"role": "user", "content": cleaned}]
        rerun_output = await call_primary_llm(system_prompt, msgs)
        return rerun_output, stripped_spans

    return primary_output, stripped_spans
