/* صفحة اختيار صور سين جيم.
   Lists the سين جيم questions that have no picture (the ones that need one first), lets Faisal pick a
   picture from TMDB or upload his own screenshot, or mark a question as "no picture needed" / "delete".
   Everything stays in this browser (localStorage) until he exports picks.json and uploads it to picks/
   in the repo, where a GitHub Action shrinks the pictures into img/ and updates the questions.
   The TMDB key is kept in this browser only and is sent to api.themoviedb.org only. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), app = $("app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "pick-v1";
  const ST = (() => { try { return Object.assign({ key: "", map: {}, choices: {} }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return { key: "", map: {}, choices: {} }; } })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); return true; } catch (e) { alert("مساحة المتصفح امتلت. صدّر الملف وارفعه، وبعدها امسح الاختيارات."); return false; } }
  let SERIES = [], tab = "req", only = "", view = null; // view: {code} when the picture panel is open

  /* ---------- TMDB ---------- */
  const API = "https://api.themoviedb.org/3";
  const IMG = (size, p) => p ? `https://image.tmdb.org/t/p/${size}${p}` : "";
  async function tmdb(path, params) {
    const u = new URL(API + path), k = ST.key.trim(), h = { accept: "application/json" };
    Object.entries(params || {}).forEach(([a, b]) => u.searchParams.set(a, b));
    if (k.length > 40) h.Authorization = "Bearer " + k; else u.searchParams.set("api_key", k);
    const r = await fetch(u, { headers: h });
    if (r.status === 401) throw new Error("key");
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }
  const isMovie = c => c.group === "أفلام";

  /* ---------- data ---------- */
  const needs = q => !q.m && !q.ni;
  const required = q => needs(q) && q.r;
  const listFor = t => SERIES.flatMap(c => c.qs.filter(q => t === "req" ? required(q) : t === "opt" ? needs(q) && !q.r : needs(q) && ST.choices[q.c]).map(q => ({ c, q })));
  // forget choices that the site already applied (picture added, marked, or question deleted)
  function prune() {
    const live = new Set(SERIES.flatMap(c => c.qs.filter(needs).map(q => q.c)));
    Object.keys(ST.choices).forEach(k => { if (!live.has(k)) delete ST.choices[k]; });
    save();
  }

  /* ---------- views ---------- */
  function keyCard() {
    return `<div class="card"><h2>🔑 مفتاح TMDB</h2>
      ${ST.key ? `<p class="note">المفتاح محفوظ في هالمتصفح بس ✓</p><div class="row"><button type="button" class="ghost" data-act="testkey">جرّب المفتاح</button><button type="button" class="ghost" data-act="clearkey">امسح المفتاح</button></div><p class="note" id="keymsg"></p>`
        : `<p class="note">الصق مفتاح API من حسابك في TMDB. ينحفظ في متصفحك بس، وما يروح لأي مكان غير TMDB.</p>
        <div class="grow"><input id="fKey" class="inp" type="password" autocomplete="off" placeholder="API Key أو Read Access Token"><button type="button" class="btn" data-act="savekey">احفظ</button></div><p class="note" id="keymsg"></p>`}
    </div>`;
  }
  function render() {
    if (view) return renderPanel();
    const req = listFor("req"), opt = listFor("opt"), mine = listFor("mine");
    const list = (tab === "req" ? req : tab === "opt" ? opt : mine).filter(x => !only || x.c.code === only);
    const groups = []; list.forEach(x => { let g = groups.find(g => g.c === x.c); if (!g) groups.push(g = { c: x.c, qs: [] }); g.qs.push(x.q); });
    const seriesWith = [...new Set((tab === "req" ? req : tab === "opt" ? opt : mine).map(x => x.c))];
    app.innerHTML = `${keyCard()}
      <div class="tabs"><button type="button" data-tab="req" class="${tab === "req" ? "on" : ""}">لازم صورة <b>${req.length}</b></button><button type="button" data-tab="opt" class="${tab === "opt" ? "on" : ""}">اختيارية <b>${opt.length}</b></button><button type="button" data-tab="mine" class="${tab === "mine" ? "on" : ""}">اخترتها <b>${mine.length}</b></button></div>
      <p class="note center">${tab === "req" ? "هذي الأسئلة مخفية من اللعب لين تنضاف صورتها." : tab === "opt" ? "هذي تطلع في اللعب بغلاف المسلسل. الصورة تحلّيها بس مو ضرورية." : "اللي اخترته وما رفعته للحين."}</p>
      <div class="field"><select id="fOnly" class="inp"><option value="">كل المسلسلات (${seriesWith.length})</option>${seriesWith.map(c => `<option value="${c.code}" ${only === c.code ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      ${groups.length ? groups.map(g => seriesBlock(g.c, g.qs)).join("") : `<div class="card center"><p class="big">${tab === "mine" ? "ما اخترت شي للحين" : "خلصت هذي القائمة 🎉"}</p></div>`}
      <p class="tmdb">This product uses the TMDB API but is not endorsed or certified by TMDB.<br>الصور من <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>.</p>`;
    paintBar();
  }
  function seriesBlock(c, qs) {
    const m = ST.map[c.code];
    return `<section class="card series"><div class="shead"><h2>${esc(c.name)}</h2><span class="note">${esc(c.group)} · ${qs.length} سؤال</span></div>
      <div class="link">${m ? `<span>🎬 TMDB: <b>${esc(m.name)}</b>${m.year ? ` (${esc(m.year)})` : ""}</span> <button type="button" class="ghost sm" data-unlink="${c.code}">مو هذا</button>` : `<button type="button" class="ghost sm" data-find="${c.code}">🔎 دوّر المسلسل في TMDB</button>`}</div>
      <div id="find-${c.code}"></div>
      ${qs.map(q => qCard(c, q)).join("")}</section>`;
  }
  function qCard(c, q) {
    const ch = ST.choices[q.c];
    const badge = !ch ? "" : ch.do === "tmdb" || ch.do === "upload" ? `<img class="chosen" src="${ch.do === "tmdb" ? IMG("w300", ch.path) : ch.data}" alt="">` : `<span class="tag ${ch.do}">${ch.do === "noimage" ? "✓ ما تحتاج صورة" : "🗑️ بينحذف"}</span>`;
    return `<div class="q ${ch ? "done" : ""}"><div class="qt"><span class="code" dir="ltr">${q.c}</span><span class="pts">${q.p}</span><b>${esc(q.q)}</b></div>
      <p class="note">الجواب: <b>${esc(q.a)}</b>${q.need ? ` · الصورة المطلوبة: ${esc(q.need)}` : ""}</p>
      ${badge}
      <div class="acts">${ch ? `<button type="button" class="ghost" data-undo="${q.c}">↩️ تراجع</button>` : `
        <button type="button" class="btn sm" data-pick="${q.c}">🖼️ اختار صورة</button>
        <label class="ghost upl">📷 ارفع لقطة<input type="file" accept="image/*" data-up="${q.c}" hidden></label>
        <button type="button" class="ghost" data-noimg="${q.c}">✓ ما تحتاج صورة</button>
        <button type="button" class="ghost danger" data-del="${q.c}">🗑️ احذف السؤال</button>`}</div></div>`;
  }
  async function findSeries(code) {
    const c = SERIES.find(x => x.code === code), box = $("find-" + code);
    if (!ST.key) { box.innerHTML = `<p class="err">حط مفتاح TMDB فوق أول.</p>`; return; }
    box.innerHTML = `<p class="note">يدوّر…</p>`;
    try {
      const kind = isMovie(c) ? "movie" : "tv";
      let r = await tmdb(`/search/${kind}`, { query: c.name, language: "ar" });
      if (!r.results.length) r = await tmdb(`/search/${kind}`, { query: c.name, language: "en-US" });
      box.innerHTML = r.results.length ? `<p class="note">أي واحد هو؟</p><div class="results">${r.results.slice(0, 8).map(x => `<button type="button" data-link="${code}|${x.id}|${esc(x.name || x.title)}|${(x.first_air_date || x.release_date || "").slice(0, 4)}"><img src="${IMG("w154", x.poster_path)}" alt="" loading="lazy"><span>${esc(x.name || x.title)}<small>${esc((x.first_air_date || x.release_date || "").slice(0, 4))}${x.original_name || x.original_title ? " · " + esc(x.original_name || x.original_title) : ""}</small></span></button>`).join("")}</div>
        <div class="grow mt"><input class="inp" id="q-${code}" placeholder="أو اكتب الاسم بالإنجليزي"><button type="button" class="ghost" data-findq="${code}">دوّر</button></div>` : `<p class="err">ما لقيته. جرّب الاسم بالإنجليزي:</p><div class="grow"><input class="inp" id="q-${code}"><button type="button" class="ghost" data-findq="${code}">دوّر</button></div>`;
    } catch (e) { box.innerHTML = `<p class="err">${e.message === "key" ? "المفتاح غلط." : "ما قدرت أتصل بـ TMDB."}</p>`; }
  }
  async function findQuery(code) {
    const c = SERIES.find(x => x.code === code), v = ($("q-" + code) || {}).value || "";
    if (!v.trim()) return;
    const box = $("find-" + code); const kind = isMovie(c) ? "movie" : "tv";
    try {
      const r = await tmdb(`/search/${kind}`, { query: v.trim(), language: "en-US" });
      box.innerHTML = `<div class="results">${r.results.slice(0, 8).map(x => `<button type="button" data-link="${code}|${x.id}|${esc(x.name || x.title)}|${(x.first_air_date || x.release_date || "").slice(0, 4)}"><img src="${IMG("w154", x.poster_path)}" alt="" loading="lazy"><span>${esc(x.name || x.title)}<small>${esc((x.first_air_date || x.release_date || "").slice(0, 4))}</small></span></button>`).join("") || `<p class="err">ما لقيته.</p>`}</div>`;
    } catch (e) { box.innerHTML = `<p class="err">ما قدرت أتصل بـ TMDB.</p>`; }
  }

  /* ---------- picture panel ---------- */
  let PANEL = { tab: "scenes", data: null, person: null };
  async function openPanel(qcode) {
    const c = SERIES.find(x => x.qs.some(q => q.c === qcode)), q = c.qs.find(x => x.c === qcode);
    if (!ST.map[c.code]) { alert("دوّر المسلسل في TMDB أول (زر «دوّر المسلسل»)."); return; }
    const people = /(شخصية|ممثل|ممثلة|مين هذا|مين هذي|لعب دور|يلعب|تلعب)/.test(q.q);
    view = { code: qcode, c, q }; PANEL = { tab: people ? "cast" : "scenes", data: null, person: null };
    render(); await loadPanel();
  }
  async function loadPanel() {
    const { c } = view, m = ST.map[c.code], kind = isMovie(c) ? "movie" : "tv";
    try {
      const [imgs, cred] = await Promise.all([
        tmdb(`/${kind}/${m.id}/images`, { include_image_language: "null,ar,en" }),
        tmdb(kind === "tv" ? `/tv/${m.id}/aggregate_credits` : `/movie/${m.id}/credits`, { language: "ar" }).catch(() => ({ cast: [] }))
      ]);
      PANEL.data = { backdrops: imgs.backdrops || [], posters: imgs.posters || [], cast: (cred.cast || []).slice(0, 40) };
    } catch (e) { PANEL.data = { error: e.message === "key" ? "المفتاح غلط." : "ما قدرت أتصل بـ TMDB." }; }
    renderPanel();
  }
  async function loadPerson(id, name) {
    PANEL.person = { id, name, profiles: null }; renderPanel();
    try { const r = await tmdb(`/person/${id}/images`); PANEL.person.profiles = r.profiles || []; }
    catch (e) { PANEL.person.profiles = []; }
    renderPanel();
  }
  function grid(items, kind) {
    if (!items.length) return `<p class="note">ما فيه صور هنا.</p>`;
    return `<div class="grid ${kind}">${items.map(x => `<button type="button" data-choose="${esc(x.file_path)}|${kind}"><img src="${IMG(kind === "profile" ? "w185" : "w300", x.file_path)}" alt="" loading="lazy"></button>`).join("")}</div>`;
  }
  function renderPanel() {
    const { c, q } = view, d = PANEL.data;
    let body = `<p class="note">لحظة…</p>`;
    if (d && d.error) body = `<p class="err">${d.error}</p>`;
    else if (d) {
      if (PANEL.tab === "scenes") body = grid(d.backdrops, "backdrop");
      if (PANEL.tab === "posters") body = `<p class="note">⚠️ البوستر غالباً فيه اسم المسلسل، فلا تختاره إذا يكشف الجواب.</p>` + grid(d.posters, "poster");
      if (PANEL.tab === "cast") body = PANEL.person
        ? `<button type="button" class="ghost sm" data-back="1">→ رجوع للممثلين</button><h3 class="mt">${esc(PANEL.person.name)}</h3>${PANEL.person.profiles ? grid(PANEL.person.profiles, "profile") : `<p class="note">لحظة…</p>`}`
        : `<div class="cast">${d.cast.map(p => `<button type="button" data-person="${p.id}|${esc(p.name)}"><img src="${IMG("w185", p.profile_path)}" alt="" loading="lazy"><span>${esc(p.name)}<small>${esc(((p.roles && p.roles[0] && p.roles[0].character) || p.character || ""))}</small></span></button>`).join("") || `<p class="note">ما فيه ممثلين.</p>`}</div>`;
    }
    app.innerHTML = `<div class="card panel"><button type="button" class="ghost sm" data-close="1">✕ رجوع</button>
      <p class="note mt">${esc(c.name)} · <span dir="ltr">${q.c}</span></p><h2>${esc(q.q)}</h2><p class="note">الجواب: <b>${esc(q.a)}</b>${q.need ? ` · المطلوب: ${esc(q.need)}` : ""}</p>
      <p class="note">اختار صورة ما تكشف الجواب (بدون اسم مكتوب عليها).</p>
      <div class="tabs"><button type="button" data-ptab="scenes" class="${PANEL.tab === "scenes" ? "on" : ""}">🎞️ مشاهد</button><button type="button" data-ptab="cast" class="${PANEL.tab === "cast" ? "on" : ""}">🎭 الممثلين</button><button type="button" data-ptab="posters" class="${PANEL.tab === "posters" ? "on" : ""}">🖼️ بوسترات</button></div>
      ${body}</div>
      <p class="tmdb">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>`;
    paintBar();
  }

  /* ---------- choices + export ---------- */
  function choose(code, val) { ST.choices[code] = val; if (!save()) delete ST.choices[code]; }
  function shrinkFile(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1024 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        res(cv.toDataURL("image/jpeg", .82));
      };
      img.onerror = () => rej(new Error("img")); img.src = url;
    });
  }
  function paintBar() {
    const n = Object.keys(ST.choices).length, bar = $("bar");
    bar.hidden = !n;
    bar.innerHTML = `<span>اخترت <b>${n}</b></span><button type="button" class="btn sm" data-act="export">⬇️ صدّر الملف</button>`;
  }
  function exportPicks() {
    const blob = new Blob([JSON.stringify({ v: 1, at: new Date().toISOString(), picks: ST.choices })], { type: "application/json" });
    const a = document.createElement("a"), t = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    a.href = URL.createObjectURL(blob); a.download = `picks-${t}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    $("done").hidden = false;
  }

  /* ---------- events ---------- */
  document.addEventListener("click", async e => {
    const b = e.target.closest("button,[data-tab]"); if (!b) return;
    const d = b.dataset;
    if (d.tab) { tab = d.tab; only = ""; render(); scrollTo(0, 0); return; }
    if (d.act === "savekey") { const v = ($("fKey").value || "").trim(); if (!v) return; ST.key = v; save(); render(); return; }
    if (d.act === "clearkey") { ST.key = ""; save(); render(); return; }
    if (d.act === "testkey") { const m = $("keymsg"); m.textContent = "يجرّب…"; try { await tmdb("/configuration"); m.textContent = "المفتاح شغّال ✓"; } catch (x) { m.textContent = x.message === "key" ? "المفتاح غلط ✗" : "ما قدرت أتصل بـ TMDB."; } return; }
    if (d.act === "export") { exportPicks(); return; }
    if (d.act === "closedone") { $("done").hidden = true; return; }
    if (d.find) { findSeries(d.find); return; }
    if (d.findq) { findQuery(d.findq); return; }
    if (d.link) { const [code, id, name, year] = d.link.split("|"); ST.map[code] = { id: +id, name, year }; save(); render(); return; }
    if (d.unlink) { delete ST.map[d.unlink]; save(); render(); return; }
    if (d.pick) { openPanel(d.pick); return; }
    if (d.noimg) { choose(d.noimg, { do: "noimage" }); render(); return; }
    if (d.del) { if (!confirm("متأكد تبي تحذف هالسؤال من اللعبة؟")) return; choose(d.del, { do: "delete" }); render(); return; }
    if (d.undo) { delete ST.choices[d.undo]; save(); render(); return; }
    if (d.close) { view = null; render(); return; }
    if (d.ptab) { PANEL.tab = d.ptab; PANEL.person = null; renderPanel(); return; }
    if (d.person) { const [id, name] = d.person.split("|"); loadPerson(id, name); return; }
    if (d.back) { PANEL.person = null; renderPanel(); return; }
    if (d.choose) { const [path, kind] = d.choose.split("|"); choose(view.code, { do: "tmdb", path, kind, tmdb: ST.map[view.c.code].id }); view = null; render(); return; }
  });
  document.addEventListener("change", async e => {
    if (e.target.id === "fOnly") { only = e.target.value; render(); return; }
    const code = e.target.dataset && e.target.dataset.up; if (!code || !e.target.files[0]) return;
    try { choose(code, { do: "upload", data: await shrinkFile(e.target.files[0]) }); } catch (x) { alert("ما قدرت أفتح الصورة."); }
    render();
  });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "fKey") document.querySelector('[data-act="savekey"]').click(); if (e.key === "Enter" && e.target.id && e.target.id.startsWith("q-")) findQuery(e.target.id.slice(2)); });

  /* ---------- boot: questions come straight from the game page ---------- */
  fetch("../seenjeem/index.html", { cache: "no-cache" }).then(r => r.text()).then(t => {
    const m = t.match(/const SERIES=(\[[\s\S]*?\]);\n/);
    SERIES = JSON.parse(m[1]); prune(); render();
  }).catch(() => { app.innerHTML = `<div class="card"><p class="err">ما قدرت أحمّل الأسئلة. حدّث الصفحة.</p></div>`; });
})();
