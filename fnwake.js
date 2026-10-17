/* Friday Night — the host's phone runs every game timer, so:
   - FNW.hold(true) keeps the host's screen awake (Screen Wake Lock) and takes it again
     whenever the page comes back to the front;
   - FNW.onVisible(fn) runs fn when the page comes back (so the host catches up at once);
   - FNW.late(name | null) shows the other players a "waiting for the host" note when the
     host is late to move the game on. */
(function () {
  "use strict";
  let want = false, lock = null, busy = false;
  const cbs = [];
  async function grab() {
    if (!want || lock || busy || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
    busy = true;
    try {
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => { lock = null; });
    } catch (e) { lock = null; }
    busy = false;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    grab();
    cbs.forEach(f => { try { f(); } catch (e) {} });
  });
  // some browsers only allow the lock after a tap
  ["pointerdown", "keydown"].forEach(t => addEventListener(t, () => { if (want && !lock) grab(); }, { passive: true }));

  let note = null;
  function late(name) {
    if (!name) { if (note) note.hidden = true; return; }
    if (!note) {
      note = document.createElement("div");
      note.setAttribute("role", "status");
      note.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:50;max-width:520px;margin:0 auto;background:#2b1745;color:#fff;border-radius:16px;padding:12px 16px;font:700 15px/1.5 Tajawal,system-ui,sans-serif;text-align:center;box-shadow:0 10px 30px rgba(43,23,69,.35)";
      document.body.appendChild(note);
    }
    note.textContent = "⏳ ننتظر صاحب الغرفة (" + name + ")… إذا جواله مقفول أو مطلّع من الصفحة، خلّه يرجع لها.";
    note.hidden = false;
  }
  self.FNW = {
    hold(on) {
      on = !!on; if (on === want) return; want = on;
      if (on) grab(); else if (lock) { const l = lock; lock = null; l.release().catch(() => {}); }
    },
    onVisible(fn) { cbs.push(fn); },
    late
  };
})();
