/* ================================================================
   ui.js — DOM overlay: title, HUD, toasts, banners.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.UI = (function () {
  const $ = (id) => document.getElementById(id);
  let toastTimer = null, bannerTimer = null;

  function init(onStart) {
    $('btn-start').addEventListener('click', () => {
      GAME.Audio.resume();
      GAME.Audio.startMusic();
      $('title-screen').classList.add('hidden');
      $('hud').classList.remove('hidden');
      $('btn-jump').classList.remove('hidden');
      $('rotate-hint').classList.remove('hidden');
      setTimeout(() => $('rotate-hint').classList.add('hidden'), 6000);
      onStart();
    });

    $('btn-sound').addEventListener('click', (e) => {
      e.stopPropagation();
      GAME.Audio.resume();
      const muted = GAME.Audio.toggleMute();
      $('btn-sound').textContent = muted ? '🔇' : '🔊';
    });
  }

  function toast(msg, dur) {
    const el = $('toast');
    clearTimeout(toastTimer);
    el.classList.remove('hidden', 'out');
    el.innerHTML = msg;
    toastTimer = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.classList.add('hidden'), 400);
    }, dur || 3200);
  }

  function zoneBanner(title, sub, dur) {
    const el = $('zone-banner');
    clearTimeout(bannerTimer);
    el.classList.remove('hidden', 'out');
    $('zone-banner-title').textContent = title;
    $('zone-banner-sub').textContent = sub;
    bannerTimer = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.classList.add('hidden'), 500);
    }, dur || 3000);
  }

  function setProgress(p) {
    $('tube-fill').style.width = Math.round(p * 100) + '%';
    $('paint-pct').textContent = Math.round(p * 100) + '%';
  }

  function setStars(n, total) {
    $('star-num').textContent = n;
    const el = $('star-counter');
    el.classList.remove('bump');
    void el.offsetWidth;             // restart the animation
    el.classList.add('bump');
  }

  function finale() {
    const el = $('finale-banner');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 6000);
  }

  function showError(msg) {
    const el = $('err-overlay');
    el.classList.remove('hidden');
    el.textContent += msg + '\n';
  }

  return { init, toast, zoneBanner, setProgress, setStars, finale, showError };
})();
