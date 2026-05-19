// One terminal pane — wraps xterm.js + drives LinuxSim (or real WASM runtime)
// and collects Metrics as the container runs.

import { LinuxSim } from "./LinuxSim.js";
import { Metrics } from "./Metrics.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// WASM load simulation: show a realistic download progress bar.
// Actual bytes/s varies between 5–18 MB/s to feel realistic.
async function simulateDownload(fileMB, onProgress) {
  const totalMs = fileMB / (5 + Math.random() * 13) * 1000;
  const steps = 60;
  const stepMs = totalMs / steps;
  for (let i = 1; i <= steps; i++) {
    await sleep(stepMs * (0.8 + Math.random() * 0.4));
    onProgress(i / steps);
  }
}

// Stream text into xterm line-by-line with realistic inter-line delays.
async function streamLines(term, lines, { minMs = 18, maxMs = 80, charMode = false } = {}) {
  for (const line of lines) {
    if (charMode) {
      for (const ch of line) {
        term.write(ch);
        await sleep(2 + Math.random() * 5);
      }
    } else {
      term.write(line);
    }
    term.writeln("");
    await sleep(minMs + Math.random() * (maxMs - minMs));
  }
}

export class TerminalPane {
  constructor(distroId, { termEl, progressEl, progressFillEl, progressLabelEl, statusEl, paneMetricsEl }) {
    this.distroId = distroId;
    this.sim = new LinuxSim(distroId);
    this.metrics = new Metrics(distroId);

    this.termEl          = termEl;
    this.progressEl      = progressEl;
    this.progressFillEl  = progressFillEl;
    this.progressLabelEl = progressLabelEl;
    this.statusEl        = statusEl;
    this.paneMetricsEl   = paneMetricsEl;

    this.term       = null;
    this.inputLine  = "";
    this.interactive = false;
    this._inputEnabled = false;
    this._onBootDone   = null;
    this.state = "idle";   // idle | loading | booting | ready | benchmarking
  }

  setStatus(text, cls = "") {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = "status-indicator " + cls;
  }

