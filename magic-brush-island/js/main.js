/* ================================================================
   main.js — bootstrapping, game loop, painting rules, camera,
   zone completion and the grand rainbow finale.
   ================================================================ */
(function () {
  const T = THREE;
  const C = GAME.CONFIG;

  /* ---------- error surface (helps on mobile) ---------- */
  window.addEventListener('error', (e) => {
    if (GAME.UI) GAME.UI.showError((e.message || 'error') + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno);
  });

  /* ---------- renderer / scene / camera ---------- */
  const canvas = document.getElementById('game-canvas');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new T.Scene();
  scene.fog = new T.Fog(0xbfe3ff, 70, 230);

  const camera = new T.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 700);

  /* ---------- lights ---------- */
  const hemi = new T.HemisphereLight(0xcfe9ff, 0x86c96f, 0.55);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff2dc, 1.2);
  sun.position.set(38, 58, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new T.DirectionalLight(0xa8ccff, 0.28);
  fill.position.set(-30, 25, -35);
  scene.add(fill);

  /* ---------- build the world ---------- */
  GAME.Effects.init(scene);
  GAME.Animals.init(scene, (x, z) => GAME.World.terrainH(x, z));
  GAME.World.build(scene, scene.fog);
  GAME.Character.build(scene, (x, z) => GAME.World.terrainH(x, z));
  GAME.Input.init();

  /* ---------- zone bookkeeping ---------- */
  const zoneCount = {};   // id -> {total, painted}
  GAME.ZONES.forEach((z) => { zoneCount[z.id] = { total: 0, painted: 0, done: false }; });
  GAME.Mat.paintables.forEach((p) => { if (p.zone && zoneCount[p.zone]) zoneCount[p.zone].total++; });

  /* ---------- game state ---------- */
  let mode = 'title';          // title → fly → play
  let flyT = 0;
  let paintCooldown = 0;
  let paintNote = 0;
  let starCount = 0;
  let finaleDone = false;
  let superPaintTween = -1;
  let hintTimer = 14;
  const fireworkQueue = [];    // {t, x, z}
  const titleCamAngle = { a: 0 };

  /* ---------- helpers ---------- */
  const _v = new T.Vector3();
  const _v2 = new T.Vector3();

  function paintEntry(entry) {
    if (!GAME.Mat.paint(entry)) return;
    const g = entry.group;
    _v.setFromMatrixPosition(g.matrixWorld);
    const hexes = entry.mats
      .map((m) => m.target.clone().convertLinearToSRGB())
      .filter((c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.32) // bright, happy splashes only
      .slice(0, 6)
      .map((c) => c.getHex());
    GAME.Effects.paintBurst(_v, hexes);
    GAME.Audio.sfx.paint(paintNote++);

    const p = GAME.Mat.paintedCount / Math.max(1, GAME.Mat.total);
    GAME.UI.setProgress(p);
    if (p > 0.45) GAME.Audio.setLayer2(true);

    // zone accounting
    const zc = zoneCount[entry.zone];
    if (zc) {
      zc.painted++;
      if (!zc.done && zc.painted >= zc.total) {
        zc.done = true;
        onZoneComplete(entry.zone);
      }
    }
    if (!finaleDone && GAME.Mat.paintedCount >= GAME.Mat.total) {
      startFinale();
    }
  }

  function onZoneComplete(zoneId) {
    const idx = GAME.ZONES.findIndex((z) => z.id === zoneId);
    if (idx < 0) return;
    const z = GAME.ZONES[idx];
    const center = GAME.World.completeZone(idx);
    GAME.Audio.sfx.fanfare();
    GAME.UI.zoneBanner(`${z.emoji} ${z.name} ${z.emoji}`, 'いろが もどったよ！');
    for (let i = 0; i < 4; i++) {
      fireworkQueue.push({ t: 0.3 + i * 0.45, x: center.x + (Math.random() - 0.5) * 10, z: center.z + (Math.random() - 0.5) * 10 });
    }
  }

  function startFinale() {
    finaleDone = true;
    GAME.World.setFinale();
    GAME.Audio.sfx.finale();
    GAME.UI.finale();
    GAME.Animals.celebrateAll();
    // grand fireworks show
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 30;
      fireworkQueue.push({ t: 0.5 + i * 0.42, x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
    // after the show: eternal super-vibrant day + full ground saturation
    setTimeout(() => {
      GAME.World.setSuperDay();
      superPaintTween = 0;
      GAME.Effects.spawnButterflies(new T.Vector3(0, GAME.World.terrainH(0, 3) + 1, 3), 6, 12);
      GAME.UI.toast('しま ぜんぶ ピカピカ！ ずっと あそんでいいよ 🌈', 5000);
    }, 10000);
  }

  /* ---------- painting by proximity ---------- */
  function proximityPaint(dt) {
    paintCooldown -= dt;
    if (paintCooldown > 0) return;
    const pp = GAME.Character.pos;
    let best = null, bestD = Infinity;
    for (const e of GAME.Mat.paintables) {
      if (e.painted) continue;
      const g = e.group;
      const dx = g.position.x - pp.x, dz = g.position.z - pp.z;
      const d = Math.hypot(dx, dz);
      if (d < C.PAINT_RADIUS && d < bestD) { best = e; bestD = d; }
    }
    if (best) {
      paintEntry(best);
      paintCooldown = 0.14;      // rapid joyful cascade, one pop at a time
    }
  }

  /* ---------- painting by tapping (paint shot) ---------- */
  const raycaster = new T.Raycaster();
  const ndc = new T.Vector2();

  function findPaintableAncestor(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.paintable) return o.userData.paintable;
      o = o.parent;
    }
    return null;
  }

  let tapTargets = null;
  function getTapTargets() {
    if (!tapTargets) {
      tapTargets = GAME.Mat.paintables.map((e) => e.group);
      if (GAME.World.terrainMesh) tapTargets.push(GAME.World.terrainMesh);
    }
    return tapTargets;
  }

  function handleTaps() {
    const taps = GAME.Input.consumeTaps();
    if (!taps.length || mode !== 'play') return;
    for (const tap of taps) {
      ndc.set((tap.x / window.innerWidth) * 2 - 1, -(tap.y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(getTapTargets(), true);
      if (!hits.length) continue;
      const hit = hits[0];
      let entry = findPaintableAncestor(hit.object);
      // forgiving little fingers: a tap near a grey prop still counts
      if (!entry || entry.painted) {
        let bestD = 4.5;
        for (const e of GAME.Mat.paintables) {
          if (e.painted) continue;
          const d = e.group.position.distanceTo(hit.point);
          if (d < bestD) { bestD = d; entry = e; }
        }
      }
      const from = _v.copy(GAME.Character.pos).add(_v2.set(0, 1.4, 0)).clone();
      if (entry && !entry.painted && hit.point.distanceTo(GAME.Character.pos) < 26) {
        const hue = Math.random();
        const hex = new T.Color().setHSL(hue, 0.85, 0.6).getHex();
        const e = entry;
        const to = e.group.position.clone().add(_v2.set(0, 1.0, 0));
        GAME.Effects.paintShot(from, to, hex, () => paintEntry(e));
        GAME.Audio.sfx.pop();
      } else if (hit.point.distanceTo(GAME.Character.pos) < 40) {
        // splat of colour on the ground — pure fun, always responds
        GAME.Effects.paintShot(from, hit.point.clone(), GAME.Effects.RAINBOW[(Math.random() * 7) | 0], () => {
          GAME.Effects.paintBurst(hit.point, null);
          GAME.Audio.sfx.splat();
        });
      }
    }
  }

  /* ---------- star pickups ---------- */
  function checkStars() {
    const pp = GAME.Character.pos;
    for (let i = 0; i < GAME.World.stars.length; i++) {
      const s = GAME.World.stars[i];
      if (s.collected) continue;
      const g = s.group;
      const dx = g.position.x - pp.x, dz = g.position.z - pp.z, dy = g.position.y - (pp.y + 1);
      if (dx * dx + dz * dz < 2.6 && Math.abs(dy) < 2.6) {
        s.collected = true;
        g.visible = false;
        starCount++;
        GAME.Effects.starBurst(g.position);
        GAME.Audio.sfx.star(starCount);
        GAME.UI.setStars(starCount, C.STAR_TOTAL);
        if (starCount === C.STAR_TOTAL) {
          GAME.UI.toast('⭐ ほしを ぜんぶ あつめたよ！ すごい！ ⭐', 4500);
          GAME.Audio.sfx.fanfare();
          for (let k = 0; k < 6; k++) {
            fireworkQueue.push({ t: 0.3 + k * 0.4, x: pp.x + (Math.random() - 0.5) * 16, z: pp.z + (Math.random() - 0.5) * 16 });
          }
        }
      }
    }
  }

  /* ---------- camera ---------- */
  const camPos = new T.Vector3(0, 40, 66);
  const camLook = new T.Vector3(0, 4, 0);
  const wantPos = new T.Vector3();
  const wantLook = new T.Vector3();

  function isPortrait() { return window.innerHeight > window.innerWidth; }

  function updateCamera(dt, time) {
    const portrait = isPortrait();
    const targetFov = portrait ? 64 : 52;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);

    if (mode === 'title') {
      titleCamAngle.a += dt * 0.07;
      wantPos.set(Math.cos(titleCamAngle.a) * 62, 34, Math.sin(titleCamAngle.a) * 62);
      wantLook.set(0, 3, 0);
      camPos.lerp(wantPos, Math.min(1, dt * 2));
      camLook.lerp(wantLook, Math.min(1, dt * 2));
    } else {
      const pp = GAME.Character.pos;
      const dist = portrait ? 12.6 : 10.8;
      const height = portrait ? 9.8 : 7.9;
      wantPos.set(pp.x, pp.y + height, pp.z + dist);
      wantLook.set(pp.x, pp.y + 1.7, pp.z);
      if (mode === 'fly') {
        flyT += dt / 2.4;
        const k = Math.min(1, flyT);
        const e = 1 - Math.pow(1 - k, 3);
        camPos.lerp(wantPos, e * Math.min(1, dt * 6) + 0.012);
        camLook.lerp(wantLook, e * Math.min(1, dt * 6) + 0.012);
        if (k >= 1 && camPos.distanceTo(wantPos) < 1.2) mode = 'play';
      } else {
        camPos.lerp(wantPos, Math.min(1, dt * 4.5));
        camLook.lerp(wantLook, Math.min(1, dt * 6));
      }
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.updateProjectionMatrix();
  }

  /* ---------- resize ---------- */
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 250));

  /* ---------- start ---------- */
  GAME.UI.init(() => {
    mode = 'fly';
    flyT = 0;
    GAME.Input.setEnabled(true);
    setTimeout(() => {
      GAME.UI.toast('🖌️ ミミと いっしょに！ はいいろの ものに ちかづくと いろが つくよ', 4200);
    }, 2600);
  });
  GAME.UI.setProgress(0);

  /* debug/testing hook: paint the first n unpainted props instantly */
  GAME.debug = {
    renderer, scene, camera,
    get mode() { return mode; },
    paintSome(n) {
      let k = 0;
      for (const e of GAME.Mat.paintables) {
        if (k >= n) break;
        if (!e.painted) { paintEntry(e); k++; }
      }
    },
  };

  /* ---------- main loop ---------- */
  const clock = new T.Clock();
  let time = 0;

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    time += dt;

    GAME.Input.update();

    if (mode !== 'title') {
      GAME.Character.update(dt, time);
      proximityPaint(dt);
      handleTaps();
      checkStars();

      // gentle nudge for lost little players
      if (GAME.Mat.paintedCount === 0) {
        hintTimer -= dt;
        if (hintTimer < 0) {
          hintTimer = 25;
          GAME.UI.toast('はいいろの き や おうちに ちかづいてみて！ 🖌️');
        }
      }
    }

    GAME.Animals.update(dt, time, mode !== 'title' ? GAME.Character.pos : null);
    GAME.World.update(dt, time);
    GAME.Mat.update(dt);
    GAME.Effects.update(dt, time);

    // scheduled fireworks
    for (let i = fireworkQueue.length - 1; i >= 0; i--) {
      fireworkQueue[i].t -= dt;
      if (fireworkQueue[i].t <= 0) {
        GAME.Effects.firework(fireworkQueue[i].x, fireworkQueue[i].z);
        fireworkQueue.splice(i, 1);
      }
    }

    // post-finale: ground saturation swells to 100%
    if (superPaintTween >= 0 && superPaintTween < 1) {
      superPaintTween = Math.min(1, superPaintTween + dt / 4);
      GAME.World.uGlobalPaint.value = superPaintTween;
    }

    updateCamera(dt, time);
    renderer.render(scene, camera);
  }

  tick();
})();
