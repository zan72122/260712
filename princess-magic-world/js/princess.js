// ============================================================
// プリンセス — きらめくドレスのヒロイン
// プリミティブだけで組み立てたかわいい3Dキャラクター
// ============================================================
import * as THREE from 'three';
import { rand, damp, resolveColliders } from './utils.js';

// ドレスのカラーパレット（👗ボタンで切り替え）
export const DRESS_PALETTES = [
  { name: 'ローズ', main: 0xff6fa5, trim: 0xffd1e6, sparkle: 0xffd7ef },
  { name: 'そら',   main: 0x5fb3f2, trim: 0xcfe9ff, sparkle: 0xbfe6ff },
  { name: 'すみれ', main: 0xa87de8, trim: 0xe2d1ff, sparkle: 0xe0ccff },
  { name: 'きんいろ', main: 0xffc94d, trim: 0xfff0c0, sparkle: 0xffeab0 },
  { name: 'ミント', main: 0x5fd8b0, trim: 0xd0f7e8, sparkle: 0xc0f5e0 },
];

export class Princess {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.walkTarget = new THREE.Vector3(0, 0, 6);
    this.heading = Math.PI; // お城のほうを向いてスタート
    this.walking = false;
    this.speed = 3.1;
    this.twirlT = -1;
    this.dressIndex = 0;
    this.time = 0;
    this._trailAccum = 0;
    this._tmpColor = new THREE.Color();

