/* =========================================================================
 * きらきら ドリームバレー — キャラクター
 * プレイヤー（まほうつかいの子）と動物たち（うさぎ・こじか・きつね・あひる・ことり）
 * ========================================================================= */
(function () {
  'use strict';

  const DV = (window.DV = window.DV || {});
  const U = DV.U;

  // 共有マテリアル
  let eyeMat, eyeGlintMat, blushMat, noseMat;
  function sharedMats() {
    if (eyeMat) return;
    eyeMat = new THREE.MeshBasicMaterial({ color: U.C(0x33261f) });
    eyeGlintMat = new THREE.MeshBasicMaterial({ color: U.C(0xffffff) });
    blushMat = new THREE.MeshBasicMaterial({ color: U.C(0xffb0b8), transparent: true, opacity: 0.85 });
    noseMat = new THREE.MeshBasicMaterial({ color: U.C(0xff8fa8) });
  }

  function eye(x, y, z, s) {
    const g = new THREE.Group();
    const e = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), eyeMat);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 6, 4), eyeGlintMat);
    gl.position.set(s * 0.3, s * 0.35, s * 0.75);
    g.add(e); g.add(gl);
    g.position.set(x, y, z);
    return g;
  }

  /* ============================ プレイヤー ============================ */
  const OUTFITS = [
    { dress: 0xff8fc2, ribbon: 0xffd24a },
    { dress: 0x7ec8ff, ribbon: 0xff8fc2 },
    { dress: 0xffd24a, ribbon: 0x7ec8ff },
    { dress: 0xa2e8a0, ribbon: 0xffffff },
    { dress: 0xc59bff, ribbon: 0xfff0a0 },
  ];

  function createPlayer(scene) {
    sharedMats();
    const root = new THREE.Group();
    const body = new THREE.Group();   // 上下バウンス用
    root.add(body);

    const skinMat = new THREE.MeshLambertMaterial({ color: U.C(0xffe3c9) });
    const hairMat = new THREE.MeshLambertMaterial({ color: U.C(0x8a5a3a) });
    const dressMat = new THREE.MeshLambertMaterial({ color: U.C(OUTFITS[0].dress) });
    const ribbonMat = new THREE.MeshLambertMaterial({ color: U.C(OUTFITS[0].ribbon) });

    // ワンピース
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.05, 12), dressMat);
    dress.position.y = 0.85;
    dress.castShadow = true;
    body.add(dress);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), dressMat);
    chest.position.y = 1.3;
    body.add(chest);

    // 頭
    const head = new THREE.Group();
    head.position.y = 1.85;
    body.add(head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 12), skinMat);
    face.castShadow = true;
    head.add(face);
    // 髪（後頭部＋前髪）
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hairBack.position.y = 0.05;
    head.add(hairBack);
    const bunL = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), hairMat);
    bunL.position.set(-0.42, 0.32, 0);
    head.add(bunL);
    const bunR = bunL.clone(); bunR.position.x = 0.42;
    head.add(bunR);
    const ribL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), ribbonMat);
    ribL.position.set(-0.42, 0.45, 0.08);
    head.add(ribL);
    const ribR = ribL.clone(); ribR.position.x = 0.42;
    head.add(ribR);
    // 目・ほっぺ・口
    head.add(eye(-0.17, 0.02, 0.4, 0.075));
    head.add(eye(0.17, 0.02, 0.4, 0.075));
    const blushL = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), blushMat);
    blushL.position.set(-0.28, -0.1, 0.38);
    blushL.rotation.y = -0.5;
    head.add(blushL);
    const blushR = blushL.clone(); blushR.position.x = 0.28; blushR.rotation.y = 0.5;
    head.add(blushR);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 10, Math.PI), noseMat);
    mouth.position.set(0, -0.14, 0.42);
    mouth.rotation.z = Math.PI;
    head.add(mouth);

    // 腕
    const armGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.55, 8);
    armGeo.translate(0, -0.24, 0);
    const armL = new THREE.Mesh(armGeo, skinMat);
    armL.position.set(-0.38, 1.42, 0);
    armL.rotation.z = 0.5;
    body.add(armL);
    const armR = new THREE.Mesh(armGeo, skinMat);
    armR.position.set(0.38, 1.42, 0);
    armR.rotation.z = -0.5;
    body.add(armR);

    // 脚
    const legGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.45, 8);
    legGeo.translate(0, -0.2, 0);
    const legL = new THREE.Mesh(legGeo, skinMat);
    legL.position.set(-0.16, 0.42, 0);
    body.add(legL);
    const legR = new THREE.Mesh(legGeo, skinMat);
    legR.position.set(0.16, 0.42, 0);
    body.add(legR);

    // まほうのつえ（右手）
    const wand = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6),
      new THREE.MeshLambertMaterial({ color: U.C(0xc9974f) })
    );
    wand.add(stick);
    const wandStarMat = new THREE.MeshBasicMaterial({ color: U.C(0xfff08a) });
    const wandStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), wandStarMat);
    wandStar.position.y = 0.45;
    wand.add(wandStar);
    const wandGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: DV.Tex.glow, color: U.C(0xffe98a), transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    wandGlow.scale.set(0.9, 0.9, 1);
    wandGlow.position.y = 0.45;
    wand.add(wandGlow);
    wand.position.set(0.5, 1.15, 0.15);
    wand.rotation.z = -0.4;
    body.add(wand);

    // ティアラ（虹コンプリートのごほうび）
    const crown = new THREE.Group();
    const crownMat = new THREE.MeshLambertMaterial({ color: U.C(0xffd76e), emissive: U.C(0x8a6a20) });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 16), crownMat);
    band.rotation.x = Math.PI / 2;
    crown.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), crownMat);
      spike.position.set(Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3);
      crown.add(spike);
    }
    crown.position.y = 0.48;
    crown.visible = false;
    head.add(crown);

    root.position.set(-13, 0, 20);
    root.position.y = DV.World.walkHeight(root.position.x, root.position.z);
    scene.add(root);

    const player = {
      group: root, body, head, armL, armR, legL, legR, wand, wandStar, crown,
      dressMat, ribbonMat,
      outfit: 0,
      target: null,
      speed: 6.2,
      facing: 0,
      walkT: 0,
      spinT: 0,
      splashAcc: 0,
      moving: false,

      setOutfit(i) {
        this.outfit = i % OUTFITS.length;
        const o = OUTFITS[this.outfit];
        this.dressMat.color.copy(U.C(o.dress));
        this.ribbonMat.color.copy(U.C(o.ribbon));
      },

      moveTo(x, z) {
        // 島の外・深い水は少し手前まで
        const r = Math.hypot(x, z);
        if (r > 78) { x *= 78 / r; z *= 78 / r; }
        this.target = new THREE.Vector2(x, z);
      },

      celebrate() { this.spinT = 1.6; },

      update(dt, t) {
        const p = this.group.position;
        this.moving = false;
        if (this.target) {
          const dx = this.target.x - p.x, dz = this.target.y - p.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.25) {
            this.target = null;
          } else {
            const inWater = DV.World.height(p.x, p.z) < 0.25;
            const sp = this.speed * (inWater ? 0.62 : 1);
            const step = Math.min(dist, sp * dt);
            const nx = p.x + (dx / dist) * step;
            const nz = p.z + (dz / dist) * step;
            // 深すぎる水には入らない
            if (DV.World.height(nx, nz) > -1.35) {
              p.x = nx; p.z = nz;
              this.moving = true;
              this.facing = Math.atan2(dx, dz);
            } else {
              this.target = null;
            }
            // 水しぶき
            if (inWater && this.moving) {
              this.splashAcc += dt;
              if (this.splashAcc > 0.33) {
                this.splashAcc = 0;
                DV.FX.splash(p, 0.7);
              }
            }
          }
        }
        // 地面の高さへ
        const gh = DV.World.walkHeight(p.x, p.z);
        p.y += (gh - p.y) * Math.min(1, dt * 12);

        // 向き
        let ry = this.group.rotation.y;
        let diff = this.facing - ry;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y = ry + diff * Math.min(1, dt * 9);

        // 歩きアニメ
        if (this.moving) this.walkT += dt * 9.5;
        const w = this.walkT;
        const amp = this.moving ? 1 : 0;
        this.body.position.y = Math.abs(Math.sin(w)) * 0.14 * amp + Math.sin(t * 2.2) * 0.02;
        this.body.rotation.z = Math.sin(w) * 0.05 * amp;
        this.armL.rotation.x = Math.sin(w) * 0.7 * amp;
        this.armR.rotation.x = -Math.sin(w) * 0.7 * amp;
        this.legL.rotation.x = -Math.sin(w) * 0.8 * amp;
        this.legR.rotation.x = Math.sin(w) * 0.8 * amp;

        // おいわいスピン
        if (this.spinT > 0) {
          this.spinT -= dt;
          this.body.rotation.y += dt * 11;
          this.body.position.y += Math.sin((1.6 - this.spinT) * Math.PI / 1.6 * 2) * 0.4;
          if (this.spinT <= 0) this.body.rotation.y = 0;
        }

        // つえの星はいつもキラキラ回る
        this.wandStar.rotation.y += dt * 3;
        this.wandStar.rotation.x += dt * 2;
      },
    };
    return player;
  }

  /* ============================ 動物 ============================ */
  function animalBase(scene, x, z, opts) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    root.position.set(x, DV.World.walkHeight(x, z), z);
    scene.add(root);
    return {
      group: root, body,
      kind: opts.kind, pitch: opts.pitch || 1,
      feedable: opts.feedable !== false,
      waterOnly: !!opts.waterOnly,
      isFriend: false, followIdx: 0,
      homeX: x, homeZ: z, radius: opts.radius || 9,
      speed: opts.speed || 2.2,
      hop: !!opts.hop,
      state: 'idle', timer: 1 + Math.random() * 3,
      target: null, facing: Math.random() * Math.PI * 2,
      walkT: 0, jumpT: 0,
      bounceH: opts.bounceH || 0.35,

      tap() {
        this.jumpT = 0.65;
        DV.FX.heartsBurst(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 4);
        if (DV.Audio.ready()) {
          if (this.kind === 'bird') DV.Audio.sfxChirp();
          else DV.Audio.sfxSqueak(this.pitch);
        }
      },

      _groundY(x, z) {
        if (this.waterOnly) return DV.World.SEA_Y + 0.05;
        return DV.World.walkHeight(x, z);
      },

      update(dt, t, playerPos) {
        const p = this.group.position;

        // ともだち：プレイヤーの後ろをついていく
        if (this.isFriend) {
          const back = playerPos.clone();
          const ang = Math.atan2(p.x - playerPos.x, p.z - playerPos.z);
          back.x += Math.sin(ang) * (2.0 + this.followIdx * 1.5);
          back.z += Math.cos(ang) * (2.0 + this.followIdx * 1.5);
          const d = Math.hypot(back.x - p.x, back.z - p.z);
          if (d > 0.8) this.target = new THREE.Vector2(back.x, back.z);
        } else if (this.state === 'idle') {
          this.timer -= dt;
          if (this.timer <= 0) {
            // ときどきプレイヤーに近寄る（こわがらない、かわいい）
            const toPlayer = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
            let tx, tz;
            if (toPlayer < 13 && Math.random() < 0.4) {
              tx = playerPos.x + (Math.random() - 0.5) * 5;
              tz = playerPos.z + (Math.random() - 0.5) * 5;
            } else {
              const a = Math.random() * Math.PI * 2;
              const r = Math.random() * this.radius;
              tx = this.homeX + Math.cos(a) * r;
              tz = this.homeZ + Math.sin(a) * r;
            }
            if (this.waterOnly) {
              // 湖の中だけ
              const dl = Math.hypot(tx + 30, tz + 45);
              if (dl > 9) { tx = -30 + (tx + 30) * 8 / dl; tz = -45 + (tz + 45) * 8 / dl; }
            } else if (DV.World.height(tx, tz) < 0.3) {
              tx = this.homeX; tz = this.homeZ;
            }
            this.target = new THREE.Vector2(tx, tz);
            this.state = 'walk';
          }
        }

        let moving = false;
        if (this.target) {
          const dx = this.target.x - p.x, dz = this.target.y - p.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            this.target = null;
            this.state = 'idle';
            this.timer = 1.2 + Math.random() * 4;
          } else {
            const sp = this.isFriend ? Math.min(6.4, this.speed + 2.4) : this.speed;
            const step = Math.min(dist, sp * dt);
            p.x += (dx / dist) * step;
            p.z += (dz / dist) * step;
            this.facing = Math.atan2(dx, dz);
            moving = true;
          }
        }
        const gh = this._groundY(p.x, p.z);
        p.y += (gh - p.y) * Math.min(1, dt * 10);

        let diff = this.facing - this.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1, dt * 8);

        // 動きアニメ
        if (moving) this.walkT += dt * (this.hop ? 7 : 10);
        if (this.hop) {
          this.body.position.y = moving ? Math.abs(Math.sin(this.walkT)) * this.bounceH : 0;
        } else {
          this.body.position.y = moving ? Math.abs(Math.sin(this.walkT)) * 0.08 : 0;
          this.body.rotation.z = moving ? Math.sin(this.walkT) * 0.06 : 0;
        }
        // 待機のいきづかい
        this.body.scale.y = 1 + Math.sin(t * 3 + this.homeX) * 0.02;
        // あひるは水にぷかぷか
        if (this.waterOnly) this.body.position.y += Math.sin(t * 2 + this.homeX) * 0.08;

        // タップジャンプ
        if (this.jumpT > 0) {
          this.jumpT -= dt;
          this.body.position.y += Math.sin(Math.max(0, this.jumpT) / 0.65 * Math.PI) * 0.9;
        }
      },
    };
  }

  function createBunny(scene, x, z) {
    sharedMats();
    const a = animalBase(scene, x, z, { kind: 'bunny', pitch: 1.5, hop: true, speed: 3.2, bounceH: 0.5 });
    const white = new THREE.MeshLambertMaterial({ color: U.C(0xfdfdfa) });
    const pink = new THREE.MeshLambertMaterial({ color: U.C(0xffc4d5) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), white);
    body.position.y = 0.4;
    body.scale.set(0.9, 0.85, 1.1);
    body.castShadow = true;
    a.body.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), white);
    head.position.set(0, 0.82, 0.28);
    a.body.add(head);
    const earGeo = new THREE.SphereGeometry(0.12, 8, 6);
    earGeo.scale(0.7, 2.6, 0.5);
    const earL = new THREE.Mesh(earGeo, white);
    earL.position.set(-0.13, 1.24, 0.2);
    earL.rotation.z = 0.15;
    a.body.add(earL);
    const earR = earL.clone(); earR.position.x = 0.13; earR.rotation.z = -0.15;
    a.body.add(earR);
    const inL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), pink);
    inL.scale.set(0.7, 2.0, 0.5);
    inL.position.set(-0.13, 1.24, 0.26);
    a.body.add(inL);
    const inR = inL.clone(); inR.position.x = 0.13;
    a.body.add(inR);
    a.body.add(eye(-0.12, 0.88, 0.53, 0.05));
    a.body.add(eye(0.12, 0.88, 0.53, 0.05));
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), noseMat);
    nose.position.set(0, 0.78, 0.59);
    a.body.add(nose);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), white);
    tail.position.set(0, 0.42, -0.5);
    a.body.add(tail);
    return a;
  }

  function createFawn(scene, x, z) {
    sharedMats();
    const a = animalBase(scene, x, z, { kind: 'fawn', pitch: 0.8, speed: 2.6, radius: 12 });
    const tan = new THREE.MeshLambertMaterial({ color: U.C(0xc98f5f) });
    const cream = new THREE.MeshLambertMaterial({ color: U.C(0xf2dfc4) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), tan);
    body.position.y = 0.78;
    body.scale.set(0.75, 0.72, 1.25);
    body.castShadow = true;
    a.body.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.55, 8), tan);
    neck.position.set(0, 1.1, 0.42);
    neck.rotation.x = -0.4;
    a.body.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), tan);
    head.position.set(0, 1.38, 0.55);
    a.body.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), cream);
    snout.position.set(0, 1.32, 0.75);
    a.body.add(snout);
    const earGeo = new THREE.SphereGeometry(0.1, 8, 6);
    earGeo.scale(1.4, 0.5, 0.8);
    const earL = new THREE.Mesh(earGeo, tan);
    earL.position.set(-0.22, 1.52, 0.48);
    earL.rotation.z = 0.5;
    a.body.add(earL);
    const earR = earL.clone(); earR.position.x = 0.22; earR.rotation.z = -0.5;
    a.body.add(earR);
    a.body.add(eye(-0.11, 1.42, 0.72, 0.045));
    a.body.add(eye(0.11, 1.42, 0.72, 0.045));
    // あし
    const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.75, 6);
    legGeo.translate(0, -0.375, 0);
    [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, tan);
      leg.position.set(lx, 0.78, lz);
      a.body.add(leg);
    });
    // 背中の白い斑点
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), cream);
      const ang = (i / 7) * Math.PI * 2;
      s.position.set(Math.cos(ang) * 0.22, 1.1 + Math.sin(i * 3) * 0.04, -0.1 + Math.sin(ang) * 0.35);
      a.body.add(s);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), cream);
    tail.position.set(0, 0.85, -0.62);
    a.body.add(tail);
    return a;
  }

  function createFox(scene, x, z) {
    sharedMats();
    const a = animalBase(scene, x, z, { kind: 'fox', pitch: 1.1, speed: 3.4, radius: 11 });
    const orange = new THREE.MeshLambertMaterial({ color: U.C(0xff9448) });
    const white = new THREE.MeshLambertMaterial({ color: U.C(0xfff5e8) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), orange);
    body.position.y = 0.5;
    body.scale.set(0.8, 0.75, 1.25);
    body.castShadow = true;
    a.body.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), white);
    chest.position.set(0, 0.45, 0.3);
    a.body.add(chest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), orange);
    head.position.set(0, 0.95, 0.38);
    a.body.add(head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), white);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.88, 0.65);
    a.body.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), eyeMat);
    nose.position.set(0, 0.88, 0.8);
    a.body.add(nose);
    const earGeo = new THREE.ConeGeometry(0.11, 0.28, 6);
    const earL = new THREE.Mesh(earGeo, orange);
    earL.position.set(-0.16, 1.22, 0.3);
    a.body.add(earL);
    const earR = earL.clone(); earR.position.x = 0.16;
    a.body.add(earR);
    a.body.add(eye(-0.12, 1.0, 0.6, 0.045));
    a.body.add(eye(0.12, 1.0, 0.6, 0.045));
    // ふさふさのしっぽ
    const tailGeo = new THREE.SphereGeometry(0.19, 8, 6);
    tailGeo.scale(1, 1, 2.2);
    const tail = new THREE.Mesh(tailGeo, orange);
    tail.position.set(0, 0.62, -0.62);
    tail.rotation.x = 0.5;
    a.body.add(tail);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), white);
    tailTip.position.set(0, 0.82, -0.92);
    a.body.add(tailTip);
    return a;
  }

  function createDuck(scene, x, z) {
    sharedMats();
    const a = animalBase(scene, x, z, { kind: 'duck', pitch: 1.3, waterOnly: true, speed: 1.8, radius: 7 });
    const yellow = new THREE.MeshLambertMaterial({ color: U.C(0xffdd55) });
    const orange = new THREE.MeshLambertMaterial({ color: U.C(0xff9d45) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), yellow);
    body.position.y = 0.22;
    body.scale.set(0.85, 0.7, 1.15);
    a.body.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), yellow);
    head.position.set(0, 0.62, 0.22);
    a.body.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), orange);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.58, 0.44);
    a.body.add(beak);
    a.body.add(eye(-0.09, 0.68, 0.38, 0.038));
    a.body.add(eye(0.09, 0.68, 0.38, 0.038));
    const wingGeo = new THREE.SphereGeometry(0.16, 8, 6);
    wingGeo.scale(0.5, 0.7, 1.2);
    const wingL = new THREE.Mesh(wingGeo, yellow);
    wingL.position.set(-0.3, 0.28, -0.05);
    a.body.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.3;
    a.body.add(wingR);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), yellow);
    tail.rotation.x = -Math.PI / 2.5;
    tail.position.set(0, 0.32, -0.42);
    a.body.add(tail);
    return a;
  }

  function createBird(scene, x, z) {
    sharedMats();
    const a = animalBase(scene, x, z, { kind: 'bird', pitch: 2.2, feedable: false, speed: 4, radius: 14, hop: true, bounceH: 0.25 });
    const blue = new THREE.MeshLambertMaterial({ color: U.C(0x6fb8ff) });
    const lightB = new THREE.MeshLambertMaterial({ color: U.C(0xbfe0ff) });
    const orange = new THREE.MeshLambertMaterial({ color: U.C(0xffb066) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), blue);
    body.position.y = 0.2;
    body.scale.set(0.9, 0.9, 1.1);
    a.body.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lightB);
    belly.position.set(0, 0.16, 0.1);
    a.body.add(belly);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), orange);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.24, 0.24);
    a.body.add(beak);
    a.body.add(eye(-0.07, 0.28, 0.15, 0.03));
    a.body.add(eye(0.07, 0.28, 0.15, 0.03));
    const wingGeo = new THREE.SphereGeometry(0.1, 8, 6);
    wingGeo.scale(0.4, 0.8, 1.4);
    const wingL = new THREE.Mesh(wingGeo, blue);
    wingL.position.set(-0.18, 0.22, -0.02);
    a.body.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.18;
    a.body.add(wingR);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), blue);
    tail.rotation.x = -Math.PI / 2.2;
    tail.position.set(0, 0.2, -0.26);
    a.body.add(tail);
    a._wings = [wingL, wingR];
    const baseUpdate = a.update.bind(a);
    a.update = function (dt, t, playerPos) {
      baseUpdate(dt, t, playerPos);
      const flap = this.body.position.y > 0.05 ? Math.sin(t * 30) * 0.9 : Math.sin(t * 4) * 0.12;
      this._wings[0].rotation.z = 0.4 + flap;
      this._wings[1].rotation.z = -0.4 - flap;
    };
    return a;
  }

  function createAnimals(scene) {
    const list = [];
    // うさぎ：花畑と村のまわり
    list.push(createBunny(scene, 18, 42));
    list.push(createBunny(scene, -8, 30));
    list.push(createBunny(scene, 24, 48));
    // こじか：桜のまわり
    list.push(createFawn(scene, -24, 14));
    list.push(createFawn(scene, 6, 2));
    // きつね：キノコの森
    list.push(createFox(scene, 25, -30));
    // あひる：湖
    list.push(createDuck(scene, -28, -42));
    list.push(createDuck(scene, -33, -47));
    // ことり
    list.push(createBird(scene, -14, 24));
    list.push(createBird(scene, 30, 20));
    list.push(createBird(scene, 2, 50));
    return list;
  }

  DV.Creatures = { createPlayer, createAnimals, OUTFITS };
})();
