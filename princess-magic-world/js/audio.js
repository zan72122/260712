// ============================================================
// オーディオ — WebAudio だけで作るオルゴール音楽と効果音
// 外部ファイル不要。iOS ではユーザー操作後に init() を呼ぶこと。
// ============================================================

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class KidsAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      console.warn('WebAudio unavailable', e);
      return;
    }
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    // キラキラ感を出す残響ふうディレイ
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.31;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.34;
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0.22;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.master);

    this._startMusic();
    this.started = true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, t + 0.25);
  }

  // ---------------- オルゴールのワルツ（3拍子・オリジナル曲） ----------------
  _startMusic() {
    const bpm = 92;
    this.beat = 60 / bpm;
    this.barLen = this.beat * 3;

    // 8小節のフレーズ: [コード構成音(MIDI)], メロディ [MIDI, 開始拍, 長さ拍]
    this.chords = [
      [36, 55, 60, 64], // C
      [31, 55, 59, 62], // G
      [33, 52, 57, 60], // Am
      [29, 53, 57, 60], // F
      [36, 55, 60, 64], // C
      [29, 53, 57, 60], // F
      [31, 55, 59, 62], // G
      [36, 55, 60, 64], // C
    ];
    this.melody = [
      // bar, beat, midi, 長さ(拍)
      [0, 0, 76, 1], [0, 1, 79, 1], [0, 2, 84, 1],
      [1, 0, 83, 3],
      [2, 0, 81, 1], [2, 1, 84, 1], [2, 2, 76, 1],
      [3, 0, 79, 3],
      [4, 0, 77, 1], [4, 1, 81, 1], [4, 2, 79, 1],
      [5, 0, 76, 1], [5, 1, 79, 1], [5, 2, 77, 1],
      [6, 0, 74, 1], [6, 1, 79, 1], [6, 2, 83, 1],
      [7, 0, 84, 2], [7, 2, 79, 0.5], [7, 2.5, 84, 0.5],
    ];

    this._nextPhraseTime = this.ctx.currentTime + 0.3;
    this._schedTimer = setInterval(() => this._scheduleMusic(), 400);
  }

  _scheduleMusic() {
    if (!this.ctx || this.muted) {
      // ミュート中も時刻だけ進めてズレを防ぐ
      while (this._nextPhraseTime < this.ctx.currentTime + 0.5) {
        this._nextPhraseTime += this.barLen * 8;
      }
      return;
    }
    const ahead = 1.2;
    while (this._nextPhraseTime < this.ctx.currentTime + ahead) {
      this._schedulePhrase(this._nextPhraseTime);
      this._nextPhraseTime += this.barLen * 8;
    }
  }

  _schedulePhrase(t0) {
    for (let bar = 0; bar < 8; bar++) {
      const barT = t0 + bar * this.barLen;
      const chord = this.chords[bar];
      // ベース（1拍目）
      this._musicNote(chord[0] + 12, barT, 1.4, 0.16, 'triangle');
      // コード（2・3拍目にそっと）
      for (const n of [chord[1], chord[2], chord[3]]) {
        this._musicNote(n, barT + this.beat, 0.9, 0.045, 'sine');
        this._musicNote(n + 12, barT + this.beat * 2, 0.9, 0.03, 'sine');
      }
    }
    // メロディ（オルゴール音色）
    for (const [bar, beat, midi, len] of this.melody) {
      const t = t0 + bar * this.barLen + beat * this.beat;
      this._musicBoxNote(midi, t, Math.max(1.2, len * this.beat * 1.1), 0.14);
    }
  }

  // オルゴール音色 = 基音 + 高次倍音、鋭いアタックと長い減衰
  _musicBoxNote(midi, t, dur, vol) {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.musicGain);
    g.connect(this.delay);

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = f;
    o1.connect(g);
    o1.start(t); o1.stop(t + dur + 0.05);

    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    g2.connect(g);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 4;
    o2.connect(g2);
    o2.start(t); o2.stop(t + dur * 0.5);
  }

  _musicNote(midi, t, dur, vol, type = 'sine') {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.musicGain);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = midiToFreq(midi);
    o.connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------------- 効果音 ----------------
  _blip(freq, t, dur, vol, type = 'sine', freqEnd) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.sfxGain);
    g.connect(this.delay);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    o.connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _noise(t, dur, vol, filterFreq = 2000, filterEnd) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, t);
    if (filterEnd) filter.frequency.exponentialRampToValueAtTime(filterEnd, t + dur);
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ⭐取得音: ペンタトニックで少しずつ上がるチャイム
  playCollect(step) {
    if (!this.ctx) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const base = 72 + scale[step % scale.length];
    const t = this.now;
    this._blip(midiToFreq(base), t, 0.5, 0.22, 'sine');
    this._blip(midiToFreq(base + 12), t + 0.07, 0.6, 0.14, 'sine');
  }

  // 💖取得音: あたたかい和音
  playHeart() {
    const t = this.now;
    for (const [i, m] of [67, 71, 74, 79].entries()) {
      this._blip(midiToFreq(m), t + i * 0.05, 0.9, 0.12, 'sine');
    }
  }

  // くるくるターンの音
  playTwirl() {
    this._noise(this.now, 0.6, 0.14, 500, 3500);
    this.playGliss(76, 4, 0.05);
  }

  // ハープのグリッサンド（ユニコーン・魔法）
  playGliss(baseMidi = 72, count = 6, gap = 0.06) {
    if (!this.ctx) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    const t = this.now;
    for (let i = 0; i < count; i++) {
      this._blip(midiToFreq(baseMidi + scale[i % scale.length]), t + i * gap, 0.8, 0.11, 'triangle');
    }
  }

  // 花火
  playFirework() {
    const t = this.now;
    this._noise(t, 0.5, 0.3, 250, 60);
    for (let i = 0; i < 6; i++) {
      this._blip(1200 + Math.random() * 2200, t + 0.1 + Math.random() * 0.5, 0.1, 0.05, 'sine');
    }
  }

  playPop() {
    this._blip(500, this.now, 0.12, 0.2, 'sine', 900);
  }

  // 小鳥・うさぎの鳴き声
  playChirp() {
    const t = this.now;
    this._blip(1000, t, 0.09, 0.13, 'sine', 1600);
    this._blip(1250, t + 0.11, 0.1, 0.12, 'sine', 1750);
  }

  // あひるのクワッ
  playQuack() {
    const t = this.now;
    this._blip(320, t, 0.14, 0.16, 'sawtooth', 210);
    this._blip(300, t + 0.16, 0.15, 0.14, 'sawtooth', 190);
  }

  // 水のポチャン
  playSplash() {
    this._noise(this.now, 0.4, 0.18, 1200, 300);
  }

  // お城の鐘
  playBell() {
    const t = this.now;
    this._blip(660, t, 1.8, 0.16, 'sine');
    this._blip(660 * 2.4, t, 1.1, 0.06, 'sine');
    this._blip(660 * 4.2, t, 0.5, 0.03, 'sine');
  }

  // おいわいファンファーレ
  playFanfare() {
    if (!this.ctx) return;
    const t = this.now;
    const seq = [72, 76, 79, 84, 79, 84, 88];
    seq.forEach((m, i) => {
      this._blip(midiToFreq(m), t + i * 0.13, 0.7, 0.16, 'triangle');
      this._blip(midiToFreq(m - 12), t + i * 0.13, 0.5, 0.07, 'sine');
    });
  }

  // 魔法のシャラララ
  playMagic() {
    this.playGliss(79, 8, 0.045);
    this._noise(this.now, 0.9, 0.07, 3000, 7000);
  }
}