    this._build();
    this.group.position.set(0, 0, 6);
    this.group.rotation.y = this.heading;
    ctx.scene.add(this.group);
    this.setDress(0, false);
  }

  _build() {
    const g = this.group;
    const cast = (m) => { m.castShadow = true; return m; };

    // ---- マテリアル ----
    this.skirtMat = new THREE.MeshStandardMaterial({ color: 0xff6fa5, roughness: 0.55 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: 0xffd1e6, roughness: 0.6 });
    this.bodiceMat = new THREE.MeshStandardMaterial({ color: 0xff6fa5, roughness: 0.55 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfc9, roughness: 0.75 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xf0b95a, roughness: 0.65 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd166, roughness: 0.3, metalness: 0.7,
      emissive: 0xffb020, emissiveIntensity: 0.35,
    });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

    // ---- スカート（ベル型のドレス） ----
    this.skirtGroup = new THREE.Group();
    const profile = [];
    const hem = 0.55;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = t * 0.95;
      const r = hem * Math.pow(1 - t, 1.35) + 0.16 * t;
      profile.push(new THREE.Vector2(Math.max(0.02, r), y));
    }
    const skirt = cast(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), this.skirtMat));
    this.skirtGroup.add(skirt);

    // すその飾りリング
    const hemRing = new THREE.Mesh(new THREE.TorusGeometry(hem - 0.015, 0.035, 8, 28), this.trimMat);
    hemRing.rotation.x = Math.PI / 2;
    hemRing.position.y = 0.035;
    this.skirtGroup.add(hemRing);

    // ドレスのキラキラ（スカート表面の光る点）
    const sparkleCount = 42;
    const sPos = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      const t = rand(0.08, 0.85);
      const a = rand(Math.PI * 2);
      const r = (hem * Math.pow(1 - t, 1.35) + 0.16 * t) + 0.015;
      sPos[i * 3] = Math.cos(a) * r;
      sPos[i * 3 + 1] = t * 0.95;
      sPos[i * 3 + 2] = Math.sin(a) * r;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    this.sparkleMat = new THREE.PointsMaterial({
      color: 0xffd7ef, size: 0.045, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.dressSparkles = new THREE.Points(sparkGeo, this.sparkleMat);
    this.skirtGroup.add(this.dressSparkles);
    g.add(this.skirtGroup);

    // ---- 上半身 ----
    this.torso = new THREE.Group();
    const bodice = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.175, 0.26, 12), this.bodiceMat));
    bodice.position.y = 1.06;
    this.torso.add(bodice);

    // 首もと
    const collar = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skinMat);
    collar.position.y = 1.2;
    this.torso.add(collar);

    // パフスリーブと腕
    this.arms = [];
    for (const side of [-1, 1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 0.15, 1.16, 0);
      const puff = cast(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), this.bodiceMat));
      armGroup.add(puff);
      const arm = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.2, 4, 8), skinMat));
      arm.position.set(side * 0.075, -0.16, 0);
      arm.rotation.z = side * 0.5;
      armGroup.add(arm);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gloveMat);
      glove.position.set(side * 0.14, -0.3, 0);
      armGroup.add(glove);
      this.arms.push(armGroup);
      this.torso.add(armGroup);
    }

    // ---- 顔 ----
    const head = new THREE.Group();
    const face = cast(new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), skinMat));
    head.add(face);
    // 目（くりくりの黒目 + ハイライト）
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x3a2a2a }));
      eye.position.set(side * 0.078, 0.02, 0.183);
      eye.scale.y = 1.35;
      head.add(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(side * 0.068, 0.045, 0.208);
      head.add(glint);
      // ほっぺ
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.032, 10),
        new THREE.MeshBasicMaterial({ color: 0xff9db0, transparent: true, opacity: 0.55 }));
      blush.position.set(side * 0.125, -0.055, 0.172);
      blush.lookAt(side * 0.5, -0.2, 1);
      head.add(blush);
    }
    // にっこりの口
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 12, Math.PI * 0.85),
      new THREE.MeshBasicMaterial({ color: 0xd96a6a }));
    smile.position.set(0, -0.06, 0.192);
    smile.rotation.z = Math.PI + Math.PI * 0.075;
    head.add(smile);

    // ---- 髪 ----
    const hairTop = cast(new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 12), hairMat));
    hairTop.position.set(0, 0.045, -0.03);
    head.add(hairTop);
    const bangL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), hairMat);
    bangL.position.set(-0.13, 0.1, 0.14);
    head.add(bangL);
    const bangR = bangL.clone();
    bangR.position.x = 0.13;
    head.add(bangR);
    // うしろのまとめ髪（シニヨン）
    const bun = cast(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), hairMat));
    bun.position.set(0, 0.16, -0.16);
    head.add(bun);
    // たれ髪
    const lock = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.3, 4, 8), hairMat));
    lock.position.set(0, -0.13, -0.19);
    lock.rotation.x = 0.25;
    head.add(lock);

    // ---- ティアラ ----
    const tiara = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 6, 20), goldMat);
    band.rotation.x = Math.PI / 2 - 0.25;
    tiara.add(band);
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07 + (2 - Math.abs(i)) * 0.025, 6), goldMat);
      const a = i * 0.32;
      spike.position.set(Math.sin(a) * 0.115, 0.045 + (2 - Math.abs(i)) * 0.012, Math.cos(a) * 0.1);
      tiara.add(spike);
    }
    this.tiaraGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0),
      new THREE.MeshStandardMaterial({ color: 0xff8fbf, emissive: 0xff5f9e, emissiveIntensity: 1.2, roughness: 0.3 }));
    this.tiaraGem.position.set(0, 0.075, 0.105);
    tiara.add(this.tiaraGem);
    tiara.position.set(0, 0.17, 0.02);
    head.add(tiara);

    head.position.y = 1.44;
    this.head = head;
    this.torso.add(head);
    g.add(this.torso);
  }

  setDress(index, poof = true) {
    this.dressIndex = index % DRESS_PALETTES.length;
    const pal = DRESS_PALETTES[this.dressIndex];
    this.skirtMat.color.set(pal.main);
    this.bodiceMat.color.set(pal.main);
    this.trimMat.color.set(pal.trim);
    this.sparkleMat.color.set(pal.sparkle);
    if (poof) {
      const p = this.group.position;
      this.ctx.particles.burst(new THREE.Vector3(p.x, p.y + 0.8, p.z), pal.sparkle, 40, 2.2);
      this.ctx.audio.playMagic();
      this.twirl();
    }
    return pal;
  }

  get sparkleColor() {
    return this._tmpColor.set(DRESS_PALETTES[this.dressIndex].sparkle);
  }

  walkTo(x, z) {
    this.walkTarget.set(x, 0, z);
    this.walking = true;
  }

  twirl() {
    if (this.twirlT < 0) this.twirlT = 0;
  }

  get pos() { return this.group.position; }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const p = this.group.position;
    const prevX = p.x, prevZ = p.z;

    // ---- 移動 ----
    if (this.walking) {
      const dx = this.walkTarget.x - p.x;
      const dz = this.walkTarget.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.12) {
        this.walking = false;
      } else {
        const step = Math.min(dist, this.speed * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        const targetHeading = Math.atan2(dx, dz);
        let diff = targetHeading - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += diff * Math.min(1, dt * 9);
        // キラキラの足あと
        this._trailAccum += dt;
        if (this._trailAccum > 0.03) {
          this._trailAccum = 0;
          this.ctx.particles.trail(p, this.sparkleColor);
        }
      }
    }

    // 世界の外やしょうがい物に入らないように
    const r = Math.hypot(p.x, p.z);
    if (r > 26) { p.x *= 26 / r; p.z *= 26 / r; }
    resolveColliders(p, this.ctx.colliders, 0.45);

    // 壁ぎわで進めないときは歩くのをやめる（無限に歩き続けない）
    if (this.walking) {
      const moved = Math.hypot(p.x - prevX, p.z - prevZ);
      if (moved < this.speed * dt * 0.2) {
        this._stallT = (this._stallT || 0) + dt;
        if (this._stallT > 0.5) { this.walking = false; this._stallT = 0; }
      } else {
        this._stallT = 0;
      }
    }

    // ---- くるくるターン ----
    let spinExtra = 0;
    let flare = 0;
    if (this.twirlT >= 0) {
      this.twirlT += dt;
      const T = 1.1;
      if (this.twirlT >= T) {
        this.twirlT = -1;
      } else {
        const prog = this.twirlT / T;
        spinExtra = prog * Math.PI * 4;
        flare = Math.sin(prog * Math.PI);
        if (Math.random() < 0.55) {
          this.ctx.particles.trail(p, this.sparkleColor);
        }
      }
    }
    this.group.rotation.y = this.heading + spinExtra;

    // ---- からだのアニメーション ----
    const walkAmp = this.walking ? 1 : 0;
    const bob = walkAmp * Math.sin(t * 11) * 0.035 + (1 - walkAmp) * Math.sin(t * 2.1) * 0.012;
    this.torso.position.y = bob;
    this.skirtGroup.position.y = bob * 0.6;

    // スカートのゆれとフレア
    const sway = walkAmp * Math.sin(t * 11) * 0.055;
    this.skirtGroup.rotation.z = sway;
    this.skirtGroup.rotation.x = walkAmp * Math.cos(t * 5.5) * 0.03;
    const flareScale = 1 + flare * 0.35;
    this.skirtGroup.scale.set(flareScale, 1 - flare * 0.06, flareScale);

    // 腕のふり
    const armSwing = walkAmp * Math.sin(t * 11) * 0.4;
    this.arms[0].rotation.x = armSwing;
    this.arms[1].rotation.x = -armSwing;
    // ターン中は両手を上げてバレリーナ風に
    const up = flare * 1.9;
    this.arms[0].rotation.z = up * 0.9;
    this.arms[1].rotation.z = -up * 0.9;

    // 頭のかわいいかしげ
    this.head.rotation.z = Math.sin(t * 0.9) * 0.045;
    this.head.rotation.y = Math.sin(t * 0.6) * 0.08;

    // ティアラの宝石とドレスのきらめき
    this.tiaraGem.material.emissiveIntensity = 1.0 + Math.sin(t * 3.4) * 0.5;
    this.sparkleMat.opacity = 0.65 + Math.sin(t * 5.2) * 0.3;
    this.dressSparkles.rotation.y = t * 0.35;
  }
}
