/* Friday Night — sealed secrets for online rooms.
   Room data in Firebase is readable by anyone who knows the room code, so anything secret
   (who is out, the word, votes, lies, answers) is encrypted for the one device that may read it.
   Each device keeps one ECDH P-256 key pair in localStorage (shared by all games on the site).
   seal(toPub, obj) -> {e, iv, c}: a fresh ephemeral key + AES-GCM, so only the owner of toPub can open it. */
(function () {
  "use strict";
  const KEY = "fn-ecdh-v1", ALG = { name: "ECDH", namedCurve: "P-256" };
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ok = !!(self.crypto && crypto.subtle);
  let mine = null;

  async function me() {
    if (mine) return mine;
    let j = null;
    try { j = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (j && j.priv && j.pub) {
      try { mine = { priv: await crypto.subtle.importKey("jwk", j.priv, ALG, false, ["deriveKey"]), pub: j.pub }; return mine; } catch (e) {}
    }
    const kp = await crypto.subtle.generateKey(ALG, true, ["deriveKey"]);
    const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const pub = b64(await crypto.subtle.exportKey("raw", kp.publicKey));
    try { localStorage.setItem(KEY, JSON.stringify({ priv, pub })); } catch (e) {}
    mine = { priv: kp.privateKey, pub };
    return mine;
  }
  async function aesKey(priv, pubB64) {
    const pk = await crypto.subtle.importKey("raw", ub64(pubB64), ALG, false, []);
    return crypto.subtle.deriveKey({ name: "ECDH", public: pk }, priv, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function seal(toPub, obj) {
    if (!toPub) throw new Error("nokey");
    const eph = await crypto.subtle.generateKey(ALG, true, ["deriveKey"]);
    const k = await aesKey(eph.privateKey, toPub), iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, te.encode(JSON.stringify(obj === undefined ? null : obj)));
    return { e: b64(await crypto.subtle.exportKey("raw", eph.publicKey)), iv: b64(iv), c: b64(c) };
  }
  // returns undefined when the box can't be opened on this device
  async function open(box) {
    if (!box || typeof box.e !== "string") return undefined;
    try {
      const m = await me(), k = await aesKey(m.priv, box.e);
      return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64(box.iv) }, k, ub64(box.c))));
    } catch (e) { return undefined; }
  }
  self.FNC = { ok, pub: () => me().then(m => m.pub), seal, open };
})();
