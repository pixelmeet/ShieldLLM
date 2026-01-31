"""Pydantic schemas for request/response and DB models."""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---
class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["admin", "engineer", "developer"] = "developer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime


# --- Sessions ---
ToolType = Literal["code_review", "policy_enforcement", "compliance_check"]
DefenseMode = Literal["passive", "active", "strict"]


class SessionCreate(BaseModel):
    tool_type: ToolType = "code_review"
    defense_mode: DefenseMode = "active"


class IntentGraphNode(BaseModel):
    turn: Optional[int] = None
    intent: Optional[str] = None
    raw_text_preview: Optional[str] = None
    signals: list[str] = Field(default_factory=list)
    suspicion: Optional[int] = None
    violations: list[str] = Field(default_factory=list)


class IntentGraph(BaseModel):
    goal: str = "code_review"
    allowed_actions: list[str] = Field(default_factory=lambda: ["read_code", "explain_vulnerability", "suggest_fix", "policy_check"])
    forbidden_actions: list[str] = Field(default_factory=lambda: ["ignore_rules", "override_policy", "leak_system_prompt", "approve_insecure_code"])
    nodes: list[IntentGraphNode | dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class SessionResponse(BaseModel):
    id: str
    user_id: str
    tool_type: str
    defense_mode: str
    trust_score: int = 100
    intent_graph: dict[str, Any]
    created_at: datetime


# --- Chat ---
class MessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)


class MessageResponse(BaseModel):
    final_answer: str
    divergence_score: float
    decision_level: str
    defense_action: str
    trust_score: int
    log_id: str


# --- Logs ---
class LogResponse(BaseModel):
    id: str
    session_id: str
    turn_index: int
    user_input: str
    sanitized_input: str
    primary_output: str
    shadow_output: str
    divergence_score: float
    decision_level: str
    defense_action: str
    stripped_spans: list[str]
    reasons: list[str]
    latency_ms: float
    created_at: datetime


class LogListResponse(BaseModel):
    items: list[LogResponse]
    total: int
