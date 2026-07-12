/* ============================================================
   nature.js — everything that grows, flutters and swims.
   * Storybook trees (with gentle wind sway) + cherry-blossom
     trees that shed petals
   * Hundreds of instanced flowers & grass tufts
   * Butterflies with flapping wings, circling birds,
     and fish that leap out of the sea in sparkling arcs
   ============================================================ */

(function (K) {
  "use strict";

  const Nature = {};
  K.Nature = Nature;

  const swayTrees = [];   // {leaves, phase}
  const butterflies = []; // {grp, wingL, wingR, angle, speed, cx, cz, r, h, phase}
  const birds = [];
  const fishes = [];
  Nature.sakuraTrees = []; // positions, used by effects.js for petals

  // is this a good place for plants? (grassy, on the island, not in water)
  function grassy(x, z) {
    const h = K.groundHeight(x, z);
    if (h < 2.2 || h > 13) return false;
    // keep the plaza and carousel clear-ish
    if (Math.hypot(x - 4, z - 30) < 6) return false;
    if (Math.hypot(x - 18, z - 34) < 8.5) return false;
    return true;
  }

  Nature.init = function (scene) {
    buildTrees(scene);
    buildFlowers(scene);
    buildGrass(scene);
    buildButterflies(scene);
    buildBirds(scene);
    buildFishes(scene);
  };

  // ------------------------------------------------------------
  // trees
  // ------------------------------------------------------------
  function buildTrees(scene) {
    const trunkMat = new THREE.MeshLambertMaterial({ color: K.PAL.trunk });
    const leafMats = [
      new THREE.MeshLambertMaterial({ color: K.PAL.leaf1 }),
      new THREE.MeshLambertMaterial({ color: K.PAL.leaf2 }),
    ];
    const pinkMats = [
      new THREE.MeshLambertMaterial({ color: K.PAL.leafPink }),
      new THREE.MeshLambertMaterial({ color: K.PAL.leafPink2 }),
    ];

    // scatter normal trees (keep a wide clearing around the spawn
    // plaza so the camera never starts inside a canopy)
    let placed = 0, guard = 0;
    while (placed < 42 && guard++ < 800) {
      const x = K.rand(-85, 85), z = K.rand(-85, 85);
      if (!grassy(x, z)) continue;
      if (Math.hypot(x - 4, z - 30) < 14) continue;
      addTree(scene, x, z, trunkMat, leafMats, false);
      placed++;
    }

    // special cherry-blossom trees at picturesque spots
    const sakuraSpots = [
      [-4, 18],                       // near the plaza
      [30, -34],                      // east meadow
      [K.Island.FLOAT.x, K.Island.FLOAT.z, K.Island.FLOAT.y], // floating island!
    ];
    for (const [x, z, forceY] of sakuraSpots) {
      addTree(scene, x, z, trunkMat, pinkMats, true, forceY);
    }
  }

  function addTree(scene, x, z, trunkMat, mats, isSakura, forceY) {
    const y = forceY !== undefined ? forceY : K.groundHeight(x, z);
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const s = isSakura ? K.rand(1.25, 1.5) : K.rand(0.75, 1.25);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 3.4 * s, 8), trunkMat);
    trunk.position.y = 1.7 * s;
    trunk.castShadow = true;
    grp.add(trunk);

    const leaves = new THREE.Group();
    const blobs = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < blobs; i++) {
      const r = K.rand(1.5, 2.4) * s;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), K.pick(mats));
      blob.position.set(
        K.rand(-1.1, 1.1) * s,
        3.4 * s + K.rand(0.4, 2.0) * s,
        K.rand(-1.1, 1.1) * s
      );
      blob.castShadow = true;
      leaves.add(blob);
    }
    grp.add(leaves);
    scene.add(grp);
    swayTrees.push({ leaves, phase: Math.random() * Math.PI * 2 });

    if (isSakura) {
      Nature.sakuraTrees.push({ x, y: y + 5 * s, z, r: 2.6 * s });
    }
  }

  // ------------------------------------------------------------
  // flowers (instanced)
  // ------------------------------------------------------------
  function buildFlowers(scene) {
    const COUNT = 420;
    const headGeo = new THREE.SphereGeometry(0.28, 6, 5);
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 4);
    const heads = new THREE.InstancedMesh(
      headGeo,
      new THREE.MeshLambertMaterial({ emissiveIntensity: 0.25 }),
      COUNT
    );
    const stems = new THREE.InstancedMesh(
      stemGeo,
      new THREE.MeshLambertMaterial({ color: 0x3f9e4d }),
      COUNT
    );
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let i = 0, guard = 0;
    while (i < COUNT && guard++ < 6000) {
      const x = K.rand(-85, 85), z = K.rand(-85, 85);
      if (!grassy(x, z)) continue;
      const y = K.groundHeight(x, z);
      const sc = K.rand(0.8, 1.5);
      m.makeScale(sc, sc, sc);
      m.setPosition(x, y + 0.75 * sc, z);
      heads.setMatrixAt(i, m);
      c.setHex(K.pick(K.PAL.flowerCols));
      heads.setColorAt(i, c);
      m.makeScale(1, sc, 1);
      m.setPosition(x, y + 0.35 * sc, z);
      stems.setMatrixAt(i, m);
      i++;
    }
    heads.count = i; stems.count = i;
    heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    scene.add(heads); scene.add(stems);
  }

  // ------------------------------------------------------------
  // grass tufts (instanced cones)
  // ------------------------------------------------------------
  function buildGrass(scene) {
    const COUNT = 700;
    const geo = new THREE.ConeGeometry(0.22, 1.0, 4);
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshLambertMaterial({ color: 0x59c968 }),
      COUNT
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    let i = 0, guard = 0;
    while (i < COUNT && guard++ < 8000) {
      const x = K.rand(-88, 88), z = K.rand(-88, 88);
      if (!grassy(x, z)) continue;
      const y = K.groundHeight(x, z);
      const sc = K.rand(0.7, 1.6);
      e.set(K.rand(-0.15, 0.15), K.rand(0, Math.PI), K.rand(-0.15, 0.15));
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(x, y + 0.5 * sc, z),
        q,
        new THREE.Vector3(sc, sc, sc)
      );
      mesh.setMatrixAt(i, m);
      c.setHSL(0.32 + Math.random() * 0.06, 0.62, 0.42 + Math.random() * 0.18);
      mesh.setColorAt(i, c);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }

  // ------------------------------------------------------------
  // butterflies
  // ------------------------------------------------------------
  function buildButterflies(scene) {
    const wingGeo = new THREE.CircleGeometry(0.45, 6);
    for (let i = 0; i < 14; i++) {
      const col = K.pick(K.PAL.flowerCols);
      const mat = new THREE.MeshBasicMaterial({
        color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
      });
      const grp = new THREE.Group();
      const wingL = new THREE.Mesh(wingGeo, mat);
      const wingR = new THREE.Mesh(wingGeo, mat);
      wingL.position.x = -0.3; wingR.position.x = 0.3;
      grp.add(wingL); grp.add(wingR);

      const cx = K.rand(-60, 60), cz = K.rand(-60, 60);
      butterflies.push({
        grp, wingL, wingR,
        angle: Math.random() * Math.PI * 2,
        speed: K.rand(0.4, 0.9),
        cx, cz,
        r: K.rand(4, 14),
        h: K.rand(1.5, 4),
        phase: Math.random() * 10,
      });
      scene.add(grp);
    }
  }

  // ------------------------------------------------------------
  // birds — soft silhouettes circling high above
  // ------------------------------------------------------------
  function buildBirds(scene) {
    for (let i = 0; i < 6; i++) {
      const grp = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat);
      body.scale.set(1.6, 0.7, 0.7);
      grp.add(body);
      const wGeo = new THREE.PlaneGeometry(2.4, 0.7);
      const wingL = new THREE.Mesh(wGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, side: THREE.DoubleSide }));
      wingL.position.set(0, 0.2, -1.1);
      const wingR = wingL.clone();
      wingR.position.z = 1.1;
      grp.add(wingL); grp.add(wingR);
      birds.push({
        grp, wingL, wingR,
        angle: Math.random() * Math.PI * 2,
        speed: K.rand(0.08, 0.16) * (Math.random() > 0.5 ? 1 : -1),
        r: K.rand(40, 90),
        h: K.rand(30, 55),
        phase: Math.random() * 10,
      });
      scene.add(grp);
    }
  }

  // ------------------------------------------------------------
  // leaping fish
  // ------------------------------------------------------------
  function buildFishes(scene) {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x6fd0ff, emissive: 0x1f5f8f, emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 5; i++) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), mat);
      body.scale.set(1.6, 0.8, 0.7);
      grp.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 6), mat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -1.1;
      grp.add(tail);
      grp.visible = false;
      scene.add(grp);
      fishes.push({ grp, t: K.rand(-8, 0), x: 0, z: 0, dir: 0 });
    }
  }

  // ------------------------------------------------------------
  Nature.update = function (t, dt) {
    // trees swaying in the breeze
    for (const tr of swayTrees) {
      tr.leaves.rotation.z = Math.sin(t * 1.1 + tr.phase) * 0.035;
      tr.leaves.rotation.x = Math.cos(t * 0.9 + tr.phase) * 0.03;
    }

    // butterflies flutter along circles, wings flapping fast
    for (const b of butterflies) {
      b.angle += b.speed * dt;
      const x = b.cx + Math.cos(b.angle) * b.r;
      const z = b.cz + Math.sin(b.angle) * b.r;
      const groundY = Math.max(K.groundHeight(x, z), 0);
      const y = groundY + b.h + Math.sin(t * 2 + b.phase) * 0.8;
      b.grp.position.set(x, y, z);
      b.grp.rotation.y = -b.angle;
      const flap = Math.sin(t * 18 + b.phase) * 1.05;
      b.wingL.rotation.y = flap;
      b.wingR.rotation.y = -flap;
    }

    // birds circle lazily
    for (const b of birds) {
      b.angle += b.speed * dt;
      b.grp.position.set(
        Math.cos(b.angle) * b.r,
        b.h + Math.sin(t * 0.7 + b.phase) * 3,
        Math.sin(b.angle) * b.r
      );
      b.grp.rotation.y = -b.angle - Math.PI / 2 * Math.sign(b.speed);
      const flap = Math.sin(t * 6 + b.phase) * 0.5;
      b.wingL.rotation.x = flap;
      b.wingR.rotation.x = -flap;
    }

    // fish leap in shining arcs just offshore
    for (const f of fishes) {
      f.t += dt;
      if (f.t > 2.2) {
        // rest underwater, then pick a new leap spot
        f.grp.visible = false;
        if (f.t > K.rand(4, 10)) {
          const a = Math.random() * Math.PI * 2;
          const r = K.rand(100, 130);
          f.x = Math.cos(a) * r; f.z = Math.sin(a) * r;
          f.dir = Math.random() * Math.PI * 2;
          f.t = 0;
        }
      } else {
        const p = f.t / 2.2; // 0..1 across the leap
        const y = Math.sin(p * Math.PI) * 4.5 - 0.5;
        const fwd = (p - 0.5) * 7;
        f.grp.visible = y > 0;
        f.grp.position.set(
          f.x + Math.cos(f.dir) * fwd,
          y,
          f.z + Math.sin(f.dir) * fwd
        );
        f.grp.rotation.y = -f.dir;
        f.grp.rotation.z = (0.5 - p) * 1.8;
      }
    }
  };

})(window.KIRA);
