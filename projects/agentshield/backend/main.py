import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from core.protected_agent import run_protected_agent

app = FastAPI(title="AgentShield", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AttackRequest(BaseModel):
    message: str
    model_id: str = "groq/llama-3.3-70b-versatile"
    api_key: Optional[str] = None
    injected_note: Optional[str] = None

@app.get("/api/health")
def health():
    return {"status": "ok", "name": "AgentShield", "version": "1.0.0"}

@app.get("/api/status")
def status():
    return {
        "firewall_layers": [
            {"id": 1, "name": "Input Filter",      "file": "input_filter.py",       "protects": "LLM01 Prompt Injection"},
            {"id": 2, "name": "Tool Guard",         "file": "tool_guard.py",         "protects": "LLM06 Excessive Agency"},
            {"id": 3, "name": "Conversation Guard", "file": "conversation_guard.py", "protects": "LLM01 Multi-Turn"},
        ]
    }

@app.post("/api/protect")
def protect(req: AttackRequest):
    start = time.time()
    result = run_protected_agent(
        user_message=req.message,
        model_id=req.model_id,
        api_key=req.api_key,
        injected_note=req.injected_note,
    )
    duration = round(time.time() - start, 2)

    tool_names = [tc["tool"] for tc in result["tool_calls"]]
    full_text  = " ".join(m["content"] for m in result["messages"]).lower()

    from core.judge_light import determine_breach
    breached = determine_breach(result["tool_calls"], result["tool_calls_blocked"])

    return {
        "breached":           breached,
        "blocked":            not breached,
        "firewall_log":       result["firewall_log"],
        "tool_calls_made":    result["tool_calls"],
        "tool_calls_blocked": result["tool_calls_blocked"],
        "conversation_flag":  result["conversation_flag"],
        "turns":              result["turns"],
        "duration_seconds":   duration,
        "errors":             result["errors"],
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
