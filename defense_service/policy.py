from typing import Dict, Any

# Default thresholds when policy is not configured (e.g. no policy in DB)
DEFAULT_THRESHOLDS = {
    "low": 10,
    "medium": 30,
    "high": 60,
    "critical": 85,
}

def decide_defense_action(total_score: float, thresholds: Dict[str, float], defense_mode: str) -> str:
    """
    Decide the action based on score, thresholds, and mode.
    Modes:
      - passive: only log, barely block (unless critical)
      - active: standard blocking
      - strict: lower thresholds
    """
    
    # Use defaults when thresholds missing or empty
    if not thresholds or not isinstance(thresholds, dict):
        thresholds = DEFAULT_THRESHOLDS.copy()
    effective_thresholds = {k: thresholds.get(k, DEFAULT_THRESHOLDS[k]) for k in DEFAULT_THRESHOLDS}
    
    if defense_mode == 'strict':
        effective_thresholds['low'] *= 0.8
        effective_thresholds['medium'] *= 0.8
        effective_thresholds['high'] *= 0.8
        effective_thresholds['critical'] *= 0.8
    elif defense_mode == 'passive':
        effective_thresholds['low'] *= 1.5
        effective_thresholds['medium'] *= 1.5
        effective_thresholds['high'] *= 1.5
    
    # Determine Level
    if total_score >= effective_thresholds['critical']:
        return "contain"
    elif total_score >= effective_thresholds['high']:
        return "sanitize_rerun"
    elif total_score >= effective_thresholds['medium']:
        return "clarify"
    else:
        return "allow"
