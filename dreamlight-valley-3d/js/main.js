/* =========================================================================
 * きらきら ドリームバレー — メイン
 * レンダリング（ブルーム付き）/ カメラ / 入力 / ゲームロジック / UI
 * ========================================================================= */
(function () {
  'use strict';

  const DV = window.DV;
  const U = DV.U;
  const World = DV.World;
  const FX = DV.FX;
  const Audio = DV.Audio;

  /* ------------------------------ 状態 ------------------------------ */
  const state = {
    started: false,
    stars: 0,
    fruit: 0,
    friends: 0,
    shards: [false, false, false, false, false, false, false],
    rainbowDone: false,
    rainbowT: 0,
    outfit: 0,
    dayTarget: 1,
    dayF: 1,
    introT: 0,
    lastFireworkT: 0,
    starMilestone: 10,
  };

  const SHARD_COLORS = [0xff5e5e, 0xff9d45, 0xffd93b, 0x5fd971, 0x4db9ff, 0x6f7bff, 0xc07bff];
  const SHARD_SPOTS = [
    [0, 59], [20, 45], [8, 11], [26, -38], [-19, -36], [7, -46], [42, 24],
  ];

  /* ------------------------------ セーブ ------------------------------ */
  function save() {
    try {
      localStorage.setItem('dv-save', JSON.stringify({
        stars: state.stars, fruit: state.fruit, outfit: state.outfit,
        shards: state.shards, rainbowDone: state.rainbowDone,
        friendIdx: animals.map((a, i) => (a.isFriend ? i : -1)).filter((i) => i >= 0),
      }));
    } catch (e) { /* プライベートモードなどでは保存しない */ }
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem('dv-save'));
      if (!d) return null;
      return d;
    } catch (e) { return null; }
  }

  /* ------------------------------ 基本セットアップ ------------------------------ */
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const FOG_DAY = U.C(0xd8ebf7);
  const FOG_NIGHT = U.C(0x10152e);
  scene.fog = new THREE.Fog(FOG_DAY.clone(), 60, 235);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 520);

  /* ---------- ポストプロセス（ブルーム） ---------- */
  const composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.5, 0.88
  );
  composer.addPass(bloomPass);
  const gammaPass = new THREE.ShaderPass(THREE.GammaCorrectionShader);
  composer.addPass(gammaPass);

  /* ---------- ライト ---------- */
  const hemi = new THREE.HemisphereLight(U.C(0xcde8ff), U.C(0x96b56e), 0.52);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(U.C(0xfff0d0), 1.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const amb = new THREE.AmbientLight(U.C(0x9fb8d8), 0.16);
  scene.add(amb);

  const SUN_DIR = new THREE.Vector3(0.55, 0.85, 0.62).normalize();
  const MOON_DIR = new THREE.Vector3(-0.5, 0.8, -0.45).normalize();

  /* ---------- ワールド＆キャラクター ---------- */
  World.build(scene);
  FX.init(scene);
  const player = DV.Creatures.createPlayer(scene);
  const animals = DV.Creatures.createAnimals(scene);

  /* ---------- 収集アイテム：星 ---------- */
  const stars = [];
  function randomStarSpot() {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.sqrt(Math.random()) * 58;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = World.height(x, z);
      if (h > 0.6 && h < 9) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0, 0, 30);
  }

  function makeStar() {
    const g = new THREE.Group();
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: DV.Tex.star, transparent: true, depthWrite: false, color: U.C(0xffe98a),
    }));
    spr.scale.set(1.5, 1.5, 1);
    g.add(spr);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: DV.Tex.glow, transparent: true, depthWrite: false, opacity: 0.6,
      color: U.C(0xffd76e), blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(2.6, 2.6, 1);
    g.add(glow);
    scene.add(g);
    const s = { g, spr, glow, respawn: 0, phase: Math.random() * 9 };
    place(s);
    stars.push(s);
    return s;

    function place(s) {
      const p = randomStarSpot();
      s.g.position.set(p.x, World.height(p.x, p.z) + 1.3, p.z);
      s.g.visible = true;
    }
  }
  for (let i = 0; i < 12; i++) makeStar();

  function respawnStar(s) {
    const p = randomStarSpot();
    s.g.position.set(p.x, World.height(p.x, p.z) + 1.3, p.z);
    s.g.visible = true;
  }

  /* ---------- 収集アイテム：虹のかけら ---------- */
  const shards = [];
  SHARD_SPOTS.forEach(([x, z], i) => {
    const g = new THREE.Group();
    const c = U.C(SHARD_COLORS[i]);
    const crystalGeo = new THREE.OctahedronGeometry(0.55, 0);
    crystalGeo.scale(1, 1.7, 1);
    const crystal = new THREE.Mesh(crystalGeo, new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(1.35) }));
    g.add(crystal);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: DV.Tex.glow, transparent: true, depthWrite: false, opacity: 0.5,
      color: c, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(3.0, 3.0, 1);
    g.add(glow);
    // 空へのびる光の柱（遠くからでも見つけられる）
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.42, 24, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, depthWrite: false, fog: false,
      })
    );
    pillar.position.y = 13;
    g.add(pillar);
    const h = World.height(x, z);
    g.position.set(x, h + 1.2, z);
    scene.add(g);
    shards.push({ g, crystal, glow, pillar, idx: i, collected: false, phase: i * 1.3 });
  });

  /* ------------------------------ UI ------------------------------ */
  const el = {
    hud: document.getElementById('hud'),
    title: document.getElementById('title'),
    praise: document.getElementById('praise'),
    nStar: document.getElementById('n-star'),
    nFruit: document.getElementById('n-fruit'),
    nFriend: document.getElementById('n-friend'),
    bStar: document.getElementById('b-star'),
    bFruit: document.getElementById('b-fruit'),
    bFriend: document.getElementById('b-friend'),
    dots: document.querySelectorAll('#rainbow-quest .r-dot'),
    btnDay: document.getElementById('btn-day'),
    btnMusic: document.getElementById('btn-music'),
    fade: document.getElementById('fade'),
  };

  function bump(badge) {
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }

  function refreshUI() {
    el.nStar.textContent = state.stars;
    el.nFruit.textContent = state.fruit;
    el.nFriend.textContent = state.friends;
    state.shards.forEach((on, i) => el.dots[i].classList.toggle('on', on));
  }

  let praiseTimer = null;
  function praise(text) {
    el.praise.textContent = text;
    el.praise.classList.remove('pop');
    void el.praise.offsetWidth;
    el.praise.classList.add('pop');
    clearTimeout(praiseTimer);
    praiseTimer = setTimeout(() => el.praise.classList.remove('pop'), 2700);
  }

  // タイトル画面のきらきら
  (function titleSparkles() {
    const safe = ['✨', '⭐', '🌸', '🦋', '💫', '🌟', '🌈'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('div');
      s.className = 't-spark';
      s.textContent = safe[i % safe.length];
      s.style.left = (Math.random() * 96) + '%';
      s.style.animationDuration = (7 + Math.random() * 9) + 's';
      s.style.animationDelay = (-Math.random() * 12) + 's';
      s.style.fontSize = (16 + Math.random() * 22) + 'px';
      el.title.appendChild(s);
    }
  })();

  /* ------------------------------ 開始 ------------------------------ */
  function startGame() {
    if (state.started) return;
    state.started = true;
    Audio.start();
    el.title.classList.add('hide');
    el.hud.classList.add('show');
    state.introT = 0.0001; // イントロカメラ開始

    // セーブ復元
    const d = load();
    if (d) {
      state.stars = d.stars || 0;
      state.fruit = d.fruit || 0;
      state.outfit = d.outfit || 0;
      player.setOutfit(state.outfit);
      if (Array.isArray(d.shards)) state.shards = d.shards.slice(0, 7);
      state.rainbowDone = !!d.rainbowDone;
      (d.friendIdx || []).forEach((i) => {
        if (animals[i] && animals[i].feedable) {
          animals[i].isFriend = true;
          animals[i].followIdx = state.friends++;
        }
      });
      shards.forEach((s) => {
        if (state.shards[s.idx]) { s.collected = true; s.g.visible = false; }
      });
      if (state.rainbowDone) {
        state.rainbowT = 1;
        World.showRainbow(1);
        player.crown.visible = true;
      }
      state.starMilestone = Math.max(10, Math.ceil((state.stars + 1) / 10) * 10);
    }
    refreshUI();
  }

  el.title.addEventListener('pointerdown', (e) => { e.preventDefault(); startGame(); });

  /* ------------------------------ ボタン ------------------------------ */
  el.btnDay.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    Audio.resume();
    state.dayTarget = state.dayTarget > 0.5 ? 0 : 1;
    el.btnDay.textContent = state.dayTarget > 0.5 ? '🌙' : '☀️';
    Audio.setNight(state.dayTarget < 0.5);
    if (Audio.ready()) Audio.sfxDress();
  });

  el.btnMusic.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    Audio.resume();
    const on = Audio.toggleMusic();
    el.btnMusic.classList.toggle('off', !on);
  });

  /* ------------------------------ 入力 ------------------------------ */
  const raycaster = new THREE.Raycaster();
  const pointers = new Map();
  let pinchStart = 0, zoomStart = 0, dragging = false, downPos = null, downTime = 0;
  let camDist = 15, camDistTarget = 15;

  // 地形とレイの交点（解析的レイマーチ：高速で BVH いらず）
  function groundHit(ray) {
    const o = ray.origin, d = ray.direction;
    let tPrev = 0.5;
    let dyPrev = o.y + d.y * tPrev - World.height(o.x + d.x * tPrev, o.z + d.z * tPrev);
    for (let t = 2; t < 300; t += 1.6) {
      const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
      const dy = py - World.height(px, pz);
      if (dy <= 0) {
        // 二分法で精密化
        let a = tPrev, b = t;
        for (let i = 0; i < 14; i++) {
          const m = (a + b) / 2;
          const my = o.y + d.y * m - World.height(o.x + d.x * m, o.z + d.z * m);
          if (my > 0) a = m; else b = m;
        }
        const tf = (a + b) / 2;
        return new THREE.Vector3(o.x + d.x * tf, o.y + d.y * tf, o.z + d.z * tf);
      }
      tPrev = t; dyPrev = dy;
    }
    return null;
  }

  function setRayFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x, y }, camera);
  }

  function rayPointDistance(ray, point) {
    return ray.distanceToPoint(point);
  }

  function handleTap(e) {
    if (state.introT > 0 && state.introT < 1) return;
    setRayFromEvent(e);
    const ray = raycaster.ray;
    Audio.resume();

    // 1) どうぶつ
    const tmp = new THREE.Vector3();
    for (const a of animals) {
      tmp.copy(a.group.position); tmp.y += 0.7;
      if (rayPointDistance(ray, tmp) < 1.25) {
        a.tap();
        return;
      }
    }
    // 2) プレイヤー（おきがえ）
    tmp.copy(player.group.position); tmp.y += 1.2;
    if (rayPointDistance(ray, tmp) < 1.1) {
      state.outfit = (state.outfit + 1) % DV.Creatures.OUTFITS.length;
      player.setOutfit(state.outfit);
      FX.magicBurst(player.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd6f0);
      if (Audio.ready()) Audio.sfxDress();
      praise('👗 おきがえ！ かわいい！');
      save();
      return;
    }
    // 3) フルーツの木（ゆらすとりんごが落ちる）
    for (const tr of World.fruitTrees) {
      tmp.set(tr.x, tr.h + 2.4 * tr.s, tr.z);
      if (rayPointDistance(ray, tmp) < 2.4 * tr.s) {
        tr.shake = 0.5;
        let dropped = false;
        tr.apples.forEach((ap, i) => {
          if (ap.userData.state === 'onTree') {
            setTimeout(() => {
              if (ap.userData.state === 'onTree') {
                ap.userData.state = 'falling';
                ap.userData.vy = 1;
              }
            }, i * 130);
            dropped = true;
          }
        });
        if (Audio.ready()) Audio.sfxShake();
        FX.burst(tmp, 0xa8e87c, 10, { speed: 2.5, size: 0.4, life: 0.8 });
        if (dropped) player.moveTo(tr.x, tr.z);
        return;
      }
    }
    // 4) 星・かけらをタップ → 歩いていく
    for (const s of stars) {
      if (s.g.visible && rayPointDistance(ray, s.g.position) < 1.6) {
        player.moveTo(s.g.position.x, s.g.position.z);
        return;
      }
    }
    for (const s of shards) {
      if (!s.collected && rayPointDistance(ray, s.g.position) < 2.2) {
        player.moveTo(s.g.position.x, s.g.position.z);
        return;
      }
    }
    // 5) 地面・水面
    const hit = groundHit(ray);
    if (hit) {
      const h = World.height(hit.x, hit.z);
      if (h < World.SEA_Y - 0.05) {
        // 水面タップ：しぶき＆さかな
        FX.splash(new THREE.Vector3(hit.x, World.SEA_Y, hit.z), 1);
        if (Audio.ready()) Audio.sfxSplash();
      } else {
        FX.tapMark(new THREE.Vector3(hit.x, h + 0.4, hit.z));
        if (Audio.ready()) Audio.sfxTap();
      }
      player.moveTo(hit.x, hit.z);
    } else {
      // 空タップ：きらきら
      const p = ray.origin.clone().add(ray.direction.clone().multiplyScalar(30));
      FX.burst(p, 0xfff0b8, 14, { speed: 2, size: 0.7, gravity: 0.5 });
      if (Audio.ready()) Audio.sfxTap();
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!state.started) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinchStart = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      zoomStart = camDistTarget;
      dragging = false;
    } else if (pointers.size === 1) {
      downPos = { x: e.clientX, y: e.clientY };
      downTime = performance.now();
      dragging = false;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (pinchStart > 0) camDistTarget = U.clamp(zoomStart * pinchStart / Math.max(40, d), 9, 26);
      return;
    }
    if (!downPos) return;
    const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    if (!dragging && Math.hypot(dx, dy) > 14) dragging = true;
    if (dragging && state.introT >= 1) {
      // ドラッグ＝その方向へ歩き続ける
      setRayFromEvent(e);
      const hit = groundHit(raycaster.ray);
      if (hit) player.moveTo(hit.x, hit.z);
    }
  });

  function pointerEnd(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (pointers.size === 0) {
      if (!dragging && downPos && performance.now() - downTime < 600 && state.started) {
        handleTap(e);
      }
      downPos = null;
      dragging = false;
    }
  }
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);

  /* ------------------------------ ゲームロジック ------------------------------ */
  function collectChecks(dt, t) {
    const pp = player.group.position;

    // 星
    for (const s of stars) {
      if (!s.g.visible) {
        s.respawn -= dt;
        if (s.respawn <= 0) respawnStar(s);
        continue;
      }
      s.g.position.y += Math.sin(t * 2 + s.phase) * 0.004;
      s.spr.material.rotation += dt * 1.2;
      if (pp.distanceTo(s.g.position) < 1.8) {
        s.g.visible = false;
        s.respawn = 8 + Math.random() * 8;
        state.stars++;
        bump(el.bStar);
        FX.collectStar(s.g.position);
        if (Audio.ready()) Audio.sfxStar();
        if (state.stars >= state.starMilestone) {
          praise('⭐ ほしを ' + state.stars + 'こ あつめたよ！\nすごい！');
          state.starMilestone += 10;
          player.celebrate();
        }
        refreshUI();
        save();
      }
    }

    // 虹のかけら
    for (const s of shards) {
      if (s.collected) continue;
      s.g.position.y = World.height(s.g.position.x, s.g.position.z) + 1.2 + Math.sin(t * 1.6 + s.phase) * 0.25;
      s.crystal.rotation.y += dt * 1.4;
      s.glow.material.opacity = 0.42 + Math.sin(t * 3 + s.phase) * 0.16;
      if (pp.distanceTo(s.g.position) < 2.3) {
        s.collected = true;
        s.g.visible = false;
        state.shards[s.idx] = true;
        FX.magicBurst(s.g.position, SHARD_COLORS[s.idx]);
        if (Audio.ready()) Audio.sfxShard();
        player.celebrate();
        const left = state.shards.filter((x) => !x).length;
        if (left > 0) praise('🌈 にじのかけら ゲット！\nあと ' + left + 'こ！');
        refreshUI();
        save();
        if (left === 0 && !state.rainbowDone) startCelebration();
      }
    }

    // りんご（地面のを拾う）
    for (const tr of World.fruitTrees) {
      for (const ap of tr.apples) {
        if (ap.userData.state === 'ground' && pp.distanceTo(ap.position) < 1.6) {
          ap.userData.state = 'gone';
          ap.visible = false;
          tr.regrow = 45;
          state.fruit++;
          bump(el.bFruit);
          FX.burst(ap.position, 0xff7c7c, 10, { speed: 2, size: 0.45, life: 0.7 });
          if (Audio.ready()) Audio.sfxPop();
          refreshUI();
          save();
        }
      }
    }

    // どうぶつにフルーツをあげる → ともだちに！
    if (state.fruit > 0) {
      for (const a of animals) {
        if (a.feedable && !a.isFriend) {
          const d = Math.hypot(a.group.position.x - pp.x, a.group.position.z - pp.z);
          if (d < 2.3) {
            a.isFriend = true;
            a.followIdx = state.friends;
            state.friends++;
            state.fruit--;
            bump(el.bFriend);
            FX.heartsBurst(a.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 10);
            FX.magicBurst(a.group.position, 0xffb2d5);
            if (Audio.ready()) Audio.sfxFriend();
            praise('💛 ともだちに なったよ！');
            a.tap();
            refreshUI();
            save();
            break;
          }
        }
      }
    }
  }

  /* ---------- 虹のセレブレーション ---------- */
  let celebrationFw = 0;
  let cineT = 0;
  function startCelebration() {
    state.rainbowDone = true;
    player.crown.visible = true;
    player.celebrate();
    if (Audio.ready()) Audio.sfxFanfare();
    praise('🌈 やったー！\nにじが かかったよ！');
    celebrationFw = 14;
    cineT = 9;   // 虹と花火を見上げるシネマティックカメラ
    save();
  }

  /* ------------------------------ カメラ ------------------------------ */
  let camYaw = Math.PI;   // プレイヤーの後ろから
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  function updateCamera(dt) {
    const pp = player.group.position;

    // セレブレーション：虹と花火を見上げるカメラ
    if (cineT > 0) {
      cineT -= dt;
      const cinePos = new THREE.Vector3(5, 11, 66);
      const cineLook = new THREE.Vector3(5, 20, -12);
      camPos.lerp(cinePos, Math.min(1, dt * 1.6));
      camLook.lerp(cineLook, Math.min(1, dt * 2.2));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      return;
    }

    // イントロ：お城の上空から村へスウープ
    if (state.introT > 0 && state.introT < 1) {
      state.introT = Math.min(1, state.introT + dt / 4.2);
      const e = U.sstep(0, 1, state.introT);
      const start = new THREE.Vector3(60, 42, 70);
      const mid = new THREE.Vector3(20, 20, 46);
      // ベジェ風
      const t2 = e;
      const targetPos = getFollowPos();
      const a = start.clone().lerp(mid, t2);
      const b = mid.clone().lerp(targetPos, t2);
      camPos.copy(a.lerp(b, t2));
      camLook.lerp(new THREE.Vector3(pp.x, pp.y + 2, pp.z), Math.min(1, dt * 3 + (t2 === 0 ? 1 : 0)));
      if (state.introT <= dt) camLook.set(World.castlePos.x, 10, World.castlePos.z);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      return;
    }

    // 追従：移動中はプレイヤーの背中側へゆっくり回り込む
    if (player.moving) {
      let desired = player.facing + Math.PI;
      let diff = desired - camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      camYaw += diff * Math.min(1, dt * 0.9);
    }
    camDist += (camDistTarget - camDist) * Math.min(1, dt * 5);

    const target = getFollowPos();
    camPos.lerp(target, Math.min(1, dt * 4));
    camLook.lerp(new THREE.Vector3(pp.x, pp.y + 2.1, pp.z), Math.min(1, dt * 6));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function getFollowPos() {
    const pp = player.group.position;
    const d = camDist;
    const x = pp.x + Math.sin(camYaw) * d;
    const z = pp.z + Math.cos(camYaw) * d;
    let y = pp.y + d * 0.55 + 1.6;
    const minY = World.walkHeight(x, z) + 1.6;
    if (y < minY) y = minY;
    return new THREE.Vector3(x, y, z);
  }

  /* ------------------------------ リサイズ ------------------------------ */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // 縦画面では視野を広げて遊びやすく
    camera.fov = camera.aspect < 1 ? 62 : 50;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));
  resize();

  /* ------------------------------ 昼夜 ------------------------------ */
  const skyDay = U.C(0xcde8ff), skyNight = U.C(0x1a2448);
  const gndDay = U.C(0x96b56e), gndNight = U.C(0x1c2438);
  const sunDay = U.C(0xfff0d0), sunNight = U.C(0x8fa8e8);

  function updateDayNight(rawDt) {
    const target = state.dayTarget;
    if (Math.abs(state.dayF - target) > 0.001) {
      // 低FPS環境でも一定時間（約2.5秒）で切り替わるよう実時間を使う
      const dt = Math.min(rawDt, 0.5);
      state.dayF += Math.sign(target - state.dayF) * Math.min(Math.abs(target - state.dayF), dt * 0.4);
      const f = state.dayF;
      World.setDay(f);
      hemi.color.copy(skyNight).lerp(skyDay, f);
      hemi.groundColor.copy(gndNight).lerp(gndDay, f);
      hemi.intensity = U.lerp(0.22, 0.52, f);
      sun.color.copy(sunNight).lerp(sunDay, f);
      sun.intensity = U.lerp(0.3, 1.3, f);
      amb.intensity = U.lerp(0.07, 0.16, f);
      scene.fog.color.copy(FOG_NIGHT).lerp(FOG_DAY, f);
      renderer.toneMappingExposure = U.lerp(0.8, 0.98, f);
      bloomPass.strength = U.lerp(0.7, 0.42, f);
      Audio.setNight(f < 0.5);
    }
  }

  /* ------------------------------ 自動品質調整 ------------------------------ */
  let fpsEMA = 60, qualityStep = 0, qTimer = 0;
  function autoQuality(dt) {
    fpsEMA = fpsEMA * 0.96 + (1 / Math.max(dt, 0.001)) * 0.04;
    qTimer += dt;
    if (qTimer > 5) {
      qTimer = 0;
      if (fpsEMA < 27 && qualityStep === 0) {
        qualityStep = 1;
        pixelRatio = Math.max(1, pixelRatio * 0.7);
        renderer.setPixelRatio(pixelRatio);
        resize();
      } else if (fpsEMA < 25 && qualityStep === 1) {
        qualityStep = 2;
        bloomPass.enabled = false;
        renderer.shadowMap.enabled = false;
      }
    }
  }

  /* ------------------------------ メインループ ------------------------------ */
  const clock = new THREE.Clock();
  let elapsed = 0;

  // テスト・デバッグ用フック
  DV.game = {
    state, player, animals, camera, stars, shards,
    setZoom(d) { camDistTarget = d; },
    skipIntro() { state.introT = 1; },
    celebrate() { startCelebration(); },
    warp(x, z) {
      player.group.position.set(x, World.walkHeight(x, z), z);
      player.target = null;
    },
  };

  // 初期カメラ（タイトルの後ろでお城を眺める）
  camPos.set(60, 42, 70);
  camLook.set(World.castlePos.x, 10, World.castlePos.z);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  World.setDay(1);

  function animate() {
    requestAnimationFrame(animate);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    elapsed += dt;
    const t = elapsed;

    World.update(t, dt);

    if (state.started) {
      player.update(dt, t);
      const pp = player.group.position;
      animals.forEach((a) => a.update(dt, t, pp));
      collectChecks(dt, t);
      updateDayNight(rawDt);

      // 移動中は星くずの軌跡
      if (player.moving && Math.random() < dt * 22) {
        FX.sparkles.spawn({
          x: pp.x + (Math.random() - 0.5) * 0.5, y: pp.y + 0.35, z: pp.z + (Math.random() - 0.5) * 0.5,
          vy: 0.7 + Math.random(), life: 0.8, size: 0.4,
          r: 1.3, g: 1.15, b: 0.6, twinkle: 1, drag: 1,
        });
      }

      // celebration の花火
      if (celebrationFw > 0 && t - state.lastFireworkT > 1.05) {
        state.lastFireworkT = t;
        celebrationFw--;
        // 虹の下（谷の中心）に打ち上げてシネマティックカメラから見えるように
        FX.launchFirework(5 + (Math.random() - 0.5) * 40, -12 + (Math.random() - 0.5) * 24);
      }
      // 虹コンプリート後の夜はときどき花火
      if (state.rainbowDone && state.dayF < 0.3 && t - state.lastFireworkT > 17) {
        state.lastFireworkT = t;
        FX.launchFirework(World.castlePos.x - 10 + Math.random() * 20, World.castlePos.z - 14 + Math.random() * 10);
      }
      // 虹アニメーション
      if (state.rainbowDone && state.rainbowT < 1) {
        state.rainbowT = Math.min(1, state.rainbowT + dt / 5);
        World.showRainbow(state.rainbowT);
      }

      // 太陽（影）はプレイヤーを追う
      const lightDir = state.dayF > 0.4 ? SUN_DIR : MOON_DIR;
      sun.position.copy(pp).addScaledVector(lightDir, 110);
      sun.target.position.copy(pp);

      // 滝の音
      const wfDist = pp.distanceTo(World.waterfallPos);
      const riverNear = U.clamp(1 - World.riverDist(pp.x, pp.z) / 14, 0, 1) * 0.06;
      Audio.setWaterfallLevel(U.clamp(1 - wfDist / 42, 0, 1) * 0.35 + riverNear);

      FX.update(t, dt, pp, 1 - state.dayF);
      updateCamera(dt);
    } else {
      // タイトル画面のうしろでゆっくり旋回
      const a = t * 0.045;
      camera.position.set(Math.cos(a) * 62 + 20, 34 + Math.sin(t * 0.2) * 3, Math.sin(a) * 62 + 30);
      camera.lookAt(10, 4, 0);
      FX.update(t, dt, new THREE.Vector3(0, 2, 20), 1 - state.dayF);
    }

    autoQuality(dt);
    composer.render();
  }
  animate();
})();
