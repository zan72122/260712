/* ============================================================
 * audio.js — WebAudio によるBGM・効果音の完全プロシージャル生成
 *   外部音源ファイル不要。オルゴール風ワルツBGM+かわいい効果音。
 * ============================================================ */
"use strict";
window.PM = window.PM || {};

PM.Audio = (function () {
  let ctx = null;
  let master = null;
  let bgmGain = null;
  let enabled = true;
  let bgmTimer = null;
  let nightMode = false;

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    // やさしいコンプレッサーで音割れ防止
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.5;
    bgmGain.connect(master);
    startBGM();
  }

  function setEnabled(on) {
    enabled = on;
    if (master) master.gain.value = on ? 0.8 : 0;
  }
  function isEnabled() { return enabled; }
  function setNight(n) { nightMode = n; }

  /* ---------- 基本音源 ---------- */

  // オルゴール風の1音(サイン+倍音、キラッとした減衰)
  function bell(freq, when, dur, vol, dest) {
    if (!ctx) return;
    dest = dest || master;
    const t = when;
    const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = freq * 3.02;
    const g1 = ctx.createGain(); const g2 = ctx.createGain();
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(vol, t + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(vol * 0.18, t + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.4);
    o1.connect(g1); g1.connect(dest);
    o2.connect(g2); g2.connect(dest);
    o1.start(t); o1.stop(t + dur + 0.05);
    o2.start(t); o2.stop(t + dur + 0.05);
  }

  // ぽよん系(三角波ピッチベンド)
  function boing(f0, f1, when, dur, vol) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(f0, when);
    o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(master);
    o.start(when); o.stop(when + dur + 0.05);
  }

  // ノイズバースト(花火・水しぶき)
  function noise(when, dur, vol, filterFreq, type) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type || "lowpass"; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(when);
  }

  /* ---------- 効果音 ---------- */
  const N = { C4:261.6, D4:293.7, E4:329.6, F4:349.2, G4:392.0, A4:440.0, B4:493.9,
              C5:523.3, D5:587.3, E5:659.3, F5:698.5, G5:784.0, A5:880.0, B5:987.8,
              C6:1046.5, D6:1174.7, E6:1318.5, G6:1568.0 };

  const SFX = {
    tap()      { const t = ctx.currentTime; boing(500, 900, t, 0.09, 0.25); },
    pop()      { const t = ctx.currentTime; boing(300, 1300, t, 0.12, 0.3); noise(t, 0.08, 0.12, 3500, "highpass"); },
    sparkle()  { const t = ctx.currentTime; [N.C6, N.E6, N.G6].forEach((f, i) => bell(f, t + i * 0.07, 0.6, 0.16)); },
    star()     { const t = ctx.currentTime; [N.G5, N.C6, N.E6, N.G6].forEach((f, i) => bell(f, t + i * 0.08, 0.7, 0.18)); },
    heart()    { const t = ctx.currentTime; bell(N.E5, t, 0.5, 0.2); bell(N.G5, t + 0.1, 0.7, 0.2); },
    yay()      { const t = ctx.currentTime; [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => boing(f, f * 1.02, t + i * 0.09, 0.25, 0.2)); },
    fanfare()  {
      const t = ctx.currentTime;
      const seq = [[N.C5,0],[N.C5,.15],[N.C5,.3],[N.C5,.45],[N.G5,.6],[N.E5,.9],[N.G5,1.05],[N.C6,1.2]];
      seq.forEach(([f, dt]) => { bell(f, t + dt, 0.8, 0.22); bell(f/2, t + dt, 0.8, 0.1); });
      [N.E6, N.G6].forEach((f,i)=> bell(f, t + 1.35 + i*0.1, 1.4, 0.15));
    },
    firework() { const t = ctx.currentTime; boing(900, 1800, t, 0.5, 0.07); noise(t + 0.45, 0.7, 0.3, 1400); [N.C6,N.E6,N.G6,N.C6*1.5].forEach((f,i)=> bell(f*(0.9+Math.random()*0.2), t+0.5+i*0.05, 0.9, 0.08)); },
    splash()   { const t = ctx.currentTime; noise(t, 0.35, 0.22, 1000); boing(700, 200, t, 0.25, 0.1); },
    clop()     { const t = ctx.currentTime; noise(t, 0.05, 0.28, 900, "bandpass"); },
    munch()    { const t = ctx.currentTime; noise(t, 0.09, 0.2, 700); boing(220, 160, t, 0.1, 0.15); },
    brush()    { const t = ctx.currentTime; noise(t, 0.22, 0.1, 2500, "bandpass"); },
    magic()    { const t = ctx.currentTime; for (let i = 0; i < 7; i++) bell(N.C6 * Math.pow(1.122, i), t + i * 0.06, 0.5, 0.11); },
    grow()     { const t = ctx.currentTime; boing(200, 700, t, 0.5, 0.18); bell(N.E6, t + 0.4, 0.8, 0.15); },
    dress()    { const t = ctx.currentTime; bell(N.A5, t, 0.4, 0.16); bell(N.D6, t + 0.09, 0.6, 0.16); noise(t, 0.15, 0.05, 4000, "highpass"); },
    giggle()   { const t = ctx.currentTime; [N.G5, N.E5, N.G5, N.C6].forEach((f, i) => boing(f, f * 1.3, t + i * 0.08, 0.09, 0.12)); },
    twirl()    { const t = ctx.currentTime; for (let i = 0; i < 5; i++) bell(N.C5 * Math.pow(1.26, i), t + i * 0.09, 0.5, 0.13); }
  };

  function sfx(name) {
    if (!ctx || !enabled) return;
    if (ctx.state === "suspended") ctx.resume();
    if (SFX[name]) SFX[name]();
  }

  /* ---------- BGM: オルゴール・ワルツ(3拍子) ----------
   * 小さなコード進行を延々やさしく循環。夜はゆっくり子守唄に。 */
  const CHORDS = [
    [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5],   // C
    [N.G4/2*1.5 /*unused*/, N.G4, N.B4, N.D5, N.G5, N.B5], // G
    [N.A4/2, N.A4, N.C5, N.E5, N.A5, N.C6], // Am
    [N.F4/2, N.F4, N.A4, N.C5, N.F5, N.A5]  // F
  ];
  const MELODY = [ // [chordIndex内の音階段, 拍オフセット] を2小節ずつ
    [5,0],[4,1],[3,2], [4,0],[5,1],[3,2],
    [5,0],[3,1],[4,2], [5,0],[4,1.5],[3,2],
  ];
  let bar = 0;

  function scheduleBar() {
    if (!ctx) return;
    const beat = nightMode ? 0.62 : 0.5;          // 1拍の長さ
    const t0 = ctx.currentTime + 0.05;
    const chord = CHORDS[bar % 4];
    // ベース(1拍目)
    bell(chord[1] / 2, t0, beat * 2.6, nightMode ? 0.10 : 0.13, bgmGain);
    // 伴奏(2,3拍目)
    bell(chord[2], t0 + beat, beat * 1.2, 0.07, bgmGain);
    bell(chord[3], t0 + beat * 2, beat * 1.2, 0.07, bgmGain);
    // メロディ(オルゴール)
    const phrase = MELODY.slice((bar % 4) * 3, (bar % 4) * 3 + 3);
    phrase.forEach(([deg, off]) => {
      const f = chord[Math.min(5, Math.max(1, deg))];
      bell(f, t0 + off * beat, beat * 2, nightMode ? 0.08 : 0.12, bgmGain);
      if (!nightMode && Math.random() < 0.3) bell(f * 2, t0 + off * beat + beat*0.5, beat, 0.05, bgmGain);
    });
    bar++;
    bgmTimer = setTimeout(scheduleBar, beat * 3 * 1000);
  }

  function startBGM() {
    if (bgmTimer) return;
    scheduleBar();
  }

  return { init, sfx, setEnabled, isEnabled, setNight };
})();
