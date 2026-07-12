/* ============================================================
   creatures.js — いきものたち
   カモメ / イルカ / カニ / さかなのかげ
   （つかまえられる虫・ほたるは activities.js）
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  function lam(color) { return new THREE.MeshLambertMaterial({ color }); }

  // タップできるものの登録簿（input.js が参照）
  G.tappables = [];

  G.createCreatures = function (scene) {
    const creatures = {};

    /* ============ カモメ ============ */
    const gulls = [];
    (function seagulls() {
      for (let i = 0; i < 5; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 4, 8), lam(0xffffff));
        body.rotation.z = Math.PI / 2;
        g.add(body);
        const headM = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), lam(0xffffff));
        headM.position.set(0, 0.06, 0.32);
        g.add(headM);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), lam(0xffa030));
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.05, 0.46);
        g.add(beak);
        const wingGeo = new THREE.PlaneGeometry(0.85, 0.3);
        wingGeo.translate(0.42, 0, 0);
        const wingMat = lam(0xf2f2f2);
        wingMat.side = THREE.DoubleSide;
        const wingL = new THREE.Mesh(wingGeo, wingMat);
        const wingR = new THREE.Mesh(wingGeo, wingMat);
        wingR.rotation.y = Math.PI;
        wingL.position.y = 0.05; wingR.position.y = 0.05;
        g.add(wingL, wingR);
        // 翼端は黒
        const tipMat = lam(0x444444);
        scene.add(g);
        gulls.push({
          g, wingL, wingR,
          r: G.rand(18, 42), cy: G.rand(14, 24),
          speed: G.rand(0.14, 0.3) * (Math.random() < 0.5 ? 1 : -1),
          a: G.rand(0, Math.PI * 2),
          flapPhase: G.rand(0, 6),
          cryTimer: G.rand(6, 20),
          cx: G.rand(-15, 15), cz: G.rand(0, 30),
        });
      }
    })();

    /* ============ イルカ ============ */
    const dolphins = [];
    (function makeDolphins() {
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Group();
        const bodyMat = lam(0x7aa8cc);
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.1, 6, 10), bodyMat);
        body.rotation.x = Math.PI / 2;
        g.add(body);
        const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 10), lam(0xd8e8f2));
        belly.rotation.x = Math.PI / 2;
        belly.position.y = -0.12;
        g.add(belly);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), bodyMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.z = 1.0;
        g.add(nose);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), bodyMat);
        fin.position.set(0, 0.45, -0.1);
        fin.rotation.set(0, 0, 0);
        fin.scale.z = 0.4;
        g.add(fin);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 4), bodyMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1.6, 1, 0.25);
        tail.position.z = -1.05;
        g.add(tail);
        g.visible = false;
        scene.add(g);
        dolphins.push({
          g,
          angle: G.rand(0, Math.PI * 2),
          jumpT: -G.rand(1, 8),   // マイナスの間は待ち
          period: G.rand(5, 9),
          r: 72 + i * 5,
        });
      }
    })();
    creatures.dolphinShow = function () {
      // ごほうび：みんなでジャンプ
      dolphins.forEach((d, i) => { d.jumpT = -i * 0.6; });
      if (G.audio.ready) G.audio.dolphin();
    };

    /* ============ カニ ============ */
    const crabs = [];
    (function makeCrabs() {
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Group();
        const bodyMat = lam(0xf25a3a);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bodyMat);
        body.scale.set(1.3, 0.7, 1);
        g.add(body);
        // め
        for (const s of [-1, 1]) {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5), bodyMat);
          stalk.position.set(s * 0.13, 0.26, 0.12);
          g.add(stalk);
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
          eye.position.set(s * 0.13, 0.38, 0.12);
          g.add(eye);
        }
        // はさみ
        const claws = [];
        for (const s of [-1, 1]) {
          const claw = new THREE.Group();
          const armM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), bodyMat);
          armM.rotation.z = s * 1.2;
          armM.position.x = s * 0.15;
          claw.add(armM);
          const pincer = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), bodyMat);
          pincer.scale.set(1.2, 0.8, 0.9);
          pincer.position.set(s * 0.3, 0.1, 0);
          claw.add(pincer);
          claw.position.set(s * 0.32, 0, 0.1);
          g.add(claw);
          claws.push(claw);
        }
        // あし
        for (const s of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            const legM = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.3, 4), bodyMat);
            legM.position.set(s * 0.38, -0.1, -0.12 + k * 0.12);
            legM.rotation.z = s * 1.1;
            g.add(legM);
          }
        }
        const x = G.rand(-16, 22), z = G.rand(33, 41);
        g.position.set(x, G.islandHeight(x, z) + 0.22, z);
        g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        scene.add(g);
        const crab = {
          g, claws,
          tx: x, tz: z, waitT: G.rand(0, 2),
          danceT: -1,
        };
        crabs.push(crab);
        G.tappables.push({
          obj: g, radius: 1.3,
          onTap() {
            crab.danceT = 0;
            if (G.audio.ready) G.audio.crab();
            if (G.activities) G.activities.registerCatch('kani', g.position, { quiet: true });
          },
        });
      }
    })();

    /* ============ さかなのかげ（あさせ） ============ */
    const fishShadows = [];
    (function makeShadows() {
      const geoS = new THREE.CircleGeometry(0.4, 10);
      const matS = new THREE.MeshBasicMaterial({ color: 0x0a3048, transparent: true, opacity: 0.35 });
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(geoS, matS);
        m.rotation.x = -Math.PI / 2;
        m.scale.set(1, 0.45, 1);
        scene.add(m);
        fishShadows.push({
          m,
          cx: G.rand(-20, 25), cz: G.rand(46, 52),
          r: G.rand(2, 5), speed: G.rand(0.4, 0.9) * (Math.random() < 0.5 ? 1 : -1),
          a: G.rand(0, 6.28),
        });
      }
    })();

    /* ============ 更新 ============ */
    const _v = new THREE.Vector3();
    creatures.update = function (dt, elapsed, playerPos) {
      /* カモメ */
      for (const s of gulls) {
        s.a += s.speed * dt;
        const x = s.cx + Math.cos(s.a) * s.r;
        const z = s.cz + Math.sin(s.a) * s.r;
        const y = s.cy + Math.sin(elapsed * 0.5 + s.flapPhase) * 1.5;
        // すすむ向き
        _v.set(x - s.g.position.x, 0, z - s.g.position.z);
        if (_v.lengthSq() > 0.0001) s.g.rotation.y = Math.atan2(_v.x, _v.z);
        s.g.position.set(x, y, z);
        const flap = Math.sin(elapsed * 7 + s.flapPhase) * 0.55;
        s.wingL.rotation.z = flap;
        s.wingR.rotation.z = -flap;
        s.cryTimer -= dt;
        if (s.cryTimer <= 0) {
          s.cryTimer = G.rand(9, 26);
          if (G.audio.ready && G.env.dayLight > 0.3) G.audio.gull();
        }
      }

      /* イルカ */
      for (const d of dolphins) {
        d.jumpT += dt;
        if (d.jumpT < 0) { d.g.visible = false; continue; }
        const T = 1.6; // ジャンプ時間
        if (d.jumpT < T) {
          const t = d.jumpT / T;
          d.angle += dt * 0.35;
          const x = Math.cos(d.angle) * d.r;
          const z = Math.sin(d.angle) * d.r * 0.75 + 18;
          const y = Math.sin(t * Math.PI) * 3.2 - 0.8;
          d.g.visible = y > -0.7;
          d.g.position.set(x, y, z);
          // 進行方向 + 弧の姿勢
          d.g.rotation.y = Math.atan2(-Math.sin(d.angle), Math.cos(d.angle)) + Math.PI / 2;
          d.g.rotation.x = G.lerp(-1.0, 1.0, t);
          if (t < 0.08 && !d.splashed) {
            d.splashed = true;
            if (G.fx) G.fx.splash(x, 0, z, 1.2);
            if (G.audio.ready && Math.random() < 0.5) G.audio.dolphin();
          }
          if (t > 0.9 && d.splashed) {
            if (G.fx) G.fx.splash(d.g.position.x, 0, d.g.position.z, 1.0);
            d.splashed = false;
          }
        } else {
          d.g.visible = false;
          d.jumpT = -d.period * G.rand(0.7, 1.3);
          d.angle += G.rand(0.3, 1.2);
        }
      }

      /* カニ */
      for (const c of crabs) {
        if (c.danceT >= 0) {
          // ばんざいダンス
          c.danceT += dt * 4;
          const s = Math.sin(c.danceT * 3);
          c.claws[0].rotation.z = 0.8 + s * 0.5;
          c.claws[1].rotation.z = -0.8 - s * 0.5;
          c.g.position.y = G.islandHeight(c.g.position.x, c.g.position.z) + 0.22 + Math.abs(s) * 0.25;
          if (c.danceT > 4) {
            c.danceT = -1;
            c.claws[0].rotation.z = 0;
            c.claws[1].rotation.z = 0;
          }
          continue;
        }
        c.waitT -= dt;
        if (c.waitT <= 0) {
          const dx = c.tx - c.g.position.x, dz = c.tz - c.g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.15) {
            c.waitT = G.rand(0.5, 3);
            const nx = G.clamp(c.g.position.x + G.rand(-4, 4), -18, 24);
            const nz = G.clamp(c.g.position.z + G.rand(-2.5, 2.5), 32, 42);
            if (G.islandHeight(nx, nz) > 0.1) { c.tx = nx; c.tz = nz; }
          } else {
            const spd = 1.4;
            c.g.position.x += (dx / dist) * spd * dt;
            c.g.position.z += (dz / dist) * spd * dt;
            c.g.position.y = G.islandHeight(c.g.position.x, c.g.position.z) + 0.22
              + Math.abs(Math.sin(elapsed * 14)) * 0.04;
            // カニはよこ歩き：進行方向に対して体は90度
            c.g.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
          }
        }
      }

      /* さかなのかげ */
      for (const f of fishShadows) {
        f.a += f.speed * dt;
        const x = f.cx + Math.cos(f.a) * f.r;
        const z = f.cz + Math.sin(f.a) * f.r * 0.6;
        const h = G.islandHeight(x, z);
        if (h < -0.3 && h > -3) {
          f.m.visible = true;
          f.m.position.set(x, 0.08, z);
          f.m.rotation.z = -f.a + (f.speed > 0 ? 0 : Math.PI);
        } else {
          f.m.visible = false;
        }
      }
    };

    return creatures;
  };
})();
