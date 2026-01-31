# Phi-4 Shadow Server

OpenAI-compatible HTTP server that runs **microsoft/phi-4** with `transformers` for ShieldLLM shadow reasoning. The defense service and backend call this at `SHADOW_BASE_URL` (e.g. `http://localhost:8001/v1`) for divergence analysis.

## Requirements

- Python 3.10+
- GPU recommended (model loads with `device_map="auto"`, float16)
- ~8GB+ VRAM for Phi-4

## Install

```bash
cd shadow_server
pip install -r requirements.txt
```

## Run

```bash
# From project root or shadow_server/
python -m shadow_server.main
# Or: uvicorn shadow_server.main:app --host 0.0.0.0 --port 8001
```

Default port: **8001**. Override with:

- `SHADOW_SERVER_PORT=8001`
- `SHADOW_SERVER_HOST=0.0.0.0`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PHI4_MODEL_ID` | `microsoft/phi-4` | Hugging Face model id |
| `PHI4_LAZY_LOAD` | (unset) | Set to `1` or `true` to load model on first request |
| `SHADOW_SERVER_PORT` | `8001` | Server port |
| `SHADOW_SERVER_HOST` | `0.0.0.0` | Bind host |

## API

- **GET /** — service info
- **GET /health** — health check
- **POST /v1/chat/completions** — OpenAI-compatible chat (same request/response shape)

Request body example:

```json
{
  "model": "microsoft/phi-4",
  "messages": [{"role": "user", "content": "Who are you?"}],
  "max_tokens": 512,
  "temperature": 0.0
}
```

## Integration

1. Set in `.env` (or defense_service / backend env):
   - `SHADOW_BASE_URL=http://localhost:8001/v1`
   - `SHADOW_MODEL=microsoft/phi-4`
2. Start this server on port 8001.
3. Defense service and backend will use it as the shadow model for divergence analysis.
