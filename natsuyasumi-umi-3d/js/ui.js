/* ============================================================
   ui.js — HUDとメニュー
   トースト / おいわい / ずかん / アクションボタン / とけい
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  G.createUI = function () {
    const ui = (G.ui = {});
    const $ = (id) => document.getElementById(id);

    const hud = $('hud');
    const toastEl = $('toast');
    const actionBtn = $('btn-action');
    const celebrateEl = $('celebrate');
    const biteEl = $('bite-mark');
    const bookModal = $('book-modal');
    const bookGrid = $('book-grid');
    const bookProgress = $('book-progress');

    let toastTimer = null;
    let celebrateTimer = null;
    let actionCb = null;
    const seenSpecies = new Set();

    /* ---------------- トースト ---------------- */
    ui.toast = function (text) {
      toastEl.textContent = text;
      toastEl.classList.remove('hidden');
      // アニメを最初から
      toastEl.style.animation = 'none';
      void toastEl.offsetWidth;
      toastEl.style.animation = '';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 1900);
    };

    /* ---------------- おいわい ---------------- */
    ui.celebrate = function (species, big = false) {
      $('celebrate-emoji').textContent = species.emoji;
      $('celebrate-name').textContent = big ? `${species.name}！！` : species.name;
      $('celebrate-label').textContent = big ? 'すごーい！ おおものだ！' : 'つかまえた！';
      celebrateEl.classList.remove('hidden');
      clearTimeout(celebrateTimer);
      celebrateTimer = setTimeout(() => celebrateEl.classList.add('hidden'), big ? 2600 : 2000);
      seenSpecies.add(species.key);
    };

    /* ---------------- びっくりマーク ---------------- */
    ui.showBite = function () { biteEl.classList.remove('hidden'); };
    ui.hideBite = function () { biteEl.classList.add('hidden'); };

    /* ---------------- アクションボタン ---------------- */
    ui.setAction = function (label, cls, cb) {
      if (actionBtn.textContent !== label) actionBtn.textContent = label;
      actionBtn.className = cls || '';
      actionBtn.classList.remove('hidden');
      actionCb = cb;
    };
    ui.clearAction = function () {
      actionBtn.classList.add('hidden');
      actionCb = null;
    };
    actionBtn.addEventListener('click', () => {
      if (G.audio.ready) G.audio.pop();
      if (actionCb) actionCb();
    });

    /* ---------------- カウンター ---------------- */
    const chipMap = {
      shell: ['chip-shell', 'count-shell', (c) => c.shell],
      fish: ['chip-fish', 'count-fish', (c) => c.aji + c.tai + c.fugu + c.tako + c.niji],
      bug: ['chip-bug', 'count-bug', (c) => c.butterfly + c.beetle + c.hotaru],
    };
    const lastVals = {};
    ui.refreshCounts = function () {
      const c = G.state.counts;
      for (const key in chipMap) {
        const [chipId, countId, getter] = chipMap[key];
        const v = getter(c);
        if (lastVals[key] !== v) {
          lastVals[key] = v;
          $(countId).textContent = v;
          const chip = $(chipId);
          chip.classList.remove('bump');
          void chip.offsetWidth;
          chip.classList.add('bump');
        }
      }
    };

    /* ---------------- ずかん ---------------- */
    function renderBook() {
      bookGrid.innerHTML = '';
      let found = 0;
      for (const sp of G.SPECIES) {
        const count = G.state.counts[sp.key];
        const has = count > 0;
        if (has) found++;
        const div = document.createElement('div');
        div.className = 'book-item' + (has ? '' : ' locked') + (has && seenSpecies.has(sp.key) ? '' : '');
        div.innerHTML = `
          <div class="bi-emoji">${sp.emoji}</div>
          <div class="bi-name">${has ? sp.name : '？？？'}</div>
          <div class="bi-count">${has ? '×' + count : 'まだ'}</div>`;
        bookGrid.appendChild(div);
      }
      bookProgress.textContent = `みつけた いきもの： ${found} / ${G.SPECIES.length}`;
      if (found === G.SPECIES.length) {
        bookProgress.textContent += ' 🎉 ぜんぶ みつけた！';
      }
    }

    $('btn-book').addEventListener('click', () => {
      if (G.audio.ready) G.audio.pop();
      renderBook();
      bookModal.classList.remove('hidden');
      G.state.busy = true;
    });
    $('btn-book-close').addEventListener('click', () => {
      if (G.audio.ready) G.audio.pop();
      bookModal.classList.add('hidden');
      // つり中でなければ解除
      if (G.activities && G.activities.fishing.phase === 'idle') G.state.busy = false;
    });

    /* ---------------- おと ---------------- */
    const soundBtn = $('btn-sound');
    function refreshSoundBtn() {
      soundBtn.textContent = G.state.muted ? '🔇' : '🔊';
    }
    soundBtn.addEventListener('click', () => {
      G.audio.setMuted(!G.state.muted);
      refreshSoundBtn();
      if (!G.state.muted && G.audio.ready) G.audio.pop();
    });
    refreshSoundBtn();

    /* ---------------- とけい（じかんをすすめる） ---------------- */
    const TIME_STOPS = [
      { t: 0.12, icon: '☀️', label: 'あさに なったよ' },
      { t: 0.32, icon: '🌞', label: 'まひるだ！' },
      { t: 0.66, icon: '🌇', label: 'ゆうやけ きれいだね' },
      { t: 0.86, icon: '🌙', label: 'よるに なったよ' },
    ];
    const timeBtn = $('btn-time');
    timeBtn.addEventListener('click', () => {
      if (G.audio.ready) G.audio.pop();
      // いまの時刻の「つぎ」へ
      const now = G.state.time;
      let next = TIME_STOPS[0];
      for (const s of TIME_STOPS) {
        if (s.t > now + 0.02) { next = s; break; }
      }
      G.state.time = next.t;
      timeBtn.textContent = next.icon;
      ui.toast(next.icon + ' ' + next.label);
    });

    // 自動で進む時刻にあわせてアイコンも更新
    ui.update = function () {
      const t = G.state.time;
      let icon = '☀️';
      if (t >= 0.58 && t < 0.78) icon = '🌇';
      else if (t >= 0.78 || t < 0.05) icon = '🌙';
      else if (t >= 0.2 && t < 0.58) icon = '🌞';
      if (timeBtn.textContent !== icon) timeBtn.textContent = icon;
    };

    /* ---------------- タイトル → ゲーム開始 ---------------- */
    $('btn-start').addEventListener('click', () => {
      G.audio.init();
      G.audio.setMuted(G.state.muted);
      refreshSoundBtn();
      const ts = document.getElementById('title-screen');
      ts.classList.add('fading');
      setTimeout(() => ts.classList.add('hidden'), 950);
      hud.classList.remove('hidden');
      G.state.started = true;
      ui.toast('🏝️ しまを たんけん しよう！');
      const tip = document.getElementById('rotate-tip');
      tip.classList.remove('hidden');
      setTimeout(() => tip.classList.add('hidden'), 5000);
    });

    return ui;
  };
})();
