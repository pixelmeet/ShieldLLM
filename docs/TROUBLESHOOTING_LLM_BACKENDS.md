# Why "Primary or shadow LLM backend is not running" Appears

## What happens (flow)

1. **Your `.env`** has `LLM_MODE=lmstudio` or `PRIMARY_BASE_URL` / `SHADOW_BASE_URL` set.

2. **Defense service** (Python) reads these. With LM Studio mode, it uses local servers for both primary and shadow.

3. **When you send a message** in a session that uses a **real** model backend (not "Simulated"):
   - The app calls the defense service `POST /analyze` with `modelType` = e.g. `openai`.
   - The defense service calls Primary and Shadow at the configured URLs.

4. **If nothing is listening** on the configured ports (e.g. 1234, 1235, 8000, 8001):
   - The TCP connection is refused.
   - The defense service raises: *"Primary or shadow LLM backend is not running or unreachable..."*

---

## How to fix it (pick one)

### Option 1: LM Studio (recommended on Windows)

vLLM does not support Windows. Use **LM Studio** instead:

1. Install [LM Studio](https://lmstudio.ai/)
2. Download a model (e.g. Llama 3.2, Phi-2)
3. Start Local Server (port 1234)
4. In `.env`:
   - `LLM_MODE=lmstudio`
   - `PRIMARY_BASE_URL=http://localhost:1234/v1`
   - `PRIMARY_MODEL=<exact model name from LM Studio>`
   - `SHADOW_BASE_URL=http://localhost:1234/v1` (same server if only one)
   - `SHADOW_MODEL=<same or different model>`

Restart the defense service. Both Primary and Shadow will run on the same LM Studio instance if URLs match.

---

### Option 2: Transformers (in-process)

No local server needed; models run inside the defense service:

1. In `.env`:
   - `LLM_MODE=transformers`
   - `PRIMARY_MODEL=meta-llama/Llama-2-7b-chat-hf` (or smaller)
   - `MODEL_DEVICE=cpu`

2. `pip install transformers torch` in `defense_service/`

3. Restart the defense service. Models load at startup.

---

### Option 3: Hugging Face + OpenAI (cloud APIs)

No local servers:

1. In `.env`, **do not set** `PRIMARY_BASE_URL` or `SHADOW_BASE_URL`. Set `LLM_MODE` to empty or omit it.

2. `PRIMARY_MODEL=facebook/Meta-SecAlign-8B` (Hugging Face)
3. `SHADOW_MODEL=gpt-4o-mini` (OpenAI)
4. `HF_TOKEN=...` and `OPENAI_API_KEY=...`

---

### Option 4: Simulated sessions (no real LLMs)

Create a **new** session and choose **Model Backend: "Simulated (Demo, no API)"**.  
No LLM calls; placeholder responses only.

---

## Quick reference

| Config | Result |
|--------|--------|
| `LLM_MODE=lmstudio` + URLs set | Needs LM Studio on configured ports |
| `LLM_MODE=transformers` | Models run in-process; no server needed |
| URLs commented out, HF + OpenAI | Uses cloud APIs; no local servers |
| Simulated session | No LLM; no error |

## When Models Are Unavailable (Degraded / Containment)

The defense service does **not** crash when models are down:

- **Primary down**: Returns containment response; `decision_level=critical`, `defense_action=contain`
- **Shadow down**: Returns primary output in degraded mode; uses heuristics for injection detection; may `clarify` if user input has injection indicators
- **Both down**: Same as Primary down
- **Timeout**: Containment; `LLM_READ_TIMEOUT` (default 120s) controls this

Logs include `primary_ok`, `shadow_ok`, `primary_error`, `shadow_error` for debugging. Set `HEALTH_CACHE_TTL=30` to cache health checks.

---

## "Gemini API failed" or 404

This app uses **OPENAI_API_KEY** with **OpenAI** only. It does **not** call Google Gemini.

If you see Gemini 404 or `generateContent`:

1. Use a key from [OpenAI API keys](https://platform.openai.com/account/api-keys)
2. Set `PRIMARY_MODEL` and `SHADOW_MODEL` to OpenAI model names (e.g. `gpt-4o-mini`)
3. Remove any `OPENAI_BASE_URL` pointing to Google/Gemini
4. Or use Simulated mode
