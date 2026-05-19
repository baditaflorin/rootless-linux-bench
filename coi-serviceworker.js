// COI (Cross-Origin Isolation) service worker
// Injects COOP + COEP headers on same-origin responses so SharedArrayBuffer
// (needed by QEMU pthreads) is available without server configuration.
//
// Also handles two special cases:
//   *.wasm files → sets Content-Type: application/wasm (required by
//     WebAssembly.instantiateStreaming; GitHub Pages may omit it)
//   fedora.data.gz → adds Content-Encoding: gzip so the browser
//     transparently decompresses the 44 MB file into the 109 MB raw
//     Emscripten data blob before handing it to JavaScript

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Only intercept same-origin requests
  if (!url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.status === 0) return response;

      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Embedder-Policy", "credentialless");

      // Correct WASM MIME type so instantiateStreaming works
      if (url.endsWith(".wasm")) {
        headers.set("Content-Type", "application/wasm");
      }

      // Tell the browser to decompress fedora.data.gz on-the-fly so
      // Emscripten receives the raw (uncompressed) data blob.
      // Only inject if the server hasn't already set Content-Encoding
      // (GitHub Pages serves .gz as raw binary without CE: gzip).
      if (url.endsWith("fedora.data.gz") && !response.headers.get("content-encoding")) {
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Content-Encoding", "gzip");
        // Content-Length stays as the compressed (33 MB) size —
        // the browser uses it for download progress; JS receives the
        // decompressed 109 MB blob after transparent gunzip.
      }

      return new Response(response.body, {
        status:     response.status,
        statusText: response.statusText,
        headers,
      });
    }).catch(() => fetch(event.request))
  );
});
