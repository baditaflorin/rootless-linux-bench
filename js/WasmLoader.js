// Real WASM runtime loader using c2w (container2wasm) output files.
// Falls back gracefully to simulation mode if WASM files are unavailable.
//
// File layout (repo):
//   wasm/out.js          — shared Emscripten/QEMU JS wrapper
//   wasm/arg-module.js   — shared QEMU launch arguments
//   wasm/debian-load.js  — per-distro data-file loader
//   wasm/fedora-load.js  — per-distro data-file loader
//
// Large binaries (GitHub Releases v1.0-wasm):
//   qemu.wasm            — 39 MB  shared QEMU binary
//   debian.data          — 59 MB  Debian 12 rootfs
//   fedora.data          — 104 MB Fedora 41 rootfs

const RELEASE_BASE =
  "https://github.com/baditaflorin/rootless-linux-bench/releases/download/v1.0-wasm";

const DATA_FILES = {
  debian: "debian.data",
  fedora: "fedora.data",
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// Returns true if the page was served with the COOP/COEP headers that
// enable SharedArrayBuffer (required by QEMU pthreads).
export function isIsolated() {
  return typeof SharedArrayBuffer !== "undefined" &&
    window.crossOriginIsolated === true;
}

// Probe the GitHub Release to see if the WASM assets are actually hosted.
// Sends a HEAD request; resolves true if the server returns 200.
export async function isWasmAvailable() {
  try {
    const r = await fetch(`${RELEASE_BASE}/qemu.wasm`, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

// Load and start the real WASM runtime for the given distro.
//
// term     — xterm.js Terminal instance (already opened in DOM)
// distroId — "debian" | "fedora"
// onData   — callback(data: string) called with each chunk written to stdout
// onReady  — callback() called when the QEMU console is ready for input
//
// Returns a PTY handle with { write(data), dispose() }.
export async function startWasmRuntime(distroId, term, { onProgress } = {}) {
  if (!isIsolated()) {
    throw new Error(
      "Cross-Origin Isolation not active — reload the page after the service worker installs"
    );
  }

  // xterm-pty bridges xterm.js and the QEMU PTY device
  // https://github.com/mame/xterm-pty
  if (!window.XtermPty) {
    await loadScript(
      "https://cdn.jsdelivr.net/npm/@mame/xterm-pty@0.10.1/browser/xterm-pty.js"
    );
  }
  const { Pty } = window.XtermPty;
  const pty = new Pty(term);

  // Configure the Emscripten Module BEFORE loading the scripts that reference it
  window.Module = Object.assign(window.Module || {}, {
    pty,
    // Redirect .wasm and .data fetches to GitHub Releases
    locateFile(path) {
      if (path === "qemu-system-x86_64.wasm")
        return `${RELEASE_BASE}/qemu.wasm`;
      if (path === "qemu-system-x86_64.data")
        return `${RELEASE_BASE}/${DATA_FILES[distroId]}`;
      return path;
    },
    // Wire download progress to the caller
    onRuntimeInitialized() {
      onProgress?.(1);
    },
    setStatus(text) {
      if (text && text.includes("/")) {
        const m = text.match(/(\d+)\/(\d+)/);
        if (m) onProgress?.(parseInt(m[1]) / parseInt(m[2]));
      }
    },
  });

  // Load per-distro data-file metadata
  await loadScript(`/wasm/${distroId}-load.js`);

  // Load shared QEMU arguments
  await loadScript("/wasm/arg-module.js");

  // Load + start the Emscripten runtime (this starts QEMU)
  await loadScript("/wasm/out.js");

  return pty;
}
