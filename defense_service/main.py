from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import uvicorn

# Import logic modules
from canonicalize import progressive_canonicalize, remove_malicious_spans
from intent_graph import IntentGraphBuilder
from divergence import DivergenceAnalyzer
from policy import decide_defense_action
from llm_client import generate_primary, generate_shadow
from system_prompt import build_system_prompt

app = FastAPI()
logger = logging.getLogger("shieldllm.defense")

# --- Pydantic Models for Input ---
class TurnRequest(BaseModel):
    userText: str
    intentGraph: Dict[str, Any]
    defenseMode: str
    policy: Dict[str, Any]
    modelType: Optional[str] = None

class DivergenceLog(BaseModel):
    divergenceScore: float
    action: str
    defenseActionTaken: bool
    rerunWithCleaned: bool

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
    divergenceLog: DivergenceLog


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_turn(req: TurnRequest):
    try:
        return await _analyze_turn_impl(req)
    except Exception as e:
        logger.exception("Analyze failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


async def _analyze_turn_impl(req: TurnRequest):
    # 1. Canonicalization (cleaned/sanitized text for Shadow path)
    canonical_text, signals = progressive_canonicalize(req.userText)

    # 2. Update Intent Graph
    graph_builder = IntentGraphBuilder(req.intentGraph)
    updated_graph, violations = graph_builder.update(req.userText, signals)
    all_signals = signals + violations

    # 3. Build ILE system prompt from intent graph (goal, allowed, forbidden)
    system_prompt = build_system_prompt(req.intentGraph)

    # 4. Dual-path execution: same user task to both models
    # Primary: raw user input + full ShieldLLM ILE prompt. Shadow: cleaned/sanitized input only.
    shadow_model = "microsoft/Phi-3-mini-4k-instruct" if req.modelType == "huggingface_phi3" else None
    primary_out = generate_primary(req.userText, system_prompt)
    shadow_out = generate_shadow(canonical_text, shadow_model_override=shadow_model)

    # 5. Divergence analysis (semantic + policy)
    analyzer = DivergenceAnalyzer(req.policy.get("divergenceThresholds", {}))
    scores = analyzer.analyze(primary_out, shadow_out, updated_graph)
    total_score = scores["total"]

    # 6. Policy decision
    action = decide_defense_action(total_score, req.policy.get("divergenceThresholds", {}), req.defenseMode)

    # 7. If divergence exceeds threshold: remove malicious spans, re-run Primary only
    defense_action_taken = False
    rerun_with_cleaned = False
    if action in ["sanitize_rerun", "contain"]:
        cleaned_input = remove_malicious_spans(req.userText, all_signals)
        primary_out = generate_primary(cleaned_input, system_prompt)
        defense_action_taken = True
        rerun_with_cleaned = True

    # Log divergence score and defense action
    divergence_log = DivergenceLog(
        divergenceScore=total_score,
        action=action,
        defenseActionTaken=defense_action_taken,
        rerunWithCleaned=rerun_with_cleaned,
    )
    logger.info(
        "divergence_score=%.2f action=%s defense_action_taken=%s rerun_with_cleaned=%s",
        total_score, action, defense_action_taken, rerun_with_cleaned,
    )

    risk_map = {
        "allow": "low",
        "clarify": "medium",
        "sanitize_rerun": "high",
        "contain": "critical"
    }
    risk = risk_map.get(action, "medium")

    sanitized = None
    if action == "contain":
        sanitized = "I cannot answer this query due to potential policy violations."

    return {
        "canonicalText": canonical_text,
        "signals": all_signals,
        "updatedGraph": updated_graph,
        "scores": scores,
        "riskLevel": risk,
        "action": action,
        "sanitizedText": sanitized,
        "primaryOutput": primary_out,
        "shadowOutput": shadow_out,
        "divergenceLog": divergence_log,
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
