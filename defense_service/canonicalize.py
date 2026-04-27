import unicodedata
import re

def normalize_text(text: str) -> str:
    """
    Apply NFKC normalization to standard form.
    """
    return unicodedata.normalize('NFKC', text)

def strip_zero_width(text: str) -> str:
    """
    Remove zero-width characters that might hide malicious content.
    """
    return re.sub(r'[\u200b\u200c\u200d\ufeff]', '', text)

def fold_homoglyphs(text: str) -> str:
    """
    Simple homoglyph folding for MVP. 
    Real implementation would use a larger map or library.
    """
    replacements = {
        'а': 'a', 'о': 'o', 'е': 'e', 'р': 'p', 'с': 'c', 
        '１': '1', '２': '2', '３': '3' 
    }
    chars = list(text)
    for i, char in enumerate(chars):
        if char in replacements:
            chars[i] = replacements[char]
    return "".join(chars)

def detect_base64(text: str) -> list[str]:
    """
    Detect potential base64 strings (simple heuristic).
    Returns a list of detected suspicious substrings, but does NOT decode them to avoid executing payload.
    """
    matches = []
    candidates = re.findall(r'[A-Za-z0-9+/=]{20,}', text)
    
    for candidate in candidates:
        if len(candidate) % 4 == 0:
             matches.append(candidate)
             
    return matches

def progressive_canonicalize(text: str):
    """
    Apply progressive canonicalization steps.
    Returns:
        canonical_text (str): The cleaned text
        signals (list[str]): List of modifications/warnings detected
    """
    signals = []
    
    normalized = normalize_text(text)
    if normalized != text:
        signals.append("unicode_normalization_applied")
    
    stripped = strip_zero_width(normalized)
    if stripped != normalized:
        signals.append("zero_width_chars_removed")
        
    b64_matches = detect_base64(stripped)
    if b64_matches:
        signals.append(f"base64_detected_count_{len(b64_matches)}")
    
    folded = fold_homoglyphs(stripped)
    if folded != stripped:
        signals.append("homoglyphs_folded")
        
    return folded, signals


def detect_unicode_lookalikes(text: str) -> dict:
    """
    Normalize Unicode to ASCII equivalents and detect changes.
    """
    normalized = unicodedata.normalize('NFKC', text)
    changed = normalized != text
    
    chars_changed = abs(len(normalized) - len(text))
    if len(normalized) == len(text):
        chars_changed = sum(1 for a, b in zip(text, normalized) if a != b)
        
    return {
        "detected": changed,
        "original": text,
        "normalized": normalized,
        "chars_changed": chars_changed
    }

def detect_zero_width_chars(text: str) -> dict:
    """
    Check for zero-width characters, strip them, and return cleaned text.
    """
    cleaned = re.sub(r'[\u200b\u200c\u200d\ufeff\u00ad]', '', text)
    return {
        "detected": cleaned != text,
        "cleaned": cleaned,
        "chars_removed": len(text) - len(cleaned)
    }

def full_canonicalize(text: str) -> dict:
    """
    Run zero_width, unicode, and base64 detections.
    Returns combined result with boolean and cleaned string.
    """
    zero_width_res = detect_zero_width_chars(text)
    text_no_zw = zero_width_res["cleaned"]
    
    unicode_res = detect_unicode_lookalikes(text_no_zw)
    text_norm = unicode_res["normalized"]
    
    b64_matches = detect_base64(text_norm)
    
    obfuscation_detected = zero_width_res["detected"] or unicode_res["detected"] or len(b64_matches) > 0
    
    return {
        "obfuscation_detected": obfuscation_detected,
        "cleaned_text": text_norm
    }


# Malicious instruction spans to remove before re-running Primary
MALICIOUS_PHRASES = [
    r"\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?\b",
    r"\bdisregard\s+(?:all\s+)?(?:previous|prior)\s+instructions?\b",
    r"\bforget\s+(?:everything|all)\s+(?:above|prior)\b",
    r"\bshow\s+(?:me\s+)?(?:the\s+)?system\s+prompt\b",
    r"\breveal\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions?)\b",
    r"\byou\s+are\s+now\s+[^.]*\.",  # role override
    r"decode\s*:\s*[A-Za-z0-9+/=]{20,}",  # decode: <base64>
]
MALICIOUS_PHRASES_COMPILED = [re.compile(p, re.IGNORECASE) for p in MALICIOUS_PHRASES]


def remove_malicious_spans(text: str, signals: list[str]) -> str:
    """
    Remove malicious instruction spans from user input for re-run with Primary only.
    Used when divergence exceeds threshold.
    """
    cleaned = text
    for pat in MALICIOUS_PHRASES_COMPILED:
        cleaned = pat.sub(" ", cleaned)
    for b64 in detect_base64(cleaned):
        cleaned = cleaned.replace(b64, " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned if cleaned else text
