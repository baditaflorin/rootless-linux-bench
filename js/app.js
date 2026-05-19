// Main application controller
// Manages two TerminalPane instances and the comparison/results UI.

import { TerminalPane }        from "./TerminalPane.js";
import { BENCHMARK_STEPS }     from "./LinuxSim.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── DOM refs ──────────────────────────────────────────────────────────────────
const hero    = document.getElementById("hero");
const lab     = document.getElementById("lab");
const grid    = document.getElementById("terminal-grid");
const perfPanel = document.getElementById("perf-panel");

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

// ── Panes ──────────────────────────────────────────────────────────────────────
let panes = {};

function createPane(id) {
  if (panes[id]) return;
  panes[id] = new TerminalPane(id, paneRefs(id));
}

function showLab(which) {
  hero.classList.add("hidden");
  hero.classList.remove("active");
  lab.classList.remove("hidden");
  lab.classList.add("active");

  // Show/hide individual panes
  ["debian", "fedora"].forEach((id) => {
    const el = document.getElementById(`pane-${id}`);
    if (!el) return;
    if (which === "both" || which === id) {
      el.classList.remove("hidden");
      el.classList.add("visible");
    } else {
      el.classList.add("hidden");
      el.classList.remove("visible");
    }
  });

  // Adjust grid columns
  if (which === "both") {
    grid.classList.add("two-up");
    grid.classList.remove("one-up");
  } else {
    grid.classList.add("one-up");
    grid.classList.remove("two-up");
  }
}

async function startPane(id) {
  createPane(id);
  await panes[id].start();
}

// ── Button wiring ──────────────────────────────────────────────────────────────
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
  // Start both in parallel
  await Promise.all([startPane("debian"), startPane("fedora")]);
});

document.getElementById("btn-benchmark").addEventListener("click", runBenchmark);
document.getElementById("btn-show-perf").addEventListener("click", togglePerfPanel);
document.getElementById("btn-reset").addEventListener("click", resetAll);

document.getElementById("fullscreen-debian").addEventListener("click", () => {
  panes.debian?.enterFullscreen();
});
document.getElementById("fullscreen-fedora").addEventListener("click", () => {
  panes.fedora?.enterFullscreen();
});

// ── Benchmark ─────────────────────────────────────────────────────────────────
async function runBenchmark() {
  const btn = document.getElementById("btn-benchmark");
  btn.disabled = true;
  btn.textContent = "⏳ Running…";

  const tasks = [];
  if (panes.debian?.state === "ready") {
    tasks.push(panes.debian.runBenchmark(BENCHMARK_STEPS.debian).then((r) => ({ id: "debian", results: r })));
  }
  if (panes.fedora?.state === "ready") {
    tasks.push(panes.fedora.runBenchmark(BENCHMARK_STEPS.fedora).then((r) => ({ id: "fedora", results: r })));
  }

  if (!tasks.length) {
    btn.disabled = false;
    btn.textContent = "⚡ Run Benchmark";
    return;
  }

  const all = await Promise.all(tasks);
  await sleep(500);

  btn.disabled = false;
  btn.textContent = "⚡ Run Benchmark";

  // Automatically show performance panel after benchmark
  renderPerfPanel();
  showPerfPanel(true);
}

// ── Performance panel ──────────────────────────────────────────────────────────
function togglePerfPanel() {
  const visible = !perfPanel.classList.contains("hidden");
  if (visible) {
    showPerfPanel(false);
  } else {
    renderPerfPanel();
    showPerfPanel(true);
  }
}

function showPerfPanel(show) {
  perfPanel.classList.toggle("hidden", !show);
  document.getElementById("btn-show-perf").textContent = show ? "📊 Hide Performance" : "📊 Performance";
}

