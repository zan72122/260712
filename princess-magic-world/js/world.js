// ============================================================
// ワールド — 地形・お城・池と噴水・桜の木・お花畑・虹・クリスタル
// ============================================================
import * as THREE from 'three';
import { rand, pick, fbm, clamp, makeCanvasTexture } from './utils.js';

const POND = { x: 13, z: 3, r: 6.8 };
const CASTLE = { x: 0, z: -21 };
const WATER_Y = -0.4;

// ---------------- 水面シェーダー ----------------
const WATER_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(p.x * 2.4 + uTime * 1.6) * 0.035 + cos(p.y * 2.1 - uTime * 1.2) * 0.035;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform float uSparkle;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float swirl = sin(vUv.x * 9.0 + uTime * 0.7) * sin(vUv.y * 8.0 - uTime * 0.55);
    vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 1.0, r + swirl * 0.12));

    // ゆらめく光の網目（なんちゃってコースティクス）
    float c1 = sin(vUv.x * 42.0 + uTime * 1.5) * sin(vUv.y * 38.0 - uTime * 1.15);
    float c2 = sin((vUv.x + vUv.y) * 30.0 - uTime * 1.3) * sin((vUv.x - vUv.y) * 26.0 + uTime * 0.9);
    float caustic = smoothstep(0.55, 1.0, c1 * 0.5 + 0.5) * smoothstep(0.45, 1.0, c2 * 0.5 + 0.5);
    col += vec3(1.0, 1.0, 0.95) * caustic * uSparkle;

    float edge = smoothstep(1.0, 0.86, r);
    gl_FragColor = vec4(col, 0.9 * edge + 0.1);
  }
