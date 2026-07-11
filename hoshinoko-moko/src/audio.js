// ほしのこモコ — サウンドエンジン
// 全ての音を Web Audio API でリアルタイム合成する（外部音源ファイル不要）。
// ・BGM: オルゴール風の生成音楽（昼と夜でテンポ/音域が変わる）
// ・SFX: にゃー、ゴロゴロ、ぽん、シャリシャリ、きらきら 等

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI番号 → 周波数

// ペンタトニック（C メジャーペンタ）
const PENTA_DAY = [72, 74, 76, 79, 81, 84, 86, 88];
const PENTA_NIGHT = [60, 62, 64, 67, 69, 72, 74];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.phase = 0; // 0=昼 1=夕 2=夜
    this._bgmTimer = null;
    this._nextNoteTime = 0;
    this._step = 0;
    this._melodyIdx = 3;
    this._purrNodes = null;
    this._cricketTimer = null;
  }

  // ユーザー操作（はじめるボタン）から呼ぶ — iOS のオーディオ解錠
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.5;

    // オルゴールの残響っぽいフィードバックディレイ
    const delay = this.ctx.createDelay(1.0);
    delay.delayTime.value = 0.31;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.28;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.35;
    this.musicBus.connect(this.master);
    this.musicBus.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    // ノイズバッファ（各種SFXで使い回す）
    this.noiseBuf = this._makeNoise(1.5);

    this._startBgm();
    this._scheduleCrickets();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.1);
    }
  }

  setPhase(p) { this.phase = p; }

  _makeNoise(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ================= BGM（オルゴール） ================= */

  _startBgm() {
    this._nextNoteTime = this.ctx.currentTime + 0.2;
    this._bgmTimer = setInterval(() => this._schedulerTick(), 120);
  }

  _schedulerTick() {
    if (!this.ctx) return;
    const beat = this.phase === 2 ? 0.5 : 0.36; // 夜はゆっくり
    while (this._nextNoteTime < this.ctx.currentTime + 0.6) {
      this._scheduleStep(this._nextNoteTime);
      this._nextNoteTime += beat;
      this._step++;
    }
  }

  _scheduleStep(t) {
    const scale = this.phase === 2 ? PENTA_NIGHT : PENTA_DAY;
    const restChance = this.phase === 2 ? 0.45 : 0.3;
    if (Math.random() < restChance) return;

    // なだらかなランダムウォークでメロディを生成
    this._melodyIdx += Math.floor(Math.random() * 5) - 2;
    this._melodyIdx = Math.max(0, Math.min(scale.length - 1, this._melodyIdx));
    this._musicBoxNote(NOTE(scale[this._melodyIdx]), t, 0.16);

    // 8ステップごとに低音のささえ
    if (this._step % 8 === 0) {
      this._musicBoxNote(NOTE(scale[0]) / 2, t, 0.1, 2.2);
    }
  }

  _musicBoxNote(freq, t, vol, dur = 1.4) {
    const o1 = this.ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    const o2 = this.ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 4; // オルゴールの金属的な倍音
    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    g1.gain.setValueAtTime(vol, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g2.gain.setValueAtTime(vol * 0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.4);
    o1.connect(g1).connect(this.musicBus);
    o2.connect(g2).connect(this.musicBus);
    o1.start(t); o1.stop(t + dur + 0.1);
    o2.start(t); o2.stop(t + dur + 0.1);
  }

  /* ============== 環境音（夜の虫の声） ============== */

  _scheduleCrickets() {
    this._cricketTimer = setInterval(() => {
      if (!this.ctx || this.phase !== 2 || this.muted) return;
      if (Math.random() < 0.55) this._cricketChirp();
    }, 900);
  }

  _cricketChirp() {
    const t0 = this.ctx.currentTime + Math.random() * 0.4;
    const n = 3 + Math.floor(Math.random() * 3);
    const f = 4200 + Math.random() * 800;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.07;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.012, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.06);
    }
  }

  /* ================= SFX ================= */

  _env(t, a, d, vol) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.001, t + a + d);
    g.connect(this.sfxBus);
    return g;
  }

  // にゃー（モコの鳴き声）
  nya() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(880, t + 0.12);
    o.frequency.linearRampToValueAtTime(430, t + 0.34);
    // ビブラート
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 7;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 24;
    lfo.connect(lfoG).connect(o.frequency);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.2;
    const g = this._env(t, 0.03, 0.34, 0.35);
    o.connect(bp).connect(g);
    o.start(t); o.stop(t + 0.4);
    lfo.start(t); lfo.stop(t + 0.4);
  }

  // ゴロゴロ（なでなで中）
  purrStart() {
    if (!this.ctx || this._purrNodes) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.15);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 23;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.22;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.sfxBus);
    src.start();
    lfo.start();
    this._purrNodes = { src, lfo, g };
  }

  purrStop() {
    if (!this._purrNodes) return;
    const { src, lfo, g } = this._purrNodes;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    setTimeout(() => { try { src.stop(); lfo.stop(); } catch (e) {} }, 400);
    this._purrNodes = null;
  }

  // ぽん（しゃぼんだま）
  pop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.07);
    const g = this._env(t, 0.005, 0.09, 0.32);
    o.connect(g);
    o.start(t); o.stop(t + 0.12);
  }

  // ぼよん（ボール）
  boing() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(360, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.22);
    const g = this._env(t, 0.01, 0.22, 0.25);
    o.connect(g);
    o.start(t); o.stop(t + 0.28);
  }

  // シャリシャリ（りんごを食べる）
  crunch() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.02;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.9 + Math.random() * 0.4;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 700;
      bp.Q.value = 0.8;
      const g = this._env(t, 0.004, 0.09, 0.28);
      src.connect(bp).connect(g);
      src.start(t, Math.random());
      src.stop(t + 0.12);
    }
  }

  // きらきら（星・スパークル）: comboで音程が上がる
  twinkle(combo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const scale = [79, 81, 84, 86, 88, 91, 93];
    const base = scale[Math.min(combo, scale.length - 1)];
    [0, 4].forEach((iv, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = NOTE(base + iv);
      const g = this._env(t + i * 0.06, 0.01, 0.7, 0.22);
      o.connect(g);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.8);
    });
  }

  // ちりん（お花・ごほうび小）
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [84, 88, 91].forEach((n, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = NOTE(n);
      const g = this._env(t + i * 0.09, 0.01, 0.9, 0.16);
      o.connect(g);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 1.0);
    });
  }

  // じゃーん！（プレゼント・おいわい）
  tada() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = NOTE(n);
      const g = this._env(t + i * 0.11, 0.01, 0.8, 0.22);
      o.connect(g);
      o.start(t + i * 0.11);
      o.stop(t + i * 0.11 + 0.9);
    });
    // シャラララ
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = this._env(t + 0.3, 0.05, 0.6, 0.12);
    src.connect(hp).connect(g);
    src.start(t + 0.3);
    src.stop(t + 1.1);
  }

  // ぴちゃぴちゃ（水）
  splash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    bp.Q.value = 1.0;
    const g = this._env(t, 0.02, 0.4, 0.25);
    src.connect(bp).connect(g);
    src.start(t, Math.random());
    src.stop(t + 0.5);
  }

  // ざーっ（みずやりの間ずっと）
  waterStart() {
    if (!this.ctx || this._waterNodes) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000;
    bp.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.13, this.ctx.currentTime, 0.2);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start();
    this._waterNodes = { src, g };
  }

  waterStop() {
    if (!this._waterNodes) return;
    const { src, g } = this._waterNodes;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    setTimeout(() => { try { src.stop(); } catch (e) {} }, 500);
    this._waterNodes = null;
  }

  // ぴょん（ジャンプ/あるく）
  hop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(480, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.06);
    const g = this._env(t, 0.005, 0.07, 0.08);
    o.connect(g);
    o.start(t); o.stop(t + 0.1);
  }

  // すやすや
  yawn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(500, t);
    o.frequency.linearRampToValueAtTime(720, t + 0.2);
    o.frequency.linearRampToValueAtTime(300, t + 0.7);
    const g = this._env(t, 0.08, 0.65, 0.16);
    o.connect(g);
    o.start(t); o.stop(t + 0.8);
  }
}
