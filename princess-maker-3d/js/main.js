/* ============================================================
 * main.js — エンジン起動・カメラ・入力・メインループ
 * ============================================================ */
"use strict";
(function () {
  const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);

  const canvas = document.getElementById("renderCanvas");
  const engine = new BABYLON.Engine(canvas, true, {
    stencil: false,
    antialias: true,
    powerPreference: "high-performance",
    doNotHandleContextLost: true
  });
  // Retina でも重すぎない解像度に(美しさと軽さのバランス)
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString("#bfe3ffff");

  PM.Save.load();

  /* ---------- カメラ ---------- */
  const camera = new BABYLON.ArcRotateCamera("cam", Math.PI / 2, 1.12, 13, V3(0, 1.6, 2), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 22;
  camera.lowerBetaLimit = 0.75;
  camera.upperBetaLimit = 1.42;
  camera.panningSensibility = 0;          // パン禁止(子どもが迷子にならない)
  camera.wheelDeltaPercentage = 0.01;
  camera.pinchDeltaPercentage = 0.004;
  camera.inertia = 0.88;
  camera.useNaturalPinchZoom = false;
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

  /* ---------- ワールド・キャラ ---------- */
  const world = PM.World.build(scene);
  const princess = PM.Princess.build(scene, world);
  const activities = PM.Activities.init(scene, world, princess);
  PM.UI.init(scene, camera, world, princess, activities);

  /* ---------- ポストプロセス(息をのむ画づくり) ---------- */
  const pipeline = new BABYLON.DefaultRenderingPipeline("pp", true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.85;
  pipeline.bloomWeight = 0.28;
  pipeline.bloomKernel = 48;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.exposure = 0.95;
  pipeline.imageProcessing.contrast = 1.05;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 1.4;
  pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0.4, 0.1, 0.3, 0);
  pipeline.imageProcessing.vignetteCameraFov = 1.2;

  /* ---------- タップ入力(地面タップでお散歩) ---------- */
  let downPos = null;
  scene.onPointerObservable.add((pi) => {
    if (pi.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      downPos = { x: scene.pointerX, y: scene.pointerY };
    } else if (pi.type === BABYLON.PointerEventTypes.POINTERUP && downPos) {
      const dx = scene.pointerX - downPos.x, dy = scene.pointerY - downPos.y;
      downPos = null;
      if (dx * dx + dy * dy > 400) return;   // ドラッグ(カメラ回転)は無視
      PM.UI.toggleWardrobe(false);
      const pick = scene.pick(scene.pointerX, scene.pointerY);
      if (pick && pick.hit && pick.pickedPoint) {
        if (pick.pickedMesh && pick.pickedMesh.metadata && pick.pickedMesh.metadata.walkable) {
          activities.walkFree(pick.pickedPoint);
        } else if (pick.pickedMesh) {
          // 小物タップのお楽しみ
          const n = pick.pickedMesh.name;
          if (n.startsWith("f") && n.includes("b")) { /* fountain */ }
          world.sparkleBurst(pick.pickedPoint);
          PM.Audio.sfx("pop");
        }
      }
    }
  });

  /* ---------- カメラはプリンセスをやさしく追いかける ---------- */
  const camTarget = camera.target.clone();
  let savedRadius = null;
  function updateCamera(dt) {
    const p = princess.root.position;
    camTarget.x += (p.x - camTarget.x) * Math.min(1, dt * 2.2);
    camTarget.z += (p.z + 0.5 - camTarget.z) * Math.min(1, dt * 2.2);
    camTarget.y += (1.6 + p.y - camTarget.y) * Math.min(1, dt * 2.2);
    camera.setTarget(camTarget);
    // ガゼボの中では屋根が邪魔にならないよう自動でズームイン
    const inGazebo = Math.hypot(p.x - 9, p.z + 7) < 3.2;
    if (inGazebo) {
      if (savedRadius === null) savedRadius = camera.radius;
      camera.radius += (7.2 - camera.radius) * Math.min(1, dt * 2);
    } else if (savedRadius !== null) {
      camera.radius += (savedRadius - camera.radius) * Math.min(1, dt * 2);
      if (Math.abs(camera.radius - savedRadius) < 0.25) savedRadius = null;
    }
  }

  /* ---------- メインループ ---------- */
  let started = false;
  engine.runRenderLoop(() => {
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
    world.update(dt);
    princess.update(dt);
    if (started) updateCamera(dt);
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
  window.addEventListener("orientationchange", () => setTimeout(() => engine.resize(), 300));

  /* ---------- タイトル画面 ---------- */
  document.getElementById("loadingNote").textContent = "じゅんびOK!";
  const startBtn = document.getElementById("startBtn");
  startBtn.addEventListener("pointerdown", () => {
    if (started) return;
    started = true;
    PM.Audio.init();
    const save = PM.Save.get();
    PM.Audio.setEnabled(save.soundOn);
    document.getElementById("soundBtn").textContent = save.soundOn ? "🔊" : "🔇";
    document.getElementById("titleScreen").classList.add("hidden");
    PM.Audio.sfx("fanfare");
    // ようこそ演出
    princess.setState("celebrate");
    world.confettiBurst(princess.root.position.add(V3(0, 2.2, 0)));
    world.fireworkShow(3);
    PM.UI.showBubble("こんにちは! 👸✨", 2600);
    setTimeout(() => { if (princess.state === "celebrate") princess.setState("wave"); }, 1400);
    setTimeout(() => { if (princess.state === "wave") princess.setState("idle"); }, 3000);
  });

  // iOSでのダブルタップズーム防止
  let lastTouch = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouch < 350) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
})();
