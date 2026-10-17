/* Friday Night — sounds (made with Web Audio, no files), little phone vibrations, and a mute button.
   FX.play("right" | "wrong" | "tap" | "party" | "tick" | "whoosh" | "reveal" | "win", vibrate?)
   FX.muteButton() adds the 🔊/🔇 button. The choice is kept on this device. */
(function () {
  "use strict";
  const KEY = "fn-muted";
  let muted = false, ac = null;
  try { muted = JSON.parse(localStorage.getItem(KEY) || "false"); } catch (e) {}
  const ctx = () => {
    if (!ac) { const A = self.AudioContext || self.webkitAudioContext; if (A) try { ac = new A(); } catch (e) {} }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  };
  function tone(f, t0, dur, type, vol, slide) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), s = a.currentTime + t0;
    o.type = type || "sine"; o.frequency.setValueAtTime(f, s); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, s + dur);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol || .15, s + .01); g.gain.exponentialRampToValueAtTime(.0001, s + dur);
    o.connect(g); g.connect(a.destination); o.start(s); o.stop(s + dur + .02);
  }
  function noise(t0, dur, vol) {
    const a = ctx(); if (!a) return;
    const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const n = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 1800; n.buffer = b; g.gain.value = vol || .08;
    n.connect(f); f.connect(g); g.connect(a.destination); n.start(a.currentTime + t0);
  }
  const SND = {
    tap: () => tone(620, 0, .07, "triangle", .1, 1.4),
    right: () => { tone(784, 0, .14, "triangle", .2); tone(1175, .1, .28, "triangle", .2); },
    wrong: () => { tone(220, 0, .22, "sawtooth", .07, .7); tone(165, .16, .3, "sawtooth", .07, .7); },
    party: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .22, "square", .06)); noise(.05, .5, .05); },
    tick: () => tone(1400, 0, .04, "square", .04),
    whoosh: () => noise(0, .25, .07),
    reveal: () => { tone(110, 0, .45, "sawtooth", .09, 2.5); noise(0, .3, .06); },
    win: () => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * .13, .3, "triangle", .15)); }
  };
  const buzz = p => { try { if (p && navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
  function play(k, vib) { try { if (!muted && SND[k]) SND[k](); } catch (e) {} buzz(vib); }
  function muteButton() {
    if (document.querySelector(".fx-mute")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "fx-mute";
    b.style.cssText = "position:fixed;bottom:calc(14px + env(safe-area-inset-bottom,0px));left:14px;z-index:60;width:46px;height:46px;border-radius:50%;background:#fff;border:3px solid #2b1745;box-shadow:3px 3px 0 #2b1745;font-size:19px;cursor:pointer;display:grid;place-items:center";
    const paint = () => { b.textContent = muted ? "🔇" : "🔊"; b.setAttribute("aria-label", muted ? "شغّل الصوت" : "اكتم الصوت"); };
    paint(); document.body.appendChild(b);
    b.onclick = () => { muted = !muted; try { localStorage.setItem(KEY, JSON.stringify(muted)); } catch (e) {} paint(); if (!muted) play("tap"); };
  }
  self.FX = { play, buzz, muteButton, get muted() { return muted; } };
})();
