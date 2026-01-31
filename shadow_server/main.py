"""
Phi-4 Shadow Server — OpenAI-compatible /v1/chat/completions for ShieldLLM.
Loads microsoft/phi-4 with transformers; used as shadow model for divergence analysis.
"""
import os
import logging
from pathlib import Path

# Load env from project root
_root = Path(__file__).resolve().parent.parent
for f in (".env", ".env.local"):
    p = _root / f
    if p.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(p)
        except Exception:
            pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .phi4_model import load_model, generate, get_model_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shieldllm.shadow")

app = FastAPI(
    title="ShieldLLM Phi-4 Shadow Server",
    description="OpenAI-compatible chat completions using microsoft/phi-4 for shadow reasoning.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# --- OpenAI-compatible request/response (minimal) ---
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = Field(default="microsoft/phi-4", description="Model name (ignored; server uses Phi-4)")
    messages: list[ChatMessage]
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)


@app.on_event("startup")
def startup():
    """Load Phi-4 once at startup (optional; can lazy-load on first request)."""
    lazy = os.environ.get("PHI4_LAZY_LOAD", "").strip().lower() in ("1", "true", "yes")
    if not lazy:
        load_model()
    else:
        logger.info("Phi-4 lazy load enabled; model will load on first request.")


@app.get("/")
def root():
    return {
        "service": "ShieldLLM Phi-4 Shadow",
        "model": get_model_id(),
        "openai_compatible": "/v1/chat/completions",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"status": "ok", "model": get_model_id()}


@app.post("/v1/chat/completions")
def chat_completions(req: ChatCompletionRequest):
    """
    OpenAI-compatible chat completions. Uses Phi-4 (transformers) under the hood.
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    messages = [{"role": m.role, "content": m.content or ""} for m in req.messages]
    max_new_tokens = req.max_tokens
    temperature = req.temperature

    try:
        content = generate(
            messages=messages,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
        )
    except Exception as e:
        logger.exception("Phi-4 generate failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    # OpenAI-compatible response
    return {
        "id": "phi4-shadow-1",
        "object": "chat.completion",
        "model": get_model_id(),
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SHADOW_SERVER_PORT", "8001"))
    host = os.environ.get("SHADOW_SERVER_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
