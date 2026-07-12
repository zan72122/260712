/* ============================================================
   util.js — 共通ユーティリティ
   グローバル名前空間 G / 数学 / 島の高さ関数 / テクスチャ生成 /
   パーティクルプール
   ============================================================ */
(function () {
  'use strict';

  const G = (window.G = {});

  /* ---------------- 数学ヘルパー ---------------- */
  G.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.smoothstep = (a, b, x) => {
    const t = G.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randInt = (a, b) => Math.floor(G.rand(a, b + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // 角度差を [-PI, PI] に正規化
  G.angleDelta = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  G.damp = (a, b, lambda, dt) => G.lerp(a, b, 1 - Math.exp(-lambda * dt));

  /* ---------------- 島の高さ関数 ----------------
     地形メッシュ・キャラクター接地・水シェーダーの浅瀬判定で
     同じ形を共有する（GLSL 側にも同式を移植している）。 */
  const HILL = { x: -15, z: -17, h: 7.0, r2: 110 };

  G.islandHeight = function (x, z) {
    const d = Math.sqrt(x * x * 0.85 + z * z * 1.18);
    const core = 1 - G.smoothstep(16, 44, d);
    let h = 6.0 * Math.pow(core, 1.35);
    // 北西の丘（とうだい・とりいのある高台）
    const hx = x - HILL.x, hz = z - HILL.z;
    h += HILL.h * Math.exp(-(hx * hx + hz * hz) / HILL.r2);
    // ゆるやかなうねり
    h += 0.55 * Math.sin(x * 0.32 + 1.7) * Math.sin(z * 0.27) * G.clamp(core * 2.2, 0, 1);
    // 島の外は海底へ
    h -= 2.6 * G.smoothstep(44, 56, d);
    h -= 3.5 * G.smoothstep(56, 95, d);
    return h;
  };

  /* ---------------- 桟橋（さんばし） ---------------- */
  G.PIER = {
    x: 7, halfW: 1.7,
    zStart: 36, zEnd: 60,
    deckY: 1.35,
  };
  G.onPier = function (x, z) {
    const p = G.PIER;
    return Math.abs(x - p.x) < p.halfW && z > p.zStart && z < p.zEnd;
  };
  // 立ち位置の地面高さ（桟橋上なら甲板の高さ）
  G.groundHeight = function (x, z) {
    const h = G.islandHeight(x, z);
    if (G.onPier(x, z)) return Math.max(h, G.PIER.deckY);
    return h;
  };

  /* ---------------- Canvas テクスチャ ---------------- */
  const texCache = {};

  // やわらかい円（パーティクル・雲・光もや用）
  G.softCircleTexture = function (size = 128, inner = 0.15, rgb = '255,255,255') {
    const key = `soft_${size}_${inner}_${rgb}`;
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.45, `rgba(${rgb},0.55)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    texCache[key] = tex;
    return tex;
  };

  // キラキラ星型スプライト
  G.sparkleTexture = function (size = 96) {
    const key = `sparkle_${size}`;
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2;
    ctx.translate(cx, cx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cx);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,240,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    // 4本の光条
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, cx * 0.97, cx * 0.13, (i * Math.PI) / 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, cx * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    texCache[key] = tex;
    return tex;
  };

  // ノイズテクスチャ（海面のきらめき用・タイル可能）
  G.noiseTexture = function (size = 256) {
    const key = `noise_${size}`;
    if (texCache[key]) return texCache[key];
    const data = new Uint8Array(size * size * 4);
    // 値ノイズを2オクターブ焼き込み
    const grid = 16;
    const vals = [];
    for (let i = 0; i <= grid; i++) {
      vals[i] = [];
      for (let j = 0; j <= grid; j++) vals[i][j] = Math.random();
    }
    const wrap = (i) => ((i % grid) + grid) % grid;
    const sample = (u, v) => {
      const gu = u * grid, gv = v * grid;
      const i = Math.floor(gu), j = Math.floor(gv);
      const fu = gu - i, fv = gv - j;
      const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
      const a = vals[wrap(i)][wrap(j)], b = vals[wrap(i + 1)][wrap(j)];
      const c2 = vals[wrap(i)][wrap(j + 1)], d = vals[wrap(i + 1)][wrap(j + 1)];
      return G.lerp(G.lerp(a, b, su), G.lerp(c2, d, su), sv);
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const n = sample(u, v) * 0.65 + sample(u * 3 % 1, v * 3 % 1) * 0.35;
        const val = Math.floor(n * 255);
        const idx = (y * size + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    texCache[key] = tex;
    return tex;
  };

  /* ---------------- パーティクルプール ----------------
     Points ベースの軽量プール。加算合成(きらめき/花火)と
     通常合成(しぶき/紙ふぶき)の2系統。 */
  class ParticlePool {
    constructor(scene, capacity, opts = {}) {
      this.capacity = capacity;
      this.positions = new Float32Array(capacity * 3);
      this.colors = new Float32Array(capacity * 3);
      this.sizes = new Float32Array(capacity);
      this.vel = new Float32Array(capacity * 3);
      this.life = new Float32Array(capacity);      // 残り寿命
      this.maxLife = new Float32Array(capacity);
      this.gravity = new Float32Array(capacity);
      this.drag = new Float32Array(capacity);
      this.baseSize = new Float32Array(capacity);
      this.cursor = 0;
      this.aliveCount = 0;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: opts.texture || G.softCircleTexture() },
          uScale: { value: 1.0 },
        },
        vertexShader: `
          attribute float size;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (240.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uTex;
          varying vec3 vColor;
          void main() {
            vec4 t = texture2D(uTex, gl_PointCoord);
            gl_FragColor = vec4(vColor * t.rgb, t.a);
            if (gl_FragColor.a < 0.01) discard;
          }`,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });

      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      scene.add(this.points);
      // 全パーティクルを画面外へ
      for (let i = 0; i < capacity; i++) {
        this.positions[i * 3 + 1] = -9999;
        this.life[i] = 0;
      }
    }

    /** 1粒放出 */
    emit(x, y, z, vx, vy, vz, life, size, color, gravity = 0, drag = 0) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      this.vel[i * 3] = vx;
      this.vel[i * 3 + 1] = vy;
      this.vel[i * 3 + 2] = vz;
      this.life[i] = life;
      this.maxLife[i] = life;
      this.baseSize[i] = size;
      this.gravity[i] = gravity;
      this.drag[i] = drag;
      this.colors[i * 3] = color.r;
      this.colors[i * 3 + 1] = color.g;
      this.colors[i * 3 + 2] = color.b;
    }

    /** バースト放出 */
    burst(x, y, z, count, cfg) {
      const col = new THREE.Color();
      for (let n = 0; n < count; n++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(G.rand(-1, 1));
        const spd = G.rand(cfg.speedMin ?? 1, cfg.speedMax ?? 3);
        let vx = Math.sin(phi) * Math.cos(theta) * spd;
        let vy = Math.cos(phi) * spd * (cfg.upBias ?? 1);
        let vz = Math.sin(phi) * Math.sin(theta) * spd;
        if (cfg.minUp !== undefined) vy = Math.max(vy, cfg.minUp);
        if (Array.isArray(cfg.color)) col.set(G.pick(cfg.color));
        else col.set(cfg.color ?? 0xffffff);
        if (cfg.colorJitter) {
          col.offsetHSL(G.rand(-cfg.colorJitter, cfg.colorJitter), 0, G.rand(-0.08, 0.08));
        }
        this.emit(
          x + G.rand(-(cfg.spread ?? 0), cfg.spread ?? 0),
          y + G.rand(-(cfg.spread ?? 0), cfg.spread ?? 0) * 0.4,
          z + G.rand(-(cfg.spread ?? 0), cfg.spread ?? 0),
          vx, vy, vz,
          G.rand(cfg.lifeMin ?? 0.5, cfg.lifeMax ?? 1.2),
          G.rand(cfg.sizeMin ?? 0.5, cfg.sizeMax ?? 1.2),
          col,
          cfg.gravity ?? 0,
          cfg.drag ?? 0
        );
      }
    }

    update(dt) {
      const p = this.positions, v = this.vel;
      for (let i = 0; i < this.capacity; i++) {
        if (this.life[i] <= 0) continue;
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          p[i * 3 + 1] = -9999;
          this.sizes[i] = 0;
          continue;
        }
        v[i * 3 + 1] -= this.gravity[i] * dt;
        if (this.drag[i] > 0) {
          const k = Math.exp(-this.drag[i] * dt);
          v[i * 3] *= k; v[i * 3 + 1] *= k; v[i * 3 + 2] *= k;
        }
        p[i * 3] += v[i * 3] * dt;
        p[i * 3 + 1] += v[i * 3 + 1] * dt;
        p[i * 3 + 2] += v[i * 3 + 2] * dt;
        const t = this.life[i] / this.maxLife[i];
        this.sizes[i] = this.baseSize[i] * (t < 0.75 ? t / 0.75 * 0.4 + 0.6 : 1.0) * Math.min(1, t * 4);
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.size.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
  G.ParticlePool = ParticlePool;

  /* ---------------- 共有ステート ---------------- */
  G.state = {
    started: false,
    // 時刻 0..1（0=よあけ, 0.3=ひる, 0.68=ゆうやけ, 0.88=よる）
    time: 0.22,
    timeSpeed: 1 / 420, // 1周420秒
    counts: {},         // ずかんカウント
    totalCaught: 0,
    muted: false,
    busy: false,        // つり・イベント中は移動不可
  };

  /* ---------------- 環境（空が毎フレーム更新） ---------------- */
  G.env = {
    sunDir: new THREE.Vector3(0, 1, 0),
    sunColor: new THREE.Color(1, 1, 1),
    skyHorizon: new THREE.Color(0.7, 0.85, 1),
    skyTop: new THREE.Color(0.2, 0.5, 0.9),
    fogColor: new THREE.Color(0.7, 0.85, 1),
    dayLight: 1,   // 0=よる 1=まひる
    nightGlow: 0,  // 1=よる（ちょうちん・ほたる用）
    sunsetGlow: 0, // 1=ゆうやけ
  };
})();
