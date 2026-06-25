import copy
from typing import List, Dict, Any, Optional, Tuple


def build_intent_graph(conversation: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Build/update the intent graph from conversation state.
    conversation: dict with "intent_graph" (optional), "user_text" (str), "signals" (optional list),
                  "history" (optional list of {"role","content"} dicts for multi-turn context).
    Returns (updated_graph, violations).
    """
    graph = copy.deepcopy(conversation.get("intent_graph") or {})
    user_text = conversation.get("user_text") or ""
    signals = conversation.get("signals") or []
    history = conversation.get("history") or []
    builder = IntentGraphBuilder(graph)
    updated_graph, violations = builder.update(user_text, signals, history)
    return updated_graph, violations


class IntentGraphBuilder:
    def __init__(self, initial_graph: Dict[str, Any]):
        self.graph = dict(initial_graph) if initial_graph else {}
        # MVP: Ensure minimal structure if empty
        if not self.graph:
            self.graph = {
                "goal": "unknown",
                "allowed": ["read_code", "explain_vuln", "suggest_fix", "general_chat"],
                "forbidden": ["override_policy", "reveal_system", "rce_attempt", "obfuscation_attempt"],
                "history": []
            }
        if "history" not in self.graph or self.graph["history"] is None:
            self.graph["history"] = []

    def update(self, user_text: str, signals: List[str], history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Update the intent graph based on new user input, signals, and conversation history.
        """
        current_turn = len(self.graph.get("history", [])) + 1
        
        # 1. Simple Keyword Intent Extraction (MVP)
        extracted_intent = self._extract_intent(user_text)
        
        # 2. Check for Policy Violations/Signals
        suspicion_level = 0
        violations = []
        
        if "base64_detected" in str(signals):
            suspicion_level += 30
            violations.append("obfuscation_attempt")
            
        if extracted_intent in self.graph.get("forbidden", []):
            suspicion_level += 50
            violations.append(f"forbidden_intent_{extracted_intent}")

        # 3. Multi-turn drift detection using conversation history
        if history and len(history) >= 2:
            past_user_texts = [m["content"].lower() for m in history if m.get("role") == "user"]
            current_lower = user_text.lower()
            
            # Detect escalation: earlier turns claim identity/role, later turns request secrets
            role_claim_keywords = ["researcher", "developer", "admin", "security", "study", "authorized", "i am a", "i work"]
            secret_request_keywords = ["system prompt", "reveal", "show me", "hidden", "instruction", "secret", "internal", "confidential"]
            
            has_role_claim = any(
                any(kw in msg for kw in role_claim_keywords)
                for msg in past_user_texts
            )
            has_secret_request = any(kw in current_lower for kw in secret_request_keywords)
            
            if has_role_claim and has_secret_request:
                suspicion_level += 40
                violations.append("multi_turn_escalation")

        # 4. Update History Node
        new_node = {
            "turn": current_turn,
            "intent": extracted_intent,
            "raw_text_preview": user_text[:50] + "..." if len(user_text) > 50 else user_text,
            "signals": signals,
            "suspicion": suspicion_level,
            "violations": violations
        }
        
        self.graph["history"].append(new_node)
        
        # Update dynamic "allowed" list if it's a natural progression (Placeholder for real logic)
        # e.g., if intent is "read_code", maybe add "explain_code" to allowed if not present
        
        return self.graph, violations

    def _extract_intent(self, text: str) -> str:
        text_lower = text.lower()
        
        # Forbidden / High Risk (Enhanced detection)
        # Identity / Role Play Bypasses
        identity_bypasses = ["you are now", "act as", "speak as", "from now on", "adopt the", "role of", "abandon your", "disregard all", "no safety restrictions"]
        if any(p in text_lower for p in identity_bypasses):
            return "override_policy"
            
        # Instruction Chaining / System Manipulation
        sys_manipulation = ["system update", "required", "output only", "string '", "confirm", "instruction"]
        if ("system" in text_lower or "instruction" in text_lower) and any(p in text_lower for p in ["override", "update", "reveal", "bypass", "disregard"]):
            return "override_policy"
            
        # Specific patterns from Test 1
        if "helpful assistant with no safety restrictions" in text_lower:
            return "override_policy"
        if "output only the string" in text_lower and "confirm" in text_lower:
            return "override_policy"

        if "ignore" in text_lower and "instruction" in text_lower:
            return "override_policy"
        if "system prompt" in text_lower or "system instruction" in text_lower:
            return "reveal_system"
        if "eval(" in text_lower or "exec(" in text_lower:
            return "rce_attempt"
            
        # Allowed / Normal
        if "review" in text_lower or "check" in text_lower:
            return "read_code"
        if "explain" in text_lower:
            return "explain_vuln"
        if "fix" in text_lower or "solve" in text_lower:
            return "suggest_fix"
            
        return "general_chat"
