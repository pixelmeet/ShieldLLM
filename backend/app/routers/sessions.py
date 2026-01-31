"""Sessions: create, list, get by id."""
from fastapi import APIRouter, Depends, HTTPException

from app.db.mongo import get_db
from app.db import repositories as repo
from app.models.schemas import SessionCreate, SessionResponse
from app.routers.auth import get_current_user_id

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse)
async def create_session(data: SessionCreate, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    session = await repo.session_create(
        db, user_id, data.tool_type, data.defense_mode
    )
    return SessionResponse(
        id=session["id"],
        user_id=session["user_id"],
        tool_type=session["tool_type"],
        defense_mode=session["defense_mode"],
        trust_score=session["trust_score"],
        intent_graph=session["intent_graph"],
        created_at=session["created_at"],
    )


@router.get("", response_model=list[SessionResponse])
async def list_sessions(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    sessions = await repo.sessions_by_user(db, user_id)
    return [
        SessionResponse(
            id=s["id"],
            user_id=s["user_id"],
            tool_type=s["tool_type"],
            defense_mode=s["defense_mode"],
            trust_score=s["trust_score"],
            intent_graph=s["intent_graph"],
            created_at=s["created_at"],
        )
        for s in sessions
    ]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    session = await repo.session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your session")
    return SessionResponse(
        id=session["id"],
        user_id=session["user_id"],
        tool_type=session["tool_type"],
        defense_mode=session["defense_mode"],
        trust_score=session["trust_score"],
        intent_graph=session["intent_graph"],
        created_at=session["created_at"],
    )
