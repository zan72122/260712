// ============================================================
// なかまたち — ユニコーン・うさぎ・ことり・ちょうちょ・あひる
// タップすると鳴いたり はねたり ハートが出たり
// ============================================================
import * as THREE from 'three';
import { rand, pick, distXZ } from './utils.js';

const PASTELS = [0xffa8d9, 0xc79bff, 0x8fd7ff, 0xa8ffd9, 0xfff3ae, 0xffc9a8];

// ---------------- ユニコーン（プリンセスについてくる） ----------------
class Unicorn {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.jumpT = -1;
    this.time = rand(10);
    this._build();
    this.group.position.set(1.6, 0, 8);
    ctx.scene.add(this.group);
  }

  _build() {
    const cast = (m) => { m.castShadow = true; return m; };
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfff6fa, roughness: 0.8 });
    const g = this.group;

    // 胴体と首と頭
    const body = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), bodyMat));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.62;
    g.add(body);
    const neck = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10), bodyMat));
    neck.position.set(0.32, 0.92, 0);
    neck.rotation.z = -0.5;
    g.add(neck);
    this.headGroup = new THREE.Group();
    const head = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.2, 4, 10), bodyMat));
    head.rotation.z = Math.PI / 2 - 0.35;
    this.headGroup.add(head);
    // 鼻先
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd9e8, roughness: 0.8 }));
    muzzle.position.set(0.18, -0.05, 0);
    this.headGroup.add(muzzle);
    // 目
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x3a2a2a }));
      eye.position.set(0.06, 0.05, side * 0.105);
      this.headGroup.add(eye);
    }
    // 耳
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 6), bodyMat);
      ear.position.set(-0.05, 0.14, side * 0.07);
      this.headGroup.add(ear);
    }
    // 角（きらきら光る）
    this.hornMat = new THREE.MeshStandardMaterial({
      color: 0xffd166, roughness: 0.3, metalness: 0.4,
      emissive: 0xffc95e, emissiveIntensity: 1.2,
    });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.24, 8), this.hornMat);
    horn.position.set(0.03, 0.2, 0);
    horn.rotation.z = -0.3;
    this.headGroup.add(horn);
    this.headGroup.position.set(0.52, 1.18, 0);
    g.add(this.headGroup);

    // 虹色のたてがみ
    for (let i = 0; i < 6; i++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6),
        new THREE.MeshStandardMaterial({ color: PASTELS[i % PASTELS.length], roughness: 0.8 }));
      tuft.position.set(0.42 - i * 0.1, 1.2 - i * 0.085, 0);
      g.add(tuft);
    }
    // しっぽ
    this.tail = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.08 - i * 0.012, 8, 6),
        new THREE.MeshStandardMaterial({ color: PASTELS[(i + 2) % PASTELS.length], roughness: 0.8 }));
      tuft.position.set(-i * 0.09, -i * 0.1, 0);
      this.tail.add(tuft);
    }
    this.tail.position.set(-0.52, 0.72, 0);
    g.add(this.tail);

    // 脚
    this.legs = [];
    for (const [lx, lz] of [[0.28, 0.14], [0.28, -0.14], [-0.28, 0.14], [-0.28, -0.14]]) {
      const leg = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), bodyMat));
      leg.position.set(lx, 0.28, lz);
      g.add(leg);
      this.legs.push(leg);
    }
  }

  get pos() { return this.group.position; }

  tap() {
    if (this.jumpT < 0) this.jumpT = 0;
    this.ctx.audio.playGliss(72, 7, 0.05);
    this.ctx.particles.heartsBurst(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 5);
  }

  update(dt, princess) {
    this.time += dt;
    const t = this.time;
    const p = this.group.position;

    // プリンセスの少しうしろをついていく
    const behind = new THREE.Vector3(
      princess.pos.x - Math.sin(princess.heading) * 1.9 + Math.cos(princess.heading) * 0.9,
      0,
      princess.pos.z - Math.cos(princess.heading) * 1.9 - Math.sin(princess.heading) * 0.9
    );
    const dist = distXZ(p, behind);
    let moving = false;
    if (dist > 0.3) {
      const speed = Math.min(3.4, dist * 1.8);
      const dx = behind.x - p.x, dz = behind.z - p.z;
      p.x += (dx / dist) * speed * dt;
      p.z += (dz / dist) * speed * dt;
      const targetHeading = Math.atan2(dx, dz) - Math.PI / 2;
      let diff = targetHeading - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * 6);
      moving = dist > 0.6;
    }

    // ジャンプ（タップされたとき）: 虹色の弧をえがく
    let jumpY = 0;
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const T = 0.9;
      if (this.jumpT >= T) {
        this.jumpT = -1;
      } else {
        const prog = this.jumpT / T;
        jumpY = Math.sin(prog * Math.PI) * 1.3;
        if (Math.random() < 0.8) {
          const c = new THREE.Color(pick(PASTELS));
          this.ctx.particles.sparkles.spawn(
            p.x + rand(-0.3, 0.3), p.y + jumpY + rand(0.2, 0.9), p.z + rand(-0.3, 0.3),
            rand(-0.3, 0.3), rand(-0.2, 0.4), rand(-0.3, 0.3),
            rand(0.7, 1.2), rand(0.14, 0.26), c, 1
          );
        }
      }
    }

    const trot = moving ? Math.sin(t * 12) : 0;
    this.group.position.y = jumpY + Math.abs(trot) * 0.06;
    this.legs[0].rotation.x = trot * 0.55;
    this.legs[1].rotation.x = -trot * 0.55;
    this.legs[2].rotation.x = -trot * 0.55;
    this.legs[3].rotation.x = trot * 0.55;
    this.tail.rotation.x = Math.sin(t * 3.1) * 0.3;
    this.headGroup.rotation.z = Math.sin(t * 1.7) * 0.07;
    this.hornMat.emissiveIntensity = 1.0 + Math.sin(t * 4.2) * 0.5;
  }
}

