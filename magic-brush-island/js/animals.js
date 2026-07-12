/* ================================================================
   animals.js — island friends: bunnies, sheep, ducks, sky birds.
   They stand frozen and grey until painted — then they come alive,
   hop about and blow little hearts at you.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.Animals = (function () {
  const T = THREE;
  const P = GAME.PAL;
  const toon = (hex, o) => GAME.Mat.toon(hex, o);
  const rand = (a, b) => a + Math.random() * (b - a);

  const animals = [];   // land friends
  const birds = [];     // sky birds (always coloured, pure ambience)
  let sceneRef = null, terrainH = null;

  function M(geo, hex, cast, opts) {
    const m = new T.Mesh(geo, toon(hex, opts));
    m.castShadow = !!cast;
    return m;
  }

  /* ---------- builders ---------- */

  function buildBunny(hex) {
    const g = new T.Group();
    const body = M(new T.SphereGeometry(0.42, 10, 8), hex, true);
    body.position.y = 0.42;
    body.scale.set(1, 1.05, 1.15);
    g.add(body);
    const head = M(new T.SphereGeometry(0.3, 10, 8), hex, true);
    head.position.set(0, 0.88, 0.22);
    g.add(head);
    for (const sx of [-0.12, 0.12]) {
      const ear = M(T.CapsuleGeometry ? new T.CapsuleGeometry(0.08, 0.4, 3, 6) : new T.CylinderGeometry(0.08, 0.08, 0.5, 6), hex, false);
      ear.position.set(sx, 1.32, 0.14);
      ear.rotation.x = -0.15;
      ear.rotation.z = sx > 0 ? -0.18 : 0.18;
      g.add(ear);
      const inner = M(new T.SphereGeometry(0.05, 6, 5), 0xffb3cf, false);
      inner.position.set(sx, 1.34, 0.2);
      g.add(inner);
      const eye = M(new T.SphereGeometry(0.05, 6, 5), 0x2b2b3a, false);
      eye.position.set(sx, 0.95, 0.48);
      g.add(eye);
    }
    const nose = M(new T.SphereGeometry(0.05, 6, 5), 0xff8fb5, false);
    nose.position.set(0, 0.86, 0.52);
    g.add(nose);
    const tail = M(new T.SphereGeometry(0.13, 6, 5), 0xffffff, false);
    tail.position.set(0, 0.42, -0.48);
    g.add(tail);
    for (const sx of [-0.18, 0.18]) {
      const foot = M(new T.SphereGeometry(0.13, 6, 5), hex, false);
      foot.scale.set(1, 0.5, 1.6);
      foot.position.set(sx, 0.08, 0.15);
      g.add(foot);
    }
    return g;
  }

  function buildSheep() {
    const g = new T.Group();
    const wool = M(new T.IcosahedronGeometry(0.55, 1), 0xfff6ec, true);
    wool.position.y = 0.62;
    wool.scale.set(1.2, 1, 1.35);
    g.add(wool);
    const woolTop = M(new T.IcosahedronGeometry(0.24, 1), 0xfff6ec, false);
    woolTop.position.set(0, 1.15, 0.5);
    g.add(woolTop);
    const head = M(new T.SphereGeometry(0.24, 8, 7), 0x6a5648, false);
    head.position.set(0, 0.95, 0.62);
    g.add(head);
    for (const sx of [-0.1, 0.1]) {
      const eye = M(new T.SphereGeometry(0.045, 6, 5), 0x2b2b3a, false);
      eye.position.set(sx, 1.0, 0.83);
      g.add(eye);
      const ear = M(new T.SphereGeometry(0.08, 6, 5), 0x6a5648, false);
      ear.scale.set(1.6, 0.6, 0.8);
      ear.position.set(sx * 2.6, 0.98, 0.55);
      g.add(ear);
    }
    for (const [lx, lz] of [[-0.28, 0.3], [0.28, 0.3], [-0.28, -0.35], [0.28, -0.35]]) {
      const leg = M(new T.CylinderGeometry(0.07, 0.07, 0.36, 5), 0x6a5648, false);
      leg.position.set(lx, 0.18, lz);
      g.add(leg);
    }
    return g;
  }

  function buildDuck(hex) {
    const g = new T.Group();
    const body = M(new T.SphereGeometry(0.34, 10, 8), hex, true);
    body.scale.set(1.05, 0.9, 1.3);
    body.position.y = 0.26;
    g.add(body);
    const head = M(new T.SphereGeometry(0.22, 9, 8), hex, false);
    head.position.set(0, 0.62, 0.28);
    g.add(head);
    const beak = M(new T.ConeGeometry(0.1, 0.22, 6), P.orange, false);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.6, 0.52);
    g.add(beak);
    for (const sx of [-0.09, 0.09]) {
      const eye = M(new T.SphereGeometry(0.04, 6, 5), 0x2b2b3a, false);
      eye.position.set(sx, 0.68, 0.44);
      g.add(eye);
    }
    const tail = M(new T.ConeGeometry(0.12, 0.3, 6), hex, false);
    tail.rotation.x = -Math.PI / 2.6;
    tail.position.set(0, 0.34, -0.42);
    g.add(tail);
    return g;
  }

  /* ---------- registry ---------- */

  function register(group, kind, x, z, opts) {
    const a = Object.assign({
      group, kind,
      home: new T.Vector3(x, 0, z),
      angle: Math.random() * Math.PI * 2,
      phase: Math.random() * 10,
      hopT: rand(0, 2),
      target: null,
      heartT: rand(2, 5),
      swimR: 0, swimSpeed: 0,
    }, opts || {});
    group.position.set(x, terrainH ? terrainH(x, z) : 0, z);
    group.rotation.y = a.angle;
    sceneRef.add(group);
    animals.push(a);
    return a;
  }

  function addBunny(x, z, zoneId) {
    const hex = [0xffffff, 0xffe2c9, 0xd8c7ff][(Math.random() * 3) | 0];
    const g = buildBunny(hex);
    g.scale.setScalar(0.9);
    const entry = GAME.Mat.makePaintable(g, zoneId);
    return register(g, 'bunny', x, z, { paint: entry });
  }

  function addSheep(x, z, zoneId) {
    const g = buildSheep();
    const entry = GAME.Mat.makePaintable(g, zoneId);
    return register(g, 'sheep', x, z, { paint: entry });
  }

  function addDuck(cx, cz, r, zoneId, waterY) {
    const g = buildDuck([0xfff6c8, 0xffe14d][(Math.random() * 2) | 0]);
    const entry = GAME.Mat.makePaintable(g, zoneId);
    const a = register(g, 'duck', cx + r, cz, { paint: entry, swimR: r, swimSpeed: rand(0.25, 0.5) });
    a.center = new T.Vector3(cx, waterY, cz);
    g.position.y = waterY;
    return a;
  }

  function addBird(cx, cz, radius, h) {
    const hexes = [0x5db7ff, 0xffd93c, 0xff8fb5, 0x9fe8b0];
    const g = GAME.Build.makeBird(hexes[(Math.random() * hexes.length) | 0]);
    g.scale.setScalar(1.15);
    sceneRef.add(g);
    birds.push({
      group: g, cx, cz, radius, h,
      phase: Math.random() * Math.PI * 2,
      speed: rand(0.14, 0.26) * (Math.random() < 0.5 ? 1 : -1),
    });
  }

  /* ---------- behaviour ---------- */

  const _v = new T.Vector3();

  function update(dt, time, playerPos) {
    for (const a of animals) {
      const painted = a.paint && a.paint.painted;
      const g = a.group;

      if (a.kind === 'duck') {
        // swim in circles once painted; drift gently before
        const sp = painted ? a.swimSpeed : 0.05;
        a.angle += sp * dt;
        const px = a.center.x + Math.cos(a.angle) * a.swimR;
        const pz = a.center.z + Math.sin(a.angle) * a.swimR;
        g.rotation.y = -a.angle;
        g.position.set(px, a.center.y + Math.sin(time * 2 + a.phase) * 0.05, pz);
        if (painted && playerPos && g.position.distanceTo(playerPos) < 6) {
          a.heartT -= dt;
          if (a.heartT < 0) {
            a.heartT = rand(2.5, 5);
            GAME.Effects.heart(_v.copy(g.position).add({ x: 0, y: 1.0, z: 0 }));
          }
        }
        continue;
      }

      if (!painted) {
        // frozen & sad — tiny shiver so they still feel alive
        g.rotation.z = Math.sin(time * 1.2 + a.phase) * 0.01;
        continue;
      }

      // happy hops around home
      a.hopT -= dt;
      if (a.hopT <= 0 && !a.target) {
        const aa = Math.random() * Math.PI * 2;
        const rr = Math.random() * 3.2;
        a.target = new T.Vector3(a.home.x + Math.cos(aa) * rr, 0, a.home.z + Math.sin(aa) * rr);
        a.hopT = rand(1.6, 4.5);
        if (Math.random() < 0.25) GAME.Audio.sfx.hop();
      }
      if (a.target) {
        _v.set(a.target.x - g.position.x, 0, a.target.z - g.position.z);
        const d = _v.length();
        if (d < 0.25) {
          a.target = null;
        } else {
          _v.normalize();
          const speed = a.kind === 'bunny' ? 2.2 : 1.4;
          g.position.x += _v.x * speed * dt;
          g.position.z += _v.z * speed * dt;
          const want = Math.atan2(_v.x, _v.z);
          let diff = want - g.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          g.rotation.y += diff * Math.min(1, dt * 8);
          // hop bounce
          const groundY = terrainH(g.position.x, g.position.z);
          const hop = Math.abs(Math.sin(time * (a.kind === 'bunny' ? 9 : 6) + a.phase));
          g.position.y = groundY + hop * (a.kind === 'bunny' ? 0.32 : 0.12);
        }
      } else {
        g.position.y = terrainH(g.position.x, g.position.z);
        // idle wiggle
        g.rotation.z = Math.sin(time * 3 + a.phase) * 0.03;
      }

      // hearts for a nearby friend
      if (playerPos && g.position.distanceTo(playerPos) < 4.5) {
        a.heartT -= dt;
        if (a.heartT < 0) {
          a.heartT = rand(2, 4.5);
          GAME.Effects.heart(_v.copy(g.position).setY(g.position.y + 1.3));
        }
        // look at the player
        _v.copy(playerPos).sub(g.position);
        const want = Math.atan2(_v.x, _v.z);
        let diff = want - g.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        g.rotation.y += diff * Math.min(1, dt * 4);
      }
    }

    // sky birds circle high above
    for (const b of birds) {
      b.phase += b.speed * dt;
      const x = b.cx + Math.cos(b.phase) * b.radius;
      const z = b.cz + Math.sin(b.phase) * b.radius;
      const y = b.h + Math.sin(time * 0.7 + b.phase * 3) * 1.2;
      b.group.position.set(x, y, z);
      b.group.rotation.y = -b.phase + (b.speed > 0 ? 0 : Math.PI);
      const flap = Math.sin(time * 10 + b.phase * 7) * 0.7;
      b.group.userData.wl.rotation.x = Math.PI / 2 + flap;
      b.group.userData.wr.rotation.x = -Math.PI / 2 - flap;
    }
  }

  function celebrateAll() {
    for (const a of animals) {
      if (a.paint && a.paint.painted) {
        GAME.Effects.heart(new T.Vector3(a.group.position.x, a.group.position.y + 1.4, a.group.position.z));
      }
    }
  }

  return {
    init(scene, hFn) { sceneRef = scene; terrainH = hFn; },
    addBunny, addSheep, addDuck, addBird,
    update, celebrateAll,
    get list() { return animals; },
  };
})();
