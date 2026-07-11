// ほしのこモコ — パーティクル & エフェクト
// ハート、きらきら、紙ふぶき、桜ふぶき、ホタル、流れ星、花火、Zzz…
// テクスチャはすべて Canvas でその場で描く。

import * as THREE from 'three';

function rand(a, b) { return a + Math.random() * (b - a); }

/* ---------- Canvas テクスチャ ---------- */

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeHeartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(32, 34);
  ctx.scale(1.15, 1.15);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-22, -8, -10, -24, 0, -12);
  ctx.bezierCurveTo(10, -24, 22, -8, 0, 10);
  ctx.closePath();
  ctx.fillStyle = '#ff5e9c';
  ctx.shadowColor = 'rgba(255,120,170,0.9)';
  ctx.shadowBlur = 8;
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function makeZTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8fa6e8';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.strokeText('z', 32, 34);
  ctx.fillText('z', 32, 34);
  return new THREE.CanvasTexture(c);
}

/* ============================================================ */

export class Effects {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.glowTex = makeGlowTexture();
    this.heartTex = makeHeartTexture();
    this.zTex = makeZTexture();

    this.bursts = [];      // 一時パーティクル
    this.floaties = [];    // ハート/Zzz スプライト
    this.shootingStars = [];
    this.shootingHitboxes = [];
    this._starTimer = 3;

