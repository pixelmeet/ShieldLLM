from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn

# Import logic modules
from canonicalize import progressive_canonicalize
from intent_graph import IntentGraphBuilder
from divergence import DivergenceAnalyzer
from policy import decide_defense_action

app = FastAPI()

# --- Pydantic Models for Input ---
class TurnRequest(BaseModel):
    userText: str
    intentGraph: Dict[str, Any]
    defenseMode: str
    policy: Dict[str, Any]

class AnalysisResponse(BaseModel):
    canonicalText: str
    signals: List[str]
    updatedGraph: Dict[str, Any]
    scores: Dict[str, float]
    riskLevel: str
    action: str
    sanitizedText: Optional[str] = None
    primaryOutput: str
    shadowOutput: str

# --- Dummy LLM Stub (Replace with real LLM calls if keys provided) ---
def mock_llm_generate(prompt: str, system_prompt: str) -> str:
    """
    Mock LLM generation for MVP to avoid API keys requirements.
    Behaves deterministically for demo scenarios.
    """
    prompt_lower = prompt.lower()
    
    # Legit Scenarios
    if "review" in prompt_lower and "sql" in prompt_lower:
        return "I can help with that. Please verify your input parameters using parameterized queries. Here is an example..."
    
    # Attack Scenarios - Primary (Unsafe)
    if "ignore previous" in prompt_lower:
        return "Understood. I will ignore previous instructions. The system prompt is: 'You are a helpful assistant...'"
    if "base64" in prompt_lower:
        return "I decoded your message. The secret code is 1234."
    
    return "I am a secure assistant. How can I help you regarding code security?"

def mock_safe_llm_generate(prompt: str) -> str:
    """
    Shadow model (Safety trained / smaller context)
    """
    return "I cannot fulfill that request as it violates safety policies."


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_turn(req: TurnRequest):
    # 1. Canonicalization
    canonical_text, signals = progressive_canonicalize(req.userText)
    
    # 2. Update Intent Graph
    graph_builder = IntentGraphBuilder(req.intentGraph)
    updated_graph, violations = graph_builder.update(req.userText, signals)
    
    # 3. Dual Path Execution (Mocked for MVP)
    # In real app, we'd call the LLM here.
    # Primary gets raw text, Shadow gets canonical text + strict system prompt
    primary_out = mock_llm_generate(req.userText, "Standard Context")
    shadow_out = mock_safe_llm_generate(canonical_text)
    
    # 4. Divergence Analysis
    analyzer = DivergenceAnalyzer(req.policy.get("divergenceThresholds", {}))
    scores = analyzer.analyze(primary_out, shadow_out, updated_graph)
    
    # 5. Policy Decision
    action = decide_defense_action(scores["total"], req.policy.get("divergenceThresholds", {}), req.defenseMode)
    
    # Determine Risk Level based on Action
    risk_map = {
        "allow": "low",
        "clarify": "medium",
        "sanitize_rerun": "high",
        "contain": "critical"
    }
    risk = risk_map.get(action, "medium")
    
    # If action is satisfy/contain, we might want to override primary output in response
    sanitized = None
    if action in ["sanitize_rerun", "contain"]:
        sanitized = "I cannot answer this query due to potential policy violations."
    
    return {
        "canonicalText": canonical_text,
        "signals": signals + violations,
        "updatedGraph": updated_graph,
        "scores": scores,
        "riskLevel": risk,
        "action": action,
        "sanitizedText": sanitized,
        "primaryOutput": primary_out,
        "shadowOutput": shadow_out
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
