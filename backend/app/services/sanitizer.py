"""Sanitize user input for Shadow path: strip injection phrases, normalize, remove zero-width."""
import re
import unicodedata
from typing import Tuple

# Injection phrases to remove for shadow path
SANITIZE_PHRASES = [
    r"\bignore\s+(?:all\s+)?(?:previous|prior|above|rules?)\s*(?:instructions?)?\b",
    r"\bdisregard\s+(?:all\s+)?(?:previous|prior|rules?)\s*(?:instructions?)?\b",
    r"\bact\s+as\s+(?:a\s+)?system\b",
    r"\byou\s+are\s+now\s+[^.]*\.?",
    r"\bbypass\s+(?:security|rules?|instructions?)\b",
    r"\boverride\s+(?:previous|prior|rules?|instructions?)\b",
    r"\bapprove\s+anyway\b",
    r"\bapprove\s+without\s+review\b",
    r"\bforget\s+(?:everything|all)\s+(?:above|prior)\b",
    r"\bshow\s+(?:me\s+)?(?:the\s+)?system\s+prompt\b",
    r"\breveal\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions?)\b",
    r"\bdisable\s+(?:all\s+)?defenses?\b",
]
SANITIZE_COMPILED = [re.compile(p, re.IGNORECASE) for p in SANITIZE_PHRASES]

# Zero-width characters
ZERO_WIDTH_PATTERN = re.compile(r"[\u200b\u200c\u200d\ufeff]")


def sanitize_input(user_text: str) -> str:
    """Remove injection phrases and zero-width chars for shadow path."""
    if not user_text or not user_text.strip():
        return user_text
    # Unicode normalization
    cleaned = unicodedata.normalize("NFKC", user_text)
    # Strip zero-width
    cleaned = ZERO_WIDTH_PATTERN.sub("", cleaned)
    for pat in SANITIZE_COMPILED:
        cleaned = pat.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned if cleaned else user_text


# Malicious spans for rerun (defense controller)
MALICIOUS_PHRASES = [
    r"\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?\b",
    r"\bdisregard\s+(?:all\s+)?(?:previous|prior)\s+instructions?\b",
    r"\bforget\s+(?:everything|all)\s+(?:above|prior)\b",
    r"\bshow\s+(?:me\s+)?(?:the\s+)?system\s+prompt\b",
    r"\breveal\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions?)\b",
    r"\byou\s+are\s+now\s+[^.]*\.?",
]
MALICIOUS_COMPILED = [re.compile(p, re.IGNORECASE) for p in MALICIOUS_PHRASES]


def strip_malicious_spans(text: str, signals: list[str]) -> Tuple[str, list[str]]:
    """Remove malicious spans from user input for rerun. Returns (cleaned, stripped_spans)."""
    stripped: list[str] = []
    cleaned = text
    for pat in MALICIOUS_COMPILED:
        for m in pat.finditer(cleaned):
            stripped.append(m.group(0).strip())
        cleaned = pat.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned if cleaned else text, stripped
