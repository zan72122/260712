/* =========================================================================
 * きらきら ドリームバレー — オーディオエンジン
 * 外部アセットゼロ。WebAudio だけでオルゴール風BGM・環境音・効果音を生成する。
 * ========================================================================= */
(function () {
  'use strict';

  const DV = (window.DV = window.DV || {});

  // 音名 → 周波数
  const NOTE = (() => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const map = {};
    for (let oct = 1; oct <= 7; oct++) {
      names.forEach((n, i) => {
        const midi = (oct + 1) * 12 + i;
        map[n + oct] = 440 * Math.pow(2, (midi - 69) / 12);
      });
    }
    return map;
  })();

  const Audio = {
    ctx: null,
    master: null,
    musicBus: null,
    sfxBus: null,
    ambientBus: null,
    started: false,
    musicOn: true,
    _seqTimer: null,
    _nextNoteTime: 0,
    _step: 0,
    _chordIdx: 0,
    night: false,
    waterfallGain: null,

    /* ---------------- 起動（ユーザー操作から呼ぶ） ---------------- */
    start() {
      if (this.started) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.started = true;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.72;
      // やわらかいリバーブ風ディレイ
      const dly = this.ctx.createDelay(0.6);
      dly.delayTime.value = 0.31;
      const fb = this.ctx.createGain(); fb.gain.value = 0.24;
      const wet = this.ctx.createGain(); wet.gain.value = 0.28;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      this.musicBus.connect(this.master);
      this.musicBus.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(wet); wet.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1.0;
      this.sfxBus.connect(this.master);
      this.sfxBus.connect(dly);

      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = 0.5;
      this.ambientBus.connect(this.master);

      this._startAmbient();
      this._startSequencer();

      // iOS: サスペンド解除
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

    toggleMusic() {
      this.musicOn = !this.musicOn;
      if (this.musicBus) {
        const t = this.ctx.currentTime;
        this.musicBus.gain.cancelScheduledValues(t);
        this.musicBus.gain.linearRampToValueAtTime(this.musicOn ? 0.72 : 0, t + 0.4);
      }
      return this.musicOn;
    },

    setNight(n) { this.night = n; },

    /* ---------------- 環境音（滝・そよ風） ---------------- */
    _noiseBuffer(sec) {
      const len = Math.floor(this.ctx.sampleRate * sec);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    },

    _startAmbient() {
      // 滝＆せせらぎ：ループするフィルタノイズ。ゲーム側が距離でゲインを更新する。
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(2.0);
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1600;
      this.waterfallGain = this.ctx.createGain();
      this.waterfallGain.gain.value = 0;
      src.connect(bp); bp.connect(lp); lp.connect(this.waterfallGain);
      this.waterfallGain.connect(this.ambientBus);
      src.start();

      // そよ風：とても静かなローパスノイズがゆっくり揺れる
      const wsrc = this.ctx.createBufferSource();
      wsrc.buffer = this._noiseBuffer(3.0);
      wsrc.loop = true;
      const wlp = this.ctx.createBiquadFilter();
      wlp.type = 'lowpass'; wlp.frequency.value = 320;
      const wg = this.ctx.createGain(); wg.gain.value = 0.05;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.03;
      lfo.connect(lfoG); lfoG.connect(wg.gain);
      wsrc.connect(wlp); wlp.connect(wg); wg.connect(this.ambientBus);
      wsrc.start(); lfo.start();
    },

    setWaterfallLevel(v) {
      if (!this.waterfallGain) return;
      const t = this.ctx.currentTime;
      this.waterfallGain.gain.setTargetAtTime(Math.min(0.5, v), t, 0.3);
    },

    /* ---------------- BGM シーケンサー ---------------- */
    // ハ長調ペンタトニックのオルゴール子守唄（3/4拍子）
    _chords: [
      { root: 'C3', notes: ['C4', 'E4', 'G4'] },
      { root: 'A2', notes: ['A3', 'C4', 'E4'] },
      { root: 'F2', notes: ['F3', 'A3', 'C4'] },
      { root: 'G2', notes: ['G3', 'B3', 'D4'] },
    ],
    _penta: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'],
    _melodyPos: 3,

    _startSequencer() {
      const stepDur = () => 0.32; // 8分音符 ≒ 94bpm
      this._nextNoteTime = this.ctx.currentTime + 0.2;
      const tick = () => {
        if (!this.ctx) return;
        while (this._nextNoteTime < this.ctx.currentTime + 0.15) {
          this._scheduleStep(this._step, this._nextNoteTime);
          this._nextNoteTime += stepDur();
          this._step++;
        }
      };
      this._seqTimer = setInterval(tick, 40);
    },

    _scheduleStep(step, t) {
      const bar = Math.floor(step / 6);       // 3/4 → 6 ステップ/小節
      const beat = step % 6;

      // 2小節ごとにコードチェンジ
      if (beat === 0 && bar % 2 === 0) {
        this._chordIdx = [0, 1, 2, 3][Math.floor(bar / 2) % 4];
        const ch = this._chords[this._chordIdx];
        this._pad(ch.notes, t, 3.6);
        this._pluck(NOTE[ch.root], t, 0.16, 2.2);   // ベースのハープ
      }
      // コードトーンのアルペジオ（ハープ）
      if (beat === 2 || beat === 4) {
        const ch = this._chords[this._chordIdx];
        const n = ch.notes[(Math.floor(step / 2) + this._chordIdx) % ch.notes.length];
        this._pluck(NOTE[n] * 2, t, 0.05, 1.6);
      }
      // オルゴールのメロディ：なだらかなランダムウォーク
      const density = this.night ? 0.42 : 0.62;
      if ((beat === 0 || beat === 2 || beat === 3 || beat === 5) && Math.random() < density) {
        const stepMove = [-2, -1, -1, 0, 1, 1, 1, 2][(Math.random() * 8) | 0];
        this._melodyPos = Math.max(0, Math.min(this._penta.length - 1, this._melodyPos + stepMove));
        this._musicBox(NOTE[this._penta[this._melodyPos]], t, 0.10);
      }
      // 夜はときどききらめきの高音
      if (this.night && beat === 0 && Math.random() < 0.3) {
        this._musicBox(NOTE['E7'] || 2637, t + 0.16, 0.03);
      }
    },

    // オルゴール音：基音＋高次倍音、指数減衰
    _musicBox(freq, t, vol) {
      if (!this.musicOn) return;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      g.connect(this.musicBus);
      [[1, 1], [3.01, 0.28], [5.4, 0.09]].forEach(([mult, amp]) => {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * mult;
        const og = this.ctx.createGain(); og.gain.value = amp;
        o.connect(og); og.connect(g);
        o.start(t); o.stop(t + 1.8);
      });
    },

    // ハープ／ベースのプラック
    _pluck(freq, t, vol, dur) {
      if (!this.musicOn) return;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(freq * 6, t);
      f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this.musicBus);
      o.start(t); o.stop(t + dur + 0.1);
    },

    // ふんわりパッド
    _pad(notes, t, dur) {
      if (!this.musicOn) return;
      notes.forEach((n, i) => {
        [-4, 4].forEach((det) => {
          const o = this.ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = NOTE[n];
          o.detune.value = det;
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 700;
          const g = this.ctx.createGain();
          const v = 0.028;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(v, t + 0.9);
          g.gain.setValueAtTime(v, t + dur - 1.2);
          g.gain.linearRampToValueAtTime(0, t + dur);
          o.connect(f); f.connect(g); g.connect(this.musicBus);
          o.start(t); o.stop(t + dur + 0.1);
        });
      });
    },

    /* ---------------- 効果音 ---------------- */
    _tone(freq, t, dur, vol, type, bus) {
      const o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || this.sfxBus);
      o.start(t); o.stop(t + dur + 0.05);
    },

    ready() { return this.started && this.ctx; },

    // 星ゲット：上昇キラキラ
    sfxStar() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      [NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) => this._musicBoxSfx(f, t + i * 0.06, 0.12));
    },

    _musicBoxSfx(freq, t, vol) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      g.connect(this.sfxBus);
      [[1, 1], [3.01, 0.25]].forEach(([m, a]) => {
        const o = this.ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = freq * m;
        const og = this.ctx.createGain(); og.gain.value = a;
        o.connect(og); og.connect(g);
        o.start(t); o.stop(t + 1.2);
      });
    },

    // フルーツ：ぽん！
    sfxPop() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.2);
    },

    // 虹のかけら：魔法のアルペジオ＋シマー
    sfxShard() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7].forEach((f, i) =>
        this._musicBoxSfx(f, t + i * 0.07, 0.13));
      // シマー（高域ノイズ）
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(1.2);
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      src.connect(hp); hp.connect(g); g.connect(this.sfxBus);
      src.start(t);
    },

    // どうぶつの鳴き声（種類ごとにピッチが違うかわいい「きゅっ」）
    sfxSqueak(pitch) {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const base = 500 * (pitch || 1);
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.07);
      o.frequency.exponentialRampToValueAtTime(base * 1.15, t + 0.16);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.25);
    },

    // ことりのさえずり
    sfxChirp() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.09;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(2300 + Math.random() * 500, tt);
        o.frequency.exponentialRampToValueAtTime(3100, tt + 0.05);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06, tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
        o.connect(g); g.connect(this.sfxBus);
        o.start(tt); o.stop(tt + 0.1);
      }
    },

    // ともだちになった！ハッピージングル
    sfxFriend() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      [NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6, NOTE.E6, NOTE.C7].forEach((f, i) =>
        this._musicBoxSfx(f, t + i * 0.09, 0.12));
    },

    // 水しぶき
    sfxSplash() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(0.5);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1200, t);
      bp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
      bp.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      src.connect(bp); bp.connect(g); g.connect(this.sfxBus);
      src.start(t);
    },

    // 花火：ひゅ〜…ぱん！
    sfxFirework(delaySec) {
      if (!this.ready()) return;
      const t = this.ctx.currentTime + (delaySec || 0);
      // ひゅ〜
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(500, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.7);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.035, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.7);
      g.gain.linearRampToValueAtTime(0, t + 0.75);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.8);
      // ぱん＋きらきら
      const bt = t + 0.78;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(1.0);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, bt);
      lp.frequency.exponentialRampToValueAtTime(300, bt + 0.9);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.16, bt);
      bg.gain.exponentialRampToValueAtTime(0.0001, bt + 0.95);
      src.connect(lp); lp.connect(bg); bg.connect(this.sfxBus);
      src.start(bt);
      [NOTE.C7, NOTE.G6, NOTE.E7 || 2637].forEach((f, i) =>
        this._musicBoxSfx(f, bt + 0.08 + i * 0.1, 0.05));
    },

    // 地面タップ：やさしい「ぽん」
    sfxTap() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      this._tone(NOTE.A5, t, 0.14, 0.05, 'sine');
    },

    // おきがえ：しゃらん
    sfxDress() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      [NOTE.D6, NOTE.G6, NOTE.B6 || 1975].forEach((f, i) => this._musicBoxSfx(f, t + i * 0.05, 0.1));
    },

    // 木をゆらす：さわさわ＋ぽとん
    sfxShake() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(0.4);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 4000; bp.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      src.connect(bp); bp.connect(g); g.connect(this.sfxBus);
      src.start(t);
    },

    // 大celebration ファンファーレ
    sfxFanfare() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      const seq = [
        [NOTE.C5, 0], [NOTE.E5, 0.14], [NOTE.G5, 0.28], [NOTE.C6, 0.42],
        [NOTE.G5, 0.62], [NOTE.C6, 0.76], [NOTE.E6, 0.9], [NOTE.G6, 1.04], [NOTE.C7, 1.24],
      ];
      seq.forEach(([f, d]) => this._musicBoxSfx(f, t + d, 0.14));
      this._pad(['C4', 'E4', 'G4'], t + 0.4, 3.2);
    },
  };

  DV.Audio = Audio;
})();
