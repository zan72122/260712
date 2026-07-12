/* =========================================================
 * いちごましゅまろのおか — effects.js
 * 花びら・キラキラ・紙ふぶき・花火・ホタル・タップマーカー
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  function Effects(scene) {
    this.scene = scene;
    this._buildPetals();
    this._buildSparkles();
    this._buildConfetti();
    this._buildFireflies();
    this._buildMarker();
    this.fireworkTimers = [];
  }

  // ---------- さくらの花びら ----------
  Effects.prototype._buildPetals = function () {
    const N = 130;
    this.petalN = N;
    const geo = new THREE.PlaneGeometry(0.17, 0.12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffb3cf, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
    });
    this.petals = new THREE.InstancedMesh(geo, mat, N);
    this.petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.petalState = [];
    for (let i = 0; i < N; i++) {
      this.petalState.push(this._newPetal(new THREE.Vector3(), true));
    }
    this.scene.add(this.petals);
    this._dummy = new THREE.Object3D();
  };

  Effects.prototype._newPetal = function (center, anywhere) {
    return {
      x: center.x + IM.rand(-26, 26),
      y: anywhere ? IM.rand(0.5, 12) : IM.rand(9, 14),
      z: center.z + IM.rand(-26, 26),
      vy: IM.rand(0.35, 0.8),
      swayA: IM.rand(0.5, 1.6),
      swayF: IM.rand(0.6, 1.5),
      phase: IM.rand(0, IM.TAU),
      rx: IM.rand(0, IM.TAU), ry: IM.rand(0, IM.TAU),
      rvx: IM.rand(1, 3), rvy: IM.rand(1, 3),
      scale: IM.rand(0.7, 1.4),
    };
  };

  // ---------- キラキラ（バースト共用パーティクルプール） ----------
  Effects.prototype._buildSparkles = function () {
    const N = 420;
    this.sparkN = N;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      map: IM.makeStarTexture('#ffffff', 64),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });
    this.sparkles = new THREE.Points(geo, mat);
    this.sparkles.frustumCulled = false;
    this.scene.add(this.sparkles);
    this.sparkState = [];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.sparkState.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grav: 0 });
      pos[i * 3 + 1] = -999;
    }
    this._sparkCursor = 0;
    this._colTmp = c;
  };

  // pos に向けてキラキラを放出
  Effects.prototype.burst = function (p, colorHex, count, opts) {
    opts = opts || {};
    const posAttr = this.sparkles.geometry.attributes.position;
    const colAttr = this.sparkles.geometry.attributes.color;
    const c = this._colTmp.setHex(colorHex === undefined ? 0xfff2a8 : colorHex);
    const speed = opts.speed || 3.2;
    const life = opts.life || 0.9;
    for (let n = 0; n < (count || 16); n++) {
      const i = this._sparkCursor;
      this._sparkCursor = (this._sparkCursor + 1) % this.sparkN;
      const s = this.sparkState[i];
      const theta = IM.rand(0, IM.TAU);
      const phi = Math.acos(IM.rand(-1, 1));
      const spd = IM.rand(speed * 0.35, speed);
      s.vx = Math.sin(phi) * Math.cos(theta) * spd;
      s.vy = Math.abs(Math.cos(phi)) * spd * (opts.up === false ? IM.rand(-1, 1) : 1);
      s.vz = Math.sin(phi) * Math.sin(theta) * spd;
      s.grav = opts.grav !== undefined ? opts.grav : 4.5;
      s.life = s.maxLife = IM.rand(life * 0.6, life);
      posAttr.setXYZ(i, p.x, p.y, p.z);
      // 色ゆらぎ
      colAttr.setXYZ(i,
        IM.clamp(c.r + IM.rand(-0.1, 0.15), 0, 1),
        IM.clamp(c.g + IM.rand(-0.1, 0.15), 0, 1),
        IM.clamp(c.b + IM.rand(-0.1, 0.15), 0, 1));
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  // 花火（お祝い）: 数発を時間差で
  Effects.prototype.fireworks = function (center) {
    const colors = [0xff6b8f, 0xffd166, 0x8fd8ff, 0xc3a8ff, 0x7ed07a, 0xffffff];
    for (let i = 0; i < 7; i++) {
      this.fireworkTimers.push({
        t: i * 0.45 + IM.rand(0, 0.2),
        pos: new THREE.Vector3(
          center.x + IM.rand(-16, 16),
          center.y + IM.rand(10, 17),
          center.z + IM.rand(-16, 16)
        ),
        color: IM.pick(colors),
      });
    }
  };

  // ---------- 紙ふぶき ----------
  Effects.prototype._buildConfetti = function () {
    const N = 160;
    this.confettiN = N;
    const geo = new THREE.BoxGeometry(0.16, 0.02, 0.1);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: false });
    this.confetti = new THREE.InstancedMesh(geo, mat, N);
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const colors = [0xff6b8f, 0xffd166, 0x8fd8ff, 0xc3a8ff, 0x7ed07a, 0xfff4f6];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.confetti.setColorAt(i, c.setHex(IM.pick(colors)));
    }
    if (this.confetti.instanceColor) this.confetti.instanceColor.needsUpdate = true;
    this.confettiState = [];
    for (let i = 0; i < N; i++) this.confettiState.push({ live: false, x: 0, y: -99, z: 0 });
    this.confetti.visible = false;
    this.scene.add(this.confetti);
  };

  Effects.prototype.confettiRain = function (center) {
    this.confetti.visible = true;
    for (const s of this.confettiState) {
      s.live = true;
      s.x = center.x + IM.rand(-9, 9);
      s.y = center.y + IM.rand(6, 14);
      s.z = center.z + IM.rand(-9, 9);
      s.vy = IM.rand(-1.2, -0.6);
      s.vx = IM.rand(-0.5, 0.5);
      s.vz = IM.rand(-0.5, 0.5);
      s.rx = IM.rand(0, IM.TAU); s.ry = IM.rand(0, IM.TAU);
      s.rvx = IM.rand(2, 6); s.rvy = IM.rand(2, 6);
      s.phase = IM.rand(0, IM.TAU);
    }
  };

  // ---------- ホタル（夜） ----------
  Effects.prototype._buildFireflies = function () {
    const N = 70;
    this.fireflyN = N;
    const pos = new Float32Array(N * 3);
    this.fireflyState = [];
    for (let i = 0; i < N; i++) {
      const a = IM.rand(0, IM.TAU);
      const r = Math.sqrt(Math.random()) * 34 + 3;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      this.fireflyState.push({
        x, z,
        baseY: IM.groundHeight(x, z) + IM.rand(0.6, 2.6),
        p1: IM.rand(0, IM.TAU), p2: IM.rand(0, IM.TAU),
        f1: IM.rand(0.2, 0.6), f2: IM.rand(0.3, 0.8),
      });
      pos[i * 3] = x; pos[i * 3 + 1] = -99; pos[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.fireflyMat = new THREE.PointsMaterial({
      size: 0.5,
      map: IM.makeGlowTexture('rgba(220,255,150,1)', 'rgba(180,255,120,0)', 64),
      color: 0xdfffa0,
      transparent: true, opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  };

  // ---------- タップマーカー（いちごリング） ----------
  Effects.prototype._buildMarker = function () {
    this.marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.07, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xff6b8f, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    this.marker.add(ring);
    this.markerRing = ring;
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.05, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    ring2.rotation.x = -Math.PI / 2;
    this.marker.add(ring2);
    this.markerRing2 = ring2;
    this.marker.visible = false;
    this.markerT = 0;
    this.scene.add(this.marker);
  };

  Effects.prototype.showMarker = function (x, z) {
    this.marker.position.set(x, IM.groundHeight(x, z) + 0.12, z);
    this.marker.visible = true;
    this.markerT = 1.0;
  };

  // ---------- 毎フレーム ----------
  Effects.prototype.update = function (dt, time, night01, playerPos) {
    const dummy = this._dummy;

    // 花びら
    for (let i = 0; i < this.petalN; i++) {
      const s = this.petalState[i];
      s.y -= s.vy * dt;
      s.rx += s.rvx * dt; s.ry += s.rvy * dt;
      const gh = IM.groundHeight(s.x, s.z);
      if (s.y < gh + 0.05 || Math.abs(s.x - playerPos.x) > 34 || Math.abs(s.z - playerPos.z) > 34) {
        Object.assign(s, this._newPetal(playerPos, false));
      }
      dummy.position.set(
        s.x + Math.sin(time * s.swayF + s.phase) * s.swayA,
        s.y,
        s.z + Math.cos(time * s.swayF * 0.7 + s.phase) * s.swayA * 0.5
      );
      dummy.rotation.set(s.rx, s.ry, 0);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      this.petals.setMatrixAt(i, dummy.matrix);
    }
    this.petals.instanceMatrix.needsUpdate = true;

    // キラキラ
    const posAttr = this.sparkles.geometry.attributes.position;
    let anySpark = false;
    for (let i = 0; i < this.sparkN; i++) {
      const s = this.sparkState[i];
      if (s.life <= 0) continue;
      anySpark = true;
      s.life -= dt;
      if (s.life <= 0) {
        posAttr.setY(i, -999);
        continue;
      }
      s.vy -= s.grav * dt;
      posAttr.setXYZ(i,
        posAttr.getX(i) + s.vx * dt,
        posAttr.getY(i) + s.vy * dt,
        posAttr.getZ(i) + s.vz * dt);
    }
    if (anySpark) posAttr.needsUpdate = true;

    // 花火タイマー
    for (let i = this.fireworkTimers.length - 1; i >= 0; i--) {
      const f = this.fireworkTimers[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.burst(f.pos, f.color, 46, { speed: 7, grav: 2.2, life: 1.6, up: false });
        this.burst(f.pos, 0xffffff, 12, { speed: 3, grav: 1.5, life: 1.2, up: false });
        if (IM.Audio && IM.Audio.ctx) IM.Audio.pop();
        this.fireworkTimers.splice(i, 1);
      }
    }

    // 紙ふぶき
    if (this.confetti.visible) {
      let anyLive = false;
      for (let i = 0; i < this.confettiN; i++) {
        const s = this.confettiState[i];
        if (!s.live) continue;
        s.y += s.vy * dt;
        s.x += (s.vx + Math.sin(time * 2 + s.phase) * 0.6) * dt;
        s.z += s.vz * dt;
        s.rx += s.rvx * dt; s.ry += s.rvy * dt;
        if (s.y < IM.groundHeight(s.x, s.z) + 0.03) {
          s.live = false;
          s.y = -99;
        } else {
          anyLive = true;
        }
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(s.rx, s.ry, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        this.confetti.setMatrixAt(i, dummy.matrix);
      }
      this.confetti.instanceMatrix.needsUpdate = true;
      if (!anyLive) this.confetti.visible = false;
    }

    // ホタル
    const fireflyA = IM.smoothstep(0.4, 0.9, night01);
    this.fireflyMat.opacity = fireflyA;
    if (fireflyA > 0.01) {
      const fp = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < this.fireflyN; i++) {
        const s = this.fireflyState[i];
        fp.setXYZ(i,
          s.x + Math.sin(time * s.f1 + s.p1) * 1.6,
          s.baseY + Math.sin(time * s.f2 + s.p2) * 0.7,
          s.z + Math.cos(time * s.f1 * 0.8 + s.p2) * 1.6);
      }
      fp.needsUpdate = true;
    }

    // マーカー
    if (this.marker.visible) {
      this.markerT -= dt;
      const k = Math.max(this.markerT, 0);
      const pulse = 1 + Math.sin(time * 10) * 0.12;
      this.markerRing.scale.setScalar(pulse);
      this.markerRing2.scale.setScalar(2 - k);
      this.markerRing.material.opacity = k * 0.9;
      this.markerRing2.material.opacity = k * 0.7;
      if (this.markerT <= 0) this.marker.visible = false;
    }
  };

  IM.Effects = Effects;
})();
