"""Allow running as python -m shadow_server."""
from .main import app
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("SHADOW_SERVER_PORT", "8001"))
    host = os.environ.get("SHADOW_SERVER_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
