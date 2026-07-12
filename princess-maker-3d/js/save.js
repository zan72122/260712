/* ============================================================
 * save.js — セーブデータ管理 (localStorage)
 * ============================================================ */
"use strict";
window.PM = window.PM || {};

PM.Save = (function () {
  const KEY = "kirakira-princess-save-v1";

  const DEFAULTS = {
    stars: 0,               // ⭐ 合計スター(成長の源)
    hearts: 0,              // 💗 ハート
    activityCount: 0,       // 遊んだ回数(舞踏会イベント用)
    flowers: 0,             // 植えたお花の数
    stats: { tea: 0, dance: 0, art: 0, magic: 0, pony: 0, garden: 0 },
    outfit: { dress: "pink", hair: "twin", hairColor: "brown", crown: "none" },
    soundOn: true
  };

  let data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = Object.assign({}, DEFAULTS, parsed);
        data.stats = Object.assign({}, DEFAULTS.stats, parsed.stats || {});
        data.outfit = Object.assign({}, DEFAULTS.outfit, parsed.outfit || {});
        return data;
      }
    } catch (e) { /* 壊れたデータは捨てる */ }
    data = JSON.parse(JSON.stringify(DEFAULTS));
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode etc. */ }
  }

  function get() { return data || load(); }

  // レベル: スター5個ごとに1アップ(最大10)
  function level() {
    return Math.min(10, Math.floor(get().stars / 5) + 1);
  }

  return { load, save, get, level };
})();
