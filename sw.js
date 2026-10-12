/* Serves _blob/<id> for media added in «فئاتي»: from this device first,
   then from the Firebase mirror (images only). */
try { importScripts("firebase-config.js"); } catch (e) {}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

const idb = () => new Promise((res, rej) => { const r = indexedDB.open("sj-media", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const getLocal = id => idb().then(d => new Promise(res => { const q = d.transaction("files").objectStore("files").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); })).catch(() => null);

async function serve(id) {
  const loc = await getLocal(id);
  if (loc && loc.blob) return new Response(loc.blob, { headers: { "Content-Type": loc.type || loc.blob.type || "application/octet-stream" } });
  const C = self.FIREBASE_CONFIG;
  if (C && C.databaseURL) {
    try {
      const r = await fetch(C.databaseURL.replace(/\/$/, "") + "/media/" + id + "/d.json");
      const d = r.ok ? await r.json() : null;
      if (typeof d === "string" && d.startsWith("data:")) return fetch(d);
    } catch (e) {}
  }
  return new Response("not found", { status: 404 });
}

self.addEventListener("fetch", e => {
  const m = new URL(e.request.url).pathname.match(/\/_blob\/([0-9a-f]{32})$/);
  if (m) e.respondWith(serve(m[1]));
});
