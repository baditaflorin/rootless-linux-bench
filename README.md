# rootless-linux-bench

Run **Debian 12** and **Fedora 41** side-by-side in the browser via WebAssembly.  
Measures WASM size, first load, boot time, RAM, command latency, and package manager usability.

Part of the [rootless-computing](https://github.com/baditaflorin/rootless-computing) paradigm —
software with no origin server, no root, running entirely in the browser.

**Live demo →** https://baditaflorin.github.io/rootless-linux-bench/

---

## What it does

| Feature | Detail |
|---|---|
| Two distros side-by-side | Debian 12 (bookworm) + Fedora 41 |
| Real terminal emulation | xterm.js 5.3 — fully interactive shell |
| Simulated WASM mode | Works instantly, no build step needed |
| Real WASM mode | Drop `wasm/debian.wasm` + `wasm/fedora.wasm` and reload |
| Automated benchmark | `⚡ Run Benchmark` auto-runs 7 commands per distro |
| Comparison charts | Boot / latency / RAM bar charts via Chart.js |
| Fullscreen | `⛶` button on each pane |
| COOP/COEP | Service worker injects headers for SharedArrayBuffer |

## Quick start (simulation mode)

```bash
git clone https://github.com/baditaflorin/rootless-linux-bench
cd rootless-linux-bench
python3 -m http.server 8080
# open http://localhost:8080
```

No build step. The page opens instantly in simulation mode.

## Build real WASM files

```bash
# Install container2wasm:
go install github.com/ktock/container2wasm/cmd/c2w@latest

cd build && bash build.sh
# → wasm/debian.wasm (~247 MB)
# → wasm/fedora.wasm (~312 MB)
```

After building, reload the page — it auto-detects the files and switches to real mode.

> **GitHub Pages + large files**: commit via `git lfs track "wasm/*.wasm"` or host on R2/S3
> and set `WASM_DEBIAN_URL` / `WASM_FEDORA_URL` URL params.

## Metrics measured

| Metric | Method |
|---|---|
| WASM size | Known from build, shown in UI |
| First load (download + init) | `performance.now()` click → runtime ready |
| Boot time | Runtime ready → shell prompt detected |
| RAM | `performance.memory.usedJSHeapSize` delta (Chromium) |
| Command latency | `performance.now()` Enter → prompt reappears |
| Pkg manager usability | Time for `apt-get install curl` / `dnf install curl` |

## Stack

- [container2wasm](https://github.com/ktock/container2wasm) — container → WASM converter
- [xterm.js](https://xtermjs.org/) — terminal emulator
- [Chart.js](https://www.chartjs.org/) — comparison charts
- Zero build tools — pure ES modules, works on GitHub Pages

## Deploy to GitHub Pages

```bash
git init
git remote add origin https://github.com/baditaflorin/rootless-linux-bench.git
git add .
git commit -m "initial rootless-linux-bench"
git push -u origin main
# GitHub → Settings → Pages → Branch: main / root
```
