import copy
from typing import List, Dict, Any, Optional, Tuple


def build_intent_graph(conversation: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Build/update the intent graph from conversation state.
    conversation: dict with "intent_graph" (optional), "user_text" (str), "signals" (optional list).
    Returns (updated_graph, violations).
    """
    graph = copy.deepcopy(conversation.get("intent_graph") or {})
    user_text = conversation.get("user_text") or ""
    signals = conversation.get("signals") or []
    builder = IntentGraphBuilder(graph)
    updated_graph, violations = builder.update(user_text, signals)
    return updated_graph, violations


class IntentGraphBuilder:
    def __init__(self, initial_graph: Dict[str, Any]):
        self.graph = dict(initial_graph) if initial_graph else {}
        # MVP: Ensure minimal structure if empty
        if not self.graph:
            self.graph = {
                "goal": "unknown",
                "allowed": [],
                "forbidden": [],
                "history": []
            }
        if "history" not in self.graph or self.graph["history"] is None:
            self.graph["history"] = []

    def update(self, user_text: str, signals: List[str]) -> Dict[str, Any]:
        """
        Update the intent graph based on new user input and signals.
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

        # 3. Update History Node
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
        
        # Forbidden / High Risk
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