  _initTerm() {
    if (this.term) return;
    this.term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      theme: {
        background: "#0d0d0d",
        foreground: "#c9d1d9",
        cursor:     "#58a6ff",
        green:      "#3fb950",
        red:        "#ff7b72",
        yellow:     "#d29922",
        blue:       "#58a6ff",
        cyan:       "#39c5cf",
        magenta:    "#bc8cff",
      },
      rows: 28,
    });
    this.term.open(this.termEl);
    this.term.onKey(({ key, domEvent }) => this._onKey(key, domEvent));
  }

  _onKey(key, ev) {
    if (!this._inputEnabled) return;
    const code = ev.keyCode;
    if (code === 13) {
      this.term.writeln("");
      const cmd = this.inputLine;
      this.inputLine = "";
      this._runCommand(cmd);
    } else if (code === 8) {
      if (this.inputLine.length > 0) {
        this.inputLine = this.inputLine.slice(0, -1);
        this.term.write("\b \b");
      }
    } else if (code === 67 && ev.ctrlKey) {
      this.inputLine = "";
      this.term.writeln("^C");
      this.term.write(this.sim.prompt);
    } else if (key && key.charCodeAt(0) >= 32) {
      this.inputLine += key;
      this.term.write(key);
    }
  }

  async _runCommand(cmd, label = null) {
    if (!cmd.trim()) {
      this.term.write(this.sim.prompt);
      return { latencyMs: 5, output: "" };
    }

    const t0 = performance.now();
    const result = this.sim.execute(cmd);

    // Simulate the emulator processing delay
    await sleep(result.latencyMs);

    const actualMs = Math.round(performance.now() - t0);
    this.metrics.recordCmd(label || cmd.split(" ")[0], actualMs);
    this.metrics.renderInto(this.paneMetricsEl);

    if (result.clear) {
      this.term.write(result.output);
    } else if (result.output) {
      await streamLines(this.term, result.output.split("\n"), { minMs: 8, maxMs: 40 });
    }

    this.term.write(this.sim.prompt);
    return { latencyMs: actualMs, output: result.output };
  }

  async start() {
    if (this.state !== "idle") return;
    this.state = "loading";

    this._initTerm();
    this.setStatus("⬤ loading", "loading");

    // --- Phase 1: WASM download ---
    this.progressEl.style.display = "flex";
    this.metrics.setWasmSize(this.sim.wasmMB);
    this.metrics.markLoadStart();

    const mb = this.sim.wasmMB;
    await simulateDownload(mb, (pct) => {
      this.progressFillEl.style.width = (pct * 100) + "%";
      this.progressLabelEl.textContent =
        `Downloading ${this.sim.distro.name} WASM — ${Math.round(pct * mb)} / ${mb} MB`;
    });
    this.metrics.markLoadEnd();
    this.progressLabelEl.textContent = "Initializing runtime…";
    await sleep(400);
    this.progressEl.style.display = "none";

    // --- Phase 2: Boot ---
    this.state = "booting";
    this.setStatus("⬤ booting", "booting");
    this.metrics.markBootStart();

    const bootLines = this.sim.bootLines();
    const bootMs    = this.sim.bootTimeMs();

    this.term.writeln("\x1b[32m[rootless-computing] container2wasm runtime v0.8 — emulation ready\x1b[0m");
    this.term.writeln("\x1b[2m" + "─".repeat(60) + "\x1b[0m");

    // Fast early kernel lines, slower systemd lines
    const kernel  = bootLines.slice(0, 10);
    const systemd = bootLines.slice(10);
    const kernelMs  = bootMs * 0.35;
    const systemdMs = bootMs * 0.65;

    await streamLines(this.term, kernel,  { minMs: kernelMs  / kernel.length  * 0.5, maxMs: kernelMs  / kernel.length  * 1.5 });
    await streamLines(this.term, systemd, { minMs: systemdMs / systemd.length * 0.5, maxMs: systemdMs / systemd.length * 1.5 });

    this.metrics.markBootEnd();
    this.metrics.setRam(this.sim.ramMB());
    this.metrics.renderInto(this.paneMetricsEl);

    this.state = "ready";
    this.setStatus("⬤ ready", "ready");
    this.term.write(this.sim.prompt);
    this._inputEnabled = true;
  }

  // Run the automated benchmark suite and return per-step results
  async runBenchmark(steps) {
    if (this.state !== "ready") return [];
    this.state = "benchmarking";
    this._inputEnabled = false;
    this.setStatus("⬤ benchmarking", "bench");

    const results = [];
    for (const step of steps) {
      this.term.writeln("");
      // Echo the command in blue to mark it as automated
      this.term.write("\x1b[34m" + this.sim.prompt + step.cmd + "\x1b[0m");
      this.term.writeln("");
      const t0 = performance.now();
      await this._runCommand(step.cmd, step.label);
      // _runCommand already records to metrics; we just capture wall-clock time here
      results.push({ label: step.label, cmd: step.cmd, latencyMs: Math.round(performance.now() - t0) });
      await sleep(200);
    }

    this.state = "ready";
    this._inputEnabled = true;
    this.setStatus("⬤ ready", "ready");
    return results;
  }

  // Return collected metrics snapshot
  getMetrics() { return this.metrics.summary(); }

  reset() {
    this.state = "idle";
    this.inputLine = "";
    this._inputEnabled = false;
    if (this.term) {
      this.term.dispose();
      this.term = null;
    }
    this.metrics.reset();
    this.setStatus("⬤ idle", "");
  }

  enterFullscreen() {
    const wrap = this.termEl.closest(".pane");
    if (!wrap) return;
    if (!document.fullscreenElement) {
      wrap.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}
