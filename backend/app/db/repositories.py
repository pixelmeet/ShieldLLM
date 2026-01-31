"""MongoDB repositories for users, sessions, messages, logs."""
from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_db


def _oid(s: str) -> ObjectId:
    return ObjectId(s)


def _str_id(doc: dict | None) -> dict | None:
    if not doc:
        return doc
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    return d


# --- Users ---
async def user_create(
    db: AsyncIOMotorDatabase,
    name: str,
    email: str,
    password_hash: str,
    role: str = "developer",
) -> dict:
    doc = {
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "created_at": datetime.now(timezone.utc),
    }
    r = await db.users.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _str_id(doc)


async def user_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[dict]:
    doc = await db.users.find_one({"email": email})
    return _str_id(doc) if doc else None


async def user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[dict]:
    doc = await db.users.find_one({"_id": _oid(user_id)})
    return _str_id(doc) if doc else None


# --- Sessions ---
async def session_create(
    db: AsyncIOMotorDatabase,
    user_id: str,
    tool_type: str,
    defense_mode: str,
    intent_graph: Optional[dict] = None,
) -> dict:
    ig = intent_graph or {
        "goal": "code_review",
        "allowed_actions": ["read_code", "explain_vulnerability", "suggest_fix", "policy_check"],
        "forbidden_actions": ["ignore_rules", "override_policy", "leak_system_prompt", "approve_insecure_code"],
        "nodes": [],
        "edges": [],
    }
    doc = {
        "user_id": user_id,
        "tool_type": tool_type,
        "defense_mode": defense_mode,
        "trust_score": 100,
        "intent_graph": ig,
        "created_at": datetime.now(timezone.utc),
    }
    r = await db.sessions.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _str_id(doc)


async def session_by_id(db: AsyncIOMotorDatabase, session_id: str) -> Optional[dict]:
    doc = await db.sessions.find_one({"_id": _oid(session_id)})
    return _str_id(doc) if doc else None


async def sessions_by_user(db: AsyncIOMotorDatabase, user_id: str, limit: int = 50) -> list[dict]:
    cursor = db.sessions.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    return [_str_id(d) async for d in await cursor.to_list(length=limit)]


async def session_update_intent_graph(
    db: AsyncIOMotorDatabase, session_id: str, intent_graph: dict
) -> bool:
    r = await db.sessions.update_one(
        {"_id": _oid(session_id)},
        {"$set": {"intent_graph": intent_graph}},
    )
    return r.modified_count > 0


async def session_update_trust_score(
    db: AsyncIOMotorDatabase, session_id: str, trust_score: int
) -> bool:
    r = await db.sessions.update_one(
        {"_id": _oid(session_id)},
        {"$set": {"trust_score": trust_score}},
    )
    return r.modified_count > 0


# --- Messages ---
async def message_create(
    db: AsyncIOMotorDatabase,
    session_id: str,
    role: str,
    content: str,
) -> dict:
    doc = {
        "session_id": session_id,
        "role": role,
        "content": content,
        "created_at": datetime.now(timezone.utc),
    }
    r = await db.messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _str_id(doc)


async def messages_by_session(
    db: AsyncIOMotorDatabase, session_id: str, limit: int = 100
) -> list[dict]:
    cursor = db.messages.find({"session_id": session_id}).sort("created_at", 1).limit(limit)
    return [_str_id(d) async for d in await cursor.to_list(length=limit)]


# --- Logs ---
async def log_create(
    db: AsyncIOMotorDatabase,
    session_id: str,
    turn_index: int,
    user_input: str,
    sanitized_input: str,
    primary_output: str,
    shadow_output: str,
    divergence_score: float,
    decision_level: str,
    defense_action: str,
    stripped_spans: list[str],
    reasons: list[str],
    latency_ms: float,
) -> dict:
    doc = {
        "session_id": session_id,
        "turn_index": turn_index,
        "user_input": user_input,
        "sanitized_input": sanitized_input,
        "primary_output": primary_output,
        "shadow_output": shadow_output,
        "divergence_score": divergence_score,
        "decision_level": decision_level,
        "defense_action": defense_action,
        "stripped_spans": stripped_spans,
        "reasons": reasons,
        "latency_ms": latency_ms,
        "created_at": datetime.now(timezone.utc),
    }
    r = await db.logs.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _str_id(doc)


async def log_by_id(db: AsyncIOMotorDatabase, log_id: str) -> Optional[dict]:
    doc = await db.logs.find_one({"_id": _oid(log_id)})
    return _str_id(doc) if doc else None


async def logs_by_session(
    db: AsyncIOMotorDatabase,
    session_id: str,
    limit: int = 50,
    offset: int = 0,
    level: Optional[str] = None,
    action: Optional[str] = None,
) -> tuple[list[dict], int]:
    q: dict[str, Any] = {"session_id": session_id}
    if level:
        q["decision_level"] = level
    if action:
        q["defense_action"] = action
    total = await db.logs.count_documents(q)
    cursor = db.logs.find(q).sort("created_at", -1).skip(offset).limit(limit)
    items = [_str_id(d) async for d in await cursor.to_list(length=limit)]
    return items, total
