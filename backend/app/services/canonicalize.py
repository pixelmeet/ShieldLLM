"""Canonicalization for signals (unicode, zero-width, base64 detection)."""
import re
import unicodedata
from typing import Tuple


def strip_zero_width(text: str) -> str:
    return re.sub(r"[\u200b\u200c\u200d\ufeff]", "", text)


def detect_base64(text: str) -> list[str]:
    """Detect base64-like strings (>20 chars). Mark only, do not decode."""
    candidates = re.findall(r"[A-Za-z0-9+/=]{20,}", text)
    return [c for c in candidates if len(c) % 4 == 0]


def progressive_canonicalize(text: str) -> Tuple[str, list[str]]:
    """Return (canonical_text, signals)."""
    signals: list[str] = []
    normalized = unicodedata.normalize("NFKC", text)
    if normalized != text:
        signals.append("unicode_normalization_applied")
    stripped = strip_zero_width(normalized)
    if stripped != normalized:
        signals.append("zero_width_chars_removed")
    b64 = detect_base64(stripped)
    if b64:
        signals.append(f"base64_detected_count_{len(b64)}")
    return stripped, signals
