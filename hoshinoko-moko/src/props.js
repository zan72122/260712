// ほしのこモコ — あそびの小道具
// りんご / ボール（物理あそび）/ しゃぼんだま / プレゼント / みずやり雲

import * as THREE from 'three';

function rand(a, b) { return a + Math.random() * (b - a); }

export class Props {
  constructor(scene, world, effects, audio) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.audio = audio;

    this.apples = [];
    this.bubbles = [];
    this.ball = null;
    this.gift = null;
    this.watering = null;

    this._ballGroup = this._buildBall();
    this._ballGroup.visible = false;
    scene.add(this._ballGroup);
  }

  /* ---------- りんご ---------- */

  spawnApple() {
    if (this.apples.length >= 3) return null;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0xff4d5e }));
    body.scale.y = 0.92;
    body.castShadow = true;
    g.add(body);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
    stem.position.y = 0.19;
    stem.rotation.z = 0.2;
    g.add(stem);
    const leaf = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 8),
      new THREE.MeshLambertMaterial({ color: 0x5daa4f, side: THREE.DoubleSide }));
    leaf.position.set(0.06, 0.21, 0);
    leaf.rotation.set(-0.6, 0, 0.5);
    g.add(leaf);

    const cc = this.world.canopyCenter;
    g.position.set(cc.x + rand(-1.0, 1.2), cc.y - 0.4, cc.z + rand(-0.9, 0.9));
    this.scene.add(g);

    const apple = { g, vy: 0, state: 'fall', eatT: 0 };
    this.apples.push(apple);
    return apple;
  }

  eatApple(apple) {
    apple.state = 'eaten';
  }

  _updateApples(dt) {
    for (const a of [...this.apples]) {
      if (a.state === 'fall') {
        a.vy -= 9.5 * dt;
        a.g.position.y += a.vy * dt;
        if (a.g.position.y <= 0.16) {
          a.g.position.y = 0.16;
          if (Math.abs(a.vy) > 1.4) {
            a.vy = -a.vy * 0.35;
            this.effects.sparkle(a.g.position, 0xffd0d8, 6);
          } else {
            a.vy = 0;
            a.state = 'rest';
          }
        }
      } else if (a.state === 'eaten') {
        a.eatT += dt;
        const s = Math.max(0.001, 1 - a.eatT * 1.4);
        a.g.scale.setScalar(s);
        a.g.rotation.y += dt * 6;
        if (s <= 0.01) {
          this.scene.remove(a.g);
          this.apples.splice(this.apples.indexOf(a), 1);
        }
      }
    }
  }

  /* ---------- ボール ---------- */

  _buildBall() {
    const g = new THREE.Group();
    const r = 0.3;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 16),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    core.castShadow = true;
    g.add(core);
    // カラフルなライン（ビーチボール風）
    const stripeCols = [0xff6b8a, 0xffd75e, 0x7fb8ff];
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.99, 0.035, 8, 28),
        new THREE.MeshLambertMaterial({ color: stripeCols[i] }));
      stripe.rotation.x = (i / 3) * Math.PI;
      stripe.rotation.y = (i / 3) * Math.PI * 0.7;
      g.add(stripe);
    }
    g.userData.isBall = true;
    return g;
  }

  spawnBall(nearPos) {
    this._ballGroup.visible = true;
    this._ballGroup.position.copy(nearPos).add(new THREE.Vector3(rand(-1, 1), 2.2, rand(-1, 1)));
    this.ball = {
      g: this._ballGroup, r: 0.3,
      vel: new THREE.Vector3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)),
      resting: false,
    };
  }

  hideBall() {
    this._ballGroup.visible = false;
    this.ball = null;
  }

  kickBall(dir, power = 5) {
    if (!this.ball) return;
    this.ball.vel.copy(dir).multiplyScalar(power);
    this.ball.vel.y = Math.max(this.ball.vel.y, power * 0.55);
    this.ball.resting = false;
    this.audio.boing();
    this.effects.sparkle(this.ball.g.position, 0xbfe0ff, 8);
  }

  _updateBall(dt) {
    const b = this.ball;
    if (!b) return;
    const p = b.g.position;
    b.vel.y -= 9.5 * dt;
    p.addScaledVector(b.vel, dt);

    const distC = Math.hypot(p.x, p.z);
    const onIsland = distC < this.world.islandRadius + 0.2;

    if (onIsland && p.y <= b.r) {
      p.y = b.r;
      if (Math.abs(b.vel.y) > 1.2) {
        b.vel.y = -b.vel.y * 0.58;
        this.audio.boing();
        this.effects.sparkle(p, 0xffffff, 5);
      } else {
        b.vel.y = 0;
      }
      // ころがり摩擦
      b.vel.x *= Math.pow(0.35, dt);
      b.vel.z *= Math.pow(0.35, dt);
      if (b.vel.lengthSq() < 0.01) b.resting = true;
    }

    // ころころ回転
    b.g.rotation.x += b.vel.z * dt / b.r;
    b.g.rotation.z -= b.vel.x * dt / b.r;

    // 島から落ちたら、キラッと戻ってくる
    if (p.y < -12) {
      this.effects.sparkle(new THREE.Vector3(0, 1.5, 0), 0xbfe0ff, 20);
      p.set(rand(-2, 2), 2.5, rand(-2, 2));
      b.vel.set(0, 0, 0);
      this.audio.pop();
    }
  }

  /* ---------- しゃぼんだま ---------- */

  spawnBubbles(pos, n = 10) {
    const mat0 = new THREE.MeshPhongMaterial({
      color: 0xbfe8ff, transparent: true, opacity: 0.3,
      shininess: 120, specular: 0xffffff,
      side: THREE.DoubleSide, depthWrite: false,
    });
    for (let i = 0; i < n; i++) {
      const r = rand(0.14, 0.3);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat0.clone());
      m.material.color.setHSL(rand(0.45, 0.85), 0.6, 0.8);
      m.position.copy(pos).add(new THREE.Vector3(rand(-0.6, 0.6), rand(0.6, 1.4), rand(-0.6, 0.6)));
      this.scene.add(m);
      this.bubbles.push({
        m, r, vy: rand(0.35, 0.7), ph: rand(0, 10),
        wob: rand(0.3, 0.8), life: rand(6, 10),
      });
    }
  }

  popBubble(bub, silent = false) {
    if (!silent) {
      this.audio.pop();
      this.effects.sparkle(bub.m.position, 0xbfe8ff, 12);
    }
    this.scene.remove(bub.m);
    bub.m.geometry.dispose();
    bub.m.material.dispose();
    const i = this.bubbles.indexOf(bub);
    if (i >= 0) this.bubbles.splice(i, 1);
  }

  _updateBubbles(dt, t) {
    for (const b of [...this.bubbles]) {
      b.life -= dt;
      b.m.position.y += b.vy * dt;
      b.m.position.x += Math.sin(t * 1.3 + b.ph) * b.wob * dt;
      b.m.position.z += Math.cos(t * 1.1 + b.ph) * b.wob * dt * 0.7;
      const sq = 1 + Math.sin(t * 4 + b.ph) * 0.06;
      b.m.scale.set(sq, 1 / sq, sq);
      if (b.life <= 0 || b.m.position.y > 7.5) {
        this.popBubble(b, b.m.position.y > 7.5);
      }
    }
  }

  /* ---------- プレゼント ---------- */

  spawnGift() {
    if (this.gift) return;
    const g = new THREE.Group();

    const boxCols = [0xffb7d5, 0x9fd8ff, 0xfff3a0, 0xd9a8ff];
    const col = boxCols[Math.floor(Math.random() * boxCols.length)];
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.42, 0.5),
      new THREE.MeshLambertMaterial({ color: col }));
    box.position.y = 0.21;
    box.castShadow = true;
    g.add(box);
    const ribMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.1), ribMat);
    rib1.position.y = 0.21;
    g.add(rib1);
    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.52), ribMat);
    rib2.position.y = 0.21;
    g.add(rib2);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), ribMat);
    knot.position.y = 0.46;
    g.add(knot);

    // パラシュート
    const chute = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({
        color: 0xfff3f8, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
      }));
    chute.position.y = 1.35;
    g.add(chute);

    const a = rand(0, Math.PI * 2);
    const r = rand(1.5, 4.5);
    g.position.set(Math.cos(a) * r, 8.5, Math.sin(a) * r);
    this.scene.add(g);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.3;
    g.add(hit);

    this.gift = { g, chute, hit, state: 'fall', t: 0 };
    hit.userData.gift = this.gift;
  }

  openGift() {
    if (!this.gift || this.gift.state === 'open') return false;
    this.gift.state = 'open';
    this.gift.t = 0;
    this.audio.tada();
    this.effects.confetti(this.gift.g.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    return true;
  }

  _updateGift(dt, t) {
    const gf = this.gift;
    if (!gf) return;
    gf.t += dt;
    if (gf.state === 'fall') {
      gf.g.position.y -= 2.1 * dt;
      gf.g.position.x += Math.sin(t * 1.2) * 0.25 * dt;
      gf.g.rotation.z = Math.sin(t * 1.5) * 0.12;
      if (gf.g.position.y <= 0) {
        gf.g.position.y = 0;
        gf.g.rotation.z = 0;
        gf.state = 'rest';
        this.effects.sparkle(gf.g.position, 0xfff3a0, 10);
      }
    } else if (gf.state === 'rest') {
      // ちょっとゆれて「あけて！」アピール
      gf.chute.material.opacity = Math.max(0, gf.chute.material.opacity - dt * 1.5);
      gf.chute.visible = gf.chute.material.opacity > 0.01;
      gf.g.rotation.z = Math.sin(gf.t * 6) * 0.05 * (Math.sin(gf.t * 0.7) > 0.4 ? 1 : 0);
    } else if (gf.state === 'open') {
      const s = 1 + gf.t * 2.5;
      gf.g.scale.setScalar(Math.max(0.001, 1.3 - gf.t * 1.6));
      gf.g.rotation.y += dt * 8;
      if (gf.t > 0.8) {
        this.scene.remove(gf.g);
        this.gift = null;
      }
    }
  }

  /* ---------- みずやり雲 ---------- */

  startWatering() {
    if (this.watering) return;
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color: 0xd6e6f5, transparent: true, opacity: 0.0, emissive: 0xd6e6f5, emissiveIntensity: 0.1,
    });
    for (let i = 0; i < 4; i++) {
      const s = rand(0.4, 0.7);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), mat);
      puff.position.set(i * 0.5 - 0.75, rand(-0.1, 0.1), rand(-0.2, 0.2));
      puff.scale.y = 0.7;
      g.add(puff);
    }
    g.position.set(0, 4.2, 0);
    this.scene.add(g);

    // 雨のしずく
    const N = 60;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) {
      seeds.push({ ox: rand(-1.3, 1.3), oz: rand(-0.6, 0.6), sp: rand(3.5, 5.5), off: rand(0, 4) });
      p[i * 3 + 1] = -100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const drops = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9fd0ff, size: 0.16, transparent: true, opacity: 0.85,
      map: this.effects.glowTex, depthWrite: false,
    }));
    this.scene.add(drops);

    this.watering = { g, mat, drops, seeds, t: 0, dur: 4.2 };
    this.audio.waterStart();
  }

  _updateWatering(dt, t) {
    const w = this.watering;
    if (!w) return;
    w.t += dt;

    // 雲がお庭をぐるっと回る
    const sweep = w.t * 0.9;
    w.g.position.x = Math.cos(sweep) * 3.4;
    w.g.position.z = Math.sin(sweep) * 3.4;

    const fade = Math.min(w.t * 2, 1, Math.max(0, (w.dur - w.t) * 2));
    w.mat.opacity = 0.85 * fade;
    w.drops.material.opacity = 0.85 * fade;

    const arr = w.drops.geometry.attributes.position;
    for (let i = 0; i < w.seeds.length; i++) {
      const s = w.seeds[i];
      const cyc = ((t * s.sp * 0.28 + s.off) % 1);
      const y = 3.9 - cyc * 3.9;
      arr.setXYZ(i, w.g.position.x + s.ox, y, w.g.position.z + s.oz);
      if (cyc > 0.96 && Math.random() < 0.1) {
        this.effects.waterSplash(new THREE.Vector3(w.g.position.x + s.ox, 0.1, w.g.position.z + s.oz));
      }
    }
    arr.needsUpdate = true;

    if (w.t >= w.dur) {
      this.scene.remove(w.g);
      this.scene.remove(w.drops);
      w.drops.geometry.dispose();
      this.watering = null;
      this.audio.waterStop();
    }
  }

  /* ---------- 更新 ---------- */

  update(dt, t) {
    this._updateApples(dt);
    this._updateBall(dt);
    this._updateBubbles(dt, t);
    this._updateGift(dt, t);
    this._updateWatering(dt, t);
  }
}
