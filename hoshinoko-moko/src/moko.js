// ほしのこモコ — 主役キャラクター
// まっしろでまんまるな「ほしのこ」。頭に小さな星が浮かんでいる。
// すべてプリミティブから手続き生成し、ぷにぷにした手続きアニメで動かす。

import * as THREE from 'three';

const WHITE = 0xfffdfa;
const PINK = 0xffc4d8;

export class Moko {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.state = 'idle';        // idle | walk | eat | happy | sleep
    this.stateT = 0;
    this.walkTarget = new THREE.Vector3();
    this.onArrive = null;       // 歩き終わったときのコールバック
    this.petAmount = 0;         // なでなで蓄積
    this.idleTimer = 0;         // 放置時間（自発行動用）
    this.blinkT = 0;
    this.nextBlink = 2;
    this.happyEyes = 0;         // ^ ^ 目の残り時間
    this.hatIndex = 0;
    this.speed = 2.3;

    this._build();
    this.group.position.set(0.5, 0, 1.0);
    scene.add(this.group);
  }

  /* ---------- 造形 ---------- */

  _build() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: WHITE });
    const pinkMat = new THREE.MeshLambertMaterial({ color: PINK });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x40332e });

    // しゃがみ/のび用のルート（squash & stretch）
    this.body = new THREE.Group();
    this.group.add(this.body);

    // 胴体
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 20), bodyMat);
    torso.position.y = 0.5;
    torso.scale.set(1, 0.95, 0.92);
    torso.castShadow = true;
    this.body.add(torso);

    // あたま
    this.head = new THREE.Group();
    this.head.position.y = 1.12;
    this.body.add(this.head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 20), bodyMat);
    skull.castShadow = true;
    this.head.add(skull);

    // みみ（ねこみみ、先はピンク）
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), bodyMat);
      ear.position.set(s * 0.26, 0.4, 0);
      ear.rotation.z = -s * 0.35;
      ear.castShadow = true;
      this.head.add(ear);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 12), pinkMat);
      tip.position.set(s * 0.315, 0.49, 0);
      tip.rotation.z = -s * 0.35;
      this.head.add(tip);
      if (s === 1) this.earR = ear; else this.earL = ear;
    }

    // め（通常：まる、うれしい：^）
    this.eyes = [];
    this.happyArcs = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), darkMat);
      eye.position.set(s * 0.17, 0.05, 0.4);
      this.head.add(eye);
      this.eyes.push(eye);

      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 12, Math.PI), darkMat);
      arc.position.set(s * 0.17, 0.04, 0.41);
      arc.visible = false;
      this.head.add(arc);
      this.happyArcs.push(arc);
    }

    // ねむり目（－）
    this.sleepEyes = [];
    for (const s of [-1, 1]) {
      const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.09, 4, 8), darkMat);
      line.rotation.z = Math.PI / 2;
      line.position.set(s * 0.17, 0.05, 0.41);
      line.visible = false;
      this.head.add(line);
      this.sleepEyes.push(line);
    }

    // はな＆くち
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), pinkMat);
    nose.position.set(0, -0.05, 0.44);
    this.head.add(nose);
    this.mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.014, 8, 12, Math.PI), darkMat);
    this.mouth.position.set(0, -0.11, 0.42);
    this.mouth.rotation.z = Math.PI;
    this.head.add(this.mouth);

    // ほっぺ
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xffa8bd, transparent: true, opacity: 0.75,
    });
    for (const s of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), blushMat);
      blush.position.set(s * 0.3, -0.07, 0.34);
      blush.lookAt(blush.position.clone().multiplyScalar(2).add(new THREE.Vector3(0, 0, 0.6)));
      this.head.add(blush);
    }

    // うで・あし
    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.16, 6, 10), bodyMat);
      arm.position.set(s * 0.5, 0.62, 0.05);
      arm.rotation.z = s * 0.9;
      arm.castShadow = true;
      this.body.add(arm);
      this.arms.push(arm);
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.1, 6, 10), bodyMat);
      leg.position.set(s * 0.22, 0.12, 0.05);
      this.body.add(leg);
    }

    // しっぽ（先がピンク）
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.4, -0.45);
    this.body.add(this.tail);
    const tailSeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 6, 10), bodyMat);
    tailSeg.position.set(0, 0.18, -0.05);
    tailSeg.rotation.x = 0.5;
    tailSeg.castShadow = true;
    this.tail.add(tailSeg);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), pinkMat);
    tailTip.position.set(0, 0.36, -0.16);
    this.tail.add(tailTip);

    // あたまの上の小さな星（ほしのこの証。夜は強く光る）
    this.starMat = new THREE.MeshLambertMaterial({
      color: 0xffe9a3, emissive: 0xffd75e, emissiveIntensity: 0.6, flatShading: true,
    });
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.11 : 0.048;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false });
    starGeo.center();
    this.star = new THREE.Mesh(starGeo, this.starMat);
    this.star.position.set(0, 0.78, 0);
    this.head.add(this.star);

    // 夜、星がランタンのようにモコを照らす
    this.starLight = new THREE.PointLight(0xffe0a0, 0, 3.2, 2);
    this.starLight.position.set(0, 0.85, 0.2);
    this.head.add(this.starLight);

    // ぼうし置き場
    this.hatAnchor = new THREE.Group();
    this.hatAnchor.position.set(0, 0.32, 0);
    this.head.add(this.hatAnchor);
    this.hats = this._buildHats();
    for (const h of this.hats) { h.visible = false; this.hatAnchor.add(h); }

    // タッチ判定用の見えない球
    this.hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    this.hitMesh.position.y = 0.85;
    this.group.add(this.hitMesh);
  }

  _buildHats() {
    const hats = [];

    // 1) 赤いニットぼうし
    {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
        new THREE.MeshLambertMaterial({ color: 0xff6b6b, flatShading: true }));
      cap.scale.y = 1.15;
      g.add(cap);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xfff8f0 }));
      pom.position.y = 0.4;
      g.add(pom);
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 8, 20),
        new THREE.MeshLambertMaterial({ color: 0xe05555 }));
      brim.rotation.x = Math.PI / 2;
      brim.position.y = 0.03;
      g.add(brim);
      g.position.y = 0.08;
      hats.push(g);
    }

    // 2) お花のかんむり
    {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 20),
        new THREE.MeshLambertMaterial({ color: 0x6fae5c }));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const cols = [0xffa8cf, 0xfff3a0, 0xffffff, 0xffb08a, 0xd9a8ff];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0),
          new THREE.MeshLambertMaterial({ color: cols[i % cols.length], flatShading: true }));
        f.position.set(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3);
        g.add(f);
      }
      g.position.y = 0.12;
      hats.push(g);
    }

    // 3) 小さな金のかんむり
    {
      const g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({
        color: 0xffd75e, emissive: 0xffb02e, emissiveIntensity: 0.35, flatShading: true,
      });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.12, 10, 1, true), mat);
      g.add(band);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat);
        spike.position.set(Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.2);
        g.add(spike);
      }
      g.position.y = 0.16;
      g.rotation.z = 0.12;
      hats.push(g);
    }

    // 4) いちごベレー
    {
      const g = new THREE.Group();
      const beret = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6),
        new THREE.MeshLambertMaterial({ color: 0xff8fb8, flatShading: true }));
      beret.scale.set(1.15, 0.75, 1.15);
      g.add(beret);
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xe83e5e }));
      berry.position.set(0.12, 0.2, 0.08);
      g.add(berry);
      const leafB = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.07, 6),
        new THREE.MeshLambertMaterial({ color: 0x5daa4f }));
      leafB.position.set(0.12, 0.27, 0.08);
      g.add(leafB);
      g.position.y = 0.1;
      g.rotation.z = -0.15;
      hats.push(g);
    }

    return hats;
  }

  setHat(i) {
    this.hatIndex = i;
    this.hats.forEach((h, idx) => { h.visible = idx === i - 1; });
    // ぼうしをかぶったら星は少し前へ
    this.star.position.set(0, 0.78, i > 0 ? 0.28 : 0);
  }

  /* ---------- 行動 ---------- */

  get position() { return this.group.position; }

  walkTo(target, onArrive = null) {
    if (this.state === 'eat') return;
    this.walkTarget.copy(target);
    this.walkTarget.y = 0;
    this.onArrive = onArrive;
    this._setState('walk');
  }

  jump() {
    if (this.state === 'sleep') { this.wake(); return; }
    this._setState('happy');
    this.happyEyes = 1.2;
  }

  startEat() {
    this._setState('eat');
  }

  celebrate() {
    this._setState('happy');
    this.stateT = -1.2; // 長めに踊る
    this.happyEyes = 3.2;
  }

  sleep() {
    this._setState('sleep');
  }

  wake() {
    if (this.state !== 'sleep') return;
    this._setState('happy');
    this.happyEyes = 1.0;
  }

  pet(dt) {
    this.petAmount += dt;
    this.happyEyes = Math.max(this.happyEyes, 0.5);
    this.idleTimer = 0;
    if (this.state === 'sleep') this.wake();
  }

  _setState(s) {
    this.state = s;
    this.stateT = 0;
    this.idleTimer = 0;
    if (s !== 'sleep') {
      this.sleepEyes.forEach((e) => (e.visible = false));
      this.body.rotation.x = 0;
      this.head.rotation.x = 0;
    }
  }

  faceTowards(p, dt, snap = 8) {
    const dx = p.x - this.group.position.x;
    const dz = p.z - this.group.position.z;
    if (dx * dx + dz * dz < 0.0001) return;
    const target = Math.atan2(dx, dz);
    let cur = this.group.rotation.y;
    let diff = target - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y = cur + diff * Math.min(1, dt * snap);
  }

  /* ---------- 毎フレーム ---------- */

  update(dt, t, night) {
    this.stateT += dt;
    this.idleTimer += dt;
    this.petAmount = Math.max(0, this.petAmount - dt * 0.5);

    // 星の光：夜はキラキラ、ランタンがわりにモコを照らす
    this.starMat.emissiveIntensity = 0.5 + night * 1.5 + Math.sin(t * 3) * 0.15;
    this.starLight.intensity = night * 1.4;
    this.star.rotation.y = t * 1.2;
    this.star.position.y = 0.78 + Math.sin(t * 2.2) * 0.04;

    // まばたき
    this.blinkT += dt;
    if (this.blinkT > this.nextBlink) {
      this.blinkT = 0;
      this.nextBlink = 1.8 + Math.random() * 3.2;
    }
    const blink = this.blinkT < 0.12 ? 0.12 : 1;

    // 目のモード切替
    this.happyEyes = Math.max(0, this.happyEyes - dt);
    const happy = this.happyEyes > 0 && this.state !== 'sleep';
    const asleep = this.state === 'sleep' && this.stateT > 0.8;
    this.eyes.forEach((e) => {
      e.visible = !happy && !asleep;
      e.scale.y = blink;
    });
    this.happyArcs.forEach((a) => (a.visible = happy));
    this.sleepEyes.forEach((e) => (e.visible = asleep));

    // しっぽ：ごきげんに応じて速く振る
    const wagSpeed = 3 + (happy ? 6 : 0) + this.petAmount * 4;
    this.tail.rotation.y = Math.sin(t * wagSpeed) * 0.5;
    this.tail.rotation.x = Math.sin(t * wagSpeed * 0.7) * 0.15;

    // みみぴく
    if (Math.sin(t * 0.7) > 0.995) this.earR.rotation.z = -0.55;
    this.earR.rotation.z += (-0.35 - this.earR.rotation.z) * dt * 6;

    switch (this.state) {
      case 'idle': this._updateIdle(dt, t); break;
      case 'walk': this._updateWalk(dt, t); break;
      case 'eat': this._updateEat(dt, t); break;
      case 'happy': this._updateHappy(dt, t); break;
      case 'sleep': this._updateSleep(dt, t); break;
    }

    // なでなでのうっとり
    if (this.petAmount > 0.1 && this.state === 'idle') {
      this.head.rotation.z = Math.sin(t * 2.2) * 0.14;
      this.head.rotation.x = 0.12;
    } else if (this.state !== 'eat' && this.state !== 'sleep') {
      this.head.rotation.z *= 1 - Math.min(1, dt * 5);
      this.head.rotation.x *= 1 - Math.min(1, dt * 5);
    }
  }

  _updateIdle(dt, t) {
    // 呼吸
    const br = 1 + Math.sin(t * 2.4) * 0.02;
    this.body.scale.set(br, 1 / br, br);
    this.body.position.y = 0;
    this.group.rotation.z = 0;

    // ときどきキョロキョロ
    this.head.rotation.y = Math.sin(t * 0.5) * 0.25;
  }

  _updateWalk(dt, t) {
    const pos = this.group.position;
    const d = this.walkTarget.clone().sub(pos);
    d.y = 0;
    const dist = d.length();
    if (dist < 0.12) {
      const cb = this.onArrive;
      this.onArrive = null;
      this._setState('idle');
      if (cb) cb();
      return;
    }
    this.faceTowards(this.walkTarget, dt);
    d.normalize().multiplyScalar(Math.min(this.speed * dt, dist));
    pos.add(d);

    // ぴょこぴょこ跳ねる歩き
    const hop = Math.abs(Math.sin(this.stateT * 9));
    this.body.position.y = hop * 0.16;
    const sq = 1 + hop * 0.06;
    this.body.scale.set(1 / sq, sq, 1 / sq);
    this.group.rotation.z = Math.sin(this.stateT * 9) * 0.06;
    this.head.rotation.y = 0;
  }

  _updateEat(dt, t) {
    // もぐもぐ
    this.head.rotation.x = 0.3 + Math.sin(this.stateT * 14) * 0.12;
    this.mouth.scale.setScalar(1 + Math.max(0, Math.sin(this.stateT * 14)) * 0.8);
    this.body.position.y = 0;
    if (this.stateT > 1.6) {
      this.mouth.scale.setScalar(1);
      this.head.rotation.x = 0;
      this._setState('happy');
      this.happyEyes = 1.4;
    }
  }

  _updateHappy(dt, t) {
    // ジャンプしてくるん
    const T = this.stateT;
    const dur = 0.85;
    if (T < dur) {
      const k = T / dur;
      this.body.position.y = Math.sin(k * Math.PI) * 0.85;
      this.group.rotation.y += dt * 7.4;
      const sq = 1 + Math.sin(k * Math.PI) * 0.12;
      this.body.scale.set(1 / sq, sq, 1 / sq);
    } else if (T < dur + 0.12) {
      // 着地でぺちゃ
      this.body.position.y = 0;
      const sq = 0.82;
      this.body.scale.set(1 / sq, sq, 1 / sq);
    } else if (T < dur + 0.3) {
      const sq = 0.82 + ((T - dur - 0.12) / 0.18) * 0.18;
      this.body.scale.set(1 / sq, sq, 1 / sq);
    } else {
      this.body.scale.set(1, 1, 1);
      this._setState('idle');
    }
  }

  _updateSleep(dt, t) {
    // まるくなって上下にすーすー
    const k = Math.min(1, this.stateT / 0.8);
    this.body.position.y = -0.12 * k;
    this.body.rotation.x = 0.25 * k;
    const br = 1 + Math.sin(t * 1.4) * 0.035 * k;
    this.body.scale.set(br, (1 / br) * (1 - 0.12 * k), br);
    this.head.rotation.x = 0.35 * k;
    this.head.rotation.y = 0;
  }
}
