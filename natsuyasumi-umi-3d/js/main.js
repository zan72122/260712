/* ============================================================
   main.js — 起動とメインループ
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  const canvas = document.getElementById('game-canvas');

  /* ---------------- レンダラー ---------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  /* ---------------- シーンとカメラ ---------------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);

  function isPortrait() { return window.innerHeight > window.innerWidth; }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = isPortrait() ? 70 : 55;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
  onResize();

  /* ---------------- ワールド構築 ---------------- */
  const sky = G.createSky(scene);
  const ocean = G.createOcean(scene);
  const island = G.createIsland(scene);
  const player = G.createPlayer(scene);
  G.player = player;
  G.scene = scene;
  G.camera = camera;
  G.renderer = renderer;
  const creatures = G.createCreatures(scene);
  G.fx = G.createFX(scene);
  const input = G.createInput(canvas, camera);
  G.createUI();
  const activities = G.createActivities(scene, player, ocean, island, creatures);

  /* ---------------- カメラワーク ---------------- */
  let camYaw = Math.PI;             // プレイヤーの後ろから
  const camPos = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const _desired = new THREE.Vector3();

  function updateCamera(dt, elapsed) {
    if (!G.state.started) {
      // タイトル中：島をゆっくりまわるシネマカメラ
      const a = elapsed * 0.06;
      const r = 58;
      camPos.set(Math.cos(a) * r, 16 + Math.sin(elapsed * 0.18) * 4, Math.sin(a) * r + 18);
      camera.position.lerp(camPos, Math.min(1, dt * 2 + (camera.position.lengthSq() === 0 ? 1 : 0)));
      lookTarget.set(0, 3, 12);
      camera.lookAt(lookTarget);
      return;
    }

    // 追従カメラ：うごいた方向のうしろへゆっくり回りこむ
    if (player.speed > 1.2) {
      const behind = player.heading + Math.PI;
      const d = G.angleDelta(camYaw, behind);
      camYaw += d * Math.min(1, dt * 1.4);
    }
    const dist = isPortrait() ? 10.5 : 9.0;
    const height = isPortrait() ? 6.2 : 4.8;
    _desired.set(
      player.pos.x + Math.sin(camYaw) * dist,
      player.pos.y + height,
      player.pos.z + Math.cos(camYaw) * dist
    );
    // 地面より下にもぐらない
    const gh = Math.max(G.groundHeight(_desired.x, _desired.z), 0) + 1.6;
    if (_desired.y < gh) _desired.y = gh;

    camera.position.x = G.damp(camera.position.x, _desired.x, 5, dt);
    camera.position.y = G.damp(camera.position.y, _desired.y, 5, dt);
    camera.position.z = G.damp(camera.position.z, _desired.z, 5, dt);

    lookTarget.set(
      G.damp(lookTarget.x, player.pos.x, 8, dt),
      G.damp(lookTarget.y, player.pos.y + 2.0, 8, dt),
      G.damp(lookTarget.z, player.pos.z, 8, dt)
    );
    camera.lookAt(lookTarget);
  }

  /* ---------------- メインループ ---------------- */
  const clock = new THREE.Clock();
  let elapsed = 0;

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    input.update();
    if (G.state.started) {
      player.update(dt, input, elapsed);
      activities.update(dt, elapsed);
    }
    sky.update(dt, elapsed, player.pos);
    ocean.update(dt, elapsed);
    island.update(dt, elapsed);
    creatures.update(dt, elapsed, player.pos);
    G.fx.update(dt, elapsed);
    G.audio.update(dt);
    G.ui.update();
    updateCamera(dt, elapsed);

    renderer.render(scene, camera);
  }
  tick();

  /* iOSでのダブルタップズーム等を抑止 */
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
})();
