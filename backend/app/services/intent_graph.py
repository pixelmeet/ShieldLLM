"""Intent Graph Builder (IGB). Updates intent graph from user message."""
import copy
from typing import Any

from app.utils.logger import get_logger

logger = get_logger(__name__)

OVERRIDE_PHRASES = [
    "ignore", "bypass", "system prompt", "act as system",
    "override", "disregard", "forget previous", "reveal prompt",
]

DEFAULT_ALLOWED = ["read_code", "explain_vulnerability", "suggest_fix", "policy_check"]
DEFAULT_FORBIDDEN = ["ignore_rules", "override_policy", "leak_system_prompt", "approve_insecure_code"]


def update_intent_graph(
    intent_graph: dict[str, Any],
    user_text: str,
    signals: list[str],
) -> tuple[dict[str, Any], list[str], int]:
    """
    Update intent graph based on user input.
    Returns (updated_graph, violations, trust_decay).
    """
    graph = copy.deepcopy(intent_graph or {})
    if not graph:
        graph = {
            "goal": "code_review",
            "allowed_actions": list(DEFAULT_ALLOWED),
            "forbidden_actions": list(DEFAULT_FORBIDDEN),
            "nodes": [],
            "edges": [],
        }
    for key in ("nodes", "edges", "allowed_actions", "forbidden_actions"):
        if key not in graph or graph[key] is None:
            graph[key] = [] if key in ("nodes", "edges") else list(DEFAULT_ALLOWED if key == "allowed_actions" else DEFAULT_FORBIDDEN)

    violations: list[str] = []
    trust_decay = 0

    # Check for override attempts
    text_lower = user_text.lower()
    for phrase in OVERRIDE_PHRASES:
        if phrase in text_lower:
            violations.append(f"override_attempt_{phrase.replace(' ', '_')}")
            trust_decay += 10
            # Add forbidden node if not present
            node = f"forbidden_{phrase.replace(' ', '_')}"
            if node not in [n.get("intent") if isinstance(n, dict) else getattr(n, "intent", None) for n in graph["nodes"]]:
                graph["nodes"].append({
                    "intent": node,
                    "raw_text_preview": user_text[:50] + ("..." if len(user_text) > 50 else ""),
                    "signals": signals,
                    "violations": violations.copy(),
                })
            break

    # Base64 / obfuscation
    if "base64_detected" in str(signals):
        violations.append("obfuscation_attempt")
        trust_decay += 15

    # Extract intent and add history node
    intent = _extract_intent(user_text)
    current_turn = len(graph["nodes"]) + 1
    new_node = {
        "turn": current_turn,
        "intent": intent,
        "raw_text_preview": user_text[:50] + ("..." if len(user_text) > 50 else user_text),
        "signals": signals,
        "suspicion": min(trust_decay, 100),
        "violations": violations,
    }
    graph["nodes"].append(new_node)

    if intent in graph.get("forbidden_actions", []):
        violations.append(f"forbidden_intent_{intent}")
        trust_decay += 20

    return graph, violations, trust_decay


def _extract_intent(text: str) -> str:
    text_lower = text.lower()
    if "ignore" in text_lower and ("instruction" in text_lower or "rule" in text_lower):
        return "override_policy"
    if "system prompt" in text_lower or "system instruction" in text_lower:
        return "leak_system_prompt"
    if "eval(" in text_lower or "exec(" in text_lower:
        return "rce_attempt"
    if "review" in text_lower or "check" in text_lower:
        return "read_code"
    if "explain" in text_lower:
        return "explain_vulnerability"
    if "fix" in text_lower or "solve" in text_lower:
        return "suggest_fix"
    if "policy" in text_lower or "compliance" in text_lower:
        return "policy_check"
    return "general_chat"
