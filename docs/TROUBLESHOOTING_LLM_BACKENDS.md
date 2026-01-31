# Why "Primary or shadow LLM backend is not running" Appears

## What happens (flow)

1. **Your `.env`** has:
   - `PRIMARY_BASE_URL=http://localhost:8000/v1`
   - `SHADOW_BASE_URL=http://localhost:8001/v1`

2. **Defense service** (Python) reads these. Because both are set, it uses **vLLM/local servers** for both primary and shadow (no OpenAI/Hugging Face for those).

3. **When you send a message** in a session that uses a **real** model backend (not "Simulated"):
   - The app calls the defense service `POST /analyze` with `modelType` = e.g. `openai` or whatever the session has.
   - The defense service calls:
     - **Primary:** `http://localhost:8000/v1` (chat completions)
     - **Shadow:** `http://localhost:8001/v1` (chat completions)

4. **If nothing is listening** on port **8000** or **8001**:
   - The TCP connection is refused (e.g. `ConnectionRefusedError`).
   - The defense service catches this and raises:
     - *"Primary or shadow LLM backend is not running or unreachable. Start vLLM backends (PRIMARY_BASE_URL / SHADOW_BASE_URL in .env) or create a session with Model Backend: Simulated."*
   - The Next.js app returns that message as a 502 to you.

So the error appears **because**:
- `PRIMARY_BASE_URL` and `SHADOW_BASE_URL` are set in `.env`, and
- No server is actually running on those URLs (ports 8000 and 8001).

---

## How to fix it (pick one)

### Option 1: Start the vLLM backends (use real local models)

Run the script that starts primary and shadow on 8000 and 8001:

```powershell
.\scripts\start_llms.ps1
```

Or start them manually (requires [vLLM](https://docs.vllm.ai/en/latest/) installed):

- **Primary (port 8000):**  
  `vllm serve facebook/Meta-SecAlign-8B --port 8000 --host 0.0.0.0`
- **Shadow (port 8001):**  
  `vllm serve microsoft/phi-4 --port 8001 --host 0.0.0.0`

Wait until both servers are up, then use your session again.

---

### Option 2: Use Hugging Face + OpenAI instead of vLLM (no local servers)

If you don’t want to run vLLM, **stop** using the vLLM URLs for the defense service by clearing them in `.env`:

1. Comment out or remove these lines in `.env`:
   - `PRIMARY_BASE_URL=...`
   - `SHADOW_BASE_URL=...`

2. Keep:
   - `PRIMARY_MODEL=facebook/Meta-SecAlign-8B` (or another HF model)
   - `OPENAI_API_KEY=...` (for shadow, and for primary if you use an OpenAI model)
   - `HF_TOKEN=...` (for Hugging Face primary)

Then **restart the defense service**. It will use Hugging Face for primary and OpenAI for shadow, and the "Primary or shadow LLM backend is not running" error will go away (as long as HF/OpenAI are reachable).

---

### Option 3: Use Simulated sessions (no real LLMs)

Create a **new** session and choose **Model Backend: "Simulated (Demo, no API)"**.  
For that session the defense service never calls primary/shadow URLs, so you won’t see this error. You’ll get placeholder "[Simulated] ..." responses instead of real model output.

---

## Quick reference

| .env state | Session type | Result |
|------------|--------------|--------|
| `PRIMARY_BASE_URL` + `SHADOW_BASE_URL` set | Real backend | Needs servers on 8000 & 8001; otherwise you get this error. |
| Same | Simulated | No LLM calls; no error. |
| Both URLs commented out | Real backend | Uses HF + OpenAI; no local servers needed. |
