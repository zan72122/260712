/* =========================================================
 * いちごましゅまろのおか — audio.js
 * 全て WebAudio による手続き生成サウンド（外部アセット不要）
 *  - オルゴール風BGM（ペンタトニック）
 *  - 収集チャイム / ポップ / ボヨン / ファンファーレ / キラキラ
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  const Audio = {
    ctx: null,
    master: null,
    bgmGain: null,
    sfxGain: null,
    delay: null,
    muted: false,
    started: false,
    _bgmTimer: null,
    _step: 0,
  };
  IM.Audio = Audio;

  // ペンタトニック（C major pentatonic を基準に）
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

  Audio.init = function () {
    if (Audio.started) {
      // iOS: 再開が必要な場合
      if (Audio.ctx && Audio.ctx.state === 'suspended') Audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    Audio.ctx = ctx;

    Audio.master = ctx.createGain();
    Audio.master.gain.value = 0.9;
    Audio.master.connect(ctx.destination);

    // やわらかいエコー
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.28;
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(Audio.master);
    Audio.delay = delay;

    Audio.bgmGain = ctx.createGain();
    Audio.bgmGain.gain.value = 0.5;
    Audio.bgmGain.connect(Audio.master);
    Audio.bgmGain.connect(delay);

    Audio.sfxGain = ctx.createGain();
    Audio.sfxGain.gain.value = 0.85;
    Audio.sfxGain.connect(Audio.master);
    Audio.sfxGain.connect(delay);

    Audio.started = true;
    Audio._startBGM();
  };

  Audio.setMuted = function (m) {
    Audio.muted = m;
    if (Audio.master && Audio.ctx) {
      Audio.master.gain.setTargetAtTime(m ? 0 : 0.9, Audio.ctx.currentTime, 0.05);
    }
  };

  // ---------- 基本トーン（オルゴール風: サイン + 速い減衰 + 倍音） ----------
  function bell(freq, time, dur, vol, dest) {
    const ctx = Audio.ctx;
    if (!ctx) return;
    dest = dest || Audio.sfxGain;
    vol = vol || 0.3;
    dur = dur || 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    g.connect(dest);

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    o1.connect(g);
    o1.start(time);
    o1.stop(time + dur + 0.05);

    // きらめく倍音
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, time);
    g2.gain.linearRampToValueAtTime(vol * 0.28, time + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.45);
    g2.connect(dest);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 4;
    o2.connect(g2);
    o2.start(time);
    o2.stop(time + dur * 0.5);
  }

  // ---------- BGM: ゆったりオルゴール ----------
  // 8小節のやさしいパターンを生成しながらループ
  const MELODY = [
    0, null, 2, null, 4, null, 2, null,
    3, null, 2, null, 0, null, null, null,
    2, null, 4, null, 5, null, 4, null,
    2, null, 0, null, null, null, null, null,
    4, null, 5, null, 7, null, 5, null,
    4, null, 2, null, 0, null, 2, null,
    3, null, 2, null, 1, null, 0, null,
    null, null, 0, null, null, null, null, null,
  ];
  const BASS = [0, null, null, null, 3, null, null, null];

  Audio._startBGM = function () {
    const ctx = Audio.ctx;
    const STEP = 0.34; // 秒/16分
    let nextTime = ctx.currentTime + 0.1;

    function schedule() {
      if (!Audio.ctx) return;
      while (nextTime < ctx.currentTime + 0.8) {
        const i = Audio._step % MELODY.length;
        const m = MELODY[i];
        if (m !== null) {
          bell(PENTA[Math.min(m + 2, PENTA.length - 1)], nextTime, 1.6, 0.16, Audio.bgmGain);
        }
        const b = BASS[Audio._step % BASS.length];
        if (b !== null && Audio._step % 2 === 0) {
          bell(PENTA[b] / 2, nextTime, 2.2, 0.1, Audio.bgmGain);
        }
        Audio._step++;
        nextTime += STEP;
      }
    }
    schedule();
    Audio._bgmTimer = setInterval(schedule, 200);
  };

  // ---------- SFX ----------
  // いちご収集: 上昇アルペジオ（集めるたびに少しずつ高く）
  Audio.collect = function (comboIndex) {
    if (!Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    const base = 3 + (comboIndex % 5);
    bell(PENTA[base], t, 0.7, 0.3);
    bell(PENTA[base + 2], t + 0.07, 0.7, 0.26);
    bell(PENTA[base + 4] || PENTA[9], t + 0.14, 0.9, 0.22);
  };

  // ぷちっ（風船ポップ）
  Audio.pop = function () {
    const ctx = Audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    g.connect(Audio.sfxGain);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(720, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.13);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.15);
    bell(PENTA[7], t + 0.02, 0.5, 0.15);
  };

  // ぼよん（ひつじ）
  Audio.boing = function () {
    const ctx = Audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    g.connect(Audio.sfxGain);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.36);
  };

  // ちょうちょ / キラキラ
  Audio.sparkle = function () {
    if (!Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      bell(PENTA[5 + ((i * 2) % 5)], t + i * 0.05, 0.5, 0.12);
    }
  };

  // おおきなお祝いファンファーレ
  Audio.fanfare = function () {
    if (!Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    const seq = [0, 2, 4, 5, 7, 9];
    seq.forEach((n, i) => {
      bell(PENTA[n], t + i * 0.11, 1.2, 0.28);
      bell(PENTA[n] * 2, t + i * 0.11 + 0.02, 0.8, 0.12);
    });
    // 和音フィニッシュ
    [0, 4, 7, 9].forEach((n) => bell(PENTA[n], t + 0.75, 2.2, 0.22));
    [0, 4, 7].forEach((n) => bell(PENTA[n] * 2, t + 0.78, 2.0, 0.1));
  };

  // ジャンプ・ツイル（女の子タップ）
  Audio.giggle = function () {
    if (!Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    bell(PENTA[6], t, 0.4, 0.2);
    bell(PENTA[8], t + 0.08, 0.4, 0.2);
    bell(PENTA[7], t + 0.16, 0.6, 0.2);
  };
})();
