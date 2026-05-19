// Environment checks used by TerminalPane to decide whether to run real WASM.
//
// Real WASM requires:
//   1. Cross-origin isolation (SharedArrayBuffer for QEMU pthreads)
//   2. The compiled WASM files served from /wasm/ (same-origin)
//
// The iframe pages (wasm/iframe-debian.html, wasm/iframe-fedora.html)
// handle the full Emscripten initialisation flow internally.

// Returns true if the page is cross-origin isolated (SharedArrayBuffer available).
export function isIsolated() {
  return (
    typeof SharedArrayBuffer !== "undefined" &&
    window.crossOriginIsolated === true
  );
}

// Probe the same-origin /wasm/ path to confirm the compiled files are deployed.
// Sends a HEAD request to qemu.wasm; resolves true on 200.
export async function isWasmAvailable() {
  try {
    const r = await fetch("wasm/qemu.wasm", { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}
