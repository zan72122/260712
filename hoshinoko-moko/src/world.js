// ほしのこモコ — ワールド構築
// 空に浮かぶ「ふわふか島」。桜、池と滝、キノコのおうち、光るクリスタル、
// 昼・夕・夜のサイクルをすべて手続き生成で描く。

import * as THREE from 'three';
import { makeGlowTexture } from './effects.js';

/* ---------- ユーティリティ ---------- */

const _c = new THREE.Color();

// 位置ハッシュで決める決定論的ジッター。
// 同じ座標の頂点（toNonIndexed で複製されたものや UV 継ぎ目）は同じ方向に
// 動くので、メッシュに亀裂が入らない。
function vhash(x, y, z, seed) {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 269.5) * 43758.5453;
  return v - Math.floor(v);
}

function jitter(geo, amt) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setXYZ(i,
      x + (vhash(x, y, z, 1) - 0.5) * amt,
      y + (vhash(x, y, z, 2) - 0.5) * amt,
      z + (vhash(x, y, z, 3) - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

function rand(a, b) { return a + Math.random() * (b - a); }

/* ---------- フェーズ（昼/夕/夜）パレット ---------- */

const PHASES = [
  { // 昼
    top: 0x2f8ede, horizon: 0xbfe6ff, fog: 0xc8e6fa,
    sunDir: new THREE.Vector3(0.55, 0.8, 0.38).normalize(),
    sunColor: 0xfff2d0, sunInt: 1.55, sunGlow: 1.0,
    hemiSky: 0xcfe8ff, hemiGround: 0x9ed488, hemiInt: 0.8,
    ambInt: 0.32, night: 0.0, cloud: 0xffffff, window: 0.0, lantern: 0.0,
  },
  { // 夕やけ
    top: 0x4a3f8f, horizon: 0xff9a5e, fog: 0xe8a37e,
    sunDir: new THREE.Vector3(-0.62, 0.085, -0.52).normalize(),
    sunColor: 0xffa25e, sunInt: 1.2, sunGlow: 1.4,
    hemiSky: 0xf6c9a8, hemiGround: 0xb0806f, hemiInt: 0.6,
    ambInt: 0.25, night: 0.06, cloud: 0xffd9c0, window: 0.6, lantern: 0.8,
  },
  { // 夜
    top: 0x070d26, horizon: 0x1c2a5e, fog: 0x141c42,
    sunDir: new THREE.Vector3(-0.4, 0.68, -0.45).normalize(),
    sunColor: 0xaabdff, sunInt: 0.42, sunGlow: 0.0,
    hemiSky: 0x27305c, hemiGround: 0x131a33, hemiInt: 0.38,
    ambInt: 0.12, night: 1.0, cloud: 0x6f7ca8, window: 1.4, lantern: 1.6,
  },
];

/* ---------- 空シェーダー ---------- */

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const SKY_FRAG = /* glsl */`
  varying vec3 vDir;
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uMoonDir;
  uniform float uNight;
  uniform float uSunGlow;
  uniform float uTime;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y * 0.5 + 0.5;

    // グラデーションの空（地平線ぎわに光の帯）
    vec3 col = mix(uHorizonColor, uTopColor, smoothstep(0.505, 0.55, h));
    col += uHorizonColor * 0.15 * pow(1.0 - abs(d.y), 6.0);
    col = mix(col * 0.85, col, smoothstep(-0.25, 0.02, d.y));

    // 太陽（にじむ光彩つき）
    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunColor * uSunGlow * (
      pow(sd, 1400.0) * 2.6 +
      pow(sd, 80.0) * 0.5 +
      pow(sd, 8.0) * 0.14
    );

    // 月（三日月）と光彩
    float md = distance(d, uMoonDir);
    float moon = smoothstep(0.052, 0.048, md);
    float bite = smoothstep(0.058, 0.052, distance(d, normalize(uMoonDir + vec3(0.028, 0.016, 0.0))));
    moon = clamp(moon - bite, 0.0, 1.0);
    col += vec3(1.0, 0.97, 0.82) * moon * uNight * 1.7;
    col += vec3(0.75, 0.82, 1.0) * pow(max(1.0 - md * 4.0, 0.0), 3.0) * 0.3 * uNight;

    // 星（またたき）
    vec3 sp = d * 90.0;
    vec3 cell = floor(sp);
    float h1 = hash(cell);
    vec3 f = fract(sp) - 0.5;
    vec3 jit = vec3(hash(cell + 1.7), hash(cell + 3.1), hash(cell + 5.3)) - 0.5;
    float ds = length(f - jit * 0.55);
    float star = smoothstep(0.16, 0.0, ds) * step(0.968, h1);
    float tw = 0.55 + 0.45 * sin(uTime * (1.5 + 4.0 * h1) + h1 * 40.0);
    col += vec3(0.95, 0.97, 1.0) * star * tw * uNight * smoothstep(-0.06, 0.05, d.y) * 1.4;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---------- 水シェーダー（池） ---------- */

const WATER_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  uniform float uNight;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);

    vec3 shallowDay = vec3(0.45, 0.78, 0.88);
    vec3 deepDay    = vec3(0.1, 0.38, 0.68);
    vec3 shallowNight = vec3(0.1, 0.18, 0.4);
    vec3 deepNight    = vec3(0.02, 0.06, 0.2);
    vec3 shallow = mix(shallowDay, shallowNight, uNight);
    vec3 deep    = mix(deepDay, deepNight, uNight);
    vec3 col = mix(deep, shallow, smoothstep(0.35, 0.98, r));

    // ゆらめく光の網（なんちゃってコースティクス）
    float w1 = sin(p.x * 9.0 + uTime * 1.3) * sin(p.y * 8.0 - uTime * 1.1);
    float w2 = sin((p.x + p.y) * 12.0 - uTime * 1.8);
    float caustic = pow(max(w1 * w2, 0.0), 2.0);
    col += mix(vec3(0.55, 0.85, 0.95), vec3(0.4, 0.55, 0.9), uNight) * caustic * 0.22;

    // きらん、と走るハイライト
    float sparkle = pow(max(sin(p.x * 23.0 + uTime * 2.4) * sin(p.y * 19.0 - uTime * 2.0), 0.0), 40.0);
    col += vec3(1.0) * sparkle * (0.3 + uNight * 0.15);

    // ふちの泡
    float foam = smoothstep(0.9, 1.0, r + sin((p.x + p.y) * 14.0 + uTime * 1.2) * 0.02);
    col = mix(col, vec3(0.9, 1.0, 1.0), foam * 0.4 * (1.0 - uNight * 0.5));

    gl_FragColor = vec4(col, 0.93);
  }
`;

const WATER_VERT = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uTime * 1.6 + position.x * 4.0) * 0.015
         + cos(uTime * 1.2 + position.y * 5.0) * 0.015;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

/* ---------- 滝シェーダー ---------- */

const FALL_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  uniform float uNight;
  void main() {
    // 流れ落ちるスジ
    float x = vUv.x;
    float flow = sin(vUv.y * 26.0 + uTime * 5.0 + sin(x * 22.0) * 2.0) * 0.5 + 0.5;
    float streaks = smoothstep(0.25, 0.9, flow);

    float edge = smoothstep(0.0, 0.18, x) * smoothstep(1.0, 0.82, x);
    float topFade = smoothstep(0.0, 0.06, 1.0 - vUv.y);
    float botFade = smoothstep(0.0, 0.35, vUv.y);
    float a = (0.35 + streaks * 0.5) * edge * topFade * botFade;

    vec3 day = mix(vec3(0.55, 0.8, 0.95), vec3(1.0), streaks * 0.7);
    vec3 night = mix(vec3(0.25, 0.35, 0.65), vec3(0.7, 0.8, 1.0), streaks * 0.7);
    gl_FragColor = vec4(mix(day, night, uNight), a * 0.85);
  }
`;

/* ---------- 虹シェーダー ---------- */

const RAINBOW_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform float uAlpha;
  void main() {
    float t = vUv.y; // チューブの断面方向
    vec3 col;
    if      (t < 0.17) col = vec3(1.0, 0.35, 0.35);
    else if (t < 0.32) col = vec3(1.0, 0.65, 0.3);
    else if (t < 0.47) col = vec3(1.0, 0.95, 0.4);
    else if (t < 0.62) col = vec3(0.45, 0.9, 0.5);
    else if (t < 0.78) col = vec3(0.4, 0.7, 1.0);
    else               col = vec3(0.75, 0.55, 1.0);
    float edge = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.88, t);
    gl_FragColor = vec4(col, uAlpha * edge * 0.65);
  }
`;

/* ============================================================= */

export class World {
  constructor(scene) {
    this.scene = scene;
    this.islandRadius = 7.0;
    this.pondCenter = new THREE.Vector3(3.2, 0, 2.5);
    this.pondRadius = 1.85;
    this.treePos = new THREE.Vector3(-3.5, 0, -2.7);
    this.canopyCenter = new THREE.Vector3(-3.5, 3.0, -2.7);
    this.housePos = new THREE.Vector3(0.4, 0, -4.5);

    this._lerpables = [];   // {get current/target} 色や数値の補間管理
    this._phase = 0;

    this._buildLights();
    this._buildSky();
    this._buildIsland();
    this._buildGrass();
    this._buildPondAndFalls();
    this._buildTree();
    this._buildFlowers();
    this._buildHouse();
    this._buildClouds();
    this._buildFloatingRocks();
    this._buildRainbow();

    this.setPhase(0, true);
  }

  /* ---------- ライティング ---------- */

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x86c46f, 0.75);
    this.scene.add(this.hemi);

    this.amb = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(this.amb);

    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11;
    sc.near = 2; sc.far = 45;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // 夜のあかり
    this.lanternLight = new THREE.PointLight(0xffc477, 0, 7, 2);
    this.lanternLight.position.set(2.1, 1.75, -0.9);
    this.scene.add(this.lanternLight);

    this.windowLight = new THREE.PointLight(0xffb35e, 0, 6, 2);
    this.windowLight.position.copy(this.housePos).add(new THREE.Vector3(0, 1.1, 1.4));
    this.scene.add(this.windowLight);

    this.scene.fog = new THREE.Fog(0xcfe9fb, 24, 80);
  }

  /* ---------- 空 ---------- */

  _buildSky() {
    this.skyU = {
      uTopColor: { value: new THREE.Color(PHASES[0].top) },
      uHorizonColor: { value: new THREE.Color(PHASES[0].horizon) },
      uSunDir: { value: PHASES[0].sunDir.clone() },
      uSunColor: { value: new THREE.Color(PHASES[0].sunColor) },
      uMoonDir: { value: new THREE.Vector3(-0.42, 0.075, -0.6).normalize() },
      uNight: { value: 0 },
      uSunGlow: { value: 1 },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyU,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 48, 32), mat);
    sky.renderOrder = -10;
    this.scene.add(sky);
  }

  /* ---------- 浮遊島 ---------- */

  _buildIsland() {
    const g = new THREE.Group();

    // 草の台地（ふちを少しデコボコに）
    const topGeo = jitter(
      new THREE.CylinderGeometry(7.35, 7.9, 1.15, 44, 3).toNonIndexed(), 0.16);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x6cbf52, flatShading: true });
    const top = new THREE.Mesh(topGeo, grassMat);
    top.position.y = -0.58;
    top.receiveShadow = true;
    g.add(top);

    // 土の逆さ山
    const earthGeo = jitter(
      new THREE.CylinderGeometry(7.85, 0.7, 4.8, 28, 5).toNonIndexed(), 0.42);
    const earthMat = new THREE.MeshLambertMaterial({ color: 0x9a6b4f, flatShading: true });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.position.y = -3.5;
    g.add(earth);

    // 島の底に光るクリスタル
    this.crystalMat = new THREE.MeshLambertMaterial({
      color: 0x9fe8ff, emissive: 0x64d8ff, emissiveIntensity: 0.7, flatShading: true,
    });
    this.crystalMat2 = new THREE.MeshLambertMaterial({
      color: 0xffb7ec, emissive: 0xff7fd9, emissiveIntensity: 0.7, flatShading: true,
    });
    for (let i = 0; i < 5; i++) {
      const cry = new THREE.Mesh(
        new THREE.OctahedronGeometry(rand(0.28, 0.55), 0),
        i % 2 ? this.crystalMat2 : this.crystalMat);
      cry.scale.y = rand(1.6, 2.4);
      const a = rand(0, Math.PI * 2);
      const r = rand(0.4, 2.2);
      cry.position.set(Math.cos(a) * r, -5.4 - rand(0, 0.9), Math.sin(a) * r);
      cry.rotation.z = rand(-0.4, 0.4);
      g.add(cry);
    }

    // 見えない地面（レイキャスト & 影受け用のなめらか面）
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(7.3, 48), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.005;
    this.ground.receiveShadow = true;
    g.add(this.ground);

    // 小道の飛び石
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xd8d3ce, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(
        jitter(new THREE.CylinderGeometry(rand(0.3, 0.42), rand(0.36, 0.48), 0.09, 7).toNonIndexed(), 0.03),
        stoneMat);
      const t = i / 4;
      s.position.set(
        THREE.MathUtils.lerp(this.housePos.x, 0.3, t) + rand(-0.15, 0.15),
        0.04,
        THREE.MathUtils.lerp(this.housePos.z + 1.6, 0.8, t) + rand(-0.15, 0.15));
      s.receiveShadow = true;
      s.castShadow = true;
      g.add(s);
    }

    // ふちの岩
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xb9c0c7, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const rk = new THREE.Mesh(
        jitter(new THREE.DodecahedronGeometry(rand(0.22, 0.5), 0).toNonIndexed(), 0.1), rockMat);
      rk.position.set(Math.cos(a) * rand(6.2, 6.9), 0.1, Math.sin(a) * rand(6.2, 6.9));
      rk.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      rk.castShadow = true;
      g.add(rk);
    }

    this.scene.add(g);
    this.islandGroup = g;
  }

  /* ---------- 草（風にそよぐインスタンス） ---------- */

  _buildGrass() {
    const COUNT = 900;
    const geo = new THREE.ConeGeometry(0.085, 0.34, 5);
    geo.translate(0, 0.17, 0);
    this.grassTime = { value: 0 };
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.grassTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 gwp = instanceMatrix * vec4(position, 1.0);
          float sway = sin(uTime * 1.9 + gwp.x * 1.6 + gwp.z * 1.2) * 0.16 * position.y;
          transformed.x += sway;
          transformed.z += sway * 0.55;
        #endif`
      );
    };
    const grass = new THREE.InstancedMesh(geo, mat, COUNT);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    let placed = 0;
    while (placed < COUNT) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(Math.random()) * 6.9;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (new THREE.Vector2(x - this.pondCenter.x, z - this.pondCenter.z).length() < this.pondRadius + 0.35) continue;
      eu.set(rand(-0.12, 0.12), rand(0, Math.PI * 2), rand(-0.12, 0.12));
      q.setFromEuler(eu);
      m.compose(
        new THREE.Vector3(x, 0, z), q,
        new THREE.Vector3(rand(0.7, 1.4), rand(0.7, 1.6), rand(0.7, 1.4)));
      grass.setMatrixAt(placed, m);
      _c.setHSL(0.3 + rand(-0.03, 0.04), rand(0.55, 0.72), rand(0.32, 0.46));
      grass.setColorAt(placed, _c);
      placed++;
    }
    grass.instanceMatrix.needsUpdate = true;
    this.scene.add(grass);
  }

  /* ---------- 池と滝 ---------- */

  _buildPondAndFalls() {
    this.waterU = { uTime: { value: 0 }, uNight: { value: 0 } };

    // 池のくぼみ（濃い色の底）
    const bed = new THREE.Mesh(
      new THREE.CircleGeometry(this.pondRadius + 0.12, 36),
      new THREE.MeshLambertMaterial({ color: 0x2b6a94 }));
    bed.rotation.x = -Math.PI / 2;
    bed.position.copy(this.pondCenter).setY(-0.06);
    this.scene.add(bed);

    // 水面
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(this.pondRadius, 48),
      new THREE.ShaderMaterial({
        uniforms: this.waterU,
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        transparent: true,
        fog: false,
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.copy(this.pondCenter).setY(0.05);
    this.scene.add(water);

    // 池のふちの石
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xcfc8bd, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.1, 0.1);
      const st = new THREE.Mesh(
        jitter(new THREE.DodecahedronGeometry(rand(0.14, 0.26), 0).toNonIndexed(), 0.06), rimMat);
      st.position.set(
        this.pondCenter.x + Math.cos(a) * (this.pondRadius + 0.18),
        0.08, this.pondCenter.z + Math.sin(a) * (this.pondRadius + 0.18));
      st.castShadow = true;
      g_setRandRot(st);
      this.scene.add(st);
    }

    // すいれんの葉とお花
    const lilyMat = new THREE.MeshLambertMaterial({ color: 0x4fae5f, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16, 0.4, 5.6), lilyMat);
      leaf.rotation.x = -Math.PI / 2;
      const a = rand(0, Math.PI * 2);
      leaf.position.set(
        this.pondCenter.x + Math.cos(a) * rand(0.4, 1.2), 0.08,
        this.pondCenter.z + Math.sin(a) * rand(0.4, 1.2));
      this.scene.add(leaf);
      if (i === 0) {
        const lotus = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.14, 0),
          new THREE.MeshLambertMaterial({ color: 0xffa8cf, emissive: 0xff7fb0, emissiveIntensity: 0.25, flatShading: true }));
        lotus.position.copy(leaf.position).setY(0.17);
        this.scene.add(lotus);
      }
    }

    // あひるちゃん
    this.duck = this._buildDuck();
    this.duck.position.copy(this.pondCenter).add(new THREE.Vector3(-0.5, 0.1, 0.3));
    this.scene.add(this.duck);

    // 滝 — 池から島のふちへ流れて、空へ落ちる
    const dir = new THREE.Vector3(0.78, 0, 0.63).normalize();
    const rim = dir.clone().multiplyScalar(7.5);

    // 小川
    const stream = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 3.3, 1, 8),
      new THREE.ShaderMaterial({
        uniforms: this.waterU,
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        transparent: true, fog: false,
      }));
    stream.rotation.x = -Math.PI / 2;
    stream.rotation.z = -Math.atan2(dir.z, dir.x) + Math.PI / 2;
    const mid = this.pondCenter.clone().lerp(rim.clone().setY(0), 0.55);
    stream.position.copy(mid).setY(0.04);
    this.scene.add(stream);

    // 滝本体
    this.fallU = { uTime: { value: 0 }, uNight: { value: 0 } };
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 7.5),
      new THREE.ShaderMaterial({
        uniforms: this.fallU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: FALL_FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      }));
    fall.position.set(rim.x + dir.x * 0.3, -3.5, rim.z + dir.z * 0.3);
    fall.rotation.y = -Math.atan2(dir.z, dir.x) + Math.PI / 2;
    fall.rotation.x = 0.06;
    this.scene.add(fall);

    // 滝つぼの霧（ポイントスプライト）
    const mistGeo = new THREE.BufferGeometry();
    const mistN = 40;
    const mp = new Float32Array(mistN * 3);
    this.mistSeeds = [];
    for (let i = 0; i < mistN; i++) {
      this.mistSeeds.push({ a: rand(0, Math.PI * 2), r: rand(0.2, 1.3), sp: rand(0.3, 1), off: rand(0, 10) });
    }
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({
      color: 0xdfeeff, size: 0.55, transparent: true, opacity: 0.35,
      map: makeGlowTexture(), depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.mistBase = new THREE.Vector3(rim.x + dir.x * 0.4, -6.8, rim.z + dir.z * 0.4);
    this.scene.add(this.mist);
  }

  _buildDuck() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xfff6d8, flatShading: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat);
    body.scale.set(1.25, 0.9, 1);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat);
    head.position.set(0.18, 0.2, 0);
    g.add(head);
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.1, 6),
      new THREE.MeshLambertMaterial({ color: 0xff9d47 }));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.31, 0.19, 0);
    g.add(beak);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMat);
      e.position.set(0.24, 0.24, s * 0.07);
      g.add(e);
    }
    return g;
  }

  /* ---------- 桜の木 ---------- */

  _buildTree() {
    const g = new THREE.Group();
    g.position.copy(this.treePos);

    const barkMat = new THREE.MeshLambertMaterial({ color: 0x8a6248, flatShading: true });
    let y = 0;
    let lean = 0;
    for (let i = 0; i < 3; i++) {
      const h = 1.0 - i * 0.15;
      const seg = new THREE.Mesh(
        jitter(new THREE.CylinderGeometry(0.24 - i * 0.055, 0.3 - i * 0.05, h, 7).toNonIndexed(), 0.03), barkMat);
      seg.position.set(lean, y + h / 2, 0);
      seg.rotation.z = 0.1 * (i + 1);
      seg.castShadow = true;
      g.add(seg);
      y += h * 0.92;
      lean += 0.16 * (i + 1);
    }
    // 枝
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.09, 1.1, 6), barkMat);
    branch.position.set(lean + 0.5, y - 0.3, 0.2);
    branch.rotation.z = -1.1;
    branch.castShadow = true;
    g.add(branch);

    // 桜のもこもこ
    const pinks = [0xffb7d5, 0xffa5cb, 0xffd1e6, 0xff9ec4];
    const canopy = new THREE.Group();
    canopy.position.set(lean + 0.2, y + 0.75, 0);
    const puffs = [
      [0, 0.3, 0, 1.35], [-0.9, 0, 0.25, 0.95], [0.9, 0.05, -0.2, 1.0],
      [0.15, 0.1, 0.85, 0.85], [-0.1, 0, -0.9, 0.9], [1.4, -0.35, 0.35, 0.6],
    ];
    for (let i = 0; i < puffs.length; i++) {
      const [px, py, pz, s] = puffs[i];
      const puff = new THREE.Mesh(
        jitter(new THREE.IcosahedronGeometry(s, 1).toNonIndexed(), 0.1),
        new THREE.MeshLambertMaterial({
          color: pinks[i % pinks.length], flatShading: true,
          emissive: pinks[i % pinks.length], emissiveIntensity: 0.06,
        }));
      puff.position.set(px, py, pz);
      puff.castShadow = true;
      canopy.add(puff);
    }
    g.add(canopy);
    this.canopy = canopy;
    this.canopyCenter.copy(this.treePos).add(new THREE.Vector3(lean + 0.2, y + 0.75, 0));

    this.scene.add(g);
  }

  /* ---------- お花畑 ---------- */

  _buildFlowers() {
    const COUNT = 46;
    this.flowerData = [];
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.32);
    stemGeo.translate(0, 0.16, 0);
    const headGeo = new THREE.IcosahedronGeometry(0.11, 0);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x4d9e4a });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

    this.flowerStems = new THREE.InstancedMesh(stemGeo, stemMat, COUNT);
    this.flowerHeads = new THREE.InstancedMesh(headGeo, headMat, COUNT);
    this.flowerHeads.castShadow = true;

    const hues = [0.95, 0.83, 0.13, 0.0, 0.58];
    for (let i = 0; i < COUNT; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(Math.random()) * 6.4;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (new THREE.Vector2(x - this.pondCenter.x, z - this.pondCenter.z).length() < this.pondRadius + 0.5) { continue; }
      const s = rand(0.75, 1.25);
      this.flowerData.push({ x, z, s, cur: s, rot: rand(0, Math.PI * 2) });
      _c.setHSL(hues[i % hues.length], 0.85, rand(0.6, 0.75));
      this.flowerHeads.setColorAt(this.flowerData.length - 1, _c);
    }
    this.flowerCount = this.flowerData.length;
    this.flowerStems.count = this.flowerCount;
    this.flowerHeads.count = this.flowerCount;
    this._updateFlowerMatrices();
    this.scene.add(this.flowerStems, this.flowerHeads);

    // 夜に光る星のお花
    this.starFlowerMat = new THREE.MeshLambertMaterial({
      color: 0xfff2b0, emissive: 0xffd75e, emissiveIntensity: 0.3, flatShading: true,
    });
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? 0.09 : 0.04;
      const aa = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(aa) * rr, py = Math.sin(aa) * rr;
      i === 0 ? starShape.moveTo(px, py) : starShape.lineTo(px, py);
    }
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.03, bevelEnabled: false });
    for (let i = 0; i < 9; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(1.5, 6.2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (new THREE.Vector2(x - this.pondCenter.x, z - this.pondCenter.z).length() < this.pondRadius + 0.5) continue;
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(x, 0, z);
      stem.scale.setScalar(1.15);
      const star = new THREE.Mesh(starGeo, this.starFlowerMat);
      star.position.set(x, 0.42, z);
      star.rotation.y = rand(0, Math.PI * 2);
      this.scene.add(stem, star);
    }
  }

  _updateFlowerMatrices() {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    for (let i = 0; i < this.flowerCount; i++) {
      const f = this.flowerData[i];
      eu.set(0, f.rot, 0);
      q.setFromEuler(eu);
      m.compose(new THREE.Vector3(f.x, 0, f.z), q, new THREE.Vector3(f.cur, f.cur, f.cur));
      this.flowerStems.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(f.x, 0.34 * f.cur, f.z), q, new THREE.Vector3(f.cur, f.cur, f.cur));
      this.flowerHeads.setMatrixAt(i, m);
    }
    this.flowerStems.instanceMatrix.needsUpdate = true;
    this.flowerHeads.instanceMatrix.needsUpdate = true;
  }

  // みずやり → お花がぷるんと育つ
  bloomFlowers() {
    this._bloomT = 0;
    for (const f of this.flowerData) {
      f.s = Math.min(f.s * 1.12, 1.9);
    }
  }

  /* ---------- キノコのおうち ---------- */

  _buildHouse() {
    const g = new THREE.Group();
    g.position.copy(this.housePos);
    g.rotation.y = 0.35;

    const stem = new THREE.Mesh(
      jitter(new THREE.CylinderGeometry(0.95, 1.15, 1.5, 14).toNonIndexed(), 0.04),
      new THREE.MeshLambertMaterial({ color: 0xfff1dc, flatShading: true }));
    stem.position.y = 0.75;
    stem.castShadow = true;
    g.add(stem);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xff6b7a, flatShading: true }));
    cap.position.y = 1.45;
    cap.scale.y = 0.75;
    cap.castShadow = true;
    g.add(cap);

    const dotMat = new THREE.MeshLambertMaterial({ color: 0xfff8f0 });
    const dots = [[0, 0.95, 1.25, 0.3], [1.05, 0.8, 0.6, 0.24], [-0.95, 0.85, 0.75, 0.2], [-0.5, 1.05, -1.1, 0.26], [0.8, 0.9, -0.9, 0.22]];
    for (const [dx, dy, dz, s] of dots) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), dotMat);
      d.position.set(dx, 1.45 + dy * 0.75 - 0.45, dz);
      d.scale.setScalar(1);
      d.scale.y = 0.5;
      const n = d.position.clone().sub(new THREE.Vector3(0, 1.0, 0)).normalize();
      d.lookAt(d.position.clone().add(n));
      g.add(d);
    }

    // ドア
    const door = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.1, 12, 1, false, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x9a6a48 }));
    door.rotation.x = Math.PI / 2;
    door.rotation.z = Math.PI;
    door.position.set(0, 0.34, 1.1);
    g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd76e }));
    knob.position.set(0.18, 0.4, 1.16);
    g.add(knob);

    // まど（夜に光る）
    this.windowMat = new THREE.MeshLambertMaterial({
      color: 0xffe9b8, emissive: 0xffb35e, emissiveIntensity: 0,
    });
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), this.windowMat);
    win.position.set(0.55, 1.05, 1.02);
    win.lookAt(win.position.clone().add(new THREE.Vector3(0.4, 0.15, 1)));
    g.add(win);

    // ちいさな煙突とけむりはナシ、代わりにえんとつ星飾り
    this.scene.add(g);

    // ランタン
    const lg = new THREE.Group();
    lg.position.set(2.1, 0, -0.9);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.06, 1.6, 8),
      new THREE.MeshLambertMaterial({ color: 0x6a5744 }));
    pole.position.y = 0.8;
    pole.castShadow = true;
    lg.add(pole);
    this.lampMat = new THREE.MeshLambertMaterial({
      color: 0xfff3cf, emissive: 0xffc477, emissiveIntensity: 0.15,
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), this.lampMat);
    lamp.position.y = 1.72;
    lg.add(lamp);
    const capL = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.16, 8),
      new THREE.MeshLambertMaterial({ color: 0x6a5744 }));
    capL.position.y = 1.92;
    lg.add(capL);
    this.scene.add(lg);
  }

  /* ---------- 雲 ---------- */

  _buildClouds() {
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.12,
      transparent: true, opacity: 0.92, flatShading: false,
    });
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const s = rand(0.5, 1.15);
        const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), this.cloudMat);
        puff.position.set(j * rand(0.6, 0.95) - n * 0.35, rand(-0.15, 0.25), rand(-0.3, 0.3));
        puff.scale.y = 0.68;
        c.add(puff);
      }
      const a = rand(0, Math.PI * 2);
      const r = rand(19, 28);
      c.position.set(Math.cos(a) * r, rand(4.5, 9.5), Math.sin(a) * r);
      c.userData = { a, r, sp: rand(0.008, 0.02), y: c.position.y };
      this.scene.add(c);
      this.clouds.push(c);
    }
  }

  /* ---------- まわりに浮かぶ小島とクリスタル ---------- */

  _buildFloatingRocks() {
    this.floatRocks = [];
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xa9917c, flatShading: true });
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x8fd072, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const s = rand(0.5, 1.1);
      const rock = new THREE.Mesh(
        jitter(new THREE.DodecahedronGeometry(s, 0).toNonIndexed(), 0.2), rockMat);
      g.add(rock);
      const turf = new THREE.Mesh(
        jitter(new THREE.CylinderGeometry(s * 0.95, s * 1.05, s * 0.3, 9).toNonIndexed(), 0.06), grassMat);
      turf.position.y = s * 0.75;
      g.add(turf);
      if (i % 2 === 0) {
        const cry = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.35, 0),
          i % 4 === 0 ? this.crystalMat : this.crystalMat2);
        cry.scale.y = 2.0;
        cry.position.y = s * 1.2;
        g.add(cry);
      }
      const a = rand(0, Math.PI * 2);
      const r = rand(13.5, 21);
      g.position.set(Math.cos(a) * r, rand(-5, 0.5), Math.sin(a) * r);
      g.userData = { y0: g.position.y, ph: rand(0, 10), rs: rand(0.05, 0.16) };
      this.scene.add(g);
      this.floatRocks.push(g);
    }
  }

  /* ---------- 虹 ---------- */

  _buildRainbow() {
    this.rainbowU = { uAlpha: { value: 0 } };
    const rb = new THREE.Mesh(
      new THREE.TorusGeometry(6.2, 0.6, 10, 64, Math.PI),
      new THREE.ShaderMaterial({
        uniforms: this.rainbowU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: RAINBOW_FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      }));
    rb.position.set(-1.5, 0.5, -7.5);
    rb.rotation.y = 0.35;
    this.scene.add(rb);
    this._rainbowTimer = 0;
  }

  showRainbow() {
    this._rainbowTimer = 8; // 8秒間
  }

  /* ---------- フェーズ切替 ---------- */

  setPhase(idx, instant = false) {
    this._phase = idx;
    const P = PHASES[idx];
    this._target = P;
    if (instant) this._applyPhase(P, 1);
  }

  get phase() { return this._phase; }

  _applyPhase(P, k) {
    const U = this.skyU;
    U.uTopColor.value.lerp(_c.set(P.top), k);
    U.uHorizonColor.value.lerp(_c.set(P.horizon), k);
    U.uSunColor.value.lerp(_c.set(P.sunColor), k);
    U.uSunDir.value.lerp(P.sunDir, k).normalize();
    U.uNight.value += (P.night - U.uNight.value) * k;
    U.uSunGlow.value += (P.sunGlow - U.uSunGlow.value) * k;

    this.sun.color.lerp(_c.set(P.sunColor), k);
    this.sun.intensity += (P.sunInt - this.sun.intensity) * k;
    this.sun.position.copy(U.uSunDir.value).multiplyScalar(24);
    this.hemi.color.lerp(_c.set(P.hemiSky), k);
    this.hemi.groundColor.lerp(_c.set(P.hemiGround), k);
    this.hemi.intensity += (P.hemiInt - this.hemi.intensity) * k;
    this.amb.intensity += (P.ambInt - this.amb.intensity) * k;
    this.scene.fog.color.lerp(_c.set(P.fog), k);
    this.cloudMat.color.lerp(_c.set(P.cloud), k);
    this.cloudMat.emissive.lerp(_c.set(P.cloud), k);

    this.windowMat.emissiveIntensity += (P.window - this.windowMat.emissiveIntensity) * k;
    this.windowLight.intensity += (P.window * 1.8 - this.windowLight.intensity) * k;
    this.lampMat.emissiveIntensity += (P.lantern * 0.9 + 0.12 - this.lampMat.emissiveIntensity) * k;
    this.lanternLight.intensity += (P.lantern * 2.0 - this.lanternLight.intensity) * k;

    const night = U.uNight.value;
    this.waterU.uNight.value = night;
    this.fallU.uNight.value = night;
    this.starFlowerMat.emissiveIntensity = 0.25 + night * 1.7;
    this.crystalMat.emissiveIntensity = 0.55 + night * 1.1;
    this.crystalMat2.emissiveIntensity = 0.55 + night * 1.1;
  }

  get night() { return this.skyU.uNight.value; }

  /* ---------- 毎フレーム更新 ---------- */

  update(dt, t) {
    // フェーズをなめらかに補間
    this._applyPhase(this._target, 1 - Math.exp(-dt * 2.2));

    this.skyU.uTime.value = t;
    this.grassTime.value = t;
    this.waterU.uTime.value = t;
    this.fallU.uTime.value = t;

    // 雲がゆっくり流れる
    for (const c of this.clouds) {
      c.userData.a += c.userData.sp * dt;
      c.position.x = Math.cos(c.userData.a) * c.userData.r;
      c.position.z = Math.sin(c.userData.a) * c.userData.r;
      c.position.y = c.userData.y + Math.sin(t * 0.3 + c.userData.a * 5) * 0.3;
    }

    // 浮き島がふわふわ
    for (const g of this.floatRocks) {
      g.position.y = g.userData.y0 + Math.sin(t * 0.5 + g.userData.ph) * 0.45;
      g.rotation.y += g.userData.rs * dt;
    }

    // あひるがぷかぷか
    if (this.duck) {
      const d = this.duck;
      d.position.y = 0.1 + Math.sin(t * 1.7) * 0.03;
      d.rotation.y = Math.sin(t * 0.4) * 1.2 + 0.5;
      d.rotation.z = Math.sin(t * 1.7 + 1) * 0.06;
      const a = t * 0.25;
      d.position.x = this.pondCenter.x + Math.cos(a) * 0.75;
      d.position.z = this.pondCenter.z + Math.sin(a) * 0.75;
    }

    // 滝つぼの霧
    const mp = this.mist.geometry.attributes.position;
    for (let i = 0; i < this.mistSeeds.length; i++) {
      const s = this.mistSeeds[i];
      const life = ((t * s.sp + s.off) % 1);
      mp.setXYZ(i,
        this.mistBase.x + Math.cos(s.a) * s.r * (0.5 + life),
        this.mistBase.y + life * 2.2,
        this.mistBase.z + Math.sin(s.a) * s.r * (0.5 + life));
    }
    mp.needsUpdate = true;
    this.mist.material.opacity = 0.32 * (1 - this.night * 0.4);

    // お花の成長アニメ
    if (this._bloomT !== undefined && this._bloomT < 1.6) {
      this._bloomT += dt;
      let dirty = false;
      for (const f of this.flowerData) {
        const next = f.cur + (f.s - f.cur) * Math.min(dt * 4, 1);
        const wob = 1 + Math.sin(this._bloomT * 14) * 0.08 * Math.max(0, 1 - this._bloomT);
        f.cur = next * wob;
        dirty = true;
      }
      if (dirty) this._updateFlowerMatrices();
    }

    // 虹のフェード
    if (this._rainbowTimer > 0) {
      this._rainbowTimer -= dt;
      const a = Math.min(1, Math.min(this._rainbowTimer, 8 - this._rainbowTimer) * 1.2);
      this.rainbowU.uAlpha.value = Math.max(0, a);
    } else {
      this.rainbowU.uAlpha.value = Math.max(0, this.rainbowU.uAlpha.value - dt);
    }
  }
}

function g_setRandRot(mesh) {
  mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
}
