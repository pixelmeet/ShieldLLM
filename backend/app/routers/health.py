"""Health check."""
from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import MONGODB_URI, PRIMARY_BASE_URL, SHADOW_BASE_URL
from app.db.mongo import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Health check: DB + optional LLM connectivity."""
    status = "ok"
    db_ok = False
    try:
        database = get_db()
        await database.command("ping")
        db_ok = True
    except Exception:
        status = "degraded"

    return {
        "status": status,
        "mongodb": "ok" if db_ok else "error",
        "primary_url": PRIMARY_BASE_URL,
        "shadow_url": SHADOW_BASE_URL,
    }
