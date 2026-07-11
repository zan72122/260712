/* ================================================================
   audio.js — procedural WebAudio: music-box BGM + toy-like SFX
   Everything is synthesised, no audio files needed.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.Audio = (function () {
  let ctx = null;
  let master = null, musicBus = null, sfxBus = null;
  let muted = false;
  let started = false;

  // A-major pentatonic — always sounds happy, never dissonant
  const PENTA = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77, 1108.73, 1318.5, 1479.98, 1760];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.34;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.85;
      sfxBus.connect(master);
      return true;
    } catch (e) { return false; }
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  /* ---------- tiny synth helpers ---------- */

  function bell(freq, t, dur, vol, bus, type) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
    // soft octave shimmer on top
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(vol * 0.28, t + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
    o2.connect(g2); g2.connect(bus || sfxBus);
    o2.start(t); o2.stop(t + dur + 0.05);
  }

  function blip(f0, f1, t, dur, vol, type) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noiseBurst(t, dur, vol, hp) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp || 1200;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t);
  }

  /* ---------- SFX ---------- */

  const SFX = {
    // one prop got painted — sparkling 3-note run
    paint(n) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const base = (n || 0) % 5;
      bell(PENTA[base], t, 0.5, 0.32);
      bell(PENTA[base + 2], t + 0.07, 0.5, 0.28);
      bell(PENTA[base + 4], t + 0.14, 0.7, 0.3);
      noiseBurst(t, 0.18, 0.10, 2500);
    },
    // star pickup — rising note per star collected
    star(i) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      bell(PENTA[i % PENTA.length], t, 0.6, 0.4);
      bell(PENTA[(i + 3) % PENTA.length] * 2, t + 0.05, 0.4, 0.15);
    },
    jump() { blip(340, 720, ctx ? ctx.currentTime : 0, 0.18, 0.22, 'triangle'); },
    land() { blip(260, 90, ctx ? ctx.currentTime : 0, 0.12, 0.16, 'sine'); },
    hop()  { blip(500, 900, ctx ? ctx.currentTime : 0, 0.1, 0.08, 'triangle'); },
    splat() {
      if (!ctx || muted) return;
      blip(400, 120, ctx.currentTime, 0.16, 0.2, 'sawtooth');
      noiseBurst(ctx.currentTime, 0.12, 0.12, 800);
    },
    pop() { blip(700, 1400, ctx ? ctx.currentTime : 0, 0.09, 0.2, 'sine'); },
    // zone complete — joyous fanfare arpeggio
    fanfare() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const seq = [0, 2, 4, 5, 7, 9];
      seq.forEach((s, i) => bell(PENTA[s % PENTA.length], t + i * 0.09, 0.8, 0.34));
      bell(PENTA[9], t + 0.62, 1.4, 0.4);
      bell(PENTA[7], t + 0.62, 1.4, 0.26);
      bell(PENTA[4], t + 0.62, 1.4, 0.22);
    },
    // whole island finished — long celebration
    finale() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 12; i++) {
        bell(PENTA[(i * 2) % PENTA.length], t + i * 0.11, 0.9, 0.3);
      }
      [0, 4, 7].forEach(s => bell(PENTA[s] , t + 1.4, 2.4, 0.34));
      [0, 4, 7].forEach(s => bell(PENTA[s] * 2, t + 1.5, 2.2, 0.16));
    },
    firework() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      noiseBurst(t, 0.5, 0.16, 500);
      bell(PENTA[Math.floor(Math.random() * 6) + 4], t + 0.03, 0.8, 0.14);
    },
  };

  /* ---------- Music-box BGM ----------
     Gentle 8-bar loop; a counter-melody layer joins as the island
     gets more colourful. Scheduled with a small look-ahead. */

  const BPM = 92;
  const STEP = 60 / BPM / 2;         // 8th notes
  //  main melody (indices into PENTA, -1 = rest), 64 steps = 8 bars
  const MELODY = [
    0,-1, 2,-1, 4,-1, 2,-1,  5,-1, 4,-1, 2, -1, 0,-1,
    2,-1, 4,-1, 5,-1, 7,-1,  5,-1, 4, 2,  4,-1,-1,-1,
    0,-1, 2,-1, 4,-1, 2,-1,  5,-1, 7,-1,  9,-1, 7,-1,
    5,-1, 4,-1, 2,-1, 4,-1,  0,-1,-1,-1,  -1,-1,-1,-1,
  ];
  // sparkly counter melody (joins when world is >40% painted)
  const COUNTER = [
    -1,-1,-1, 7,-1,-1,-1, 9, -1,-1,-1, 7,-1,-1, 5,-1,
    -1,-1,-1, 9,-1,-1,-1,10, -1,-1, 9,-1, 7,-1,-1,-1,
    -1,-1,-1, 7,-1,-1,-1, 9, -1,-1,-1,10,-1,-1, 9,-1,
    -1,-1, 7,-1,-1, 9,-1,-1,  7,-1,-1,-1, -1,-1,-1,-1,
  ];
  // soft bass pad root per bar (freq ratios of A2)
  const BASS = [110, 110, 146.83, 164.81, 110, 110, 146.83, 110];

  let step = 0;
  let nextTime = 0;
  let schedTimer = null;
  let layer2 = false;

  function scheduleLoop() {
    if (!ctx || muted) return;
    while (nextTime < ctx.currentTime + 0.35) {
      const s = step % 64;
      const m = MELODY[s];
      if (m >= 0) bell(PENTA[m], nextTime, STEP * 3.2, 0.16, musicBus);
      if (layer2) {
        const c = COUNTER[s];
        if (c >= 0) bell(PENTA[c] * 2, nextTime, STEP * 2.4, 0.06, musicBus);
      }
      if (s % 8 === 0) {
        const b = BASS[(s / 8) | 0];
        bell(b, nextTime, STEP * 7, 0.10, musicBus, 'triangle');
        bell(b * 2, nextTime, STEP * 6, 0.05, musicBus, 'sine');
      }
      nextTime += STEP;
      step++;
    }
  }

  function startMusic() {
    if (!ensure() || started) return;
    started = true;
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    schedTimer = setInterval(scheduleLoop, 120);
  }

  return {
    resume, startMusic,
    sfx: SFX,
    setLayer2(v) { layer2 = v; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      if (!muted && ctx) nextTime = ctx.currentTime + 0.1; // resume loop cleanly
      return muted;
    },
    get muted() { return muted; },
  };
})();
