/* =========================================================
 * いちごましゅまろのおか — critters.js
 * ましゅまろひつじ・ちょうちょ・ふうせん・ことり・いちご
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  // =========================================================
  // いちご（コレクティブル）
  // =========================================================
  let _berryTex = null;
  function berryTexture() {
    if (_berryTex) return _berryTex;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ff4d6a';
    g.fillRect(0, 0, 128, 128);
    // つぶつぶ
    g.fillStyle = '#ffe9a8';
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const ox = x * 16 + (y % 2 ? 8 : 0);
        const oy = y * 20 + 12;
        g.beginPath();
        g.ellipse(ox, oy, 2.6, 4, 0, 0, IM.TAU);
        g.fill();
      }
    }
    _berryTex = new THREE.CanvasTexture(c);
    _berryTex.wrapS = _berryTex.wrapT = THREE.RepeatWrapping;
    return _berryTex;
  }

  // ジオメトリ/マテリアルは全いちごで共有（生成・削除を繰り返してもリークしない）
  let _berryShared = null;
  function berryShared() {
    if (_berryShared) return _berryShared;
    _berryShared = {
      bodyGeo: new THREE.SphereGeometry(0.34, 14, 12),
      bodyMat: new THREE.MeshToonMaterial({ color: 0xffffff, map: berryTexture(), gradientMap: IM.getGradientMap() }),
      leafGeo: new THREE.SphereGeometry(0.11, 6, 5),
      leafMat: IM.toon(0x4fae5c),
      stemGeo: new THREE.CylinderGeometry(0.03, 0.045, 0.16, 6),
      glowMat: new THREE.SpriteMaterial({
        map: IM.makeGlowTexture('rgba(255,150,170,0.65)', 'rgba(255,150,170,0)', 64),
        transparent: true, depthWrite: false,
      }),
    };
    return _berryShared;
  }

  IM.makeStrawberry = function (scale) {
    scale = scale || 1;
    const S = berryShared();
    const g = new THREE.Group();
    const body = new THREE.Mesh(S.bodyGeo, S.bodyMat);
    body.scale.set(1, 1.25, 1);
    body.position.y = 0.42;
    body.castShadow = true;
    g.add(body);
    // へた
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * IM.TAU;
      const leaf = new THREE.Mesh(S.leafGeo, S.leafMat);
      leaf.position.set(Math.cos(a) * 0.16, 0.8, Math.sin(a) * 0.16);
      leaf.scale.set(1.6, 0.5, 0.8);
      leaf.rotation.y = -a;
      g.add(leaf);
    }
    const stem = new THREE.Mesh(S.stemGeo, S.leafMat);
    stem.position.y = 0.88;
    g.add(stem);
    // 足元のやわらかい光
    const glow = new THREE.Sprite(S.glowMat);
    glow.scale.setScalar(1.6);
    glow.position.y = 0.35;
    g.add(glow);
    g.scale.setScalar(scale);
    return g;
  };

  // =========================================================
  // ましゅまろひつじ
  // =========================================================
  function Sheep(scene, x, z) {
    this.group = new THREE.Group();
    const fluffMat = IM.toon(0xffffff);
    const faceMat = IM.toon(0xffe8d8);

    // ふわふわボディ（雲のようなかたまり）
    const body = new THREE.Group();
    const main = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), fluffMat);
    main.scale.set(1.15, 0.95, 1.25);
    body.add(main);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * IM.TAU;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(IM.rand(0.22, 0.34), 10, 8), fluffMat);
      puff.position.set(Math.cos(a) * 0.5, IM.rand(0.1, 0.4), Math.sin(a) * 0.55);
      body.add(puff);
    }
    body.position.y = 0.72;
    this.group.add(body);
    this.body = body;

    // あたま
    const head = new THREE.Group();
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), faceMat);
    face.scale.set(0.9, 1, 0.95);
    head.add(face);
    const wool = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), fluffMat);
    wool.position.set(0, 0.2, -0.08);
    head.add(wool);
    // 目
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40342e }));
      eye.position.set(side * 0.12, 0.04, 0.26);
      eye.scale.set(0.9, 1.3, 0.5);
      head.add(eye);
    }
    // ほっぺ
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffb3c0 }));
      blush.position.set(side * 0.18, -0.05, 0.24);
      blush.scale.set(1.2, 0.7, 0.4);
      head.add(blush);
    }
    // みみ
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), faceMat);
      ear.position.set(side * 0.3, 0.12, 0);
      ear.scale.set(1.5, 0.6, 0.6);
      ear.rotation.z = side * -0.4;
      head.add(ear);
    }
    head.position.set(0, 1.05, 0.62);
    this.group.add(head);
    this.head = head;

    // あし
    this.legs = [];
    for (const [lx, lz] of [[-0.3, 0.35], [0.3, 0.35], [-0.3, -0.35], [0.3, -0.35]]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 6), faceMat);
      leg.position.set(lx, 0.22, lz);
      this.group.add(leg);
      this.legs.push(leg);
    }
    // しっぽ
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), fluffMat);
    tail.position.set(0, 0.85, -0.75);
    this.group.add(tail);

    IM.placeOnGround(this.group, x, z, 0);
    IM.setShadow(this.group, true, false);
    scene.add(this.group);

    this.heading = IM.rand(0, IM.TAU);
    this.group.rotation.y = this.heading;
    this.state = 'idle';
    this.stateT = IM.rand(0, 2);
    this.hopPhase = 0;
    this.excited = 0; // タップされた喜び
    this.home = new THREE.Vector2(x, z);
  }

  Sheep.prototype.poke = function () {
    this.excited = 1.6;
    this.state = 'hop';
    this.stateT = 0;
  };

  Sheep.prototype.update = function (dt, time) {
    this.stateT -= dt;
    this.excited = Math.max(0, this.excited - dt);

    if (this.state === 'idle') {
      // もぐもぐ・きょろきょろ
      this.head.rotation.x = Math.sin(time * 2.2) * 0.12;
      this.head.rotation.y = Math.sin(time * 0.7) * 0.3;
      this.body.scale.setScalar(1 + Math.sin(time * 1.8) * 0.02);
      if (this.stateT <= 0) {
        this.state = 'hop';
        this.stateT = 0;
        // ホームのまわりをうろうろ
        const a = IM.rand(0, IM.TAU);
        const r = IM.rand(2, 6);
        this.dest = new THREE.Vector2(
          IM.clamp(this.home.x + Math.cos(a) * r, -40, 40),
          IM.clamp(this.home.y + Math.sin(a) * r, -40, 40)
        );
        // 池は避ける
        if (Math.hypot(this.dest.x - IM.POND.x, this.dest.y - IM.POND.z) < IM.POND.r + 2) {
          this.dest.set(this.home.x, this.home.y);
        }
      }
    } else if (this.state === 'hop') {
      const speedMul = this.excited > 0 ? 2.2 : 1;
      this.hopPhase += dt * 5.5 * speedMul;
      const hop = Math.abs(Math.sin(this.hopPhase));
      const p = this.group.position;

      if (this.dest) {
        const dx = this.dest.x - p.x, dz = this.dest.y - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.3) {
          this.state = 'idle';
          this.stateT = IM.rand(1.5, 4.5);
          this.dest = null;
        } else {
          const step = 1.6 * speedMul * dt * (0.35 + hop);
          p.x += (dx / dist) * Math.min(step, dist);
          p.z += (dz / dist) * Math.min(step, dist);
          this.heading = IM.lerpAngle(this.heading, Math.atan2(dx, dz), dt * 6);
        }
      } else if (this.excited <= 0) {
        this.state = 'idle';
        this.stateT = IM.rand(1.5, 4.5);
      }
      p.y = IM.groundHeight(p.x, p.z) + hop * (this.excited > 0 ? 0.9 : 0.45);
      this.group.rotation.y = this.heading;
      // ぷにぷにスクワッシュ
      const squash = 1 - hop * 0.12;
      this.body.scale.set(1 / squash, squash, 1 / squash);
      for (let i = 0; i < 4; i++) {
        this.legs[i].rotation.x = Math.sin(this.hopPhase + (i % 2) * Math.PI) * 0.5;
      }
    }
  };

  // =========================================================
  // ちょうちょ
  // =========================================================
  function Butterfly(scene, x, z) {
    this.group = new THREE.Group();
    const colors = [0xffd166, 0xff8fb3, 0xc3a8ff, 0x8fd8ff];
    const col = IM.pick(colors);
    const wingMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), wingMat);
      wing.scale.set(1.3, 0.8, 1);
      wing.position.x = side * 0.16;
      const pivot = new THREE.Group();
      pivot.add(wing);
      this.group.add(pivot);
      this.wings.push(pivot);
    }
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.18, 3, 6), new THREE.MeshBasicMaterial({ color: 0x5a4a3a }));
    body.rotation.x = Math.PI / 2;
    this.group.add(body);

    this.center = new THREE.Vector3(x, 0, z);
    this.angle = IM.rand(0, IM.TAU);
    this.radius = IM.rand(2, 5);
    this.speed = IM.rand(0.5, 1.1);
    this.phase = IM.rand(0, IM.TAU);
    this.excited = 0;
    scene.add(this.group);
  }

  Butterfly.prototype.poke = function () { this.excited = 2.5; };

  Butterfly.prototype.update = function (dt, time) {
    this.excited = Math.max(0, this.excited - dt);
    const spd = this.speed * (this.excited > 0 ? 3.5 : 1);
    this.angle += spd * dt;
    const r = this.radius * (this.excited > 0 ? 0.6 : 1);
    const x = this.center.x + Math.cos(this.angle) * r;
    const z = this.center.z + Math.sin(this.angle) * r * 0.8;
    const y = IM.groundHeight(x, z) + 1.1
      + Math.sin(time * 1.7 + this.phase) * 0.4
      + (this.excited > 0 ? Math.sin(time * 9) * 0.3 : 0);
    this.group.position.set(x, y, z);
    this.group.rotation.y = -this.angle;
    // はばたき
    const flap = Math.sin(time * (this.excited > 0 ? 34 : 18) + this.phase) * 0.9;
    this.wings[0].rotation.y = flap;
    this.wings[1].rotation.y = -flap;
  };

  // =========================================================
  // ふうせん（タップでぱちん！）
  // =========================================================
  function TapBalloon(scene) {
    this.group = new THREE.Group();
    const colors = [0xff6b8f, 0xffd166, 0x8fd8ff, 0xc3a8ff, 0x7ed07a];
    this.color = IM.pick(colors);
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), IM.toon(this.color));
    balloon.scale.set(1, 1.18, 1);
    this.group.add(balloon);
    this.balloonMesh = balloon;
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 8), IM.toon(this.color));
    knot.position.y = -0.68;
    knot.rotation.x = Math.PI;
    this.group.add(knot);
    const stringMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      pts.push(new THREE.Vector3(Math.sin(i * 1.2) * 0.06, -0.76 - i * 0.16, 0));
    }
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), stringMat));

    this.reset();
    scene.add(this.group);
  }

  TapBalloon.prototype.reset = function () {
    const a = IM.rand(0, IM.TAU);
    const r = IM.rand(10, 30);
    this.group.position.set(Math.cos(a) * r, IM.rand(-3, 0) + 2.2, Math.sin(a) * r);
    this.vel = new THREE.Vector3(IM.rand(-0.4, 0.4), IM.rand(0.35, 0.7), IM.rand(-0.4, 0.4));
    this.phase = IM.rand(0, IM.TAU);
    this.alive = true;
    this.group.visible = true;
    this.popT = 0;
    this.group.scale.setScalar(1);
  };

  TapBalloon.prototype.pop = function () {
    if (!this.alive) return false;
    this.alive = false;
    this.popT = 0.18;
    return true;
  };

  TapBalloon.prototype.update = function (dt, time) {
    if (!this.alive) {
      if (this.popT > 0) {
        this.popT -= dt;
        this.group.scale.setScalar(1 + (0.18 - this.popT) * 8); // ぱちんと膨らんで
        this.balloonMesh.material.opacity = this.popT / 0.18;
        this.balloonMesh.material.transparent = true;
        if (this.popT <= 0) {
          this.group.visible = false;
          this.respawnT = IM.rand(3, 7);
          this.balloonMesh.material.opacity = 1;
        }
      } else {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.reset();
      }
      return;
    }
    const p = this.group.position;
    p.addScaledVector(this.vel, dt);
    p.x += Math.sin(time * 0.8 + this.phase) * dt * 0.5;
    this.group.rotation.z = Math.sin(time * 1.3 + this.phase) * 0.12;
    // 高くなりすぎたらリスポーン
    const gh = IM.groundHeight(p.x, p.z);
    if (p.y > gh + 16) this.reset();
    if (p.y < gh + 1.6) this.vel.y = Math.abs(this.vel.y);
  };

  // =========================================================
  // ことり（遠くを編隊で飛ぶ）
  // =========================================================
  function BirdFlock(scene) {
    this.group = new THREE.Group();
    this.birds = [];
    const mat = IM.toon(0xffffff);
    for (let i = 0; i < 5; i++) {
      const bird = new THREE.Group();
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.3), mat);
        wing.position.x = side * 0.42;
        const pivot = new THREE.Group();
        pivot.add(wing);
        bird.add(pivot);
        bird.userData['w' + (side + 1)] = pivot;
      }
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat);
      body.scale.set(1, 0.8, 1.6);
      bird.add(body);
      bird.position.set(i * 1.6 - 3.2, Math.abs(i - 2) * -0.5, Math.abs(i - 2) * 1.4);
      this.group.add(bird);
      this.birds.push(bird);
    }
    this.angle = IM.rand(0, IM.TAU);
    scene.add(this.group);
  }

  BirdFlock.prototype.update = function (dt, time) {
    this.angle += dt * 0.09;
    const r = 65;
    this.group.position.set(
      Math.cos(this.angle) * r,
      22 + Math.sin(time * 0.5) * 3,
      Math.sin(this.angle) * r
    );
    this.group.rotation.y = -this.angle - Math.PI / 2;
    for (const b of this.birds) {
      const flap = Math.sin(time * 9 + b.position.x) * 0.7;
      b.userData.w0.rotation.z = flap;
      b.userData.w2.rotation.z = -flap;
    }
  };

  IM.Sheep = Sheep;
  IM.Butterfly = Butterfly;
  IM.TapBalloon = TapBalloon;
  IM.BirdFlock = BirdFlock;
})();
