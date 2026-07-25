import { useState, useEffect, useRef } from "react";

const API = "http://localhost:8000/api";
const SEVERITY_COLOR = { CRITICAL: "#ff4444", HIGH: "#ff8800", MEDIUM: "#ffcc00", LOW: "#44ff88" };
const OWASP_LABEL = { LLM01: "LLM01 · Prompt Injection", LLM02: "LLM02 · Sensitive Info Disclosure", LLM06: "LLM06 · Excessive Agency" };
const LOG_COLORS = { info: "#666", success: "#44cc88", error: "#ff4444", breach: "#ff6600", blocked: "#44cc88" };

export default function App() {
  const [attacks, setAttacks] = useState([]);
  const [models, setModels] = useState(["llama3.2:1b"]);
  const [selectedModel, setSelectedModel] = useState("llama3.2:1b");
  const [selectedAttacks, setSelectedAttacks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [activeTranscript, setActiveTranscript] = useState(null);
  const [health, setHealth] = useState(null);
  const [log, setLog] = useState([]);
  const logRef = useRef(null);

  useEffect(() => { fetchHealth(); fetchAttacks(); fetchModels(); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  function addLog(msg, type = "info") {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [...prev, { ts, msg, type }]);
  }

  async function fetchHealth() {
    try {
      const r = await fetch(`${API}/health`);
      const d = await r.json();
      setHealth(d);
      addLog(d.ollama ? `Ollama connected — ${d.models?.length || 0} model(s) available` : `Ollama unreachable: ${d.error}`, d.ollama ? "success" : "error");
    } catch { setHealth({ status: "error", ollama: false }); addLog("Cannot reach backend — is FastAPI running on :8000?", "error"); }
  }

  async function fetchAttacks() {
    try {
      const r = await fetch(`${API}/attacks`);
      const d = await r.json();
      setAttacks(d.attacks || []);
      setSelectedAttacks(d.attacks.map((a) => a.id));
      addLog(`Loaded ${d.attacks.length} attack modules`);
    } catch { addLog("Failed to load attack modules", "error"); }
  }

  async function fetchModels() {
    try {
      const r = await fetch(`${API}/models`);
      const d = await r.json();
      if (d.models?.length) setModels(d.models);
    } catch {}
  }

  async function runScan() {
    if (!selectedAttacks.length) return;
    setScanning(true); setResults(null); setSummary(null); setActiveTranscript(null); setLog([]);
    addLog(`Starting scan — ${selectedAttacks.length} attack(s) on ${selectedModel}`);
    try {
      const r = await fetch(`${API}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attack_ids: selectedAttacks, model: selectedModel }),
      });
      const d = await r.json();
      setSummary(d.summary); setResults(d.results);
      d.results.forEach((res) => addLog(`${res.attack_name} → ${res.success ? "BREACHED" : "BLOCKED"} (${res.duration_seconds}s)`, res.success ? "breach" : "blocked"));
      addLog(`Scan complete — ${d.summary.succeeded}/${d.summary.total} attacks succeeded`, d.summary.succeeded > 0 ? "breach" : "success");
    } catch (e) { addLog(`Scan failed: ${e.message}`, "error"); }
    finally { setScanning(false); }
  }

  function toggleAttack(id) { setSelectedAttacks((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }
  function toggleAll() { setSelectedAttacks(selectedAttacks.length === attacks.length ? [] : attacks.map((a) => a.id)); }

  function downloadReport() {
    if (!results) return;
    const lines = ["# RedAgent — Scan Report", `Model: ${selectedModel}`, `Date: ${new Date().toISOString()}`, `Results: ${summary.succeeded}/${summary.total} attacks succeeded`, "", "---", ""];
    results.forEach((r) => {
      lines.push(`## ${r.attack_name}`, `- Status: ${r.success ? "BREACHED" : "BLOCKED"}`, `- OWASP: ${r.owasp}`, `- MITRE ATLAS: ${r.atlas}`, `- Severity: ${r.severity}`, `- Evidence: ${r.evidence_type}`, `- Turns: ${r.turns_taken}`, `- Duration: ${r.duration_seconds}s`, "", "### Tool Calls");
      r.tool_calls_made.length ? r.tool_calls_made.forEach((tc) => lines.push(`- ${tc.tool}(${JSON.stringify(tc.args)})`)) : lines.push("- None");
      lines.push("", "---", "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `redagent-report-${Date.now()}.md`; a.click();
  }

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.logo}>⬡ RedAgent</span>
          <span style={S.tagline}>AI Red Teaming Platform</span>
        </div>
        <div style={S.headerRight}>
          {health && (
            <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background: health.ollama ? "#44cc88" : "#ff4444", display:"inline-block" }} />
              <span style={{ color: health.ollama ? "#44cc88" : "#ff4444" }}>{health.ollama ? "Ollama connected" : "Ollama offline"}</span>
            </span>
          )}
        </div>
      </header>

      <div style={S.body}>
        <aside style={S.sidebar}>
          <div style={S.sectionTitle}>Target Model</div>
          <select style={S.select} value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <div style={{ ...S.sectionTitle, marginTop:20 }}>Attack Modules ({selectedAttacks.length}/{attacks.length})</div>
          <button style={S.btnGhost} onClick={toggleAll}>{selectedAttacks.length === attacks.length ? "Deselect all" : "Select all"}</button>
          <div style={{ marginTop:8 }}>
            {attacks.map((a) => (
              <div key={a.id} style={{ ...S.attackCard, borderColor: selectedAttacks.includes(a.id) ? SEVERITY_COLOR[a.severity] : "#222", background: selectedAttacks.includes(a.id) ? "#141414" : "#0d0d0d" }} onClick={() => toggleAttack(a.id)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <span style={{ fontSize:12, fontWeight:600, color:"#ccc", flex:1, marginRight:8 }}>{a.name}</span>
                  <input type="checkbox" checked={selectedAttacks.includes(a.id)} onChange={() => toggleAttack(a.id)} onClick={(e) => e.stopPropagation()} style={{ accentColor: SEVERITY_COLOR[a.severity] }} />
                </div>
                <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, background:"#334", color:"#889", borderRadius:3, padding:"2px 6px" }}>{OWASP_LABEL[a.owasp] || a.owasp}</span>
                  <span style={{ fontSize:10, background: SEVERITY_COLOR[a.severity]+"22", color: SEVERITY_COLOR[a.severity], borderRadius:3, padding:"2px 6px", fontWeight:600 }}>{a.severity}</span>
                </div>
              </div>
            ))}
          </div>

          <button style={{ ...S.btnPrimary, opacity: scanning || !selectedAttacks.length ? 0.5 : 1, cursor: scanning || !selectedAttacks.length ? "not-allowed" : "pointer", marginTop:16 }} onClick={runScan} disabled={scanning || !selectedAttacks.length}>
            {scanning ? "⟳  Scanning..." : "▶  Run Attack Scan"}
          </button>
          {results && <button style={{ ...S.btnGhost, marginTop:8 }} onClick={downloadReport}>↓  Download Report (.md)</button>}
        </aside>

        <main style={S.main}>
          {summary && (
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {[["Total", summary.total, "#888"], ["Breached", summary.succeeded, "#ff4444"], ["Blocked", summary.blocked, "#44cc88"], ["Model", summary.model, "#6688ff"]].map(([label, value, color]) => (
                <div key={label} style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"#111", border:"1px solid #222", borderRadius:8, padding:"10px 20px", minWidth:80 }}>
                  <span style={{ fontSize:20, fontWeight:800, color }}>{value}</span>
                  <span style={{ fontSize:10, color:"#555", marginTop:2 }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {results && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {results.map((r) => {
                const color = r.success ? "#ff4444" : "#44cc88";
                const isOpen = activeTranscript?.attack_id === r.attack_id;
                return (
                  <div key={r.attack_id} style={{ border:`1px solid ${color}44`, borderRadius:8, padding:16, background:"#0d0d0d" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#ddd", marginBottom:4 }}>{r.attack_name}</div>
                        <div style={{ fontSize:11, color:"#555", marginBottom:8 }}>{attacks.find((a) => a.id === r.attack_id)?.description}</div>
                      </div>
                      <div style={{ fontSize:11, fontWeight:800, color, background:`${color}18`, border:`1px solid ${color}44`, borderRadius:4, padding:"3px 10px", marginLeft:12, whiteSpace:"nowrap" }}>
                        {r.success ? "BREACHED" : "BLOCKED"}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                      {[[OWASP_LABEL[r.owasp]||r.owasp,"#334","#889"],[r.atlas,"#234","#889"],[r.severity, SEVERITY_COLOR[r.severity]+"22", SEVERITY_COLOR[r.severity]],[r.evidence_type+" evidence","#222","#889"],[r.turns_taken+" turns","#222","#889"],[r.duration_seconds+"s","#222","#889"]].map(([label, bg, tc]) => (
                        <span key={label} style={{ fontSize:10, background:bg, color:tc, borderRadius:3, padding:"2px 6px", fontWeight:600 }}>{label}</span>
                      ))}
                    </div>
                    {r.tool_calls_made.length > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>TOOL CALLS</div>
                        {r.tool_calls_made.map((tc, i) => (
                          <div key={i} style={{ fontSize:11, fontFamily:"monospace", background:"#111", border:"1px solid #1a1a1a", borderRadius:4, padding:"4px 10px", marginBottom:4 }}>
                            <span style={{ color:"#ff8800" }}>{tc.tool}</span>
                            <span style={{ color:"#666" }}>({Object.entries(tc.args).filter(([k]) => k !== "_note_content").map(([k,v]) => `${k}=${v}`).join(", ")})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.errors.length > 0 && <div style={{ fontSize:11, color:"#ff4444", marginBottom:8 }}>Errors: {r.errors.join(", ")}</div>}
                    <button style={S.btnGhost} onClick={() => setActiveTranscript(isOpen ? null : r)}>{isOpen ? "▲ Hide Transcript" : "▼ View Transcript"}</button>
                    {isOpen && (
                      <div style={{ background:"#0a0a0a", border:"1px solid #222", borderRadius:8, padding:16, marginTop:12, maxHeight:400, overflowY:"auto" }}>
                        {r.transcript.filter((m) => m.role !== "system").map((m, i) => (
                          <div key={i} style={{ marginBottom:12 }}>
                            <div style={{ fontSize:10, color:{user:"#6688ff",assistant:"#44cc88"}[m.role]||"#666", marginBottom:4, fontWeight:700 }}>{m.role.toUpperCase()}</div>
                            <div style={{ fontSize:11, color:"#bbb", background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:4, padding:"8px 12px", whiteSpace:"pre-wrap", fontFamily:"monospace" }}>{m.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!results && !scanning && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:60 }}>
              <div style={{ fontSize:48, color:"#222" }}>⬡</div>
              <div style={{ fontSize:16, color:"#444", fontWeight:700 }}>No scan run yet</div>
              <div style={{ fontSize:12, color:"#333" }}>Select attack modules and click Run Attack Scan</div>
            </div>
          )}

          {scanning && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:60 }}>
              <div style={{ fontSize:48, color:"#ff6600", animation:"spin 1.5s linear infinite" }}>⟳</div>
              <div style={{ fontSize:16, color:"#666", fontWeight:700 }}>Attacking target agent...</div>
              <div style={{ fontSize:12, color:"#444" }}>Running {selectedAttacks.length} attack(s) — this may take 1-2 minutes</div>
            </div>
          )}

          <div style={{ background:"#0a0a0a", border:"1px solid #181818", borderRadius:8, padding:16, marginTop:"auto" }}>
            <div style={{ fontSize:10, color:"#444", fontWeight:700, letterSpacing:1.5, marginBottom:8 }}>ACTIVITY LOG</div>
            <div style={{ maxHeight:140, overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }} ref={logRef}>
              {log.map((entry, i) => (
                <div key={i} style={{ fontSize:11, display:"flex", gap:10, fontFamily:"monospace", color: LOG_COLORS[entry.type]||"#888" }}>
                  <span style={{ color:"#333", minWidth:70 }}>{entry.ts}</span>{entry.msg}
                </div>
              ))}
              {log.length === 0 && <div style={{ color:"#333" }}>Waiting for activity...</div>}
            </div>
          </div>
        </main>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#111} ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}`}</style>
    </div>
  );
}

const S = {
  root: { fontFamily:"'JetBrains Mono','Fira Code',monospace", background:"#080808", color:"#ccc", minHeight:"100vh", display:"flex", flexDirection:"column" },
  header: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 24px", borderBottom:"1px solid #181818", background:"#0a0a0a" },
  headerLeft: { display:"flex", alignItems:"center", gap:12 },
  headerRight: { display:"flex", alignItems:"center", gap:16 },
  logo: { fontSize:18, fontWeight:800, color:"#ff6600", letterSpacing:"-0.5px" },
  tagline: { fontSize:11, color:"#444" },
  body: { display:"flex", flex:1, overflow:"hidden" },
  sidebar: { width:300, padding:20, borderRight:"1px solid #181818", background:"#090909", overflowY:"auto", display:"flex", flexDirection:"column" },
  main: { flex:1, padding:20, overflowY:"auto", display:"flex", flexDirection:"column", gap:16 },
  sectionTitle: { fontSize:10, fontWeight:700, color:"#555", letterSpacing:1.5, marginBottom:10, textTransform:"uppercase" },
  select: { width:"100%", background:"#111", border:"1px solid #222", color:"#ccc", borderRadius:6, padding:"8px 10px", fontSize:12, fontFamily:"inherit" },
  attackCard: { border:"1px solid #222", borderRadius:6, padding:"10px 12px", marginBottom:8, cursor:"pointer" },
  btnPrimary: { background:"#ff6600", color:"#fff", border:"none", borderRadius:6, padding:"12px 0", fontSize:13, fontWeight:700, cursor:"pointer", width:"100%", fontFamily:"inherit" },
  btnGhost: { background:"transparent", color:"#555", border:"1px solid #222", borderRadius:5, padding:"6px 12px", fontSize:11, cursor:"pointer", fontFamily:"inherit", width:"100%" },
};
