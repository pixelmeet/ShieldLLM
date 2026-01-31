"""ShieldLLM Backend - Intent-Locked Execution with Shadow Reasoning."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.mongo import connect_db, close_db
from app.routers import auth, sessions, chat, logs, health
from app.utils.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="ShieldLLM",
    description="Adversarial Prompt Injection Defense for LLM-Powered Security Tools",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(logs.router)
app.include_router(health.router)


@app.get("/")
def root():
    return {
        "service": "ShieldLLM",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }
