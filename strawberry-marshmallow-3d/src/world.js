/* =========================================================
 * いちごましゅまろのおか — world.js
 * 丘の地形・池・木・花畑・いちごのおうち・風車・気球・にじ
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  const POND = { x: -21, z: -15, r: 10 };
  const WATER_Y = -0.5;
  IM.POND = POND;

  // ---- 地形の高さ（解析関数: レイキャスト不要で物を置ける） ----
  IM.groundHeight = function (x, z) {
    let h =
      2.4 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.7) +
      1.2 * Math.sin(x * 0.11 + 0.4) * Math.sin(z * 0.093 + 2.1) +
      0.45 * Math.sin(x * 0.23 + 3.0) * Math.cos(z * 0.2 + 1.0);
    const d = Math.sqrt(x * x + z * z);
    h *= IM.smoothstep(6, 42, d) * 0.85 + 0.15; // 中央はなだらかな広場
    const px = x - POND.x, pz = z - POND.z;
    const pd2 = px * px + pz * pz;
    h -= 2.6 * Math.exp(-pd2 / (POND.r * POND.r * 0.55)); // 池のくぼみ
    return h;
  };

  function World(scene) {
    this.scene = scene;
    this.time = 0;
    this.windmillBlades = null;
    this.balloons = [];
    this.lanterns = [];
    this.windowMats = [];
    this.berrySpots = [];
    this.interactables = []; // タップ判定用（game 側が使う）

    this._buildTerrain();
    this._buildWater();
    this._buildMountains();
    this._buildTrees();
    this._buildFlowers();
    this._buildGrassTufts();
    this._buildHouse();
    this._buildWindmill();
    this._buildFence();
    this._buildBerryBushes();
    this._buildHotAirBalloons();
    this._buildLanterns();
    this._buildRainbow();
    this._buildPath();
  }

  // ---------- 地形 ----------
  World.prototype._buildTerrain = function () {
    const SIZE = 460, SEG = 150;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color(0x7ecb69);   // ふもとのみどり
    const cHigh = new THREE.Color(0xb2e693);  // 丘のうえの黄みどり
    const cSand = new THREE.Color(0xf2e3b3);  // 池のまわりの砂
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = IM.groundHeight(x, z);
      pos.setY(i, h);
      // 高さで緑のグラデーション + ちょっとしたムラ
      const t = IM.clamp((h + 1.2) / 4.5, 0, 1);
      tmp.copy(cLow).lerp(cHigh, t);
      const n = (Math.sin(x * 0.8 + z * 1.1) + Math.sin(x * 0.31 - z * 0.62)) * 0.02;
      tmp.offsetHSL(0, 0, n);
      // 池のふちは砂色に
      const pd = Math.sqrt((x - POND.x) ** 2 + (z - POND.z) ** 2);
      const sand = 1 - IM.smoothstep(POND.r * 0.72, POND.r * 1.25, pd);
      tmp.lerp(cSand, sand);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = IM.toon(0xffffff, { vertexColors: true });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.ground.name = 'ground';
    this.scene.add(this.ground);
  };

  // ---------- 池（シェーダー水面） ----------
  World.prototype._buildWater = function () {
    this.waterUniforms = {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(0x9fdff0) },
      uDeep: { value: new THREE.Color(0x4aa8d8) },
      uNight: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: this.waterUniforms,
      vertexShader: [
        'varying vec2 vUv; varying vec3 vPos;',
        'uniform float uTime;',
        'void main(){',
        '  vUv = uv;',
        '  vec3 p = position;',
        '  p.y += sin(p.x*1.3 + uTime*1.7)*0.05 + cos(p.z*1.6 + uTime*1.3)*0.05;',
        '  vPos = p;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec2 vUv; varying vec3 vPos;',
        'uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uNight;',
        'void main(){',
        '  vec2 c = vUv - 0.5;',
        '  float d = length(c) * 2.0;',
        '  vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 1.0, d));',
        // ゆらめく波紋
        '  float rip = sin(d*22.0 - uTime*2.2) * 0.5 + 0.5;',
        '  rip *= smoothstep(1.0, 0.55, d) * 0.25;',
        '  col += rip * vec3(0.55,0.7,0.75);',
        // キラキラ
        '  float sp = sin(vPos.x*9.0+uTime*3.0)*sin(vPos.z*11.0-uTime*2.4);',
        '  sp = smoothstep(0.93, 1.0, sp);',
        '  col += sp * vec3(1.0);',
        // 夜は月色に
        '  col = mix(col, col * vec3(0.35,0.42,0.7) + vec3(0.05,0.07,0.18), uNight);',
        '  float alpha = 0.82 * smoothstep(1.02, 0.92, d);',
        '  gl_FragColor = vec4(col, alpha);',
        '}',
      ].join('\n'),
    });
    const geo = new THREE.CircleGeometry(POND.r * 1.15, 48);
    geo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.set(POND.x, WATER_Y, POND.z);
    this.scene.add(this.water);

    // すいれんの葉とお花
    const padMat = IM.toon(0x4fae5c);
    const lotusMat = IM.toon(0xffb3cf);
    for (let i = 0; i < 6; i++) {
      const a = IM.rand(0, IM.TAU), r = IM.rand(2.5, POND.r * 0.8);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(IM.rand(0.7, 1.2), IM.rand(0.7, 1.2), 0.08, 12), padMat);
      pad.position.set(POND.x + Math.cos(a) * r, WATER_Y + 0.06, POND.z + Math.sin(a) * r);
      pad.userData.bob = IM.rand(0, IM.TAU);
      this.scene.add(pad);
      this.lilyPads = this.lilyPads || [];
      this.lilyPads.push(pad);
      if (i % 2 === 0) {
        const flower = new THREE.Group();
        for (let p = 0; p < 6; p++) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lotusMat);
          const pa = (p / 6) * IM.TAU;
          petal.position.set(Math.cos(pa) * 0.24, 0.12, Math.sin(pa) * 0.24);
          petal.scale.set(1, 0.7, 0.55);
          petal.rotation.y = -pa;
          flower.add(petal);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), IM.toon(0xffe066));
        core.position.y = 0.16;
        flower.add(core);
        pad.add(flower);
      }
    }
  };

  // ---------- 遠くの山なみ ----------
  World.prototype._buildMountains = function () {
    const mats = [IM.toon(0x8fc9e8), IM.toon(0xa9d8ef), IM.toon(0x7db8de)];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * IM.TAU + IM.rand(-0.1, 0.1);
      const r = IM.rand(190, 250);
      const h = IM.rand(38, 85);
      const m = new THREE.Mesh(new THREE.ConeGeometry(IM.rand(40, 75), h, 7), IM.pick(mats));
      m.position.set(Math.cos(a) * r, h * 0.32 - 6, Math.sin(a) * r);
      m.rotation.y = IM.rand(0, IM.TAU);
      this.scene.add(m);
      // 雪の帽子
      if (Math.random() < 0.5) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 7), IM.toon(0xffffff));
        const s = IM.rand(0.28, 0.38);
        cap.scale.set(m.geometry.parameters.radius * s, h * s, m.geometry.parameters.radius * s);
        cap.position.y = h * (0.5 - s * 0.5) + 0.3;
        m.add(cap);
      }
    }
  };

  // ---------- 木（ふわふわの木・さくらの木） ----------
  World.prototype._buildTrees = function () {
    const trunkMat = IM.toon(0x9c6b4a);
    const leafMats = [IM.toon(0x63bd63), IM.toon(0x7ed07a), IM.toon(0x55b06b)];
    const sakuraMat = IM.toon(0xffc2d9);
    this.sakuraTrees = [];

    const spots = [];
    for (let i = 0; i < 34; i++) {
      let x, z, ok = false, tries = 0;
      while (!ok && tries++ < 30) {
        x = IM.rand(-95, 95); z = IM.rand(-95, 95);
        const d = Math.hypot(x, z);
        const pd = Math.hypot(x - POND.x, z - POND.z);
        ok = d > 16 && d < 95 && pd > POND.r + 4 &&
          spots.every((s) => Math.hypot(s[0] - x, s[1] - z) > 9);
      }
      if (!ok) continue;
      spots.push([x, z]);

      const isSakura = Math.random() < 0.35;
      const tree = new THREE.Group();
      const th = IM.rand(2.2, 3.6);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, th, 8), trunkMat);
      trunk.position.y = th / 2;
      tree.add(trunk);
      const leafMat = isSakura ? sakuraMat : IM.pick(leafMats);
      const puffs = IM.randInt(3, 5);
      for (let p = 0; p < puffs; p++) {
        const r = IM.rand(1.3, 2.3);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMat);
        leaf.position.set(IM.rand(-1.2, 1.2), th + IM.rand(0.2, 1.8), IM.rand(-1.2, 1.2));
        tree.add(leaf);
      }
      IM.placeOnGround(tree, x, z, -0.1);
      tree.rotation.y = IM.rand(0, IM.TAU);
      IM.setShadow(tree, true, false);
      this.scene.add(tree);
      if (isSakura) this.sakuraTrees.push(tree);
    }
  };

  // ---------- 花畑（インスタンス描画） ----------
  World.prototype._buildFlowers = function () {
    const N = 520;
    const petalColors = [0xff8fb3, 0xffd166, 0xffffff, 0xffa8d8, 0xc3a8ff, 0xff6b8f];

    const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
    headGeo.scale(1, 0.55, 1);
    const headMat = IM.toon(0xffffff);
    const heads = new THREE.InstancedMesh(headGeo, headMat, N);

    const stemGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5);
    const stemMat = IM.toon(0x58a84f);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, N);

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < N && guard++ < N * 8) {
      const a = IM.rand(0, IM.TAU);
      const r = Math.sqrt(Math.random()) * 88 + 4;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (pd < POND.r + 2.5) continue;
      const y = IM.groundHeight(x, z);
      const s = IM.rand(0.7, 1.5);
      dummy.position.set(x, y + 0.28 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.set(IM.rand(-0.15, 0.15), IM.rand(0, IM.TAU), IM.rand(-0.15, 0.15));
      dummy.updateMatrix();
      heads.setMatrixAt(placed, dummy.matrix);
      heads.setColorAt(placed, col.setHex(IM.pick(petalColors)));
      dummy.position.y = y + 0.14 * s;
      dummy.updateMatrix();
      stems.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    heads.count = placed;
    stems.count = placed;
    heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    this.scene.add(heads);
    this.scene.add(stems);
  };

  // ---------- 草のふさふさ ----------
  World.prototype._buildGrassTufts = function () {
    const N = 700;
    const geo = new THREE.ConeGeometry(0.16, 0.7, 4);
    const mat = IM.toon(0x6cc55e);
    const tufts = new THREE.InstancedMesh(geo, mat, N);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < N && guard++ < N * 8) {
      const a = IM.rand(0, IM.TAU);
      const r = Math.sqrt(Math.random()) * 95 + 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5) continue;
      const s = IM.rand(0.6, 1.6);
      dummy.position.set(x, IM.groundHeight(x, z) + 0.3 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.y = IM.rand(0, IM.TAU);
      dummy.rotation.x = IM.rand(-0.12, 0.12);
      dummy.updateMatrix();
      tufts.setMatrixAt(placed, dummy.matrix);
      col.setHSL(0.29 + IM.rand(-0.03, 0.03), 0.55, IM.rand(0.42, 0.55));
      tufts.setColorAt(placed, col);
      placed++;
    }
    tufts.count = placed;
    tufts.instanceMatrix.needsUpdate = true;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
    this.scene.add(tufts);
  };

  // ---------- いちごのおうち ----------
  World.prototype._buildHouse = function () {
    const g = new THREE.Group();
    const H = 3.4, R = 2.9;

    // 壁（クリーム色の円筒）
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.06, H, 20), IM.toon(0xfff3dd));
    wall.position.y = H / 2;
    g.add(wall);

    // いちご屋根
    const roof = new THREE.Mesh(new THREE.SphereGeometry(R * 1.35, 20, 16), IM.toon(0xff5d73));
    roof.position.y = H + 0.6;
    roof.scale.set(1, 1.15, 1);
    g.add(roof);
    // たね
    const seedMat = IM.toon(0xfff2a8);
    for (let i = 0; i < 22; i++) {
      const a = IM.rand(0, IM.TAU);
      const v = IM.rand(0.15, 0.75) * Math.PI;
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), seedMat);
      const rr = R * 1.35;
      seed.position.set(
        Math.sin(v) * Math.cos(a) * rr,
        Math.cos(v) * rr * 1.15 + H + 0.6,
        Math.sin(v) * Math.sin(a) * rr
      );
      seed.scale.set(1, 1.6, 0.6);
      g.add(seed);
    }
    // へた（葉っぱの冠）
    const leafMat = IM.toon(0x4fae5c);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * IM.TAU;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), leafMat);
      leaf.position.set(Math.cos(a) * 1.1, H + 0.6 + R * 1.35 * 1.02, Math.sin(a) * 1.1);
      leaf.scale.set(1, 0.35, 0.55);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.35;
      g.add(leaf);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.9, 8), leafMat);
    stem.position.y = H + 0.6 + R * 1.35 * 1.12;
    g.add(stem);

    // ドア
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 14, 1, false, 0, Math.PI), IM.toon(0xb5714f));
    door.rotation.x = Math.PI / 2;
    door.rotation.y = Math.PI / 2;
    door.position.set(0, 0.95, R - 0.02);
    door.scale.set(1, 1, 1.6);
    g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), IM.toon(0xffe066));
    knob.position.set(0.5, 1.0, R + 0.16);
    g.add(knob);

    // まど（夜は明かりが灯る）
    for (const wa of [Math.PI * 0.35, -Math.PI * 0.35, Math.PI]) {
      const winMat = new THREE.MeshToonMaterial({
        color: 0xbfe8ff, gradientMap: IM.getGradientMap(),
        emissive: 0xffdf9e, emissiveIntensity: 0,
      });
      this.windowMats.push(winMat);
      const win = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), winMat);
      win.position.set(Math.sin(wa) * R, 2.0, Math.cos(wa) * R);
      win.scale.set(1, 1, 0.35);
      win.lookAt(win.position.x * 2, 2.0, win.position.z * 2);
      g.add(win);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 16), IM.toon(0xffffff));
      frame.position.copy(win.position).multiplyScalar(1.02);
      frame.position.y = 2.0;
      frame.lookAt(win.position.x * 2, 2.0, win.position.z * 2);
      g.add(frame);
    }

    IM.placeOnGround(g, 16, -20, -0.15);
    g.rotation.y = -2.2;
    IM.setShadow(g, true, false);
    this.scene.add(g);
    this.house = g;
  };

  // ---------- 風車 ----------
  World.prototype._buildWindmill = function () {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.9, 7.5, 12), IM.toon(0xfde8e8));
    tower.position.y = 3.75;
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 12), IM.toon(0xff8fb3));
    cap.position.y = 8.2;
    g.add(cap);

    const blades = new THREE.Group();
    const bladeMat = IM.toon(0xffffff);
    const bladeEdge = IM.toon(0xffc2d9);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group();
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.4, 0.12), bladeMat);
      plank.position.y = 2.4;
      blade.add(plank);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.14), bladeEdge);
      tip.position.y = 4.2;
      blade.add(tip);
      blade.rotation.z = (i / 4) * IM.TAU;
      blades.add(blade);
    }
    blades.position.set(0, 7.4, 1.6);
    g.add(blades);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), IM.toon(0xffe066));
    hub.position.set(0, 7.4, 1.75);
    g.add(hub);

    IM.placeOnGround(g, -32, 22, -0.2);
    g.rotation.y = 2.4;
    IM.setShadow(g, true, false);
    this.scene.add(g);
    this.windmillBlades = blades;
  };

  // ---------- 白いさく ----------
  World.prototype._buildFence = function () {
    const mat = IM.toon(0xffffff);
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6);
    const railGeo = new THREE.BoxGeometry(1.9, 0.1, 0.06);
    // 広場をゆるく囲む2つの弧
    const arcs = [
      { a0: 0.5, a1: 1.7, r: 30 },
      { a0: 3.2, a1: 4.3, r: 33 },
    ];
    for (const arc of arcs) {
      const n = Math.round((arc.a1 - arc.a0) * arc.r / 2);
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const a = IM.lerp(arc.a0, arc.a1, i / n);
        const x = Math.cos(a) * arc.r, z = Math.sin(a) * arc.r;
        const post = new THREE.Mesh(postGeo, mat);
        IM.placeOnGround(post, x, z, 0.42);
        post.castShadow = true;
        this.scene.add(post);
        if (prev) {
          const rail = new THREE.Mesh(railGeo, mat);
          rail.position.lerpVectors(prev.position, post.position, 0.5);
          rail.position.y += 0.18;
          rail.lookAt(post.position.x, rail.position.y, post.position.z);
          rail.rotateY(Math.PI / 2);
          rail.scale.x = prev.position.distanceTo(post.position) / 1.9;
          this.scene.add(rail);
        }
        prev = post;
      }
    }
  };

  // ---------- いちごの茂み（スポーン地点の目印） ----------
  World.prototype._buildBerryBushes = function () {
    const bushMat = IM.toon(0x4d9e4d);
    const bushMat2 = IM.toon(0x5cb85c);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * IM.TAU + IM.rand(-0.2, 0.2);
      const r = IM.rand(7, 26);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3) continue;
      const bush = new THREE.Group();
      for (let p = 0; p < 3; p++) {
        const s = IM.rand(0.5, 0.8);
        const b = new THREE.Mesh(new THREE.SphereGeometry(s, 9, 7), p % 2 ? bushMat : bushMat2);
        b.position.set(IM.rand(-0.5, 0.5), s * 0.5, IM.rand(-0.5, 0.5));
        b.scale.y = 0.75;
        bush.add(b);
      }
      IM.placeOnGround(bush, x, z, 0);
      IM.setShadow(bush, true, false);
      this.scene.add(bush);
      this.berrySpots.push(new THREE.Vector3(x, IM.groundHeight(x, z), z));
    }
  };

  // ---------- いちご気球 ----------
  World.prototype._buildHotAirBalloons = function () {
    const stripes = document.createElement('canvas');
    stripes.width = 128; stripes.height = 32;
    const g2 = stripes.getContext('2d');
    const cols = ['#ff6b8f', '#fff4f6', '#ffd166', '#fff4f6'];
    for (let i = 0; i < 16; i++) {
      g2.fillStyle = cols[i % cols.length];
      g2.fillRect(i * 8, 0, 8, 32);
    }
    const tex = new THREE.CanvasTexture(stripes);

    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const env = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 18, 14),
        new THREE.MeshToonMaterial({ map: tex, gradientMap: IM.getGradientMap() })
      );
      env.scale.y = 1.18;
      b.add(env);
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.75, 0.9, 8), IM.toon(0xb5824f));
      basket.position.y = -5.1;
      b.add(basket);
      const ropeMat = new THREE.LineBasicMaterial({ color: 0x8a6a4a });
      for (let r = 0; r < 4; r++) {
        const a = (r / 4) * IM.TAU + 0.4;
        const pts = [
          new THREE.Vector3(Math.cos(a) * 2.2, -2.6, Math.sin(a) * 2.2),
          new THREE.Vector3(Math.cos(a) * 0.7, -4.7, Math.sin(a) * 0.7),
        ];
        b.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));
      }
      b.userData = {
        angle: IM.rand(0, IM.TAU),
        radius: IM.rand(55, 90),
        height: IM.rand(26, 44),
        speed: IM.rand(0.018, 0.032) * (i % 2 ? 1 : -1),
        bob: IM.rand(0, IM.TAU),
      };
      this.balloons.push(b);
      this.scene.add(b);
    }
  };

  // ---------- きのこランプ（夜に光る） ----------
  World.prototype._buildLanterns = function () {
    const spots = [[8, 8], [-9, 6], [6, -10], [-6, -7], [18, -12], [-16, 10]];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.8, 8), IM.toon(0xfff3dd));
      stem.position.y = 0.4;
      g.add(stem);
      const capMat = new THREE.MeshToonMaterial({
        color: 0xff8fb3, gradientMap: IM.getGradientMap(),
        emissive: 0xffb3c8, emissiveIntensity: 0,
      });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10, 0, IM.TAU, 0, Math.PI * 0.55), capMat);
      cap.position.y = 0.75;
      g.add(cap);
      // 白い水玉
      for (let d = 0; d < 4; d++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), IM.toon(0xffffff));
        const a = IM.rand(0, IM.TAU), v = IM.rand(0.15, 0.45) * Math.PI;
        dot.position.set(Math.sin(v) * Math.cos(a) * 0.55, 0.75 + Math.cos(v) * 0.55, Math.sin(v) * Math.sin(a) * 0.55);
        g.add(dot);
      }
      let light = null;
      if (i < 4) { // ライト数は控えめに（パフォーマンス）
        light = new THREE.PointLight(0xffc9d8, 0, 9, 2);
        light.position.y = 1.0;
        g.add(light);
      }
      IM.placeOnGround(g, x, z, 0);
      IM.setShadow(g, true, false);
      this.scene.add(g);
      this.lanterns.push({ group: g, capMat, light, phase: IM.rand(0, IM.TAU) });
    }
  };

  // ---------- にじ（お祝いで登場） ----------
  World.prototype._buildRainbow = function () {
    const cols = [0xff5d73, 0xff9e5c, 0xffd166, 0x7ed07a, 0x5cc8e8, 0x7a8fe8, 0xc38fe8];
    this.rainbow = new THREE.Group();
    this.rainbowMats = [];
    for (let i = 0; i < cols.length; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0, side: THREE.DoubleSide });
      this.rainbowMats.push(mat);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 1.1, 0.55, 6, 60, Math.PI), mat);
      this.rainbow.add(arc);
    }
    this.rainbow.position.set(0, 0.5, -42);
    this.rainbow.visible = false;
    this.scene.add(this.rainbow);
    this.rainbowAlpha = 0;
    this.rainbowTarget = 0;
  };

  World.prototype.showRainbow = function (seconds) {
    this.rainbowTarget = 0.85;
    this.rainbow.visible = true;
    clearTimeout(this._rainbowTimer);
    this._rainbowTimer = setTimeout(() => { this.rainbowTarget = 0; }, (seconds || 10) * 1000);
  };

  // ---------- とびいし の こみち ----------
  World.prototype._buildPath = function () {
    const mat = IM.toon(0xf5ead2);
    const from = new THREE.Vector2(2, 2);
    const to = new THREE.Vector2(14, -17);
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = IM.lerp(from.x, to.x, t) + Math.sin(t * 6) * 1.2;
      const z = IM.lerp(from.y, to.y, t) + Math.cos(t * 5) * 1.2;
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(IM.rand(0.55, 0.8), IM.rand(0.6, 0.85), 0.18, 9), mat);
      IM.placeOnGround(stone, x, z, 0.06);
      stone.receiveShadow = true;
      this.scene.add(stone);
    }
  };

  // ---------- 毎フレーム更新 ----------
  World.prototype.update = function (dt, time, night01) {
    this.time = time;
    // 風車
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.8;
    // 水
    this.waterUniforms.uTime.value = time;
    this.waterUniforms.uNight.value = night01;
    // すいれん
    if (this.lilyPads) {
      for (const pad of this.lilyPads) {
        pad.position.y = -0.44 + Math.sin(time * 1.2 + pad.userData.bob) * 0.05;
        pad.rotation.y += dt * 0.05;
      }
    }
    // 気球
    for (const b of this.balloons) {
      const u = b.userData;
      u.angle += u.speed * dt;
      b.position.set(
        Math.cos(u.angle) * u.radius,
        u.height + Math.sin(time * 0.35 + u.bob) * 2.2,
        Math.sin(u.angle) * u.radius
      );
      b.rotation.y = -u.angle;
    }
    // ランプ（夜だけ、ゆらゆら光る）
    const lamp = IM.smoothstep(0.25, 0.8, night01);
    for (const l of this.lanterns) {
      const flicker = 0.85 + 0.15 * Math.sin(time * 3 + l.phase);
      l.capMat.emissiveIntensity = lamp * 1.4 * flicker;
      if (l.light) l.light.intensity = lamp * 1.1 * flicker;
    }
    // おうちの窓明かり
    for (const w of this.windowMats) w.emissiveIntensity = lamp * 1.2;
    // にじのフェード
    this.rainbowAlpha = IM.lerp(this.rainbowAlpha, this.rainbowTarget, dt * 1.5);
    if (this.rainbow.visible) {
      for (const m of this.rainbowMats) m.opacity = this.rainbowAlpha;
      if (this.rainbowAlpha < 0.01 && this.rainbowTarget === 0) this.rainbow.visible = false;
    }
  };

  IM.World = World;
})();