// ---------------- うさぎ ----------------
class Bunny {
  constructor(ctx, x, z, color) {
    this.ctx = ctx;
    this.home = new THREE.Vector2(x, z);
    this.group = new THREE.Group();
    this.time = rand(10);
    this.hopT = -1;
    this.bigHops = 0;
    this._nextIdleHop = rand(2, 5);
    this._build(color);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rand(Math.PI * 2);
    ctx.scene.add(this.group);
  }

  _build(color) {
    const g = this.group;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mat);
    body.position.y = 0.19;
    body.scale.set(1, 0.95, 1.25);
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat);
    head.position.set(0, 0.38, 0.14);
    head.castShadow = true;
    g.add(head);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.17, 4, 8), mat);
      ear.position.set(side * 0.06, 0.58, 0.1);
      ear.rotation.x = -0.15;
      ear.rotation.z = side * 0.15;
      g.add(ear);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.1, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0xffb3cc, roughness: 0.9 }));
      inner.position.set(side * 0.06, 0.58, 0.125);
      inner.rotation.copy(ear.rotation);
      g.add(inner);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x3a2a2a }));
      eye.position.set(side * 0.06, 0.42, 0.26);
      g.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xff8fa8 }));
    nose.position.set(0, 0.37, 0.28);
    g.add(nose);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
    tail.position.set(0, 0.2, -0.22);
    g.add(tail);
  }

  get pos() { return this.group.position; }

  tap() {
    this.bigHops = 3;
    this.ctx.audio.playChirp();
    this.ctx.particles.heartsBurst(this.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 4);
  }

  update(dt) {
    this.time += dt;
    const p = this.group.position;

    if (this.hopT < 0) {
      this._nextIdleHop -= dt;
      if (this.bigHops > 0 || this._nextIdleHop <= 0) {
        this.hopT = 0;
        // 巣のまわりのランダムな場所へぴょん
        const a = rand(Math.PI * 2);
        const r = this.bigHops > 0 ? rand(0.9, 1.5) : rand(0.4, 1.0);
        this.hopFrom = new THREE.Vector2(p.x, p.z);
        this.hopTo = new THREE.Vector2(
          this.home.x + Math.cos(a) * Math.min(3, r + rand(1.2)),
          this.home.y + Math.sin(a) * Math.min(3, r + rand(1.2))
        );
        this.hopHigh = this.bigHops > 0 ? 0.85 : 0.32;
        if (this.bigHops > 0) this.bigHops--;
        this._nextIdleHop = rand(2, 6);
        const dx = this.hopTo.x - p.x, dz = this.hopTo.y - p.z;
        this.group.rotation.y = Math.atan2(dx, dz);
      }
    } else {
      this.hopT += dt;
      const T = this.hopHigh > 0.5 ? 0.55 : 0.4;
      const prog = Math.min(1, this.hopT / T);
      p.x = this.hopFrom.x + (this.hopTo.x - this.hopFrom.x) * prog;
      p.z = this.hopFrom.y + (this.hopTo.y - this.hopFrom.y) * prog;
      p.y = Math.sin(prog * Math.PI) * this.hopHigh;
      if (prog >= 1) { this.hopT = -1; p.y = 0; }
    }
    // 耳とからだのぷるぷる
    this.group.scale.y = 1 + Math.sin(this.time * 7) * 0.02;
  }
}