    this._buildPetals();
    this._buildFireflies();
  }

  /* ---------- 汎用バースト ---------- */

  burst({ pos, count = 20, colors = [0xffffff], speed = 2, up = 1.5, gravity = -3,
          life = 0.9, size = 0.16, additive = true, spread = 1 }) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      const a = rand(0, Math.PI * 2);
      const ele = rand(-0.4, 1);
      const sp = rand(0.3, 1) * speed;
      vel.push(new THREE.Vector3(
        Math.cos(a) * sp * spread,
        Math.abs(ele) * sp + up * rand(0.4, 1),
        Math.sin(a) * sp * spread));
      c.set(colors[i % colors.length]);
      c.offsetHSL(rand(-0.03, 0.03), 0, rand(-0.08, 0.12));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, map: this.glowTex, vertexColors: true, transparent: true,
      depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, vel, life, maxLife: life, gravity });
  }

  sparkle(pos, color = 0xfff3a0, count = 16) {
    this.burst({ pos, count, colors: [color, 0xffffff], speed: 1.8, life: 0.7, size: 0.14 });
  }

  confetti(pos) {
    this.burst({
      pos, count: 46, colors: [0xff6b8a, 0xffd75e, 0x7fdc86, 0x7fb8ff, 0xd9a8ff],
      speed: 3.2, up: 3.4, gravity: -5, life: 1.6, size: 0.17, additive: false, spread: 1.2,
    });
  }

  firework(pos, color) {
    this.burst({
      pos, count: 60, colors: [color, 0xffffff],
      speed: 4.2, up: 0.4, gravity: -1.6, life: 1.5, size: 0.2, spread: 1.4,
    });
  }

  waterSplash(pos) {
    this.burst({
      pos, count: 14, colors: [0xaee4ff, 0xffffff],
      speed: 1.2, up: 1.6, gravity: -6, life: 0.55, size: 0.12,
    });
  }

  /* ---------- ハート / Zzz ---------- */

  hearts(pos, n = 3) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.heartTex, transparent: true, depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      const size = rand(0.22, 0.4);
      s.scale.set(size, size, 1);
      s.position.copy(pos).add(new THREE.Vector3(rand(-0.4, 0.4), rand(0.1, 0.5), rand(-0.2, 0.2)));
      this.scene.add(s);
      this.floaties.push({
        sprite: s, life: rand(1.0, 1.5), maxLife: 1.4,
        vy: rand(0.9, 1.4), wob: rand(2, 4), wobA: rand(0.2, 0.5), t: rand(0, 3),
      });
    }
  }

  zzz(pos) {
    const mat = new THREE.SpriteMaterial({ map: this.zTex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(0.3, 0.3, 1);
    s.position.copy(pos).add(new THREE.Vector3(0.3, 1.4, 0));
    this.scene.add(s);
    this.floaties.push({ sprite: s, life: 1.8, maxLife: 1.8, vy: 0.55, wob: 2.5, wobA: 0.3, t: 0, grow: true });
  }

  /* ---------- 桜ふぶき ---------- */

  _buildPetals() {
    const COUNT = 110;
    const geo = new THREE.PlaneGeometry(0.09, 0.13);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffc4dd, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
    });
    this.petals = new THREE.InstancedMesh(geo, mat, COUNT);
    this.petalData = [];
    const cc = this.world.canopyCenter;
    for (let i = 0; i < COUNT; i++) {
      this.petalData.push({
        x: cc.x + rand(-1.8, 1.8), y: rand(0, cc.y + 1.2), z: cc.z + rand(-1.6, 1.6),
        vy: rand(0.25, 0.55), drift: rand(0.2, 0.7), ph: rand(0, 10),
        rx: rand(0, Math.PI), rz: rand(0, Math.PI), rs: rand(1, 3),
      });
    }
    this.scene.add(this.petals);
    this._petalM = new THREE.Matrix4();
    this._petalQ = new THREE.Quaternion();
    this._petalE = new THREE.Euler();
  }

  _updatePetals(dt, t) {
    const cc = this.world.canopyCenter;
    for (let i = 0; i < this.petalData.length; i++) {
      const p = this.petalData[i];
      p.y -= p.vy * dt;
      p.x += Math.sin(t * 0.9 + p.ph) * p.drift * dt;
      p.z += Math.cos(t * 0.7 + p.ph) * p.drift * dt * 0.7;
      p.rx += dt * p.rs;
      p.rz += dt * p.rs * 0.7;
      if (p.y < 0.02) {
        p.x = cc.x + rand(-1.8, 1.8);
        p.y = cc.y + rand(-0.5, 1.2);
        p.z = cc.z + rand(-1.6, 1.6);
      }
      this._petalE.set(p.rx, p.ph, p.rz);
      this._petalQ.setFromEuler(this._petalE);
      this._petalM.compose(
        new THREE.Vector3(p.x, p.y, p.z), this._petalQ, new THREE.Vector3(1, 1, 1));
      this.petals.setMatrixAt(i, this._petalM);
    }
    this.petals.instanceMatrix.needsUpdate = true;
  }

  /* ---------- ホタル ---------- */

  _buildFireflies() {
    this.fireflyGroups = [];
    for (let gI = 0; gI < 3; gI++) {
      const N = 12;
      const geo = new THREE.BufferGeometry();
      const p = new Float32Array(N * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xd0ffa8, size: 0.16, map: this.glowTex, transparent: true,
        opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geo, mat);
      const seeds = [];
      for (let i = 0; i < N; i++) {
        seeds.push({
          cx: rand(-5, 5), cz: rand(-5, 5), r: rand(0.5, 2),
          h: rand(0.4, 2.0), s1: rand(0.2, 0.7), s2: rand(0.3, 0.9), ph: rand(0, 10),
        });
      }
      pts.userData = { seeds, phase: gI * 2.1 };
      this.scene.add(pts);
      this.fireflyGroups.push(pts);
    }
  }

  _updateFireflies(dt, t, night) {
    for (const pts of this.fireflyGroups) {
      const { seeds, phase } = pts.userData;
      const arr = pts.geometry.attributes.position;
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        arr.setXYZ(i,
          s.cx + Math.cos(t * s.s1 + s.ph) * s.r,
          s.h + Math.sin(t * s.s2 + s.ph * 2) * 0.4,
          s.cz + Math.sin(t * s.s1 * 0.8 + s.ph) * s.r);
      }
      arr.needsUpdate = true;
      const blink = 0.45 + 0.55 * Math.max(0, Math.sin(t * 1.7 + phase));
      pts.material.opacity = night * blink * 0.95;
    }
  }

  /* ---------- 流れ星 ---------- */

  _spawnShootingStar(camera) {
    const g = new THREE.Group();

    const head = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xfff8d0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    head.scale.set(1.6, 1.6, 1);
    g.add(head);

    // カメラの向いている方角の空に出す（見えるところに！）
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const baseAz = Math.atan2(camDir.x, camDir.z) + rand(-0.5, 0.5);
    const ele = rand(0.1, 0.3);
    const R = 40;
    const start = new THREE.Vector3(
      Math.sin(baseAz) * Math.cos(ele) * R,
      Math.sin(ele) * R,
      Math.cos(baseAz) * Math.cos(ele) * R);
    g.position.copy(start);

    // 横ぎって下へ落ちる
    const side = new THREE.Vector3(-Math.cos(baseAz), 0, Math.sin(baseAz));
    const vel = side.multiplyScalar(rand(5, 8) * (Math.random() < 0.5 ? 1 : -1));
    vel.y = -rand(2.2, 3.6);

    // しっぽ（トレイル）
    const TRAIL = 22;
    const trailGeo = new THREE.BufferGeometry();
    const tp = new Float32Array(TRAIL * 3);
    for (let i = 0; i < TRAIL; i++) {
      tp[i * 3] = start.x; tp[i * 3 + 1] = start.y; tp[i * 3 + 2] = start.z;
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      color: 0xbfd8ff, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.scene.add(trail);

    // タッチ判定（おおきめの当たり判定で4歳でも取れる）
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    g.add(hit);

    this.scene.add(g);
    const star = { group: g, head, trail, hit, vel, life: 4.5, positions: [] };
    hit.userData.star = star;
    this.shootingStars.push(star);
    this.shootingHitboxes.push(hit);
  }

  catchStar(star, pos) {
    this.sparkle(pos, 0xffe38a, 26);
    this._removeStar(star);
  }

  _removeStar(star) {
    this.scene.remove(star.group);
    this.scene.remove(star.trail);
    star.trail.geometry.dispose();
    const i = this.shootingStars.indexOf(star);
    if (i >= 0) this.shootingStars.splice(i, 1);
    const j = this.shootingHitboxes.indexOf(star.hit);
    if (j >= 0) this.shootingHitboxes.splice(j, 1);
  }

  _updateShootingStars(dt, t, night, camera) {
    // 夜だけ、ときどき流れる
    if (night > 0.6) {
      this._starTimer -= dt;
      if (this._starTimer <= 0 && this.shootingStars.length < 3) {
        this._spawnShootingStar(camera);
        this._starTimer = rand(2.2, 5.0);
      }
    }
    for (const s of [...this.shootingStars]) {
      s.life -= dt;
      s.group.position.addScaledVector(s.vel, dt);
      s.positions.unshift(s.group.position.clone());
      if (s.positions.length > 22) s.positions.pop();
      const arr = s.trail.geometry.attributes.position;
      for (let i = 0; i < 22; i++) {
        const p = s.positions[Math.min(i, s.positions.length - 1)];
        arr.setXYZ(i, p.x, p.y, p.z);
      }
      arr.needsUpdate = true;
      s.head.material.opacity = Math.min(1, s.life);
      s.trail.material.opacity = Math.min(0.75, s.life * 0.5) * night;
      if (s.life <= 0 || s.group.position.y < 2) this._removeStar(s);
    }
    // 昼になったら全部消す
    if (night < 0.3 && this.shootingStars.length) {
      for (const s of [...this.shootingStars]) this._removeStar(s);
    }
  }

  /* ---------- 更新 ---------- */

  update(dt, t, night, camera) {
    // バースト
    for (const b of [...this.bursts]) {
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.bursts.splice(this.bursts.indexOf(b), 1);
        continue;
      }
      const arr = b.points.geometry.attributes.position;
      for (let i = 0; i < b.vel.length; i++) {
        b.vel[i].y += b.gravity * dt;
        arr.setXYZ(i,
          arr.getX(i) + b.vel[i].x * dt,
          Math.max(0.03, arr.getY(i) + b.vel[i].y * dt),
          arr.getZ(i) + b.vel[i].z * dt);
      }
      arr.needsUpdate = true;
      b.points.material.opacity = Math.min(1, (b.life / b.maxLife) * 2);
    }

    // ハート/Zzz
    for (const f of [...this.floaties]) {
      f.life -= dt;
      f.t += dt;
      if (f.life <= 0) {
        this.scene.remove(f.sprite);
        f.sprite.material.dispose();
        this.floaties.splice(this.floaties.indexOf(f), 1);
        continue;
      }
      f.sprite.position.y += f.vy * dt;
      f.sprite.position.x += Math.sin(f.t * f.wob) * f.wobA * dt;
      f.sprite.material.opacity = Math.min(1, f.life / (f.maxLife * 0.4));
      if (f.grow) {
        const s = 0.3 + f.t * 0.12;
        f.sprite.scale.set(s, s, 1);
      }
    }

    this._updatePetals(dt, t);
    this._updateFireflies(dt, t, night);
    this._updateShootingStars(dt, t, night, camera);
  }
}
