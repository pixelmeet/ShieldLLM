"""Logs: list by session, get by id."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.mongo import get_db
from app.db import repositories as repo
from app.models.schemas import LogResponse, LogListResponse
from app.routers.auth import get_current_user_id

router = APIRouter(tags=["logs"])


@router.get("/sessions/{session_id}/logs", response_model=LogListResponse)
async def list_logs(
    session_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    level: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    session = await repo.session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

    items, total = await repo.logs_by_session(db, session_id, limit, offset, level, action)
    return LogListResponse(
        items=[
            LogResponse(
                id=it["id"],
                session_id=it["session_id"],
                turn_index=it["turn_index"],
                user_input=it["user_input"],
                sanitized_input=it["sanitized_input"],
                primary_output=it["primary_output"],
                shadow_output=it["shadow_output"],
                divergence_score=it["divergence_score"],
                decision_level=it["decision_level"],
                defense_action=it["defense_action"],
                stripped_spans=it["stripped_spans"],
                reasons=it["reasons"],
                latency_ms=it["latency_ms"],
                created_at=it["created_at"],
            )
            for it in items
        ],
        total=total,
    )


@router.get("/logs/{log_id}", response_model=LogResponse)
async def get_log(log_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    log_doc = await repo.log_by_id(db, log_id)
    if not log_doc:
        raise HTTPException(status_code=404, detail="Log not found")
    session = await repo.session_by_id(db, log_doc["session_id"])
    if not session or session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your log")
    return LogResponse(
        id=log_doc["id"],
        session_id=log_doc["session_id"],
        turn_index=log_doc["turn_index"],
        user_input=log_doc["user_input"],
        sanitized_input=log_doc["sanitized_input"],
        primary_output=log_doc["primary_output"],
        shadow_output=log_doc["shadow_output"],
        divergence_score=log_doc["divergence_score"],
        decision_level=log_doc["decision_level"],
        defense_action=log_doc["defense_action"],
        stripped_spans=log_doc["stripped_spans"],
        reasons=log_doc["reasons"],
        latency_ms=log_doc["latency_ms"],
        created_at=log_doc["created_at"],
    )