// ---------------- ことり（お城のまわりを飛ぶ） ----------------
class Bird {
  constructor(ctx, center, radius, height, speed, color) {
    this.ctx = ctx;
    this.center = center;
    this.radius = radius;
    this.height = height;
    this.speed = speed;
    this.angle = rand(Math.PI * 2);
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat);
    body.scale.set(1, 0.9, 1.3);
    this.group.add(body);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat);
    headM.position.set(0, 0.09, 0.14);
    this.group.add(headM);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6),
      new THREE.MeshStandardMaterial({ color: 0xffae4a, roughness: 0.8 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.09, 0.25);
    this.group.add(beak);
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
      wing.geometry.translate(side * 0.16, 0, 0);
      wing.position.set(side * 0.08, 0.04, 0);
      this.wings.push(wing);
      this.group.add(wing);
    }
    ctx.scene.add(this.group);
    this.time = rand(10);
  }

  update(dt) {
    this.time += dt;
    this.angle += dt * this.speed;
    const x = this.center.x + Math.cos(this.angle) * this.radius;
    const z = this.center.z + Math.sin(this.angle) * this.radius;
    const y = this.height + Math.sin(this.time * 1.3) * 0.6;
    this.group.position.set(x, y, z);
    this.group.rotation.y = -this.angle - Math.PI / 2 + Math.PI;
    const flap = Math.sin(this.time * 14) * 0.75;
    this.wings[0].rotation.z = flap;
    this.wings[1].rotation.z = -flap;
  }
}

// ---------------- ちょうちょ ----------------
class Butterfly {
  constructor(ctx, glow) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.time = rand(20);
    const color = pick(PASTELS);
    this.mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.7, side: THREE.DoubleSide,
      emissive: color, emissiveIntensity: glow ? 0.5 : 0.12,
    });
    this.glow = glow;
    this.wings = [];
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(side * 0.16, 0.12, side * 0.2, 0.05, side * 0.17, -0.03);
      shape.bezierCurveTo(side * 0.14, -0.1, side * 0.05, -0.06, 0, 0);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), this.mat);
      wing.rotation.x = -Math.PI / 2;
      this.wings.push(wing);
      this.group.add(wing);
    }
    const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.07, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a4a5e, roughness: 0.9 }));
    bodyM.rotation.x = Math.PI / 2;
    this.group.add(bodyM);
    this.pos3 = new THREE.Vector3(rand(-18, 18), rand(0.8, 2.4), rand(-12, 18));
    this.target = this.pos3.clone();
    this._retarget();
    ctx.scene.add(this.group);
  }

  _retarget(center) {
    const cx = center ? center.x : rand(-18, 18);
    const cz = center ? center.z : rand(-12, 18);
    this.target.set(
      cx + rand(-2.5, 2.5),
      rand(0.7, 2.6),
      cz + rand(-2.5, 2.5)
    );
  }

  update(dt, magnetPos) {
    this.time += dt;
    // 魔法中はプリンセスのまわりに集まる
    if (magnetPos && Math.random() < dt * 2.5) this._retarget(magnetPos);
    else if (Math.random() < dt * 0.25) this._retarget();

    const d = this.target.clone().sub(this.pos3);
    const dist = d.length();
    if (dist > 0.05) {
      d.normalize().multiplyScalar(Math.min(dist, dt * (magnetPos ? 3.4 : 1.4)));
      this.pos3.add(d);
    }
    const flutter = Math.sin(this.time * 3.3) * 0.14;
    this.group.position.set(this.pos3.x, this.pos3.y + flutter, this.pos3.z);
    this.group.rotation.y = Math.atan2(d.x, d.z);
    const flap = Math.sin(this.time * 16) * 1.0;
    this.wings[0].rotation.y = flap;
    this.wings[1].rotation.y = -flap;
  }

  setNight(night) {
    this.mat.emissiveIntensity = this.glow ? 0.4 + night * 1.6 : 0.12;
  }
}

