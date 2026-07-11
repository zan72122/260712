/* =========================================================================
 * きらきら ドリームバレー — エフェクト
 * パーティクル（きらめき/ハート/花びら/ホタル/花火/ミスト）、
 * ちょうちょ、魚、気球、水しぶきリング
 * ========================================================================= */
(function () {
  'use strict';

  const DV = (window.DV = window.DV || {});
  const U = DV.U;

  /* ------------------------ 汎用パーティクルプール ------------------------ */
  class Pool {
    constructor(scene, cap, tex, blending, opts = {}) {
      this.cap = cap;
      this.parts = [];
      this.free = [];
      for (let i = 0; i < cap; i++) this.free.push(i);

      const pos = new Float32Array(cap * 3);
      const col = new Float32Array(cap * 3);
      const size = new Float32Array(cap);
      const alpha = new Float32Array(cap);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));

      this.mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: blending || THREE.AdditiveBlending,
        uniforms: { uMap: { value: tex } },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aSize, aAlpha;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = aColor; vAlpha = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.);
            gl_PointSize = aSize * (240. / max(1., -mv.z));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uMap;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec4 t = texture2D(uMap, gl_PointCoord);
            gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
            if (gl_FragColor.a < .01) discard;
          }`,
      });
      this.points = new THREE.Points(geo, this.mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = opts.renderOrder !== undefined ? opts.renderOrder : 5;
      scene.add(this.points);
      this.geo = geo;
      // 全部を遠くに置いておく
      for (let i = 0; i < cap; i++) pos[i * 3 + 1] = -999;
    }

    spawn(p) {
      if (!this.free.length) return null;
      const i = this.free.pop();
      const part = Object.assign({
        i, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 1, age: 0, size: 1, r: 1, g: 1, b: 1,
        gravity: 0, drag: 0, twinkle: 0, grow: 0, alpha: 1,
        flutter: 0, phase: Math.random() * Math.PI * 2,
      }, p);
      this.parts.push(part);
      return part;
    }

    update(dt, t) {
      const pos = this.geo.attributes.position.array;
      const col = this.geo.attributes.aColor.array;
      const size = this.geo.attributes.aSize.array;
      const alpha = this.geo.attributes.aAlpha.array;
      for (let k = this.parts.length - 1; k >= 0; k--) {
        const p = this.parts[k];
        p.age += dt;
        if (p.age >= p.life) {
          pos[p.i * 3 + 1] = -999;
          alpha[p.i] = 0;
          this.free.push(p.i);
          this.parts[k] = this.parts[this.parts.length - 1];
          this.parts.pop();
          continue;
        }
        p.vy -= p.gravity * dt;
        if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.flutter) {
          p.x += Math.sin(t * 2.4 + p.phase) * p.flutter * dt;
          p.z += Math.cos(t * 1.9 + p.phase * 1.3) * p.flutter * dt;
        }
        const lifeT = p.age / p.life;
        let a = p.alpha * Math.min(1, (1 - lifeT) * 4) * Math.min(1, p.age * 8 + 0.05);
        if (p.twinkle) a *= 0.6 + 0.4 * Math.sin(t * 14 + p.phase * 8);
        pos[p.i * 3] = p.x; pos[p.i * 3 + 1] = p.y; pos[p.i * 3 + 2] = p.z;
        col[p.i * 3] = p.r; col[p.i * 3 + 1] = p.g; col[p.i * 3 + 2] = p.b;
        size[p.i] = p.size * (1 + p.grow * lifeT);
        alpha[p.i] = a;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
    }
  }

  /* ------------------------------ FX 本体 ------------------------------ */
  const FX = {
    night: 0,
    _emitAcc: 0,
    _mistAcc: 0,
    _fireflyParts: [],

    init(scene) {
      this.scene = scene;
      const Tex = DV.Tex;
      this.sparkles = new Pool(scene, 1000, Tex.sparkle, THREE.AdditiveBlending);
      this.glows = new Pool(scene, 700, Tex.glow, THREE.AdditiveBlending);
      this.hearts = new Pool(scene, 140, Tex.heart, THREE.NormalBlending);
      this.petals = new Pool(scene, 220, Tex.petal, THREE.NormalBlending);
      this.stars = new Pool(scene, 160, Tex.star, THREE.AdditiveBlending);
      this.mist = new Pool(scene, 150, Tex.glow, THREE.NormalBlending, { renderOrder: 4 });
      this._buildFireflies();
      this._buildButterflies(scene);
      this._buildFish(scene);
      this._buildBalloon(scene);
      this._buildSplashRings(scene);
      this._rockets = [];
    },

    /* ---------- 汎用バースト ---------- */
    burst(pos, hex, n, opts = {}) {
      const c = U.C(hex);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = Math.random() * Math.PI - Math.PI / 2;
        const sp = (opts.speed || 3.5) * (0.4 + Math.random() * 0.8);
        this.sparkles.spawn({
          x: pos.x, y: pos.y, z: pos.z,
          vx: Math.cos(a) * Math.cos(el) * sp,
          vy: Math.sin(el) * sp + (opts.up || 1.5),
          vz: Math.sin(a) * Math.cos(el) * sp,
          life: (opts.life || 0.9) * (0.7 + Math.random() * 0.6),
          size: (opts.size || 0.55) * (0.7 + Math.random() * 0.7),
          r: c.r, g: c.g, b: c.b,
          gravity: opts.gravity !== undefined ? opts.gravity : 2.5,
          drag: 1.2, twinkle: 1,
        });
      }
    },

    heartsBurst(pos, n) {
      for (let i = 0; i < (n || 5); i++) {
        this.hearts.spawn({
          x: pos.x + (Math.random() - 0.5) * 0.8,
          y: pos.y + Math.random() * 0.5,
          z: pos.z + (Math.random() - 0.5) * 0.8,
          vy: 1.6 + Math.random() * 1.2,
          vx: (Math.random() - 0.5) * 0.8,
          vz: (Math.random() - 0.5) * 0.8,
          life: 1.3 + Math.random() * 0.5,
          size: 0.5 + Math.random() * 0.35,
          drag: 0.8, flutter: 0.6,
        });
      }
    },

    collectStar(pos) {
      this.burst(pos, 0xffe36e, 16, { speed: 3, up: 2.4, size: 0.6 });
      for (let i = 0; i < 5; i++) {
        this.stars.spawn({
          x: pos.x, y: pos.y, z: pos.z,
          vx: (Math.random() - 0.5) * 3, vy: 2.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
          life: 1.0, size: 0.7, r: 1.4, g: 1.2, b: 0.5, gravity: 4, drag: 1,
        });
      }
    },

    magicBurst(pos, hex) {
      this.burst(pos, hex, 30, { speed: 4.5, up: 3, size: 0.7, life: 1.3 });
      const c = U.C(hex);
      for (let i = 0; i < 10; i++) {
        this.glows.spawn({
          x: pos.x, y: pos.y + 0.3, z: pos.z,
          vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 2,
          life: 1.6, size: 1.4 + Math.random(), r: c.r, g: c.g, b: c.b, drag: 1.5, grow: 1.2,
        });
      }
    },

    tapMark(pos) {
      this.burst(pos, 0xfff6c8, 7, { speed: 1.6, up: 1.4, size: 0.4, life: 0.6, gravity: 1 });
    },

    /* ---------- 花びら（昼） ---------- */
    _emitPetals(dt, playerPos) {
      this._emitAcc += dt * (1 - this.night) * 9;
      while (this._emitAcc >= 1) {
        this._emitAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * 26;
        this.petals.spawn({
          x: playerPos.x + Math.cos(a) * r,
          y: playerPos.y + 8 + Math.random() * 7,
          z: playerPos.z + Math.sin(a) * r,
          vx: 0.5 + Math.random() * 0.6, vy: -0.9 - Math.random() * 0.6, vz: 0.25,
          life: 9, size: 0.42 + Math.random() * 0.3,
          flutter: 1.6, alpha: 0.95,
        });
      }
    },

    /* ---------- ホタル（夜） ---------- */
    _buildFireflies() {
      for (let i = 0; i < 130; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 70;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = DV.World.height(x, z);
        if (h < 0.5) continue;
        const p = this.glows.spawn({
          x, y: h + 0.6 + Math.random() * 2.2, z,
          life: 1e9, size: 0.55 + Math.random() * 0.4,
          r: 1.1, g: 1.0, b: 0.35, alpha: 0,
          phase: Math.random() * Math.PI * 2,
        });
        if (p) { p.baseY = p.y; p.baseX = p.x; p.baseZ = p.z; this._fireflyParts.push(p); }
      }
    },

    _updateFireflies(t) {
      const n = this.night;
      this._fireflyParts.forEach((p) => {
        p.x = p.baseX + Math.sin(t * 0.5 + p.phase * 3) * 2.2;
        p.z = p.baseZ + Math.cos(t * 0.4 + p.phase * 5) * 2.2;
        p.y = p.baseY + Math.sin(t * 0.9 + p.phase * 7) * 0.8;
        p.alpha = n * (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 + p.phase * 9)));
      });
    },

    /* ---------- ちょうちょ（昼） ---------- */
    _buildButterflies(scene) {
      this.butterflies = [];
      const wingGeo = new THREE.PlaneGeometry(0.34, 0.46);
      wingGeo.translate(0.17, 0, 0);
      const colors = [0xffb2d5, 0x9bd5ff, 0xfff0a0, 0xd5b2ff, 0xffc9a0];
      for (let i = 0; i < 14; i++) {
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({
          color: U.C(colors[i % colors.length]), side: THREE.DoubleSide,
          transparent: true, opacity: 0.95, fog: true,
        });
        const wl = new THREE.Mesh(wingGeo, mat);
        const wr = new THREE.Mesh(wingGeo, mat);
        wr.rotation.y = Math.PI;
        g.add(wl); g.add(wr);
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 55;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        g.position.set(x, Math.max(1.5, DV.World.height(x, z)) + 1 + Math.random() * 1.5, z);
        g.userData = {
          wl, wr, phase: Math.random() * Math.PI * 2,
          cx: x, cz: z, cr: 2 + Math.random() * 4, speed: 0.5 + Math.random() * 0.7,
        };
        scene.add(g);
        this.butterflies.push(g);
      }
    },

    _updateButterflies(t, dt) {
      const vis = 1 - this.night;
      this.butterflies.forEach((b) => {
        const d = b.userData;
        const flap = Math.sin(t * 16 + d.phase) * 0.9;
        d.wl.rotation.y = flap;
        d.wr.rotation.y = Math.PI - flap;
        const a = t * d.speed + d.phase;
        const px = d.cx + Math.cos(a) * d.cr;
        const pz = d.cz + Math.sin(a * 1.3) * d.cr;
        const py = Math.max(1.2, DV.World.height(px, pz)) + 1.1 + Math.sin(t * 1.7 + d.phase) * 0.5;
        // 進行方向を向く
        b.lookAt(px, py, pz);
        b.position.lerp(new THREE.Vector3(px, py, pz), Math.min(1, dt * 3));
        const s = Math.max(0.001, vis);
        b.scale.setScalar(s);
        b.visible = vis > 0.05;
      });
    },

    /* ---------- 魚のジャンプ ---------- */
    _buildFish(scene) {
      this.fish = [];
      const bodyGeo = new THREE.ConeGeometry(0.22, 0.8, 8);
      bodyGeo.rotateX(Math.PI / 2);
      const tailGeo = new THREE.ConeGeometry(0.16, 0.36, 6);
      tailGeo.rotateX(-Math.PI / 2);
      tailGeo.translate(0, 0, -0.5);
      const colors = [0xffa25f, 0x8fd3ff, 0xffd25f];
      const spots = [
        [-30, -45], [-26, -40], [10, 40], [riverXish(30), 30], [riverXish(55), 55],
      ];
      function riverXish(z) { return -30 + (z + 45) * 0.35 + 7 * Math.sin(z * 0.07); }
      spots.forEach(([x, z], i) => {
        const mat = new THREE.MeshLambertMaterial({ color: U.C(colors[i % colors.length]) });
        const g = new THREE.Group();
        g.add(new THREE.Mesh(bodyGeo, mat));
        g.add(new THREE.Mesh(tailGeo, mat));
        g.position.set(x, -1, z);
        g.visible = false;
        scene.add(g);
        this.fish.push({ g, x, z, state: 'wait', timer: 2 + Math.random() * 8, t: 0 });
      });
    },

    _updateFish(dt) {
      const SEA = DV.World.SEA_Y;
      this.fish.forEach((f) => {
        if (f.state === 'wait') {
          f.timer -= dt;
          if (f.timer <= 0) {
            f.state = 'jump'; f.t = 0;
            f.g.visible = true;
            this.splash(new THREE.Vector3(f.x, SEA, f.z), 0.6);
            if (DV.Audio.ready() && Math.random() < 0.7) DV.Audio.sfxSplash();
          }
        } else {
          f.t += dt * 1.1;
          const T = f.t;
          if (T >= 1) {
            f.state = 'wait'; f.timer = 4 + Math.random() * 9;
            f.g.visible = false;
            this.splash(new THREE.Vector3(f.x + 1.6, SEA, f.z), 0.5);
          } else {
            const h = Math.sin(T * Math.PI) * 2.2;
            f.g.position.set(f.x + T * 1.6, SEA + h, f.z);
            f.g.rotation.x = (T - 0.5) * 2.4;
          }
        }
      });
    },

    /* ---------- 水しぶきリング ---------- */
    _buildSplashRings(scene) {
      this.rings = [];
      const geo = new THREE.RingGeometry(0.5, 0.62, 24);
      geo.rotateX(-Math.PI / 2);
      for (let i = 0; i < 8; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: U.C(0xeafcff), transparent: true, opacity: 0, depthWrite: false, fog: true,
        });
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        m.renderOrder = 3;
        scene.add(m);
        this.rings.push({ m, t: 1e9 });
      }
    },

    splash(pos, scale) {
      const r = this.rings.find((r) => r.t > 1);
      if (r) {
        r.t = 0;
        r.m.visible = true;
        r.m.position.set(pos.x, DV.World.SEA_Y + 0.05, pos.z);
        r.scale = scale || 1;
      }
      this.burst(pos, 0xbfefff, 8, { speed: 2, up: 2.4, size: 0.42, life: 0.65, gravity: 6 });
    },

    _updateRings(dt) {
      this.rings.forEach((r) => {
        if (r.t > 1) { r.m.visible = false; return; }
        r.t += dt * 1.4;
        const s = (0.4 + r.t * 3.2) * (r.scale || 1);
        r.m.scale.set(s, 1, s);
        r.m.material.opacity = (1 - r.t) * 0.75;
      });
    },

    /* ---------- 気球 ---------- */
    _buildBalloon(scene) {
      const g = new THREE.Group();
      const envMat = new THREE.MeshLambertMaterial({ color: U.C(0xff7fae) });
      const env = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 12), envMat);
      env.scale.y = 1.15;
      g.add(env);
      // ストライプ
      const stripe = new THREE.Mesh(
        new THREE.SphereGeometry(2.62, 14, 12, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.18),
        new THREE.MeshLambertMaterial({ color: U.C(0xfff3c8) })
      );
      stripe.scale.y = 1.15;
      g.add(stripe);
      const basket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.55, 0.8, 8),
        new THREE.MeshLambertMaterial({ color: U.C(0xa07040) })
      );
      basket.position.y = -3.6;
      g.add(basket);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const rope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4),
          new THREE.MeshLambertMaterial({ color: U.C(0x8a6a4a) })
        );
        rope.position.set(Math.cos(a) * 0.62, -2.9, Math.sin(a) * 0.62);
        g.add(rope);
      }
      scene.add(g);
      this.balloon = g;
    },

    _updateBalloon(t) {
      const a = t * 0.021;
      const r = 68;
      this.balloon.position.set(Math.cos(a) * r, 26 + Math.sin(t * 0.3) * 2.5, Math.sin(a) * r * 0.8 - 10);
      this.balloon.rotation.y = -a;
    },

    /* ---------- 滝のミスト ---------- */
    _emitMist(dt) {
      const wf = DV.World.waterfallPos;
      this._mistAcc += dt * 22;
      while (this._mistAcc >= 1) {
        this._mistAcc -= 1;
        this.mist.spawn({
          x: wf.x + (Math.random() - 0.5) * 4.5,
          y: DV.World.SEA_Y + 0.3,
          z: wf.z + 2.4 + (Math.random() - 0.5) * 2,
          vx: (Math.random() - 0.5) * 0.7, vy: 0.9 + Math.random() * 1.1, vz: 0.4 + Math.random() * 0.5,
          life: 1.6 + Math.random(), size: 1.6 + Math.random() * 1.6,
          r: 0.85, g: 0.92, b: 1.0, alpha: 0.16, grow: 1.6, drag: 0.6,
        });
      }
    },

    /* ---------- 花火 ---------- */
    launchFirework(x, z, hex) {
      const colors = [0xff6f9e, 0xffd24a, 0x7ec8ff, 0xa2ff9e, 0xc99eff, 0xff9e5f];
      const c = hex || colors[(Math.random() * colors.length) | 0];
      this._rockets.push({
        x, z, y: DV.World.height(x, z) + 2,
        vy: 22 + Math.random() * 6, color: c, trail: 0,
      });
      if (DV.Audio.ready()) DV.Audio.sfxFirework(0);
    },

    _updateRockets(dt) {
      for (let i = this._rockets.length - 1; i >= 0; i--) {
        const r = this._rockets[i];
        r.y += r.vy * dt;
        r.vy -= 9 * dt;
        r.trail += dt * 60;
        while (r.trail >= 1) {
          r.trail -= 1;
          this.glows.spawn({
            x: r.x + (Math.random() - 0.5) * 0.2, y: r.y, z: r.z + (Math.random() - 0.5) * 0.2,
            vy: -1, life: 0.5, size: 0.5, r: 1.2, g: 1.0, b: 0.7, alpha: 0.8,
          });
        }
        if (r.vy <= 3) {
          this._rockets.splice(i, 1);
          this._explode(r);
        }
      }
    },

    _explode(r) {
      const c = U.C(r.color);
      const c2 = U.C(0xffffff);
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = Math.acos(Math.random() * 2 - 1) - Math.PI / 2;
        const sp = 7 + Math.random() * 5;
        const white = Math.random() < 0.25;
        const cc = white ? c2 : c;
        this.glows.spawn({
          x: r.x, y: r.y, z: r.z,
          vx: Math.cos(a) * Math.cos(el) * sp,
          vy: Math.sin(el) * sp,
          vz: Math.sin(a) * Math.cos(el) * sp,
          life: 1.4 + Math.random() * 0.7,
          size: 0.55 + Math.random() * 0.5,
          r: cc.r * 1.5, g: cc.g * 1.5, b: cc.b * 1.5,
          gravity: 3.2, drag: 1.1, twinkle: 1,
        });
      }
      for (let i = 0; i < 12; i++) {
        this.stars.spawn({
          x: r.x, y: r.y, z: r.z,
          vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, vz: (Math.random() - 0.5) * 8,
          life: 1.6, size: 0.8, r: 1.5, g: 1.3, b: 0.6, gravity: 2.5, drag: 1,
        });
      }
    },

    /* ---------- 毎フレーム ---------- */
    update(t, dt, playerPos, nightF) {
      this.night = nightF;
      this._emitPetals(dt, playerPos);
      this._updateFireflies(t);
      this._updateButterflies(t, dt);
      this._updateFish(dt);
      this._updateRings(dt);
      this._updateBalloon(t);
      this._emitMist(dt);
      this._updateRockets(dt);
      this.sparkles.update(dt, t);
      this.glows.update(dt, t);
      this.hearts.update(dt, t);
      this.petals.update(dt, t);
      this.stars.update(dt, t);
      this.mist.update(dt, t);
    },
  };

  DV.FX = FX;
})();
