/* شاشة العرض — a read-only big screen for any Friday Night room.
   Type the room code: 4 letters → برا السالفة (bs/) or صدق ولا كذب (sq/); 2 letters + 3 digits → سين جيم
   (opened on its own display screen). The TV only reads; phones keep playing as usual. */
(function () {
  "use strict";
  const app = document.getElementById("app"), chip = document.getElementById("hdrChip"), newBtn = document.getElementById("newBtn");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dec = v => { try { return v && typeof v.j === "string" ? JSON.parse(v.j) : null; } catch (e) { return null; } };
  const CFG = self.FIREBASE_CONFIG; let db = null;
  try { if (CFG && CFG.databaseURL && self.firebase) { firebase.initializeApp(CFG); db = firebase.database(); } } catch (e) { console.error(e); }
  const base = location.origin + location.pathname.replace(/tv\/?(index\.html)?$/, "");
  let game = null, code = "", S = null, P = {}, CATS = [], subs = [], stepStart = 0, lastStep = "", tick = null;

  function qrImg(text) { try { const d = document.createElement("div"); new QRCode(d, { text, width: 260, height: 260, colorDark: "#2b1745", colorLight: "#ffffff" }); const c = d.querySelector("canvas"); return c ? `<img class="qr" src="${c.toDataURL()}" alt="">` : ""; } catch (e) { return ""; } }
  function sideHTML() {
    const join = base + (game === "bs" ? "outside/" : "sedq/") + "#" + code;
    return `<aside class="card side center"><span class="lbl">ادخلوا من جوالاتكم</span><div class="code">${esc(code)}</div>${qrImg(join)}<p class="note" dir="ltr">${esc(join.replace(/^https?:\/\//, "").replace(/#.*/, ""))}</p></aside>`;
  }
  const nameOf = id => (P[id] && P[id].name) || (S && S.names && S.names[id]) || "؟";
  const plist = (ids, doneFn) => `<ul class="plist bigplist">${ids.map(id => `<li class="${doneFn && doneFn(id) ? "done" : ""}">${esc(nameOf(id))}</li>`).join("")}</ul>`;
  const scoreTable = (deltas) => { const ids = Object.keys(S.scores || {}).sort((a, b) => (S.scores[b] || 0) - (S.scores[a] || 0)); return `<table><thead><tr><th>اللاعب</th>${deltas ? `<th class="n">هالجولة</th>` : ""}<th class="n">النقاط</th></tr></thead><tbody>${ids.map(id => `<tr><td>${esc(nameOf(id))}</td>${deltas ? `<td class="n ${deltas[id] ? "plus" : ""}">${deltas[id] ? "+" + deltas[id] : "0"}</td>` : ""}<td class="n">${S.scores[id] || 0}</td></tr>`).join("")}</tbody></table>`; };
  const timer = sec => { clearInterval(tick); const upd = () => { const b = document.getElementById("tb"); if (!b) return; const left = Math.max(0, sec * 1000 - (Date.now() - stepStart)); b.style.width = (left / (sec * 1000) * 100) + "%"; }; upd(); tick = setInterval(upd, 300); return `<div class="tbar"><i id="tb" style="width:100%"></i></div>`; };
  const lobbyIds = () => Object.keys(P).sort((a, b) => (P[a].at || 0) - (P[b].at || 0));

  /* ---------- صدق ولا كذب ---------- */
  function renderSQ() {
    const cat = S.q && CATS.find(c => c.id === S.q.cat);
    const head = S.q ? `<p class="tvsub">الجولة ${S.idx + 1} من ${S.total} · ${cat ? esc(cat.emoji + " " + cat.name) : ""}</p>` : "";
    const img = S.q && S.q.img ? `<img class="tvimg" src="${esc(S.q.img)}" alt="" onerror="this.remove()">` : "";
    const q = S.q ? `<p class="tvq">${esc(S.q.text)}</p>` : "";
    const order = S.order || [];
    if (S.phase === "lobby") return `<div class="card"><p class="tvtitle">🤥 صدق ولا كذب</p><p class="tvsub">اللاعبين (${lobbyIds().length}) · ننتظر صاحب الغرفة يبدأ</p>${plist(lobbyIds())}</div>`;
    if (S.phase === "write") return `<div class="card">${head}${img}${q}${timer(60)}<p class="tvsub">✍️ كل واحد يكتب كذبة من جواله…</p>${plist(order, id => { const x = P[id] && P[id].lie; return x && x.q === S.q.id && !(S.redo || []).includes(id + ":" + x.n); })}</div>`;
    if (S.phase === "pick") return `<div class="card">${head}${img}${q}${timer(30)}<div class="tvopts">${(S.opts || []).map(o => `<div>${esc(o.text)}</div>`).join("")}</div><p class="tvsub mt">👆 اختاروا الجواب الصحيح من جوالاتكم</p>${plist(order, id => P[id] && P[id].pick && P[id].pick.q === S.q.id)}</div>`;
    if (S.phase === "reveal") {
      const r = S.reveal;
      const opts = (S.opts || []).slice().sort((a, b) => (a.id === r.truth ? -1 : b.id === r.truth ? 1 : 0));
      return `<div class="card">${head}${img}${q}<div class="tvopts">${opts.map(o => { const own = r.owners[o.id], pk = Object.keys(r.picks).filter(p => r.picks[p] === o.id); return `<div class="${own === "truth" ? "truth" : ""}">${esc(o.text)}<small>${own === "truth" ? "✅ الجواب الصحيح" : "🤥 كذبة " + esc(own.map(nameOf).join(" و"))}${pk.length ? " · اختارها: " + esc(pk.map(nameOf).join("، ")) : ""}</small></div>`; }).join("")}</div></div>
        <div class="card"><h2>الترتيب</h2>${scoreTable(r.deltas)}</div>`;
    }
    if (S.phase === "end") { const ids = Object.keys(S.scores || {}).sort((a, b) => (S.scores[b] || 0) - (S.scores[a] || 0)); const m = ["🥇", "🥈", "🥉"]; return `<div class="card"><p class="tvtitle">النتيجة النهائية 🏆</p><div class="podium">${ids.map((id, i) => `<div><span>${m[i] || i + 1 + "."} ${esc(nameOf(id))}</span><span>${S.scores[id] || 0}</span></div>`).join("")}</div></div>`; }
    return "";
  }
  /* ---------- برا السالفة ---------- */
  function renderBS() {
    const order = S.order || [], spy = S.catInfo && S.catInfo.mode === "spy";
    const outName = spy ? "الجاسوس" : "اللي برا السالفة";
    if (S.phase === "lobby") return `<div class="card"><p class="tvtitle">🤫 برا السالفة</p><p class="tvsub">اللاعبين (${lobbyIds().length}) · ننتظر صاحب الغرفة يبدأ</p>${plist(lobbyIds())}</div>`;
    const cat = S.catInfo ? `<p class="tvsub">الجولة ${S.round} · ${esc(S.catInfo.emoji + " " + S.catInfo.name)}</p>` : "";
    if (S.phase === "roles") return `<div class="card">${cat}<p class="tvtitle">👀 كل واحد يشوف دوره في جواله</p>${plist(order, id => P[id] && P[id].seen === S.round)}</div>`;
    if (S.phase === "ask") return `<div class="card">${cat}<p class="tvtitle">🗣️ جولة الأسئلة</p><ul class="pairs tvpairs">${(S.pairs || []).map(([a, b]) => `<li>${esc(nameOf(a))} <i>يسأل</i> ${esc(nameOf(b))}</li>`).join("")}</ul></div>`;
    if (S.phase === "vote") return `<div class="card">${cat}<p class="tvtitle">🗳️ مين ${spy ? "الجاسوس" : "برا السالفة"}؟</p><p class="tvsub">صوّتوا من جوالاتكم</p>${plist(order, id => P[id] && P[id].vote && P[id].vote.r === S.round)}</div>`;
    if (S.phase === "reveal") { const rv = S.reveal || { counts: {}, outs: [] }; return `<div class="card">${cat}<p class="tvtitle">${outName}: ${rv.outs.map(o => esc(nameOf(o))).join(" و")} ${spy ? "🕵️" : "🤫"}</p>${bars(order, rv.counts, rv.outs)}<p class="tvsub mt">🤔 يحاول يخمّن ${spy ? "المكان" : "الكلمة"}…</p></div>`; }
    if (S.phase === "results") { const r = S.results || {}; return `<div class="card">${cat}<p class="tvtitle">${spy ? "المكان كان" : "الكلمة كانت"} <span class="word">${esc(r.word)}</span></p>${spy && r.spyWord ? `<p class="tvsub">والجاسوس كان طالع له: ${esc(r.spyWord)}</p>` : ""}${bars(order, r.counts || {}, r.outs || [])}</div><div class="card"><h2>النقاط</h2>${scoreTable(r.deltas)}</div>`; }
    return "";
  }
  function bars(order, counts, outs) { const max = Math.max(1, ...order.map(id => counts[id] || 0)); return `<div class="bars">${order.slice().sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).map(id => `<div class="bar ${outs.includes(id) ? "out" : ""}"><span>${esc(nameOf(id))}</span><span class="tr"><i style="width:${((counts[id] || 0) / max) * 100}%"></i></span><span>${counts[id] || 0}</span></div>`).join("")}</div>`; }

  function render() {
    if (!game) return;
    if (!S) { app.innerHTML = `<div class="card center"><p class="big-msg">الغرفة انقفلت أو ما بدأت.</p></div>`; return; }
    const key = S.phase + ":" + (S.q ? S.q.id : S.round || ""); if (key !== lastStep) { lastStep = key; stepStart = Date.now(); }
    const bg = game === "bs" && S.catInfo && S.catInfo.image && S.phase !== "lobby" ? "../outside/" + S.catInfo.image : null;
    document.body.classList.toggle("catbg", !!bg); document.body.style.setProperty("--catbg", bg ? `url("${bg}")` : "none");
    const main = game === "sq" ? renderSQ() : renderBS();
    app.innerHTML = `<div class="tvgrid"><div>${main}</div>${sideHTML()}</div>`;
  }
  function watch(g, c) {
    game = g; code = c; S = null; P = {};
    chip.hidden = false; chip.innerHTML = `${g === "sq" ? "🤥 صدق ولا كذب" : "🤫 برا السالفة"} · <b dir="ltr">${esc(c)}</b>`; newBtn.hidden = false;
    const r = db.ref(g + "/" + c);
    const on = (ref, cb) => { const h = s => cb(s.val()); ref.on("value", h); subs.push(() => ref.off("value", h)); };
    on(r.child("state"), v => { S = dec(v); render(); });
    on(r.child("players"), v => { P = {}; Object.entries(v || {}).forEach(([k, x]) => { const d = dec(x); if (d) P[k] = d; }); render(); });
    history.replaceState(null, "", "#" + c);
    try { document.documentElement.requestFullscreen && 0; } catch (e) {}
  }
  async function connect(c, msgEl) {
    c = c.trim().toUpperCase();
    if (/^[A-Z]{2}[0-9]{3}$/.test(c)) { // سين جيم: open its own display screen
      try { localStorage.setItem("seenjeem-remote-v1", JSON.stringify({ code: c, name: "", role: "display", team: null })); } catch (e) {}
      location.href = base + "#" + c; return;
    }
    if (!/^[A-Z]{4}$/.test(c)) { msgEl.textContent = "اكتب رمز الغرفة: 4 حروف (برا السالفة / صدق ولا كذب) أو حرفين و3 أرقام (سين جيم)."; return; }
    if (!db) { msgEl.textContent = "ما قدرت أتصل. حدّث الصفحة."; return; }
    msgEl.textContent = "يدوّر على الغرفة…";
    try {
      const [a, b] = await Promise.all([db.ref("sq/" + c + "/state").get(), db.ref("bs/" + c + "/state").get()]);
      const ta = a.exists() ? (dec(a.val()) || {}).at || 1 : 0, tb = b.exists() ? (dec(b.val()) || {}).at || 1 : 0;
      if (!ta && !tb) { msgEl.textContent = "ما لقيت غرفة بهالرمز."; return; }
      watch(ta >= tb ? "sq" : "bs", c);
    } catch (e) { msgEl.textContent = "ما قدرت أتصل. تأكد من النت."; }
  }
  function home(msg) {
    subs.forEach(f => f()); subs = []; game = null; clearInterval(tick); chip.hidden = true; newBtn.hidden = true;
    document.body.classList.remove("catbg");
    history.replaceState(null, "", location.pathname);
    app.innerHTML = `<div class="card joinbox center"><p class="tvtitle">📺 الشاشة تعرض، والجوالات تلعب</p>
      <p class="note">افتحوا غرفة من الجوال في أي لعبة، واكتبوا رمزها هنا.</p>
      <input id="tvCode" class="inp codein" maxlength="5" autocomplete="off" placeholder="ABCD">
      <button type="button" class="btn" id="tvGo">اعرض الغرفة</button><p class="err" id="tvMsg">${esc(msg || "")}</p>
      <p class="note">تشتغل مع: 🎬 سين جيم · 🤫 برا السالفة · 🤥 صدق ولا كذب</p></div>`;
    const inp = document.getElementById("tvCode"), go = () => connect(inp.value, document.getElementById("tvMsg"));
    document.getElementById("tvGo").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); }; inp.focus();
  }
  newBtn.onclick = () => home();
  fetch("../sedq/questions.json").then(r => r.json()).then(d => { CATS = d.categories; render(); }).catch(() => {});
  const h = (location.hash || "").replace("#", "");
  home(); if (h) connect(h, document.getElementById("tvMsg"));
})();