function renderPerfPanel() {
  const d = panes.debian?.getMetrics();
  const f = panes.fedora?.getMetrics();

  const fmt = (v, unit, decimals = 0) =>
    v == null ? "—" : (decimals ? v.toFixed(decimals) : Math.round(v)) + " " + unit;

  const winner = (a, b, lowerIsBetter = true) => {
    if (a == null || b == null) return ["—", "—"];
    if (lowerIsBetter) return a <= b ? ["win", ""] : ["", "win"];
    return a >= b ? ["win", ""] : ["", "win"];
  };

  const rows = [
    {
      metric: "WASM file size",
      d: fmt(d?.wasmSizeMB, "MB"),
      f: fmt(f?.wasmSizeMB, "MB"),
      w: winner(d?.wasmSizeMB, f?.wasmSizeMB),
    },
    {
      metric: "First load (download+init)",
      d: fmt(d?.firstLoadMs, "ms"),
      f: fmt(f?.firstLoadMs, "ms"),
      w: winner(d?.firstLoadMs, f?.firstLoadMs),
    },
    {
      metric: "Boot time",
      d: fmt(d?.bootMs, "ms"),
      f: fmt(f?.bootMs, "ms"),
      w: winner(d?.bootMs, f?.bootMs),
    },
    {
      metric: "RAM usage",
      d: fmt(d?.ramMB, "MB"),
      f: fmt(f?.ramMB, "MB"),
      w: winner(d?.ramMB, f?.ramMB),
    },
    {
      metric: "Avg command latency",
      d: fmt(d?.avgLatencyMs, "ms"),
      f: fmt(f?.avgLatencyMs, "ms"),
      w: winner(d?.avgLatencyMs, f?.avgLatencyMs),
    },
    {
      metric: "Pkg manager (install curl)",
      d: fmt(d?.pkgLatencyMs, "ms"),
      f: fmt(f?.pkgLatencyMs, "ms"),
      w: winner(d?.pkgLatencyMs, f?.pkgLatencyMs),
    },
  ];

  const tbody = document.getElementById("results-body");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${r.metric}</td>
        <td class="${r.w[0]}">${r.d}</td>
        <td class="${r.w[1]}">${r.f}</td>
        <td>${r.w[0] === "win" ? "🐧 Debian" : r.w[1] === "win" ? "🎩 Fedora" : "—"}</td>
      </tr>`
    )
    .join("");

  renderCharts(d, f);
}

function renderCharts(d, f) {
  const makeBar = (canvasId, label, vals, colors) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas._chart) canvas._chart.destroy();

    // Use Chart.js if available, else skip
    if (typeof Chart === "undefined") return;

    canvas._chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Debian 12", "Fedora 41"],
        datasets: [{
          label,
          data: vals.map((v) => v ?? 0),
          backgroundColor: colors,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: label, color: "#8b949e" },
        },
        scales: {
          x: { ticks: { color: "#8b949e" }, grid: { color: "#21262d" } },
          y: { ticks: { color: "#8b949e" }, grid: { color: "#21262d" }, beginAtZero: true },
        },
      },
    });
  };

  makeBar("chart-boot",    "Boot time (ms)",           [d?.bootMs,        f?.bootMs],        ["#58a6ff88", "#d29922aa"]);
  makeBar("chart-latency", "Avg cmd latency (ms)",     [d?.avgLatencyMs,  f?.avgLatencyMs],  ["#3fb95088", "#ff7b7288"]);
  makeBar("chart-ram",     "RAM usage (MB)",            [d?.ramMB,         f?.ramMB],         ["#bc8cff88", "#39c5cf88"]);
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetAll() {
  Object.values(panes).forEach((p) => p.reset());
  panes = {};
  showPerfPanel(false);

  lab.classList.add("hidden");
  lab.classList.remove("active");
  hero.classList.remove("hidden");
  hero.classList.add("active");
}

// ── Fullscreen change: resize terminal ─────────────────────────────────────────
document.addEventListener("fullscreenchange", () => {
  // Give the terminal a tick to measure its new container size
  setTimeout(() => {
    Object.values(panes).forEach((p) => p.term?.refresh(0, p.term.rows - 1));
  }, 100);
});
