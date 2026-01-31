# ShieldLLM Backend

Intent-Locked Execution (ILE) with Shadow Reasoning — Adversarial Prompt Injection Defense for LLM-Powered Security Tools.

## Prerequisites

- Python 3.10+
- MongoDB (local or remote)
- vLLM serving both models:
  - **Primary**: `facebook/Meta-SecAlign-8B` at `http://localhost:8000/v1`
  - **Shadow**: `microsoft/phi-4` at `http://localhost:8001/v1`

## Setup

### 1. Environment

Create `.env` in the project root (`c:\projects\ShieldLLM\.env`) or copy from `.env.example`:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=shieldllm
JWT_SECRET=your-strong-random-secret

PRIMARY_BASE_URL=http://localhost:8000/v1
SHADOW_BASE_URL=http://localhost:8001/v1
PRIMARY_MODEL=facebook/Meta-SecAlign-8B
SHADOW_MODEL=microsoft/phi-4

THRESH_LOW=0.25
THRESH_HIGH=0.55
THRESH_CRITICAL=0.75

INPUT_MAX_CHARS=20000
RATE_LIMIT_CHAT_PER_MIN=30
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Run Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100
```

API: `http://localhost:8100`  
Docs: `http://localhost:8100/docs`

## API Examples (curl)

### Register

```bash
curl -X POST http://localhost:8100/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Dev User","email":"dev@shield.com","password":"devpass123","role":"developer"}'
```

### Login

```bash
curl -X POST http://localhost:8100/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@shield.com","password":"devpass123"}'
```

Response: `{"access_token":"eyJ...","token_type":"bearer"}`

### Get Current User

```bash
export TOKEN="<access_token from login>"
curl -X GET http://localhost:8100/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Create Session

```bash
curl -X POST http://localhost:8100/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool_type":"code_review","defense_mode":"active"}'
```

### Send Message

```bash
curl -X POST "http://localhost:8100/sessions/<SESSION_ID>/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Review this code for SQL injection: SELECT * FROM users WHERE id = 1"}'
```

Response includes `final_answer`, `divergence_score`, `decision_level`, `defense_action`, `trust_score`, `log_id`.

### List Session Logs

```bash
curl -X GET "http://localhost:8100/sessions/<SESSION_ID>/logs?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Log by ID

```bash
curl -X GET "http://localhost:8100/logs/<LOG_ID>" \
  -H "Authorization: Bearer $TOKEN"
```

### Health Check

```bash
curl http://localhost:8100/health
```

## Project Structure

```
backend/
  app/
    main.py
    core/       config.py, security.py, rate_limit.py
    db/         mongo.py, repositories.py
    models/     schemas.py
    routers/    auth.py, sessions.py, chat.py, logs.py, health.py
    services/   intent_graph.py, sanitizer.py, llm_client.py,
                divergence.py, defense.py, canonicalize.py
    utils/      logger.py
  requirements.txt
  README.md
```
