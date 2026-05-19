// Performance metrics tracker for a single container pane.
// Collects load time, boot time, RAM, and per-command latencies.

export class Metrics {
  constructor(distroId) {
    this.id = distroId;
    this.reset();
  }

  reset() {
    this.wasmSizeMB   = null;
    this.loadStartMs  = null;
    this.loadEndMs    = null;
    this.bootStartMs  = null;
    this.bootEndMs    = null;
    this.ramMB        = null;
    this.cmdLatencies = [];  // array of { label, ms }
    this.pkgLatencyMs = null;
  }

  markLoadStart()      { this.loadStartMs  = performance.now(); }
  markLoadEnd()        { this.loadEndMs    = performance.now(); }
  markBootStart()      { this.bootStartMs  = performance.now(); }
  markBootEnd()        { this.bootEndMs    = performance.now(); }
  setRam(mb)           { this.ramMB        = mb; }
  setWasmSize(mb)      { this.wasmSizeMB   = mb; }

  recordCmd(label, ms) {
    this.cmdLatencies.push({ label, ms });
    if (label === "pkg install" || label === "pkg update") {
      this.pkgLatencyMs = ms;
    }
  }

  get firstLoadMs() {
    if (this.loadStartMs == null || this.loadEndMs == null) return null;
    return Math.round(this.loadEndMs - this.loadStartMs);
  }

  get bootMs() {
    if (this.bootStartMs == null || this.bootEndMs == null) return null;
    return Math.round(this.bootEndMs - this.bootStartMs);
  }

  get avgCmdLatencyMs() {
    if (!this.cmdLatencies.length) return null;
    const sum = this.cmdLatencies.reduce((a, c) => a + c.ms, 0);
    return Math.round(sum / this.cmdLatencies.length);
  }

  get p95CmdLatencyMs() {
    if (!this.cmdLatencies.length) return null;
    const sorted = [...this.cmdLatencies].map(c => c.ms).sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  summary() {
    return {
      wasmSizeMB:    this.wasmSizeMB,
      firstLoadMs:   this.firstLoadMs,
      bootMs:        this.bootMs,
      ramMB:         this.ramMB,
      avgLatencyMs:  this.avgCmdLatencyMs,
      p95LatencyMs:  this.p95CmdLatencyMs,
      pkgLatencyMs:  this.pkgLatencyMs,
      cmdLatencies:  this.cmdLatencies,
    };
  }

  // Update the live status bar chips in a pane
  renderInto(paneEl) {
    if (!paneEl) return;
    const set = (id, val) => {
      const el = paneEl.querySelector(`[data-metric="${id}"]`);
      if (el && val != null) el.textContent = val;
    };
    if (this.bootMs != null)           set("boot",    `boot ${(this.bootMs/1000).toFixed(1)}s`);
    if (this.ramMB != null)            set("ram",     `RAM ${this.ramMB} MB`);
    if (this.avgCmdLatencyMs != null)  set("latency", `cmd ${this.avgCmdLatencyMs} ms`);
  }
}
