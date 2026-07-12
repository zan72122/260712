// ============================================================
// UI — カウンター・大きなボタン・タイトル画面・お祝いバナー
// 4歳児むけ: 文字が読めなくても絵文字でわかるデザイン
// ============================================================

const RING_LEN = 119.4; // 進行リングの円周

export class UI {
  constructor(handlers) {
    this.handlers = handlers;
    this.$ = (id) => document.getElementById(id);

    this.hud = this.$('hud');
    this.starNum = this.$('star-num');
    this.heartNum = this.$('heart-num');
    this.starRing = this.$('star-ring');
    this.starCounter = this.$('star-counter');
    this.heartCounter = this.$('heart-counter');
    this.hint = this.$('hint');
    this.banner = this.$('celebrate-banner');

    this.btnTime = this.$('btn-time');
    this.btnMagic = this.$('btn-magic');
    this.btnDress = this.$('btn-dress');
    this.btnMusic = this.$('btn-music');

    // ボタンは pointerdown で即反応（子どもの短いタップにも確実に）
    const bind = (btn, fn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        fn();
      });
    };
    bind(this.btnTime, () => handlers.onTimeToggle());
    bind(this.btnMagic, () => handlers.onMagic());
    bind(this.btnDress, () => handlers.onDress());
    bind(this.btnMusic, () => handlers.onMusicToggle());

    this.$('btn-start').addEventListener('pointerdown', () => handlers.onStart());
  }

  hideLoading() {
    this.$('loading').classList.add('fade-out');
  }

  startGame() {
    this.$('title-screen').classList.add('fade-out');
    this.hud.classList.remove('hidden');
    this.hint.classList.remove('hidden');
  }

  dismissHint() {
    if (!this._hintGone) {
      this._hintGone = true;
      this.hint.classList.add('hidden');
    }
  }

  setStars(total, progress, goal) {
    this.starNum.textContent = total;
    this.starRing.style.strokeDashoffset = RING_LEN * (1 - progress / goal);
    this._pop(this.starCounter);
  }

  setHearts(total) {
    this.heartNum.textContent = total;
    this._pop(this.heartCounter);
  }

  _pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth; // アニメーションをリスタート
    el.classList.add('pop');
  }

  setTimeIcon(phase) {
    this.btnTime.textContent = { day: '☀️', sunset: '🌇', night: '🌙' }[phase];
  }

  setMusicIcon(muted) {
    this.btnMusic.textContent = muted ? '🔇' : '🎵';
  }

  setMagicActive(active) {
    this.btnMagic.classList.toggle('btn-active', active);
  }

  celebrate() {
    this.banner.classList.remove('hidden');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.banner.classList.add('hidden'), 4200);
  }
}
