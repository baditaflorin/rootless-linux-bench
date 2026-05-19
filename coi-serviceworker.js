// COI (Cross-Origin Isolation) service worker
// Injects COOP + COEP headers on same-origin responses so SharedArrayBuffer
// (needed by QEMU pthreads) is available without server configuration.
// Cross-origin requests (CDN, GitHub Releases) are passed through unchanged.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Only intercept same-origin navigations and subresources
  if (!url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.status === 0) return response;

      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Embedder-Policy", "credentialless");

      return new Response(response.body, {
        status:     response.status,
        statusText: response.statusText,
        headers,
      });
    }).catch(() => fetch(event.request))
  );
});
