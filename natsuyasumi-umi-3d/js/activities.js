/* ============================================================
   activities.js — あそびとエフェクト
   かいがらあつめ / むしとり / つり / すいかわり / はなび / ずかん
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  /* ---------------- ずかんデータ ---------------- */
  G.SPECIES = [
    { key: 'shell',     name: 'かいがら',     emoji: '🐚' },
    { key: 'butterfly', name: 'ちょうちょ',   emoji: '🦋' },
    { key: 'beetle',    name: 'かぶとむし',   emoji: '🪲' },
    { key: 'hotaru',    name: 'ほたる',       emoji: '✨' },
    { key: 'kani',      name: 'かに',         emoji: '🦀' },
    { key: 'aji',       name: 'あじ',         emoji: '🐟' },
    { key: 'tai',       name: 'たい',         emoji: '🐠' },
    { key: 'fugu',      name: 'ふぐ',         emoji: '🐡' },
    { key: 'tako',      name: 'たこ',         emoji: '🐙' },
    { key: 'niji',      name: 'にじうお',     emoji: '🌈' },
    { key: 'suika',     name: 'すいか',       emoji: '🍉' },
    { key: 'iruka',     name: 'いるか',       emoji: '🐬' },
  ];
  G.speciesByKey = {};
  G.SPECIES.forEach(s => { G.speciesByKey[s.key] = s; G.state.counts[s.key] = 0; });

  const FISH_POOL = [
    { key: 'aji',  weight: 46 },
    { key: 'tai',  weight: 24 },
    { key: 'fugu', weight: 16 },
    { key: 'tako', weight: 10 },
    { key: 'niji', weight: 4 },
  ];
  function rollFish() {
    let total = 0;
    for (const f of FISH_POOL) total += f.weight;
    let r = Math.random() * total;
    for (const f of FISH_POOL) { r -= f.weight; if (r <= 0) return f.key; }
    return 'aji';
  }

  /* ============================================================
     FX — パーティクルと波紋
     ============================================================ */
  G.createFX = function (scene) {
    const fx = {};
    const sparkPool = new G.ParticlePool(scene, 900, { additive: true, texture: G.softCircleTexture() });
    const puffPool = new G.ParticlePool(scene, 500, { additive: false, texture: G.softCircleTexture() });

    // 波紋リング（メッシュのプール）
    const rings = [];
    const ringGeo = new THREE.RingGeometry(0.8, 1.0, 24);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.visible = false;
      scene.add(m);
      rings.push({ m, t: 1, scale: 1 });
    }
    let ringCursor = 0;

    fx.splashRing = function (x, y, z, scale = 1) {
      const r = rings[ringCursor];
      ringCursor = (ringCursor + 1) % rings.length;
      r.t = 0; r.scale = scale;
      r.m.position.set(x, y + 0.06, z);
      r.m.visible = true;
    };

    fx.splash = function (x, y, z, scale = 1) {
      puffPool.burst(x, y + 0.1, z, Math.floor(14 * scale), {
        color: 0xeafaff, speedMin: 1.5 * scale, speedMax: 3.6 * scale, minUp: 1.2 * scale,
        lifeMin: 0.35, lifeMax: 0.7, sizeMin: 0.5 * scale, sizeMax: 1.1 * scale,
        gravity: 9, spread: 0.3 * scale,
      });
      fx.splashRing(x, y, z, scale);
    };

    fx.sparkleBurst = function (pos, color = 0xfff0a0, count = 16) {
      sparkPool.burst(pos.x, pos.y, pos.z, count, {
        color, colorJitter: 0.06,
        speedMin: 0.8, speedMax: 2.4, lifeMin: 0.4, lifeMax: 0.9,
        sizeMin: 0.5, sizeMax: 1.0, gravity: -0.6, drag: 2.0, spread: 0.2,
      });
    };

    fx.confetti = function (pos, count = 26) {
      puffPool.burst(pos.x, pos.y + 0.6, pos.z, count, {
        color: [0xff5f8a, 0xffc226, 0x3fb6f2, 0x4fc06a, 0xc98af5, 0xff8a4a],
        speedMin: 2, speedMax: 5, minUp: 2, lifeMin: 0.7, lifeMax: 1.4,
        sizeMin: 0.35, sizeMax: 0.7, gravity: 7, drag: 1.2, spread: 0.3,
      });
    };

    fx.juice = function (pos) {
      puffPool.burst(pos.x, pos.y, pos.z, 30, {
        color: [0xff4a5a, 0xff6a6a, 0xffa0a0],
        speedMin: 1.5, speedMax: 4.5, minUp: 1.5, lifeMin: 0.5, lifeMax: 1.0,
        sizeMin: 0.3, sizeMax: 0.8, gravity: 9, spread: 0.4,
      });
    };

    // 花火
    const fwPending = [];
    fx.firework = function (x, z, delay = 0) {
      fwPending.push({ x, z, t: -delay, phase: 'wait' });
      if (G.audio.ready) G.audio.firework(delay);
    };

    fx.update = function (dt, elapsed) {
      sparkPool.update(dt);
      puffPool.update(dt);
      for (const r of rings) {
        if (!r.m.visible) continue;
        r.t += dt * 1.6;
        if (r.t >= 1) { r.m.visible = false; continue; }
        const s = (0.4 + r.t * 2.2) * r.scale;
        r.m.scale.set(s, 1, s);
        r.m.material.opacity = (1 - r.t) * 0.7;
      }
      // 花火の進行
      for (let i = fwPending.length - 1; i >= 0; i--) {
        const f = fwPending[i];
        f.t += dt;
        if (f.phase === 'wait' && f.t >= 0) {
          f.phase = 'rise';
          f.y = 0; f.t = 0;
          f.targetY = G.rand(26, 40);
          f.hue = Math.random();
        }
        if (f.phase === 'rise') {
          const riseT = f.t / 1.0;
          f.y = f.targetY * riseT;
          // のぼる光の尾
          const c = new THREE.Color().setHSL(0.12, 0.5, 0.8);
          sparkPool.emit(f.x + G.rand(-0.1, 0.1), f.y, f.z + G.rand(-0.1, 0.1),
            0, -2, 0, 0.4, 0.7, c, 0, 0);
          if (riseT >= 1) {
            f.phase = 'boom';
            // 大輪
            const col1 = new THREE.Color().setHSL(f.hue, 0.85, 0.65);
            const col2 = new THREE.Color().setHSL((f.hue + 0.12) % 1, 0.85, 0.7);
            for (let n = 0; n < 90; n++) {
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(G.rand(-1, 1));
              const spd = G.rand(6, 11);
              sparkPool.emit(f.x, f.y, f.z,
                Math.sin(phi) * Math.cos(theta) * spd,
                Math.cos(phi) * spd,
                Math.sin(phi) * Math.sin(theta) * spd,
                G.rand(0.9, 1.6), G.rand(0.8, 1.5),
                n % 3 ? col1 : col2, 3.2, 0.9);
            }
            fwPending.splice(i, 1);
          }
        }
      }
    };
    return fx;
  };

  /* ============================================================
     あそび本体
     ============================================================ */
  G.createActivities = function (scene, player, ocean, island, creatures) {
    const A = (G.activities = {});
    const st = G.state;

    function lam(color) { return new THREE.MeshLambertMaterial({ color }); }

    /* ---------------- とる！ 共通処理 ---------------- */
    A.registerCatch = function (key, pos, opts = {}) {
      const sp = G.speciesByKey[key];
      const first = st.counts[key] === 0;
      st.counts[key]++;
      st.totalCaught++;
      if (pos && G.fx) {
        G.fx.confetti(pos);
        G.fx.sparkleBurst(pos);
      }
      G.ui.refreshCounts();
      if (opts.quiet) {
        if (first) G.ui.toast(`${sp.emoji} ${sp.name}を みつけた！`);
      } else if (opts.celebrate) {
        G.ui.celebrate(sp, opts.big);
        if (G.audio.ready) (opts.big ? G.audio.bigFanfare : G.audio.fanfare)();
        player.hop();
      } else {
        G.ui.toast(`${sp.emoji} ${sp.name} げっと！`);
        if (G.audio.ready) G.audio.chime();
      }
      // ごほうびイベント
      checkMilestones();
    };

    let dolphinShown = false;
    function checkMilestones() {
      const fishCount = st.counts.aji + st.counts.tai + st.counts.fugu + st.counts.tako + st.counts.niji;
      if (!dolphinShown && fishCount >= 3) {
        dolphinShown = true;
        setTimeout(() => {
          creatures.dolphinShow();
          G.ui.toast('🐬 イルカが あそびに きたよ！');
          A.registerCatch('iruka', null, { quiet: true });
        }, 1200);
      }
      if (st.totalCaught > 0 && st.totalCaught % 10 === 0 && G.env.nightGlow < 0.5) {
        G.ui.toast('🎉 すごい！ ' + st.totalCaught + 'こ あつめたね！');
      }
    }

    /* ---------------- かいがら ---------------- */
    const shells = [];
    const shellColors = [0xffb8c8, 0xfff0d8, 0xc8e8ff, 0xffe2a8, 0xe8c8ff];
    function shellMesh() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), lam(G.pick(shellColors)));
      body.scale.set(1, 0.45, 0.9);
      body.castShadow = true;
      g.add(body);
      // すじ
      for (let i = -2; i <= 2; i++) {
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.5), body.material);
        ridge.position.set(i * 0.1, 0.08, 0);
        ridge.rotation.y = i * 0.25;
        g.add(ridge);
      }
      // きらきら
      const spark = new THREE.Sprite(new THREE.SpriteMaterial({
        map: G.sparkleTexture(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0xffffcc,
      }));
      spark.position.y = 0.7;
      spark.scale.setScalar(0.8);
      g.add(spark);
      g.userData.spark = spark;
      return g;
    }
    function placeShell(s) {
      // すなはまのどこか
      for (let tries = 0; tries < 40; tries++) {
        const x = G.rand(-26, 28);
        const z = G.rand(28, 44);
        const h = G.islandHeight(x, z);
        if (h > 0.15 && h < 1.3 && !G.onPier(x, z)) {
          s.g.position.set(x, h + 0.1, z);
          s.g.rotation.y = G.rand(0, 6.28);
          s.g.visible = true;
          s.active = true;
          return;
        }
      }
    }
    for (let i = 0; i < 9; i++) {
      const g = shellMesh();
      scene.add(g);
      const s = { g, active: false, respawnT: 0 };
      shells.push(s);
      placeShell(s);
    }

    /* ---------------- ちょうちょ ---------------- */
    const butterflies = [];
    const wingColors = [0xffd54a, 0xfafafa, 0x9ad8ff, 0xffa8c8];
    function makeButterfly() {
      const g = new THREE.Group();
      const col = G.pick(wingColors);
      const wingGeo = new THREE.CircleGeometry(0.22, 8);
      wingGeo.translate(0.2, 0, 0);
      const wm = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
      const wingL = new THREE.Mesh(wingGeo, wm);
      const wingR = new THREE.Mesh(wingGeo, wm);
      wingR.rotation.y = Math.PI;
      g.add(wingL, wingR);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 4, 6),
        new THREE.MeshBasicMaterial({ color: 0x4a3a2a }));
      body.rotation.x = Math.PI / 2;
      g.add(body);
      scene.add(g);
      return {
        g, wingL, wingR,
        cx: G.rand(-18, -6), cz: G.rand(10, 20),
        a: G.rand(0, 6.28), speed: G.rand(0.5, 0.9),
        phase: G.rand(0, 6), active: true, respawnT: 0,
      };
    }
    for (let i = 0; i < 5; i++) butterflies.push(makeButterfly());

    /* ---------------- かぶとむし ---------------- */
    const beetles = [];
    (function makeBeetles() {
      const treePos = island.beetleTree.position;
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Group();
        const bm = lam(0x4a2e1a);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 7), bm);
        body.scale.set(0.85, 0.55, 1.2);
        g.add(body);
        const headM = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bm);
        headM.position.z = 0.22;
        g.add(headM);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 5), bm);
        horn.position.set(0, 0.12, 0.34);
        horn.rotation.x = 0.7;
        g.add(horn);
        const a = G.rand(0, 6.28);
        const r = 0.52;
        g.position.set(
          treePos.x + Math.cos(a) * r,
          treePos.y + G.rand(1.0, 2.2),
          treePos.z + Math.sin(a) * r
        );
        g.rotation.y = -a;
        g.rotation.z = Math.PI / 2 * (Math.random() < 0.5 ? 0.9 : -0.9);
        scene.add(g);
        beetles.push({ g, active: true, respawnT: 0, baseY: g.position.y, phase: G.rand(0, 6) });
      }
    })();

    /* ---------------- ほたる（よるだけ） ---------------- */
    const fireflies = [];
    (function makeFireflies() {
      const tex = G.softCircleTexture(64, 0.1, '210,255,140');
      for (let i = 0; i < 14; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, color: 0xd8ffa0,
        }));
        s.scale.setScalar(0.6);
        scene.add(s);
        fireflies.push({
          s,
          cx: G.rand(-22, 8), cz: G.rand(2, 22),
          a: G.rand(0, 6.28), r: G.rand(1, 4),
          phase: G.rand(0, 6), speed: G.rand(0.3, 0.7),
          active: true, respawnT: 0,
        });
      }
    })();

    /* ---------------- すいか ---------------- */
    const suika = (function makeSuika() {
      const g = new THREE.Group();
      // ござ
      const mat_ = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 2.4), lam(0x7ac8e8));
      mat_.receiveShadow = true;
      g.add(mat_);
      // すいか（しまもよう canvas テクスチャ）
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3e9e3e';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#1e6e2a';
      ctx.lineWidth = 11;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        const x0 = i * 32 + 8;
        ctx.moveTo(x0, 0);
        ctx.bezierCurveTo(x0 + 14, 40, x0 - 14, 90, x0 + 6, 128);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      const melon = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12),
        new THREE.MeshLambertMaterial({ map: tex }));
      melon.scale.y = 0.85;
      melon.position.y = 0.55;
      melon.castShadow = true;
      g.add(melon);
      // わったあとの半分×2（かくしておく）
      function half() {
        const hg = new THREE.Group();
        const shellH = new THREE.Mesh(
          new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshLambertMaterial({ map: tex }));
        hg.add(shellH);
        const flesh = new THREE.Mesh(new THREE.CircleGeometry(0.58, 14), lam(0xff5a6a));
        flesh.rotation.x = Math.PI / 2;
        flesh.position.y = 0.01;
        hg.add(flesh);
        // たね
        for (let i = 0; i < 6; i++) {
          const seed = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4),
            new THREE.MeshBasicMaterial({ color: 0x222222 }));
          seed.position.set(G.rand(-0.35, 0.35), 0.03, G.rand(-0.35, 0.35));
          seed.scale.y = 0.4;
          hg.add(seed);
        }
        hg.visible = false;
        hg.rotation.x = Math.PI; // 切り口を上に
        g.add(hg);
        return hg;
      }
      const halfA = half(), halfB = half();

      const x = -5, z = 37;
      g.position.set(x, G.islandHeight(x, z) + 0.05, z);
      g.rotation.y = 0.4;
      scene.add(g);

      const obj = { g, melon, halfA, halfB, hits: 0, state: 'whole', respawnT: 0, wobbleT: -1 };
      G.tappables.push({
        obj: melon, radius: 1.6, onTap() { A.hitSuika(); },
      });
      return obj;
    })();

    A.hitSuika = function () {
      if (suika.state !== 'whole') return;
      const dist = player.pos.distanceTo(suika.g.position);
      if (dist > 4.5) return; // ちかくでね
      suika.hits++;
      suika.wobbleT = 0;
      if (G.audio.ready) G.audio.knock();
      if (suika.hits >= 3) {
        suika.state = 'open';
        suika.melon.visible = false;
        suika.halfA.visible = true;
        suika.halfB.visible = true;
        suika.halfA.position.set(-0.5, 0.35, 0);
        suika.halfB.position.set(0.5, 0.35, 0.15);
        suika.halfA.rotation.z = 0.3;
        suika.halfB.rotation.z = -0.3;
        if (G.audio.ready) G.audio.suika();
        const wp = new THREE.Vector3();
        suika.g.getWorldPosition(wp);
        wp.y += 0.8;
        if (G.fx) G.fx.juice(wp);
        A.registerCatch('suika', wp, { celebrate: true });
        suika.respawnT = 35;
      }
    };

    /* ---------------- つり ---------------- */
    const fishing = {
      phase: 'idle',  // idle / waiting / bite / reeling
      t: 0,
      bobberTarget: new THREE.Vector3(),
      fishKey: null,
      fishMesh: null,
    };
    A.fishing = fishing;

    function inFishingZone() {
      const P = G.PIER;
      return G.onPier(player.pos.x, player.pos.z) && player.pos.z > P.zEnd - 7;
    }

    function startFishing() {
      st.busy = true;
      fishing.phase = 'waiting';
      fishing.t = 0;
      fishing.biteAt = G.rand(2.2, 5.5);
      player.heading = 0; // うみ（+z おき）へ
      player.root.rotation.y = 0;
      player.rod.visible = true;
      // うきを投げる
      const bx = player.pos.x + G.rand(-1, 1);
      const bz = player.pos.z + G.rand(4.5, 6.5);
      fishing.bobberTarget.set(bx, 0.15, bz);
      fishing.castT = 0;
      fishing.landed = false;
      player.bobber.visible = true;
      player.line.visible = true;
      G.ui.setAction('やめる', '', stopFishing);
      if (G.audio.ready) G.audio.pop();
    }

    function stopFishing() {
      st.busy = false;
      fishing.phase = 'idle';
      player.rod.visible = false;
      player.bobber.visible = false;
      player.line.visible = false;
      G.ui.hideBite();
      G.ui.clearAction();
    }

    function hookFish() {
      fishing.phase = 'reeling';
      fishing.t = 0;
      fishing.fishKey = rollFish();
      G.ui.hideBite();
      const bp = player.bobber.position;
      if (G.fx) G.fx.splash(bp.x, 0, bp.z, 1.4);
      if (G.audio.ready) G.audio.splash(true);
      // さかなが飛び出す
      const sp = G.speciesByKey[fishing.fishKey];
      const col = { aji: 0x9ab8cc, tai: 0xf47a8a, fugu: 0xd8c890, tako: 0xd06a5a, niji: 0x7ae8d8 }[fishing.fishKey];
      const fg = new THREE.Group();
      const fbody = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), lam(col));
      fbody.scale.set(0.7, 0.8, 1.3);
      fg.add(fbody);
      const ftail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 4), lam(col));
      ftail.rotation.x = -Math.PI / 2;
      ftail.position.z = -0.42;
      ftail.scale.set(1.4, 1, 0.3);
      fg.add(ftail);
      if (fishing.fishKey === 'niji') {
        // にじうおはキラキラ
        fbody.material = new THREE.MeshPhongMaterial({ color: col, emissive: 0x2a8878, shininess: 120 });
      }
      fg.position.copy(bp);
      scene.add(fg);
      fishing.fishMesh = fg;
      fishing.fishStart = bp.clone();
    }

    A.tryStartFishing = startFishing;

    function updateFishing(dt, elapsed) {
      const P = G.PIER;
      if (fishing.phase === 'waiting') {
        fishing.castT += dt;
        const ct = Math.min(1, fishing.castT / 0.6);
        // うきが弧を描いてとぶ
        const tip = player.rodTipWorld;
        const bx = G.lerp(tip.x, fishing.bobberTarget.x, ct);
        const bz = G.lerp(tip.z, fishing.bobberTarget.z, ct);
        let by = G.lerp(tip.y, 0.15, ct) + Math.sin(ct * Math.PI) * 1.6;
        if (ct >= 1) {
          const wave = ocean.waveHeight(bx, bz, elapsed);
          by = 0.15 + wave * 0.5 + Math.sin(elapsed * 2.4) * 0.05;
          if (!fishing.landed) {
            fishing.landed = true;
            if (G.fx) G.fx.splash(bx, 0, bz, 0.7);
            if (G.audio.ready) G.audio.splash(false);
          }
        }
        player.bobber.position.set(bx, by, bz);
        fishing.t += dt;
        if (fishing.t > fishing.biteAt + 0.6) {
          fishing.phase = 'bite';
          fishing.t = 0;
          G.ui.showBite();
          G.ui.setAction('つりあげる！', 'fishing', () => { if (fishing.phase === 'bite') hookFish(); });
          if (G.audio.ready) G.audio.bite();
          if (navigator.vibrate) { try { navigator.vibrate([80, 60, 80]); } catch (e) {} }
        }
      } else if (fishing.phase === 'bite') {
        fishing.t += dt;
        // うきがぐいぐい沈む
        const bp = player.bobber.position;
        bp.y = 0.15 - Math.abs(Math.sin(fishing.t * 9)) * 0.35;
        if (Math.random() < dt * 6 && G.fx) G.fx.splashRing(bp.x, 0, bp.z, 0.5);
        // タップでもつれる
        if (G.input && G.input.consumeTap()) { hookFish(); return; }
        if (fishing.t > 3.0) {
          // にげちゃった → もういちど待つ（4歳にやさしく）
          fishing.phase = 'waiting';
          fishing.t = 0;
          fishing.biteAt = G.rand(1.6, 3.5);
          fishing.landed = true;
          G.ui.hideBite();
          G.ui.toast('あれれ… もういちど！');
          G.ui.setAction('やめる', '', stopFishing);
        }
      } else if (fishing.phase === 'reeling') {
        fishing.t += dt * 1.4;
        const t = Math.min(1, fishing.t);
        const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z + 0.8);
        const fm = fishing.fishMesh;
        fm.position.lerpVectors(fishing.fishStart, target, t);
        fm.position.y += Math.sin(t * Math.PI) * 3.2;
        fm.rotation.y += dt * 6;
        fm.rotation.z = Math.sin(elapsed * 14) * 0.4;
        player.bobber.position.copy(fm.position).y += 0.3;
        if (t >= 1) {
          scene.remove(fm);
          fishing.fishMesh = null;
          const sp = G.speciesByKey[fishing.fishKey];
          A.registerCatch(fishing.fishKey, player.pos.clone().setY(player.pos.y + 1.5),
            { celebrate: true, big: fishing.fishKey === 'niji' || fishing.fishKey === 'tako' });
          fishing.landed = false;
          stopFishing();
        }
      }
      // つりいと更新
      if (player.line.visible) {
        const pts = player.line.geometry.attributes.position.array;
        pts[0] = player.rodTipWorld.x; pts[1] = player.rodTipWorld.y; pts[2] = player.rodTipWorld.z;
        pts[3] = player.bobber.position.x; pts[4] = player.bobber.position.y; pts[5] = player.bobber.position.z;
        player.line.geometry.attributes.position.needsUpdate = true;
      }
    }

    /* ---------------- むしとり ---------------- */
    let netTarget = null; // {kind, obj}
    function tryCatchBug() {
      if (!netTarget) return;
      const t = netTarget;
      netTarget = null;
      player.swingNet();
      G.ui.clearAction();
      setTimeout(() => {
        if (t.kind === 'butterfly') {
          t.b.active = false;
          t.b.g.visible = false;
          t.b.respawnT = G.rand(14, 26);
          A.registerCatch('butterfly', t.b.g.position, { celebrate: true });
        } else if (t.kind === 'beetle') {
          t.b.active = false;
          t.b.g.visible = false;
          t.b.respawnT = G.rand(20, 40);
          A.registerCatch('beetle', t.b.g.position, { celebrate: true });
        }
      }, 320);
    }

    /* ---------------- はなび（よるの自動ショー） ---------------- */
    let fwTimer = 8;

    /* ---------------- メイン更新 ---------------- */
    const _wp = new THREE.Vector3();
    A.update = function (dt, elapsed) {
      const night = G.env.nightGlow;

      /* かいがら */
      for (const s of shells) {
        if (!s.active) {
          s.respawnT -= dt;
          if (s.respawnT <= 0) placeShell(s);
          continue;
        }
        s.g.rotation.y += dt * 0.6;
        const sp = s.g.userData.spark;
        sp.material.opacity = 0.55 + Math.sin(elapsed * 3 + s.g.position.x) * 0.35;
        sp.scale.setScalar(0.7 + Math.sin(elapsed * 4 + s.g.position.z) * 0.15);
        if (!st.busy && player.pos.distanceTo(s.g.position) < 1.5) {
          s.active = false;
          s.g.visible = false;
          s.respawnT = G.rand(18, 32);
          A.registerCatch('shell', s.g.position);
        }
      }

      /* ちょうちょ（ひるま） */
      const bugsAwake = night < 0.4;
      let nearestBug = null, nearestDist = 99;
      for (const b of butterflies) {
        if (!b.active) {
          b.respawnT -= dt;
          if (b.respawnT <= 0) {
            b.active = true; b.g.visible = true;
            b.cx = G.rand(-20, 20); b.cz = G.rand(0, 24);
          }
          continue;
        }
        b.g.visible = bugsAwake;
        if (!bugsAwake) continue;
        b.a += b.speed * dt;
        const x = b.cx + Math.cos(b.a) * 2.5 + Math.sin(elapsed * 0.7 + b.phase) * 1.2;
        const z = b.cz + Math.sin(b.a * 1.3) * 2.0;
        const groundY = Math.max(G.islandHeight(x, z), 0);
        const y = groundY + 1.1 + Math.sin(elapsed * 2.1 + b.phase) * 0.4;
        b.g.position.set(x, y, z);
        b.g.rotation.y = Math.atan2(Math.cos(b.a), -Math.sin(b.a));
        const flap = Math.abs(Math.sin(elapsed * 11 + b.phase)) * 1.1;
        b.wingL.rotation.z = flap - 0.4;
        b.wingR.rotation.z = -(flap - 0.4);
        const d = player.pos.distanceTo(b.g.position);
        if (d < 2.6 && d < nearestDist) { nearestDist = d; nearestBug = { kind: 'butterfly', b }; }
      }

      /* かぶとむし */
      for (const b of beetles) {
        if (!b.active) {
          b.respawnT -= dt;
          if (b.respawnT <= 0) { b.active = true; b.g.visible = true; }
          continue;
        }
        b.g.position.y = b.baseY + Math.sin(elapsed * 0.5 + b.phase) * 0.35;
        const d = player.pos.distanceTo(b.g.position);
        if (d < 2.8 && d < nearestDist) { nearestDist = d; nearestBug = { kind: 'beetle', b }; }
      }

      /* ほたる（よる） */
      for (const f of fireflies) {
        if (!f.active) {
          f.respawnT -= dt;
          if (f.respawnT <= 0) { f.active = true; }
          continue;
        }
        const on = night > 0.55;
        f.s.visible = on;
        if (!on) continue;
        f.a += f.speed * dt;
        const x = f.cx + Math.cos(f.a) * f.r;
        const z = f.cz + Math.sin(f.a * 0.8) * f.r;
        const y = Math.max(G.islandHeight(x, z), 0) + 0.9 + Math.sin(elapsed * 1.3 + f.phase) * 0.5;
        f.s.position.set(x, y, z);
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.6 + f.phase * 2);
        f.s.material.opacity = 0.25 + pulse * 0.75;
        f.s.scale.setScalar(0.45 + pulse * 0.5);
        if (!st.busy && player.pos.distanceTo(f.s.position) < 1.4) {
          f.active = false;
          f.s.visible = false;
          f.respawnT = G.rand(10, 20);
          A.registerCatch('hotaru', f.s.position);
        }
      }

      /* すいか */
      if (suika.wobbleT >= 0) {
        suika.wobbleT += dt * 8;
        suika.melon.rotation.z = Math.sin(suika.wobbleT * 3) * 0.25 * Math.max(0, 1 - suika.wobbleT / 4);
        if (suika.wobbleT > 4) suika.wobbleT = -1;
      }
      if (suika.state === 'open') {
        suika.respawnT -= dt;
        if (suika.respawnT <= 0) {
          suika.state = 'whole';
          suika.hits = 0;
          suika.melon.visible = true;
          suika.halfA.visible = false;
          suika.halfB.visible = false;
        }
      }

      /* つり */
      if (fishing.phase !== 'idle') {
        updateFishing(dt, elapsed);
      } else if (!st.busy) {
        /* アクションボタンの出しわけ */
        if (inFishingZone()) {
          G.ui.setAction('つりを する！', 'fishing', startFishing);
          netTarget = null;
        } else if (nearestBug) {
          netTarget = nearestBug;
          G.ui.setAction('あみで つかまえる！', '', tryCatchBug);
        } else if (suika.state === 'whole' && player.pos.distanceTo(suika.g.position) < 3.2) {
          G.ui.setAction('すいかを たたく！', '', A.hitSuika);
          netTarget = null;
        } else {
          netTarget = null;
          G.ui.clearAction();
        }
      }

      /* はなびショー（よる） */
      if (night > 0.7) {
        fwTimer -= dt;
        if (fwTimer <= 0) {
          fwTimer = G.rand(14, 24);
          const n = G.randInt(1, 3);
          for (let i = 0; i < n; i++) {
            G.fx.firework(G.rand(-35, 35), G.rand(75, 95), i * 1.1);
          }
        }
      }
    };

    return A;
  };
})();
