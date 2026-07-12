/* ============================================================
   audio.js — 100% procedural WebAudio: a gentle music-box
   melody that loops forever, plus toy-like sound effects.
   No audio files needed, works offline on iOS Safari
   (context is created/resumed on the first user tap).
   ============================================================ */

(function (K) {
  "use strict";

  const Audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    muted: false,
    _timer: null,
  };
  K.Audio = Audio;

  Audio.init = function () {
    if (Audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    Audio.ctx = ctx;

    Audio.master = ctx.createGain();
    Audio.master.gain.value = 0.9;
    Audio.master.connect(ctx.destination);

    Audio.musicGain = ctx.createGain();
    Audio.musicGain.gain.value = 0.34;
    Audio.musicGain.connect(Audio.master);

    Audio.sfxGain = ctx.createGain();
    Audio.sfxGain.gain.value = 0.8;
    Audio.sfxGain.connect(Audio.master);

    startMusic();
  };

  Audio.resume = function () {
    if (Audio.ctx && Audio.ctx.state === "suspended") Audio.ctx.resume();
  };

  Audio.setMuted = function (m) {
    Audio.muted = m;
    if (Audio.master) Audio.master.gain.value = m ? 0 : 0.9;
  };

  // ---------------- music-box sequencer ----------------
  // Happy pentatonic tune in C major, 8 bars, loops forever.
  const N = { C4: 262, D4: 294, E4: 330, G4: 392, A4: 440,
              C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, R: 0 };

  // melody: [note, beats]
  const MELODY = [
    [N.E5,1],[N.G5,1],[N.E5,1],[N.C5,1], [N.D5,1],[N.E5,1],[N.D5,2],
    [N.C5,1],[N.D5,1],[N.E5,1],[N.G5,1], [N.A5,2],[N.G5,2],
    [N.E5,1],[N.G5,1],[N.A5,1],[N.G5,1], [N.E5,1],[N.D5,1],[N.C5,2],
    [N.D5,1],[N.E5,1],[N.D5,1],[N.C5,1], [N.D5,2],[N.C5,2],
  ];
  const BASS = [N.C4, N.G4, N.A4, N.E4, N.C4, N.G4, N.D4, N.C4]; // one per bar
  const BPM = 108;
  const BEAT = 60 / BPM;

  function musicBoxNote(freq, when, dur, vel) {
    const ctx = Audio.ctx;
    if (!freq) return;
    // two slightly detuned triangles + a sine octave sparkle = toy music box
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 1.9);
    g.connect(Audio.musicGain);

    [[freq, "triangle", 1], [freq * 1.003, "triangle", 0.5], [freq * 2, "sine", 0.22]]
      .forEach(([f, type, amt]) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = amt;
        o.connect(og); og.connect(g);
        o.start(when); o.stop(when + dur * 2);
      });
  }

  function bassNote(freq, when, dur) {
    const ctx = Audio.ctx;
    const o = ctx.createOscillator();
    o.type = "sine"; o.frequency.value = freq / 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.16, when + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(Audio.musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  }

  let loopStart = 0;
  const LOOP_BEATS = 32;

  function scheduleLoop(t0) {
    let t = t0;
    for (const [f, beats] of MELODY) {
      musicBoxNote(f, t, BEAT * beats * 0.9, 0.5);
      t += BEAT * beats;
    }
    for (let bar = 0; bar < 8; bar++) {
      bassNote(BASS[bar], t0 + bar * 4 * BEAT, 4 * BEAT);
      // soft off-beat "tick" like a toy shaker
      for (let b = 0; b < 4; b++) tick(t0 + (bar * 4 + b + 0.5) * BEAT);
    }
  }

  function tick(when) {
    const ctx = Audio.ctx;
    const len = 0.04, sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(hp); hp.connect(g); g.connect(Audio.musicGain);
    src.start(when);
  }

  function startMusic() {
    const ctx = Audio.ctx;
    loopStart = ctx.currentTime + 0.1;
    scheduleLoop(loopStart);
    // schedule the next loop ~1s before the current one ends
    Audio._timer = setInterval(() => {
      if (!Audio.ctx) return;
      const loopDur = LOOP_BEATS * BEAT;
      if (ctx.currentTime > loopStart + loopDur - 1.2) {
        loopStart += loopDur;
        scheduleLoop(loopStart);
      }
    }, 400);
  }

  // ---------------- sound effects ----------------

  function blip(freq, dur, type, vol, slideTo) {
    const ctx = Audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Audio.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // sparkly two-note chime when picking a star
  Audio.sfxStar = function (combo) {
    if (!Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    const base = 660 * Math.pow(1.06, Math.min(combo || 0, 12));
    [[base, 0], [base * 1.5, 0.07]].forEach(([f, dt]) => {
      const o = Audio.ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      const g = Audio.ctx.createGain();
      g.gain.setValueAtTime(0.28, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.35);
      o.connect(g); g.connect(Audio.sfxGain);
      o.start(t + dt); o.stop(t + dt + 0.4);
    });
  };

  Audio.sfxJump = function () { blip(300, 0.22, "sine", 0.22, 640); };
  Audio.sfxBoing = function () { blip(160, 0.4, "sine", 0.34, 900); };
  Audio.sfxSplash = function () {
    if (!Audio.ctx) return;
    const ctx = Audio.ctx, t = ctx.currentTime, len = 0.5;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + len);
    const g = ctx.createGain(); g.gain.value = 0.4;
    src.connect(lp); lp.connect(g); g.connect(Audio.sfxGain);
    src.start(t);
  };

  Audio.sfxPop = function () { blip(880, 0.12, "square", 0.12, 1400); };

  // happy fanfare when a friend is found
  Audio.sfxFanfare = function () {
    if (!Audio.ctx) return;
    const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]];
    const t = Audio.ctx.currentTime;
    seq.forEach(([f, dt]) => {
      const o = Audio.ctx.createOscillator();
      o.type = "triangle"; o.frequency.value = f;
      const g = Audio.ctx.createGain();
      g.gain.setValueAtTime(0.3, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.5);
      o.connect(g); g.connect(Audio.sfxGain);
      o.start(t + dt); o.stop(t + dt + 0.55);
    });
  };

  // distant firework thump + crackle
  Audio.sfxFirework = function () {
    if (!Audio.ctx) return;
    const ctx = Audio.ctx, t = ctx.currentTime;
    blip(90, 0.5, "sine", 0.4, 40);
    const len = 0.7;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const e = Math.pow(1 - i / d.length, 3);
      d[i] = (Math.random() * 2 - 1) * e * (Math.random() > 0.97 ? 1 : 0.25);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.3;
    src.connect(g); g.connect(Audio.sfxGain);
    src.start(t + 0.05);
  };

  Audio.sfxStep = function () { blip(200 + Math.random() * 60, 0.05, "sine", 0.045); };

})(window.KIRA);
