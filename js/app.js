// Main application controller
import { TerminalPane }    from "./TerminalPane.js";
import { BENCHMARK_STEPS } from "./LinuxSim.js";
import { diffOutputs }     from "./DiffEngine.js";
import { LearningCards }   from "./LearningCards.js";
import { isCacheEnabled, setCacheEnabled, clearCache } from "./WasmCache.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── State ─────────────────────────────────────────────────────────────────────
let panes = {};
const learningCards = new LearningCards();

// ── DOM refs ──────────────────────────────────────────────────────────────────
const hero     = document.getElementById("hero");
const lab      = document.getElementById("lab");
const grid     = document.getElementById("terminal-grid");
const perfPanel  = document.getElementById("perf-panel");
const syncBar    = document.getElementById("sync-bar");
const syncInput  = document.getElementById("sync-input");
const syncResult = document.getElementById("sync-result");
const learnPanel = document.getElementById("learn-panel");
const learnCards = document.getElementById("learn-cards-container");
const cardsCountEl = document.getElementById("cards-count");

function paneRefs(id) {
  return {
    termEl:          document.getElementById(`terminal-${id}`),
    progressEl:      document.getElementById(`progress-${id}`),
    progressFillEl:  document.getElementById(`progress-fill-${id}`),
    progressLabelEl: document.getElementById(`progress-label-${id}`),
    statusEl:        document.getElementById(`status-${id}`),
    paneMetricsEl:   document.getElementById(`pane-metrics-${id}`),
  };
}

// ── Pane management ───────────────────────────────────────────────────────────
function createPane(id) {
  if (panes[id]) return;
  panes[id] = new TerminalPane(id, paneRefs(id));
}

function showLab(which) {
  hero.classList.add("hidden");
  lab.classList.remove("hidden");

  ["debian", "fedora"].forEach((id) => {
    const el = document.getElementById(`pane-${id}`);
    if (!el) return;
    const show = which === "both" || which === id;
    el.classList.toggle("hidden", !show);
    el.classList.toggle("visible", show);
  });

  grid.classList.toggle("two-up", which === "both");
  grid.classList.toggle("one-up", which !== "both");

  // Show sync bar only when both panes are visible
  syncBar.classList.toggle("hidden", which !== "both");
}

async function startPane(id) {
  createPane(id);
  await panes[id].start();
}

// ── Hero buttons ──────────────────────────────────────────────────────────────
document.getElementById("btn-debian").addEventListener("click", async () => {
  showLab("debian");
  await startPane("debian");
});
document.getElementById("btn-fedora").addEventListener("click", async () => {
  showLab("fedora");
  await startPane("fedora");
});
document.getElementById("btn-both").addEventListener("click", async () => {
  showLab("both");
  await Promise.all([startPane("debian"), startPane("fedora")]);
});

// ── Lab header buttons ────────────────────────────────────────────────────────
document.getElementById("btn-benchmark").addEventListener("click",   runBenchmark);
document.getElementById("btn-show-perf").addEventListener("click",  togglePerfPanel);
document.getElementById("btn-reset").addEventListener("click",      resetAll);
document.getElementById("btn-show-learn").addEventListener("click", toggleLearnPanel);

// Fullscreen
document.getElementById("fullscreen-debian").addEventListener("click", () => panes.debian?.enterFullscreen());
document.getElementById("fullscreen-fedora").addEventListener("click", () => panes.fedora?.enterFullscreen());

// ── Cache controls ────────────────────────────────────────────────────────────
const cacheToggle = document.getElementById("cache-toggle");
if (cacheToggle) {
  cacheToggle.checked = isCacheEnabled();
  cacheToggle.addEventListener("change", () => {
    setCacheEnabled(cacheToggle.checked);
  });
}
document.getElementById("btn-clear-cache")?.addEventListener("click", async () => {
  await clearCache();
  showToast("WASM cache cleared — next start will re-download");
});

// ── Sync command bar ──────────────────────────────────────────────────────────
document.getElementById("sync-both")?.addEventListener("click",   () => runSync("both"));
document.getElementById("sync-debian")?.addEventListener("click", () => runSync("debian"));
document.getElementById("sync-fedora")?.addEventListener("click", () => runSync("fedora"));

syncInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSync("both");
});

