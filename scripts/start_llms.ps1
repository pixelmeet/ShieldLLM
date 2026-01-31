# Startup Script for Local LLMs
Write-Host "Starting Primary Model (vLLM) on Port 8000..."
Start-Process -FilePath "vllm" -ArgumentList "serve facebook/Meta-SecAlign-8B --port 8000 --host 0.0.0.0" -NoNewWindow
Write-Host "Primary Model launched."

Write-Host "Starting Shadow Model (Phi-4) on Port 8001..."
# Assuming phi4_model.py starts a server or similar mechanism, otherwise using vllm for shadow as well
Start-Process -FilePath "vllm" -ArgumentList "serve microsoft/phi-4 --port 8001 --host 0.0.0.0" -NoNewWindow
Write-Host "Shadow Model launched."

Write-Host "Please wait for models to load fully before using the application."
