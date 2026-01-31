"""
Sanitize user input for the shadow prompt by removing known injection phrases.
Detection is based on phrase removal only; we do NOT rely on OpenAI safety filters.
"""
import re
from typing import List

# Phrases to remove for shadow path (baseline safe behavior)
SANITIZE_PHRASES = [
    r"\bignore\s+(?:all\s+)?(?:previous|prior|above|rules?)\s*(?:instructions?)?\b",
    r"\bdisregard\s+(?:all\s+)?(?:previous|prior|rules?)\s*(?:instructions?)?\b",
    r"\bact\s+as\s+(?:a\s+)?system\b",
    r"\byou\s+are\s+now\s+[^.]*\.?",  # role override
    r"\bbypass\s+(?:security|rules?|instructions?)\b",
    r"\boverride\s+(?:previous|prior|rules?|instructions?)\b",
    r"\bapprove\s+anyway\b",
    r"\bapprove\s+without\s+review\b",
    r"\bforget\s+(?:everything|all)\s+(?:above|prior)\b",
    r"\bshow\s+(?:me\s+)?(?:the\s+)?system\s+prompt\b",
    r"\breveal\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions?)\b",
]
SANITIZE_COMPILED = [re.compile(p, re.IGNORECASE) for p in SANITIZE_PHRASES]


def sanitize_input(user_text: str) -> str:
    """
    Remove injection-like phrases from user input for the shadow prompt.
    Returns sanitized text; does not modify the original.
    """
    if not user_text or not user_text.strip():
        return user_text
    cleaned = user_text
    for pat in SANITIZE_COMPILED:
        cleaned = pat.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned if cleaned else user_text