async function runSync(target) {
  const cmd = syncInput?.value?.trim();
  if (!cmd) return;

  const runDebian = (target === "both" || target === "debian") && panes.debian?.state === "ready";
  const runFedora = (target === "both" || target === "fedora") && panes.fedora?.state === "ready";

  if (!runDebian && !runFedora) {
    showSyncResult({ type: "info", html: `<em>Start a terminal first</em>` });
    return;
  }

  syncResult.classList.remove("hidden");
  showSyncResult({ type: "info", html: `<span class="spin">⟳</span> Running <code>${escHtml(cmd)}</code>…` });

  const [dRes, fRes] = await Promise.all([
    runDebian ? panes.debian.runCommand(cmd) : Promise.resolve(null),
    runFedora ? panes.fedora.runCommand(cmd) : Promise.resolve(null),
  ]);

  if (runDebian && runFedora) {
    const diff = diffOutputs(cmd, dRes?.output ?? "", fRes?.output ?? "");
    renderDiff(diff);

    if (diff.type !== "same") {
      const status = learningCards.addDiscovered(diff);
      updateCardsCount();
      if (status === "added") showToast("📚 Added to learning cards");
    }
  } else if (runDebian) {
    showSyncResult({ type: "single", html: buildSingleResult("debian", cmd, dRes?.output) });
  } else {
    showSyncResult({ type: "single", html: buildSingleResult("fedora", cmd, fRes?.output) });
  }
}

function renderDiff(diff) {
  const typeClass = { same: "same", "both-failed": "error", "debian-only": "partial", "fedora-only": "partial", different: "diff" }[diff.type] ?? "diff";
  showSyncResult({
    type: typeClass,
    html: `
      <div class="diff-label ${diff.type}">${diff.label}</div>
      <div class="diff-cols">
        <div class="diff-col debian">
          <span class="diff-distro">🐧 Debian</span>
          <pre class="diff-out ${diff.debianError ? "err" : ""}">${escHtml(diff.debianFull || diff.debianSnippet)}</pre>
        </div>
        <div class="diff-col fedora">
          <span class="diff-distro">🎩 Fedora</span>
          <pre class="diff-out ${diff.fedoraError ? "err" : ""}">${escHtml(diff.fedoraFull || diff.fedoraSnippet)}</pre>
        </div>
      </div>
      ${diff.type !== "same" ? `<button class="btn-save-card" onclick="window._saveCard?.()">📚 Save to cards</button>` : ""}`,
  });
  // Expose save button handler
  window._saveCard = () => {
    learningCards.addDiscovered(diff);
    updateCardsCount();
    showToast("📚 Saved to learning cards");
  };
}

function buildSingleResult(distroId, cmd, output) {
  const icon = distroId === "debian" ? "🐧" : "🎩";
  return `<div class="diff-col ${distroId}">
    <span class="diff-distro">${icon} ${distroId === "debian" ? "Debian" : "Fedora"}</span>
    <pre class="diff-out">${escHtml(output ?? "")}</pre>
  </div>`;
}

function showSyncResult({ type, html }) {
  syncResult.className = `sync-result ${type}`;
  syncResult.innerHTML = html;
}

// ── Benchmark ─────────────────────────────────────────────────────────────────
async function runBenchmark() {
  const btn = document.getElementById("btn-benchmark");
  btn.disabled = true;
  btn.textContent = "⏳ Running…";

  const tasks = [];
  if (panes.debian?.state === "ready")
    tasks.push(panes.debian.runBenchmark(BENCHMARK_STEPS.debian).then((r) => ({ id: "debian", results: r })));
  if (panes.fedora?.state === "ready")
    tasks.push(panes.fedora.runBenchmark(BENCHMARK_STEPS.fedora).then((r) => ({ id: "fedora", results: r })));

  if (!tasks.length) { btn.disabled = false; btn.textContent = "⚡ Run Benchmark"; return; }

  await Promise.all(tasks);
  await sleep(400);

  btn.disabled = false;
  btn.textContent = "⚡ Run Benchmark";
  renderPerfPanel();
  showPerfPanel(true);
}

// ── Performance panel ──────────────────────────────────────────────────────────
function togglePerfPanel() {
  const vis = !perfPanel.classList.contains("hidden");
  if (vis) { showPerfPanel(false); } else { renderPerfPanel(); showPerfPanel(true); }
}
function showPerfPanel(show) {
  perfPanel.classList.toggle("hidden", !show);
  document.getElementById("btn-show-perf").textContent = show ? "📊 Hide Perf" : "📊 Performance";
}

