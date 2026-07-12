/* =========================================================
 * いちごましゅまろのおか — sky.js
 * 空のグラデーションドーム・太陽・月・星・ましゅまろ雲
 * 昼夜サイクル（照明とフォグも一括管理）
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  const SKY_R = 420;

  // ---- 時間帯パレット（phase: 0=お昼, 0.25=夕方, 0.5=真夜中, 0.75=夜明け） ----
  function C(hex) { return new THREE.Color(hex); }
  const KEYS = [
    { t: 0.00, top: C(0x4db3f5), mid: C(0xa8e3ff), bot: C(0xfdeef4), fog: C(0xcfeeff), sun: C(0xfff3d6), sunI: 0.68, hemiI: 0.4, amb: 0.22, night: 0 },
    { t: 0.16, top: C(0x4fa9ee), mid: C(0xb6e0ff), bot: C(0xffefd8), fog: C(0xd8ecff), sun: C(0xffedc0), sunI: 0.62, hemiI: 0.38, amb: 0.22, night: 0 },
    { t: 0.23, top: C(0x7f7fd6), mid: C(0xffb08a), bot: C(0xffd9a0), fog: C(0xf3c9a8), sun: C(0xffc077), sunI: 0.52, hemiI: 0.32, amb: 0.21, night: 0.1 },
    { t: 0.29, top: C(0x3d3f86), mid: C(0xd96f9b), bot: C(0xffb37c), fog: C(0xc98ea3), sun: C(0xff9c66), sunI: 0.4, hemiI: 0.27, amb: 0.2, night: 0.35 },
    { t: 0.36, top: C(0x131a45), mid: C(0x2c3a75), bot: C(0x51549a), fog: C(0x3d4478), sun: C(0xbfd0ff), sunI: 0.24, hemiI: 0.2, amb: 0.17, night: 1 },
    { t: 0.50, top: C(0x0a1033), mid: C(0x1c2a5e), bot: C(0x35407e), fog: C(0x2a3260), sun: C(0xbfd0ff), sunI: 0.22, hemiI: 0.18, amb: 0.16, night: 1 },
    { t: 0.64, top: C(0x131a45), mid: C(0x2c3a75), bot: C(0x51549a), fog: C(0x3d4478), sun: C(0xbfd0ff), sunI: 0.24, hemiI: 0.2, amb: 0.17, night: 1 },
    { t: 0.71, top: C(0x4a4f9e), mid: C(0xc98bb0), bot: C(0xffc9a2), fog: C(0xc9a4b4), sun: C(0xffb98a), sunI: 0.38, hemiI: 0.27, amb: 0.2, night: 0.35 },
    { t: 0.78, top: C(0x64a9e8), mid: C(0xffd0b0), bot: C(0xfff0cf), fog: C(0xecd8c8), sun: C(0xffe0a8), sunI: 0.5, hemiI: 0.33, amb: 0.21, night: 0.05 },
    { t: 0.88, top: C(0x4db3f5), mid: C(0xa8e3ff), bot: C(0xfdeef4), fog: C(0xcfeeff), sun: C(0xfff3d6), sunI: 0.65, hemiI: 0.39, amb: 0.22, night: 0 },
    { t: 1.00, top: C(0x4db3f5), mid: C(0xa8e3ff), bot: C(0xfdeef4), fog: C(0xcfeeff), sun: C(0xfff3d6), sunI: 0.68, hemiI: 0.4, amb: 0.22, night: 0 },
  ];

  function Sky(scene) {
    this.scene = scene;
    this.phase = 0.06;          // お昼すぎからスタート
    this.speed = 1 / 260;       // 約4分20秒で1日
    this.fastTarget = null;     // 早送り先の phase
    this.night01 = 0;
    this.sunDir = new THREE.Vector3(0, 1, 0);

    // ---- 空ドーム ----
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uBot: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xfff3d6) },
      uGlow: { value: 1.0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vDir = normalize(position);',
        '  vec4 p = modelViewMatrix * vec4(position,1.0);',
        '  gl_Position = projectionMatrix * p;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;',
        'uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uGlow;',
        'void main(){',
        '  float h = vDir.y;',
        '  vec3 col = mix(uBot, uMid, smoothstep(-0.06, 0.22, h));',
        '  col = mix(col, uTop, smoothstep(0.22, 0.85, h));',
        '  float d = max(dot(vDir, uSunDir), 0.0);',
        '  col += uSunColor * pow(d, 180.0) * 1.2 * uGlow;',   // 太陽コア
        '  col += uSunColor * pow(d, 8.0) * 0.35 * uGlow;',    // ハロー
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 20), skyMat);
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // ---- フォグ ----
    scene.fog = new THREE.Fog(0xcfeeff, 70, 340);

    // ---- 照明 ----
    this.sunLight = new THREE.DirectionalLight(0xfff3d6, 1.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const sc = this.sunLight.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
    sc.near = 10; sc.far = 260;
    this.sunLight.shadow.bias = -0.0008;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0xbfe8ff, 0x8fbf6a, 0.85);
    scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(this.amb);

    // ---- 太陽と月の見た目 ----
    const sunTex = IM.makeGlowTexture('rgba(255,240,190,1)', 'rgba(255,200,120,0)', 128);
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
    this.sunSprite.scale.setScalar(90);
    scene.add(this.sunSprite);

    this.moonGroup = new THREE.Group();
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(12, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false })
    );
    // うさぎ模様風のクレーター
    const craterMat = new THREE.MeshBasicMaterial({ color: 0xe8d9a8, fog: false });
    [[4, 3, 10.5, 2.6], [-4.5, -2, 10.8, 1.9], [1, -5, 10.6, 1.4]].forEach((c) => {
      const cr = new THREE.Mesh(new THREE.SphereGeometry(c[3], 10, 8), craterMat);
      cr.position.set(c[0], c[1], c[2]);
      cr.scale.z = 0.25;
      moon.add(cr);
    });
    this.moonGroup.add(moon);
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: IM.makeGlowTexture('rgba(220,230,255,0.9)', 'rgba(200,220,255,0)', 128),
      transparent: true, depthWrite: false, fog: false,
    }));
    moonGlow.scale.setScalar(70);
    this.moonGroup.add(moonGlow);
    scene.add(this.moonGroup);

    // ---- 星（2種類のサイズでまたたき） ----
    this.starMats = [];
    for (let layer = 0; layer < 2; layer++) {
      const n = layer === 0 ? 260 : 90;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        // 上半球にランダム配置
        const a = IM.rand(0, IM.TAU);
        const y = IM.rand(0.12, 1);
        const r = Math.sqrt(1 - y * y);
        pos[i * 3] = Math.cos(a) * r * SKY_R * 0.92;
        pos[i * 3 + 1] = y * SKY_R * 0.92;
        pos[i * 3 + 2] = Math.sin(a) * r * SKY_R * 0.92;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: layer === 0 ? 2.6 : 5.5,
        map: layer === 0 ? IM.makeCircleTexture('#ffffff', 32) : IM.makeStarTexture('#fff8d8', 64),
        transparent: true, opacity: 0, depthWrite: false, fog: false,
        sizeAttenuation: false,
      });
      this.starMats.push(mat);
      const pts = new THREE.Points(geo, mat);
      pts.renderOrder = -9;
      scene.add(pts);
    }

    // ---- ましゅまろ雲 ----
    this.clouds = [];
    this.cloudMat = IM.toon(0xffffff);
    this.cloudMat.fog = false;
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const puffs = IM.randInt(4, 7);
      for (let p = 0; p < puffs; p++) {
        const r = IM.rand(5, 11);
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), this.cloudMat);
        m.position.set(IM.rand(-14, 14), IM.rand(-2.5, 3.5), IM.rand(-5, 5));
        m.scale.y = 0.62;
        g.add(m);
      }
      g.position.set(IM.rand(-260, 260), IM.rand(60, 130), IM.rand(-260, 260));
      g.userData.speed = IM.rand(1.2, 3.2);
      g.userData.bobPhase = IM.rand(0, IM.TAU);
      this.clouds.push(g);
      scene.add(g);
    }

    this._colTmp = { top: C(0), mid: C(0), bot: C(0), fog: C(0), sun: C(0) };
    this.update(0, new THREE.Vector3());
  }

  // phase → パレット補間
  Sky.prototype._palette = function (t) {
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const f = b.t === a.t ? 0 : IM.smoothstep(a.t, b.t, t);
    const o = this._colTmp;
    IM.mixColor(o.top, a.top, b.top, f);
    IM.mixColor(o.mid, a.mid, b.mid, f);
    IM.mixColor(o.bot, a.bot, b.bot, f);
    IM.mixColor(o.fog, a.fog, b.fog, f);
    IM.mixColor(o.sun, a.sun, b.sun, f);
    o.sunI = IM.lerp(a.sunI, b.sunI, f);
    o.hemiI = IM.lerp(a.hemiI, b.hemiI, f);
    o.amb = IM.lerp(a.amb, b.amb, f);
    o.night = IM.lerp(a.night, b.night, f);
    return o;
  };

  // 昼夜切り替えボタン: 'day' | 'night' へ早送り
  Sky.prototype.fastForwardTo = function (which) {
    this.fastTarget = which === 'night' ? 0.42 : 0.95;
    // すでに近ければ 1周先へ
    const d = (this.fastTarget - this.phase + 1) % 1;
    if (d < 0.02) this.fastTarget = null;
  };

  Sky.prototype.isDay = function () { return this.night01 < 0.5; };

  Sky.prototype.update = function (dt, camPos, time) {
    time = time || 0;
    // 進行（早送り対応）
    let spd = this.speed;
    if (this.fastTarget !== null) {
      spd = 0.14; // 数秒で目的の時間帯へ
      const d = (this.fastTarget - this.phase + 1) % 1;
      if (d < spd * dt * 1.5) {
        this.phase = this.fastTarget;
        this.fastTarget = null;
      }
    }
    this.phase = (this.phase + spd * dt) % 1;

    const p = this._palette(this.phase);
    this.night01 = p.night;

    // 空・フォグ
    this.uniforms.uTop.value.copy(p.top);
    this.uniforms.uMid.value.copy(p.mid);
    this.uniforms.uBot.value.copy(p.bot);
    this.uniforms.uSunColor.value.copy(p.sun);
    this.scene.fog.color.copy(p.fog);

    // 太陽の軌道（phase 0 = 天頂）
    const ang = this.phase * IM.TAU;
    const sx = Math.sin(ang) * 0.55, sy = Math.cos(ang), sz = -0.4;
    this.sunDir.set(sx, sy, sz).normalize();
    this.uniforms.uSunDir.value.copy(this.sunDir);
    this.uniforms.uGlow.value = 1 - p.night * 0.92;

    // ライト
    const moonDir = new THREE.Vector3(-sx, -sy, sz).normalize();
    const lightDir = p.night > 0.5 ? moonDir : this.sunDir;
    this.sunLight.position.copy(lightDir).multiplyScalar(150).add(camPos);
    this.sunLight.position.y = Math.max(this.sunLight.position.y, camPos.y + 30);
    this.sunLight.target.position.copy(camPos);
    this.sunLight.color.copy(p.sun);
    this.sunLight.intensity = p.sunI;
    this.hemi.intensity = p.hemiI;
    this.hemi.color.copy(p.mid);
    this.amb.intensity = p.amb;

    // 太陽スプライト・月
    this.sunSprite.position.copy(this.sunDir).multiplyScalar(SKY_R * 0.9).add(camPos);
    this.sunSprite.material.opacity = IM.clamp(1 - p.night * 1.4, 0, 1);
    this.moonGroup.position.copy(moonDir).multiplyScalar(SKY_R * 0.82).add(camPos);
    this.moonGroup.visible = p.night > 0.05;

    // 星
    const starA = IM.smoothstep(0.35, 0.9, p.night);
    this.starMats[0].opacity = starA * (0.75 + 0.25 * Math.sin(time * 2.1));
    this.starMats[1].opacity = starA * (0.8 + 0.2 * Math.sin(time * 3.3 + 1.2));

    // 雲（ドリフト・夜は薄暗く）
    const cloudCol = 0.45 + 0.55 * (1 - p.night);
    this.cloudMat.color.setRGB(cloudCol, cloudCol, cloudCol * 1.04);
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      c.position.y += Math.sin(time * 0.4 + c.userData.bobPhase) * dt * 0.6;
      if (c.position.x > 290) c.position.x = -290;
    }

    // ドームはカメラに追従（視差なしの無限遠風）
    this.dome.position.copy(camPos);
  };

  IM.Sky = Sky;
})();
