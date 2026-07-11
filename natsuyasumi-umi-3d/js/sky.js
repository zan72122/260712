/* ============================================================
   sky.js — 空と時間
   スカイドームシェーダー / 太陽と月 / 星 / 雲 / ライティング
   1日 = G.state.time (0..1)
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  /* ---------------- 時刻パレット ----------------
     time: キー時刻 / それぞれ空・光・水の色一式 */
  const KEYS = [
    { // よあけ
      time: 0.02,
      skyTop: 0x2e4a8c, skyHorizon: 0xffb98a, sunColor: 0xffc9a0,
      lightInt: 0.45, hemiSky: 0x9fb4d8, hemiGround: 0x8a7a6a, hemiInt: 0.55,
      fog: 0xf2b58c, waterDeep: 0x1d4d6e, waterShallow: 0x4da5b5,
      stars: 0.25, night: 0.15, sunset: 0.5,
    },
    { // あさ
      time: 0.12,
      skyTop: 0x3a86d6, skyHorizon: 0xcfeaf5, sunColor: 0xfff2d8,
      lightInt: 1.0, hemiSky: 0xbfdcf0, hemiGround: 0xa8927a, hemiInt: 0.75,
      fog: 0xcfe8f2, waterDeep: 0x0f6a9e, waterShallow: 0x3ecfc0,
      stars: 0, night: 0, sunset: 0,
    },
    { // まひる（いちばん濃い夏空）
      time: 0.32,
      skyTop: 0x1d6fd0, skyHorizon: 0xaad9f2, sunColor: 0xfffbe8,
      lightInt: 1.35, hemiSky: 0xcfe6f5, hemiGround: 0xb5a084, hemiInt: 0.85,
      fog: 0xb8def0, waterDeep: 0x0a63a0, waterShallow: 0x2fd6c8,
      stars: 0, night: 0, sunset: 0,
    },
    { // ごご
      time: 0.52,
      skyTop: 0x2a78c8, skyHorizon: 0xc0e2ef, sunColor: 0xfff0c8,
      lightInt: 1.15, hemiSky: 0xc8e2f0, hemiGround: 0xb09a80, hemiInt: 0.8,
      fog: 0xc4e2ee, waterDeep: 0x0d629a, waterShallow: 0x35cdc2,
      stars: 0, night: 0, sunset: 0.05,
    },
    { // ゆうやけ（息をのむ時間）
      time: 0.68,
      skyTop: 0x8878d8, skyHorizon: 0xff8a3d, sunColor: 0xffb060,
      lightInt: 0.8, hemiSky: 0xc8a0b0, hemiGround: 0x8a6a5a, hemiInt: 0.6,
      fog: 0xe8935e, waterDeep: 0x28477d, waterShallow: 0xcf8a68,
      stars: 0.05, night: 0.05, sunset: 1.0,
    },
    { // たそがれ
      time: 0.78,
      skyTop: 0x1c2a5e, skyHorizon: 0xd06a8a, sunColor: 0xff9a70,
      lightInt: 0.35, hemiSky: 0x6a7ab0, hemiGround: 0x50485a, hemiInt: 0.5,
      fog: 0x8a6a9a, waterDeep: 0x1a3060, waterShallow: 0x5a6a9a,
      stars: 0.5, night: 0.55, sunset: 0.45,
    },
    { // よる（星と月）
      time: 0.88,
      skyTop: 0x0a1030, skyHorizon: 0x1c3a6a, sunColor: 0xbcd0ff,
      lightInt: 0.22, hemiSky: 0x3a4a7a, hemiGround: 0x2a2a3e, hemiInt: 0.42,
      fog: 0x14284a, waterDeep: 0x0a1838, waterShallow: 0x1a3a5e,
      stars: 1.0, night: 1.0, sunset: 0,
    },
    { // まよなか → よあけへ
      time: 0.98,
      skyTop: 0x0c1436, skyHorizon: 0x2a3a68, sunColor: 0xc8d8ff,
      lightInt: 0.22, hemiSky: 0x3e4e80, hemiGround: 0x2a2a40, hemiInt: 0.42,
      fog: 0x1a2c50, waterDeep: 0x0a1a3c, waterShallow: 0x1e3e62,
      stars: 0.9, night: 0.95, sunset: 0.05,
    },
  ];

  const _c1 = new THREE.Color(), _c2 = new THREE.Color();
  function lerpKey(prop, a, b, t, isColor) {
    if (isColor) {
      _c1.setHex(a[prop]); _c2.setHex(b[prop]);
      return _c1.lerp(_c2, t);
    }
    return G.lerp(a[prop], b[prop], t);
  }

  function samplePalette(time) {
    let a = KEYS[KEYS.length - 1], b = KEYS[0], t = 0;
    // 折返し込みで区間を探す
    const wrapped = ((time % 1) + 1) % 1;
    for (let i = 0; i < KEYS.length; i++) {
      const k0 = KEYS[i];
      const k1 = KEYS[(i + 1) % KEYS.length];
      let t0 = k0.time, t1 = k1.time;
      if (t1 <= t0) t1 += 1;
      let tt = wrapped;
      if (tt < t0) tt += 1;
      if (tt >= t0 && tt <= t1) {
        a = k0; b = k1;
        t = G.smoothstep(0, 1, (tt - t0) / (t1 - t0));
        break;
      }
    }
    return { a, b, t };
  }

  /* ---------------- スカイドームシェーダー ---------------- */
  const skyVert = `
    varying vec3 vWorld;
    void main() {
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const skyFrag = `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform vec3 uMoonDir;
    uniform float uStars;
    uniform float uSunset;
    uniform float uTime;
    varying vec3 vWorld;

    // ハッシュで星
    float hash(vec3 p) {
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yzx + 19.19);
      return fract((p.x + p.y) * p.z);
    }

    void main() {
      vec3 dir = normalize(vWorld);
      float h = clamp(dir.y, -0.05, 1.0);

      // 基本グラデーション（地平線→天頂）
      // 低い視線でも上空の色が見えるように仰角を圧縮
      float hh = clamp(max(h, 0.0) * 1.9, 0.0, 1.0);
      float grad = pow(1.0 - hh, 1.8);
      vec3 col = mix(uTop, uHorizon, grad);

      // 夕焼けは太陽側の地平線を濃く
      float sunSide = max(dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
      col += uSunColor * uSunset * pow(sunSide, 3.0) * pow(1.0 - max(h, 0.0), 2.5) * 0.55;

      // 太陽ディスク + グロー
      float sunDot = max(dot(dir, uSunDir), 0.0);
      float disc = smoothstep(0.9992, 0.9997, sunDot);
      float glow = pow(sunDot, 90.0) * 0.55 + pow(sunDot, 8.0) * 0.18;
      col += uSunColor * (disc * 1.6 + glow);

      // 月（夜）
      float moonDot = max(dot(dir, uMoonDir), 0.0);
      float moonDisc = smoothstep(0.9994, 0.9998, moonDot);
      float moonGlow = pow(moonDot, 160.0) * 0.5;
      col += vec3(0.92, 0.95, 1.0) * (moonDisc * 1.1 + moonGlow) * uStars;

      // 星（上空ほど濃く・ちらちら）
      if (uStars > 0.01 && dir.y > 0.02) {
        vec3 sp = floor(dir * 220.0);
        float star = step(0.9975, hash(sp));
        float tw = 0.6 + 0.4 * sin(uTime * 3.0 + hash(sp.zyx) * 40.0);
        col += vec3(1.0, 0.98, 0.9) * star * tw * uStars * smoothstep(0.02, 0.25, dir.y);
      }

      gl_FragColor = vec4(col, 1.0);
    }`;

  G.createSky = function (scene) {
    const sky = {};

    const uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uStars: { value: 0 },
      uSunset: { value: 0 },
      uTime: { value: 0 },
    };

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(430, 32, 20),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    scene.add(dome);

    /* ---- ライト ---- */
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.5;
    scene.add(sun);
    scene.add(sun.target);

    const hemi = new THREE.HemisphereLight(0xcfe6f5, 0xb5a084, 0.8);
    scene.add(hemi);

    scene.fog = new THREE.Fog(0xb8def0, 70, 380);

    /* ---- 雲（ソフトなスプライトのかたまり） ---- */
    const cloudTex = G.softCircleTexture(128, 0.35);
    const cloudGroup = new THREE.Group();
    const cloudPuffs = [];
    for (let i = 0; i < 11; i++) {
      const cluster = new THREE.Group();
      const cx = G.rand(-260, 260);
      const cy = G.rand(55, 110);
      const cz = G.rand(-260, 260);
      const n = G.randInt(4, 7);
      for (let j = 0; j < n; j++) {
        const mat = new THREE.SpriteMaterial({
          map: cloudTex, transparent: true, depthWrite: false,
          opacity: G.rand(0.5, 0.8), fog: false,
        });
        const s = new THREE.Sprite(mat);
        const w = G.rand(26, 52);
        s.scale.set(w, w * G.rand(0.35, 0.5), 1);
        s.position.set(G.rand(-26, 26), G.rand(-4, 7), G.rand(-10, 10));
        cluster.add(s);
        cloudPuffs.push(s);
      }
      cluster.position.set(cx, cy, cz);
      cluster.userData.speed = G.rand(0.8, 2.0);
      cloudGroup.add(cluster);
    }
    scene.add(cloudGroup);

    /* ---- 更新 ---- */
    const sunPos = new THREE.Vector3();
    const moonPos = new THREE.Vector3();
    const cloudTint = new THREE.Color();

    sky.update = function (dt, elapsed, playerPos) {
      const st = G.state;
      st.time = (st.time + dt * st.timeSpeed) % 1;

      const { a, b, t } = samplePalette(st.time);

      // 太陽の軌道：time 0.02(のぼる)→0.75(しずむ)
      const dayT = G.clamp((st.time - 0.02) / 0.73, 0, 1);
      const sunAngle = dayT * Math.PI; // 0=東の地平線, PI=西
      const elev = Math.sin(sunAngle);
      const az = Math.cos(sunAngle);
      sunPos.set(az * 0.8, Math.max(elev, -0.25), -0.45 + elev * 0.1).normalize();

      // 月は夜（time 0.78..1.02）にのぼる
      const nightT = G.clamp((st.time - 0.76) / 0.26, 0, 1);
      const moonAngle = nightT * Math.PI;
      moonPos.set(Math.cos(moonAngle) * 0.7, Math.max(Math.sin(moonAngle), -0.2), 0.55).normalize();

      // env 更新
      const env = G.env;
      env.sunDir.copy(sunPos);
      env.sunColor.copy(lerpKey('sunColor', a, b, t, true));
      env.skyTop.copy(lerpKey('skyTop', a, b, t, true));
      env.skyHorizon.copy(lerpKey('skyHorizon', a, b, t, true));
      env.fogColor.copy(lerpKey('fog', a, b, t, true));
      env.dayLight = G.clamp(lerpKey('lightInt', a, b, t, false) / 1.35, 0, 1);
      env.nightGlow = lerpKey('night', a, b, t, false);
      env.sunsetGlow = lerpKey('sunset', a, b, t, false);
      env.waterDeep = env.waterDeep || new THREE.Color();
      env.waterShallow = env.waterShallow || new THREE.Color();
      env.waterDeep.copy(lerpKey('waterDeep', a, b, t, true));
      env.waterShallow.copy(lerpKey('waterShallow', a, b, t, true));
      const starsV = lerpKey('stars', a, b, t, false);

      // シェーダー uniform
      uniforms.uTop.value.copy(env.skyTop);
      uniforms.uHorizon.value.copy(env.skyHorizon);
      uniforms.uSunColor.value.copy(env.sunColor);
      uniforms.uSunDir.value.copy(sunPos);
      uniforms.uMoonDir.value.copy(moonPos);
      uniforms.uStars.value = starsV;
      uniforms.uSunset.value = env.sunsetGlow;
      uniforms.uTime.value = elapsed;

      // ライト
      const lightInt = lerpKey('lightInt', a, b, t, false);
      const nightLight = env.nightGlow;
      // 夜は月光に切替え
      if (nightLight > 0.6) {
        sun.position.copy(moonPos).multiplyScalar(120);
        sun.color.set(0xaac4ff);
        sun.intensity = 0.3;
      } else {
        sun.position.copy(sunPos).multiplyScalar(120);
        sun.color.copy(env.sunColor);
        sun.intensity = lightInt;
      }
      if (playerPos) {
        sun.target.position.set(playerPos.x, 0, playerPos.z);
        sun.position.add(sun.target.position);
      }

      hemi.color.copy(lerpKey('hemiSky', a, b, t, true));
      hemi.groundColor.copy(lerpKey('hemiGround', a, b, t, true));
      hemi.intensity = lerpKey('hemiInt', a, b, t, false);

      // フォグ
      const fog = dome.parent.fog;
      fog.color.copy(env.fogColor);

      // 雲：流す + 色
      cloudTint.copy(env.sunColor).lerp(new THREE.Color(0xffffff), 0.5)
        .multiplyScalar(0.35 + env.dayLight * 0.65);
      if (env.sunsetGlow > 0.3) cloudTint.lerp(new THREE.Color(0xffb070), env.sunsetGlow * 0.5);
      for (const c of cloudGroup.children) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 300) c.position.x = -300;
      }
      for (const p of cloudPuffs) p.material.color.copy(cloudTint);
    };

    return sky;
  };
})();
