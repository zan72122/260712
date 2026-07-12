/* =========================================================
 * いちごましゅまろのおか — ui.js
 * HUD（いちごバスケット・ボタン・お祝いバナー・タイトル）
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  const BASKET_SIZE = 10;
  IM.BASKET_SIZE = BASKET_SIZE;

  function UI() {
    this.count = 0;       // バスケットの中
    this.total = 0;       // ぜんぶで集めた数
    this.el = {
      title: document.getElementById('title-screen'),
      startBtn: document.getElementById('start-btn'),
      hud: document.getElementById('hud'),
      basket: document.getElementById('basket'),
      total: document.getElementById('total-count'),
      soundBtn: document.getElementById('sound-btn'),
      timeBtn: document.getElementById('time-btn'),
      banner: document.getElementById('banner'),
    };
    // バスケットのいちごスロット
    this.slots = [];
    for (let i = 0; i < BASKET_SIZE; i++) {
      const s = document.createElement('span');
      s.className = 'slot';
      s.textContent = '🍓';
      this.el.basket.appendChild(s);
      this.slots.push(s);
    }
    this._renderBasket();
  }

  UI.prototype.onStart = function (fn) {
    const btn = this.el.startBtn;
    const handler = (e) => {
      e.preventDefault();
      this.el.title.classList.add('hidden');
      this.el.hud.classList.remove('hidden');
      fn();
    };
    btn.addEventListener('pointerup', handler);
  };

  UI.prototype._renderBasket = function () {
    for (let i = 0; i < BASKET_SIZE; i++) {
      this.slots[i].classList.toggle('filled', i < this.count);
    }
    this.el.total.textContent = '× ' + this.total;
  };

  // いちごゲット → バスケットが満タンなら true（お祝い！）
  UI.prototype.addBerry = function () {
    this.count++;
    this.total++;
    const slot = this.slots[Math.min(this.count, BASKET_SIZE) - 1];
    slot.classList.remove('pop');
    void slot.offsetWidth; // アニメーション再トリガー
    slot.classList.add('pop');
    this._renderBasket();
    if (this.count >= BASKET_SIZE) {
      this.count = 0;
      setTimeout(() => this._renderBasket(), 900);
      return true;
    }
    return false;
  };

  UI.prototype.showBanner = function (text, ms) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('hidden', 'show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => {
      b.classList.remove('show');
      setTimeout(() => b.classList.add('hidden'), 500);
    }, ms || 2600);
  };

  UI.prototype.bindSound = function (fn) {
    this.el.soundBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const muted = fn();
      this.el.soundBtn.textContent = muted ? '🔇' : '🔊';
    });
  };

  UI.prototype.bindTime = function (fn) {
    this.el.timeBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const toNight = fn();
      this.el.timeBtn.textContent = toNight ? '☀️' : '🌙';
    });
  };

  UI.prototype.setTimeIcon = function (isDay) {
    // 昼なら「🌙にする」ボタン、夜なら「☀️にする」ボタン
    this.el.timeBtn.textContent = isDay ? '🌙' : '☀️';
  };

  IM.UI = UI;
})();
