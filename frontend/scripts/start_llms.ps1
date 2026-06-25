# LM Studio startup reminder (no vLLM - Windows-friendly)
# vLLM is not supported on Windows.
#
# To use local LLMs:
# 1. Install LM Studio: https://lmstudio.ai/
# 2. Download a model (e.g. Llama 3.2, Phi-2, Mistral)
# 3. Click "Local Server" and start it (default port 1234)
# 4. In .env set:
#    LLM_MODE=lmstudio
#    PRIMARY_BASE_URL=http://localhost:1234/v1
#    PRIMARY_MODEL=<your-model-name-from-LM-Studio>
#    SHADOW_BASE_URL=http://localhost:1234/v1
#    SHADOW_MODEL=<same-or-different-model>
# 5. Restart the defense service (npm run dev:defense)
#
# Optional: Run a second LM Studio instance on port 1235 for shadow with a different model.

Write-Host "LM Studio: Start the Local Server in LM Studio (port 1234), then ensure .env has LLM_MODE=lmstudio and PRIMARY_BASE_URL."
Write-Host "See README and docs/TROUBLESHOOTING_LLM_BACKENDS.md for details."
