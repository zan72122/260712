/* ============================================================
   characters.js — ミミ the bunny (the hero) and her five
   hidden friends: bear, penguin, cat, duckling and piglet.
   Everyone is hand-built from soft primitive shapes with big
   sparkly eyes and rosy cheeks — no model files needed.
   Each build returns { group, animate(t, state) }.
   ============================================================ */

(function (K) {
  "use strict";

  const Characters = {};
  K.Characters = Characters;

  // ---------- small reusable face parts ----------
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2038 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cheekMat = new THREE.MeshBasicMaterial({
    color: 0xff9eb8, transparent: true, opacity: 0.75,
  });

  function addFace(head, r, opts = {}) {
    const fz = opts.faceZ !== undefined ? opts.faceZ : r * 0.82;
    const ey = opts.eyeY !== undefined ? opts.eyeY : r * 0.15;
    const ex = opts.eyeX !== undefined ? opts.eyeX : r * 0.4;
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 8, 6), eyeMat);
      eye.position.set(ex * side, ey, fz);
      head.add(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.05, 6, 4), glintMat);
      glint.position.set(ex * side + r * 0.05, ey + r * 0.06, fz + r * 0.1);
      head.add(glint);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 8, 6), cheekMat);
      cheek.scale.z = 0.4;
      cheek.position.set(ex * 1.55 * side, ey - r * 0.28, fz * 0.92);
      head.add(cheek);
    }
  }

  // ============================================================
  // ミミ the bunny — the player
  // ============================================================
  Characters.buildBunny = function () {
    const cream = new THREE.MeshLambertMaterial({ color: 0xfff6ec });
    const pink = new THREE.MeshLambertMaterial({ color: 0xffb7cd });
    const overall = new THREE.MeshLambertMaterial({ color: 0x5fa8ff });

    // outer group carries the world transform; the inner rig is
    // what the animations bob and squash, so they never fight.
    const outer = new THREE.Group();
    const group = new THREE.Group();
    outer.add(group);

    // body (wears sky-blue overalls)
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), overall);
    body.scale.set(1, 1.12, 0.92);
    body.position.y = 0.78;
    body.castShadow = true;
    group.add(body);
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x4a90e0 });
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.1), strapMat);
      strap.position.set(0.22 * side, 1.28, 0.42);
      strap.rotation.x = -0.25;
      group.add(strap);
    }
    // golden star button
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd24a }));
    btn.position.set(0, 1.05, 0.56);
    group.add(btn);

    // head
    const head = new THREE.Group();
    head.position.y = 1.85;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), cream);
    skull.castShadow = true;
    head.add(skull);
    addFace(head, 0.55);
    // nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), pink);
    nose.position.set(0, -0.02, 0.53);
    head.add(nose);
    group.add(head);

    // long floppy ears with pink inners
    const ears = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.22 * side, 0.42, 0);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), cream);
      ear.scale.set(1, 3.1, 0.8);
      ear.position.y = 0.42;
      ear.castShadow = true;
      pivot.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pink);
      inner.scale.set(1, 2.6, 0.5);
      inner.position.set(0, 0.42, 0.09);
      pivot.add(inner);
      pivot.rotation.z = -0.16 * side;
      head.add(pivot);
      ears.push(pivot);
    }

    // arms
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), cream);
      arm.scale.set(1, 1.9, 1);
      arm.position.set(0.62 * side, 0.95, 0);
      arm.rotation.z = 0.5 * side;
      group.add(arm);
      arms.push(arm);
    }

    // feet
    const feet = [];
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), cream);
      foot.scale.set(1, 0.75, 1.7);
      foot.position.set(0.24 * side, 0.16, 0.12);
      group.add(foot);
      feet.push(foot);
    }

    // fluffy tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    tail.position.set(0, 0.75, -0.58);
    group.add(tail);

    // state: 'idle' | 'run' | 'air'
    function animate(t, state, speed01) {
      if (state === "run") {
        const f = t * 13;
        group.position.y = Math.abs(Math.sin(f)) * 0.16 * speed01;
        feet[0].rotation.x = Math.sin(f) * 0.9 * speed01;
        feet[1].rotation.x = -Math.sin(f) * 0.9 * speed01;
        arms[0].rotation.x = -Math.sin(f) * 0.8 * speed01;
        arms[1].rotation.x = Math.sin(f) * 0.8 * speed01;
        head.rotation.x = 0.08;
        ears[0].rotation.x = 0.55 + Math.sin(f * 0.5) * 0.12;
        ears[1].rotation.x = 0.55 + Math.cos(f * 0.5) * 0.12;
        body.scale.y = 1.12;
      } else if (state === "air") {
        feet[0].rotation.x = -0.6; feet[1].rotation.x = -0.6;
        arms[0].rotation.x = -2.4; arms[1].rotation.x = -2.4; // wheee, arms up!
        ears[0].rotation.x = 0.9; ears[1].rotation.x = 0.9;
        body.scale.y = 1.2;
        group.position.y = 0;
      } else {
        // idle: soft breathing + curious ear twitches
        group.position.y = 0;
        body.scale.y = 1.12 + Math.sin(t * 2.2) * 0.02;
        feet[0].rotation.x = 0; feet[1].rotation.x = 0;
        arms[0].rotation.x = Math.sin(t * 2.2) * 0.06;
        arms[1].rotation.x = Math.sin(t * 2.2 + 1) * 0.06;
        head.rotation.x = Math.sin(t * 0.8) * 0.05;
        ears[0].rotation.x = 0.08 + Math.sin(t * 1.3) * 0.07;
        ears[1].rotation.x = 0.08 + Math.sin(t * 1.3 + 0.9) * 0.07;
      }
    }

    return { group: outer, animate };
  };

  // ============================================================
  // the five friends
  // ============================================================

  function buildBear() {
    const brown = new THREE.MeshLambertMaterial({ color: 0xc98d5e });
    const muzzleM = new THREE.MeshLambertMaterial({ color: 0xf5d9b8 });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 11), brown);
    body.scale.set(1, 1.05, 0.95); body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Group(); head.position.y = 2.2;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 11), brown);
    skull.castShadow = true; head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), muzzleM);
    muzzle.scale.set(1.2, 0.85, 0.9); muzzle.position.set(0, -0.16, 0.5);
    head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    nose.position.set(0, -0.08, 0.76); head.add(nose);
    addFace(head, 0.62, { eyeY: 0.2 });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), brown);
      ear.position.set(0.42 * side, 0.5, 0); head.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), muzzleM);
      inner.position.set(0.42 * side, 0.5, 0.12); head.add(inner);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), brown);
      arm.scale.set(1, 1.7, 1); arm.position.set(0.85 * side, 1.05, 0);
      group.add(arm);
      const leg = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), brown);
      leg.scale.set(1, 0.8, 1.4); leg.position.set(0.34 * side, 0.2, 0.1);
      group.add(leg);
    }
    group.add(head);
    // honey-yellow tummy
    const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 9), muzzleM);
    tummy.scale.set(0.9, 1, 0.5); tummy.position.set(0, 0.9, 0.5);
    group.add(tummy);
    return charWrap(group, 1.0);
  }

  function buildPenguin() {
    const dark = new THREE.MeshLambertMaterial({ color: 0x3b4a6b });
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const orange = new THREE.MeshLambertMaterial({ color: 0xffa03a });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 11), dark);
    body.scale.set(1, 1.35, 1); body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), white);
    belly.scale.set(0.95, 1.25, 0.6); belly.position.set(0, 0.9, 0.28);
    group.add(belly);
    const head = new THREE.Group(); head.position.y = 2.1;
    addFace(head, 0.5, { faceZ: 0.42, eyeX: 0.2, eyeY: 0.12 });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), orange);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0, 0.6);
    head.add(beak);
    group.add(head);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dark);
      wing.scale.set(0.5, 1.8, 1); wing.position.set(0.68 * side, 1.05, 0);
      wing.rotation.z = 0.35 * side;
      group.add(wing);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), orange);
      foot.scale.set(1.2, 0.5, 1.8); foot.position.set(0.25 * side, 0.08, 0.15);
      group.add(foot);
    }
    return charWrap(group, 1.0);
  }

  function buildCat() {
    const ginger = new THREE.MeshLambertMaterial({ color: 0xffab52 });
    const creamM = new THREE.MeshLambertMaterial({ color: 0xfff2dd });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 11), ginger);
    body.scale.set(1, 1.05, 0.95); body.position.y = 0.72;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Group(); head.position.y = 1.7;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 11), ginger);
    skull.castShadow = true; head.add(skull);
    addFace(head, 0.52);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff7a9a }));
    nose.position.set(0, -0.05, 0.5); head.add(nose);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 4), ginger);
      ear.position.set(0.3 * side, 0.52, 0); ear.rotation.z = -0.2 * side;
      head.add(ear);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), creamM);
      paw.position.set(0.28 * side, 0.14, 0.28); group.add(paw);
    }
    group.add(head);
    // curly tail
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 12, Math.PI * 1.4), ginger);
    tail.position.set(0, 0.8, -0.6); tail.rotation.x = -0.4;
    group.add(tail);
    // tummy patch
    const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), creamM);
    tummy.scale.set(0.85, 0.95, 0.5); tummy.position.set(0, 0.65, 0.32);
    group.add(tummy);
    return charWrap(group, 0.95);
  }

  function buildDuck() {
    const yellow = new THREE.MeshLambertMaterial({ color: 0xffe14f });
    const orange = new THREE.MeshLambertMaterial({ color: 0xff9a3a });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 11), yellow);
    body.scale.set(1, 0.95, 1.1); body.position.y = 0.68;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Group(); head.position.y = 1.62;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 11), yellow);
    skull.castShadow = true; head.add(skull);
    addFace(head, 0.45, { eyeY: 0.12 });
    const beak = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), orange);
    beak.scale.set(1.4, 0.55, 1.1); beak.position.set(0, -0.06, 0.44);
    head.add(beak);
    // tiny feather sprout on top
    const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), yellow);
    sprout.scale.set(0.6, 1.6, 0.6); sprout.position.y = 0.5;
    head.add(sprout);
    group.add(head);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), yellow);
      wing.scale.set(0.5, 1, 1.4); wing.position.set(0.55 * side, 0.7, -0.05);
      group.add(wing);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), orange);
      foot.scale.set(1.3, 0.4, 1.7); foot.position.set(0.2 * side, 0.07, 0.1);
      group.add(foot);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), yellow);
    tail.scale.set(0.8, 0.8, 1.3); tail.position.set(0, 0.75, -0.62);
    tail.rotation.x = -0.5;
    group.add(tail);
    return charWrap(group, 0.85);
  }

  function buildPig() {
    const pig = new THREE.MeshLambertMaterial({ color: 0xffb3c8 });
    const snoutM = new THREE.MeshLambertMaterial({ color: 0xff8fae });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 11), pig);
    body.scale.set(1.05, 1, 1); body.position.y = 0.78;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Group(); head.position.y = 1.8;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 11), pig);
    skull.castShadow = true; head.add(skull);
    addFace(head, 0.52, { eyeY: 0.18 });
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), snoutM);
    snout.scale.set(1.2, 0.9, 0.7); snout.position.set(0, -0.04, 0.5);
    head.add(snout);
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), eyeMat);
      nostril.position.set(0.07 * side, -0.03, 0.65); head.add(nostril);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), pig);
      ear.position.set(0.3 * side, 0.5, 0.05); ear.rotation.z = -0.35 * side;
      head.add(ear);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.5, 8), pig);
      leg.position.set(0.3 * side, 0.22, 0.12); group.add(leg);
    }
    group.add(head);
    // curly tail
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 10, Math.PI * 1.6), snoutM);
    tail.position.set(0, 0.85, -0.68); group.add(tail);
    return charWrap(group, 0.95);
  }

  // wrap a friend model with its bob/hop animation.
  // The outer group carries the world position; the inner one
  // is bobbed by the animation so the two never conflict.
  function charWrap(group, scale) {
    group.scale.setScalar(scale);
    const outer = new THREE.Group();
    outer.add(group);
    const inner = group;
    function animate(t, state) {
      if (state === "follow") {
        // happy little hops while following the parade
        const f = t * 8;
        inner.position.y = Math.abs(Math.sin(f)) * 0.35;
        inner.rotation.z = Math.sin(f) * 0.06;
      } else {
        // idle bounce + looking around
        inner.position.y = Math.abs(Math.sin(t * 2.4)) * 0.12;
        inner.rotation.z = 0;
        inner.rotation.y = Math.sin(t * 0.6) * 0.3;
      }
    }
    return { group: outer, animate };
  }

  // friend roster: name, emoji (HUD), builder, home spot
  Characters.FRIENDS = [
    { name: "くまくん",   emoji: "🐻", build: buildBear,    x: -20, z: -6 },
    { name: "ぺんちゃん", emoji: "🐧", build: buildPenguin, x: 8,   z: 74 },
    { name: "にゃんた",   emoji: "🐱", build: buildCat,     x: 52,  z: 8  },
    { name: "ぴよちゃん", emoji: "🐤", build: buildDuck,    x: -32, z: 58 },
    { name: "ぶーこ",     emoji: "🐷", build: buildPig,     x: 74,  z: -58, floatIsland: true },
  ];

})(window.KIRA);