function renderPerfPanel() {
  const d = panes.debian?.getMetrics();
  const f = panes.fedora?.getMetrics();

  const fmt = (v, unit) => v == null ? "—" : Math.round(v) + " " + unit;
  const winner = (a, b) => {
    if (a == null || b == null) return ["", ""];
    return a <= b ? ["win", ""] : ["", "win"];
  };

  const rows = [
    { metric: "WASM file size",          d: fmt(d?.wasmSizeMB,"MB"),  f: fmt(f?.wasmSizeMB,"MB"),  w: winner(d?.wasmSizeMB, f?.wasmSizeMB) },
    { metric: "First load (download+init)", d: fmt(d?.firstLoadMs,"ms"), f: fmt(f?.firstLoadMs,"ms"), w: winner(d?.firstLoadMs, f?.firstLoadMs) },
    { metric: "Boot time",               d: fmt(d?.bootMs,"ms"),      f: fmt(f?.bootMs,"ms"),      w: winner(d?.bootMs, f?.bootMs) },
    { metric: "RAM usage",               d: fmt(d?.ramMB,"MB"),       f: fmt(f?.ramMB,"MB"),       w: winner(d?.ramMB, f?.ramMB) },
    { metric: "Avg command latency",     d: fmt(d?.avgLatencyMs,"ms"),f: fmt(f?.avgLatencyMs,"ms"),w: winner(d?.avgLatencyMs, f?.avgLatencyMs) },
    { metric: "Pkg manager (install curl)", d: fmt(d?.pkgLatencyMs,"ms"),f: fmt(f?.pkgLatencyMs,"ms"),w: winner(d?.pkgLatencyMs, f?.pkgLatencyMs) },
  ];

  document.getElementById("results-body").innerHTML = rows.map((r) => `
    <tr>
      <td>${r.metric}</td>
      <td class="${r.w[0]}">${r.d}</td>
      <td class="${r.w[1]}">${r.f}</td>
      <td>${r.w[0]==="win"?"🐧 Debian":r.w[1]==="win"?"🎩 Fedora":"—"}</td>
    </tr>`).join("");

  renderCharts(d, f);
}

function renderCharts(d, f) {
  if (typeof Chart === "undefined") return;
  const makeBar = (id, label, vals, colors) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: "bar",
      data: { labels: ["Debian 12","Fedora 41"], datasets: [{ label, data: vals.map(v => v ?? 0), backgroundColor: colors, borderRadius: 4 }] },
      options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: label, color: "#8b949e" } }, scales: { x: { ticks: { color: "#8b949e" }, grid: { color: "#21262d" } }, y: { ticks: { color: "#8b949e" }, grid: { color: "#21262d" }, beginAtZero: true } } },
    });
  };
  makeBar("chart-boot",    "Boot time (ms)",       [d?.bootMs, f?.bootMs],               ["#58a6ff88","#d29922aa"]);
  makeBar("chart-latency", "Avg cmd latency (ms)", [d?.avgLatencyMs, f?.avgLatencyMs],   ["#3fb95088","#ff7b7288"]);
  makeBar("chart-ram",     "RAM usage (MB)",       [d?.ramMB, f?.ramMB],                 ["#bc8cff88","#39c5cf88"]);
}

// ── Learning panel ────────────────────────────────────────────────────────────
function toggleLearnPanel() {
  const vis = !learnPanel.classList.contains("hidden");
  showLearnPanel(!vis);
}
function showLearnPanel(show) {
  learnPanel.classList.toggle("hidden", !show);
  document.getElementById("btn-show-learn").textContent = show
    ? `📚 Hide Cards`
    : `📚 Cards (${learningCards.count + learningCards.seedCount})`;
  if (show) learningCards.renderInto(learnCards);
}

function updateCardsCount() {
  const total = learningCards.count + learningCards.seedCount;
  cardsCountEl.textContent = total + " cards";
  document.getElementById("btn-show-learn").textContent =
    learnPanel.classList.contains("hidden")
      ? `📚 Cards (${total})`
      : `📚 Hide Cards`;
  learningCards.renderInto(learnCards);
}

document.getElementById("btn-export-learn")?.addEventListener("click", () => learningCards.exportJSON());
document.getElementById("btn-clear-learn")?.addEventListener("click", () => {
  learningCards.clearDiscovered();
  updateCardsCount();
  showToast("Discovered cards cleared (seed cards kept)");
});
document.getElementById("btn-close-learn")?.addEventListener("click", () => showLearnPanel(false));

// Initialise count on load
updateCardsCount();

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3000);
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetAll() {
  Object.values(panes).forEach((p) => p.reset());
  panes = {};
  showPerfPanel(false);
  showLearnPanel(false);
  syncBar.classList.add("hidden");
  syncResult.classList.add("hidden");
  lab.classList.add("hidden");
  hero.classList.remove("hidden");
}

// ── Fullscreen resize ──────────────────────────────────────────────────────────
document.addEventListener("fullscreenchange", () => {
  setTimeout(() => Object.values(panes).forEach((p) => p.term?.refresh(0, p.term.rows - 1)), 100);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
