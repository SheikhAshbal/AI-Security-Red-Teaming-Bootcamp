import sqlite3, json, uuid, time
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "redagent.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id         TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                model_id   TEXT NOT NULL,
                provider   TEXT NOT NULL,
                total      INTEGER,
                succeeded  INTEGER,
                blocked    INTEGER,
                results    TEXT,
                duration_s REAL
            )
        """)
        conn.commit()

def save_scan(model_id, provider, summary, results, duration) -> str:
    scan_id = str(uuid.uuid4())[:8]
    with get_conn() as conn:
        conn.execute("INSERT INTO scans VALUES (?,?,?,?,?,?,?,?,?)", (
            scan_id, int(time.time()), model_id, provider,
            summary["total"], summary["succeeded"], summary["blocked"],
            json.dumps(results), duration,
        ))
        conn.commit()
    return scan_id

def get_history(limit=20) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id,created_at,model_id,provider,total,succeeded,blocked,duration_s "
            "FROM scans ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]

def get_scan(scan_id) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM scans WHERE id=?", (scan_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["results"] = json.loads(d["results"])
    return d
