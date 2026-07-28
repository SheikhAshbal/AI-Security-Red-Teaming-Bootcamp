const API_BASE = "http://localhost:8000";

const targetGrid = document.getElementById("target-grid");
const runAllBtn = document.getElementById("run-all");
const statusEl = document.getElementById("status");
const resultsSection = document.getElementById("results");
const summaryTable = document.getElementById("summary-table");
const reconPanels = document.getElementById("reconstruction-panels");

async function loadTargets() {
  const res = await fetch(`${API_BASE}/targets`);
  const targets = await res.json();
  targetGrid.innerHTML = targets.map(t => `
    <div class="target-card">
      <div class="model">${t.model}</div>
      <span class="guard ${t.guard}">${t.guard} guard</span>
    </div>
  `).join("");
}

function renderCandidate(candidate, secretLength) {
  const chars = candidate.padEnd(secretLength, "_").split("");
  return chars.map(c =>
    c === "_"
      ? `<span class="unknown">_</span>`
      : `<span class="filled">${c}</span>`
  ).join("");
}

function renderSummaryRow(result, header = false) {
  if (header) {
    return `<div class="summary-row header">
      <div>Target</div><div>Guard</div><div>Recovered</div><div>Probes / entropy left</div>
    </div>`;
  }
  return `<div class="summary-row">
    <div>${result.model}</div>
    <div>${result.guard}</div>
    <div class="${result.secret_recovered ? 'recovered-yes' : 'recovered-no'}">
      ${result.secret_recovered ? 'YES — leaked' : 'no'}
    </div>
    <div>${result.probes_used} probes · ${result.final_entropy_bits} bits left</div>
  </div>`;
}

function renderReconPanel(result) {
  const secretLen = result.final_candidate.length || 9;
  const maxEntropy = Math.max(...result.entropy_curve.map(c => c.entropy_bits_remaining), 1);
  const lastEntropy = result.final_entropy_bits;
  const pct = Math.max(0, 100 - (lastEntropy / maxEntropy) * 100);

  const rawLog = (result.probe_log || []).map(p => `
    <div class="raw-row">
      <span class="raw-probe-id">${p.probe_id}</span>
      <span class="raw-text">${(p.raw_response || "").replace(/</g, "&lt;")}</span>
      <span class="raw-parsed">${JSON.stringify(p.parsed)}</span>
    </div>
  `).join("");

  const rhymeNote = result.rhyme_leaked
    ? `<div class="rhyme-badge">rhyme leak: model offered "${result.rhyme_word}" — shares the secret's ending sound</div>`
    : "";

  return `<div class="recon-panel">
    <div class="label">${result.model} · ${result.guard} guard</div>
    <div class="recon-candidate">${renderCandidate(result.final_candidate, secretLen)}</div>
    ${rhymeNote}
    <div class="entropy-bar-track"><div class="entropy-bar-fill" style="width:${pct}%"></div></div>
    <div class="entropy-label">${lastEntropy} bits of secret still unknown · ${result.probes_used} probes sent</div>
    <details class="raw-details">
      <summary>show raw probe responses</summary>
      ${rawLog}
    </details>
  </div>`;
}

async function runAll() {
  runAllBtn.disabled = true;
  statusEl.textContent = "running probes against all 4 targets — this takes ~30-60s...";
  resultsSection.hidden = false;
  summaryTable.innerHTML = renderSummaryRow(null, true);
  reconPanels.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/audit-all`, { method: "POST" });
    const results = await res.json();

    summaryTable.innerHTML = renderSummaryRow(null, true) +
      results.map(r => renderSummaryRow(r)).join("");
    reconPanels.innerHTML = results.map(renderReconPanel).join("");
    statusEl.textContent = `done — ${results.filter(r => r.secret_recovered).length}/${results.length} configs fully leaked`;
  } catch (e) {
    statusEl.textContent = `error: ${e.message} — is the backend running on :8000?`;
  } finally {
    runAllBtn.disabled = false;
  }
}

runAllBtn.addEventListener("click", runAll);
loadTargets().catch(() => {
  statusEl.textContent = "backend not reachable — start it with: uvicorn main:app --reload";
});
