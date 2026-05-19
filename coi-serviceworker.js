// Self-unregistering stub — clears any stale SW from previous installs.
// The full COOP/COEP worker is only needed for real WASM mode (not simulation).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", async () => {
  await self.registration.unregister();
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((c) => c.navigate(c.url));
});
