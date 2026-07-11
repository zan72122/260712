/* =========================================================
 * いちごましゅまろのおか — character.js
 * ちびキャラの女の子（プレイヤー & おともだちNPC）
 * プリミティブ組み立て + 手続きアニメーション
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  const DEFAULTS = {
    skin: 0xffe3d0,
    hair: 0x8a5a3b,      // 栗色ボブ
    hairLong: false,
    dress: 0xff6b8f,     // いちご色ワンピース
    dressTrim: 0xfff4f6,
    shoes: 0xe84a6f,
    accessory: 'strawberry', // 'strawberry' | 'ribbon' | null
  };

  function Character(scene, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    this.opts = opts;
    this.group = new THREE.Group();
    this.inner = new THREE.Group(); // ジャンプ/ボブ用
    this.group.add(this.inner);
    this.parts = {};
    this._build(opts);
    IM.setShadow(this.group, true, false);
    scene.add(this.group);

    // 移動ステート
    this.pos = this.group.position;
    this.heading = 0;
    this.speed = 6.2;
    this.target = null;
    this.moving = false;
    this.animTime = IM.rand(0, 10);
    // アクション（twirl / hop）
    this.action = null;
    this.actionT = 0;
  }

  Character.prototype._build = function (o) {
    const P = this.parts;
    const inner = this.inner;

    // ---- 体（ワンピース） ----
    const dress = new THREE.Group();
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.72, 14), IM.toon(o.dress));
    skirt.position.y = 0.62;
    dress.add(skirt);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), IM.toon(o.dress));
    chest.position.y = 0.95;
    dress.add(chest);
    // すそのフリル
    const frill = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 18), IM.toon(o.dressTrim));
    frill.rotation.x = Math.PI / 2;
    frill.position.y = 0.3;
    dress.add(frill);
    // えり
    const collar = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), IM.toon(o.dressTrim));
    collar.position.y = 1.1;
    collar.scale.set(1.4, 0.5, 1.4);
    dress.add(collar);
    inner.add(dress);
    P.dress = dress;

    // ---- あし ----
    P.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), IM.toon(o.skin));
      limb.position.y = -0.16;
      leg.add(limb);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), IM.toon(o.shoes));
      shoe.position.set(0, -0.33, 0.04);
      shoe.scale.set(1, 0.75, 1.35);
      leg.add(shoe);
      leg.position.set(side * 0.15, 0.42, 0);
      inner.add(leg);
      P.legs.push(leg);
    }

    // ---- うで ----
    P.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), IM.toon(o.skin));
      limb.position.y = -0.2;
      arm.add(limb);
      const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), IM.toon(o.dress));
      sleeve.position.y = -0.02;
      arm.add(sleeve);
      arm.position.set(side * 0.31, 1.06, 0);
      arm.rotation.z = side * 0.35;
      inner.add(arm);
      P.arms.push(arm);
    }

    // ---- あたま ----
    const head = new THREE.Group();
    head.position.y = 1.6;
    inner.add(head);
    P.head = head;

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14), IM.toon(o.skin));
    head.add(face);

    // 髪（ベース + 前髪 + サイド）
    const hairMat = IM.toon(o.hair);
    const hairBase = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), hairMat);
    hairBase.position.set(0, 0.06, -0.06);
    head.add(hairBase);
    // 前髪（顔の上部を覆う帯）
    const bangs = new THREE.Mesh(
      new THREE.SphereGeometry(0.47, 16, 10, 0, IM.TAU, 0, Math.PI * 0.42),
      hairMat
    );
    bangs.position.set(0, 0.08, 0.03);
    bangs.rotation.x = 0.28;
    head.add(bangs);
    // ぱっつん前髪の房
    for (let i = -2; i <= 2; i++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hairMat);
      tuft.position.set(i * 0.13, 0.26 - Math.abs(i) * 0.02, 0.38);
      tuft.scale.set(1, 1.6, 0.7);
      head.add(tuft);
    }
    if (o.hairLong) {
      // ロングヘア（背中に流れる）
      P.hairTails = [];
      for (const side of [-1, 0, 1]) {
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), hairMat);
        tail.position.set(side * 0.24, -0.36, -0.3);
        tail.rotation.x = -0.25;
        head.add(tail);
        P.hairTails.push(tail);
      }
      const ahoge = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.2, 3, 6), hairMat);
      ahoge.position.set(0.03, 0.52, 0);
      ahoge.rotation.z = 0.5;
      head.add(ahoge);
      P.ahoge = ahoge;
    } else {
      // ボブの襟足
      for (const side of [-1, 1]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), hairMat);
        puff.position.set(side * 0.32, -0.18, -0.12);
        puff.scale.set(0.8, 1.2, 0.9);
        head.add(puff);
      }
    }

    // 目（大きくてキラキラ）
    P.eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0x40342e }));
      eye.position.set(side * 0.17, 0.02, 0.4);
      eye.scale.set(0.8, 1.25, 0.5);
      head.add(eye);
      P.eyes.push(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(side * 0.15, 0.06, 0.45);
      head.add(shine);
    }
    // ほっぺ
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb3c0 }));
      blush.position.set(side * 0.26, -0.09, 0.36);
      blush.scale.set(1.2, 0.7, 0.4);
      head.add(blush);
    }
    // くち（にっこり）
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.018, 6, 10, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xd85a6a })
    );
    mouth.position.set(0, -0.14, 0.41);
    mouth.rotation.z = Math.PI;
    head.add(mouth);

    // アクセサリー
    if (o.accessory === 'strawberry') {
      const berry = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), IM.toon(0xff4d6a));
      body.scale.set(1, 1.15, 1);
      berry.add(body);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.07, 6), IM.toon(0x4fae5c));
      leaf.position.y = 0.1;
      berry.add(leaf);
      berry.position.set(0.3, 0.35, 0.22);
      berry.rotation.z = -0.4;
      head.add(berry);
    } else if (o.accessory === 'ribbon') {
      const ribbonMat = IM.toon(0xff8fb3);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), ribbonMat);
        wing.position.set(0.02 + side * 0.13, 0.46, 0.05);
        wing.scale.set(1.3, 0.7, 0.5);
        wing.rotation.z = side * 0.5;
        head.add(wing);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), ribbonMat);
      knot.position.set(0.02, 0.46, 0.05);
      head.add(knot);
    }
  };

  // ---- 移動 ----
  Character.prototype.setTarget = function (x, z) {
    this.target = new THREE.Vector2(x, z);
  };

  Character.prototype.stop = function () {
    this.target = null;
    this.moving = false;
  };

  // ---- アクション ----
  Character.prototype.playTwirl = function () {
    if (this.action) return;
    this.action = 'twirl';
    this.actionT = 0;
  };
  Character.prototype.playHop = function () {
    if (this.action === 'twirl') return;
    this.action = 'hop';
    this.actionT = 0;
  };

  Character.prototype.update = function (dt, time) {
    const P = this.parts;

    // ---- 目的地へ移動 ----
    this.moving = false;
    if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.y - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.25) {
        this.moving = true;
        const step = Math.min(this.speed * dt, dist);
        this.pos.x += (dx / dist) * step;
        this.pos.z += (dz / dist) * step;
        const targetHeading = Math.atan2(dx, dz);
        this.heading = IM.lerpAngle(this.heading, targetHeading, Math.min(1, dt * 10));
      } else {
        this.target = null;
      }
    }
    // 地面に沿って立つ
    this.pos.y = IM.groundHeight(this.pos.x, this.pos.z);
    this.group.rotation.y = this.heading;

    // ---- アニメーション ----
    const runBlend = this.moving ? 1 : 0;
    this.animTime += dt * (this.moving ? 11 : 2.4);
    const t = this.animTime;

    // 走り: 足と腕を交互にスイング
    const swing = Math.sin(t) * (0.85 * runBlend);
    if (P.legs) {
      P.legs[0].rotation.x = swing;
      P.legs[1].rotation.x = -swing;
    }
    if (P.arms) {
      P.arms[0].rotation.x = -swing * 0.8;
      P.arms[1].rotation.x = swing * 0.8;
      // アイドル時は腕をゆらゆら
      const idleSway = Math.sin(time * 2.1) * 0.06 * (1 - runBlend);
      P.arms[0].rotation.z = 0.35 + idleSway;
      P.arms[1].rotation.z = -0.35 - idleSway;
    }
    // 体の上下（走り: 弾む / アイドル: 呼吸）
    let bob = this.moving
      ? Math.abs(Math.sin(t)) * 0.09
      : Math.sin(time * 2.1) * 0.025 + 0.025;
    // 頭の揺れ
    if (P.head) {
      P.head.rotation.z = Math.sin(t * 0.5) * 0.04 * runBlend + Math.sin(time * 1.3) * 0.03;
      P.head.rotation.x = runBlend * 0.06;
    }
    // ロングヘアのなびき
    if (P.hairTails) {
      for (let i = 0; i < P.hairTails.length; i++) {
        P.hairTails[i].rotation.x = -0.25 - Math.sin(t + i) * 0.12 * (runBlend + 0.3);
      }
    }
    if (P.ahoge) P.ahoge.rotation.z = 0.5 + Math.sin(time * 3 + 1) * 0.15;

    // ---- アクション（ツイル/ホップ） ----
    let actionY = 0;
    if (this.action) {
      this.actionT += dt;
      const T = this.action === 'twirl' ? 0.9 : 0.5;
      const k = this.actionT / T;
      if (k >= 1) {
        this.action = null;
        this.inner.rotation.y = 0;
      } else {
        actionY = Math.sin(k * Math.PI) * (this.action === 'twirl' ? 0.9 : 0.55);
        if (this.action === 'twirl') this.inner.rotation.y = k * IM.TAU * 2;
        // 腕をあげてバンザイ
        if (P.arms) {
          P.arms[0].rotation.z = 0.35 + Math.sin(k * Math.PI) * 2.2;
          P.arms[1].rotation.z = -0.35 - Math.sin(k * Math.PI) * 2.2;
        }
      }
    }
    this.inner.position.y = bob + actionY;
  };

  IM.Character = Character;
})();
