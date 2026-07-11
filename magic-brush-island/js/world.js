/* ================================================================
   world.js — the island itself.
   Shader sky with a warm sun, living sea with foam and glitter,
   terrain whose colour literally floods back zone by zone,
   swaying instanced grass, and six storybook districts.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.World = (function () {
  const T = THREE;
  const P = GAME.PAL;
  const C = GAME.CONFIG;
  const B = () => GAME.Build;
  const rand = (a, b) => a + GAME.rng() * (b - a);

  let scene = null;
  const animated = [];        // {fn(dt,time)}
  const stars = [];           // collectible stars
  const rainbows = [];        // zone rainbows popping in
  const zoneRadiusTweens = [];

  /* ============ shared paint-mask uniforms ============ */
  const uZones = { value: [] };            // vec3: x, z, animated radius
  const uGlobalPaint = { value: 0 };
  const uTime = { value: 0 };
  for (let i = 0; i < 8; i++) uZones.value.push(new T.Vector3(0, 0, 0));
  GAME.ZONES.forEach((z, i) => uZones.value[i].set(z.cx, z.cz, 0));

  /* ============ terrain height field ============ */
  const HILLS = [
    { x: -24, z: -17, h: 4.6, r: 12 },   // castle hill
    { x: 21, z: 17, h: 2.2, r: 10 },     // forest mound
    { x: 20, z: -13, h: 1.3, r: 9 },     // flower meadow swell
    { x: -19, z: 15, h: 1.8, r: 9 },     // mushroom knoll
    { x: -3, z: 30, h: 1.0, r: 8 },      // playground rise
    { x: 8, z: 7, h: -3.4, r: 5.2 },     // pond dip
  ];

  function terrainH(x, z) {
    const r = Math.hypot(x, z);
    let t = 1 - (r - 28) / 17;
    t = Math.max(0, Math.min(1, t));
    let h = -2.2 + (2.2 + 2.3) * (t * t * (3 - 2 * t)); // -2.2 deep sea → 2.3 plateau
    for (const hh of HILLS) {
      const d2 = (x - hh.x) * (x - hh.x) + (z - hh.z) * (z - hh.z);
      h += hh.h * Math.exp(-d2 / (hh.r * hh.r));
    }
    h += 0.35 * Math.sin(x * 0.31) * Math.sin(z * 0.27) + 0.2 * Math.sin(x * 0.13 + z * 0.17);
    return h;
  }

  /* ============ paint-mask shader patcher ============ */
  function patchPaintMask(mat, opts) {
    const sway = opts && opts.sway;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uZones = uZones;
      shader.uniforms.uGlobalPaint = uGlobalPaint;
      shader.uniforms.uTime = uTime;

      shader.vertexShader = 'varying vec3 vPaintWorld;\nuniform float uTime;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          ${sway ? `
          #ifdef USE_INSTANCING
            vec3 iOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            transformed.x += sin(uTime * 1.9 + iOrigin.x * 0.9 + iOrigin.z * 0.8) * 0.24 * max(0.0, transformed.y);
            transformed.z += cos(uTime * 1.6 + iOrigin.x * 0.7) * 0.14 * max(0.0, transformed.y);
          #endif` : ''}
          {
            vec4 wp4 = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              wp4 = instanceMatrix * wp4;
            #endif
            vPaintWorld = (modelMatrix * wp4).xyz;
          }
        `);

      shader.fragmentShader = 'varying vec3 vPaintWorld;\nuniform vec3 uZones[8];\nuniform float uGlobalPaint;\n' +
        shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          {
            float m = uGlobalPaint;
            for (int i = 0; i < 8; i++) {
              float zr = uZones[i].z;
              if (zr > 0.01) {
                float d = distance(vPaintWorld.xz, uZones[i].xy);
                float wob = 1.0 + 0.09 * sin(vPaintWorld.x * 0.9 + vPaintWorld.z * 1.1)
                                + 0.07 * sin(vPaintWorld.x * 2.3 - vPaintWorld.z * 1.7);
                m = max(m, 1.0 - smoothstep(zr * wob - 2.8, zr * wob, d));
              }
            }
            float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 grey = mix(vec3(lum), vec3(0.44, 0.47, 0.55), 0.42) * 0.8;
            diffuseColor.rgb = mix(grey, diffuseColor.rgb, clamp(0.16 + 0.84 * m, 0.0, 1.0));
          }
        `);
    };
    mat.customProgramCacheKey = () => 'paintmask' + (sway ? '-sway' : '');
    return mat;
  }

  /* ============ sky ============ */
  const SKY = {
    day:    { top: 0x3f9dea, horizon: 0xbfe8ff, bottom: 0x9fd4f0, sun: 0xfff2c8, fog: 0xbfe3ff },
    sunset: { top: 0x7a5ac8, horizon: 0xffb08a, bottom: 0xff9a6a, sun: 0xffd9a0, fog: 0xffc8a8 },
    superday: { top: 0x2f96f0, horizon: 0xc8f0ff, bottom: 0xa8e4ff, sun: 0xfff6d8, fog: 0xc8ecff },
  };
  let skyMat = null;
  const skyCurrent = { top: new T.Color(), horizon: new T.Color(), bottom: new T.Color(), sun: new T.Color(), fog: new T.Color() };
  const skyTarget = { top: new T.Color(), horizon: new T.Color(), bottom: new T.Color(), sun: new T.Color(), fog: new T.Color() };

  function setSkyMode(mode, instant) {
    const s = SKY[mode];
    for (const k of ['top', 'horizon', 'bottom', 'sun', 'fog']) {
      skyTarget[k].setHex(s[k]);
      if (instant) skyCurrent[k].copy(skyTarget[k]);
    }
  }

  function buildSky() {
    setSkyMode('day', true);
    skyMat = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: skyCurrent.top },
        uHorizon: { value: skyCurrent.horizon },
        uBottom: { value: skyCurrent.bottom },
        uSunColor: { value: skyCurrent.sun },
        uSunDir: { value: new T.Vector3(0.45, 0.62, 0.42).normalize() },
        uTime: uTime,
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uBottom, uSunColor, uSunDir;
        uniform float uTime;
        varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 col;
          if (y >= 0.0) {
            col = mix(uHorizon, uTop, pow(y, 0.6));
          } else {
            col = mix(uHorizon, uBottom, pow(-y, 0.7));
          }
          float d = max(dot(vDir, uSunDir), 0.0);
          col += uSunColor * (pow(d, 420.0) * 1.1 + pow(d, 28.0) * 0.22 + pow(d, 5.0) * 0.06);
          // faint drifting shimmer, keeps the sky alive
          col += vec3(0.015) * sin(vDir.x * 8.0 + uTime * 0.13) * sin(vDir.z * 7.0 - uTime * 0.09) * max(0.0, y);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new T.Mesh(new T.SphereGeometry(320, 24, 16), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);
  }

  /* ============ sea ============ */
  function buildSea() {
    const geo = new T.PlaneGeometry(560, 560, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const mat = new T.ShaderMaterial({
      transparent: true,
      uniforms: T.UniformsUtils.merge([
        T.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDeep: { value: new T.Color(P.waterDeep) },
          uMid: { value: new T.Color(P.water) },
          uShallow: { value: new T.Color(P.waterShallow) },
        },
      ]),
      fog: true,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        varying float vWave;
        #include <fog_pars_vertex>
        void main() {
          vec3 p = position;
          float w = sin(p.x * 0.16 + uTime * 1.1) * 0.22
                  + cos(p.z * 0.19 + uTime * 0.9) * 0.2
                  + sin((p.x + p.z) * 0.07 + uTime * 0.6) * 0.3;
          p.y += w;
          vWave = w;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeep, uMid, uShallow;
        varying vec3 vWorld;
        varying float vWave;
        #include <fog_pars_fragment>
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
          float r = length(vWorld.xz);
          vec3 col = mix(uMid, uDeep, smoothstep(52.0, 110.0, r));
          col = mix(uShallow, col, smoothstep(38.0, 55.0, r));
          col += vec3(0.05) * vWave;
          // sparkling glitter (fine cells, hidden right next to the camera)
          vec2 cell = floor(vWorld.xz * 3.5 + vec2(uTime * 0.9, -uTime * 0.6));
          float g = hash(cell);
          if (g > 0.988) {
            float tw = 0.5 + 0.5 * sin(uTime * 6.0 + g * 40.0);
            float far = smoothstep(14.0, 32.0, distance(cameraPosition, vWorld));
            col += vec3(0.42, 0.46, 0.42) * tw * far;
          }
          // animated foam ring hugging the beach
          float foam = (1.0 - smoothstep(43.0, 47.5, r)) * smoothstep(39.5, 43.0, r);
          foam *= 0.55 + 0.45 * sin(r * 2.6 - uTime * 2.2);
          col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
          // soft lap at the very shore
          float lap = 1.0 - smoothstep(40.0, 41.8, r);
          col = mix(col, vec3(0.95, 1.0, 1.0), lap * (0.3 + 0.2 * sin(uTime * 1.7)));
          gl_FragColor = vec4(col, 0.94);
          #include <fog_fragment>
        }`,
    });
    const sea = new T.Mesh(geo, mat);
    sea.position.y = C.SEA_LEVEL;
    scene.add(sea);
    animated.push({ fn: (dt, t) => { mat.uniforms.uTime.value = t; } });
  }

  /* ============ terrain ============ */
  function buildTerrain() {
    const size = 124, seg = 120;
    const geo = new T.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cA = new T.Color(P.grassA).convertSRGBToLinear();
    const cB = new T.Color(P.grassB).convertSRGBToLinear();
    const cC = new T.Color(P.grassC).convertSRGBToLinear();
    const sand = new T.Color(P.sand).convertSRGBToLinear();
    const sandWet = new T.Color(0xd9c084).convertSRGBToLinear();
    const tmp = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainH(x, z);
      pos.setY(i, h);
      // colour by height: wet sand → sand → grass shades
      if (h < 0.5) tmp.copy(sandWet);
      else if (h < 1.35) tmp.copy(sandWet).lerp(sand, Math.min(1, (h - 0.5) / 0.6));
      else {
        const n = 0.5 + 0.5 * Math.sin(x * 0.6 + Math.sin(z * 0.5) * 2.0) * Math.sin(z * 0.55);
        tmp.copy(cA).lerp(cC, n);
        tmp.lerp(cB, Math.max(0, Math.min(1, (h - 2.6) / 4)));
        const blend = Math.min(1, (h - 1.35) / 0.5);
        tmp.lerp(sand, 1 - blend);
      }
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new T.MeshToonMaterial({ vertexColors: true, gradientMap: GAME.Mat.getGradient() });
    patchPaintMask(mat);
    const terrain = new T.Mesh(geo, mat);
    terrain.receiveShadow = true;
    scene.add(terrain);
    terrainMesh = terrain;
  }

  /* ============ instanced grass ============ */
  function buildGrass() {
    const COUNT = 2400;
    const geo = new T.ConeGeometry(0.1, 0.72, 4);
    geo.translate(0, 0.32, 0);
    const mat = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: GAME.Mat.getGradient() });
    patchPaintMask(mat, { sway: true });
    const inst = new T.InstancedMesh(geo, mat, COUNT);
    const m4 = new T.Matrix4();
    const q = new T.Quaternion();
    const eul = new T.Euler();
    const s = new T.Vector3();
    const p = new T.Vector3();
    const shades = [0x58c94f, 0x7fd648, 0x3fae52, 0x8fe06e].map((h) => new T.Color(h).convertSRGBToLinear());
    let placed = 0, guard = 0;
    while (placed < COUNT && guard++ < COUNT * 20) {
      const a = GAME.rng() * Math.PI * 2;
      const r = Math.sqrt(GAME.rng()) * 41;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = terrainH(x, z);
      if (h < 1.5) continue;                    // no grass on the beach
      if (Math.hypot(x - 8, z - 7) < 5.5) continue; // not in the pond
      p.set(x, h - 0.04, z);
      eul.set(rand(-0.1, 0.1), GAME.rng() * Math.PI, rand(-0.1, 0.1));
      q.setFromEuler(eul);
      const sc = rand(0.7, 1.6);
      s.set(sc, sc * rand(0.8, 1.3), sc);
      m4.compose(p, q, s);
      inst.setMatrixAt(placed, m4);
      inst.setColorAt(placed, shades[(GAME.rng() * shades.length) | 0]);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }

  /* ============ prop placement helpers ============ */
  function place(group, x, z, opts) {
    opts = opts || {};
    const y = opts.y !== undefined ? opts.y : terrainH(x, z);
    group.position.set(x, y, z);
    if (opts.rotY !== undefined) group.rotation.y = opts.rotY;
    if (opts.scale) {
      group.scale.setScalar(opts.scale);
      group.userData.baseScale = opts.scale;
    }
    if (opts.zone) GAME.Mat.makePaintable(group, opts.zone);
    scene.add(group);
    return group;
  }

  /* ============ the island districts ============ */
  function buildProps() {
    const Bu = B();

    /* --- おはなばたけ (flower field) --- */
    const flowerHexSets = [
      [P.red, P.pink], [P.yellow, P.orange], [P.blue, P.purple],
      [P.pink, P.white], [P.purple, P.pink], [P.orange, P.yellow],
    ];
    const patchPos = [[17, -10], [22, -15], [18, -17], [24, -10], [21, -20], [15, -14]];
    patchPos.forEach(([x, z], i) => {
      place(Bu.makeFlowerPatch(flowerHexSets[i], 7), x, z, { zone: 'hana', rotY: rand(0, 6) });
    });
    place(Bu.makeTree('blossom'), 14, -19, { zone: 'hana', scale: 1.4 });
    place(Bu.makeTree('blossom'), 26, -14, { zone: 'hana', scale: 1.2 });
    place(Bu.makeTree('blossom'), 19, -6.5, { zone: 'hana', scale: 1.3 });
    place(Bu.makeBench(), 24, -18.5, { zone: 'hana', rotY: -0.8 });
    place(Bu.makeFence(4), 15, -7.5, { zone: 'hana', rotY: 0.5 });
    place(Bu.makeWindmill(), 31, -4, { zone: 'hana', scale: 1.15, rotY: -2.2 });

    /* --- きのこのもり (mushroom grove) --- */
    const mushPos = [[-17, 13], [-21, 17], [-16, 18], [-23, 13], [-19, 20.5]];
    mushPos.forEach(([x, z], i) => {
      place(Bu.makeMushroom(i < 3), x, z, { zone: 'kinoko', rotY: rand(0, 6) });
    });
    place(Bu.makeMushroom(false), -14, 15.5, { zone: 'kinoko' });
    place(Bu.makeMushroom(false), -22, 19.5, { zone: 'kinoko' });
    place(Bu.makeTree(), -25, 16, { zone: 'kinoko', scale: 1.5 });
    place(Bu.makeTree(), -15, 21.5, { zone: 'kinoko', scale: 1.3 });
    place(Bu.makeRock(), -20, 11, { zone: 'kinoko' });
    GAME.Animals.addBunny(-18, 16, 'kinoko');
    GAME.Animals.addBunny(-22, 15, 'kinoko');

    /* --- みなとまち (harbour village) --- */
    place(Bu.makeHouse(P.wall1, P.roof1), -4, -25, { zone: 'minato', rotY: 0.5 });
    place(Bu.makeHouse(P.wall2, P.roof2), 3, -29, { zone: 'minato', rotY: -0.3 });
    place(Bu.makeHouse(P.wall3, P.roof3), 7, -24, { zone: 'minato', rotY: -0.9 });
    place(Bu.makeHouse(P.wall1, P.roof4), -1, -31.5, { zone: 'minato', rotY: 0.15 });
    place(Bu.makeWell(), 1.5, -26, { zone: 'minato' });
    place(Bu.makeLampPost(), -2, -28, { zone: 'minato' });
    place(Bu.makeLampPost(), 5, -27, { zone: 'minato' });
    place(Bu.makeLighthouse(), -0.5, -38.5, { zone: 'minato', scale: 1.05 });
    place(Bu.makeBench(), 4, -32, { zone: 'minato', rotY: 2.6 });
    const boat1 = place(Bu.makeBoat(P.red, 0xfff6ec), 7.5, -41, { zone: 'minato', y: C.SEA_LEVEL, rotY: 0.7 });
    const boat2 = place(Bu.makeBoat(P.blue, P.yellow), -7, -41.5, { zone: 'minato', y: C.SEA_LEVEL, rotY: -0.5 });
    animated.push({ fn: (dt, t) => {
      boat1.position.y = C.SEA_LEVEL + Math.sin(t * 1.1) * 0.14;
      boat1.rotation.z = Math.sin(t * 0.9) * 0.05;
      boat2.position.y = C.SEA_LEVEL + Math.sin(t * 1.3 + 2) * 0.14;
      boat2.rotation.z = Math.sin(t * 1.1 + 1) * 0.05;
    } });

    /* --- もりのくに (forest) + pond --- */
    const treePos = [[24, 14], [19, 21], [26, 19], [22, 24.5], [28, 11], [17, 16]];
    treePos.forEach(([x, z]) => place(Bu.makeTree(), x, z, { zone: 'mori', scale: rand(1.2, 1.7), rotY: rand(0, 6) }));
    place(Bu.makePine(), 30, 15, { zone: 'mori', scale: 1.3 });
    place(Bu.makePine(), 25, 7, { zone: 'mori', scale: 1.1 });
    place(Bu.makePine(), 16, 25, { zone: 'mori', scale: 1.25 });
    place(Bu.makeRock(), 20, 12, { zone: 'mori' });
    place(Bu.makeRock(), 27, 22, { zone: 'mori' });
    GAME.Animals.addBunny(21, 19, 'mori');
    GAME.Animals.addSheep(25, 16, 'mori');
    GAME.Animals.addSheep(18, 12, 'mori');
    // pond friends
    const pondY = C.SEA_LEVEL + 0.1;
    GAME.Animals.addDuck(8, 7, 2.0, 'mori', pondY);
    GAME.Animals.addDuck(8, 7, 1.2, 'mori', pondY);
    GAME.Animals.addDuck(8, 7, 2.6, 'mori', pondY);
    place(Bu.makeFlowerPatch([P.white, P.pink], 5), 12.5, 9.5, { zone: 'mori' });
    place(Bu.makeFlowerPatch([P.blue, P.white], 5), 4, 4.5, { zone: 'mori' });

    /* --- おしろのおか (castle hill) --- */
    place(Bu.makeCastle(), -24, -17, { zone: 'oshiro', rotY: 0.6, scale: 1.05 });
    place(Bu.makePine(), -30, -12, { zone: 'oshiro', scale: 1.2 });
    place(Bu.makePine(), -18, -23, { zone: 'oshiro', scale: 1.15 });
    place(Bu.makePine(), -29, -22, { zone: 'oshiro', scale: 1.3 });
    place(Bu.makeLampPost(), -20, -12.5, { zone: 'oshiro' });
    place(Bu.makeFence(4.5), -19, -19.5, { zone: 'oshiro', rotY: 1.1 });
    place(Bu.makeRock(), -28, -16, { zone: 'oshiro' });

    /* --- ゆうえんち (playground) --- */
    place(Bu.makeCarousel(), -4, 31, { zone: 'yuuen', rotY: 0.3 });
    place(Bu.makeSwing(), -10, 27, { zone: 'yuuen', rotY: 0.9 });
    place(Bu.makeBalloonStand(), 2.5, 27.5, { zone: 'yuuen', rotY: -0.6 });
    place(Bu.makeBench(), -9, 32.5, { zone: 'yuuen', rotY: 2.2 });
    place(Bu.makeLampPost(), 1, 32, { zone: 'yuuen' });
    place(Bu.makeTree(), -12, 31.5, { zone: 'yuuen', scale: 1.3 });
    GAME.Animals.addBunny(-1, 34, 'yuuen');

    /* --- scattered extras (nearest-zone bookkeeping) --- */
    place(Bu.makeTree(), 6, 16, { zone: 'mori', scale: 1.4 });
    place(Bu.makeTree(), -8, 8, { zone: 'kinoko', scale: 1.5 });
    place(Bu.makeTree(), -11, -6, { zone: 'oshiro', scale: 1.35 });
    place(Bu.makeFlowerPatch([P.yellow, P.white], 5), -6, -12, { zone: 'oshiro' });
    place(Bu.makeFlowerPatch([P.red, P.orange], 5), 10, -18, { zone: 'hana' });
    place(Bu.makeRock(), -12, 20, { zone: 'kinoko' });
    place(Bu.makeTree('blossom'), -13, 25.5, { zone: 'yuuen', scale: 1.25 });

    /* --- centre plaza: the magic paint fountain (always coloured) --- */
    const fountain = new T.Group();
    const basin = new T.Mesh(new T.CylinderGeometry(1.6, 1.8, 0.55, 14), GAME.Mat.toon(0xaed4f0));
    basin.position.y = 0.28;
    basin.castShadow = true;
    fountain.add(basin);
    const basinTrim = new T.Mesh(new T.TorusGeometry(1.62, 0.12, 6, 16), GAME.Mat.toon(0xffd93c));
    basinTrim.rotation.x = Math.PI / 2;
    basinTrim.position.y = 0.56;
    fountain.add(basinTrim);
    const waterDisc = new T.Mesh(new T.CylinderGeometry(1.45, 1.45, 0.1, 14),
      new T.MeshBasicMaterial({ color: new T.Color(0x9fe8ff).convertSRGBToLinear() }));
    waterDisc.position.y = 0.56;
    fountain.add(waterDisc);
    const pillar = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 1.1, 8), GAME.Mat.toon(0xaed4f0));
    pillar.position.y = 1.05;
    fountain.add(pillar);
    const orb = new T.Mesh(new T.SphereGeometry(0.42, 12, 10),
      GAME.Mat.toon(0xff9ec6, { emissive: 0xff7ab0, emissiveIntensity: 0.8 }));
    orb.position.y = 1.85;
    fountain.add(orb);
    place(fountain, 0, 3, { rotY: 0 });
    let fAcc = 0, fHue = 0;
    animated.push({ fn: (dt, t) => {
      orb.material.emissive.setHSL((fHue += dt * 0.2) % 1, 0.85, 0.6);
      orb.position.y = 1.85 + Math.sin(t * 1.8) * 0.08;
      fAcc += dt;
      if (fAcc > 0.09) {
        fAcc = 0;
        GAME.Effects.trail(new T.Vector3(fountain.position.x + rand(-0.2, 0.2), fountain.position.y + 2.1, fountain.position.z + rand(-0.2, 0.2)), fHue * 2);
      }
    } });

    /* animate windmills / carousels / swings / balloons */
    scene.traverse((o) => {
      if (o.userData && o.userData.spin) {
        const spinner = o.userData.spin;
        const entry = o.userData.paintable;
        const isCarousel = spinner.children.length && spinner.children[0].userData.bobPhase !== undefined;
        animated.push({ fn: (dt, t) => {
          const on = entry && entry.painted;
          spinner.rotation.y += dt * (on ? (isCarousel ? 0.55 : 1.4) : 0.08);
          if (isCarousel) {
            spinner.children.forEach((h) => {
              h.position.y = on ? Math.sin(t * 2.4 + h.userData.bobPhase) * 0.25 + 0.25 : 0.05;
            });
          }
        } });
      }
      if (o.userData && o.userData.swing) {
        const sw = o.userData.swing;
        const entry = o.userData.paintable;
        animated.push({ fn: (dt, t) => {
          sw.rotation.x = Math.sin(t * 1.6) * (entry && entry.painted ? 0.5 : 0.04);
        } });
      }
      if (o.userData && o.userData.balloon) {
        const ph = o.userData.balloon.phase;
        const by = o.position.y;
        animated.push({ fn: (dt, t) => { o.position.y = by + Math.sin(t * 1.5 + ph) * 0.12; } });
      }
    });
  }

  /* ============ sky dressing: clouds, floating isles, turtle, birds ============ */
  function buildSkyDressing() {
    const Bu = B();
    for (let i = 0; i < 9; i++) {
      const c = Bu.makeCloud();
      const a = rand(0, Math.PI * 2);
      const r = rand(55, 150);
      c.position.set(Math.cos(a) * r, rand(24, 44), Math.sin(a) * r);
      c.scale.setScalar(rand(1, 2.2));
      scene.add(c);
      const speed = rand(0.5, 1.4);
      animated.push({ fn: (dt) => {
        c.position.x += speed * dt;
        if (c.position.x > 170) c.position.x = -170;
      } });
    }

    // dreamy floating mini-islands drifting on the horizon
    for (const [ix, iy, iz] of [[-70, 26, -60], [85, 32, -35], [-45, 30, 85]]) {
      const isle = new T.Group();
      const rock = new T.Mesh(new T.ConeGeometry(4.2, 6, 7), GAME.Mat.toon(0x8d9db5));
      rock.rotation.x = Math.PI;
      rock.position.y = -3;
      isle.add(rock);
      const top = new T.Mesh(new T.CylinderGeometry(4.2, 4.4, 1.1, 9), GAME.Mat.toon(0x5fc95f));
      top.position.y = 0.55;
      isle.add(top);
      const tree = Bu.makeTree(GAME.rng() < 0.5 ? 'blossom' : undefined);
      tree.position.y = 1.1;
      tree.scale.setScalar(1.6);
      isle.add(tree);
      isle.position.set(ix, iy, iz);
      scene.add(isle);
      const ph = rand(0, 6);
      animated.push({ fn: (dt, t) => {
        isle.position.y = iy + Math.sin(t * 0.4 + ph) * 1.2;
        isle.rotation.y += dt * 0.03;
      } });
    }

    // the friendly sea turtle, forever circling the island
    const turtle = Bu.makeTurtle();
    scene.add(turtle);
    animated.push({ fn: (dt, t) => {
      const a = t * 0.06;
      const r = 56;
      turtle.position.set(Math.cos(a) * r, C.SEA_LEVEL - 0.15 + Math.sin(t * 0.9) * 0.12, Math.sin(a) * r);
      turtle.rotation.y = -a;
      if (Math.sin(t * 0.9) > 0.97) {
        GAME.Effects.trail(new T.Vector3(turtle.position.x, turtle.position.y + 1, turtle.position.z), 0.5);
      }
    } });

    // sky birds
    GAME.Animals.addBird(0, 0, 30, 18);
    GAME.Animals.addBird(10, -10, 24, 15);
    GAME.Animals.addBird(-15, 10, 36, 21);
    GAME.Animals.addBird(5, 20, 28, 13);
  }

  /* ============ collectible stars ============ */
  function buildStars() {
    const Bu = B();
    let placed = 0, guard = 0;
    while (placed < C.STAR_TOTAL && guard++ < 400) {
      const a = GAME.rng() * Math.PI * 2;
      const r = 7 + Math.sqrt(GAME.rng()) * 33;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = terrainH(x, z);
      if (h < 1.3) continue;
      if (Math.hypot(x - 8, z - 7) < 5) continue;
      // keep them spread out
      let tooClose = false;
      for (const s of stars) {
        if (Math.hypot(s.group.position.x - x, s.group.position.z - z) < 7) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const g = Bu.makeStarPickup();
      g.position.set(x, h + 1.5, z);
      scene.add(g);
      stars.push({ group: g, collected: false, baseY: h + 1.5, phase: GAME.rng() * 6 });
      placed++;
    }
  }

  /* ============ zone completion visuals ============ */
  function completeZone(zoneIdx) {
    const z = GAME.ZONES[zoneIdx];
    // flood the ground with colour
    zoneRadiusTweens.push({ idx: zoneIdx, t: 0, target: z.r * 1.75 });
    // rainbow pops over the district
    const rb = B().makeRainbow(7.5);
    const y = terrainH(z.cx, z.cz);
    rb.position.set(z.cx, y + 1.2, z.cz);
    rb.rotation.y = Math.atan2(z.cx, z.cz) + Math.PI / 2; // face the island centre-ish
    rb.scale.setScalar(0.01);
    scene.add(rb);
    rainbows.push({ group: rb, t: 0 });
    // butterflies move in
    GAME.Effects.spawnButterflies(new T.Vector3(z.cx, y + 1, z.cz), 4, 6);
    // petals for the flower field
    if (z.id === 'hana') {
      GAME.Effects.addPetalEmitter(new T.Vector3(z.cx, y + 1, z.cz), 10, 0xffb3cf);
    }
    return new T.Vector3(z.cx, y, z.cz);
  }

  function setFinale() {
    setSkyMode('sunset');
  }
  function setSuperDay() {
    setSkyMode('superday');
  }

  /* ============ build & update ============ */
  let fogRef = null;
  let terrainMesh = null;

  function build(sc, fog) {
    scene = sc;
    fogRef = fog;
    buildSky();
    buildSea();
    buildTerrain();
    buildGrass();
    buildProps();
    buildSkyDressing();
    buildStars();
  }

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  function update(dt, time) {
    uTime.value = time;

    for (const a of animated) a.fn(dt, time);

    // sky colour drift toward target
    for (const k of ['top', 'horizon', 'bottom', 'sun', 'fog']) {
      skyCurrent[k].lerp(skyTarget[k], Math.min(1, dt * 0.8));
    }
    if (fogRef) fogRef.color.copy(skyCurrent.fog);

    // stars spin & bob
    for (const s of stars) {
      if (s.collected) continue;
      s.group.rotation.y += dt * 1.8;
      s.group.position.y = s.baseY + Math.sin(time * 2 + s.phase) * 0.22;
    }

    // ground colour flooding
    for (let i = zoneRadiusTweens.length - 1; i >= 0; i--) {
      const tw = zoneRadiusTweens[i];
      tw.t += dt / 3.2;
      const t = Math.min(1, tw.t);
      uZones.value[tw.idx].z = tw.target * easeOutCubic(t);
      if (t >= 1) zoneRadiusTweens.splice(i, 1);
    }

    // rainbows pop with a bounce
    for (const r of rainbows) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt / 1.4);
      const k = r.t;
      const s = k < 0.7 ? easeOutCubic(k / 0.7) * 1.12 : 1.12 - 0.12 * ((k - 0.7) / 0.3);
      r.group.scale.setScalar(Math.max(0.01, s));
    }
  }

  return {
    build, update, terrainH, completeZone, setFinale, setSuperDay,
    get stars() { return stars; },
    get terrainMesh() { return terrainMesh; },
    uGlobalPaint,
  };
})();
