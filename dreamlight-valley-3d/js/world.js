/* =========================================================================
 * きらきら ドリームバレー — ワールド生成
 * 地形 / 空 / 海と川 / 滝 / お城 / 村 / 桜 / 花畑 / 光るキノコ / 虹 …
 * すべてプロシージャル生成（外部アセットなし）
 * ========================================================================= */
(function () {
  'use strict';

  const DV = (window.DV = window.DV || {});

  /* ============================ ユーティリティ ============================ */
  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    // GLSL と同じ smoothstep（edge0 > edge1 でも逆勾配として動く）
    sstep(e0, e1, x) {
      const t = U.clamp((x - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    },
    gauss: (t) => Math.exp(-t * t),
    // sRGB で色指定 → リニアに変換（最終段の GammaCorrection と対になる）
    C(hex) { return new THREE.Color(hex).convertSRGBToLinear(); },
    // 決定論的乱数（ワールドを毎回同じ形にする）
    mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash2(x, z) {
      const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
      return s - Math.floor(s);
    },
    makeTex(size, draw) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      draw(c.getContext('2d'), size);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 2;
      return t;
    },
  };
  DV.U = U;

  /* ============================ 共有テクスチャ ============================ */
  const Tex = {};
  DV.Tex = Tex;

  function buildTextures() {
    // やわらかい光の玉
    Tex.glow = U.makeTex(128, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.35, 'rgba(255,255,255,.55)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });
    // 4 方向のきらめき
    Tex.sparkle = U.makeTex(128, (g, s) => {
      const c = s / 2;
      const r = g.createRadialGradient(c, c, 0, c, c, c);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.25, 'rgba(255,255,255,.4)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.beginPath();
      g.moveTo(c, 4); g.quadraticCurveTo(c + 7, c, s - 4, c);
      g.quadraticCurveTo(c + 7, c + 7, c, s - 4);
      g.quadraticCurveTo(c - 7, c + 7, 4, c);
      g.quadraticCurveTo(c - 7, c - 7, c, 4);
      g.fill();
    });
    // ハート
    Tex.heart = U.makeTex(128, (g, s) => {
      g.translate(s / 2, s / 2);
      g.scale(s / 32, s / 32);
      g.fillStyle = '#ff6fa5';
      g.strokeStyle = 'rgba(255,255,255,.9)';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(0, 10);
      g.bezierCurveTo(-14, -2, -9, -13, 0, -6);
      g.bezierCurveTo(9, -13, 14, -2, 0, 10);
      g.closePath();
      g.fill(); g.stroke();
    });
    // 花びら
    Tex.petal = U.makeTex(64, (g, s) => {
      g.translate(s / 2, s / 2);
      g.rotate(0.6);
      const r = g.createRadialGradient(0, 0, 2, 0, 0, s / 2);
      r.addColorStop(0, '#fff0f6');
      r.addColorStop(1, '#ffb7d5');
      g.fillStyle = r;
      g.beginPath();
      g.ellipse(0, 0, s * 0.34, s * 0.2, 0, 0, Math.PI * 2);
      g.fill();
    });
    // 星（5 角）
    Tex.star = U.makeTex(128, (g, s) => {
      const c = s / 2, R = s * 0.42, r2 = R * 0.45;
      g.translate(c, c);
      g.fillStyle = '#fff7c2';
      g.shadowColor = '#ffe36e'; g.shadowBlur = 16;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? R : r2;
        g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath(); g.fill();
    });
    // 花（正面向き）
    Tex.flower = U.makeTex(128, (g, s) => {
      const c = s / 2;
      g.translate(c, c);
      for (let i = 0; i < 5; i++) {
        g.save();
        g.rotate((i / 5) * Math.PI * 2);
        const r = g.createRadialGradient(0, -s * 0.22, 2, 0, -s * 0.22, s * 0.22);
        r.addColorStop(0, '#ffffff');
        r.addColorStop(1, '#ffd1e8');
        g.fillStyle = r;
        g.beginPath();
        g.ellipse(0, -s * 0.24, s * 0.15, s * 0.23, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.fillStyle = '#ffd24a';
      g.beginPath(); g.arc(0, 0, s * 0.12, 0, Math.PI * 2); g.fill();
    });
    // 雲
    Tex.cloud = U.makeTex(256, (g, s) => {
      g.clearRect(0, 0, s, s);
      const puffs = [
        [0.5, 0.55, 0.30], [0.32, 0.6, 0.22], [0.68, 0.6, 0.22],
        [0.42, 0.45, 0.20], [0.58, 0.44, 0.18], [0.22, 0.66, 0.14], [0.78, 0.66, 0.13],
      ];
      puffs.forEach(([x, y, r]) => {
        const gr = g.createRadialGradient(x * s, y * s, 1, x * s, y * s, r * s);
        gr.addColorStop(0, 'rgba(255,255,255,.95)');
        gr.addColorStop(0.7, 'rgba(255,255,255,.5)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x * s, y * s, r * s, 0, Math.PI * 2); g.fill();
      });
    });
  }

  /* ============================ 地形の高さ ============================ */
  const ISLAND_R = 95;
  const SEA_Y = 0.35;

  function riverX(z) { return -30 + (z + 45) * 0.35 + 7 * Math.sin(z * 0.07); }

  function riverDist(x, z) {
    if (z < -46) return 999;
    return Math.abs(x - riverX(z));
  }

  function terrainHeight(x, z) {
    const r = Math.hypot(x, z);
    let h = 2.2
      + 2.6 * Math.sin(x * 0.043 + 1.3) * Math.cos(z * 0.038 - 0.8)
      + 1.4 * Math.sin(x * 0.085 - 0.4) * Math.sin(z * 0.07 + 2.0)
      + 0.45 * Math.sin(x * 0.21) * Math.cos(z * 0.19);
    // お城の丘（南東）
    h += 6.5 * U.gauss((x - 48) / 16) * U.gauss((z - 28) / 16);
    // 北の岩山（滝のある山）
    h += 9.0 * U.gauss((x + 34) / 20) * U.gauss((z + 52) / 18);
    h += 5.0 * U.gauss((x - 8) / 24) * U.gauss((z + 62) / 20);
    // 村の広場をなだらかに
    const v = U.gauss((x + 15) / 14) * U.gauss((z - 18) / 14);
    h = U.lerp(h, 1.8, U.clamp(v * 1.5, 0, 1));
    // お城の前庭をなだらかに
    const cf = U.gauss((x - 46) / 8) * U.gauss((z - 26) / 8);
    h = U.lerp(h, 8.4, U.clamp(cf * 1.3, 0, 1));
    // 島のふちは海へ沈む
    h = U.lerp(-6, h, U.sstep(ISLAND_R, 62, r));
    // 湖
    const dl = Math.hypot(x + 30, z + 45);
    h = U.lerp(-2.6, h, U.sstep(6.5, 13, dl));
    // 川（浅くして歩いて渡れるように）
    h = U.lerp(-1.0, h, U.sstep(2.6, 6.5, riverDist(x, z)));
    return h;
  }

  // 橋のデッキ高さ（範囲外なら null）
  const BRIDGE = { z: 15, x0: -8.5, x1: 3.5, halfW: 2.3 };
  function bridgeHeight(x, z) {
    if (Math.abs(z - BRIDGE.z) > BRIDGE.halfW) return null;
    if (x < BRIDGE.x0 || x > BRIDGE.x1) return null;
    const cx = (BRIDGE.x0 + BRIDGE.x1) / 2, half = (BRIDGE.x1 - BRIDGE.x0) / 2;
    const u = U.clamp((x - cx) / half, -1, 1);
    return 1.45 + 0.85 * Math.cos(u * Math.PI / 2);
  }

  // キャラクターが立つ高さ（橋の上を優先）
  function walkHeight(x, z) {
    const h = terrainHeight(x, z);
    const b = bridgeHeight(x, z);
    return b !== null ? Math.max(h, b) : h;
  }

  /* ============================ 道 ============================ */
  const PATHS = [
    // 村 → 橋 → お城
    [[-15, 18], [-6, 15.5], [1, 15.5], [10, 18], [24, 22], [38, 26], [46, 27]],
    // 村 → 湖（滝）
    [[-15, 18], [-22, 6], [-27, -10], [-29, -26], [-29, -36]],
    // 村 → 南のビーチ
    [[-13, 22], [-8, 36], [-3, 50], [1, 64]],
    // 橋 → キノコの森
    [[10, 18], [16, 2], [22, -16], [25, -32]],
  ];

  function segDist(px, pz, ax, az, bx, bz) {
    const abx = bx - ax, abz = bz - az;
    const t = U.clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz), 0, 1);
    const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
    return Math.hypot(dx, dz);
  }

  function pathDist(x, z) {
    let d = 999;
    for (const p of PATHS)
      for (let i = 0; i < p.length - 1; i++)
        d = Math.min(d, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
    return d;
  }

  /* ============================ World 本体 ============================ */
  const World = {
    ISLAND_R, SEA_Y, BRIDGE,
    height: terrainHeight,
    walkHeight,
    bridgeHeight,
    riverDist,
    pathDist,
    uniforms: {
      uTime: { value: 0 },
      uDay: { value: 1 },       // 1=昼, 0=夜
    },
    nightGlowMats: [],           // 夜に光るマテリアル [{mat, day, night}]
    fruitTrees: [],              // タップでゆれる木
    lakePos: new THREE.Vector3(-30, SEA_Y, -45),
    waterfallPos: new THREE.Vector3(-30.5, 4.5, -54),
    castlePos: new THREE.Vector3(48, 0, 30),
    rainbow: null,
    _updaters: [],
  };
  DV.World = World;

  /* ============================ 空 ============================ */
  function buildSky(scene) {
    const geo = new THREE.SphereGeometry(430, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uDay: World.uniforms.uDay,
        uTime: World.uniforms.uTime,
        uSunDir: { value: new THREE.Vector3(0.35, 0.55, 0.55).normalize() },
        uMoonDir: { value: new THREE.Vector3(-0.4, 0.6, -0.4).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uDay, uTime;
        uniform vec3 uSunDir, uMoonDir;
        varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y * .5 + .5;
          // 昼：上=青 下=クリーム / 夜：上=紺 下=紫
          vec3 dayTop = vec3(.30,.62,.94), dayHor = vec3(.96,.90,.82);
          vec3 nightTop = vec3(.035,.05,.16), nightHor = vec3(.18,.15,.34);
          vec3 dayCol   = mix(dayHor,  dayTop,  smoothstep(.42,.85,h));
          vec3 nightCol = mix(nightHor,nightTop,smoothstep(.42,.9,h));
          vec3 col = mix(nightCol, dayCol, uDay);
          // 太陽まわりのあたたかな光
          float sd = max(dot(d, normalize(uSunDir)), 0.);
          col += uDay * (vec3(1.,.85,.55) * pow(sd, 8.) * .35 + vec3(1.,.95,.8) * pow(sd, 90.) * .8);
          // 地平線のピーチ色（昼）
          col += uDay * vec3(.5,.25,.12) * pow(1.-abs(d.y), 6.) * .5;
          // 月の光
          float md = max(dot(d, normalize(uMoonDir)), 0.);
          col += (1.-uDay) * vec3(.7,.75,.95) * pow(md, 24.) * .5;
          // 星（夜）
          vec2 sp = d.xz / (abs(d.y) + .3) * 38.;
          vec2 cell = floor(sp);
          float star = step(.985, hash(cell));
          vec2 f = fract(sp) - .5;
          float twinkle = .55 + .45 * sin(uTime * (2. + hash(cell+7.) * 3.) + hash(cell) * 40.);
          star *= smoothstep(.35, .05, length(f)) * twinkle;
          col += (1.-uDay) * vec3(1.,.98,.9) * star * step(.05, d.y);
          // 天の川風のうすい帯
          float band = exp(-pow((d.y - .35 + d.x*.2) * 4., 2.));
          col += (1.-uDay) * vec3(.16,.16,.28) * band * .5;
          gl_FragColor = vec4(col, 1.);
        }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    scene.add(sky);
    World.skyMat = mat;
    return mat;
  }

  /* ============================ 水面 ============================ */
  function buildWater(scene) {
    const geo = new THREE.PlaneGeometry(520, 520, 110, 110);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDay: { value: 1 },
          uSunDir: { value: new THREE.Vector3(0.35, 0.55, 0.55).normalize() },
          uShallow: { value: U.C(0x64d8e8) },
          uDeep: { value: U.C(0x1b6fc2) },
          uNightShallow: { value: U.C(0x1c4a70) },
          uNightDeep: { value: U.C(0x0a1e42) },
        },
      ]),
      vertexShader: `
        #include <fog_pars_vertex>
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        void main() {
          vec3 p = position;
          float t = uTime;
          float w1 = sin(p.x * .12 + t * 1.1) * cos(p.z * .10 + t * .8);
          float w2 = sin(p.x * .05 - t * .6 + p.z * .07) ;
          p.y += w1 * .09 + w2 * .12;
          vec4 wp = modelMatrix * vec4(p, 1.);
          vWorldPos = wp.xyz;
          // 波の傾きから法線を近似
          float e = .6;
          float hx = cos(p.x*.12 + t*1.1)*.12*cos(p.z*.10+t*.8)*.09 + cos(p.x*.05 - t*.6 + p.z*.07)*.05*.12;
          float hz = -sin(p.x*.12 + t*1.1)*sin(p.z*.10+t*.8)*.10*.09 + cos(p.x*.05 - t*.6 + p.z*.07)*.07*.12;
          vNormalW = normalize(vec3(-hx*6., 1., -hz*6.));
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime, uDay;
        uniform vec3 uSunDir, uShallow, uDeep, uNightShallow, uNightDeep;
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormalW);
          float fres = pow(1. - max(dot(V, N), 0.), 2.2);
          vec3 shallow = mix(uNightShallow, uShallow, uDay);
          vec3 deep    = mix(uNightDeep,    uDeep,    uDay);
          vec3 col = mix(shallow, deep, clamp(fres * 1.15, 0., 1.));
          // 太陽・月のきらめき
          vec3 L = normalize(uSunDir);
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.), 260.);
          col += mix(vec3(.6,.7,1.2), vec3(1.4,1.25,.9), uDay) * spec * .55;
          // 水面のラメ
          vec2 sp = vWorldPos.xz * 1.4 + uTime * .35;
          float sparkle = pow(hash(floor(sp)), 24.) * smoothstep(.4,.0,length(fract(sp)-.5));
          col += sparkle * mix(.3, .65, uDay) * vec3(1.,1.,.95);
          float alpha = .84;
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = SEA_Y;
    mesh.renderOrder = 2;
    scene.add(mesh);
    World.waterMat = mat;
    World._updaters.push((t) => { mat.uniforms.uTime.value = t; });
    return mesh;
  }

  /* ============================ 地形 ============================ */
  function buildTerrain(scene) {
    const SIZE = 250, SEG = 190;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // パレット（sRGB → linear）
    const cSandDeep = U.C(0x7fb3a0);
    const cSand = U.C(0xecd9a0);
    const cGrassL = U.C(0x74cb54);
    const cGrass = U.C(0x4fb648);
    const cGrassD = U.C(0x3a9c44);
    const col = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;

    const cRockL = U.C(0xb0aa9c);
    const cRockD = U.C(0x847f72);
    const cPath = U.C(0xe0c288);
    const cFlowerTint = U.C(0x93d668);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = pos.getY(i);
      const ny = nrm.getY(i);
      const n = U.hash2(x * 0.6, z * 0.6);
      const n2 = U.hash2(x * 0.13 + 5, z * 0.13 + 9);

      if (h < -0.6) {
        col.copy(cSandDeep).lerp(cSand, U.sstep(-3.5, -0.6, h));
      } else if (h < 0.85) {
        col.copy(cSand);
        col.lerp(cGrassL, U.sstep(0.55, 0.85, h));
      } else {
        // 草：高さとノイズでむらを出す
        col.copy(cGrassL).lerp(cGrass, U.clamp(n2 * 0.9 + (h - 1) * 0.06, 0, 1));
        col.lerp(cGrassD, U.clamp((h - 4.5) * 0.12 + n * 0.25 - 0.1, 0, 1) * 0.8);
        // 高い所・急な斜面は岩
        const rockAmt = Math.max(U.sstep(0.86, 0.72, ny), U.sstep(8.5, 11.5, h));
        if (rockAmt > 0) col.lerp(n > 0.5 ? cRockL : cRockD, rockAmt * 0.9);
      }
      // 道
      const pd = pathDist(x, z);
      if (pd < 1.9 && h > 0.5) {
        col.lerp(cPath, U.sstep(1.9, 1.0, pd) * 0.8 * (0.8 + n * 0.2));
      }
      // 花畑のほんのり明るい下地
      const f1 = U.gauss((x - 20) / 13) * U.gauss((z - 45) / 11);
      const f2 = U.gauss((x + 4) / 10) * U.gauss((z + 12) / 10);
      col.lerp(cFlowerTint, U.clamp((f1 + f2) * 0.8, 0, 0.5));
      // 全体に微妙な明度ゆらぎ
      const b = 0.94 + n * 0.09;
      colors[i * 3] = col.r * b;
      colors[i * 3 + 1] = col.g * b;
      colors[i * 3 + 2] = col.b * b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  /* ============================ 植生シェーダー ============================ */
  function vegetationMaterial(tex, opts = {}) {
    const mat = new THREE.ShaderMaterial({
      transparent: !!tex,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: World.uniforms.uTime,
          uDay: World.uniforms.uDay,
          uMap: { value: tex || null },
          uSway: { value: opts.sway !== undefined ? opts.sway : 0.25 },
          uNightDim: { value: opts.nightDim !== undefined ? opts.nightDim : 0.32 },
        },
      ]),
      vertexShader: `
        #include <fog_pars_vertex>
        attribute vec3 aColor;
        attribute float aPhase;
        uniform float uTime, uSway;
        varying vec2 vUv;
        varying vec3 vColor;
        varying vec3 vNormalW;
        varying float vViewZ;
        void main() {
          vUv = uv;
          vColor = aColor;
          vNormalW = normalize(mat3(instanceMatrix) * normal);
          vec3 p = position;
          vec4 wp = instanceMatrix * vec4(p, 1.);
          // 上部ほど風でゆれる
          float sway = uSway * max(position.y, 0.) ;
          wp.x += sin(uTime * 1.7 + aPhase + wp.z * .12) * sway;
          wp.z += cos(uTime * 1.3 + aPhase * 1.7 + wp.x * .1) * sway * .6;
          vec4 world = modelMatrix * wp;
          vec4 mvPosition = viewMatrix * world;
          vViewZ = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform sampler2D uMap;
        uniform float uDay, uNightDim;
        varying vec2 vUv;
        varying vec3 vColor;
        varying vec3 vNormalW;
        varying float vViewZ;
        void main() {
          vec4 tx = ${tex ? 'texture2D(uMap, vUv)' : 'vec4(1.)'};
          if (tx.a < 0.4) discard;
          // カメラのすぐ前はディザで溶かして視界を守る
          float nearFade = smoothstep(1.2, 4.5, vViewZ);
          if (nearFade < .99) {
            float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            if (dith > nearFade) discard;
          }
          // やわらかい擬似ライティング（太陽方向は固定）
          vec3 N = normalize(vNormalW);
          vec3 L = normalize(vec3(.55, .85, .62));
          float lit = .58 + .42 * max(dot(N, L), 0.);
          lit *= .88 + .12 * clamp(N.y, 0., 1.);
          vec3 col = tx.rgb * vColor * lit;
          col *= mix(uNightDim, 1.0, uDay);
          gl_FragColor = vec4(col, tx.a);
          #include <fog_fragment>
        }`,
    });
    // UniformsUtils.merge はクローンするので、共有 uniform を貼り直す
    mat.uniforms.uTime = World.uniforms.uTime;
    mat.uniforms.uDay = World.uniforms.uDay;
    return mat;
  }

  // InstancedMesh に色と位相の属性を付けるヘルパー
  function makeInstanced(geo, mat, items, scene, opts = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const colorArr = new Float32Array(items.length * 3);
    const phaseArr = new Float32Array(items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    items.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      q.setFromEuler(e);
      s.set(it.s || 1, it.sy || it.s || 1, it.s || 1);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, s);
      mesh.setMatrixAt(i, m);
      const c = it.color;
      colorArr[i * 3] = c.r; colorArr[i * 3 + 1] = c.g; colorArr[i * 3 + 2] = c.b;
      phaseArr[i] = it.phase !== undefined ? it.phase : Math.random() * Math.PI * 2;
    });
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colorArr, 3));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phaseArr, 1));
    mesh.instanceMatrix.needsUpdate = true;
    if (opts.shadow) mesh.castShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  /* ============================ 草と花 ============================ */
  function scatterOK(x, z, minH, maxH) {
    const h = terrainHeight(x, z);
    if (h < minH || h > maxH) return false;
    if (riverDist(x, z) < 4.5) return false;
    if (pathDist(x, z) < 2.8) return false;
    if (Math.hypot(x + 30, z + 45) < 14) return false;      // 湖
    if (Math.hypot(x - 48, z - 30) < 9) return false;       // お城
    return true;
  }

  function buildGrassAndFlowers(scene, rng) {
    // ---- 草（先細りの三角ブレード 2 枚クロス） ----
    const grassGeo = new THREE.BufferGeometry();
    {
      const w = 0.17, h = 1.0;
      const pos = new Float32Array([
        -w, 0, 0, w, 0, 0, 0, h, 0,
        0, 0, -w, 0, 0, w, 0, h, 0,
      ]);
      const nor = new Float32Array([
        0, 0, 1, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 0, 1, 0, 0,
      ]);
      const uv = new Float32Array([0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1]);
      grassGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      grassGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      grassGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      grassGeo.setIndex([0, 1, 2, 3, 4, 5]);
    }
    const grassItems = [];
    const gA = U.C(0x79d95f), gB = U.C(0x4fb84f), gC = U.C(0xa5e878);
    for (let i = 0; i < 2600; i++) {
      const x = (rng() - 0.5) * 180, z = (rng() - 0.5) * 180;
      if (!scatterOK(x, z, 0.9, 8.5)) continue;
      const c = new THREE.Color().copy(gA).lerp(rng() > 0.5 ? gB : gC, rng());
      grassItems.push({ x, y: terrainHeight(x, z) - 0.05, z, ry: rng() * Math.PI, s: 0.7 + rng() * 0.9, color: c });
    }
    makeInstanced(grassGeo, vegetationMaterial(null, { sway: 0.16 }), grassItems, scene);

    // ---- 花（十字ビルボード風） ----
    const fg1 = new THREE.PlaneGeometry(0.62, 0.62);
    const fg2 = fg1.clone().rotateY(Math.PI / 2);
    const flowerGeo = mergeGeos([fg1, fg2]);
    flowerGeo.translate(0, 0.4, 0);
    const flowerItems = [];
    const palette = [0xff90bd, 0xffd24a, 0xffffff, 0xc59bff, 0xff8368, 0x7ec8ff].map((h) => U.C(h));
    const fields = [[20, 45, 14], [-4, -12, 11], [-15, 18, 16], [34, 10, 10]];
    for (let i = 0; i < 620; i++) {
      let x, z;
      if (i < 460) {
        const f = fields[i % fields.length];
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * f[2];
        x = f[0] + Math.cos(a) * r; z = f[1] + Math.sin(a) * r;
      } else {
        x = (rng() - 0.5) * 170; z = (rng() - 0.5) * 170;
      }
      if (!scatterOK(x, z, 0.9, 7.5)) continue;
      const c = new THREE.Color().copy(palette[(rng() * palette.length) | 0]);
      c.lerp(new THREE.Color(1, 1, 1), 0.22);
      c.multiplyScalar(0.95 + rng() * 0.2);
      flowerItems.push({ x, y: terrainHeight(x, z) - 0.02, z, ry: rng() * Math.PI, s: 0.75 + rng() * 0.7, color: c });
    }
    makeInstanced(flowerGeo, vegetationMaterial(Tex.flower, { sway: 0.2 }), flowerItems, scene);
  }

  // BufferGeometry の単純マージ（position/normal/uv）
  function mergeGeos(geos) {
    let vCount = 0, iCount = 0;
    geos.forEach((g) => { vCount += g.attributes.position.count; iCount += g.index.count; });
    const merged = new THREE.BufferGeometry();
    const pos = new Float32Array(vCount * 3);
    const nor = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    const idx = new (vCount > 65535 ? Uint32Array : Uint16Array)(iCount);
    let vo = 0, io = 0;
    geos.forEach((g) => {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += g.attributes.position.count;
      io += gi.length;
    });
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    merged.setIndex(new THREE.BufferAttribute(idx, 1));
    return merged;
  }
  DV.mergeGeos = mergeGeos;

  /* ============================ 木 ============================ */
  function buildTrees(scene, rng) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 2.4, 7);
    trunkGeo.translate(0, 1.2, 0);
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    const coneGeo = new THREE.ConeGeometry(1.15, 2.2, 8);

    const trunks = [], puffs = [], cones = [];
    const cTrunk = U.C(0x8a5a3a), cTrunkD = U.C(0x6e4530);
    const greens = [0x53c258, 0x3fae52, 0x6fd066, 0x47b860].map((h) => U.C(h));
    const pinks = [0xffb3d9, 0xffc4e1, 0xff9ecb, 0xffd3ea].map((h) => U.C(h));
    const pineG = [0x2f9e57, 0x2a8c50, 0x38ab5e].map((h) => U.C(h));

    const treeSpots = [];
    function findSpot(cx, cz, spread, minH, maxH, tries) {
      for (let k = 0; k < (tries || 24); k++) {
        const x = cx + (rng() - 0.5) * spread, z = cz + (rng() - 0.5) * spread;
        if (!scatterOK(x, z, minH, maxH)) continue;
        if (treeSpots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 5.5)) continue;
        treeSpots.push([x, z]);
        return [x, z, terrainHeight(x, z)];
      }
      return null;
    }

    function addTrunk(x, y, z, s, tint) {
      trunks.push({ x, y, z, ry: rng() * 3, s, sy: s * (0.9 + rng() * 0.3), color: tint });
    }

    // 桜（村のまわり）
    const cherryCenters = [[-24, 26], [-6, 26], [-20, 8], [-2, 6], [8, 28], [-30, 18]];
    for (const [cx, cz] of cherryCenters) {
      const sp = findSpot(cx, cz, 10, 0.9, 6, 30);
      if (!sp) continue;
      const [x, z, h] = sp;
      const s = 1.1 + rng() * 0.5;
      addTrunk(x, h, z, s, cTrunk);
      const nP = 4 + ((rng() * 2) | 0);
      for (let p = 0; p < nP; p++) {
        const a = (p / nP) * Math.PI * 2 + rng();
        const rr = p === 0 ? 0 : 0.85 * s;
        puffs.push({
          x: x + Math.cos(a) * rr, y: h + 2.6 * s + (rng() - 0.4) * 0.8 * s, z: z + Math.sin(a) * rr,
          s: (1.15 + rng() * 0.65) * s, color: pinks[(rng() * pinks.length) | 0],
        });
      }
    }

    // ひろばの葉の木（フルーツの木を兼ねる）
    for (let i = 0; i < 26; i++) {
      const sp = findSpot((rng() - 0.5) * 150, (rng() - 0.5) * 150, 60, 0.9, 6.5);
      if (!sp) continue;
      const [x, z, h] = sp;
      const s = 1.0 + rng() * 0.6;
      addTrunk(x, h, z, s, rng() > 0.5 ? cTrunk : cTrunkD);
      const nP = 3 + ((rng() * 3) | 0);
      const g = greens[(rng() * greens.length) | 0];
      for (let p = 0; p < nP; p++) {
        const a = (p / nP) * Math.PI * 2 + rng();
        const rr = p === 0 ? 0 : 0.8 * s;
        puffs.push({
          x: x + Math.cos(a) * rr, y: h + 2.5 * s + (rng() - 0.4) * 0.7 * s, z: z + Math.sin(a) * rr,
          s: (1.1 + rng() * 0.6) * s,
          color: new THREE.Color().copy(g).multiplyScalar(0.9 + rng() * 0.25),
        });
      }
      // 最初の 10 本はフルーツの木
      if (World.fruitTrees.length < 10) {
        World.fruitTrees.push({ x, z, h, s, apples: [], shake: 0, regrow: 0 });
      }
    }

    // 松（北の山側）
    for (let i = 0; i < 22; i++) {
      const sp = findSpot(-10 + (rng() - 0.5) * 110, -48 + (rng() - 0.5) * 60, 60, 1.2, 10.5);
      if (!sp) continue;
      const [x, z, h] = sp;
      const s = 0.9 + rng() * 0.8;
      addTrunk(x, h, z, s * 0.8, cTrunkD);
      const g = pineG[(rng() * pineG.length) | 0];
      for (let lv = 0; lv < 3; lv++) {
        cones.push({
          x, y: h + (1.7 + lv * 1.25) * s, z,
          s: (1.35 - lv * 0.33) * s, sy: s * 1.0, color: g, ry: rng(),
        });
      }
    }

    const trunkMat = vegetationMaterial(null, { sway: 0.0, nightDim: 0.3 });
    const puffMat = vegetationMaterial(null, { sway: 0.12, nightDim: 0.3 });
    const pineMat = vegetationMaterial(null, { sway: 0.06, nightDim: 0.28 });
    makeInstanced(trunkGeo, trunkMat, trunks, scene, { shadow: true });
    makeInstanced(puffGeo, puffMat, puffs, scene, { shadow: true });
    makeInstanced(coneGeo, pineMat, cones, scene, { shadow: true });
  }

  /* ============================ フルーツ（りんご） ============================ */
  function buildApples(scene) {
    const geo = new THREE.SphereGeometry(0.28, 10, 8);
    const mat = new THREE.MeshLambertMaterial({ color: U.C(0xff4d4d) });
    const leafGeo = new THREE.SphereGeometry(0.1, 6, 4);
    const leafMat = new THREE.MeshLambertMaterial({ color: U.C(0x3fae52) });
    World.fruitTrees.forEach((tree) => {
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Group();
        const a = new THREE.Mesh(geo, mat);
        const l = new THREE.Mesh(leafGeo, leafMat);
        l.position.y = 0.28; l.scale.set(1.6, 0.7, 1);
        g.add(a); g.add(l);
        const ang = (i / 3) * Math.PI * 2 + tree.x;
        g.position.set(
          tree.x + Math.cos(ang) * 1.1 * tree.s,
          tree.h + 2.2 * tree.s + Math.sin(i * 7) * 0.4,
          tree.z + Math.sin(ang) * 1.1 * tree.s
        );
        g.userData = { state: 'onTree', vy: 0, tree, home: g.position.clone() };
        scene.add(g);
        tree.apples.push(g);
      }
    });
  }

  /* ============================ 岩 ============================ */
  function buildRocks(scene, rng) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const items = [];
    const cA = U.C(0xa8a296), cB = U.C(0x8b8578), cC = U.C(0xbdb8ac);
    for (let i = 0; i < 46; i++) {
      const x = (rng() - 0.5) * 185, z = (rng() - 0.5) * 185;
      const h = terrainHeight(x, z);
      if (h < 0.4 || h > 11) continue;
      if (pathDist(x, z) < 3) continue;
      const cs = [cA, cB, cC][(rng() * 3) | 0];
      items.push({
        x, y: h - 0.2, z, ry: rng() * 3, rx: rng() * 0.4, s: 0.4 + rng() * 1.4, sy: 0.35 + rng() * 0.8,
        color: new THREE.Color().copy(cs).multiplyScalar(0.9 + rng() * 0.2),
      });
    }
    // 滝の岩山まわりに大岩
    const wf = World.waterfallPos;
    for (let i = 0; i < 10; i++) {
      const a = rng() * Math.PI * 2;
      const x = wf.x + Math.cos(a) * (3 + rng() * 5);
      const z = wf.z - 1 + Math.abs(Math.sin(a)) * -3 - rng() * 2;
      items.push({
        x, y: terrainHeight(x, z) + 0.2, z, ry: rng() * 3, s: 1.4 + rng() * 2.2, sy: 1.2 + rng() * 2,
        color: new THREE.Color().copy(cB).multiplyScalar(0.85 + rng() * 0.3),
      });
    }
    makeInstanced(geo, vegetationMaterial(null, { sway: 0, nightDim: 0.3 }), items, scene, { shadow: true });
  }

  /* ============================ 光るキノコ ============================ */
  function buildMushrooms(scene, rng) {
    const stemGeo = new THREE.CylinderGeometry(0.10, 0.16, 0.5, 6);
    stemGeo.translate(0, 0.25, 0);
    const capGeo = new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.scale(1, 0.75, 1);

    const stems = [], caps = [];
    const capColors = [0x64e8ff, 0x9b7bff, 0x64ffa8, 0xff9bd5].map((h) => U.C(h));
    const cStem = U.C(0xf5efe0);
    for (let i = 0; i < 60; i++) {
      let x, z;
      if (i < 40) { // キノコの森
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 12;
        x = 25 + Math.cos(a) * r; z = -36 + Math.sin(a) * r;
      } else {
        x = (rng() - 0.5) * 160; z = (rng() - 0.5) * 160;
      }
      if (!scatterOK(x, z, 0.8, 8)) continue;
      const h = terrainHeight(x, z);
      const s = 0.6 + rng() * 1.6;
      stems.push({ x, y: h - 0.04, z, s, sy: s, color: cStem });
      caps.push({ x, y: h - 0.04 + 0.48 * s, z, s, sy: s, ry: rng() * 3, color: capColors[(rng() * capColors.length) | 0] });
    }
    makeInstanced(stemGeo, vegetationMaterial(null, { sway: 0, nightDim: 0.45 }), stems, scene);

    // 夜に光るカサ：カスタム発光シェーダー
    const capMat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uDay: World.uniforms.uDay, uTime: World.uniforms.uTime },
      ]),
      vertexShader: `
        #include <fog_pars_vertex>
        attribute vec3 aColor;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vPhase;
        varying vec3 vN;
        void main() {
          vColor = aColor; vPhase = aPhase;
          vN = normalize(mat3(instanceMatrix) * normal);
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uDay, uTime;
        varying vec3 vColor;
        varying float vPhase;
        varying vec3 vN;
        void main() {
          float lit = .45 + .55 * max(vN.y, 0.);
          vec3 day = vColor * lit * .9;
          float pulse = .75 + .25 * sin(uTime * 2. + vPhase * 6.);
          vec3 night = vColor * (1.6 * pulse) + vec3(.08);
          vec3 col = mix(night, day * mix(.4,1.,uDay), uDay);
          gl_FragColor = vec4(col, 1.);
          #include <fog_fragment>
        }`,
    });
    capMat.uniforms.uTime = World.uniforms.uTime;
    capMat.uniforms.uDay = World.uniforms.uDay;
    makeInstanced(capGeo, capMat, caps, scene);
  }

  /* ============================ お城 ============================ */
  function buildCastle(scene) {
    const g = new THREE.Group();
    const cx = World.castlePos.x, cz = World.castlePos.z;
    const baseY = 8.4;
    g.position.set(cx, baseY, cz);

    const wallMat = new THREE.MeshLambertMaterial({ color: U.C(0xfdf3e7) });
    const wallMat2 = new THREE.MeshLambertMaterial({ color: U.C(0xf3e2d9) });
    const roofMat = new THREE.MeshLambertMaterial({ color: U.C(0xff9ec4) });
    const roofMat2 = new THREE.MeshLambertMaterial({ color: U.C(0x8fb8ff) });
    const goldMat = new THREE.MeshLambertMaterial({ color: U.C(0xffd76e), emissive: U.C(0x664c11) });
    const winMat = new THREE.MeshLambertMaterial({ color: U.C(0x9adcff), emissive: U.C(0xffdf8a), emissiveIntensity: 0 });
    World.nightGlowMats.push({ mat: winMat, day: 0, night: 1.6 });

    function tower(x, z, r, h, roof, roofH) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 12), wallMat);
      t.position.set(x, h / 2, z);
      t.castShadow = true;
      g.add(t);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, roofH, 12), roof);
      rf.position.set(x, h + roofH / 2 - 0.1, z);
      rf.castShadow = true;
      g.add(rf);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), goldMat);
      fin.position.set(x, h + roofH + 0.05, z);
      g.add(fin);
      // 窓
      for (let i = 0; i < 2; i++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.5, r * 0.8), winMat);
        w.position.set(x, h * (0.45 + i * 0.3), z + r + 0.02);
        g.add(w);
      }
      return t;
    }

    // 本館
    const keep = new THREE.Mesh(new THREE.BoxGeometry(7.5, 6, 6), wallMat2);
    keep.position.y = 3;
    keep.castShadow = true;
    g.add(keep);
    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.4, 4), roofMat2);
    keepRoof.position.y = 7.6;
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.castShadow = true;
    g.add(keepRoof);

    // 塔
    tower(-4.4, 2.4, 1.5, 8, roofMat, 3.4);
    tower(4.4, 2.4, 1.5, 8, roofMat, 3.4);
    tower(-3.6, -2.8, 1.2, 10.5, roofMat, 3.0);
    tower(3.6, -2.8, 1.2, 10.5, roofMat, 3.0);
    tower(0, 0, 1.9, 13, roofMat2, 4.4);

    // 門
    const doorMat = new THREE.MeshLambertMaterial({ color: U.C(0x8a5a3a) });
    const door = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16, 1, false, 0, Math.PI), doorMat);
    door.rotation.x = Math.PI / 2;
    door.rotation.z = Math.PI;
    door.position.set(0, 1.2, 3.05);
    g.add(door);
    const doorB = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 0.5), doorMat);
    doorB.position.set(0, 1.2 - 1.2, 3.05);
    doorB.position.y = 0.6;
    g.add(doorB);

    // 旗
    World.flags = [];
    [[-4.4, 2.4, 11.6], [4.4, 2.4, 11.6], [0, 0, 17.6]].forEach(([x, z, y]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 5), goldMat);
      pole.position.set(x, y + 0.5, z);
      g.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.5),
        new THREE.MeshLambertMaterial({ color: U.C(0xff6fa5), side: THREE.DoubleSide })
      );
      flag.position.set(x + 0.5, y + 0.9, z);
      g.add(flag);
      World.flags.push(flag);
    });

    scene.add(g);
    World.castleGroup = g;

    World._updaters.push((t) => {
      World.flags.forEach((f, i) => {
        f.rotation.y = Math.sin(t * 3 + i) * 0.35;
        f.scale.y = 1 + Math.sin(t * 6 + i * 2) * 0.06;
      });
    });
  }

  /* ============================ 村の家 ============================ */
  function buildVillage(scene, rng) {
    const houses = [
      { x: -22, z: 24, c: 0xff9ec4, s: 1.0 },
      { x: -9, z: 26, c: 0x8fd3ff, s: 0.9 },
      { x: -21, z: 11, c: 0xc9a4ff, s: 0.85 },
    ];
    const winMat = new THREE.MeshLambertMaterial({ color: U.C(0xfff1c4), emissive: U.C(0xffd97a), emissiveIntensity: 0 });
    World.nightGlowMats.push({ mat: winMat, day: 0, night: 1.5 });
    const wallMat = new THREE.MeshLambertMaterial({ color: U.C(0xfff6e8) });
    const doorMat = new THREE.MeshLambertMaterial({ color: U.C(0x9a6844) });
    const dotMat = new THREE.MeshLambertMaterial({ color: U.C(0xffffff) });

    houses.forEach((hd) => {
      const h = terrainHeight(hd.x, hd.z);
      const g = new THREE.Group();
      g.position.set(hd.x, h - 0.1, hd.z);
      g.rotation.y = rng() * Math.PI * 2;
      const s = hd.s;

      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * s, 1.9 * s, 2.2 * s, 12), wallMat);
      body.position.y = 1.1 * s;
      body.castShadow = true;
      g.add(body);

      // きのこ屋根
      const roofMat = new THREE.MeshLambertMaterial({ color: U.C(hd.c) });
      const roof = new THREE.Mesh(new THREE.SphereGeometry(2.5 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), roofMat);
      roof.scale.set(1, 0.72, 1);
      roof.position.y = 2.1 * s;
      roof.castShadow = true;
      g.add(roof);
      // 屋根の水玉
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 6, 5), dotMat);
        dot.position.set(Math.cos(a) * 1.7 * s, 2.9 * s, Math.sin(a) * 1.7 * s);
        dot.scale.y = 0.5;
        g.add(dot);
      }
      // とんがり
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 8, 6), roofMat);
      top.position.y = 3.9 * s;
      g.add(top);

      // ドア
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.4 * s, 0.12), doorMat);
      door.position.set(0, 0.7 * s, 1.85 * s);
      g.add(door);
      // 窓
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.35 * s, 10), winMat);
      win.position.set(1.2 * s, 1.5 * s, 1.35 * s);
      win.lookAt(win.position.clone().multiplyScalar(2).setY(1.5 * s));
      g.add(win);
      const win2 = win.clone();
      win2.position.set(-1.2 * s, 1.5 * s, 1.35 * s);
      win2.lookAt(win2.position.clone().multiplyScalar(2).setY(1.5 * s));
      g.add(win2);

      scene.add(g);
    });
  }

  /* ============================ 橋 ============================ */
  function buildBridge(scene) {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ color: U.C(0xb0773f) });
    const woodMat2 = new THREE.MeshLambertMaterial({ color: U.C(0x8f5f33) });
    const n = 11;
    for (let i = 0; i < n; i++) {
      const x = BRIDGE.x0 + ((i + 0.5) / n) * (BRIDGE.x1 - BRIDGE.x0);
      const y = bridgeHeight(x, BRIDGE.z);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.18, 3.6), i % 2 ? woodMat : woodMat2);
      plank.position.set(x, y - 0.08, BRIDGE.z);
      const cx = (BRIDGE.x0 + BRIDGE.x1) / 2, half = (BRIDGE.x1 - BRIDGE.x0) / 2;
      plank.rotation.z = -Math.sin(((x - cx) / half) * Math.PI / 2) * 0.24;
      plank.castShadow = true;
      g.add(plank);
      // らんかん
      if (i % 2 === 0) {
        for (const side of [-1.6, 1.6]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6), woodMat2);
          post.position.set(x, y + 0.42, BRIDGE.z + side);
          g.add(post);
        }
      }
    }
    // 手すり
    for (const side of [-1.6, 1.6]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.09, 6, 20, Math.PI * 0.52), woodMat);
      rail.position.set((BRIDGE.x0 + BRIDGE.x1) / 2, bridgeHeight((BRIDGE.x0 + BRIDGE.x1) / 2, BRIDGE.z) - 5.4 + 0.85, BRIDGE.z + side);
      rail.rotation.z = Math.PI * 0.24;
      g.add(rail);
    }
    scene.add(g);
  }

  /* ============================ ランタン ============================ */
  function buildLanterns(scene) {
    const spots = [[-12, 15], [2, 17.5], [14, 19.5], [30, 23.5], [-24, 0], [-28, -22], [-6, 40], [0, 56], [16, -2], [23, -24]];
    const poleMat = new THREE.MeshLambertMaterial({ color: U.C(0x7a6a8a) });
    const lampMat = new THREE.MeshLambertMaterial({ color: U.C(0xfff3c8), emissive: U.C(0xffca5f), emissiveIntensity: 0.15 });
    World.nightGlowMats.push({ mat: lampMat, day: 0.15, night: 2.4 });
    const glowMat = new THREE.SpriteMaterial({
      map: Tex.glow, color: U.C(0xffca5f), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    World.lanternGlowMat = glowMat;

    spots.forEach(([x, z]) => {
      const h = terrainHeight(x, z);
      if (h < 0.5) return;
      const g = new THREE.Group();
      g.position.set(x, h, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 2.6, 6), poleMat);
      pole.position.y = 1.3;
      pole.castShadow = true;
      g.add(pole);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.32, 6), poleMat);
      cap.position.y = 2.88;
      g.add(cap);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), lampMat);
      lamp.position.y = 2.55;
      g.add(lamp);
      const spr = new THREE.Sprite(glowMat);
      spr.scale.set(3.2, 3.2, 1);
      spr.position.y = 2.55;
      g.add(spr);
      scene.add(g);
    });
  }

  /* ============================ 滝 ============================ */
  function buildWaterfall(scene) {
    const wf = World.waterfallPos;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: World.uniforms.uTime, uDay: World.uniforms.uDay },
      ]),
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime, uDay;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main() {
          float t = uTime;
          float x = vUv.x;
          float y = vUv.y;
          // 落ちる縞
          float stripes = sin(y * 34. + t * 7.5 + sin(x * 22.) * 1.4) * .5 + .5;
          float stripes2 = sin(y * 18. + t * 5.5 + x * 9.) * .5 + .5;
          float foam = smoothstep(.55, .95, stripes) * .7 + smoothstep(.6, 1., stripes2) * .5;
          // 下にいくほど白く
          foam += smoothstep(.35, .0, y) * .6;
          // 端はうすく
          float edge = smoothstep(0., .18, x) * smoothstep(1., .82, x);
          vec3 base = mix(vec3(.25,.45,.75), vec3(.55,.8,.98), uDay);
          vec3 col = mix(base, vec3(1.), clamp(foam, 0., 1.)) * mix(.5, 1., uDay);
          float alpha = (.55 + foam * .4) * edge;
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }`,
    });
    mat.uniforms.uTime = World.uniforms.uTime;
    mat.uniforms.uDay = World.uniforms.uDay;
    const geo = new THREE.PlaneGeometry(5.6, 9.5, 1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(wf);
    mesh.rotation.x = -0.12;
    scene.add(mesh);
    const mesh2 = mesh.clone();
    mesh2.scale.set(0.75, 1.02, 1);
    mesh2.position.z += 0.5;
    mesh2.position.y += 0.3;
    scene.add(mesh2);
  }

  /* ============================ 雲・太陽・月 ============================ */
  function buildSkyObjects(scene, rng) {
    // 太陽と月（ビルボード）
    const sunMat = new THREE.SpriteMaterial({
      map: Tex.glow, color: U.C(0xfff2b8), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const sun = new THREE.Sprite(sunMat);
    sun.scale.set(90, 90, 1);
    sun.position.set(140, 220, 220);
    scene.add(sun);
    World.sunSprite = sun;

    const moonMat = new THREE.SpriteMaterial({
      map: Tex.glow, color: U.C(0xdfe8ff), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const moon = new THREE.Sprite(moonMat);
    moon.scale.set(60, 60, 1);
    moon.position.set(-160, 240, -160);
    scene.add(moon);
    World.moonSprite = moon;

    // 雲
    const clouds = [];
    for (let i = 0; i < 13; i++) {
      const m = new THREE.SpriteMaterial({
        map: Tex.cloud, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
        color: U.C(0xffffff),
      });
      const c = new THREE.Sprite(m);
      const a = rng() * Math.PI * 2;
      const r = 90 + rng() * 150;
      c.position.set(Math.cos(a) * r, 48 + rng() * 45, Math.sin(a) * r);
      const s = 40 + rng() * 50;
      c.scale.set(s, s * 0.55, 1);
      c.userData = { a, r, speed: 0.004 + rng() * 0.008 };
      scene.add(c);
      clouds.push(c);
    }
    World.clouds = clouds;
    World._updaters.push((t, dt) => {
      clouds.forEach((c) => {
        c.userData.a += c.userData.speed * dt;
        c.position.x = Math.cos(c.userData.a) * c.userData.r;
        c.position.z = Math.sin(c.userData.a) * c.userData.r;
      });
    });
  }

  /* ============================ 虹（ごほうび） ============================ */
  function buildRainbow(scene) {
    const g = new THREE.Group();
    const colors = [0xff5e5e, 0xff9d45, 0xffd93b, 0x5fd971, 0x4db9ff, 0x6f7bff, 0xc07bff];
    colors.forEach((c, i) => {
      const geo = new THREE.TorusGeometry(46 - i * 1.8, 1.05, 8, 72, Math.PI);
      const mat = new THREE.MeshBasicMaterial({
        color: U.C(c).multiplyScalar(1.15),
        transparent: true, opacity: 0,
        depthWrite: false, fog: false,
      });
      const m = new THREE.Mesh(geo, mat);
      g.add(m);
    });
    g.position.set(5, 2, -12);
    g.rotation.y = 0.35;
    g.visible = false;
    scene.add(g);
    World.rainbow = g;
  }

  // celebration 時に呼ぶ：虹をふわっと出す
  World.showRainbow = function (progress) {
    const g = World.rainbow;
    if (!g) return;
    g.visible = progress > 0.01;
    g.children.forEach((m, i) => {
      const local = U.clamp(progress * 1.6 - i * 0.08, 0, 1);
      m.material.opacity = 0.62 * local;
      m.scale.setScalar(0.6 + 0.4 * U.sstep(0, 1, progress));
    });
  };

  /* ============================ 昼夜切替 ============================ */
  World.setDay = function (f) {
    World.uniforms.uDay.value = f;
    if (World.waterMat) World.waterMat.uniforms.uDay.value = f;
    World.nightGlowMats.forEach(({ mat, day, night }) => {
      mat.emissiveIntensity = U.lerp(night, day, f);
    });
    if (World.lanternGlowMat) World.lanternGlowMat.opacity = (1 - f) * 0.55;
    if (World.sunSprite) World.sunSprite.material.opacity = f;
    if (World.moonSprite) World.moonSprite.material.opacity = (1 - f) * 0.95;
    if (World.clouds) World.clouds.forEach((c) => {
      c.material.opacity = U.lerp(0.16, 0.8, f);
      c.material.color.copy(U.C(0xffffff)).lerp(U.C(0x33406e), 1 - f);
    });
  };

  /* ============================ ビルド ============================ */
  World.build = function (scene) {
    buildTextures();
    const rng = U.mulberry32(20260711);
    buildSky(scene);
    buildTerrain(scene);
    buildWater(scene);
    buildGrassAndFlowers(scene, rng);
    buildTrees(scene, rng);
    buildApples(scene);
    buildRocks(scene, rng);
    buildMushrooms(scene, rng);
    buildCastle(scene);
    buildVillage(scene, rng);
    buildBridge(scene);
    buildLanterns(scene);
    buildWaterfall(scene);
    buildSkyObjects(scene, rng);
    buildRainbow(scene);
  };

  World.update = function (t, dt) {
    World.uniforms.uTime.value = t;
    World._updaters.forEach((u) => u(t, dt));
    // りんごの物理（落下）
    World.fruitTrees.forEach((tree) => {
      if (tree.shake > 0) tree.shake -= dt;
      tree.apples.forEach((a) => {
        if (a.userData.state === 'falling') {
          a.userData.vy -= 22 * dt;
          a.position.y += a.userData.vy * dt;
          a.rotation.x += dt * 4;
          const ground = terrainHeight(a.position.x, a.position.z) + 0.26;
          if (a.position.y <= ground) {
            a.position.y = ground;
            a.userData.state = 'ground';
            a.rotation.set(0.3, 0, 0.2);
          }
        } else if (a.userData.state === 'onTree' && tree.shake > 0) {
          a.position.x = a.userData.home.x + Math.sin(t * 30) * 0.08;
        }
      });
      // 再生タイマー
      if (tree.regrow > 0) {
        tree.regrow -= dt;
        if (tree.regrow <= 0) {
          tree.apples.forEach((a) => {
            if (a.userData.state === 'gone') {
              a.userData.state = 'onTree';
              a.position.copy(a.userData.home);
              a.visible = true;
              a.scale.setScalar(1);
            }
          });
        }
      }
    });
  };
})();
