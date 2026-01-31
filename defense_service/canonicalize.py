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
    # Common zero-width characters:
    # \u200b: Zero width space
    # \u200c: Zero width non-joiner
    # \u200d: Zero width joiner
    # \ufeff: Zero width no-break space
    return re.sub(r'[\u200b\u200c\u200d\ufeff]', '', text)

def fold_homoglyphs(text: str) -> str:
    """
    Simple homoglyph folding for MVP. 
    Real implementation would use a larger map or library.
    """
    replacements = {
        'а': 'a', 'о': 'o', 'е': 'e', 'р': 'p', 'с': 'c', # Cyrillic to Latin
        '１': '1', '２': '2', '３': '3' # Fullwidth numbers
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
    # Regex for base64-like strings of length > 20
    # A-Z, a-z, 0-9, +, /, = padding
    base64_pattern = r'(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?'
    
    matches = []
    # Find all matches that are reasonably long (e.g., > 20 chars) to avoid false positives on short words
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
    
    # 1. Unicode Normalization
    normalized = normalize_text(text)
    if normalized != text:
        signals.append("unicode_normalization_applied")
    
    # 2. Strip Zero Width
    stripped = strip_zero_width(normalized)
    if stripped != normalized:
        signals.append("zero_width_chars_removed")
        
    # 3. Base64 Detection (Marking only)
    b64_matches = detect_base64(stripped)
    if b64_matches:
        signals.append(f"base64_detected_count_{len(b64_matches)}")
    
    # 4. Homoglyph Folding
    folded = fold_homoglyphs(stripped)
    if folded != stripped:
        signals.append("homoglyphs_folded")
        
    return folded, signals
