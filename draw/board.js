/* ارسم وخمّن — drawing board shared by the game page and the TV screen.
   Strokes use a fixed 1000×750 space so every screen draws the same picture:
   {c: color, w: width, p: [x0, y0, x1, y1, …]} (ints). */
(function () {
  "use strict";
  const W = 1000, H = 750;
  function Board(canvas) {
    const ctx = canvas.getContext("2d");
    let strokes = [], live = null, ratio = 1;
    function fit() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, self.devicePixelRatio || 1);
      if (!r.width) return;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.width * H / W * dpr);
      ratio = canvas.width / W; paint();
    }
    function line(s) {
      const p = s.p || []; if (p.length < 2) return;
      ctx.strokeStyle = s.c || "#2b1745"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = (s.w || 6) * ratio;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (p.length === 2) { ctx.beginPath(); ctx.arc(p[0] * ratio, p[1] * ratio, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(p[0] * ratio, p[1] * ratio);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * ratio, p[i + 1] * ratio);
      ctx.stroke();
    }
    function paint() {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      strokes.forEach(line); if (live) line(live);
    }
    // turn a pointer event into board coordinates
    function at(e) {
      const r = canvas.getBoundingClientRect();
      return [Math.max(0, Math.min(W, Math.round((e.clientX - r.left) / r.width * W))), Math.max(0, Math.min(H, Math.round((e.clientY - r.top) / r.height * H)))];
    }
    if (self.ResizeObserver) new ResizeObserver(fit).observe(canvas); else addEventListener("resize", fit);
    fit();
    return {
      set(list) { strokes = list || []; paint(); },
      live(s) { live = s; paint(); },
      at, fit,
      get strokes() { return strokes; }
    };
  }
  // {s0001: {j}, …} -> [stroke, …] in drawing order
  function parse(v, dec) { return Object.keys(v || {}).sort().map(k => dec(v[k])).filter(s => s && Array.isArray(s.p)); }
  self.DrawBoard = { Board, parse, W, H };
})();
