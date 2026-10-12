/* سين جيم — standalone runtime.
   Replaces the claude.ai artifact runtime (window.claude.use) so the game runs
   on any static host (GitHub Pages):
   - "db":     rooms/<CODE> live docs  -> Firebase Realtime Database
               cats (فئاتي)             -> this device (localStorage)
   - "room":   presence per room        -> Firebase RTDB presence/<room>/<peer>
   - "assets": uploaded media           -> IndexedDB on this device (+ images
               mirrored to RTDB media/<id> so phones/TVs can see them)
   - "user":   canEdit() is always true (anyone can host a game on their device)
   Values are stored as JSON strings so nulls/empty arrays survive Firebase. */
(function(){
  const CFG = self.FIREBASE_CONFIG;
  const ON = !!(CFG && CFG.databaseURL && self.firebase);
  let fdb = null;
  if (ON) { try { firebase.initializeApp(CFG); fdb = firebase.database(); } catch (e) { console.error(e); } }
  const rid = (n=32) => Array.from(crypto.getRandomValues(new Uint8Array(n/2)), b => b.toString(16).padStart(2,"0")).join("");
  const enc = o => ({ j: JSON.stringify(o), t: firebase.database.ServerValue.TIMESTAMP });
  const dec = v => { try { return v && typeof v.j === "string" ? JSON.parse(v.j) : null; } catch (e) { return null; } };
  const err = (code, msg) => Object.assign(new Error(msg || code), { code });

  /* ---------- local categories (فئاتي) ---------- */
  const CKEY = "seenjeem-mycats-v1";
  const lread = () => { try { return JSON.parse(localStorage.getItem(CKEY) || "{}") || {}; } catch (e) { return {}; } };
  const lwrite = o => { try { localStorage.setItem(CKEY, JSON.stringify(o)); } catch (e) { throw err("quota_exceeded"); } };
  const catSubs = new Set();
  const catSnap = () => { const o = lread(); return { docs: Object.keys(o).map(id => ({ id, data: () => o[id] })) }; };
  const fireCats = () => { const s = catSnap(); catSubs.forEach(cb => { try { cb(s); } catch (e) {} }); };
  const catDoc = id => ({ id, async set(b) { const o = lread(); o[id] = b; lwrite(o); fireCats(); }, async delete() { const o = lread(); delete o[id]; lwrite(o); fireCats(); } });

  /* ---------- live docs (rooms) ---------- */
  function liveDoc(path) {
    if (!fdb) return { async set() { throw err("offline"); }, async delete() {}, onSnapshot(cb, e) { setTimeout(() => e && e(err("offline")), 0); return () => {}; } };
    const ref = fdb.ref(path);
    return {
      set: o => ref.set(enc(o)),
      delete: () => ref.remove(),
      onSnapshot(cb, e) {
        const h = s => { const d = dec(s.val()); cb({ exists: !!d, data: () => d }); };
        ref.on("value", h, x => e && e(x));
        return () => ref.off("value", h);
      }
    };
  }
  const DB = {
    doc(p) { return /^cats\//.test(p) ? catDoc(p.slice(5)) : liveDoc(p); },
    collection(name) {
      if (name !== "cats") throw err("unsupported");
      return {
        doc: id => catDoc(id || rid(20)),
        onSnapshot(cb) { catSubs.add(cb); setTimeout(() => cb(catSnap()), 0); return () => catSubs.delete(cb); }
      };
    }
  };
  addEventListener("storage", e => { if (e.key === CKEY) fireCats(); });

  /* ---------- rooms / presence ---------- */
  const ROOM = fdb ? {
    async join(name) {
      const me = "p" + rid(16), base = fdb.ref("presence/" + name), ref = base.child(me), info = fdb.ref(".info/connected");
      let state = null, left = false;
      const write = () => state && !left ? ref.set(enc(state)) : Promise.resolve();
      const onConn = s => { if (s.val() === true && !left) { ref.onDisconnect().remove(); write(); } };
      info.on("value", onConn);
      const subs = [];
      return {
        presence(p) { state = Object.assign(state || {}, p || {}); return write(); },
        onPeers(cb, e) {
          const h = s => { const v = s.val() || {}; const peers = Object.keys(v).map(k => ({ peer: k, presence: dec(v[k]) || {}, sameTab: k === me })).filter(p => p.presence); cb({ peers }); };
          base.on("value", h, x => e && e(x)); subs.push(h);
        },
        leave() { left = true; info.off("value", onConn); subs.forEach(h => base.off("value", h)); ref.onDisconnect().cancel(); return ref.remove(); }
      };
    }
  } : null;

  /* ---------- media (IndexedDB + RTDB mirror for images) ---------- */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open("sj-media", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbDo = (mode, fn) => idb().then(d => new Promise((res, rej) => { const t = d.transaction("files", mode), st = t.objectStore("files"); const q = fn(st); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  async function shrink(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file); const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise(r => c.toBlob(r, "image/jpeg", .85)); return b && b.size < file.size ? b : file;
    } catch (e) { return file; }
  }
  const toDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  const AS = {
    async upload(file, o) {
      const type = (o && o.type) || file.type;
      if (file.size > 20 * 1024 * 1024) throw err("too_large");
      const id = rid(32);
      const blob = type.startsWith("image") ? await shrink(file) : file;
      await idbDo("readwrite", st => st.put({ type: blob.type || type, blob }, id));
      if (fdb && type.startsWith("image") && blob.size < 1.5 * 1024 * 1024) {
        try { await fdb.ref("media/" + id).set({ d: await toDataURL(blob), t: firebase.database.ServerValue.TIMESTAMP }); } catch (e) { console.warn("media mirror failed", e); }
      }
      return { id, url: "_blob/" + id };
    },
    async delete(id) { try { await idbDo("readwrite", st => st.delete(id)); } catch (e) {} if (fdb) { try { await fdb.ref("media/" + id).remove(); } catch (e) {} } }
  };

  const USER = { canEdit: async () => true };
  const caps = { db: DB, room: ROOM, assets: AS, user: USER };
  self.SJ_ONLINE = !!fdb;
  self.claude = { use: n => caps[n] || null };

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(e => console.warn("sw", e));
})();
