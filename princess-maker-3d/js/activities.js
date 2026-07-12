/* ============================================================
 * activities.js — おけいこ・イベント進行
 *   おちゃかい/ダンス/おえかき/まほう/ポニー/おはな + 舞踏会。
 *   ぜんぶ「失敗なし」。ごほうびがどんどんもらえる。
 * ============================================================ */
"use strict";
window.PM = window.PM || {};

PM.Activities = (function () {
  const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);
  let scene, world, princess;
  let busy = false;

  const BUBBLES = {
    tea: "🍰😋", dance: "🎵💃", art: "🎨✨", magic: "🪄🌟",
    pony: "🐴💕", garden: "🌷🌈", levelup: "🎉👑", ball: "👗✨"
  };

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function walkToAsync(p) { return new Promise(r => princess.walkTo(p, r)); }

  /* ---------- ごほうび ---------- */
  function reward(statId, stars, hearts) {
    const save = PM.Save.get();
    const prevLevel = PM.Save.level();
    save.stars += stars;
    save.hearts += hearts;
    if (save.stats[statId] !== undefined) save.stats[statId] += 1;
    save.activityCount += 1;
    PM.Save.save();
    PM.UI.refreshHUD(true);
    PM.UI.flyRewards(stars, hearts);
    world.sparkleBurst(princess.headWorldPos());
    world.heartBurst(princess.root.position.add(V3(0, 1, 0)));
    PM.Audio.sfx("star");

    const newLevel = PM.Save.level();
    if (newLevel > prevLevel) {
      setTimeout(() => levelUp(newLevel), 900);
      return true;
    }
    // 4回ごとに舞踏会(レベルアップは5スターごとなので重ならない)
    if (save.activityCount % 4 === 0) {
      setTimeout(() => ballEvent(), 1100);
      return true;
    }
    return false;
  }

  /* ---------- レベルアップ ---------- */
  function levelUp(level) {
    busy = true;
    princess.applyLevel(level);
    princess.setState("celebrate");
    PM.Audio.sfx("fanfare");
    world.fireworkShow(6);
    world.showRainbow(7);
    world.confettiBurst(princess.root.position.add(V3(0, 2.2, 0)));
    PM.UI.showBubble(BUBBLES.levelup, 2500);
    const unlocked = PM.UI.newUnlocksAt(level);
    PM.UI.showCelebrate("レベル " + level + " ✨", unlocked.length ? "あたらしい おきがえ が ふえたよ! 👗" : "おおきくなったね!", 3800);
    PM.UI.refreshHUD(true);
    PM.UI.rebuildWardrobe();
    setTimeout(() => {
      princess.setState("idle");
      busy = false;
      PM.UI.setBusy(false);
    }, 4200);
  }

  /* ---------- 舞踏会イベント ---------- */
  async function ballEvent() {
    busy = true; PM.UI.setBusy(true);
    PM.UI.showBubble(BUBBLES.ball, 2000);
    await walkToAsync(world.positions.dance);
    // スポットライト + 音楽 + ダンス
    const spot = world.gazeboSpot;
    spot.intensity = 25;
    princess.setState("ball");
    PM.Audio.sfx("twirl");
    world.fireworkShow(8);
    PM.UI.showCelebrate("👑 ぶとうかい 👑", "みんなが プリンセスを みているよ!", 3000);
    for (let i = 0; i < 5; i++) {
      await wait(1000);
      world.sparkleBurst(princess.root.position.add(V3((Math.random()-0.5)*2, 1.5, (Math.random()-0.5)*2)));
      PM.Audio.sfx("sparkle");
    }
    princess.setState("celebrate");
    PM.Audio.sfx("yay");
    world.confettiBurst(princess.root.position.add(V3(0, 2.4, 0)));
    await wait(1600);
    spot.intensity = 0;
    princess.setState("idle");
    busy = false; PM.UI.setBusy(false);
  }

  /* ============================================================
   * 各おけいこ
   * ============================================================ */
  const ACTS = {
    async tea() {
      await walkToAsync(world.positions.tea);
      princess.faceTowards(V3(8.5, 0, 3.5));
      princess.setState("tea");
      PM.UI.showBubble(BUBBLES.tea, 2200);
      for (let i = 0; i < 4; i++) {
        await wait(800);
        PM.Audio.sfx("munch");
        world.heartBurst(V3(8.2, 1.6, 3.4));
      }
      PM.Audio.sfx("giggle");
      await wait(500);
    },

    async dance() {
      await walkToAsync(world.positions.dance);
      princess.setState("twirl");
      PM.Audio.sfx("twirl");
      PM.UI.showBubble(BUBBLES.dance, 2200);
      for (let i = 0; i < 5; i++) {
        await wait(700);
        PM.Audio.sfx("sparkle");
        world.sparkleBurst(princess.root.position.add(V3(0, 0.6 + Math.random(), 0)));
      }
      await wait(400);
    },

    async art() {
      await walkToAsync(world.positions.art);
      princess.faceTowards(V3(-8.5, 0, 3.5));
      princess.setState("art");
      PM.UI.showBubble(BUBBLES.art, 2200);
      world.clearEasel();
      for (let i = 1; i <= 8; i++) {
        await wait(500);
        world.paintEasel(i / 8);
        PM.Audio.sfx("brush");
        if (i % 3 === 0) world.sparkleBurst(V3(-8.5, 1.8, 3.4));
      }
      PM.Audio.sfx("yay");
      await wait(600);
    },

    async magic() {
      await walkToAsync(world.positions.magic);
      princess.faceTowards(V3(0, 0, 0));
      princess.setState("magic");
      PM.UI.showBubble(BUBBLES.magic, 2200);
      PM.Audio.sfx("magic");
      for (let i = 0; i < 5; i++) {
        await wait(650);
        world.magicBurst(V3((Math.random()-0.5)*3, 1.5 + Math.random()*2.5, (Math.random()-0.5)*2));
        PM.Audio.sfx("magic");
      }
      world.splashBurst(V3(0, 2.4, 0));
      PM.Audio.sfx("splash");
      await wait(500);
    },

    async pony() {
      const pony = princess.pony;
      await walkToAsync(world.positions.pony);
      PM.UI.showBubble(BUBBLES.pony, 2000);
      PM.Audio.sfx("giggle");
      await wait(400);
      // のる
      princess.setState("ride");
      pony.state = "trot";
      const center = V3(0, 0, 13.5);
      const R = 3.1;
      let startA = Math.atan2(pony.root.position.x - center.x, pony.root.position.z - center.z);
      const loops = 2;
      const dur = 9;
      let t = 0;
      let clopT = 0;
      await new Promise(resolve => {
        const obs = scene.onBeforeRenderObservable.add(() => {
          const dt = scene.getEngine().getDeltaTime() / 1000;
          t += dt; clopT += dt;
          const k = Math.min(1, t / dur);
          // なめらかに加速・減速
          const e = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2;
          const a = startA + e * Math.PI * 2 * loops;
          const px = center.x + Math.sin(a) * R;
          const pz = center.z + Math.cos(a) * R;
          pony.root.position.x = px; pony.root.position.z = pz;
          pony.root.rotation.y = a + Math.PI / 2;
          // プリンセスをくらの上へ
          princess.root.position.set(px, 1.28, pz);
          princess.root.rotation.y = a + Math.PI / 2;
          if (clopT > 0.33 && k < 0.97) { clopT = 0; PM.Audio.sfx("clop"); }
          if (Math.random() < 0.03) world.heartBurst(V3(px, 2.2, pz));
          if (k >= 1) {
            scene.onBeforeRenderObservable.remove(obs);
            resolve();
          }
        });
      });
      pony.state = "idle";
      princess.root.position.y = 0;
      princess.setState("idle");
      princess.root.position.set(world.positions.pony.x, 0, world.positions.pony.z);
      world.heartBurst(pony.root.position.add(V3(0, 1.8, 0)));
      PM.Audio.sfx("heart");
      await wait(400);
    },

    async garden() {
      await walkToAsync(world.positions.garden);
      princess.faceTowards(world.gardenCenter);
      princess.setState("plant");
      PM.UI.showBubble(BUBBLES.garden, 2200);
      await wait(1400);
      const save = PM.Save.get();
      const idx = save.flowers;
      save.flowers += 1;
      PM.Save.save();
      if (idx < 60) world.plantFlower(idx, true);
      PM.Audio.sfx("grow");
      world.sparkleBurst(V3(world.gardenCenter.x, 1, world.gardenCenter.z));
      await wait(1200);
      // 10本ごとにちょうちょのおまつり
      if (save.flowers % 10 === 0) {
        world.confettiBurst(V3(world.gardenCenter.x, 2, world.gardenCenter.z));
        PM.Audio.sfx("yay");
      }
      await wait(300);
    }
  };

  const STARS = { tea: 1, dance: 1, art: 1, magic: 1, pony: 1, garden: 1 };
  const HEARTS = { tea: 2, dance: 2, art: 2, magic: 3, pony: 3, garden: 2 };

  async function run(id) {
    if (busy || !ACTS[id]) return;
    busy = true;
    PM.UI.setBusy(true);
    PM.Audio.sfx("tap");
    try {
      await ACTS[id]();
      princess.setState("celebrate");
      PM.Audio.sfx("yay");
      const chained = reward(id, STARS[id], HEARTS[id]);
      await wait(1300);
      if (!chained) {
        princess.setState("idle");
        busy = false;
        PM.UI.setBusy(false);
      }
      // chained(レベルアップ/舞踏会)の場合はそちらが busy を解除する
    } catch (e) {
      console.error("activity failed:", id, e);
      princess.setState("idle");
      busy = false;
      PM.UI.setBusy(false);
    }
  }

  /* ---------- 地面タップでお散歩 ---------- */
  function walkFree(point) {
    if (busy) return;
    const p = point.clone();
    p.y = 0;
    // 広場の外周にとどめる
    const d = Math.hypot(p.x, p.z);
    if (d > 19) { p.x *= 19 / d; p.z *= 19 / d; }
    princess.walkTo(p, () => {
      if (Math.random() < 0.3) {
        princess.setState("wave");
        setTimeout(() => { if (princess.state === "wave") princess.setState("idle"); }, 1200);
      }
    });
    PM.Audio.sfx("tap");
  }

  function isBusy() { return busy; }

  function init(s, w, p) {
    scene = s; world = w; princess = p;
    return { run, walkFree, isBusy };
  }

  return { init };
})();
