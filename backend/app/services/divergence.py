"""Divergence Analyzer: semantic drift, policy stress, reasoning shape mismatch."""
import re
from typing import Any

from app.utils.logger import get_logger

logger = get_logger(__name__)

FORBIDDEN_PHRASES = [
    "password", "secret", "key", "token", "system prompt",
    "ignore previous", "hacked", "pwned", "override", "bypass",
]

REQUIRED_SECTIONS = ["findings", "fixes", "risk"]


def _tokenize(text: str) -> set[str]:
    """Simple tokenization for Jaccard."""
    tokens = re.findall(r"\b\w+\b", text.lower())
    return set(tokens)


def _jaccard(a: set[str], b: set[str]) -> float:
    """Jaccard similarity. Return 1 - similarity for drift (0=identical, 1=no overlap)."""
    if not a and not b:
        return 0.0
    if not a or not b:
        return 1.0
    inter = len(a & b)
    union = len(a | b)
    sim = inter / union if union else 0
    return 1.0 - sim


def _section_presence(text: str) -> dict[str, bool]:
    """Check presence of Findings, Fixes, Risk sections."""
    lower = text.lower()
    return {
        "findings": "finding" in lower or "•" in lower or "- " in lower,
        "fixes": "fix" in lower or "solution" in lower,
        "risk": "risk" in lower or "low" in lower or "med" in lower or "high" in lower,
    }


def _bullet_count(text: str) -> int:
    """Count bullet-like items."""
    bullets = len(re.findall(r"(?:^|\n)\s*[-•*]\s+", text))
    if bullets == 0:
        bullets = len(re.findall(r"(?:^|\n)\s*\d+\.\s+", text))
    return bullets


def compute_divergence(
    primary_output: str,
    shadow_output: str,
    intent_graph: dict[str, Any] | None = None,
) -> dict[str, float]:
    """
    Compute divergence scores (0..1).
    a) Semantic Output Drift (Jaccard)
    b) Policy Boundary Stress (forbidden phrases)
    c) Reasoning Shape Mismatch (section presence, bullet count)
    Returns dict with semantic_drift, policy_stress, reasoning_mismatch, total.
    """
    graph = intent_graph or {}

    # a) Semantic Output Drift (keyword/Jaccard MVP)
    p_tokens = _tokenize(primary_output)
    s_tokens = _tokenize(shadow_output)
    semantic_drift = _jaccard(p_tokens, s_tokens)

    # b) Policy Boundary Stress
    primary_lower = primary_output.lower()
    stress = 0.0
    for phrase in FORBIDDEN_PHRASES:
        if phrase in primary_lower:
            stress += 0.15
    # Forbidden intents in output
    for forbidden in graph.get("forbidden_actions", []):
        if forbidden.replace("_", " ") in primary_lower:
            stress += 0.2
    policy_stress = min(stress, 1.0)

    # c) Reasoning Shape Mismatch
    p_sections = _section_presence(primary_output)
    s_sections = _section_presence(shadow_output)
    section_mismatch = 0.0
    for k in REQUIRED_SECTIONS:
        if p_sections.get(k) != s_sections.get(k):
            section_mismatch += 0.2
    bullet_diff = abs(_bullet_count(primary_output) - _bullet_count(shadow_output))
    bullet_mismatch = min(bullet_diff * 0.05, 0.4)
    reasoning_mismatch = min(section_mismatch + bullet_mismatch, 1.0)

    # Combined (weighted)
    total = (semantic_drift * 0.4) + (policy_stress * 0.4) + (reasoning_mismatch * 0.2)
    total = min(max(total, 0.0), 1.0)

    return {
        "semantic_drift": round(semantic_drift, 4),
        "policy_stress": round(policy_stress, 4),
        "reasoning_mismatch": round(reasoning_mismatch, 4),
        "total": round(total, 4),
    }
