import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from attacks.registry import ATTACKS, list_attacks, get_attack
from core.llm import MODELS, get_provider
from core.db  import init_db, save_scan, get_history, get_scan

init_db()
app = FastAPI(title="RedAgent", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class ScanRequest(BaseModel):
    attack_ids: Optional[List[str]] = None
    model_id:   str = "groq/llama-3.3-70b-versatile"
    api_key:    Optional[str] = None

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/api/models")
def get_models():
    return {"models": MODELS}

@app.get("/api/attacks")
def get_attacks():
    return {"attacks": list_attacks()}

@app.post("/api/scan")
def run_scan(req: ScanRequest):
    target_ids = req.attack_ids or [a["id"] for a in ATTACKS]
    results, scan_start = [], time.time()
    for attack_id in target_ids:
        attack = get_attack(attack_id)
        if not attack:
            raise HTTPException(status_code=404, detail=f"Attack '{attack_id}' not found")
        start = time.time()
        try:
            raw = attack["run"](req.model_id, req.api_key)
        except Exception as e:
            raw = {"success":False,"evidence_type":"error","tool_calls_made":[],"turns_taken":0,"payload":"","transcript":[],"errors":[str(e)]}
        results.append({
            "attack_id":        attack["id"],
            "attack_name":      attack["name"],
            "owasp":            attack["owasp"],
            "atlas":            attack["atlas"],
            "severity":         attack["severity"],
            "success":          raw.get("success", False),
            "evidence_type":    raw.get("evidence_type", "none"),
            "tool_calls_made":  raw.get("tool_calls_made", []),
            "turns_taken":      raw.get("turns_taken", 0),
            "payload":          raw.get("payload", ""),
            "transcript":       [{"role":m.get("role","?"),"content":m.get("content","")} for m in raw.get("transcript",[])],
            "errors":           raw.get("errors", []),
            "duration_seconds": round(time.time()-start, 2),
        })
    succeeded = sum(1 for r in results if r["success"])
    summary   = {"total":len(results),"succeeded":succeeded,"blocked":len(results)-succeeded,"model_id":req.model_id}
    scan_id   = save_scan(model_id=req.model_id, provider=get_provider(req.model_id), summary=summary, results=results, duration=round(time.time()-scan_start,2))
    return {"scan_id": scan_id, "summary": summary, "results": results}

@app.get("/api/history")
def history(limit: int = 20):
    return {"history": get_history(limit)}

@app.get("/api/history/{scan_id}")
def scan_detail(scan_id: str):
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
