/* ================================================================
   builders.js — hand-built low-poly props with toon materials.
   Trees, houses, castle, carousel, windmill, lighthouse, flowers,
   mushrooms, boats … the furniture of a storybook island.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.Build = (function () {
  const T = THREE;
  const P = GAME.PAL;
  const toon = (hex, o) => GAME.Mat.toon(hex, o);

  /* mesh helper: geometry + colour, shadow flags */
  function M(geo, hex, cast, opts) {
    const m = new T.Mesh(geo, toon(hex, opts));
    m.castShadow = !!cast;
    m.receiveShadow = false;
    return m;
  }

  const rand = (a, b) => a + GAME.rng() * (b - a);

  /* ================= NATURE ================= */

  function makeTree(kind) {
    const g = new T.Group();
    const h = rand(1.6, 2.4);
    const trunk = M(new T.CylinderGeometry(0.22, 0.34, h, 7), P.trunk, true);
    trunk.position.y = h / 2;
    g.add(trunk);
    const leafHex = kind === 'blossom' ? P.blossom
      : [P.leaf1, P.leaf2, P.leaf3][(GAME.rng() * 3) | 0];
    const blobs = 2 + ((GAME.rng() * 2) | 0);
    for (let i = 0; i < blobs; i++) {
      const r = rand(0.85, 1.35);
      const b = M(new T.IcosahedronGeometry(r, 1), leafHex, true);
      b.material.color.offsetHSL(rand(-0.02, 0.02), rand(-0.06, 0.06), rand(-0.05, 0.04));
      b.position.set(rand(-0.5, 0.5), h + rand(0.3, 1.3), rand(-0.5, 0.5));
      b.scale.y = rand(0.8, 1);
      g.add(b);
    }
    if (kind === 'blossom') {
      // a few darker pink dots
      for (let i = 0; i < 3; i++) {
        const d = M(new T.IcosahedronGeometry(0.22, 0), 0xff6fa8, false);
        d.position.set(rand(-1, 1), h + rand(0.5, 1.6), rand(-1, 1));
        g.add(d);
      }
    }
    return g;
  }

  function makePine() {
    const g = new T.Group();
    const trunk = M(new T.CylinderGeometry(0.2, 0.3, 1.2, 7), P.trunkDark, true);
    trunk.position.y = 0.6;
    g.add(trunk);
    let y = 1.1, r = 1.25;
    for (let i = 0; i < 3; i++) {
      const cone = M(new T.ConeGeometry(r, 1.5, 8), P.pine, true);
      cone.position.y = y + 0.75;
      g.add(cone);
      y += 0.85; r *= 0.72;
    }
    return g;
  }

  function makeFlower(hex) {
    const g = new T.Group();
    const h = rand(0.5, 0.85);
    const stem = M(new T.CylinderGeometry(0.045, 0.06, h, 5), 0x3fae52, false);
    stem.position.y = h / 2;
    g.add(stem);
    const petals = M(new T.TorusGeometry(0.26, 0.14, 6, 9), hex, false);
    petals.rotation.x = Math.PI / 2;
    petals.scale.y = 1; petals.scale.z = 1;
    petals.position.y = h;
    petals.scale.set(1, 1, 0.5);
    g.add(petals);
    const center = M(new T.SphereGeometry(0.14, 8, 6), 0xffd93c, false);
    center.position.y = h + 0.02;
    g.add(center);
    return g;
  }

  function makeFlowerPatch(hexes, n) {
    const g = new T.Group();
    for (let i = 0; i < n; i++) {
      const f = makeFlower(hexes[i % hexes.length]);
      const a = GAME.rng() * Math.PI * 2;
      const r = Math.sqrt(GAME.rng()) * 1.1;
      f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      f.rotation.y = GAME.rng() * Math.PI;
      f.scale.setScalar(rand(0.8, 1.25));
      g.add(f);
    }
    return g;
  }

  function makeMushroom(big) {
    const g = new T.Group();
    const s = big ? rand(1.6, 2.2) : rand(0.8, 1.2);
    const stem = M(new T.CylinderGeometry(0.28 * s, 0.4 * s, 1.1 * s, 8), P.mushroomStem, true);
    stem.position.y = 0.55 * s;
    g.add(stem);
    const capHex = GAME.rng() < 0.5 ? P.mushroomCap : P.mushroomCap2;
    const cap = M(new T.SphereGeometry(0.85 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), capHex, true);
    cap.position.y = 1.0 * s;
    cap.scale.y = 0.75;
    g.add(cap);
    for (let i = 0; i < 4; i++) {
      const dot = M(new T.SphereGeometry(0.12 * s, 6, 5), 0xfff6ec, false);
      const a = GAME.rng() * Math.PI * 2;
      const rr = rand(0.3, 0.6) * s;
      dot.position.set(Math.cos(a) * rr, 1.05 * s + 0.42 * s * Math.cos(rr / s), Math.sin(a) * rr);
      g.add(dot);
    }
    return g;
  }

  function makeRock() {
    const g = new T.Group();
    const r = M(new T.IcosahedronGeometry(rand(0.5, 1.0), 0), 0xb9c0cc, true);
    r.scale.y = rand(0.55, 0.8);
    r.rotation.y = GAME.rng() * Math.PI;
    g.add(r);
    return g;
  }

  /* ================= BUILDINGS ================= */

  function makeHouse(wallHex, roofHex) {
    const g = new T.Group();
    const w = rand(2.4, 3.0), d = rand(2.2, 2.6), h = rand(1.8, 2.2);
    const walls = M(new T.BoxGeometry(w, h, d), wallHex, true);
    walls.position.y = h / 2;
    g.add(walls);
    const roof = M(new T.ConeGeometry(Math.max(w, d) * 0.82, h * 0.9, 4), roofHex, true);
    roof.position.y = h + h * 0.45;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const door = M(new T.BoxGeometry(0.6, 1.0, 0.1), P.trunk, false);
    door.position.set(0, 0.5, d / 2 + 0.05);
    g.add(door);
    const knob = M(new T.SphereGeometry(0.06, 6, 5), 0xffd93c, false);
    knob.position.set(0.18, 0.5, d / 2 + 0.12);
    g.add(knob);
    for (const sx of [-w * 0.28, w * 0.28]) {
      const win = M(new T.BoxGeometry(0.5, 0.5, 0.08), 0xbfe8ff, false);
      win.position.set(sx, h * 0.62, d / 2 + 0.05);
      g.add(win);
    }
    const chim = M(new T.BoxGeometry(0.35, 0.8, 0.35), wallHex, false);
    chim.position.set(w * 0.28, h + 0.55, -d * 0.2);
    g.add(chim);
    return g;
  }

  function makeWindmill() {
    const g = new T.Group();
    const tower = M(new T.CylinderGeometry(1.0, 1.5, 4.6, 10), P.wall1, true);
    tower.position.y = 2.3;
    g.add(tower);
    const roof = M(new T.ConeGeometry(1.25, 1.3, 10), P.roof1, true);
    roof.position.y = 5.2;
    g.add(roof);
    const door = M(new T.BoxGeometry(0.7, 1.1, 0.1), P.trunk, false);
    door.position.set(0, 0.55, 1.42);
    g.add(door);
    // rotating blade assembly
    const hubG = new T.Group();
    hubG.position.set(0, 4.6, 1.35);
    const hub = M(new T.SphereGeometry(0.28, 8, 6), P.trunkDark, false);
    hubG.add(hub);
    for (let i = 0; i < 4; i++) {
      const blade = M(new T.BoxGeometry(0.5, 2.6, 0.08), 0xfff6ec, true);
      blade.position.y = 1.5;
      const arm = new T.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      blade.position.y = 1.6;
      arm.add(blade);
      const strut = M(new T.BoxGeometry(0.12, 1.4, 0.06), P.trunk, false);
      strut.position.y = 0.7;
      arm.add(strut);
      hubG.add(arm);
    }
    g.add(hubG);
    g.userData.spin = hubG;
    return g;
  }

  function makeLighthouse() {
    const g = new T.Group();
    const stripes = [P.red, 0xfff6ec, P.red, 0xfff6ec];
    let y = 0;
    let r0 = 1.5;
    for (let i = 0; i < 4; i++) {
      const hh = 1.15;
      const r1 = r0 * 0.88;
      const seg = M(new T.CylinderGeometry(r1, r0, hh, 12), stripes[i], true);
      seg.position.y = y + hh / 2;
      g.add(seg);
      y += hh; r0 = r1;
    }
    const cabin = M(new T.CylinderGeometry(0.85, 0.85, 0.9, 10), 0x4a5a78, true);
    cabin.position.y = y + 0.45;
    g.add(cabin);
    const lamp = M(new T.SphereGeometry(0.5, 10, 8), 0xffe98a, false, { emissive: 0xffcf4d, emissiveIntensity: 0.9 });
    lamp.position.y = y + 0.5;
    g.add(lamp);
    const cap = M(new T.ConeGeometry(0.95, 0.8, 10), P.red, true);
    cap.position.y = y + 1.3;
    g.add(cap);
    return g;
  }

  function makeCastle() {
    const g = new T.Group();
    const keep = M(new T.BoxGeometry(4.6, 3.6, 4.2), P.wall3, true);
    keep.position.y = 1.8;
    g.add(keep);
    const keepRoof = M(new T.ConeGeometry(3.4, 2.4, 4), P.roof2, true);
    keepRoof.position.y = 4.8;
    keepRoof.rotation.y = Math.PI / 4;
    g.add(keepRoof);
    // corner towers
    const corners = [[-2.5, -2.2], [2.5, -2.2], [-2.5, 2.2], [2.5, 2.2]];
    corners.forEach(([x, z], i) => {
      const tower = M(new T.CylinderGeometry(0.85, 1.0, 4.6, 10), P.wall1, true);
      tower.position.set(x, 2.3, z);
      g.add(tower);
      const roofHexes = [P.roof2, P.roof4, P.roof4, P.roof2];
      const roof = M(new T.ConeGeometry(1.15, 1.8, 10), roofHexes[i], true);
      roof.position.set(x, 5.5, z);
      g.add(roof);
      const pole = M(new T.CylinderGeometry(0.04, 0.04, 1.0, 4), P.trunkDark, false);
      pole.position.set(x, 6.9, z);
      g.add(pole);
      const flag = M(new T.PlaneGeometry(0.7, 0.4), [P.red, P.yellow, P.pink, P.green][i], false, { side: T.DoubleSide });
      flag.position.set(x + 0.36, 7.15, z);
      g.add(flag);
    });
    // gate
    const gate = M(new T.CylinderGeometry(0.9, 0.9, 0.5, 12, 1, false, 0, Math.PI), P.trunk, false);
    gate.rotation.set(Math.PI / 2, 0, 0);
    gate.position.set(0, 0.9, 2.15);
    g.add(gate);
    const gateBase = M(new T.BoxGeometry(1.8, 0.95, 0.5), P.trunk, false);
    gateBase.position.set(0, 0.46, 2.15);
    g.add(gateBase);
    return g;
  }

  /* ================= PLAYGROUND ================= */

  function makeCarousel() {
    const g = new T.Group();
    const base = M(new T.CylinderGeometry(3.2, 3.5, 0.5, 16), P.roof1, true);
    base.position.y = 0.25;
    g.add(base);
    const pole = M(new T.CylinderGeometry(0.18, 0.18, 3.4, 8), P.yellow, false);
    pole.position.y = 2.2;
    g.add(pole);
    const roof = M(new T.ConeGeometry(3.6, 1.6, 16), P.roof3, true);
    roof.position.y = 4.6;
    g.add(roof);
    const trim = M(new T.TorusGeometry(3.35, 0.16, 6, 20), P.red, false);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 3.9;
    g.add(trim);
    const topBall = M(new T.SphereGeometry(0.35, 8, 6), P.yellow, false, { emissive: 0xcc9a20, emissiveIntensity: 0.4 });
    topBall.position.y = 5.55;
    g.add(topBall);
    // spinning platform with 4 pastel ponies
    const spinner = new T.Group();
    spinner.position.y = 0.5;
    const horseHexes = [P.pink, P.blue, 0xc9f06a, P.purple];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const horse = new T.Group();
      const hp = M(new T.CylinderGeometry(0.06, 0.06, 3.2, 6), 0xd8dee9, false);
      hp.position.y = 1.6;
      horse.add(hp);
      const body = M(new T.SphereGeometry(0.42, 10, 8), horseHexes[i], false);
      body.scale.set(1.35, 0.85, 0.8);
      body.position.y = 1.15;
      horse.add(body);
      const head = M(new T.SphereGeometry(0.26, 8, 7), horseHexes[i], false);
      head.position.set(0.55, 1.5, 0);
      horse.add(head);
      const ear = M(new T.ConeGeometry(0.09, 0.2, 5), horseHexes[i], false);
      ear.position.set(0.55, 1.75, 0);
      horse.add(ear);
      const mane = M(new T.SphereGeometry(0.14, 6, 5), 0xfff6ec, false);
      mane.position.set(0.32, 1.55, 0);
      horse.add(mane);
      for (const lx of [-0.22, 0.24]) for (const lz of [-0.18, 0.18]) {
        const leg = M(new T.CylinderGeometry(0.07, 0.07, 0.5, 5), horseHexes[i], false);
        leg.position.set(lx, 0.72, lz);
        horse.add(leg);
      }
      horse.position.set(Math.cos(a) * 2.3, 0, Math.sin(a) * 2.3);
      horse.rotation.y = -a + Math.PI / 2;
      horse.userData.bobPhase = i * 1.7;
      spinner.add(horse);
    }
    g.add(spinner);
    g.userData.spin = spinner;
    return g;
  }

  function makeSwing() {
    const g = new T.Group();
    const frameHex = P.blue;
    for (const sx of [-1.2, 1.2]) {
      const legA = M(new T.CylinderGeometry(0.08, 0.08, 2.6, 6), frameHex, true);
      legA.position.set(sx, 1.2, -0.45);
      legA.rotation.x = 0.35;
      g.add(legA);
      const legB = legA.clone();
      legB.position.z = 0.45;
      legB.rotation.x = -0.35;
      g.add(legB);
    }
    const bar = M(new T.CylinderGeometry(0.07, 0.07, 2.6, 6), P.yellow, false);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.35;
    g.add(bar);
    const swingG = new T.Group();
    swingG.position.y = 2.35;
    for (const sx of [-0.3, 0.3]) {
      const rope = M(new T.CylinderGeometry(0.03, 0.03, 1.5, 4), 0xd8dee9, false);
      rope.position.set(sx, -0.75, 0);
      swingG.add(rope);
    }
    const seat = M(new T.BoxGeometry(0.8, 0.09, 0.35), P.red, false);
    seat.position.y = -1.5;
    swingG.add(seat);
    g.add(swingG);
    g.userData.swing = swingG;
    return g;
  }

  function makeBalloonStand() {
    const g = new T.Group();
    const cart = M(new T.BoxGeometry(1.2, 0.9, 0.8), P.wall2, true);
    cart.position.y = 0.75;
    g.add(cart);
    const roofC = M(new T.ConeGeometry(1.0, 0.6, 4), P.roof1, false);
    roofC.position.y = 1.55;
    roofC.rotation.y = Math.PI / 4;
    g.add(roofC);
    for (const wx of [-0.45, 0.45]) {
      const wheel = M(new T.CylinderGeometry(0.28, 0.28, 0.12, 10), P.trunkDark, false);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.28, 0.45);
      g.add(wheel);
    }
    const hexes = GAME.Effects ? GAME.Effects.RAINBOW : [P.red, P.yellow, P.blue];
    for (let i = 0; i < 6; i++) {
      const b = M(new T.SphereGeometry(0.3, 8, 7), hexes[i % hexes.length], false);
      b.scale.y = 1.15;
      b.position.set(rand(-0.5, 0.5), 2.3 + rand(0, 0.9), rand(-0.4, 0.4));
      b.userData.balloon = { phase: GAME.rng() * 6 };
      const str = M(new T.CylinderGeometry(0.012, 0.012, 0.9, 3), 0xd8dee9, false);
      str.position.set(b.position.x, b.position.y - 0.75, b.position.z);
      g.add(b); g.add(str);
    }
    return g;
  }

  /* ================= SMALL PROPS ================= */

  function makeFence(len) {
    const g = new T.Group();
    const n = Math.max(2, Math.round(len / 0.9));
    for (let i = 0; i <= n; i++) {
      const post = M(new T.CylinderGeometry(0.07, 0.08, 0.7, 5), 0xfff6ec, false);
      post.position.set(-len / 2 + (i / n) * len, 0.35, 0);
      g.add(post);
    }
    const rail = M(new T.BoxGeometry(len, 0.09, 0.06), 0xfff6ec, false);
    rail.position.y = 0.5;
    g.add(rail);
    const rail2 = rail.clone();
    rail2.position.y = 0.28;
    g.add(rail2);
    return g;
  }

  function makeWell() {
    const g = new T.Group();
    const ring = M(new T.CylinderGeometry(0.8, 0.85, 0.7, 10), 0xb9c0cc, true);
    ring.position.y = 0.35;
    g.add(ring);
    const waterDisc = M(new T.CylinderGeometry(0.65, 0.65, 0.05, 10), P.waterShallow, false, { emissive: 0x1a6aa8, emissiveIntensity: 0.3 });
    waterDisc.position.y = 0.66;
    g.add(waterDisc);
    for (const sx of [-0.7, 0.7]) {
      const post = M(new T.BoxGeometry(0.12, 1.2, 0.12), P.trunk, false);
      post.position.set(sx, 1.1, 0);
      g.add(post);
    }
    const roofW = M(new T.ConeGeometry(1.1, 0.7, 4), P.roof1, true);
    roofW.position.y = 2.0;
    roofW.rotation.y = Math.PI / 4;
    g.add(roofW);
    return g;
  }

  function makeBoat(hullHex, sailHex) {
    const g = new T.Group();
    const hull = M(new T.CylinderGeometry(0.9, 0.55, 0.8, 8), hullHex, true);
    hull.scale.z = 0.55; hull.scale.x = 1.6;
    hull.position.y = 0.4;
    g.add(hull);
    const mast = M(new T.CylinderGeometry(0.05, 0.05, 2.2, 5), P.trunk, false);
    mast.position.y = 1.8;
    g.add(mast);
    const sail = M(new T.PlaneGeometry(1.1, 1.4), sailHex, false, { side: T.DoubleSide });
    sail.position.set(0.6, 2.0, 0);
    g.add(sail);
    return g;
  }

  function makeBench() {
    const g = new T.Group();
    const seat = M(new T.BoxGeometry(1.6, 0.1, 0.5), P.trunk, false);
    seat.position.y = 0.45;
    g.add(seat);
    const back = M(new T.BoxGeometry(1.6, 0.5, 0.08), P.trunk, false);
    back.position.set(0, 0.8, -0.22);
    g.add(back);
    for (const sx of [-0.65, 0.65]) {
      const leg = M(new T.BoxGeometry(0.1, 0.45, 0.4), P.trunkDark, false);
      leg.position.set(sx, 0.22, 0);
      g.add(leg);
    }
    return g;
  }

  function makeLampPost() {
    const g = new T.Group();
    const pole = M(new T.CylinderGeometry(0.07, 0.1, 2.4, 6), 0x4a5a78, true);
    pole.position.y = 1.2;
    g.add(pole);
    const lamp = M(new T.SphereGeometry(0.26, 8, 7), 0xffe98a, false, { emissive: 0xffcf4d, emissiveIntensity: 0.85 });
    lamp.position.y = 2.55;
    g.add(lamp);
    const cap = M(new T.ConeGeometry(0.3, 0.25, 8), P.roof2, false);
    cap.position.y = 2.85;
    g.add(cap);
    return g;
  }

  /* star collectible */
  function makeStarPickup() {
    const shape = new T.Shape();
    const R = 0.55, r = 0.24;
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 1 });
    const mesh = new T.Mesh(geo, toon(0xffd93c, { emissive: 0xd9a418, emissiveIntensity: 0.55 }));
    const g = new T.Group();
    g.add(mesh);
    const halo = new T.Mesh(new T.SphereGeometry(0.75, 10, 8),
      new T.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.16, depthWrite: false }));
    g.add(halo);
    return g;
  }

  /* fluffy toon cloud */
  function makeCloud() {
    const g = new T.Group();
    const mat = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: GAME.Mat.getGradient(), transparent: true, opacity: 0.95 });
    const n = 3 + ((GAME.rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const r = rand(1.2, 2.6);
      const s = new T.Mesh(new T.SphereGeometry(r, 10, 8), mat);
      s.position.set(i * rand(1.4, 2.0) - n, rand(-0.3, 0.5), rand(-0.8, 0.8));
      s.scale.y = 0.62;
      g.add(s);
    }
    return g;
  }

  /* sea turtle friend */
  function makeTurtle() {
    const g = new T.Group();
    const shell = M(new T.SphereGeometry(1.1, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x2e9e5b, false);
    shell.scale.set(1.2, 0.75, 1.4);
    g.add(shell);
    const shellRim = M(new T.CylinderGeometry(1.32, 1.4, 0.22, 12), 0x87e0a0, false);
    shellRim.scale.z = 1.18;
    shellRim.position.y = 0.02;
    g.add(shellRim);
    const head = M(new T.SphereGeometry(0.42, 10, 8), 0x9fe8b0, false);
    head.position.set(0, 0.25, 1.75);
    g.add(head);
    for (const sx of [-0.16, 0.16]) {
      const eye = M(new T.SphereGeometry(0.07, 6, 5), 0x2b2b3a, false);
      eye.position.set(sx, 0.42, 2.05);
      g.add(eye);
    }
    for (const [fx, fz] of [[-1.3, 0.7], [1.3, 0.7], [-1.2, -0.9], [1.2, -0.9]]) {
      const fl = M(new T.SphereGeometry(0.4, 8, 6), 0x9fe8b0, false);
      fl.scale.set(1.4, 0.3, 0.7);
      fl.position.set(fx, -0.05, fz);
      g.add(fl);
    }
    return g;
  }

  /* little flying bird */
  function makeBird(hex) {
    const g = new T.Group();
    const body = M(new T.SphereGeometry(0.28, 8, 7), hex, false);
    body.scale.set(1.25, 1, 1);
    g.add(body);
    const head = M(new T.SphereGeometry(0.18, 8, 6), hex, false);
    head.position.set(0.3, 0.16, 0);
    g.add(head);
    const beak = M(new T.ConeGeometry(0.07, 0.18, 5), P.orange, false);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.52, 0.14, 0);
    g.add(beak);
    const wingGeo = new T.PlaneGeometry(0.5, 0.3);
    wingGeo.translate(0, 0.15, 0);
    const wmat = toon(hex, { side: T.DoubleSide });
    const wl = new T.Mesh(wingGeo, wmat);
    wl.rotation.x = Math.PI / 2;
    wl.position.set(0, 0.1, 0.22);
    const wr = new T.Mesh(wingGeo, wmat);
    wr.rotation.x = -Math.PI / 2;
    wr.position.set(0, 0.1, -0.22);
    g.add(wl); g.add(wr);
    g.userData = { wl, wr };
    return g;
  }

  /* rainbow arc that pops over completed zones */
  function makeRainbow(radius) {
    const g = new T.Group();
    const hexes = [0xff5a5a, 0xffa03c, 0xffd93c, 0x51c95b, 0x4aa8ff, 0xb07aff, 0xff8fb5];
    hexes.forEach((hex, i) => {
      const geo = new T.TorusGeometry(radius - i * 0.34, 0.16, 6, 40, Math.PI);
      const mat = new T.MeshBasicMaterial({ color: new T.Color(hex).convertSRGBToLinear(), transparent: true, opacity: 0.75 });
      const arc = new T.Mesh(geo, mat);
      g.add(arc);
    });
    return g;
  }

  return {
    makeTree, makePine, makeFlower, makeFlowerPatch, makeMushroom, makeRock,
    makeHouse, makeWindmill, makeLighthouse, makeCastle,
    makeCarousel, makeSwing, makeBalloonStand,
    makeFence, makeWell, makeBoat, makeBench, makeLampPost,
    makeStarPickup, makeCloud, makeTurtle, makeBird, makeRainbow,
  };
})();
