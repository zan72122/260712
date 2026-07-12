/* ============================================================
   audio.js — WebAudio シンセサウンド
   外部ファイルなしで夏の音風景をつくる：
   波 / セミ / スズムシ / 風鈴 / カモメ / 効果音 / ファンファーレ
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  const A = (G.audio = {});
  let ctx = null;
  let master = null;
  let ambient = {}; // 環境音ノード

  A.ready = false;

  /* ---------- 起動（最初のタップで呼ぶ / iOS対応） ---------- */
  A.init = function () {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = G.state.muted ? 0 : 0.85;
    master.connect(ctx.destination);
    A.ready = true;
    startAmbient();
  };

  A.setMuted = function (m) {
    G.state.muted = m;
    try { localStorage.setItem('natsu_muted', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.linearRampToValueAtTime(m ? 0 : 0.85, ctx.currentTime + 0.15);
  };
  try { G.state.muted = localStorage.getItem('natsu_muted') === '1'; } catch (e) {}

  /* ---------- 汎用：ノイズバッファ ---------- */
  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // ややピンク寄りのノイズ
      const white = Math.random() * 2 - 1;
      last = last * 0.94 + white * 0.06;
      d[i] = last * 6 + white * 0.25;
    }
    return noiseBuf;
  }

  /* ============================================================
     環境音（つねに鳴っていて、時刻でミックスが変わる）
     ============================================================ */
  function startAmbient() {
    // --- 波 ---
    const waveSrc = ctx.createBufferSource();
    waveSrc.buffer = getNoise();
    waveSrc.loop = true;
    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.value = 480;
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.0;
    // 寄せては返すゆらぎ（2つのLFO）
    const lfo1 = ctx.createOscillator();
    lfo1.frequency.value = 0.085;
    const lfo1g = ctx.createGain(); lfo1g.gain.value = 0.055;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.031;
    const lfo2g = ctx.createGain(); lfo2g.gain.value = 0.04;
    lfo1.connect(lfo1g).connect(waveGain.gain);
    lfo2.connect(lfo2g).connect(waveGain.gain);
    waveSrc.connect(waveFilter).connect(waveGain).connect(master);
    waveSrc.start(); lfo1.start(); lfo2.start();
    ambient.waveGain = waveGain;

    // --- セミ（ミンミン系のジー） ---
    const semiSrc = ctx.createBufferSource();
    semiSrc.buffer = getNoise();
    semiSrc.loop = true;
    const semiBP = ctx.createBiquadFilter();
    semiBP.type = 'bandpass';
    semiBP.frequency.value = 4200;
    semiBP.Q.value = 9;
    const semiAM = ctx.createGain(); semiAM.gain.value = 0.0;
    const semiLFO = ctx.createOscillator();
    semiLFO.frequency.value = 42; // ジジジ… の粒
    const semiLFOg = ctx.createGain(); semiLFOg.gain.value = 0.012;
    semiLFO.connect(semiLFOg).connect(semiAM.gain);
    semiSrc.connect(semiBP).connect(semiAM).connect(master);
    semiSrc.start(); semiLFO.start();
    ambient.semiGain = semiAM;
    ambient.semiLFO = semiLFO;

    // --- スズムシ（リーン、リーン） ---
    const bellOsc = ctx.createOscillator();
    bellOsc.type = 'sine';
    bellOsc.frequency.value = 4300;
    const bellOsc2 = ctx.createOscillator();
    bellOsc2.type = 'sine';
    bellOsc2.frequency.value = 4308; // うなり
    const bellGain = ctx.createGain();
    bellGain.gain.value = 0;
    bellOsc.connect(bellGain);
    bellOsc2.connect(bellGain);
    bellGain.connect(master);
    bellOsc.start(); bellOsc2.start();
    ambient.cricketGain = bellGain;
    ambient.cricketPhase = 0;
  }

  /* 毎フレーム：時刻に合わせてミックス調整 */
  A.update = function (dt) {
    if (!ctx || ctx.state !== 'running') return;
    const day = G.env.dayLight;      // 0..1
    const night = G.env.nightGlow;   // 0..1
    const t = ctx.currentTime;

    if (ambient.waveGain) {
      // 基本の波音量（LFOが上に乗る）
      const base = 0.05 + day * 0.02;
      ambient.waveGain.gain.setTargetAtTime(base, t, 0.5);
    }
    if (ambient.semiGain) {
      // 昼だけセミ。強めの午後
      const semi = Math.max(0, day - 0.25) * 0.028;
      ambient.semiGain.gain.setTargetAtTime(semi, t, 1.2);
    }
    if (ambient.cricketGain) {
      // 夜のスズムシ：リズミカルにリーン…リーン…
      ambient.cricketPhase += dt;
      const cyc = ambient.cricketPhase % 1.7;
      const chirp = cyc < 0.85 ? (Math.sin(cyc * Math.PI / 0.85) * (0.5 + 0.5 * Math.sin(cyc * 66))) : 0;
      ambient.cricketGain.gain.setTargetAtTime(night * 0.016 * Math.max(0, chirp), t, 0.03);
    }
  };

  /* ============================================================
     ワンショット効果音
     ============================================================ */
  function env(gainNode, t0, attack, peak, decay) {
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(peak, t0 + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone(freq, t0, dur, peak, type = 'sine', dest = null) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    env(g, t0, 0.012, peak, dur);
    o.connect(g).connect(dest || master);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }

  // ぽん（UI）
  A.pop = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(520, t, 0.09, 0.25, 'triangle');
    tone(780, t + 0.03, 0.1, 0.18, 'triangle');
  };

  // キラン（かいがら・ほたる）
  A.chime = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(1318, t, 0.35, 0.22);
    tone(1760, t + 0.07, 0.4, 0.18);
    tone(2637, t + 0.13, 0.5, 0.12);
  };

  // つかまえたファンファーレ
  A.fanfare = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      tone(f, t + i * 0.11, 0.32, 0.22, 'triangle');
      tone(f * 2, t + i * 0.11, 0.2, 0.07);
    });
    tone(1318, t + 0.48, 0.6, 0.16, 'triangle');
  };

  // 大物ファンファーレ
  A.bigFanfare = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const seq = [523, 523, 523, 659, 784, 784, 1046];
    const dur = [0.1, 0.1, 0.1, 0.14, 0.14, 0.14, 0.5];
    let acc = 0;
    seq.forEach((f, i) => {
      tone(f, t + acc, dur[i] + 0.2, 0.2, 'square');
      tone(f, t + acc, dur[i] + 0.25, 0.14, 'triangle');
      acc += dur[i];
    });
  };

  // ぽちゃん（うき投入）/ ばしゃっ（大）
  A.splash = function (big = false) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(big ? 2400 : 1400, t);
    f.frequency.exponentialRampToValueAtTime(220, t + (big ? 0.5 : 0.25));
    const g = ctx.createGain();
    env(g, t, 0.01, big ? 0.5 : 0.22, big ? 0.55 : 0.28);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + 1);
    if (!big) tone(300, t, 0.12, 0.12, 'sine'); // ぽちゃ感
  };

  // ころころ（あるく足音がわり・すな）
  A.step = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 1.5;
    const g = ctx.createGain();
    env(g, t, 0.004, 0.045, 0.07);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.15);
  };

  // ばしゃばしゃ（浅瀬）
  A.wade = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    const g = ctx.createGain();
    env(g, t, 0.01, 0.08, 0.16);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.3);
  };

  // ビビビ（あたり！）
  A.bite = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      tone(880, t + i * 0.14, 0.09, 0.3, 'square');
      tone(660, t + i * 0.14 + 0.05, 0.08, 0.2, 'square');
    }
  };

  // 風鈴 チリーン
  A.furin = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f0 = G.pick([2093, 2349, 2637]);
    tone(f0, t, 1.6, 0.1);
    tone(f0 * 2.76, t, 0.9, 0.05);
    tone(f0 * 1.02, t + 0.12, 1.8, 0.06);
  };

  // カモメ ミャー
  A.gull = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1150, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.28);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2.5;
    const g = ctx.createGain();
    env(g, t, 0.04, 0.06, 0.3);
    o.connect(f).connect(g).connect(master);
    o.start(t); o.stop(t + 0.5);
  };

  // すいか パカーン！
  A.suika = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(150, t + 0.2);
    const g = ctx.createGain();
    env(g, t, 0.005, 0.5, 0.22);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.5);
    tone(180, t, 0.18, 0.3, 'sine');
    // ぱらぱら…
    for (let i = 0; i < 5; i++) tone(G.rand(500, 900), t + 0.1 + i * 0.05, 0.07, 0.05, 'triangle');
  };

  // こつん（すいかを叩く）
  A.knock = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(220, t, 0.1, 0.35, 'sine');
    tone(440, t, 0.06, 0.1, 'triangle');
  };

  // 花火 ヒュ〜…ドーン
  A.firework = function (delaySec = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delaySec;
    // ヒュ〜
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(1800, t + 0.9);
    const og = ctx.createGain();
    env(og, t, 0.05, 0.035, 0.95);
    o.connect(og).connect(master);
    o.start(t); o.stop(t + 1.1);
    // ドーン
    const bt = t + 1.0;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1600, bt);
    f.frequency.exponentialRampToValueAtTime(90, bt + 1.4);
    const g = ctx.createGain();
    env(g, bt, 0.008, 0.45, 1.5);
    src.connect(f).connect(g).connect(master);
    src.start(bt); src.stop(bt + 2);
  };

  // あみを ぶんっ
  A.swish = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.16);
    const g = ctx.createGain();
    env(g, t, 0.02, 0.16, 0.18);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.4);
  };

  // カニ ちょきちょき
  A.crab = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      tone(2600, t + i * 0.12, 0.03, 0.12, 'square');
      tone(3100, t + i * 0.12 + 0.03, 0.03, 0.08, 'square');
    }
  };

  // イルカ キュイー
  A.dolphin = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(2800, t + 0.22);
    o.frequency.exponentialRampToValueAtTime(1900, t + 0.4);
    const g = ctx.createGain();
    env(g, t, 0.03, 0.08, 0.4);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.6);
  };
})();
