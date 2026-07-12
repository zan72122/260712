/* ============================================================
 * ui.js — HTMLオーバーレイUI
 *   HUD・おきがえパネル・ふきだし・ごほうび演出・お祝い画面。
 *   文字が読めなくても遊べるよう絵文字中心。
 * ============================================================ */
"use strict";
window.PM = window.PM || {};

PM.UI = (function () {
  const $ = (id) => document.getElementById(id);
  let princess, world, activities, scene, camera;
  let bubbleTimer = null;

  /* ---------- HUD ---------- */
  function refreshHUD(bump) {
    const s = PM.Save.get();
    $("starNum").textContent = s.stars;
    $("heartNum").textContent = s.hearts;
    $("levelNum").textContent = PM.Save.level();
    if (bump) {
      ["starBadge", "heartBadge", "levelBadge"].forEach(id => {
        const el = $(id);
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
      });
    }
  }

  /* ---------- 画面を飛ぶ⭐💗 ---------- */
  function flyRewards(stars, hearts) {
    const mk = (emoji, targetId, i) => {
      const el = document.createElement("div");
      el.className = "flyIcon";
      el.textContent = emoji;
      const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 120;
      const startY = window.innerHeight / 2 + (Math.random() - 0.5) * 80;
      el.style.left = "0px"; el.style.top = "0px";
      el.style.transform = `translate(${startX}px, ${startY}px) scale(1.4)`;
      document.body.appendChild(el);
      const target = $(targetId).getBoundingClientRect();
      setTimeout(() => {
        el.style.transform = `translate(${target.left + 10}px, ${target.top}px) scale(0.6)`;
        el.style.opacity = "0.1";
      }, 60 + i * 130);
      setTimeout(() => el.remove(), 1400 + i * 130);
    };
    for (let i = 0; i < stars; i++) mk("⭐", "starBadge", i);
    for (let i = 0; i < hearts; i++) mk("💗", "heartBadge", i + stars);
  }

  /* ---------- ふきだし ---------- */
  function showBubble(text, ms) {
    const b = $("bubble");
    b.textContent = text;
    b.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.remove("show"), ms || 2000);
  }

  function updateBubblePos() {
    const b = $("bubble");
    if (!b.classList.contains("show") || !princess) return;
    const p = BABYLON.Vector3.Project(
      princess.headWorldPos(),
      BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),
      camera.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight())
    );
    const scale = window.innerWidth / scene.getEngine().getRenderWidth();
    b.style.left = (p.x * scale) + "px";
    b.style.top = (p.y * scale) + "px";
  }

  /* ---------- お祝いオーバーレイ ---------- */
  let celebTimer = null;
  function showCelebrate(title, sub, ms) {
    $("celebText").textContent = title;
    $("celebSub").textContent = sub || "";
    const c = $("celebrate");
    c.classList.remove("show");
    void c.offsetWidth;
    c.classList.add("show");
    clearTimeout(celebTimer);
    celebTimer = setTimeout(() => c.classList.remove("show"), ms || 3000);
  }

  /* ---------- おきがえパネル ---------- */
  function itemUnlocked(def) { return PM.Save.level() >= def.unlock; }

  function newUnlocksAt(level) {
    const out = [];
    const cats = princess.catalogs;
    [cats.DRESSES, cats.HAIRS, cats.HAIR_COLORS, cats.CROWNS].forEach(cat => {
      Object.entries(cat).forEach(([id, def]) => { if (def.unlock === level) out.push(id); });
    });
    return out;
  }

  function swatchBtn(id, def, kind, selected) {
    const el = document.createElement("button");
    el.className = "swatch" + (selected ? " sel" : "") + (itemUnlocked(def) ? "" : " locked");
    if (def.sw) el.style.background = def.sw;
    else { el.style.background = "#fff"; el.textContent = def.emoji || "?"; }
    if (!itemUnlocked(def)) {
      const lv = document.createElement("span");
      lv.className = "lv"; lv.textContent = "Lv" + def.unlock;
      el.appendChild(lv);
    }
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (!itemUnlocked(def)) { PM.Audio.sfx("tap"); showBubble("🔒 レベル" + def.unlock + "でひらくよ", 1600); return; }
      const outfit = PM.Save.get().outfit;
      outfit[kind] = id;
      PM.Save.save();
      princess.applyOutfit(outfit);
      PM.Audio.sfx("dress");
      world.sparkleBurst(princess.headWorldPos());
      rebuildWardrobe();
    });
    return el;
  }

  function rebuildWardrobe() {
    const cats = princess.catalogs;
    const outfit = PM.Save.get().outfit;
    const fill = (rowId, cat, kind) => {
      const row = $(rowId);
      row.innerHTML = "";
      Object.entries(cat).forEach(([id, def]) => {
        row.appendChild(swatchBtn(id, def, kind, outfit[kind] === id));
      });
    };
    fill("dressRow", cats.DRESSES, "dress");
    fill("hairRow", cats.HAIRS, "hair");
    fill("hairColorRow", cats.HAIR_COLORS, "hairColor");
    fill("crownRow", cats.CROWNS, "crown");
  }

  function toggleWardrobe(open) {
    const w = $("wardrobe");
    const on = open !== undefined ? open : !w.classList.contains("open");
    w.classList.toggle("open", on);
    if (on) { rebuildWardrobe(); PM.Audio.sfx("dress"); princess.setState("wave"); }
    else if (princess.state === "wave") princess.setState("idle");
  }

  /* ---------- ボタンの有効/無効 ---------- */
  function setBusy(b) {
    document.querySelectorAll(".actBtn[data-act]").forEach(el => el.classList.toggle("busy", b));
  }

  /* ---------- 初期化 ---------- */
  function init(s, cam, w, p, act) {
    scene = s; camera = cam; world = w; princess = p; activities = act;
    refreshHUD(false);

    document.querySelectorAll(".actBtn[data-act]").forEach(el => {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        toggleWardrobe(false);
        activities.run(el.dataset.act);
      });
    });
    $("wardrobeBtn").addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      PM.Audio.sfx("tap");
      toggleWardrobe();
    });
    $("soundBtn").addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const on = !PM.Audio.isEnabled();
      PM.Audio.setEnabled(on);
      $("soundBtn").textContent = on ? "🔊" : "🔇";
      const save = PM.Save.get(); save.soundOn = on; PM.Save.save();
    });

    scene.onBeforeRenderObservable.add(updateBubblePos);
  }

  return { init, refreshHUD, flyRewards, showBubble, showCelebrate, rebuildWardrobe, toggleWardrobe, setBusy, newUnlocksAt };
})();
