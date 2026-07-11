/* ============================================================
   island.js — 島の地形と風景
   すなはま / くさはら / ヤシのき / いえ(えんがわ+ふうりん) /
   さんばし(ちょうちん+かざぐるま) / とりい / とうだい / ボート
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  /* パステルなラムバート材質を作る小道具 */
  function mat(color, opts = {}) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
  }

  G.createIsland = function (scene) {
    const island = {};
    const dynamic = []; // update対象

    /* ============ 地形 ============ */
    (function terrain() {
      const size = 200, seg = 150;
      const geo = new THREE.PlaneGeometry(size, size, seg, seg);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const cSand = new THREE.Color(0xf4e3b1);
      const cSandWet = new THREE.Color(0xd8bf8a);
      const cGrass1 = new THREE.Color(0x8fce5e);
      const cGrass2 = new THREE.Color(0x4fa84f);
      const cRock = new THREE.Color(0xb8b0a0);
      const cSea = new THREE.Color(0x9ab98a);
      const tmp = new THREE.Color();

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const h = G.islandHeight(x, z);
        pos.setY(i, h);

        // 高さで色分け＋ちょっとしたむら
        const jitter = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
        const j = (jitter - Math.floor(jitter)) * 0.07;
        if (h < -0.1) tmp.copy(cSandWet).lerp(cSea, G.clamp(-h / 3, 0, 1));
        else if (h < 0.55) tmp.copy(cSandWet).lerp(cSand, G.smoothstep(-0.1, 0.55, h));
        else if (h < 1.5) tmp.copy(cSand);
        else if (h < 2.6) tmp.copy(cSand).lerp(cGrass1, G.smoothstep(1.5, 2.6, h));
        else if (h < 6.2) tmp.copy(cGrass1).lerp(cGrass2, G.smoothstep(2.6, 6.2, h));
        else tmp.copy(cGrass2).lerp(cRock, G.smoothstep(6.8, 9.5, h));
        tmp.offsetHSL(0, 0, j - 0.035);
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();

      const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
      ground.receiveShadow = true;
      scene.add(ground);
    })();

    /* ============ ヤシのき ============ */
    function palmFrondGeometry() {
      // 中央からたれ下がる葉。三角形ストリップで作る
      const segs = 7, len = 3.2, width = 0.62;
      const verts = [], idx = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = t * len;
        const droop = -1.7 * t * t;
        const w = width * Math.sin(Math.PI * Math.min(t * 1.15, 1)) + 0.03;
        verts.push(x, droop, -w, x, droop + 0.06, 0, x, droop, w);
      }
      for (let i = 0; i < segs; i++) {
        const a = i * 3;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
        idx.push(a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }
    const frondGeo = palmFrondGeometry();

    function palmTree(x, z, scale = 1, lean = 0.22) {
      const g = new THREE.Group();
      const h = G.islandHeight(x, z);
      // みき：すこし曲がる
      const trunkSegs = 5;
      const trunkMat = mat(0x9a6a42);
      let px = 0, py = 0, angle = lean;
      for (let i = 0; i < trunkSegs; i++) {
        const segH = 1.05 * scale;
        const r = (0.28 - i * 0.03) * scale;
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, segH, 7), trunkMat);
        angle *= 0.72;
        px += Math.sin(angle) * segH;
        py += Math.cos(angle) * segH;
        seg.position.set(px, py - segH / 2, 0);
        seg.rotation.z = -angle;
        seg.castShadow = true;
        g.add(seg);
      }
      // 葉
      const leafMat = mat(0x3e9e4e, { side: THREE.DoubleSide });
      const leafMat2 = mat(0x55b85e, { side: THREE.DoubleSide });
      const crown = new THREE.Group();
      const n = 7;
      for (let i = 0; i < n; i++) {
        const leaf = new THREE.Mesh(frondGeo, i % 2 ? leafMat : leafMat2);
        leaf.rotation.y = (i / n) * Math.PI * 2 + G.rand(-0.2, 0.2);
        leaf.rotation.z = G.rand(-0.15, 0.2);
        leaf.scale.setScalar(scale * G.rand(0.85, 1.1));
        leaf.castShadow = true;
        crown.add(leaf);
      }
      crown.position.set(px, py, 0);
      g.add(crown);
      // ココナッツ
      const nutMat = mat(0x7a5a34);
      for (let i = 0; i < 3; i++) {
        const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 8, 6), nutMat);
        nut.position.set(px + G.rand(-0.25, 0.25), py - 0.18, G.rand(-0.25, 0.25));
        g.add(nut);
      }
      g.position.set(x, h - 0.1, z);
      g.rotation.y = G.rand(0, Math.PI * 2);
      scene.add(g);
      dynamic.push({
        obj: crown, kind: 'sway',
        phase: G.rand(0, 6), amp: G.rand(0.02, 0.045),
      });
      return g;
    }

    // ビーチ沿いにヤシのき
    palmTree(16, 30, 1.15); palmTree(-4, 31, 1.0, -0.25);
    palmTree(-14, 27, 1.25); palmTree(24, 20, 0.95);
    palmTree(-24, 20, 1.1, -0.3); palmTree(28, 8, 1.0);

    /* ============ まるいき（ひろばのき） ============ */
    function leafyTree(x, z, scale = 1) {
      const g = new THREE.Group();
      const h = G.islandHeight(x, z);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32 * scale, 0.45 * scale, 2.6 * scale, 7),
        mat(0x8a5a36)
      );
      trunk.position.y = 1.3 * scale;
      trunk.castShadow = true;
      g.add(trunk);
      const leafMats = [mat(0x3f9e4a), mat(0x54b356), mat(0x2f8e44)];
      const blobs = [
        [0, 3.2, 0, 1.5], [1.0, 2.7, 0.3, 1.05], [-1.0, 2.8, -0.2, 1.0],
        [0.2, 2.6, 1.0, 0.95], [-0.3, 2.7, -1.0, 0.9], [0, 4.0, 0, 1.0],
      ];
      blobs.forEach((b, i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(b[3] * scale, 10, 8), leafMats[i % 3]);
        s.position.set(b[0] * scale, b[1] * scale, b[2] * scale);
        s.castShadow = true;
        g.add(s);
      });
      g.position.set(x, h - 0.05, z);
      scene.add(g);
      return g;
    }
    // かぶとむしのいる大きな木（activities から参照）
    island.beetleTree = leafyTree(14, 4, 1.6);
    leafyTree(-4, -6, 1.2);
    leafyTree(22, -14, 1.0);
    leafyTree(-26, 2, 1.1);
    leafyTree(4, -22, 1.3);

    /* ============ ひまわりばたけ ============ */
    const sunflowerHeads = [];
    function sunflower(x, z) {
      const g = new THREE.Group();
      const h = G.islandHeight(x, z);
      const stemH = G.rand(1.5, 2.1);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, stemH, 6), mat(0x3f8e3a));
      stem.position.y = stemH / 2;
      g.add(stem);
      // は
      for (let i = 0; i < 2; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), mat(0x4aa040));
        leaf.scale.set(1.4, 0.25, 0.8);
        leaf.position.set(i ? 0.25 : -0.25, stemH * G.rand(0.4, 0.6), 0);
        leaf.rotation.z = i ? -0.5 : 0.5;
        g.add(leaf);
      }
      // あたま
      const head = new THREE.Group();
      const center = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), mat(0x6a4a22));
      center.rotation.x = Math.PI / 2;
      head.add(center);
      const petalMat = mat(0xffc226);
      for (let i = 0; i < 12; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), petalMat);
        petal.scale.set(1.9, 0.7, 0.3);
        const a = (i / 12) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0);
        petal.rotation.z = a;
        head.add(petal);
      }
      head.position.y = stemH + 0.1;
      g.add(head);
      sunflowerHeads.push(head);
      g.position.set(x, h - 0.03, z);
      g.rotation.y = G.rand(-0.3, 0.3);
      scene.add(g);
    }
    for (let i = 0; i < 14; i++) {
      sunflower(G.rand(-20, -9), G.rand(12, 20));
    }

    /* ============ くさ と はな（インスタンス） ============ */
    (function grassAndFlowers() {
      // くさ：ほそい円すいを散らす
      const grassGeo = new THREE.ConeGeometry(0.07, 0.75, 4);
      grassGeo.translate(0, 0.3, 0);
      const grassMesh = new THREE.InstancedMesh(grassGeo, mat(0x5cb554), 300);
      const dummy = new THREE.Object3D();
      let placed = 0, guard = 0;
      while (placed < 300 && guard++ < 3000) {
        const x = G.rand(-38, 38), z = G.rand(-38, 30);
        const h = G.islandHeight(x, z);
        if (h < 1.8 || h > 8.5) continue;
        dummy.position.set(x, h - 0.05, z);
        dummy.rotation.set(G.rand(-0.15, 0.15), G.rand(0, 6.28), G.rand(-0.15, 0.15));
        dummy.scale.setScalar(G.rand(0.7, 1.6));
        dummy.updateMatrix();
        grassMesh.setMatrixAt(placed++, dummy.matrix);
      }
      grassMesh.count = placed;
      scene.add(grassMesh);

      // はな：ちいさな色つきの点々
      const flowerGeo = new THREE.SphereGeometry(0.09, 6, 5);
      flowerGeo.translate(0, 0.35, 0);
      const flowerMesh = new THREE.InstancedMesh(
        flowerGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 90);
      const fcol = new THREE.Color();
      const palette = [0xff6a8a, 0xffffff, 0xffd54a, 0xc98af5, 0xff9a4a];
      placed = 0; guard = 0;
      while (placed < 90 && guard++ < 1500) {
        const x = G.rand(-34, 34), z = G.rand(-34, 28);
        const h = G.islandHeight(x, z);
        if (h < 1.9 || h > 7.5) continue;
        dummy.position.set(x, h - 0.02, z);
        dummy.rotation.y = G.rand(0, 6.28);
        dummy.scale.setScalar(G.rand(0.8, 1.3));
        dummy.updateMatrix();
        flowerMesh.setMatrixAt(placed, dummy.matrix);
        fcol.set(G.pick(palette));
        flowerMesh.setColorAt(placed, fcol);
        placed++;
      }
      flowerMesh.count = placed;
      scene.add(flowerMesh);
    })();

    /* ============ いえ（えんがわ + ふうりん） ============ */
    const furinGroup = new THREE.Group();
    (function house() {
      const g = new THREE.Group();
      const x = -13, z = 5;
      const h = G.islandHeight(x, z);

      const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.0, 4.6), mat(0xf7f0dc));
      body.position.y = 1.5;
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);

      // やね（かわら屋根っぽいオレンジの角すい台）
      const roofGeo = new THREE.CylinderGeometry(0.4, 5.2, 2.1, 4);
      const roof = new THREE.Mesh(roofGeo, mat(0xe0703a));
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.78;
      roof.position.y = 4.0;
      roof.castShadow = true;
      g.add(roof);

      // とびら・まど
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.12), mat(0x8a5a36));
      door.position.set(0.6, 0.95, 2.33);
      g.add(door);
      const winMat = mat(0x9adcf0, { emissive: 0x9adcf0, emissiveIntensity: 0.0 });
      const win1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.12), winMat);
      win1.position.set(-1.6, 1.7, 2.33);
      g.add(win1);
      const win2 = win1.clone();
      win2.position.set(2.1, 1.7, -2.33);
      g.add(win2);
      island.windowMat = winMat;

      // えんがわ
      const porch = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.28, 1.7), mat(0xb98a58));
      porch.position.set(0, 0.5, 3.2);
      porch.castShadow = true; porch.receiveShadow = true;
      g.add(porch);
      // えんがわの柱とひさし
      const eaveMat = mat(0xa87848);
      for (const px of [-3.1, 3.1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 6), eaveMat);
        pillar.position.set(px, 1.7, 3.85);
        g.add(pillar);
      }
      const eave = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.14, 1.9), mat(0xe0703a));
      eave.position.set(0, 2.95, 3.3);
      eave.castShadow = true;
      g.add(eave);

      // ふうりん（えんがわのひさしに）
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 10),
        new THREE.MeshPhongMaterial({ color: 0xaee4f0, shininess: 90, transparent: true, opacity: 0.85 }));
      bell.position.y = -0.12;
      const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), mat(0xdd4444));
      clapper.position.y = -0.26;
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.42),
        mat(0xfff2f8, { side: THREE.DoubleSide }));
      paper.position.y = -0.5;
      furinGroup.add(bell, clapper, paper);
      furinGroup.position.set(1.8, 2.88, 3.9);
      g.add(furinGroup);

      g.position.set(x, h - 0.15, z);
      g.rotation.y = 0.25;
      scene.add(g);
    })();

    /* ============ さんばし ============ */
    const lanternMats = [];
    (function pier() {
      const P = G.PIER;
      const g = new THREE.Group();
      const deckMat = mat(0xc09565);
      const postMat = mat(0x8a6a44);

      // 板を1枚ずつ（すこし色むら）
      const plankCount = Math.floor((P.zEnd - P.zStart) / 0.85);
      for (let i = 0; i < plankCount; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(P.halfW * 2, 0.14, 0.72), deckMat.clone());
        plank.material.color.offsetHSL(0, 0, G.rand(-0.04, 0.04));
        plank.position.set(P.x, P.deckY - 0.07, P.zStart + 0.45 + i * 0.85);
        plank.castShadow = true; plank.receiveShadow = true;
        g.add(plank);
      }
      // くい
      for (let z = P.zStart + 1; z <= P.zEnd; z += 4) {
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.4, 7), postMat);
          post.position.set(P.x + side * (P.halfW - 0.1), P.deckY - 1.6, z);
          post.castShadow = true;
          g.add(post);
          // ちょうちん（1本おき）
          if ((Math.round(z) % 8) < 4) {
            const lm = new THREE.MeshLambertMaterial({
              color: 0xffd9a0, emissive: 0xff8c30, emissiveIntensity: 0,
            });
            const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), lm);
            lantern.scale.y = 1.25;
            lantern.position.set(P.x + side * (P.halfW - 0.1), P.deckY + 1.35, z);
            g.add(lantern);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.1, 8), mat(0x333333));
            cap.position.copy(lantern.position).y += 0.4;
            g.add(cap);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), postMat);
            pole.position.set(lantern.position.x, P.deckY + 0.7, z);
            g.add(pole);
            lanternMats.push(lm);
          }
        }
      }
      scene.add(g);

      // かざぐるま（さんばし入口）
      for (const side of [-1, 1]) {
        const pin = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5), mat(0xeeeeee));
        stick.position.y = 0.5;
        pin.add(stick);
        const wheel = new THREE.Group();
        const cols = [0xff5f8a, 0xffc226, 0x3fb6f2, 0x4fc06a];
        for (let i = 0; i < 4; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 3), mat(cols[i], { side: THREE.DoubleSide }));
          blade.position.set(Math.cos(i * Math.PI / 2) * 0.22, Math.sin(i * Math.PI / 2) * 0.22, 0);
          blade.rotation.z = i * Math.PI / 2 - Math.PI / 2;
          wheel.add(blade);
        }
        wheel.position.y = 1.0;
        pin.add(wheel);
        const hx = G.PIER.x + side * (G.PIER.halfW + 0.4);
        const hz = G.PIER.zStart + 0.4;
        pin.position.set(hx, G.islandHeight(hx, hz), hz);
        scene.add(pin);
        dynamic.push({ obj: wheel, kind: 'pinwheel', speed: G.rand(2.5, 4) * side });
      }
    })();
    island.lanternMats = lanternMats;

    /* ============ とりい（おかのうえ） ============ */
    (function torii() {
      const g = new THREE.Group();
      const red = mat(0xd8452e);
      const x = -15, z = -17;
      const h = G.islandHeight(x, z);
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.6, 8), red);
        pillar.position.set(side * 1.5, 1.8, 0);
        pillar.castShadow = true;
        g.add(pillar);
      }
      const beam1 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.34, 0.4), red);
      beam1.position.y = 3.75;
      beam1.castShadow = true;
      g.add(beam1);
      const beam1b = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.2, 0.44), mat(0x333333));
      beam1b.position.y = 3.98;
      g.add(beam1b);
      const beam2 = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.26, 0.3), red);
      beam2.position.y = 2.95;
      g.add(beam2);
      g.position.set(x, h - 0.1, z);
      g.rotation.y = 0.6;
      scene.add(g);

      // いしどうろう
      for (const off of [[-2.6, 1.2], [2.6, 1.2]]) {
        const s = new THREE.Group();
        const stone = mat(0xb0aca0);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5, 6), stone);
        base.position.y = 0.25;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.8, 6), stone);
        pole.position.y = 0.9;
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), stone);
        box.position.y = 1.5;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.35, 6), stone);
        cap.position.y = 1.88;
        s.add(base, pole, box, cap);
        const sx = x + off[0], sz = z + off[1];
        s.position.set(sx, G.islandHeight(sx, sz) - 0.05, sz);
        s.children.forEach(c => c.castShadow = true);
        scene.add(s);
      }
    })();

    /* ============ とうだい（ひがしのみさき） ============ */
    let beaconPivot = null, beaconMat = null;
    (function lighthouse() {
      const g = new THREE.Group();
      const x = 28, z = -8;
      const h = G.islandHeight(x, z);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 6.0, 12), mat(0xfafafa));
      body.position.y = 3.0;
      body.castShadow = true;
      g.add(body);
      // 赤いストライプ
      for (const y of [1.4, 3.6]) {
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.42 - y * 0.085, 1.45 - y * 0.085, 0.7, 12), mat(0xe04040));
        stripe.position.y = y;
        g.add(stripe);
      }
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 8),
        new THREE.MeshPhongMaterial({ color: 0xfff2b8, emissive: 0xffe08a, emissiveIntensity: 0.15 }));
      cage.position.y = 6.4;
      g.add(cage);
      beaconMat = cage.material;
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.7, 10), mat(0xe04040));
      top.position.y = 7.2;
      top.castShadow = true;
      g.add(top);
      // ひかりのビーム（よる）
      beaconPivot = new THREE.Group();
      const beamGeo = new THREE.ConeGeometry(2.6, 26, 12, 1, true);
      beamGeo.rotateZ(Math.PI / 2);
      beamGeo.translate(13.5, 0, 0);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfff0b0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beaconPivot.add(beam);
      beaconPivot.position.y = 6.4;
      g.add(beaconPivot);
      island.beamMat = beamMat;

      g.position.set(x, h - 0.2, z);
      scene.add(g);
    })();

    /* ============ ボート ============ */
    (function boat() {
      const g = new THREE.Group();
      const x = -21, z = 36;
      const hullMat = mat(0x4a8ac0);
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.62, 3.6, 8, 1), hullMat);
      hull.rotation.z = Math.PI / 2;
      hull.scale.set(1, 1, 0.55);
      hull.castShadow = true;
      g.add(hull);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 3.3, 8, 1), mat(0xd8b888));
      inner.rotation.z = Math.PI / 2;
      inner.scale.set(1, 1, 0.5);
      inner.position.y = 0.16;
      g.add(inner);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.1), mat(0xb08858));
      bench.position.y = 0.42;
      g.add(bench);
      g.position.set(x, G.islandHeight(x, z) + 0.4, z);
      g.rotation.set(0.06, 0.8, 0.1);
      scene.add(g);
    })();

    /* ============ いわ ============ */
    (function rocks() {
      const rockMat = mat(0x9a968c);
      const spots = [
        [30, 26, 1.2], [-30, 28, 0.9], [-27, -22, 1.4], [20, -26, 1.0],
        [33, 4, 0.8], [-33, 12, 1.0], [8, 44, 0.55], [-9, 43, 0.5],
      ];
      for (const [x, z, s] of spots) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
        rock.position.set(x, G.islandHeight(x, z) + s * 0.3, z);
        rock.rotation.set(G.rand(0, 3), G.rand(0, 3), G.rand(0, 3));
        rock.scale.y = 0.7;
        rock.castShadow = true; rock.receiveShadow = true;
        scene.add(rock);
      }
    })();

    /* ============ うみのそこ の さんご・かいそう ============ */
    (function seabedDeco() {
      const spots = [[12, 52], [-2, 50], [20, 48], [-14, 48], [2, 56]];
      const corals = [0xff8a6a, 0xff6a9a, 0xc98af5];
      for (const [x, z] of spots) {
        const h = G.islandHeight(x, z);
        if (h > -0.4) continue;
        const c = new THREE.Mesh(
          new THREE.SphereGeometry(G.rand(0.3, 0.55), 7, 6),
          mat(G.pick(corals))
        );
        c.position.set(x, h + 0.2, z);
        c.scale.y = G.rand(0.9, 1.6);
        scene.add(c);
      }
    })();

    /* ============ 更新 ============ */
    let furinTimer = G.rand(4, 9);
    island.update = function (dt, elapsed) {
      // 木々のゆれ・かざぐるま
      for (const d of dynamic) {
        if (d.kind === 'sway') {
          d.obj.rotation.x = Math.sin(elapsed * 0.9 + d.phase) * d.amp;
          d.obj.rotation.z = Math.cos(elapsed * 0.7 + d.phase) * d.amp;
        } else if (d.kind === 'pinwheel') {
          d.obj.rotation.z += d.speed * dt;
        }
      }
      // ふうりん
      furinGroup.rotation.x = Math.sin(elapsed * 1.4) * 0.1;
      furinGroup.rotation.z = Math.cos(elapsed * 1.1) * 0.12;
      furinTimer -= dt;
      if (furinTimer <= 0) {
        furinTimer = G.rand(5, 14);
        if (G.audio.ready) G.audio.furin();
      }
      // ひまわりはお日さまの方へ
      const sunAz = Math.atan2(G.env.sunDir.x, G.env.sunDir.z);
      for (const head of sunflowerHeads) {
        const target = G.env.nightGlow > 0.5 ? 0 : sunAz;
        head.rotation.y = G.damp(head.rotation.y, target * 0.5, 1.2, dt);
        head.rotation.x = -0.25;
      }
      // よるのあかり
      const night = G.env.nightGlow;
      for (const lm of lanternMats) lm.emissiveIntensity = night * 1.6;
      if (island.windowMat) island.windowMat.emissiveIntensity = night * 0.9;
      if (beaconMat) beaconMat.emissiveIntensity = 0.15 + night * 1.4;
      if (beaconPivot) {
        beaconPivot.rotation.y = elapsed * 0.7;
        island.beamMat.opacity = night * 0.16;
      }
    };

    return island;
  };
})();