// ---------------- あひる（池にぷかぷか） ----------------
class Duck {
  constructor(ctx, pond, waterY) {
    this.ctx = ctx;
    this.pond = pond;
    this.waterY = waterY;
    this.group = new THREE.Group();
    this.time = rand(10);
    this.angle = rand(Math.PI * 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
    body.scale.set(1, 0.85, 1.3);
    body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bodyMat);
    head.position.set(0, 0.26, 0.18);
    this.group.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xff9d3b, roughness: 0.7 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.24, 0.34);
    this.group.add(beak);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x3a2a2a }));
      eye.position.set(side * 0.07, 0.3, 0.28);
      this.group.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 6), bodyMat);
    tail.rotation.x = -Math.PI / 2 - 0.5;
    tail.position.set(0, 0.08, -0.28);
    this.group.add(tail);
    ctx.scene.add(this.group);
  }

  get pos() { return this.group.position; }

  tap() {
    this.ctx.audio.playQuack();
    this.ctx.particles.splash(this.pos);
    this.ctx.particles.tapRing(new THREE.Vector3(this.pos.x, this.waterY, this.pos.z), 0xbfe8ff);
    this.ctx.particles.heartsBurst(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 3);
    this._dashT = 0.8;
  }

  update(dt) {
    this.time += dt;
    const speed = this._dashT > 0 ? 1.6 : 0.35;
    if (this._dashT > 0) this._dashT -= dt;
    this.angle += dt * speed * 0.5;
    const r = this.pond.r * 0.42 + Math.sin(this.time * 0.23) * 1.2;
    const x = this.pond.x + Math.cos(this.angle) * r;
    const z = this.pond.z + Math.sin(this.angle) * r;
    const y = this.waterY + 0.06 + Math.sin(this.time * 2.1) * 0.05;
    this.group.position.set(x, y, z);
    this.group.rotation.y = -this.angle;
    this.group.rotation.z = Math.sin(this.time * 2.7) * 0.06;
  }
}

// ---------------- まとめ役 ----------------
export class Creatures {
  constructor(ctx, world) {
    this.ctx = ctx;
    this.unicorn = new Unicorn(ctx);
    this.bunnies = [
      new Bunny(ctx, -5, 3, 0xfff6ec),
      new Bunny(ctx, 6, -4, 0xd9c1a8),
      new Bunny(ctx, -8, -8, 0xf2e0d0),
    ];
    this.birds = [
      new Bird(ctx, new THREE.Vector3(world.castlePos.x, 0, world.castlePos.z), 9, 11, 0.45, 0x8fd7ff),
      new Bird(ctx, new THREE.Vector3(world.castlePos.x, 0, world.castlePos.z), 12, 9, -0.35, 0xffa8d9),
      new Bird(ctx, new THREE.Vector3(0, 0, 0), 17, 7.5, 0.28, 0xfff3ae),
    ];
    this.butterflies = [];
    for (let i = 0; i < 9; i++) this.butterflies.push(new Butterfly(ctx, i < 4));
    this.duck = new Duck(ctx, world.pond, world.waterY);

    // タップできるなかまを登録
    ctx.interactables.push(
      { getPos: () => this.unicorn.pos, r: 1.5, y: 0.8, onTap: () => this.unicorn.tap() },
      { getPos: () => this.duck.pos, r: 1.2, y: 0.2, onTap: () => this.duck.tap() },
      ...this.bunnies.map((b) => ({ getPos: () => b.pos, r: 1.1, y: 0.35, onTap: () => b.tap() })),
    );
  }

  update(dt, princess, night, magicActive) {
    this.unicorn.update(dt, princess);
    for (const b of this.bunnies) b.update(dt);
    for (const b of this.birds) b.update(dt);
    const magnet = magicActive ? princess.pos : null;
    for (const b of this.butterflies) {
      b.update(dt, magnet);
      b.setNight(night);
    }
    this.duck.update(dt);
  }
}
