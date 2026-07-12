// ほしのこモコ — HUD / スプラッシュ / トースト
// 4歳児向け：文字はぜんぶ ひらがな、操作はぜんぶ 大きなボタン。

const HINTS = [
  'もこを タッチしてみてね',
  'ゆびで なでなで してあげてね',
  '🍎 で おやつを あげられるよ',
  '⚽ で いっしょに あそぼう',
  '🫧 しゃぼんだまを ぷちぷち！',
  '🚿 で おはなに みずやり',
  '☀️ ボタンで そらが かわるよ',
  'よるは ながれぼしを タッチ！',
  'じめんを タッチすると あるくよ',
  'ときどき プレゼントが ふってくるよ',
];

export class UI {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      splash: document.getElementById('splash'),
      splashStars: document.getElementById('splash-stars'),
      btnStart: document.getElementById('btn-start'),
      heartMeter: document.getElementById('heart-meter'),
      heartsFill: document.querySelector('.hearts-fill-wrap'),
      starCount: document.getElementById('star-count'),
      toast: document.getElementById('toast'),
      btnMute: document.getElementById('btn-mute'),
      btnApple: document.getElementById('btn-apple'),
      btnBall: document.getElementById('btn-ball'),
      btnBubble: document.getElementById('btn-bubble'),
      btnWater: document.getElementById('btn-water'),
      btnSky: document.getElementById('btn-sky'),
    };
    this._toastTimer = null;
    this._hintIdx = 0;
    this._decorateSplash();
  }

  _decorateSplash() {
    const emo = ['⭐', '✨', '🌟', '💫', '⭐', '✨'];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.className = 'splash-star';
      s.textContent = emo[i % emo.length];
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 100}%`;
      s.style.fontSize = `${14 + Math.random() * 22}px`;
      s.style.animationDelay = `${Math.random() * 3}s`;
      this.el.splashStars.appendChild(s);
    }
  }

  onStart(cb) {
    this.el.btnStart.addEventListener('click', () => {
      this.el.splash.classList.add('fade-out');
      this.el.hud.classList.remove('hidden');
      setTimeout(() => this.el.splash.remove(), 800);
      cb();
    }, { once: true });
  }

  bindButtons(handlers) {
    const bind = (btn, fn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
    };
    bind(this.el.btnApple, handlers.apple);
    bind(this.el.btnBall, handlers.ball);
    bind(this.el.btnBubble, handlers.bubble);
    bind(this.el.btnWater, handlers.water);
    bind(this.el.btnSky, handlers.sky);
    bind(this.el.btnMute, handlers.mute);
  }

  setSkyIcon(phase) {
    this.el.btnSky.querySelector('span').textContent = ['☀️', '🌇', '🌙'][phase];
  }

  setMuteIcon(muted) {
    this.el.btnMute.textContent = muted ? '🔇' : '🔊';
  }

  setHappiness(v) {
    this.el.heartsFill.style.width = `${Math.round(v * 100)}%`;
    this.el.heartMeter.classList.toggle('full', v >= 0.999);
  }

  setStars(n) {
    this.el.starCount.textContent = String(n);
  }

  // 3D空間で取った星が HUD のカウンターへ飛んでいく DOM 演出
  flyStarTo(screenX, screenY, onDone) {
    const star = document.createElement('div');
    star.className = 'fly-star';
    star.textContent = '⭐';
    star.style.left = `${screenX}px`;
    star.style.top = `${screenY}px`;
    document.getElementById('app').appendChild(star);

    const target = this.el.starCount.getBoundingClientRect();
    const tx = target.left + target.width / 2 - screenX;
    const ty = target.top + target.height / 2 - screenY;

    star.animate([
      { transform: 'translate(0,0) scale(1.4)', opacity: 1 },
      { transform: `translate(${tx * 0.4}px, ${ty * 0.4 - 60}px) scale(1.2)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${tx}px, ${ty}px) scale(0.5)`, opacity: 0.9 },
    ], { duration: 750, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }).onfinish = () => {
      star.remove();
      if (onDone) onDone();
    };
  }

  toast(msg, dur = 3200) {
    const t = this.el.toast;
    clearTimeout(this._toastTimer);
    t.textContent = msg;
    t.classList.remove('hidden', 'toast-out');
    this._toastTimer = setTimeout(() => {
      t.classList.add('toast-out');
      setTimeout(() => t.classList.add('hidden'), 360);
    }, dur);
  }

  nextHint() {
    this.toast(HINTS[this._hintIdx % HINTS.length]);
    this._hintIdx++;
  }

  pulseButton(btn) {
    const el = this.el[btn];
    if (!el) return;
    el.classList.add('active-glow');
    setTimeout(() => el.classList.remove('active-glow'), 1200);
  }
}
