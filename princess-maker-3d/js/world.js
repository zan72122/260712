/* ============================================================
 * world.js — 3Dワールド構築
 *   空(昼夜サイクル)・お城・庭園・噴水・ガゼボ・桜・パーティクル。
 *   すべてプロシージャル生成(外部アセット不要)。
 * ============================================================ */
"use strict";
window.PM = window.PM || {};

PM.World = (function () {
  const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);
  const C3 = (r, g, b) => new BABYLON.Color3(r, g, b);
  const HEX = (h) => BABYLON.Color3.FromHexString(h);

  let scene, glow, shadowGen, sun, hemi, skyMat, starMesh, moon, sunSphere;
  let waterTex, fireflyPS, petalPS, fountainPS;
  let butterflies = [];
  let cloudRoot, flagList = [], lanternOrbs = [], windowMat, stringLightMat, rainbowRoot;
  let gazeboSpot = null;
  let flowerTemplate = null, plantedFlowers = [], gardenCenter = V3(-6.5, 0, 8.5);
  let dayTime = 0.18;                 // 0..1 (0=朝, 0.25=昼, 0.55=夕方, 0.75=夜)
  const DAY_LENGTH = 150;             // 1日=150秒
  let elapsed = 0;

  /* ---------- 素材ヘルパー ---------- */
  function mat(name, hex, opts) {
    opts = opts || {};
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = HEX(hex);
    m.specularColor = C3(0.08, 0.08, 0.08);
    if (opts.emissive) m.emissiveColor = HEX(opts.emissive);
    if (opts.alpha !== undefined) m.alpha = opts.alpha;
    if (opts.glow) { m.emissiveColor = HEX(opts.glow); }
    if (opts.backFace === false) m.backFaceCulling = false;
    return m;
  }

  /* ---------- パーティクル用テクスチャ(Canvas描画) ---------- */
  function canvasTex(name, size, draw) {
    const t = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, false);
    t.hasAlpha = true;
    const c = t.getContext();
    c.clearRect(0, 0, size, size);
    draw(c, size);
    t.update();
    return t;
  }
  function softDotTex() {
    return canvasTex("dot", 64, (c, s) => {
      const g = c.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.4, "rgba(255,255,255,0.8)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    });
  }
  function starTexture() {
    return canvasTex("starTex", 128, (c, s) => {
      c.translate(s/2, s/2); c.fillStyle = "#fff";
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s * 0.46 : s * 0.20;
        const a = i / 10 * Math.PI * 2 - Math.PI / 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.fill();
    });
  }
  function heartTexture() {
    return canvasTex("heartTex", 128, (c, s) => {
      c.translate(s/2, s/2); c.scale(s/32, s/32); c.fillStyle = "#fff";
      c.beginPath();
      c.moveTo(0, 10);
      c.bezierCurveTo(-16, -4, -8, -16, 0, -7);
      c.bezierCurveTo(8, -16, 16, -4, 0, 10);
      c.fill();
    });
  }
  function petalTexture() {
    return canvasTex("petalTex", 64, (c, s) => {
      c.translate(s/2, s/2); c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, 0, s*0.2, s*0.4, 0.5, 0, Math.PI*2); c.fill();
    });
  }
  let TEX = {};

  /* ============================================================
   * 空・光
   * ============================================================ */
  function buildSky() {
    BABYLON.Effect.ShadersStore.pmSkyVertexShader = `
      precision highp float;
      attribute vec3 position;
      uniform mat4 worldViewProjection;
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = worldViewProjection * vec4(position, 1.0); }`;
    BABYLON.Effect.ShadersStore.pmSkyFragmentShader = `
      precision highp float;
      varying vec3 vPos;
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.0
          ? mix(midColor, topColor, pow(min(1.0, h * 1.6), 0.7))
          : mix(midColor, botColor, min(1.0, -h * 3.0));
        gl_FragColor = vec4(col, 1.0);
      }`;
    const skyDome = BABYLON.MeshBuilder.CreateSphere("sky", { diameter: 320, segments: 16, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
    skyMat = new BABYLON.ShaderMaterial("skyMat", scene, { vertex: "pmSky", fragment: "pmSky" },
      { attributes: ["position"], uniforms: ["worldViewProjection", "topColor", "midColor", "botColor"] });
    skyMat.setColor3("topColor", HEX("#4aa8ff"));
    skyMat.setColor3("midColor", HEX("#bfe3ff"));
    skyMat.setColor3("botColor", HEX("#dff0e0"));
    skyMat.backFaceCulling = false;
    skyDome.material = skyMat;
    skyDome.isPickable = false;
    skyDome.infiniteDistance = false;
    skyDome.applyFog = false;

    // 太陽と月(空の球に沿って回る)
    sunSphere = BABYLON.MeshBuilder.CreateSphere("sunS", { diameter: 10, segments: 12 }, scene);
    sunSphere.material = mat("sunM", "#fff3b0", { glow: "#ffdf70" });
    sunSphere.isPickable = false; sunSphere.applyFog = false;
    moon = BABYLON.MeshBuilder.CreateSphere("moon", { diameter: 7, segments: 12 }, scene);
    moon.material = mat("moonM", "#fdf6d8", { glow: "#e8e0b0" });
    moon.isPickable = false; moon.applyFog = false;

    // 星(小さな球をマージして1メッシュに)
    const starPieces = [];
    for (let i = 0; i < 140; i++) {
      const s = BABYLON.MeshBuilder.CreateSphere("st", { diameter: 0.28 + Math.random() * 0.4, segments: 4 }, scene);
      const a = Math.random() * Math.PI * 2;
      const b = 0.15 + Math.random() * 1.2;
      const r = 150;
      s.position.set(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r * 0.9, Math.sin(a) * Math.cos(b) * r);
      starPieces.push(s);
    }
    starMesh = BABYLON.Mesh.MergeMeshes(starPieces, true, true);
    starMesh.name = "stars";
    const sm = mat("starM", "#ffffff", { glow: "#ffffee" });
    sm.alpha = 0; starMesh.material = sm;
    starMesh.isPickable = false; starMesh.applyFog = false;

    // 雲(ふわふわの球の集合体)
    cloudRoot = new BABYLON.TransformNode("clouds", scene);
    const cloudMat = mat("cloudM", "#ffffff", { emissive: "#f0f4ff" });
    cloudMat.alpha = 0.92;
    for (let i = 0; i < 7; i++) {
      const pieces = [];
      const n = 4 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const p = BABYLON.MeshBuilder.CreateSphere("cl", { diameter: 6 + Math.random() * 7, segments: 8 }, scene);
        p.position.set(j * 4 - n * 2 + Math.random() * 2, Math.random() * 1.5, Math.random() * 3);
        p.scaling.y = 0.55;
        pieces.push(p);
      }
      const cloud = BABYLON.Mesh.MergeMeshes(pieces, true, true);
      cloud.material = cloudMat;
      const ang = i / 7 * Math.PI * 2;
      cloud.position.set(Math.cos(ang) * (60 + Math.random() * 40), 34 + Math.random() * 18, Math.sin(ang) * (60 + Math.random() * 40));
      cloud.isPickable = false; cloud.applyFog = false;
      cloud.parent = cloudRoot;
    }
  }

  function buildLights() {
    hemi = new BABYLON.HemisphericLight("hemi", V3(0.2, 1, 0.3), scene);
    hemi.intensity = 0.6;
    hemi.groundColor = HEX("#9fd489");
    sun = new BABYLON.DirectionalLight("sun", V3(-0.45, -0.85, -0.35), scene);
    sun.position = V3(28, 46, 24);
    sun.intensity = 1.05;
    shadowGen = new BABYLON.ShadowGenerator(1024, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;
    shadowGen.darkness = 0.55;
  }

  /* ============================================================
   * 地面(グラデーション+小道を1枚のテクスチャに描画)
   * ============================================================ */
  function buildGround() {
    const size = 90;
    const tex = new BABYLON.DynamicTexture("groundTex", { width: 1024, height: 1024 }, scene, false);
    const c = tex.getContext();
    const S = 1024, u = S / size; // world->px
    // 草のグラデーション
    const g = c.createRadialGradient(S/2, S/2, 40, S/2, S/2, S*0.7);
    g.addColorStop(0, "#8fd97a"); g.addColorStop(0.5, "#77c968"); g.addColorStop(1, "#57ab53");
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    // 草むらの表情(点々)
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      c.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(30,90,30,0.08)";
      c.beginPath(); c.arc(x, y, 1 + Math.random() * 3, 0, 7); c.fill();
    }
    const wx = (x) => S/2 + x * u, wz = (z) => S/2 + z * u;
    // 中央の広場(石畳風の円)
    c.fillStyle = "#f2e2c4";
    c.beginPath(); c.arc(wx(0), wz(0), 6.4 * u, 0, 7); c.fill();
    c.strokeStyle = "#e3cba0"; c.lineWidth = 6;
    for (let r = 2; r <= 6; r += 1.4) { c.beginPath(); c.arc(wx(0), wz(0), r * u, 0, 7); c.stroke(); }
    // お城への道
    c.fillStyle = "#f2e2c4";
    c.fillRect(wx(-1.6), wz(-24), 3.2 * u, 20 * u);
    // 各ステーションへの小道
    const paths = [[8.5, 3], [-8.5, 3], [9, -7], [0, 13], [-6.5, 8.5]];
    c.strokeStyle = "#f2e2c4"; c.lineWidth = 1.6 * u; c.lineCap = "round";
    paths.forEach(([x, z]) => { c.beginPath(); c.moveTo(wx(0), wz(0)); c.lineTo(wx(x), wz(z)); c.stroke(); });
    // 花壇の土
    c.fillStyle = "#a8794e";
    c.beginPath(); c.arc(wx(gardenCenter.x), wz(gardenCenter.z), 3.1 * u, 0, 7); c.fill();
    c.fillStyle = "#8a5f3a";
    c.beginPath(); c.arc(wx(gardenCenter.x), wz(gardenCenter.z), 2.8 * u, 0, 7); c.fill();
    tex.update();

    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: size, height: size, subdivisions: 2 }, scene);
    const gm = new BABYLON.StandardMaterial("groundM", scene);
    gm.diffuseTexture = tex;
    gm.specularColor = C3(0, 0, 0);
    ground.material = gm;
    ground.receiveShadows = true;
    ground.metadata = { walkable: true };
    return ground;
  }

  /* ============================================================
   * お城(パステルピンクのメルヘン城)
   * ============================================================ */
  function buildCastle() {
    const root = new BABYLON.TransformNode("castle", scene);
    root.position = V3(0, 0, -26);
    const wallM = mat("wallM", "#fdf3f7");
    const roofM = mat("roofM", "#f2679e", { emissive: "#30101e" });
    const goldM = mat("goldM", "#ffd76a", { glow: "#8a6a10" });
    const walls = [], roofs = [];

    function tower(x, z, h, r) {
      const t = BABYLON.MeshBuilder.CreateCylinder("tw", { height: h, diameter: r * 2, tessellation: 16 }, scene);
      t.position.set(x, h / 2, z);
      walls.push(t);
      const roof = BABYLON.MeshBuilder.CreateCylinder("tr", { height: r * 2.6, diameterTop: 0.02, diameterBottom: r * 2.5, tessellation: 16 }, scene);
      roof.position.set(x, h + r * 1.3, z);
      roofs.push(roof);
      const ball = BABYLON.MeshBuilder.CreateSphere("tb", { diameter: 0.55, segments: 8 }, scene);
      ball.position.set(x, h + r * 2.6 + 0.2, z); ball.material = goldM;
      // 旗
      const pole = BABYLON.MeshBuilder.CreateCylinder("fp", { height: 1.6, diameter: 0.08 }, scene);
      pole.position.set(x, h + r * 2.6 + 1.0, z); pole.material = goldM;
      const flag = BABYLON.MeshBuilder.CreatePlane("fl", { width: 1.3, height: 0.8 }, scene);
      flag.position.set(x + 0.68, h + r * 2.6 + 1.45, z);
      flag.material = mat("flagM" + x, "#ff6fa5", { emissive: "#5c2038", backFace: false });
      flag.setPivotPoint(V3(-0.65, 0, 0));
      flagList.push(flag);
      return t;
    }

    // 城壁と塔
    const kw = 11;
    const keep = BABYLON.MeshBuilder.CreateBox("keep", { width: kw, height: 7, depth: 6 }, scene);
    keep.position.set(0, 3.5, -2); walls.push(keep);
    const keepRoof = BABYLON.MeshBuilder.CreateCylinder("keepRoof", { height: 4, diameterTop: 0.03, diameterBottom: 8, tessellation: 4 }, scene);
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.scaling.z = 0.72;
    keepRoof.position.set(0, 9, -2); roofs.push(keepRoof);
    tower(-6.5, 1.5, 9, 1.7); tower(6.5, 1.5, 9, 1.7);
    tower(-4.2, -4.5, 12, 1.5); tower(4.2, -4.5, 12, 1.5);
    const centerTower = tower(0, -3.5, 15, 1.9);
    // 門
    const gateWall = BABYLON.MeshBuilder.CreateBox("gateWall", { width: 6, height: 4.6, depth: 1.6 }, scene);
    gateWall.position.set(0, 2.3, 2.2); walls.push(gateWall);
    const arch = BABYLON.MeshBuilder.CreateCylinder("arch", { height: 1.8, diameter: 3.4, tessellation: 20 }, scene);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 1.7, 3.05);
    arch.material = mat("archM", "#b4736f", { emissive: "#2a1512" });
    const door = BABYLON.MeshBuilder.CreateBox("door", { width: 2.6, height: 3.2, depth: 0.3 }, scene);
    door.position.set(0, 1.6, 3.0);
    door.material = mat("doorM", "#9c6b3f", { emissive: "#241505" });

    const wallMesh = BABYLON.Mesh.MergeMeshes(walls, true, true);
    wallMesh.material = wallM; wallMesh.receiveShadows = true;
    const roofMesh = BABYLON.Mesh.MergeMeshes(roofs, true, true);
    roofMesh.material = roofM;
    wallMesh.parent = root; roofMesh.parent = root; arch.parent = root; door.parent = root;
    scene.meshes.filter(m => ["tb", "fp", "fl"].includes(m.name.slice(0, 2))).forEach(m => m.parent = root);

    // 窓(夜に光る)
    windowMat = mat("winM", "#ffe9b0", { emissive: "#111111" });
    const winPieces = [];
    const winPos = [
      [-6.5, 5.5, 3.2], [6.5, 5.5, 3.2], [-4.2, 8, 0.2], [4.2, 8, 0.2],
      [0, 11, 1.6], [0, 13, 1.6], [-2.5, 5, 1.05], [2.5, 5, 1.05], [0, 5.7, 1.05],
      [-6.5, 3.5, 3.2], [6.5, 3.5, 3.2]
    ];
    winPos.forEach(([x, y, z]) => {
      const w = BABYLON.MeshBuilder.CreatePlane("win", { width: 0.7, height: 1.1 }, scene);
      w.position.set(x, y, z + (z > 1 ? 0.01 : 0.9));
      winPieces.push(w);
    });
    const winMesh = BABYLON.Mesh.MergeMeshes(winPieces, true, true);
    winMesh.material = windowMat; winMesh.parent = root;

    shadowGen.addShadowCaster(wallMesh);
    shadowGen.addShadowCaster(roofMesh);

    // 虹(お祝いのとき現れる)
    rainbowRoot = new BABYLON.TransformNode("rainbow", scene);
    rainbowRoot.position = V3(0, 0, -20);
    const rainbowCols = ["#ff5f6d", "#ff9a56", "#ffe25f", "#7ed957", "#5fc9ff", "#7a7aff", "#c86fff"];
    rainbowCols.forEach((col, i) => {
      const tor = BABYLON.MeshBuilder.CreateTorus("rb" + i, { diameter: 44 - i * 1.6, thickness: 0.7, tessellation: 40 }, scene);
      tor.rotation.x = Math.PI / 2;
      tor.rotation.z = 0;
      const m2 = mat("rbM" + i, col, { glow: col });
      m2.alpha = 0.0;
      tor.material = m2;
      tor.rotation.x = 0; tor.rotation.y = 0;
      tor.rotation.z = 0;
      tor.rotation.x = Math.PI * 0.0;
      tor.parent = rainbowRoot;
      tor.isPickable = false;
    });
    // torus は水平リングなので縦に立てる
    rainbowRoot.rotation.x = Math.PI / 2;
    rainbowRoot.position.y = -6;

    return root;
  }

  /* ============================================================
   * 噴水(まほうの泉)
   * ============================================================ */
  function buildFountain() {
    const root = new BABYLON.TransformNode("fountain", scene);
    const stoneM = mat("stoneM", "#e8dff0");
    const b1 = BABYLON.MeshBuilder.CreateCylinder("fb1", { height: 0.7, diameter: 5.4, tessellation: 24 }, scene);
    b1.position.y = 0.35;
    const b2 = BABYLON.MeshBuilder.CreateCylinder("fb2", { height: 1.6, diameter: 1.1, tessellation: 12 }, scene);
    b2.position.y = 1.2;
    const b3 = BABYLON.MeshBuilder.CreateCylinder("fb3", { height: 0.4, diameter: 2.6, tessellation: 20 }, scene);
    b3.position.y = 2.0;
    const rim = BABYLON.MeshBuilder.CreateTorus("frim", { diameter: 5.2, thickness: 0.42, tessellation: 24 }, scene);
    rim.position.y = 0.75;
    const stone = BABYLON.Mesh.MergeMeshes([b1, b2, b3, rim], true, true);
    stone.material = stoneM; stone.parent = root; stone.receiveShadows = true;
    shadowGen.addShadowCaster(stone);

    // 水面(きらきら動くテクスチャ)
    waterTex = new BABYLON.DynamicTexture("waterTex", { width: 256, height: 256 }, scene, false);
    const wc = waterTex.getContext();
    const wg = wc.createLinearGradient(0, 0, 256, 256);
    wg.addColorStop(0, "#9fdcff"); wg.addColorStop(0.5, "#c9ecff"); wg.addColorStop(1, "#8fd4ff");
    wc.fillStyle = wg; wc.fillRect(0, 0, 256, 256);
    wc.strokeStyle = "rgba(255,255,255,0.65)"; wc.lineWidth = 5;
    for (let i = 0; i < 9; i++) {
      wc.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const y = i * 30 + Math.sin(x / 22 + i) * 8;
        x === 0 ? wc.moveTo(x, y) : wc.lineTo(x, y);
      }
      wc.stroke();
    }
    waterTex.update();
    waterTex.wrapU = waterTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    const waterM = new BABYLON.StandardMaterial("waterM", scene);
    waterM.diffuseTexture = waterTex;
    waterM.emissiveColor = HEX("#4a7f9f");
    waterM.specularColor = C3(0.6, 0.7, 0.8); waterM.specularPower = 64;
    waterM.alpha = 0.95;
    const water = BABYLON.MeshBuilder.CreateDisc("water", { radius: 2.35, tessellation: 24 }, scene);
    water.rotation.x = Math.PI / 2;
    water.position.y = 0.73;
    water.material = waterM; water.parent = root;

    // 噴き上げる水のパーティクル
    fountainPS = new BABYLON.ParticleSystem("fountainPS", 350, scene);
    fountainPS.particleTexture = TEX.dot;
    fountainPS.emitter = V3(0, 2.25, 0);
    fountainPS.minEmitBox = V3(-0.1, 0, -0.1); fountainPS.maxEmitBox = V3(0.1, 0, 0.1);
    fountainPS.color1 = new BABYLON.Color4(0.75, 0.92, 1, 0.9);
    fountainPS.color2 = new BABYLON.Color4(0.9, 0.98, 1, 0.9);
    fountainPS.colorDead = new BABYLON.Color4(0.8, 0.95, 1, 0);
    fountainPS.minSize = 0.1; fountainPS.maxSize = 0.28;
    fountainPS.minLifeTime = 0.7; fountainPS.maxLifeTime = 1.1;
    fountainPS.emitRate = 160;
    fountainPS.direction1 = V3(-0.7, 5.5, -0.7); fountainPS.direction2 = V3(0.7, 6.5, 0.7);
    fountainPS.gravity = V3(0, -9.5, 0);
    fountainPS.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    fountainPS.start();
    return root;
  }

  /* ============================================================
   * ガゼボ(ダンスの舞台)
   * ============================================================ */
  function buildGazebo() {
    const root = new BABYLON.TransformNode("gazebo", scene);
    root.position = V3(9, 0, -7);
    const baseM = mat("gzBase", "#fff6fa");
    const roofM = mat("gzRoof", "#c39be8", { emissive: "#241535" });
    const pieces = [];
    const base = BABYLON.MeshBuilder.CreateCylinder("gzb", { height: 0.5, diameter: 6.4, tessellation: 20 }, scene);
    base.position.y = 0.25; pieces.push(base);
    const step = BABYLON.MeshBuilder.CreateCylinder("gzs", { height: 0.24, diameter: 7.4, tessellation: 20 }, scene);
    step.position.y = 0.12; pieces.push(step);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const col = BABYLON.MeshBuilder.CreateCylinder("gzc", { height: 3.2, diameter: 0.34, tessellation: 10 }, scene);
      col.position.set(Math.cos(a) * 2.7, 2.1, Math.sin(a) * 2.7);
      pieces.push(col);
    }
    const baseMesh = BABYLON.Mesh.MergeMeshes(pieces, true, true);
    baseMesh.material = baseM; baseMesh.parent = root; baseMesh.receiveShadows = true;
    const dome = BABYLON.MeshBuilder.CreateSphere("gzd", { diameter: 6.6, segments: 12, slice: 0.5 }, scene);
    dome.position.y = 3.7; dome.material = roofM; dome.parent = root;
    const finial = BABYLON.MeshBuilder.CreateSphere("gzf", { diameter: 0.6 }, scene);
    finial.position.y = 7.2; finial.material = mat("gzg", "#ffd76a", { glow: "#87650f" }); finial.parent = root;
    shadowGen.addShadowCaster(baseMesh); shadowGen.addShadowCaster(dome);

    // イルミネーションライト(夜に光る)
    stringLightMat = mat("strL", "#fff0c0", { emissive: "#181008" });
    const bulbs = [];
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      const b = BABYLON.MeshBuilder.CreateSphere("bulb", { diameter: 0.18, segments: 6 }, scene);
      b.position.set(Math.cos(a) * 3.3, 3.45 + Math.sin(i * 2.3) * 0.12, Math.sin(a) * 3.3);
      bulbs.push(b);
    }
    const bulbMesh = BABYLON.Mesh.MergeMeshes(bulbs, true, true);
    bulbMesh.material = stringLightMat; bulbMesh.parent = root;

    // ガゼボ前のダンスステージ(屋根がないので上からもよく見える)
    const stage = BABYLON.MeshBuilder.CreateCylinder("stage", { height: 0.18, diameter: 5.4, tessellation: 28 }, scene);
    stage.position.set(9, 0.09, -1.6);
    const stageM = mat("stageM", "#ffc9e2", { emissive: "#2a1220" });
    stage.material = stageM; stage.receiveShadows = true;
    const stageRim = BABYLON.MeshBuilder.CreateTorus("stageRim", { diameter: 5.3, thickness: 0.14, tessellation: 28 }, scene);
    stageRim.position.set(9, 0.18, -1.6);
    stageRim.material = mat("stageRimM", "#ffd76a", { glow: "#7a5c10" });

    // 舞踏会用スポットライト(ステージの上)
    gazeboSpot = new BABYLON.SpotLight("gzSpot", V3(9, 7.5, -1.6), V3(0, -1, 0), Math.PI / 2.4, 8, scene);
    gazeboSpot.diffuse = HEX("#ffe6f4");
    gazeboSpot.intensity = 0;
    return root;
  }

  /* ============================================================
   * ステーション小物(ティーテーブル・イーゼル・花壇・柵)
   * ============================================================ */
  let easelTex = null;
  function buildStations() {
    // --- ティーテーブル ---
    const tea = new BABYLON.TransformNode("teaSet", scene);
    tea.position = V3(8.5, 0, 3.5);
    const tableM = mat("tableM", "#fffdf5");
    const top = BABYLON.MeshBuilder.CreateCylinder("tt", { height: 0.12, diameter: 2.2, tessellation: 20 }, scene);
    top.position.y = 1.0;
    const leg = BABYLON.MeshBuilder.CreateCylinder("tl", { height: 1.0, diameterTop: 0.16, diameterBottom: 0.5 }, scene);
    leg.position.y = 0.5;
    const tbl = BABYLON.Mesh.MergeMeshes([top, leg], true, true);
    tbl.material = tableM; tbl.parent = tea;
    // ケーキ
    const cakeBase = BABYLON.MeshBuilder.CreateCylinder("cake1", { height: 0.3, diameter: 0.75 }, scene);
    cakeBase.position.y = 1.22; cakeBase.material = mat("cakeM", "#fff1d6");
    const cakeTop = BABYLON.MeshBuilder.CreateCylinder("cake2", { height: 0.24, diameter: 0.5 }, scene);
    cakeTop.position.y = 1.48; cakeTop.material = mat("cakeM2", "#ffd9e8");
    const berry = BABYLON.MeshBuilder.CreateSphere("berry", { diameter: 0.18 }, scene);
    berry.position.y = 1.68; berry.material = mat("berryM", "#ff4d6d", { emissive: "#400a14" });
    // ティーポット
    const pot = BABYLON.MeshBuilder.CreateSphere("pot", { diameter: 0.5 }, scene);
    pot.position.set(0.6, 1.3, 0.2); pot.material = mat("potM", "#bfe0ff");
    [cakeBase, cakeTop, berry, pot].forEach(m => m.parent = tea);
    shadowGen.addShadowCaster(tbl);

    // --- イーゼル(お絵かき中に絵が現れる) ---
    const easel = new BABYLON.TransformNode("easel", scene);
    easel.position = V3(-8.5, 0, 3.5);
    easel.rotation.y = -0.5;
    const woodM = mat("woodM", "#c99a63");
    const legs = [];
    [[-0.5, 0.15], [0.5, 0.15], [0, -0.45]].forEach(([x, z]) => {
      const l = BABYLON.MeshBuilder.CreateCylinder("el", { height: 2.2, diameter: 0.1 }, scene);
      l.position.set(x, 1.1, z);
      l.rotation.z = x * 0.22; l.rotation.x = -z * 0.5;
      legs.push(l);
    });
    const legMesh = BABYLON.Mesh.MergeMeshes(legs, true, true);
    legMesh.material = woodM; legMesh.parent = easel;
    easelTex = new BABYLON.DynamicTexture("easelTex", { width: 256, height: 256 }, scene, false);
    clearEasel();
    const canvasM = new BABYLON.StandardMaterial("canvasM", scene);
    canvasM.diffuseTexture = easelTex;
    canvasM.emissiveColor = C3(0.35, 0.35, 0.35);
    canvasM.specularColor = C3(0, 0, 0);
    const board = BABYLON.MeshBuilder.CreatePlane("board", { width: 1.5, height: 1.5 }, scene);
    board.position.set(0, 1.55, 0.12);
    board.material = canvasM; board.parent = easel;
    shadowGen.addShadowCaster(legMesh);

    // --- ポニーの柵 ---
    const paddock = new BABYLON.TransformNode("paddock", scene);
    paddock.position = V3(0, 0, 13.5);
    const fenceM = mat("fenceM", "#fffdf7");
    const fences = [];
    const R = 4.4;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      if (a > 3.6 && a < 4.4) continue; // 入口
      const post = BABYLON.MeshBuilder.CreateCylinder("fpost", { height: 1.0, diameter: 0.16 }, scene);
      post.position.set(Math.cos(a) * R, 0.5, Math.sin(a) * R);
      fences.push(post);
      const a2 = (i + 1) / 12 * Math.PI * 2;
      const mid = V3((Math.cos(a) + Math.cos(a2)) / 2 * R, 0.72, (Math.sin(a) + Math.sin(a2)) / 2 * R);
      const rail = BABYLON.MeshBuilder.CreateCylinder("frail", { height: R * 0.55, diameter: 0.09 }, scene);
      rail.position.copyFrom(mid);
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = -((a + a2) / 2);
      fences.push(rail);
    }
    const fenceMesh = BABYLON.Mesh.MergeMeshes(fences, true, true);
    fenceMesh.material = fenceM; fenceMesh.parent = paddock;
    shadowGen.addShadowCaster(fenceMesh);

    // --- ランタン(小道の脇・夜に光る) ---
    const lanternM = mat("lantM", "#8b7ab8");
    [[3.5, 5.5], [-3.5, 5.5], [5.5, -3.5], [-5.5, -3.5]].forEach(([x, z], i) => {
      const pole = BABYLON.MeshBuilder.CreateCylinder("lp" + i, { height: 2.1, diameter: 0.12 }, scene);
      pole.position.set(x, 1.05, z); pole.material = lanternM;
      const orbM = mat("orbM" + i, "#fff3c8", { emissive: "#221a08" });
      const orb = BABYLON.MeshBuilder.CreateSphere("lo" + i, { diameter: 0.42, segments: 10 }, scene);
      orb.position.set(x, 2.25, z); orb.material = orbM;
      lanternOrbs.push(orbM);
      shadowGen.addShadowCaster(pole);
    });
  }

  function clearEasel() {
    const c = easelTex.getContext();
    c.fillStyle = "#fffef8";
    c.fillRect(0, 0, 256, 256);
    easelTex.update();
  }

  // お絵かきの進行(0..1)に応じて虹とお花の絵を描く
  function paintEasel(p) {
    const c = easelTex.getContext();
    c.fillStyle = "#fffef8"; c.fillRect(0, 0, 256, 256);
    const cols = ["#ff5f6d", "#ff9a56", "#ffe25f", "#7ed957", "#5fc9ff", "#c86fff"];
    const arcs = Math.ceil(p * 6);
    for (let i = 0; i < arcs; i++) {
      c.strokeStyle = cols[i]; c.lineWidth = 10;
      const frac = Math.min(1, p * 6 - i);
      c.beginPath();
      c.arc(128, 200, 110 - i * 12, Math.PI, Math.PI + Math.PI * frac);
      c.stroke();
    }
    if (p > 0.75) {
      c.font = "44px serif"; c.textAlign = "center";
      c.fillText("🌸", 60, 235); c.fillText("🌼", 196, 235);
    }
    if (p >= 1) { c.font = "40px serif"; c.fillText("☀️", 215, 50); }
    easelTex.update();
  }

  /* ============================================================
   * 木・花・ちょうちょ
   * ============================================================ */
  function buildNature() {
    // 桜の木
    const trunkM = mat("trunkM", "#9c6b4a");
    const blossomM = mat("blsM", "#ffc2dd", { emissive: "#331520" });
    const leafM = mat("leafM", "#6fbf5e", { emissive: "#0c2408" });
    function tree(x, z, pink, scale) {
      const r = new BABYLON.TransformNode("tree", scene);
      r.position = V3(x, 0, z);
      const trunk = BABYLON.MeshBuilder.CreateCylinder("trk", { height: 2.6 * scale, diameterTop: 0.35 * scale, diameterBottom: 0.6 * scale, tessellation: 8 }, scene);
      trunk.position.y = 1.3 * scale; trunk.material = trunkM; trunk.parent = r;
      const blobs = [];
      const n = 4;
      for (let i = 0; i < n; i++) {
        const b = BABYLON.MeshBuilder.CreateSphere("bl", { diameter: (2.2 + Math.random()) * scale, segments: 10 }, scene);
        const a = i / n * Math.PI * 2;
        b.position.set(Math.cos(a) * 0.9 * scale, (2.8 + Math.random() * 0.8) * scale, Math.sin(a) * 0.9 * scale);
        blobs.push(b);
      }
      const topB = BABYLON.MeshBuilder.CreateSphere("bl", { diameter: 2.4 * scale, segments: 10 }, scene);
      topB.position.y = 3.6 * scale; blobs.push(topB);
      const crown = BABYLON.Mesh.MergeMeshes(blobs, true, true);
      crown.material = pink ? blossomM : leafM; crown.parent = r;
      shadowGen.addShadowCaster(trunk); shadowGen.addShadowCaster(crown);
      return r;
    }
    const ring = [[-14, -10, 1], [14, -12, 1], [-17, 2, 0], [17, 4, 1], [-12, 14, 1], [13, 13, 0], [-19, -18, 1], [19, -19, 0], [6, 19, 1], [-4, 20, 0]];
    ring.forEach(([x, z, pink]) => tree(x, z, !!pink, 0.9 + Math.random() * 0.5));

    // お花のテンプレート(インスタンス複製)
    const stemM = mat("stemM", "#4f9c47");
    const stem = BABYLON.MeshBuilder.CreateCylinder("fstem", { height: 0.5, diameter: 0.05 }, scene);
    stem.position.y = 0.25;
    const centerS = BABYLON.MeshBuilder.CreateSphere("fcen", { diameter: 0.16, segments: 6 }, scene);
    centerS.position.y = 0.55;
    const petals = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const p = BABYLON.MeshBuilder.CreateSphere("fpet", { diameter: 0.2, segments: 6 }, scene);
      p.position.set(Math.cos(a) * 0.13, 0.55, Math.sin(a) * 0.13);
      p.scaling.y = 0.5;
      petals.push(p);
    }
    stem.material = stemM;
    const head = BABYLON.Mesh.MergeMeshes([centerS, ...petals], true, true);
    flowerTemplate = BABYLON.Mesh.MergeMeshes([stem, head], true, true, undefined, false, true);
    flowerTemplate.name = "flowerTpl";
    flowerTemplate.setEnabled(false);
    // 色ちがいの花材質
    const flowerMats = ["#ff7fa8", "#ffd25f", "#b98fff", "#ff9a56", "#7fc8ff"].map((h, i) => {
      const m2 = mat("flM" + i, h, { emissive: "#1a0d12" });
      return m2;
    });
    // 野の花をランダム配置(建物・ステーションの上は避ける)
    const noFlowerZones = [
      [9, -7, 4.6], [9, -1.6, 3.4], [8.5, 3.5, 2], [-8.5, 3.5, 2],
      [gardenCenter.x, gardenCenter.z, 3.4], [0, 13.5, 5.2]
    ];
    for (let i = 0; i < 55; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 14;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 2.5 && z < -4) continue; // 城への道は避ける
      if (noFlowerZones.some(([zx, zz, zr]) => Math.hypot(x - zx, z - zz) < zr)) continue;
      const f = flowerTemplate.clone("wildflower" + i);
      f.setEnabled(true);
      f.position.set(x, 0, z);
      const s = 0.7 + Math.random() * 0.7;
      f.scaling.set(s, s, s);
      f.getChildMeshes().forEach(cm => { if (cm.material && cm.material.name.startsWith("flM")) return; });
      // マルチマテリアルの2番目(頭)を色替え
      if (f.material && f.material.subMaterials) {
        const mm = f.material.clone("fmm" + i);
        mm.subMaterials = [...f.material.subMaterials];
        mm.subMaterials[1] = flowerMats[i % flowerMats.length];
        f.material = mm;
      }
      f.isPickable = false;
    }

    // ちょうちょ
    for (let i = 0; i < 6; i++) {
      const b = new BABYLON.TransformNode("bfly", scene);
      const col = ["#ffd25f", "#8fc8ff", "#ff9ecb"][i % 3];
      const wingM = mat("bwM" + i, col, { glow: col, backFace: false });
      const w1 = BABYLON.MeshBuilder.CreatePlane("bw1", { width: 0.34, height: 0.42 }, scene);
      w1.material = wingM; w1.parent = b;
      w1.setPivotPoint(V3(-0.17, 0, 0)); w1.position.x = 0.17;
      const w2 = BABYLON.MeshBuilder.CreatePlane("bw2", { width: 0.34, height: 0.42 }, scene);
      w2.material = wingM; w2.parent = b;
      w2.setPivotPoint(V3(0.17, 0, 0)); w2.position.x = -0.17;
      w1.rotation.x = w2.rotation.x = Math.PI / 2;
      b.position.set(Math.random() * 20 - 10, 1.2 + Math.random() * 1.4, Math.random() * 20 - 10);
      butterflies.push({ node: b, w1, w2, seed: Math.random() * 100, home: b.position.clone() });
      b.getChildMeshes().forEach(m2 => m2.isPickable = false);
    }
  }

  /* ---------- 植えた花(花壇にらせん状に配置) ---------- */
  function flowerSlot(i) {
    const golden = 2.39996;
    const r = 0.35 * Math.sqrt(i + 1);
    const a = i * golden;
    return V3(gardenCenter.x + Math.cos(a) * Math.min(r, 2.5), 0, gardenCenter.z + Math.sin(a) * Math.min(r, 2.5));
  }
  function plantFlower(index, animate) {
    const f = flowerTemplate.clone("planted" + index);
    f.setEnabled(true);
    f.position.copyFrom(flowerSlot(index));
    const hue = index % 5;
    if (f.material && f.material.subMaterials) {
      const mm = f.material.clone("pmm" + index);
      mm.subMaterials = [...f.material.subMaterials];
      const cols = ["#ff7fa8", "#ffd25f", "#b98fff", "#ff9a56", "#7fc8ff"];
      const m2 = mat("pfM" + index, cols[hue], { emissive: "#20101a" });
      mm.subMaterials[1] = m2;
      f.material = mm;
    }
    f.isPickable = false;
    const targetS = 0.9 + (index % 3) * 0.15;
    if (animate) {
      f.scaling.set(0.01, 0.01, 0.01);
      let t = 0;
      const obs = scene.onBeforeRenderObservable.add(() => {
        t += scene.getEngine().getDeltaTime() / 1000;
        const k = Math.min(1, t / 0.8);
        const s = targetS * (1 - Math.pow(1 - k, 3)) * (1 + Math.sin(k * Math.PI) * 0.25);
        f.scaling.set(s, s, s);
        if (k >= 1) scene.onBeforeRenderObservable.remove(obs);
      });
    } else {
      f.scaling.set(targetS, targetS, targetS);
    }
    plantedFlowers.push(f);
  }

  /* ============================================================
   * 舞い散る花びら・ホタル
   * ============================================================ */
  function buildAmbientParticles() {
    petalPS = new BABYLON.ParticleSystem("petals", 120, scene);
    petalPS.particleTexture = TEX.petal;
    petalPS.emitter = V3(0, 12, 0);
    petalPS.minEmitBox = V3(-20, 0, -20); petalPS.maxEmitBox = V3(20, 3, 20);
    petalPS.color1 = new BABYLON.Color4(1, 0.78, 0.88, 0.95);
    petalPS.color2 = new BABYLON.Color4(1, 0.62, 0.8, 0.95);
    petalPS.colorDead = new BABYLON.Color4(1, 0.8, 0.9, 0);
    petalPS.minSize = 0.14; petalPS.maxSize = 0.3;
    petalPS.minLifeTime = 8; petalPS.maxLifeTime = 12;
    petalPS.emitRate = 9;
    petalPS.direction1 = V3(-0.6, -1, -0.3); petalPS.direction2 = V3(0.6, -1.4, 0.3);
    petalPS.minAngularSpeed = -2; petalPS.maxAngularSpeed = 2;
    petalPS.gravity = V3(0.25, -0.12, 0);
    petalPS.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    petalPS.start();

    fireflyPS = new BABYLON.ParticleSystem("fireflies", 80, scene);
    fireflyPS.particleTexture = TEX.dot;
    fireflyPS.emitter = V3(0, 1.4, 2);
    fireflyPS.minEmitBox = V3(-14, -0.8, -12); fireflyPS.maxEmitBox = V3(14, 2.4, 14);
    fireflyPS.color1 = new BABYLON.Color4(1, 0.95, 0.45, 0.95);
    fireflyPS.color2 = new BABYLON.Color4(0.7, 1, 0.5, 0.9);
    fireflyPS.colorDead = new BABYLON.Color4(1, 1, 0.5, 0);
    fireflyPS.minSize = 0.07; fireflyPS.maxSize = 0.16;
    fireflyPS.minLifeTime = 2.5; fireflyPS.maxLifeTime = 5;
    fireflyPS.emitRate = 0; // 夜だけ
    fireflyPS.direction1 = V3(-0.4, -0.15, -0.4); fireflyPS.direction2 = V3(0.4, 0.3, 0.4);
    fireflyPS.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    fireflyPS.start();
  }

  /* ============================================================
   * 演出エフェクト(呼び出し用)
   * ============================================================ */
  function burst(pos, tex, colors, count, speed, size, life, gravity) {
    const ps = new BABYLON.ParticleSystem("burst", count, scene);
    ps.particleTexture = tex;
    ps.emitter = pos.clone();
    ps.color1 = colors[0]; ps.color2 = colors[1];
    ps.colorDead = new BABYLON.Color4(colors[1].r, colors[1].g, colors[1].b, 0);
    ps.minSize = size * 0.6; ps.maxSize = size * 1.4;
    ps.minLifeTime = life * 0.7; ps.maxLifeTime = life * 1.3;
    ps.manualEmitCount = count;
    ps.minEmitPower = speed * 0.5; ps.maxEmitPower = speed;
    ps.direction1 = V3(-1, 0.5, -1); ps.direction2 = V3(1, 1.6, 1);
    ps.gravity = V3(0, gravity, 0);
    ps.minAngularSpeed = -3; ps.maxAngularSpeed = 3;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.disposeOnStop = true;
    ps.targetStopDuration = life * 1.5;
    ps.start();
  }
  const C4 = (r, g, b, a) => new BABYLON.Color4(r, g, b, a);

  function sparkleBurst(pos) { burst(pos, TEX.star, [C4(1, 0.95, 0.5, 1), C4(0.7, 0.9, 1, 1)], 40, 5, 0.28, 1.1, -2); }
  function heartBurst(pos)  { burst(pos, TEX.heart, [C4(1, 0.45, 0.65, 1), C4(1, 0.7, 0.85, 1)], 26, 4, 0.34, 1.4, 1.2); }
  function magicBurst(pos)  { burst(pos, TEX.star, [C4(0.7, 0.5, 1, 1), C4(0.4, 0.9, 1, 1)], 60, 6, 0.3, 1.4, -0.5); }
  function splashBurst(pos) { burst(pos, TEX.dot, [C4(0.75, 0.92, 1, 1), C4(1, 1, 1, 1)], 50, 6, 0.2, 0.9, -12); }
  function confettiBurst(pos) {
    burst(pos, TEX.dot, [C4(1, 0.55, 0.65, 1), C4(1, 0.85, 0.4, 1)], 60, 7, 0.22, 2.2, -4);
    burst(pos, TEX.star, [C4(0.55, 0.8, 1, 1), C4(0.8, 0.6, 1, 1)], 40, 6, 0.3, 2.2, -3);
  }
  function firework(pos, hue) {
    const cols = [
      [C4(1, 0.5, 0.6, 1), C4(1, 0.8, 0.5, 1)],
      [C4(0.5, 0.8, 1, 1), C4(0.7, 1, 0.8, 1)],
      [C4(0.85, 0.6, 1, 1), C4(1, 0.75, 0.9, 1)],
      [C4(1, 0.9, 0.45, 1), C4(1, 0.65, 0.4, 1)]
    ][hue % 4];
    burst(pos, TEX.star, cols, 110, 9, 0.4, 1.8, -3);
    burst(pos, TEX.dot, cols, 70, 7, 0.24, 1.6, -3.5);
    PM.Audio.sfx("firework");
  }
  function fireworkShow(n) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const p = V3((Math.random() - 0.5) * 26, 13 + Math.random() * 8, -14 - Math.random() * 10);
        firework(p, Math.floor(Math.random() * 4));
      }, i * 420);
    }
  }
  function showRainbow(seconds) {
    let t = 0;
    const kids = rainbowRoot.getChildMeshes();
    const obs = scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime() / 1000;
      const a = t < 1 ? t : (t > seconds - 1.5 ? Math.max(0, (seconds - t) / 1.5) : 1);
      kids.forEach(m => m.material.alpha = a * 0.55);
      if (t >= seconds) scene.onBeforeRenderObservable.remove(obs);
    });
  }

  /* ============================================================
   * 昼夜サイクル
   * ============================================================ */
  const SKY_KEYS = [ // [time, top, mid, bottom, sunColor, sunInt, hemiInt, fog]
    { t: 0.00, top: "#ffd9a0", mid: "#ffe9c8", bot: "#e8f2d8", sun: "#ffd9a8", si: 0.8,  hi: 0.52, fog: "#ffe9c8" }, // 朝
    { t: 0.10, top: "#4aa8ff", mid: "#bfe3ff", bot: "#dff0e0", sun: "#fff2d8", si: 1.05, hi: 0.6,  fog: "#cfe8ff" }, // 昼
    { t: 0.45, top: "#4aa8ff", mid: "#bfe3ff", bot: "#dff0e0", sun: "#fff2d8", si: 1.05, hi: 0.6,  fog: "#cfe8ff" },
    { t: 0.55, top: "#7a5fd0", mid: "#ff9a76", bot: "#ffd9a0", sun: "#ff9a56", si: 0.8,  hi: 0.45, fog: "#ffbf9a" }, // 夕焼け
    { t: 0.66, top: "#141c48", mid: "#2c3a78", bot: "#1a2450", sun: "#a8b8ff", si: 0.28, hi: 0.24, fog: "#232f60" }, // 夜
    { t: 0.90, top: "#141c48", mid: "#2c3a78", bot: "#1a2450", sun: "#a8b8ff", si: 0.28, hi: 0.24, fog: "#232f60" },
    { t: 0.97, top: "#ffb0c8", mid: "#ffd9c8", bot: "#f0e8d0", sun: "#ffc890", si: 0.7,  hi: 0.5,  fog: "#ffd9c8" }, // 夜明け
    { t: 1.00, top: "#ffd9a0", mid: "#ffe9c8", bot: "#e8f2d8", sun: "#ffd9a8", si: 0.9,  hi: 0.6,  fog: "#ffe9c8" }
  ];
  function lerpC(a, b, k) { return BABYLON.Color3.Lerp(HEX(a), HEX(b), k); }

  function nightFactor() {
    // 0=昼, 1=夜
    if (dayTime > 0.62 && dayTime < 0.94) return 1;
    if (dayTime > 0.55 && dayTime <= 0.62) return (dayTime - 0.55) / 0.07;
    if (dayTime >= 0.94 && dayTime < 0.99) return 1 - (dayTime - 0.94) / 0.05;
    return 0;
  }

  function updateDayCycle(dt) {
    dayTime = (dayTime + dt / DAY_LENGTH) % 1;
    let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      if (dayTime >= SKY_KEYS[i].t && dayTime <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
    }
    const k = (dayTime - a.t) / Math.max(0.0001, b.t - a.t);
    skyMat.setColor3("topColor", lerpC(a.top, b.top, k));
    skyMat.setColor3("midColor", lerpC(a.mid, b.mid, k));
    skyMat.setColor3("botColor", lerpC(a.bot, b.bot, k));
    sun.diffuse = lerpC(a.sun, b.sun, k);
    sun.intensity = a.si + (b.si - a.si) * k;
    hemi.intensity = a.hi + (b.hi - a.hi) * k;
    scene.fogColor = lerpC(a.fog, b.fog, k);
    scene.clearColor = BABYLON.Color4.FromColor3(lerpC(a.mid, b.mid, k));

    // 太陽・月の位置(空の弧)
    const sunAng = (dayTime < 0.62 ? dayTime / 0.62 : 1.05) * Math.PI; // 昼の間に弧を描く
    sunSphere.position.set(Math.cos(sunAng) * 130, Math.sin(sunAng) * 90 + 4, -95);
    const moonT = dayTime > 0.55 ? (dayTime - 0.55) / 0.45 : 0;
    moon.position.set(Math.cos((1 - moonT) * Math.PI) * 120, Math.sin(moonT * Math.PI) * 80 + 5, -90);
    moon.setEnabled(moonT > 0.02);

    const nf = nightFactor();
    starMesh.material.alpha = nf * 0.95;
    windowMat.emissiveColor = BABYLON.Color3.Lerp(HEX("#111111"), HEX("#ffca4f"), nf);
    stringLightMat.emissiveColor = BABYLON.Color3.Lerp(HEX("#181008"), HEX("#ffe08a"), nf);
    lanternOrbs.forEach(m2 => m2.emissiveColor = BABYLON.Color3.Lerp(HEX("#221a08"), HEX("#ffdf70"), nf));
    fireflyPS.emitRate = nf * 22;
    PM.Audio.setNight(nf > 0.5);

    // 雲はゆっくり流れる
    cloudRoot.rotation.y += dt * 0.006;
    // 水面
    if (waterTex) { waterTex.vOffset += dt * 0.05; waterTex.uOffset += dt * 0.02; }
    // 旗はためく
    flagList.forEach((f, i) => f.rotation.y = Math.sin(elapsed * 3 + i) * 0.35);
  }

  function updateButterflies(dt) {
    butterflies.forEach(bf => {
      const t = elapsed + bf.seed;
      bf.node.position.x = bf.home.x + Math.sin(t * 0.31) * 5 + Math.sin(t * 0.83) * 1.5;
      bf.node.position.z = bf.home.z + Math.cos(t * 0.23) * 5 + Math.cos(t * 0.7) * 1.5;
      bf.node.position.y = bf.home.y + Math.sin(t * 1.1) * 0.5;
      bf.node.rotation.y = Math.atan2(Math.cos(t * 0.31) * 0.31 * 5, -Math.sin(t * 0.23) * 0.23 * 5);
      const flap = Math.sin(t * 18) * 0.9;
      bf.w1.rotation.y = flap; bf.w2.rotation.y = -flap;
    });
  }

  /* ============================================================
   * 公開API
   * ============================================================ */
  function build(s) {
    scene = s;
    scene.fogMode = BABYLON.Scene.FOG_EXP2;
    scene.fogDensity = 0.0038;
    scene.fogColor = HEX("#cfe8ff");
    TEX = { dot: softDotTex(), star: starTexture(), heart: heartTexture(), petal: petalTexture() };
    glow = new BABYLON.GlowLayer("glow", scene);
    glow.intensity = 0.38;
    buildLights();
    buildSky();
    buildGround();
    buildCastle();
    buildFountain();
    buildGazebo();
    buildStations();
    buildNature();
    buildAmbientParticles();
    // セーブ済みのお花を復元
    const n = Math.min(60, PM.Save.get().flowers);
    for (let i = 0; i < n; i++) plantFlower(i, false);
    return api;
  }

  function update(dt) {
    elapsed += dt;
    updateDayCycle(dt);
    updateButterflies(dt);
  }

  const api = {
    build, update,
    get shadowGen() { return shadowGen; },
    get gazeboSpot() { return gazeboSpot; },
    get nightFactor() { return nightFactor(); },
    gardenCenter,
    sparkleBurst, heartBurst, magicBurst, splashBurst, confettiBurst,
    firework, fireworkShow, showRainbow,
    plantFlower, paintEasel, clearEasel,
    getTex: () => TEX,
    skipToNight() { dayTime = 0.6; },
    positions: {
      tea:    V3(7.2, 0, 3.2),
      dance:  V3(9, 0, -1.6),
      art:    V3(-7.3, 0, 3.4),
      magic:  V3(0, 0, 3.4),
      pony:   V3(0, 0, 10.2),
      garden: V3(-6.5, 0, 6.2),
      home:   V3(0, 0, 6.5)
    }
  };
  return api;
})();
