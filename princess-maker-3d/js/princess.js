/* ============================================================
 * princess.js — プリンセスとポニー
 *   プロシージャル生成のちびキャラ + きせかえ + 手続きアニメ。
 * ============================================================ */
"use strict";
window.PM = window.PM || {};

PM.Princess = (function () {
  const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);
  const C3 = (r, g, b) => new BABYLON.Color3(r, g, b);
  const HEX = (h) => BABYLON.Color3.FromHexString(h);

  /* ---------- きせかえカタログ(unlock はレベル) ---------- */
  const DRESSES = {
    pink:    { unlock: 1, sw: "#ff85bc", skirt: "#ff85bc", top: "#ffc2de", trim: "#ffffff", emoji: "" },
    blue:    { unlock: 2, sw: "#66a8fa", skirt: "#66a8fa", top: "#c2ddff", trim: "#ffffff" },
    mint:    { unlock: 3, sw: "#5ecfa4", skirt: "#5ecfa4", top: "#c4f0e0", trim: "#ffffff" },
    lilac:   { unlock: 4, sw: "#b184e0", skirt: "#b184e0", top: "#e2ccf7", trim: "#ffe08a" },
    sunset:  { unlock: 5, sw: "#ff9a56", skirt: "#ff9a56", top: "#ffe25f", trim: "#ff5f8d", twoTone: "#ff5f8d" },
    ruby:    { unlock: 6, sw: "#ff4d6d", skirt: "#ff4d6d", top: "#ffd9e0", trim: "#ffd76a" },
    star:    { unlock: 7, sw: "#3a4a9f", skirt: "#3a4a9f", top: "#8fa8ff", trim: "#ffe08a", stars: true },
    rainbow: { unlock: 9, sw: "#ff5f6d", skirt: "#ff7fa8", top: "#fff6d8", trim: "#7fc8ff", rainbow: true }
  };
  const HAIRS = {
    twin: { unlock: 1, emoji: "🎀" },
    long: { unlock: 2, emoji: "👱" },
    bun:  { unlock: 4, emoji: "🍡" },
    tail: { unlock: 6, emoji: "🐎" }
  };
  const HAIR_COLORS = {
    brown:  { unlock: 1, sw: "#8a5a3a", c: "#8a5a3a" },
    blonde: { unlock: 3, sw: "#ffd98a", c: "#ffd98a" },
    pink:   { unlock: 5, sw: "#ff9ecb", c: "#ff9ecb" },
    lavender: { unlock: 7, sw: "#b8a8e8", c: "#b8a8e8" },
    silver: { unlock: 8, sw: "#eef0fa", c: "#eef0fa" }
  };
  const CROWNS = {
    none:   { unlock: 1, emoji: "✖️" },
    ribbon: { unlock: 1, emoji: "🎀" },
    flower: { unlock: 2, emoji: "🌸" },
    tiara:  { unlock: 4, emoji: "💎" },
    crown:  { unlock: 6, emoji: "👑" },
    wings:  { unlock: 8, emoji: "🧚" },
    halo:   { unlock: 10, emoji: "😇" }
  };

  let scene, world;
  const P = {}; // princess parts

  function mat(name, hex, opts) {
    opts = opts || {};
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = HEX(hex);
    m.specularColor = C3(0.12, 0.1, 0.1);
    if (opts.glow) m.emissiveColor = HEX(opts.glow);
    if (opts.emissive) m.emissiveColor = HEX(opts.emissive);
    if (opts.alpha !== undefined) m.alpha = opts.alpha;
    return m;
  }
  function sphere(name, d, seg) { return BABYLON.MeshBuilder.CreateSphere(name, { diameter: d, segments: seg || 12 }, scene); }

  function makeBlobShadow(name, size) {
    const disc = BABYLON.MeshBuilder.CreateDisc(name, { radius: size / 2, tessellation: 20 }, scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 0.02;
    const m = new BABYLON.StandardMaterial(name + "M", scene);
    m.diffuseColor = C3(0, 0, 0);
    m.specularColor = C3(0, 0, 0);
    m.opacityTexture = PM.World.getTex().dot;
    m.alpha = 0.32;
    disc.material = m;
    disc.isPickable = false;
    return disc;
  }

  /* ============================================================
   * プリンセス本体
   * ============================================================ */
  function buildPrincess() {
    P.root = new BABYLON.TransformNode("princessRoot", scene);
    P.root.position = V3(0, 0, 6.5);
    P.body = new BABYLON.TransformNode("pBody", scene);
    P.body.parent = P.root;

    const skinM = mat("skinM", "#ffe3cf");
    P.skinM = skinM;

    // くつ
    P.shoeL = sphere("shoeL", 0.18, 8); P.shoeR = sphere("shoeR", 0.18, 8);
    P.shoeL.scaling.set(1, 0.7, 1.35); P.shoeR.scaling.set(1, 0.7, 1.35);
    P.shoeL.position.set(-0.12, 0.07, 0.04); P.shoeR.position.set(0.12, 0.07, 0.04);
    P.shoeM = mat("shoeM", "#ff6f9f");
    P.shoeL.material = P.shoeR.material = P.shoeM;
    P.shoeL.parent = P.body; P.shoeR.parent = P.body;

    // 腕(肩にピボット)
    P.armL = new BABYLON.TransformNode("armL", scene); P.armL.parent = P.body;
    P.armL.position.set(-0.27, 0.95, 0);
    P.armR = new BABYLON.TransformNode("armR", scene); P.armR.parent = P.body;
    P.armR.position.set(0.27, 0.95, 0);
    [P.armL, P.armR].forEach((a, i) => {
      const s = i === 0 ? -1 : 1;
      const arm = BABYLON.MeshBuilder.CreateCapsule("armC" + i, { height: 0.42, radius: 0.065 }, scene);
      arm.position.y = -0.18;
      arm.material = skinM; arm.parent = a;
      const hand = sphere("hand" + i, 0.14, 8);
      hand.position.y = -0.4; hand.material = skinM; hand.parent = a;
      a.rotation.z = s * 0.35;
    });

    // 頭
    P.head = new BABYLON.TransformNode("pHead", scene);
    P.head.parent = P.body; P.head.position.y = 1.32;
    const headS = sphere("headS", 0.64, 20);
    headS.material = skinM; headS.parent = P.head;
    // 目
    const eyeM = mat("eyeM", "#3a2a2a", { emissive: "#120a0a" });
    const hlM = mat("hlM", "#ffffff", { glow: "#ffffff" });
    P.eyes = [];
    [-1, 1].forEach(s => {
      const eye = sphere("eye" + s, 0.11, 10);
      eye.scaling.set(0.8, 1.25, 0.5);
      eye.position.set(s * 0.13, 0.04, 0.275);
      eye.material = eyeM; eye.parent = P.head;
      const hl = sphere("hl" + s, 0.035, 6);
      hl.position.set(s * 0.11, 0.075, 0.315);
      hl.material = hlM; hl.parent = P.head;
      P.eyes.push(eye);
    });
    // ほっぺ
    const cheekM = mat("cheekM", "#ffb0b8", { emissive: "#552a2e" });
    [-1, 1].forEach(s => {
      const ch = sphere("cheek" + s, 0.12, 8);
      ch.scaling.set(1, 0.6, 0.4);
      ch.position.set(s * 0.21, -0.08, 0.24);
      ch.material = cheekM; ch.parent = P.head;
    });
    // にっこりお口(チューブの弧)
    const arc = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.15 + 0.7 * i / 8);
      arc.push(V3(Math.cos(a) * 0.07, -Math.sin(a) * 0.05, 0));
    }
    const mouth = BABYLON.MeshBuilder.CreateTube("mouth", { path: arc, radius: 0.012 }, scene);
    mouth.position.set(0, -0.1, 0.3);
    mouth.material = mat("mouthM", "#c05a6a", { emissive: "#401418" });
    mouth.parent = P.head;

    // きせかえ入れ物
    P.dressNode = new BABYLON.TransformNode("dressNode", scene); P.dressNode.parent = P.body;
    P.hairNode = new BABYLON.TransformNode("hairNode", scene); P.hairNode.parent = P.head;
    P.crownNode = new BABYLON.TransformNode("crownNode", scene); P.crownNode.parent = P.head;
    P.skirt = null;

    // 影
    [headS].forEach(m => world.shadowGen.addShadowCaster(m));

    // 接地感を出すまるい影
    P.blob = makeBlobShadow("pBlob", 1.1);
    P.blob.parent = P.root;

    // 状態
    P.state = "idle";
    P.stateTime = 0;
    P.walkTarget = null;
    P.walkCb = null;
    P.faceTarget = null;
    P.blinkT = 2;
    P.time = 0;
    applyOutfit(PM.Save.get().outfit);
    applyLevel(PM.Save.level());
  }

  function disposeChildren(node) {
    node.getChildMeshes().slice().forEach(m => m.dispose());
    node.getChildTransformNodes().slice().forEach(n => n.dispose());
  }

  /* ---------- ドレス ---------- */
  function buildDress(id) {
    disposeChildren(P.dressNode);
    const d = DRESSES[id] || DRESSES.pink;
    const skirtM = mat("skirtM", d.skirt, { emissive: shade(d.skirt, 0.13) });
    const topM = mat("topM", d.top, { emissive: shade(d.top, 0.1) });
    const trimM = mat("trimM", d.trim, { emissive: shade(d.trim, 0.15) });

    P.skirt = new BABYLON.TransformNode("skirtN", scene); P.skirt.parent = P.dressNode;
    const skirt = BABYLON.MeshBuilder.CreateCylinder("skirtC", { height: 0.62, diameterTop: 0.3, diameterBottom: 1.0, tessellation: 24 }, scene);
    skirt.position.y = 0.31;
    skirt.material = skirtM; skirt.parent = P.skirt;
    // すそのフリル
    const frill = BABYLON.MeshBuilder.CreateTorus("frill", { diameter: 0.98, thickness: 0.09, tessellation: 24 }, scene);
    frill.position.y = 0.06;
    frill.material = trimM; frill.parent = P.skirt;

    if (d.twoTone) {
      const over = BABYLON.MeshBuilder.CreateCylinder("skirt2", { height: 0.4, diameterTop: 0.3, diameterBottom: 0.78, tessellation: 24 }, scene);
      over.position.y = 0.44;
      over.material = mat("skirt2M", d.twoTone, { emissive: shade(d.twoTone, 0.13) });
      over.parent = P.skirt;
    }
    if (d.rainbow) {
      const cols = ["#ff5f6d", "#ff9a56", "#ffe25f", "#7ed957", "#5fc9ff", "#c86fff"];
      cols.forEach((cH, i) => {
        const ring = BABYLON.MeshBuilder.CreateTorus("rr" + i, { diameter: 0.42 + i * 0.1, thickness: 0.045, tessellation: 20 }, scene);
        ring.position.y = 0.52 - i * 0.082;
        ring.material = mat("rrM" + i, cH, { emissive: shade(cH, 0.3) });
        ring.parent = P.skirt;
      });
    }
    if (d.stars) {
      const starM = mat("dStarM", "#ffe9a0", { glow: "#ffdf70" });
      for (let i = 0; i < 10; i++) {
        const st = sphere("dst" + i, 0.06, 6);
        const a = i / 10 * Math.PI * 2;
        const h = 0.1 + (i % 3) * 0.16;
        const r = 0.15 + (0.5 - h * 0.72) * 0.95;
        st.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
        st.material = starM; st.parent = P.skirt;
      }
    }
    // 胴(トップス)
    const torso = sphere("torso", 0.42, 14);
    torso.scaling.set(1, 1.1, 0.85);
    torso.position.y = 0.82;
    torso.material = topM; torso.parent = P.dressNode;
    // えり
    const collar = BABYLON.MeshBuilder.CreateTorus("collar", { diameter: 0.34, thickness: 0.05, tessellation: 16 }, scene);
    collar.position.y = 1.02;
    collar.material = trimM; collar.parent = P.dressNode;
    // そで(ぷっくり)
    [-1, 1].forEach(s => {
      const puff = sphere("puff" + s, 0.2, 10);
      puff.position.set(s * 0.27, 0.95, 0);
      puff.material = skirtM; puff.parent = P.dressNode;
    });
    world.shadowGen.addShadowCaster(skirt);
    world.shadowGen.addShadowCaster(torso);
  }

  function shade(hex, k) {
    const c = HEX(hex);
    return new BABYLON.Color3(c.r * k, c.g * k, c.b * k).toHexString();
  }

  /* ---------- かみがた ---------- */
  function buildHair(style, colorId) {
    disposeChildren(P.hairNode);
    const col = (HAIR_COLORS[colorId] || HAIR_COLORS.brown).c;
    const hairM = mat("hairM", col, { emissive: shade(col, 0.12) });
    P.tails = [];

    // ベース(前髪+頭頂)
    const cap = sphere("hairCap", 0.7, 16);
    cap.scaling.set(1, 0.92, 1);
    cap.position.set(0, 0.06, -0.045);
    cap.material = hairM; cap.parent = P.hairNode;
    // 前髪ぱっつん
    for (let i = -2; i <= 2; i++) {
      const bang = sphere("bang" + i, 0.17, 8);
      bang.scaling.set(0.85, 1.15, 0.6);
      bang.position.set(i * 0.115, 0.16, 0.27);
      bang.material = hairM; bang.parent = P.hairNode;
    }

    const ribbonM = mat("ribM", "#ff5f8d", { emissive: "#4a1020" });
    function ribbon(x, y, z) {
      const r = new BABYLON.TransformNode("ribN", scene); r.parent = P.hairNode;
      r.position.set(x, y, z);
      [-1, 1].forEach(s => {
        const wing = sphere("ribW" + s, 0.14, 8);
        wing.scaling.set(1.2, 0.7, 0.5);
        wing.position.x = s * 0.09;
        wing.material = ribbonM; wing.parent = r;
      });
      return r;
    }

    if (style === "twin") {
      [-1, 1].forEach(s => {
        const t = new BABYLON.TransformNode("tail" + s, scene);
        t.parent = P.hairNode; t.position.set(s * 0.32, 0.08, -0.08);
        const seg1 = BABYLON.MeshBuilder.CreateCapsule("ts1" + s, { height: 0.5, radius: 0.11 }, scene);
        seg1.position.y = -0.26; seg1.material = hairM; seg1.parent = t;
        const tip = sphere("tt" + s, 0.16, 8);
        tip.position.y = -0.52; tip.material = hairM; tip.parent = t;
        t.rotation.z = s * 0.35;
        P.tails.push(t);
        ribbon(s * 0.32, 0.12, -0.06);
      });
    } else if (style === "long") {
      const back = sphere("hairBack", 0.62, 14);
      back.scaling.set(0.95, 1.5, 0.62);
      back.position.set(0, -0.22, -0.18);
      back.material = hairM; back.parent = P.hairNode;
      const t = new BABYLON.TransformNode("tailL", scene);
      t.parent = P.hairNode; t.position.set(0, -0.3, -0.3);
      const flow = sphere("flow", 0.4, 10);
      flow.scaling.set(0.9, 1.6, 0.5);
      flow.position.y = -0.3;
      flow.material = hairM; flow.parent = t;
      P.tails.push(t);
    } else if (style === "bun") {
      const bun = sphere("bun", 0.3, 12);
      bun.position.set(0, 0.36, -0.05);
      bun.material = hairM; bun.parent = P.hairNode;
      ribbon(0, 0.42, 0.12);
    } else if (style === "tail") { // ポニーテール
      const t = new BABYLON.TransformNode("ponyT", scene);
      t.parent = P.hairNode; t.position.set(0, 0.25, -0.24);
      const seg = BABYLON.MeshBuilder.CreateCapsule("pts", { height: 0.62, radius: 0.12 }, scene);
      seg.position.y = -0.3; seg.material = hairM; seg.parent = t;
      const tip = sphere("ptt", 0.18, 8);
      tip.position.y = -0.62; tip.material = hairM; tip.parent = t;
      t.rotation.x = -0.5;
      P.tails.push(t);
      ribbon(0, 0.3, -0.15);
    }
  }

  /* ---------- あたまのかざり ---------- */
  function buildCrown(id) {
    disposeChildren(P.crownNode);
    P.wings = null; P.halo = null;
    const goldM = mat("cGold", "#ffd76a", { glow: "#a87f18" });
    const gemM = mat("cGem", "#ff6f9f", { glow: "#ff3a78" });
    if (id === "tiara") {
      const band = BABYLON.MeshBuilder.CreateTorus("tiaraB", { diameter: 0.5, thickness: 0.035, tessellation: 20 }, scene);
      band.position.y = 0.26; band.rotation.x = 0.15;
      band.material = goldM; band.parent = P.crownNode;
      const gem = sphere("tiaraG", 0.09, 8);
      gem.position.set(0, 0.34, 0.22); gem.material = gemM; gem.parent = P.crownNode;
    } else if (id === "crown") {
      const base = BABYLON.MeshBuilder.CreateCylinder("crB", { height: 0.16, diameter: 0.42, tessellation: 12 }, scene);
      base.position.y = 0.4; base.material = goldM; base.parent = P.crownNode;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const spike = BABYLON.MeshBuilder.CreateCylinder("crS" + i, { height: 0.16, diameterTop: 0.01, diameterBottom: 0.09 }, scene);
        spike.position.set(Math.cos(a) * 0.17, 0.52, Math.sin(a) * 0.17);
        spike.material = goldM; spike.parent = P.crownNode;
      }
      const gem = sphere("crG", 0.08, 8);
      gem.position.set(0, 0.42, 0.21); gem.material = gemM; gem.parent = P.crownNode;
    } else if (id === "flower") {
      const cols = ["#ff7fa8", "#ffd25f", "#7fc8ff", "#ff9a56", "#c86fff", "#7ed957"];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const f = sphere("cfF" + i, 0.11, 8);
        f.scaling.y = 0.7;
        f.position.set(Math.cos(a) * 0.28, 0.28, Math.sin(a) * 0.28);
        f.material = mat("cfM" + i, cols[i], { emissive: shade(cols[i], 0.25) });
        f.parent = P.crownNode;
      }
    } else if (id === "ribbon") {
      const ribM = mat("crRib", "#ff5f8d", { emissive: "#5c1428" });
      [-1, 1].forEach(s => {
        const w = sphere("crRW" + s, 0.18, 8);
        w.scaling.set(1.3, 0.8, 0.5);
        w.position.set(s * 0.12 + 0.16, 0.3, -0.05);
        w.material = ribM; w.parent = P.crownNode;
      });
      const knot = sphere("crRK", 0.09, 8);
      knot.position.set(0.28, 0.3, -0.05); knot.material = ribM; knot.parent = P.crownNode;
    } else if (id === "wings") {
      const wingM = mat("wingM", "#dff4ff", { glow: "#9fdcff" });
      wingM.alpha = 0.75;
      P.wings = [];
      [-1, 1].forEach(s => {
        const w = BABYLON.MeshBuilder.CreatePlane("wing" + s, { width: 0.5, height: 0.7 }, scene);
        w.material = wingM;
        w.parent = P.crownNode;
        w.position.set(s * 0.25, -0.75, -0.4);
        w.rotation.y = s * 0.7;
        w.setPivotPoint(V3(-s * 0.25, 0, 0));
        P.wings.push({ mesh: w, s });
      });
    } else if (id === "halo") {
      const halo = BABYLON.MeshBuilder.CreateTorus("halo", { diameter: 0.42, thickness: 0.04, tessellation: 20 }, scene);
      halo.position.y = 0.52;
      halo.material = mat("haloM", "#fff6c0", { glow: "#ffe982" });
      halo.parent = P.crownNode;
      P.halo = halo;
    }
  }

  function applyOutfit(outfit) {
    buildDress(outfit.dress);
    buildHair(outfit.hair, outfit.hairColor);
    buildCrown(outfit.crown);
    P.wingsFlap = outfit.crown === "wings";
  }

  function applyLevel(level) {
    const s = 1 + (level - 1) * 0.033;
    P.root.scaling.set(s, s, s);
  }

  /* ============================================================
   * ポニー
   * ============================================================ */
  const PONY = {};
  function buildPony() {
    PONY.root = new BABYLON.TransformNode("ponyRoot", scene);
    PONY.root.position = V3(0.8, 0, 13.8);
    PONY.root.rotation.y = -0.9;
    PONY.body = new BABYLON.TransformNode("ponyBody", scene);
    PONY.body.parent = PONY.root;
    const coatM = mat("coatM", "#ffe8c2");
    const maneM = mat("maneM", "#ff92bc", { emissive: "#38141f" });

    const body = sphere("pbody", 1.0, 14);
    body.scaling.set(1.45, 0.95, 0.85);
    body.position.y = 0.85;
    body.material = coatM; body.parent = PONY.body;

    PONY.head = new BABYLON.TransformNode("pHeadN", scene);
    PONY.head.parent = PONY.body; PONY.head.position.set(0.72, 1.3, 0);
    const head = sphere("phead", 0.55, 14);
    head.material = coatM; head.parent = PONY.head;
    const snout = sphere("psnout", 0.34, 10);
    snout.position.set(0.22, -0.08, 0);
    snout.scaling.set(1.15, 0.8, 0.9);
    snout.material = mat("snoutM", "#ffdcc8"); snout.parent = PONY.head;
    // 耳
    [-1, 1].forEach(s => {
      const ear = BABYLON.MeshBuilder.CreateCylinder("pear" + s, { height: 0.22, diameterTop: 0.02, diameterBottom: 0.14 }, scene);
      ear.position.set(-0.1, 0.28, s * 0.16);
      ear.material = coatM; ear.parent = PONY.head;
    });
    // 目
    const eyeM = mat("peyeM", "#3a2a2a", { emissive: "#0c0808" });
    [-1, 1].forEach(s => {
      const e = sphere("peye" + s, 0.09, 8);
      e.scaling.set(0.7, 1.2, 0.7);
      e.position.set(0.14, 0.06, s * 0.21);
      e.material = eyeM; e.parent = PONY.head;
    });
    // たてがみ
    for (let i = 0; i < 4; i++) {
      const m2 = sphere("pmane" + i, 0.22 - i * 0.02, 8);
      m2.position.set(0.45 - i * 0.22, 1.45 - i * 0.06, 0);
      m2.material = maneM; m2.parent = PONY.body;
    }
    const fringe = sphere("pfringe", 0.2, 8);
    fringe.position.set(0.05, 0.26, 0); fringe.material = maneM; fringe.parent = PONY.head;
    // しっぽ
    PONY.tail = new BABYLON.TransformNode("ptailN", scene);
    PONY.tail.parent = PONY.body; PONY.tail.position.set(-0.72, 0.95, 0);
    const tail1 = sphere("ptail1", 0.24, 8); tail1.position.y = -0.15;
    const tail2 = sphere("ptail2", 0.18, 8); tail2.position.y = -0.38;
    tail1.material = tail2.material = maneM;
    tail1.parent = tail2.parent = PONY.tail;
    // あし
    PONY.legs = [];
    [[0.45, 0.28], [0.45, -0.28], [-0.45, 0.28], [-0.45, -0.28]].forEach(([x, z], i) => {
      const legN = new BABYLON.TransformNode("plegN" + i, scene);
      legN.parent = PONY.body; legN.position.set(x, 0.62, z);
      const leg = BABYLON.MeshBuilder.CreateCylinder("pleg" + i, { height: 0.6, diameter: 0.17 }, scene);
      leg.position.y = -0.3; leg.material = coatM; leg.parent = legN;
      const hoof = sphere("phoof" + i, 0.19, 6);
      hoof.position.y = -0.6; hoof.scaling.y = 0.6;
      hoof.material = mat("hoofM", "#d8a8c8"); hoof.parent = legN;
      PONY.legs.push(legN);
    });
    // くら(サドル)
    const saddle = sphere("saddle", 0.55, 10);
    saddle.scaling.set(0.9, 0.35, 1.0);
    saddle.position.y = 1.22;
    saddle.material = mat("saddleM", "#ff6f9f", { emissive: "#3a0f1e" });
    saddle.parent = PONY.body;

    world.shadowGen.addShadowCaster(body);
    PONY.blob = makeBlobShadow("ponyBlob", 1.7);
    PONY.blob.parent = PONY.root;
    PONY.state = "idle";
    PONY.time = 0;
  }

  /* ============================================================
   * アニメーション更新
   * ============================================================ */
  function setState(s) {
    P.state = s;
    P.stateTime = 0;
  }

  function walkTo(target, cb) {
    P.walkTarget = target.clone();
    P.walkCb = cb || null;
    setState("walk");
  }

  function faceTowards(point) {
    const dx = point.x - P.root.position.x;
    const dz = point.z - P.root.position.z;
    P.faceTarget = Math.atan2(dx, dz);
  }

  function lerpAngle(a, b, k) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * k;
  }

  function update(dt) {
    P.time += dt;
    P.stateTime += dt;
    const t = P.time;

    // まばたき
    P.blinkT -= dt;
    if (P.blinkT < 0) P.blinkT = 2.2 + Math.random() * 3;
    const blink = P.blinkT < 0.12 ? 0.12 : 1;
    P.eyes.forEach(e => e.scaling.y = 1.25 * blink);

    // 向きの補間
    if (P.faceTarget !== null) {
      P.root.rotation.y = lerpAngle(P.root.rotation.y, P.faceTarget, Math.min(1, dt * 9));
    }

    // ふわふわ髪
    if (P.tails) P.tails.forEach((tl, i) => {
      tl.rotation.x = (tl.rotation.x || 0) * 0 + Math.sin(t * 2.4 + i * 2) * 0.09 - (tl.name === "ponyT" ? 0.5 : 0);
    });
    if (P.wings && P.wingsFlap) {
      P.wings.forEach(w => w.mesh.rotation.y = w.s * (0.7 + Math.sin(t * 7) * 0.35));
    }
    if (P.halo) P.halo.rotation.y += dt * 1.5;

    const S = P.state;
    if (P.blob) P.blob.isVisible = S !== "ride"; // ポニーに乗っている間は自分の影を消す
    if (S === "idle") {
      P.body.position.y = Math.sin(t * 2.2) * 0.025;
      P.armL.rotation.z = -0.35 + Math.sin(t * 2.2) * 0.05;
      P.armR.rotation.z = 0.35 - Math.sin(t * 2.2) * 0.05;
      P.armL.rotation.x = 0; P.armR.rotation.x = 0;
      P.head.rotation.z = Math.sin(t * 0.7) * 0.05;
      P.head.rotation.x = 0;
      if (P.skirt) { P.skirt.scaling.set(1, 1, 1); P.skirt.rotation.y = 0; }
    } else if (S === "walk") {
      const target = P.walkTarget;
      const pos = P.root.position;
      const dx = target.x - pos.x, dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const speed = 2.6;
      if (dist < 0.12) {
        setState("idle");
        const cb = P.walkCb; P.walkCb = null;
        if (cb) cb();
      } else {
        const step = Math.min(dist, speed * dt);
        pos.x += dx / dist * step;
        pos.z += dz / dist * step;
        P.faceTarget = Math.atan2(dx, dz);
        const w = t * 11;
        P.body.position.y = Math.abs(Math.sin(w)) * 0.07;
        P.armL.rotation.x = Math.sin(w) * 0.7;
        P.armR.rotation.x = -Math.sin(w) * 0.7;
        P.armL.rotation.z = -0.25; P.armR.rotation.z = 0.25;
        P.shoeL.position.z = 0.04 + Math.sin(w) * 0.12;
        P.shoeR.position.z = 0.04 - Math.sin(w) * 0.12;
        P.shoeL.position.y = 0.07 + Math.max(0, Math.sin(w)) * 0.08;
        P.shoeR.position.y = 0.07 + Math.max(0, -Math.sin(w)) * 0.08;
        if (P.skirt) P.skirt.rotation.z = Math.sin(w) * 0.04;
      }
    } else if (S === "twirl" || S === "ball") {
      const spin = S === "ball" ? 2.6 : 4.2;
      P.root.rotation.y += dt * spin;
      P.faceTarget = null;
      P.body.position.y = Math.abs(Math.sin(t * 6)) * 0.06;
      P.armL.rotation.z = -1.1 - Math.sin(t * 3) * 0.25;
      P.armR.rotation.z = 1.1 + Math.sin(t * 3) * 0.25;
      P.armL.rotation.x = P.armR.rotation.x = -0.3;
      if (P.skirt) {
        const flare = 1 + Math.min(0.35, P.stateTime * 0.6);
        P.skirt.scaling.set(flare, 1, flare);
      }
      P.head.rotation.z = Math.sin(t * 3) * 0.08;
    } else if (S === "tea") {
      // もぐもぐ
      P.body.position.y = Math.sin(t * 5) * 0.02;
      P.armR.rotation.x = -1.4 + Math.sin(t * 6) * 0.35;
      P.armR.rotation.z = 0.15;
      P.armL.rotation.z = -0.3;
      P.head.rotation.x = 0.12 + Math.sin(t * 6) * 0.06;
    } else if (S === "art") {
      // ふでをうごかす
      P.armR.rotation.x = -1.2 + Math.sin(t * 7) * 0.5;
      P.armR.rotation.z = 0.3 + Math.cos(t * 4.5) * 0.25;
      P.armL.rotation.z = -0.35;
      P.head.rotation.z = Math.sin(t * 2) * 0.1;
      P.body.position.y = Math.sin(t * 2.5) * 0.02;
    } else if (S === "magic") {
      // りょうてを上げてまほう
      P.armL.rotation.z = -2.4 + Math.sin(t * 5) * 0.3;
      P.armR.rotation.z = 2.4 - Math.sin(t * 5 + 1) * 0.3;
      P.armL.rotation.x = P.armR.rotation.x = -0.4;
      P.body.position.y = Math.sin(t * 4) * 0.05;
      P.head.rotation.x = -0.15;
    } else if (S === "plant") {
      // しゃがんでお花を植える
      const k = Math.min(1, P.stateTime * 3);
      P.body.position.y = -0.28 * Math.sin(k * Math.PI * 0.5) + Math.sin(t * 4) * 0.015;
      P.armR.rotation.x = -1.0 + Math.sin(t * 5) * 0.4;
      P.armL.rotation.x = -0.8 + Math.cos(t * 5) * 0.3;
      P.armL.rotation.z = -0.2; P.armR.rotation.z = 0.2;
      P.head.rotation.x = 0.35;
    } else if (S === "ride") {
      // ポニーの上(あしをまえに)
      P.body.position.y = 0;
      P.armL.rotation.z = -0.5; P.armR.rotation.z = 0.5;
      P.armL.rotation.x = P.armR.rotation.x = -0.6;
      P.head.rotation.x = 0;
      P.shoeL.position.z = 0.16; P.shoeR.position.z = 0.16;
    } else if (S === "celebrate") {
      const hop = Math.abs(Math.sin(P.stateTime * 7));
      P.body.position.y = hop * 0.22;
      P.armL.rotation.z = -2.6 + Math.sin(t * 9) * 0.25;
      P.armR.rotation.z = 2.6 - Math.sin(t * 9) * 0.25;
      P.head.rotation.z = Math.sin(t * 5) * 0.1;
    } else if (S === "wave") {
      P.body.position.y = Math.sin(t * 2.2) * 0.025;
      P.armR.rotation.z = 2.6 + Math.sin(t * 8) * 0.4;
      P.armL.rotation.z = -0.35;
    }

    updatePony(dt);
  }

  function updatePony(dt) {
    PONY.time += dt;
    const t = PONY.time;
    if (PONY.state === "idle") {
      PONY.body.position.y = Math.sin(t * 1.8) * 0.03;
      PONY.head.rotation.z = Math.sin(t * 0.9) * 0.12;
      PONY.tail.rotation.x = Math.sin(t * 2.6) * 0.35;
      PONY.legs.forEach(l => l.rotation.x = 0);
    } else if (PONY.state === "trot") {
      const w = t * 10;
      PONY.body.position.y = Math.abs(Math.sin(w)) * 0.06;
      PONY.legs.forEach((l, i) => l.rotation.x = Math.sin(w + (i % 2) * Math.PI) * 0.55);
      PONY.tail.rotation.x = Math.sin(t * 5) * 0.3;
      PONY.head.rotation.z = Math.sin(w * 0.5) * 0.08;
    }
  }

  /* ---------- 公開 ---------- */
  function build(s, w) {
    scene = s; world = w;
    buildPrincess();
    buildPony();
    return api;
  }

  const api = {
    build, update, walkTo, setState, faceTowards, applyOutfit, applyLevel,
    get root() { return P.root; },
    get state() { return P.state; },
    get pony() { return PONY; },
    headWorldPos() {
      const s = P.root.scaling.y;
      return P.root.position.add(V3(0, 1.85 * s, 0));
    },
    catalogs: { DRESSES, HAIRS, HAIR_COLORS, CROWNS }
  };
  return api;
})();
