/* ============================================================
   character.js — しゅじんこう「ぼく」
   むぎわらぼうしの男の子。手続きアニメで歩く・はねる・つる。
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  function lam(color) { return new THREE.MeshLambertMaterial({ color }); }

  G.createPlayer = function (scene) {
    const player = {};
    const root = new THREE.Group();

    const skin = lam(0xffd7ae);
    const shirt = lam(0xfafaf2);
    const shorts = lam(0x3a78c8);
    const strawTop = lam(0xf0cd6e);
    const straw = lam(0xe8c25c);

    /* ---- からだ ---- */
    const body = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.4, 6, 10), shirt);
    torso.position.y = 1.06;
    torso.castShadow = true;
    body.add(torso);

    const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.36, 0.3, 10), shorts);
    pants.position.y = 0.78;
    pants.castShadow = true;
    body.add(pants);

    /* ---- あたま ---- */
    const headGroup = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), skin);
    head.castShadow = true;
    headGroup.add(head);
    // かみのけ（うしろ）
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.43, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), lam(0x4a3220));
    hair.rotation.x = -0.42;
    headGroup.add(hair);
    // め
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2018 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), eyeMat);
      eye.position.set(s * 0.16, 0.02, 0.375);
      eye.scale.y = 1.4;
      headGroup.add(eye);
    }
    // ほっぺ
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xffab8a, transparent: true, opacity: 0.7 });
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.075, 10), cheekMat);
      cheek.position.set(s * 0.26, -0.1, 0.34);
      cheek.rotation.y = s * 0.5;
      headGroup.add(cheek);
    }
    // くち（にっこり）
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.02, 6, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0xb04a3a }));
    mouth.position.set(0, -0.14, 0.38);
    mouth.rotation.x = Math.PI;
    headGroup.add(mouth);
    // むぎわらぼうし
    const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), strawTop);
    hatTop.position.y = 0.31;
    hatTop.scale.y = 0.85;
    hatTop.castShadow = true;
    headGroup.add(hatTop);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.05, 18), straw);
    brim.position.y = 0.31;
    brim.castShadow = true;
    headGroup.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.36, 0.1, 14), lam(0xd84a4a));
    band.position.y = 0.36;
    headGroup.add(band);

    headGroup.position.y = 1.72;
    body.add(headGroup);

    /* ---- うで ---- */
    function arm() {
      const g = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.34, 4, 8), skin);
      upper.position.y = -0.24;
      upper.castShadow = true;
      g.add(upper);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), skin);
      hand.position.y = -0.5;
      g.add(hand);
      return g;
    }
    const armL = arm(), armR = arm();
    armL.position.set(-0.42, 1.4, 0);
    armR.position.set(0.42, 1.4, 0);
    body.add(armL, armR);

    /* ---- あし ---- */
    function leg() {
      const g = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.3, 4, 8), skin);
      thigh.position.y = -0.26;
      thigh.castShadow = true;
      g.add(thigh);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lam(0xe8e8e8));
      shoe.position.set(0, -0.52, 0.05);
      shoe.scale.set(0.9, 0.6, 1.35);
      shoe.castShadow = true;
      g.add(shoe);
      return g;
    }
    const legL = leg(), legR = leg();
    legL.position.set(-0.18, 0.64, 0);
    legR.position.set(0.18, 0.64, 0);
    body.add(legL, legR);

    root.add(body);

    /* ---- むしあみ（ふだんは非表示） ---- */
    const net = new THREE.Group();
    const netStick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.4, 6), lam(0xd8c090));
    netStick.position.y = 0.55;
    net.add(netStick);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 16), lam(0x50b050));
    hoop.position.y = 1.32;
    hoop.rotation.x = Math.PI / 2.4;
    net.add(hoop);
    const bag = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.55, 10, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xe8fff0, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    bag.position.set(0, 1.12, 0.13);
    bag.rotation.x = Math.PI + 0.35;
    net.add(bag);
    net.position.set(0.12, -0.45, 0.08);
    net.rotation.z = -0.4;
    net.visible = false;
    armR.add(net);

    /* ---- つりざお（ふだんは非表示） ---- */
    const rod = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 2.3, 6), lam(0xa87848));
    pole.position.y = 0.9;
    rod.add(pole);
    rod.position.set(0, -0.5, 0.05);
    rod.rotation.x = -0.9;
    rod.visible = false;
    armR.add(rod);
    // つりいと + うき（ワールド空間で管理）
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, lineMat);
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    const bobber = new THREE.Group();
    const bobTop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), lam(0xee4444));
    const bobBottom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), lam(0xffffff));
    bobTop.position.y = 0.045;
    bobBottom.position.y = -0.045;
    bobTop.scale.y = 0.7; bobBottom.scale.y = 0.7;
    bobber.add(bobTop, bobBottom);
    bobber.visible = false;
    scene.add(bobber);

    scene.add(root);

    /* ---- 状態 ---- */
    player.root = root;
    player.pos = root.position;
    player.heading = 0;         // 向き
    player.speed = 0;
    player.walkPhase = 0;
    player.net = net;
    player.rod = rod;
    player.line = line;
    player.bobber = bobber;
    player.rodTipWorld = new THREE.Vector3();
    player.swingT = -1;         // あみを振るアニメ
    player.hopV = 0;
    player.hopY = 0;

    const startX = 2, startZ = 32;
    root.position.set(startX, G.groundHeight(startX, startZ), startZ);

    /* ---- 更新 ---- */
    const SPEED = 6.2;
    let stepTimer = 0;

    player.update = function (dt, input, elapsed) {
      const st = G.state;
      let mx = 0, mz = 0;
      if (!st.busy) { mx = input.moveX; mz = input.moveZ; }
      const mag = Math.min(1, Math.hypot(mx, mz));

      if (mag > 0.05) {
        const targetHeading = Math.atan2(mx, mz);
        const d = G.angleDelta(player.heading, targetHeading);
        player.heading += G.clamp(d, -8 * dt, 8 * dt);
        player.speed = G.damp(player.speed, SPEED * mag, 8, dt);
      } else {
        player.speed = G.damp(player.speed, 0, 10, dt);
      }

      if (player.speed > 0.05) {
        const nx = player.pos.x + Math.sin(player.heading) * player.speed * dt;
        const nz = player.pos.z + Math.cos(player.heading) * player.speed * dt;
        // あるける場所チェック（浅瀬までOK・桟橋OK）
        const h = G.islandHeight(nx, nz);
        const walkable = h > -0.55 || G.onPier(nx, nz);
        if (walkable) {
          player.pos.x = nx;
          player.pos.z = nz;
        } else {
          // 片軸だけならいけるか
          const hx = G.islandHeight(nx, player.pos.z);
          const hz = G.islandHeight(player.pos.x, nz);
          if (hx > -0.55 || G.onPier(nx, player.pos.z)) player.pos.x = nx;
          else if (hz > -0.55 || G.onPier(player.pos.x, nz)) player.pos.z = nz;
        }
      }

      // 接地
      const groundY = G.groundHeight(player.pos.x, player.pos.z);
      // ちいさなジャンプ（お祝い用）
      if (player.hopV !== 0 || player.hopY > 0) {
        player.hopV -= 22 * dt;
        player.hopY = Math.max(0, player.hopY + player.hopV * dt);
        if (player.hopY === 0) player.hopV = 0;
      }
      player.pos.y = G.damp(player.pos.y, Math.max(groundY, -0.35) + player.hopY, 14, dt);
      root.rotation.y = player.heading;

      /* あるきアニメ */
      const walking = player.speed > 0.4;
      if (walking) {
        player.walkPhase += dt * (6 + player.speed * 1.1);
        const s = Math.sin(player.walkPhase);
        legL.rotation.x = s * 0.75;
        legR.rotation.x = -s * 0.75;
        armL.rotation.x = -s * 0.6;
        armR.rotation.x = player.rod.visible || player.swingT >= 0 ? armR.rotation.x : s * 0.6;
        body.position.y = Math.abs(Math.cos(player.walkPhase)) * 0.09;
        body.rotation.z = Math.sin(player.walkPhase) * 0.03;
        // あしおと
        stepTimer -= dt;
        if (stepTimer <= 0 && G.audio.ready) {
          stepTimer = 0.28 / Math.max(0.4, player.speed / SPEED);
          const h = G.islandHeight(player.pos.x, player.pos.z);
          if (!G.onPier(player.pos.x, player.pos.z) && h < 0.25) {
            G.audio.wade();
            if (G.fx) G.fx.splashRing(player.pos.x, 0.08, player.pos.z, 0.55);
          } else {
            G.audio.step();
          }
        }
      } else {
        // アイドル：ゆったり呼吸
        const idle = Math.sin(elapsed * 2.2) * 0.02;
        legL.rotation.x = G.damp(legL.rotation.x, 0, 12, dt);
        legR.rotation.x = G.damp(legR.rotation.x, 0, 12, dt);
        armL.rotation.x = G.damp(armL.rotation.x, idle, 8, dt);
        if (!player.rod.visible && player.swingT < 0) {
          armR.rotation.x = G.damp(armR.rotation.x, -idle, 8, dt);
        }
        body.position.y = G.damp(body.position.y, idle * 0.5 + 0.01, 8, dt);
        body.rotation.z = G.damp(body.rotation.z, 0, 8, dt);
      }

      /* あみを振る */
      if (player.swingT >= 0) {
        player.swingT += dt * 3.2;
        const t = player.swingT;
        if (t < 1) {
          armR.rotation.x = -0.3 - Math.sin(t * Math.PI) * 2.2;
        } else {
          player.swingT = -1;
          net.visible = false;
        }
      }

      /* つりざおを持つ姿勢 */
      if (player.rod.visible) {
        armR.rotation.x = G.damp(armR.rotation.x, -1.5, 10, dt);
        armL.rotation.x = G.damp(armL.rotation.x, -0.4, 10, dt);
        // さおの先端（ワールド）
        player.rodTipWorld.set(0, 2.05, 0);
        rod.localToWorld(player.rodTipWorld);
      }
    };

    /** あみ振りアニメ開始 */
    player.swingNet = function () {
      net.visible = true;
      player.swingT = 0;
      if (G.audio.ready) G.audio.swish();
    };

    /** うれしいジャンプ */
    player.hop = function () {
      player.hopV = 7;
      player.hopY = 0.01;
    };

    return player;
  };
})();