`;

export class World {
  constructor(ctx) {
    this.ctx = ctx;
    this.colliders = [];
    this.sakura = [];      // 花びらを散らす桜の位置
    this.windowMats = [];  // 夜に光るお城の窓
    this.flags = [];       // はためく旗
    this.crystals = [];    // 光るクリスタル
    this.heroFlowers = []; // ゆれるお花
    this.time = 0;

    this._buildTerrain();
    this._buildWater();
    this._buildCastle();
    this._buildTreesAndFlora();
    this._buildRainbow();
    this._buildPathAndArch();
    this._buildFountain();
    this._buildFireflies();
    this._buildDust();
  }

  // 地形の高さ（中央は平らな遊び場、外周は丘）
  heightAt(x, z) {
    const d = Math.sqrt(x * x + z * z);
    const edge = THREE.MathUtils.smoothstep(d, 24, 38);
    const hills = (fbm(x * 0.045 + 7, z * 0.045 + 3) - 0.5) * 2;
    let h = edge * (2.4 + hills * 2.8);
    h += THREE.MathUtils.smoothstep(d, 40, 70) * (fbm(x * 0.03 + 2, z * 0.03 + 9) - 0.45) * 7;
    if (h < -0.4) h = -0.4;
    const pd = Math.hypot(x - POND.x, z - POND.z);
    h -= THREE.MathUtils.smoothstep(POND.r - pd, 0, 3.6) * 1.15;
    return h;
  }

  _buildTerrain() {
    const size = 150, seg = 110;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const grassA = new THREE.Color(0x6ecb72);
    const grassB = new THREE.Color(0x49a95e);
    const grassLight = new THREE.Color(0x9fe08a);
    const sand = new THREE.Color(0xf0d9a8);
    const pathC = new THREE.Color(0xf3ddb2);
    const underwater = new THREE.Color(0x3e8a8f);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);

      // ベースの草はらい 2色ノイズミックス + 明るい斑
      const n = fbm(x * 0.12 + 31, z * 0.12 + 17);
      tmp.copy(grassA).lerp(grassB, clamp(n * 1.4 - 0.2, 0, 1));
      const patch = fbm(x * 0.3 + 5, z * 0.3 + 55);
      if (patch > 0.62) tmp.lerp(grassLight, (patch - 0.62) * 2.2);

      // 小道（じゅうたんのような桜色の道）
      let path = 0;
      if (z > -14.5 && z < 11) {
        path = THREE.MathUtils.smoothstep(2.3 - Math.abs(x), 0, 1.3)
          * THREE.MathUtils.smoothstep(z + 14.5, 0, 2) * THREE.MathUtils.smoothstep(11 - z, 0, 2);
      }
      // お城前の広場
      const plaza = THREE.MathUtils.smoothstep(5.2 - Math.hypot(x, z + 13.5), 0, 2.4);
      path = Math.max(path, plaza);
      if (path > 0) tmp.lerp(pathC, path * 0.9);

      // 池のまわりは砂浜、水の中は深い色
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (pd < POND.r + 2.2) {
        const sandT = THREE.MathUtils.smoothstep(POND.r + 2.2 - pd, 0, 1.6);
        tmp.lerp(sand, sandT * 0.85);
        if (pd < POND.r - 0.5) {
          tmp.lerp(underwater, THREE.MathUtils.smoothstep(POND.r - 0.5 - pd, 0, 2.2) * 0.9);
        }
      }

      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.ctx.scene.add(this.ground);

    // 地平線まで続く遠景の大地（霧にとけて水平線がきれいにつながる）
    const horizonGeo = new THREE.CircleGeometry(400, 48);
    horizonGeo.rotateX(-Math.PI / 2);
    const horizon = new THREE.Mesh(horizonGeo, new THREE.MeshBasicMaterial({ color: 0x63b56f }));
    horizon.position.y = -1.7;
    this.ctx.scene.add(horizon);
  }

  _buildWater() {
    const geo = new THREE.CircleGeometry(POND.r - 0.15, 48);
    geo.rotateX(-Math.PI / 2);
    this.waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x2f7fc4) },
      uShallow: { value: new THREE.Color(0x7fd4e8) },
      uSparkle: { value: 0.35 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.set(POND.x, WATER_Y, POND.z);
    water.renderOrder = 2;
    this.ctx.scene.add(water);
    this.colliders.push({ x: POND.x, z: POND.z, r: POND.r + 0.2 });
  }

  // ---------------- お城 ----------------
  _buildCastle() {
    const castle = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff3e2, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf25c9a, roughness: 0.65 });
    const roofMat2 = new THREE.MeshStandardMaterial({ color: 0xc94f8c, roughness: 0.65 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd166, roughness: 0.35, metalness: 0.6,
      emissive: 0xffb020, emissiveIntensity: 0.25,
    });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xfff0c0, emissive: 0xffc95e, emissiveIntensity: 0.6, roughness: 0.5,
    });
    this.windowMats.push(winMat);

    const addShadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    const tower = (x, z, h, r, roofM) => {
      const g = new THREE.Group();
      const body = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 14), wallMat));
      body.position.y = h / 2;
      g.add(body);
      const roof = addShadow(new THREE.Mesh(new THREE.ConeGeometry(r * 1.4, h * 0.62, 14), roofM));
      roof.position.y = h + h * 0.31;
      g.add(roof);
      // 金の玉と旗
      const orb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 8), goldMat);
      orb.position.y = h + h * 0.62 + r * 0.12;
      g.add(orb);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.1, r * 0.55), new THREE.MeshBasicMaterial({
        color: pick([0xff7fb3, 0xffd166, 0x8fd7ff]), side: THREE.DoubleSide,
      }));
      flag.geometry.translate(r * 0.55, 0, 0);
      flag.position.y = h + h * 0.62 + r * 0.45;
      g.add(flag);
      this.flags.push(flag);
      // 窓（下から順に光る窓を配置）
      const winCount = Math.floor(h / 1.6);
      for (let i = 0; i < winCount; i++) {
        const win = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.22, 3, 8), winMat);
        const a = rand(-0.5, 0.5);
        win.position.set(Math.sin(a) * r, 1.2 + i * 1.5, Math.cos(a) * r);
        win.scale.z = 0.35;
        win.lookAt(win.position.x * 2, win.position.y, win.position.z * 2);
        g.add(win);
      }
      g.position.set(x, 0, z);
      return g;
    };

    // 中央の大きな塔と、まわりの塔たち
    castle.add(tower(0, -1.5, 9.5, 2.0, roofMat));
    castle.add(tower(-3.8, 0.5, 6.2, 1.35, roofMat2));
    castle.add(tower(3.8, 0.5, 6.2, 1.35, roofMat2));
    castle.add(tower(-2.4, 3.2, 4.6, 1.0, roofMat));
    castle.add(tower(2.4, 3.2, 4.6, 1.0, roofMat));

    // 塔をつなぐ壁
    const wall = addShadow(new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.0, 1.0), wallMat));
    wall.position.set(0, 1.5, 3.2);
    castle.add(wall);
    const wallL = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.4, 4.0), wallMat));
    wallL.position.set(-3.8, 1.7, 1.6);
    castle.add(wallL);
    castle.add((() => { const w = wallL.clone(); w.position.x = 3.8; return w; })());

    // 城門のアーチ
    const gate = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.06, 16, 1, false, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x5a3d6e, roughness: 1 }));
    gate.rotation.z = Math.PI / 2;
    gate.rotation.y = Math.PI / 2;
    gate.position.set(0, 1.1, 3.72);
    castle.add(gate);
    const gateBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.1),
      gate.material);
    gateBase.position.set(0, 0.55, 3.72);
    castle.add(gateBase);
    const gateTrim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 8, 20, Math.PI), goldMat);
    gateTrim.position.set(0, 1.1, 3.76);
    castle.add(gateTrim);

    // 台座（この上にお城全体をのせる）
    const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7.0, 0.9, 24), wallMat));
    base.position.y = 0.45;
    castle.children.forEach((c) => { c.position.y += 0.9; });
    castle.add(base);

    // 台座から地面へおりる階段
    const stepMat = new THREE.MeshStandardMaterial({ color: 0xf3ddb2, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const step = addShadow(new THREE.Mesh(new THREE.BoxGeometry(3.6 + i * 0.6, 0.24, 0.85), stepMat));
      step.position.set(0, 0.78 - i * 0.24, 6.6 + i * 0.7);
      castle.add(step);
    }

    castle.position.set(CASTLE.x, 0, CASTLE.z);
    this.castle = castle;
    this.ctx.scene.add(castle);
    this.colliders.push({ x: CASTLE.x, z: CASTLE.z - 0.5, r: 7.6 });
  }

  // ---------------- 木・花・草・きのこ・クリスタル ----------------
  _buildTreesAndFlora() {
    const scene = this.ctx.scene;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 1 });
    const sakuraMats = [0xffb7d5, 0xffc9e0, 0xffa8cc].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
    );
    const greenMats = [0x58bf6e, 0x49ae63, 0x6fcf7e].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })
    );

    const treeSpots = [
      [-6, 8, true], [6.5, 9, true], [-8, 2, true], [-11, -6, false],
      [8, -8, true], [-14, 6, false], [-9, -14, true], [10, -14, false],
      [17, -6, true], [-18, -2, false], [-16, 12, true], [14, 11, false],
      [21, 3, false], [-21, -9, true], [5, 15, true], [-4, 16, false],
      [20, -13, true], [-13, 18, true],
    ];
    for (const [x, z, isSakura] of treeSpots) {
      const y = this.heightAt(x, z);
      const tree = new THREE.Group();
      const th = rand(1.7, 2.4);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, th, 8), trunkMat);
      trunk.position.y = th / 2;
      trunk.castShadow = true;
      tree.add(trunk);
      const mats = isSakura ? sakuraMats : greenMats;
      const blobs = 3 + Math.floor(rand(2));
      for (let b = 0; b < blobs; b++) {
        const r = rand(0.8, 1.35);
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), pick(mats));
        blob.position.set(rand(-0.7, 0.7), th + rand(-0.1, 0.9), rand(-0.7, 0.7));
        blob.castShadow = true;
        tree.add(blob);
      }
      tree.position.set(x, y, z);
      const s = rand(0.85, 1.25);
      tree.scale.setScalar(s);
      scene.add(tree);
      this.colliders.push({ x, z, r: 0.55 * s });
      if (isSakura) this.sakura.push(new THREE.Vector3(x, y + th + 0.6, z));
    }

    // ---- お花のじゅうたん（インスタンス描画） ----
    const flowerCount = 170;
    const stemGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.26, 5);
    stemGeo.translate(0, 0.13, 0);
    const headGeo = new THREE.IcosahedronGeometry(0.075, 0);
    headGeo.scale(1, 0.75, 1);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f9e58, roughness: 1 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.08 });
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, flowerCount);
    const heads = new THREE.InstancedMesh(headGeo, headMat, flowerCount);
    const flowerColors = [0xff8fbf, 0xffd166, 0xc79bff, 0xff9d76, 0x8fd7ff, 0xfff3ae, 0xff6f9c];
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < flowerCount && guard++ < 3000) {
      const x = rand(-26, 26), z = rand(-18, 26);
      if (Math.abs(x) < 2.6 && z > -15 && z < 11.5) continue;           // 道の上は避ける
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.6) continue;   // 池
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 8.6) continue;        // お城
      const y = this.heightAt(x, z);
      m4.makeRotationY(rand(Math.PI * 2));
      m4.setPosition(x, y, z);
      stems.setMatrixAt(placed, m4);
      m4.setPosition(x, y + 0.28, z);
      heads.setMatrixAt(placed, m4);
      heads.setColorAt(placed, col.set(pick(flowerColors)));
      placed++;
    }
    stems.count = heads.count = placed;
    scene.add(stems); scene.add(heads);

    // ---- ゆらゆらゆれる大きめのお花（道ぞい） ----
    const heroSpots = [
      [-3.2, 7], [3.4, 5.5], [-3.4, 1.5], [3.2, -1.5], [-3.2, -5.5],
      [3.4, -8.5], [-3.6, -10.5], [4.4, 2.2], [-4.6, 4.2], [4.2, -4.8],
    ];
    for (const [x, z] of heroSpots) {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 6), stemMat);
      stem.position.y = 0.27;
      g.add(stem);
      const c = pick(flowerColors);
      const petalMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, emissive: c, emissiveIntensity: 0.12 });
      for (let p = 0; p < 6; p++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), petalMat);
        const a = (p / 6) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.15, 0.58, Math.sin(a) * 0.15);
        petal.scale.set(1, 0.45, 0.62);
        petal.rotation.y = -a;
        g.add(petal);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffe28a, roughness: 0.6, emissive: 0xffc95e, emissiveIntensity: 0.35 }));
      center.position.y = 0.6;
      g.add(center);
      g.position.set(x, this.heightAt(x, z), z);
      g.userData.phase = rand(Math.PI * 2);
      scene.add(g);
      this.heroFlowers.push(g);
    }

    // ---- 草むら ----
    const grassCount = 380;
    const grassGeo = new THREE.ConeGeometry(0.07, 0.34, 5);
    grassGeo.translate(0, 0.17, 0);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    const greens = [0x59c06d, 0x6fce7c, 0x47a45f, 0x83d98b];
    placed = 0; guard = 0;
    while (placed < grassCount && guard++ < 5000) {
      const x = rand(-30, 30), z = rand(-20, 30);
      if (Math.abs(x) < 2.4 && z > -15 && z < 11.5) continue;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1) continue;
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 8.2) continue;
      const y = this.heightAt(x, z);
      m4.makeRotationY(rand(Math.PI * 2));
      const s = rand(0.7, 1.6);
      m4.scale(new THREE.Vector3(s, s, s));
      m4.setPosition(x, y, z);
      grass.setMatrixAt(placed, m4);
      grass.setColorAt(placed, col.set(pick(greens)));
      placed++;
    }
    grass.count = placed;
    scene.add(grass);

    // ---- きのこ ----
    const mushroomSpots = [[-7.5, 5.5], [9, 7.5], [-10.5, -9], [7, -11.5], [16.5, -8.5], [-15.5, 9]];
    this.mushroomMats = [];
    for (const [x, z] of mushroomSpots) {
      const g = new THREE.Group();
      const stemM = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.9 }));
      stemM.position.y = 0.15;
      g.add(stemM);
      const capColor = pick([0xff6f7e, 0xff9d76, 0xc79bff]);
      const capMat = new THREE.MeshStandardMaterial({
        color: capColor, roughness: 0.7, emissive: capColor, emissiveIntensity: 0.05,
      });
      this.mushroomMats.push(capMat);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      cap.position.y = 0.28;
      cap.castShadow = true;
      g.add(cap);
      for (let d = 0; d < 3; d++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
        const a = rand(Math.PI * 2);
        dot.position.set(Math.cos(a) * 0.17, 0.42, Math.sin(a) * 0.17);
        g.add(dot);
      }
      g.position.set(x, this.heightAt(x, z), z);
      g.scale.setScalar(rand(0.8, 1.3));
      this.ctx.scene.add(g);
    }

    // ---- 光るクリスタル ----
    const crystalSpots = [[-12, 3, 0xc79bff], [11, -3.5, 0x8fe8ff], [-6, -12, 0xffa8d9], [18, 8, 0xa8ffd9], [-17, -13, 0xffd9a8]];
    for (const [x, z, c] of crystalSpots) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: c, roughness: 0.25, metalness: 0.1,
        emissive: c, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.95,
      });
      const n = 2 + Math.floor(rand(2));
      for (let i = 0; i < n; i++) {
        const h = rand(0.5, 1.15);
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat);
        crystal.scale.set(0.7, h * 2.2, 0.7);
        crystal.position.set(rand(-0.3, 0.3), h * 0.5, rand(-0.3, 0.3));
        crystal.rotation.y = rand(Math.PI);
        crystal.rotation.z = rand(-0.18, 0.18);
        crystal.castShadow = true;
        g.add(crystal);
      }
      g.position.set(x, this.heightAt(x, z), z);
      this.ctx.scene.add(g);
      this.crystals.push({ group: g, mat, phase: rand(Math.PI * 2) });
      this.colliders.push({ x, z, r: 0.7 });
    }
  }

  // ---------------- 虹 ----------------
  _buildRainbow() {
    this.rainbow = new THREE.Group();
    const colors = [0xff5f5f, 0xffae4a, 0xffe45e, 0x7ee081, 0x5fc9ff, 0xb28cff];
    this.rainbowMats = [];
    colors.forEach((c, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.4, depthWrite: false, fog: false,
      });
      this.rainbowMats.push(mat);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 0.62, 0.34, 6, 60, Math.PI), mat);
      this.rainbow.add(arc);
    });
    this.rainbow.position.set(4, -2, -48);
    this.rainbow.renderOrder = -5;
    this.ctx.scene.add(this.rainbow);
  }

  // ---------------- 小道の飛び石とバラのアーチ ----------------
  _buildPathAndArch() {
    const scene = this.ctx.scene;
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xfae9cd, roughness: 0.95 });
    for (let i = 0; i < 9; i++) {
      const z = 9 - i * 2.5;
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(rand(0.5, 0.66), rand(0.55, 0.72), 0.1, 9), stoneMat);
      stone.position.set(i % 2 === 0 ? -0.45 : 0.45, 0.03, z);
      stone.receiveShadow = true;
      scene.add(stone);
    }

    // バラのアーチ（スタート地点）
    const arch = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xfff3e2, roughness: 0.9 });
    for (const sx of [-1.4, 1.4]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.6, 8), pillarMat);
      pillar.position.set(sx, 1.3, 0);
      pillar.castShadow = true;
      arch.add(pillar);
      this.colliders.push({ x: sx, z: 10.5, r: 0.35 });
    }
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 26, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x7ec97a, roughness: 0.9 }));
    hoop.position.y = 2.6;
    arch.add(hoop);
    const roseMat = new THREE.MeshStandardMaterial({ color: 0xff6f9c, roughness: 0.7, emissive: 0xff6f9c, emissiveIntensity: 0.15 });
    const roseMat2 = new THREE.MeshStandardMaterial({ color: 0xffc9e0, roughness: 0.7 });
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      const rose = new THREE.Mesh(new THREE.SphereGeometry(rand(0.1, 0.16), 8, 6), i % 2 ? roseMat : roseMat2);
      rose.position.set(Math.cos(a) * 1.4, 2.6 + Math.sin(a) * 1.4, rand(-0.08, 0.08));
      arch.add(rose);
    }
    arch.position.set(0, 0, 10.5);
    scene.add(arch);
  }

  // ---------------- 噴水 ----------------
  _buildFountain() {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe8f0f8, roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 16), stoneMat);
    base.position.y = 0.25;
    g.add(base);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.1, 10), stoneMat);
    column.position.y = 1.0;
    g.add(column);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 0.28, 14), stoneMat);
    bowl.position.y = 1.6;
    g.add(bowl);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4, metalness: 0.5, emissive: 0xffb020, emissiveIntensity: 0.3 }));
    orb.position.y = 1.85;
    g.add(orb);
    g.position.set(POND.x, WATER_Y - 0.1, POND.z);
    g.children.forEach((c) => { c.castShadow = true; });
    this.ctx.scene.add(g);
    this.fountain = g;
    this.fountainTop = new THREE.Vector3(POND.x, WATER_Y + 1.8, POND.z);

    // ひろがる波紋
    this.ripples = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.0, 36),
        new THREE.MeshBasicMaterial({ color: 0xdfF6ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(POND.x, WATER_Y + 0.03, POND.z);
      ring.renderOrder = 3;
      this.ctx.scene.add(ring);
      this.ripples.push({ mesh: ring, t: i * 0.5 });
    }
  }

  // ---------------- 夜のホタル ----------------
  _buildFireflies() {
    const count = 42;
    this.fireflyData = [];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = rand(-24, 24), z = rand(-16, 24);
      const y = rand(0.5, 3.2);
      positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
      this.fireflyData.push({ x, y, z, phase: rand(Math.PI * 2), speed: rand(0.4, 1.0) });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 60);
    const tex = makeCanvasTexture(32, (g, s) => {
      const c = s / 2;
      const grad = g.createRadialGradient(c, c, 0, c, c, c);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,200,0.5)');
      grad.addColorStop(1, 'rgba(255,255,180,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    });
    const mat = new THREE.PointsMaterial({
      size: 0.5, map: tex, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.fireflies.frustumCulled = false;
    this.fireflies.renderOrder = 18;
    this.ctx.scene.add(this.fireflies);
  }

  // ---------------- ただよう光の粒（いつでも夢みたいな空気感） ----------------
  _buildDust() {
    const count = 70;
    this.dustData = [];
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = rand(-26, 26), y = rand(0.4, 6), z = rand(-24, 26);
      positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
      this.dustData.push({ x, y, z, phase: rand(Math.PI * 2) });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 60);
    const tex = makeCanvasTexture(24, (g, s) => {
      const c = s / 2;
      const grad = g.createRadialGradient(c, c, 0, c, c, c);
      grad.addColorStop(0, 'rgba(255,250,235,0.9)');
      grad.addColorStop(1, 'rgba(255,250,235,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    });
    this.dustMat = new THREE.PointsMaterial({
      size: 0.16, map: tex, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const dust = new THREE.Points(geo, this.dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 17;
    this.dust = dust;
    this.ctx.scene.add(dust);
  }

  // ============================================================
  update(dt, time, sky, particles) {
    this.time = time;
    const night = sky.nightFactor;

    // 水面
    this.waterUniforms.uTime.value = time;
    this.waterUniforms.uSparkle.value = 0.3 + night * 0.15;
    this.waterUniforms.uShallow.value.set(0x7fd4e8).lerp(new THREE.Color(0x3a5fa8), night);
    this.waterUniforms.uDeep.value.set(0x2f7fc4).lerp(new THREE.Color(0x172c66), night);

    // 旗をはためかせる
    for (const flag of this.flags) {
      flag.rotation.y = Math.sin(time * 3.2 + flag.position.y) * 0.35;
    }

    // 窓とお城の明かり（夜ほど強く）
    for (const m of this.windowMats) m.emissiveIntensity = 0.5 + night * 2.6;
    for (const m of this.mushroomMats) m.emissiveIntensity = 0.05 + night * 0.9;

    // クリスタルの鼓動
    for (const c of this.crystals) {
      c.mat.emissiveIntensity = 0.45 + night * 0.9 + Math.sin(time * 2.2 + c.phase) * (0.18 + night * 0.4);
    }

    // 虹
    for (const m of this.rainbowMats) m.opacity = sky.rainbowOpacity * 0.75;

    // お花のゆれ
    for (const f of this.heroFlowers) {
      f.rotation.z = Math.sin(time * 1.9 + f.userData.phase) * 0.09;
      f.rotation.x = Math.cos(time * 1.6 + f.userData.phase) * 0.06;
    }

    // 噴水のしぶきと波紋
    particles.fountainSpray(this.fountainTop.x, this.fountainTop.y, this.fountainTop.z);
    for (const r of this.ripples) {
      r.t += dt * 0.45;
      if (r.t > 1) r.t -= 1;
      r.mesh.scale.setScalar(1 + r.t * 4.2);
      r.mesh.material.opacity = (1 - r.t) * 0.4;
    }

    // 桜の花びら（昼と夕方だけ、時々ひらり）
    if (night < 0.6 && Math.random() < dt * 6) {
      const s = pick(this.sakura);
      particles.petalAt(s.x, s.y, s.z);
    }

    // ホタル（夜にふわふわ光る）
    const fPos = this.fireflies.geometry.attributes.position;
    const fCol = this.fireflies.geometry.attributes.color;
    const glow = night;
    for (let i = 0; i < this.fireflyData.length; i++) {
      const d = this.fireflyData[i];
      const t = time * d.speed;
      fPos.array[i * 3] = d.x + Math.sin(t * 0.7 + d.phase) * 2.2;
      fPos.array[i * 3 + 1] = d.y + Math.sin(t * 1.1 + d.phase * 2) * 0.7;
      fPos.array[i * 3 + 2] = d.z + Math.cos(t * 0.5 + d.phase) * 2.2;
      const flicker = Math.max(0, Math.sin(t * 2.3 + d.phase * 3)) * glow;
      fCol.array[i * 3] = 1.0 * flicker;
      fCol.array[i * 3 + 1] = 0.95 * flicker;
      fCol.array[i * 3 + 2] = 0.55 * flicker;
    }
    fPos.needsUpdate = true;
    fCol.needsUpdate = true;

    // ただよう光の粒
    const dPos = this.dust.geometry.attributes.position;
    for (let i = 0; i < this.dustData.length; i++) {
      const d = this.dustData[i];
      dPos.array[i * 3] = d.x + Math.sin(time * 0.22 + d.phase) * 1.6;
      dPos.array[i * 3 + 1] = d.y + Math.sin(time * 0.35 + d.phase * 2) * 0.8;
      dPos.array[i * 3 + 2] = d.z + Math.cos(time * 0.18 + d.phase) * 1.6;
    }
    dPos.needsUpdate = true;
    this.dustMat.opacity = 0.4 + night * 0.3;
  }

  get pond() { return POND; }
  get castlePos() { return CASTLE; }
  get waterY() { return WATER_Y; }
}
