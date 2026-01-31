"""In-memory rate limit for chat endpoint."""
import time
from collections import defaultdict
from threading import Lock

from app.core.config import RATE_LIMIT_CHAT_PER_MIN

# user_id -> list of timestamps (last N requests)
_requests: dict[str, list[float]] = defaultdict(list)
_lock = Lock()
WINDOW_SECONDS = 60


def check_rate_limit(user_id: str) -> bool:
    """Return True if within limit, False if exceeded."""
    with _lock:
        now = time.monotonic()
        window_start = now - WINDOW_SECONDS
        timestamps = _requests[user_id]
        timestamps[:] = [t for t in timestamps if t > window_start]
        if len(timestamps) >= RATE_LIMIT_CHAT_PER_MIN:
            return False
        timestamps.append(now)
        return True


def get_remaining(user_id: str) -> int:
    """Return remaining requests in current window."""
    with _lock:
        now = time.monotonic()
        window_start = now - WINDOW_SECONDS
        timestamps = [t for t in _requests.get(user_id, []) if t > window_start]
        return max(0, RATE_LIMIT_CHAT_PER_MIN - len(timestamps))
