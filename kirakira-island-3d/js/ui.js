/* ============================================================
   ui.js — HUD glue: star counter, friend badges, message
   banners, sound toggle, title screen fade.
   ============================================================ */

(function (K) {
  "use strict";

  const UI = {};
  K.UI = UI;

  let bannerTimer = null;

  UI.init = function (onStart) {
    const title = document.getElementById("title-screen");
    const startBtn = document.getElementById("start-button");
    const soundBtn = document.getElementById("sound-button");

    // pre-fill friend badge emojis (greyed until found)
    const friends = K.Characters.FRIENDS;
    document.querySelectorAll(".friend-slot").forEach((el, i) => {
      if (friends[i]) el.textContent = friends[i].emoji;
    });

    function start(e) {
      if (e) e.preventDefault();
      title.classList.add("fade-out");
      document.getElementById("hud").classList.remove("hidden");
      setTimeout(() => title.classList.add("hidden"), 900);
      onStart();
    }
    startBtn.addEventListener("click", start);
    startBtn.addEventListener("touchend", start);

    soundBtn.addEventListener("click", () => {
      const muted = !K.Audio.muted;
      K.Audio.setMuted(muted);
      soundBtn.textContent = muted ? "🔇" : "🔊";
    });
  };

  UI.setStars = function (n) {
    document.getElementById("star-count").textContent = n;
    const counter = document.getElementById("star-counter");
    counter.classList.remove("bump");
    void counter.offsetWidth; // restart the CSS animation
    counter.classList.add("bump");
  };

  UI.foundFriend = function (index) {
    const slot = document.querySelector(`.friend-slot[data-friend="${index}"]`);
    if (slot) slot.classList.add("found");
  };

  UI.banner = function (text, ms) {
    const el = document.getElementById("message-banner");
    el.textContent = text;
    el.classList.remove("hidden");
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.add("hidden"), ms || 2600);
  };

  UI.celebrate = function () {
    document.getElementById("celebrate-overlay").classList.remove("hidden");
    setTimeout(() => {
      document.getElementById("celebrate-overlay").classList.add("hidden");
    }, 6000);
  };

})(window.KIRA);
