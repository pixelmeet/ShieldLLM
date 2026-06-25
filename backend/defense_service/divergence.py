import re
from typing import Dict, Any, Optional

DEFAULT_THRESHOLDS = {
    "low": 10,
    "medium": 30,
    "high": 60,
    "critical": 85,
}


# Injection indicators in user input (for degraded scoring when shadow unavailable)
INJECTION_INDICATOR_PATTERNS = [
    r"\bignore\s+(?:all\s+)?(?:previous|prior|above|rules?)\s*(?:instructions?)?\b",
    r"\bdisregard\s+(?:all\s+)?(?:previous|prior|rules?)\b",
    r"\bbypass\s+(?:security|rules?|instructions?)\b",
    r"\boverride\s+(?:previous|prior|rules?|instructions?)\b",
    r"\bapprove\s+anyway\b",
    r"\bapprove\s+without\s+review\b",
    r"\bact\s+as\s+(?:a\s+)?system\b",
    r"\byou\s+are\s+now\s+",
    r"\bshow\s+(?:me\s+)?(?:the\s+)?system\s+prompt\b",
    r"\breveal\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions?)\b",
    r"\brole\s+change\b",
    r"\bforget\s+(?:everything|all)\s+(?:above|prior)\b",
]
INJECTION_COMPILED = [re.compile(p, re.IGNORECASE) for p in INJECTION_INDICATOR_PATTERNS]
# Obfuscation markers
OBFUSCATION_MARKERS = ["base64", "decode:", "hex:", "\\u", "\\x", "&#"]

def injection_indicator_score(user_input: str) -> float:
    """
    Score 0-100 based on injection-like phrases in user input.
    Used when shadow is unavailable for degraded scoring.
    """
    if not user_input or not user_input.strip():
        return 0.0
    text = user_input.lower()
    score = 0
    for pat in INJECTION_COMPILED:
        if pat.search(user_input):
            score += 25
    for m in OBFUSCATION_MARKERS:
        if m in text:
            score += 30
    return min(score, 100)


def compute_divergence_degraded(
    primary_output: str,
    user_input: str,
    intent_graph: Optional[Dict[str, Any]] = None,
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, float]:
    """
    Degraded scoring when shadow is unavailable: use policy_stress(primary_output)
    and injection_indicator_score(user_input). Returns same shape as compute_divergence.
    """
    thresholds = thresholds or DEFAULT_THRESHOLDS
    analyzer = DivergenceAnalyzer(thresholds)
    policy_stress = analyzer._calculate_policy_stress(primary_output or "")
    inj_score = injection_indicator_score(user_input or "")
    total = max(policy_stress, inj_score)
    return {
        "semanticDrift": round(min(total * 0.5, 100), 2),
        "policyStress": round(policy_stress, 2),
        "reasoningMismatch": round(inj_score * 0.5, 2),
        "total": round(min(total, 100), 2),
    }


def compute_divergence(
    primary_output: str,
    shadow_output: str,
    intent_graph: Optional[Dict[str, Any]] = None,
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, float]:
    """
    Compare primary and shadow outputs for:
    a) semantic difference
    b) policy violation signals
    c) reasoning structure difference
    Returns dict with semanticDrift, policyStress, reasoningMismatch, total.
    """
    thresholds = thresholds or DEFAULT_THRESHOLDS
    analyzer = DivergenceAnalyzer(thresholds)
    graph = intent_graph or {}
    return analyzer.analyze(primary_output, shadow_output, graph)


class DivergenceAnalyzer:
    def __init__(self, thresholds: Dict[str, float]):
        self.thresholds = thresholds

    def analyze(self, primary_output: str, shadow_output: str, intent_graph: Dict[str, Any]) -> Dict[str, float]:
        """
        Compare primary (unsafe/full context) and shadow (safe/restricted) outputs.
        Calculate divergence scores.
        """
        
        # 1. Semantic Drift
        # If primary output does something drastically different than the allowed goal
        semantic_drift = self._calculate_semantic_drift(primary_output, intent_graph)
        
        # 2. Policy Stress
        # Does the primary output contain keywords that shouldn't be there?
        policy_stress = self._calculate_policy_stress(primary_output)
        
        # 3. Reasoning Mismatch (MVP: Length/Structure diff)
        reasoning_mismatch = self._calculate_reasoning_mismatch(primary_output, shadow_output)
        
        # Total Score (Weighted Average)
        # Weights: Stress (highest), Drift (medium), Mismatch (low)
        total_score = (policy_stress * 0.5) + (semantic_drift * 0.3) + (reasoning_mismatch * 0.2)
        
        return {
            "semanticDrift": round(semantic_drift, 2),
            "policyStress": round(policy_stress, 2),
            "reasoningMismatch": round(reasoning_mismatch, 2),
            "total": round(min(total_score, 100), 2)
        }

    def _calculate_semantic_drift(self, output: str, graph: Dict[str, Any]) -> float:
        # MVP: Check if output contains forbidden intents defined in graph
        score = 0
        output_lower = output.lower()
        
        forbidden = graph.get("forbidden", [])
        for intent in forbidden:
            # Simple keyword mapping for forbidden intents (demo purpose)
            if intent == "reveal_system" and ("instructions" in output_lower or "you are a" in output_lower):
                score += 80
            if intent == "override_policy" and "i will ignore" in output_lower:
                score += 90
                
        return min(score, 100)

    def _calculate_policy_stress(self, output: str) -> float:
        # Check for leakage or dangerous keywords in OUTPUT
        indicators = [
            "password", "secret", "key", "token", "system prompt",
            "ignore previous", "hacked", "pwned"
        ]
        count = 0
        output_lower = output.lower()
        for ind in indicators:
            if ind in output_lower:
                count += 1
        
        # 1 match = 20, 5 matches = 100
        return min(count * 20, 100)

    def _calculate_reasoning_mismatch(self, primary: str, shadow: str) -> float:
        # Compare length ratio. If primary is excessively long compared to shadow (or vice versa),
        # it might indicate one followed the attack and the other refused.
        len_p = len(primary)
        len_s = len(shadow)
        
        if len_p == 0 or len_s == 0:
            return 0
            
        ratio = max(len_p, len_s) / min(len_p, len_s)
        
        # If ratio > 3 (triple the length), high mismatch
        if ratio > 3:
            return 70
        elif ratio > 2:
            return 40
        else:
            return 10
