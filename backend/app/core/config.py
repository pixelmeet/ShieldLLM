"""Configuration from environment (dotenv)."""
import os
from pathlib import Path

from dotenv import load_dotenv

_root = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root / ".env.local")

# Database
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "shieldllm")

# Auth
JWT_SECRET = os.getenv("JWT_SECRET", "changeme_in_prod")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_EXPIRE_MINUTES = 60 * 24  # 24 hours

# LLM (vLLM endpoints)
PRIMARY_BASE_URL = os.getenv("PRIMARY_BASE_URL", "http://localhost:8000/v1")
SHADOW_BASE_URL = os.getenv("SHADOW_BASE_URL", "http://localhost:8001/v1")
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "facebook/Meta-SecAlign-8B")
SHADOW_MODEL = os.getenv("SHADOW_MODEL", "microsoft/phi-4")
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1024"))

# Divergence thresholds (0..1)
THRESH_LOW = float(os.getenv("THRESH_LOW", "0.25"))
THRESH_HIGH = float(os.getenv("THRESH_HIGH", "0.55"))
THRESH_CRITICAL = float(os.getenv("THRESH_CRITICAL", "0.75"))

# Limits
INPUT_MAX_CHARS = int(os.getenv("INPUT_MAX_CHARS", "20000"))
RATE_LIMIT_CHAT_PER_MIN = int(os.getenv("RATE_LIMIT_CHAT_PER_MIN", "30"))
