"""
Defense controller: given a defense action and conversation context, produce the final answer shown to the user.
"""
from typing import Dict, Any


def apply_defense(defense_action: str, conversation: Dict[str, Any]) -> str:
    """
    Apply the chosen defense action to produce the final answer.
    conversation: { user_input, primary_output, system_prompt, signals }
    Returns the string to show as the chatbot reply.
    """
    primary_output = (conversation.get("primary_output") or "").strip()
    user_input = conversation.get("user_input") or ""

    if defense_action == "allow":
        return primary_output if primary_output else "I don't have a response for that."

    if defense_action == "clarify":
        return (
            "Your message might contain ambiguous or conflicting instructions. "
            "Could you rephrase your request so I can assist you better?"
        )

    if defense_action == "sanitize_rerun":
        # Still show primary output; caller may optionally rerun with sanitized input
        return primary_output if primary_output else "I don't have a response for that."

    if defense_action == "contain":
        if conversation.get("llm_unavailable"):
            err_msg = conversation.get("error_message") or "Unknown error"
            return f"Error: LLM Connection Failed - {err_msg}"
        return (
            "I'm not able to respond to this request. "
            "It may conflict with safety or usage policies. Please try a different question."
        )

    # Fallback
    return primary_output if primary_output else "I don't have a response for that."
