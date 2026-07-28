from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from targets import TARGET_CONFIGS
from runner import run_target, run_all_targets

app = FastAPI(title="DecompAudit", description="Decomposition-leak evaluation harness for LLM secret protection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/targets")
def list_targets():
    return [{"id": c["id"], "model": c["model"], "guard": c["guard"]} for c in TARGET_CONFIGS]


@app.post("/audit/{target_id}")
def audit_target(target_id: str):
    ids = [c["id"] for c in TARGET_CONFIGS]
    if target_id not in ids:
        raise HTTPException(404, f"unknown target_id, choose from {ids}")
    return run_target(target_id)


@app.post("/audit-all")
def audit_all():
    return run_all_targets()
