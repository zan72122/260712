/* ============================================================
   island.js — the stage itself.
   * Painterly vertex-coloured terrain (beach → meadow →
     hills → rocky peak with a snowy cap)
   * A magical floating island in the sky, reached by a
     walkable rainbow bridge
   * Lighthouse with a rotating night beam
   * Waterfall pouring off the mountain into a pond
   * Bouncy mushroom trampolines
   * A slowly spinning carousel in the central plaza
   All walkable surfaces register into K.platforms so the
   physics in main.js can stand on them.
   ============================================================ */

(function (K) {
  "use strict";

  const Island = {};
  K.Island = Island;

  // platforms: objects with heightAt(x, z) -> y or null
  K.platforms = [];
  // bounce pads: {x, z, r, y}
  K.bouncePads = [];

  let lightBeam, carouselSpinner, waterfallMat;

  // highest platform surface at (x,z), or null
  K.platformHeight = function (x, z) {
    let best = null;
    for (const p of K.platforms) {
      const h = p.heightAt(x, z);
      if (h !== null && (best === null || h > best)) best = h;
    }
    return best;
  };

  Island.init = function (scene) {
    buildTerrain(scene);
    buildFloatingIsland(scene);
    buildRainbowBridge(scene);
    buildBigRainbow(scene);
    buildLighthouse(scene);
    buildWaterfall(scene);
    buildMushrooms(scene);
    buildCarousel(scene);
  };

  // ------------------------------------------------------------
  // terrain
  // ------------------------------------------------------------
  function buildTerrain(scene) {
    const SIZE = 320, SEG = 170;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const sand = new THREE.Color(K.PAL.sand);
    const sandWet = new THREE.Color(K.PAL.sandWet);
    const grass = new THREE.Color(K.PAL.grass);
    const grassDeep = new THREE.Color(K.PAL.grassDeep);
    const hill = new THREE.Color(K.PAL.hill);
    const rock = new THREE.Color(K.PAL.rock);
    const snow = new THREE.Color(K.PAL.snow);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = K.groundHeight(x, z);
      pos.setY(i, h);

      // paint by altitude with soft blends + speckle noise
      const n = K.noise.fbm(x * 0.15 + 5, z * 0.15 + 9);
      if (h < 0.6) {
        c.copy(sandWet).lerp(sand, K.clamp((h + 4) / 4.5, 0, 1));
      } else if (h < 2.4) {
        c.copy(sand).lerp(grass, K.clamp((h - 1.2) / 1.2, 0, 1));
      } else if (h < 9) {
        c.copy(grass).lerp(grassDeep, K.clamp((h - 2.4) / 6.6, 0, 1) * 0.8 + n * 0.2);
      } else if (h < 15) {
        c.copy(grassDeep).lerp(hill, K.clamp((h - 9) / 6, 0, 1));
      } else if (h < 20) {
        c.copy(hill).lerp(rock, K.clamp((h - 15) / 5, 0, 1));
      } else {
        c.copy(rock).lerp(snow, K.clamp((h - 20) / 4, 0, 1));
      }
      // painterly speckle
      const sp = (n - 0.5) * 0.09;
      colors[i * 3] = K.clamp(c.r + sp, 0, 1);
      colors[i * 3 + 1] = K.clamp(c.g + sp, 0, 1);
      colors[i * 3 + 2] = K.clamp(c.b + sp * 0.7, 0, 1);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ------------------------------------------------------------
  // floating island + rainbow bridge
  // ------------------------------------------------------------
  const FLOAT = { x: 74, y: 24, z: -58, r: 15 };
  Island.FLOAT = FLOAT;
  const BRIDGE = { x1: 46, z1: -26, x2: 62, z2: -46, w: 3.4 };

  function buildFloatingIsland(scene) {
    const grp = new THREE.Group();
    grp.position.set(FLOAT.x, FLOAT.y, FLOAT.z);

    // grassy top disc (self-lit a little so it never silhouettes black)
    const topGeo = new THREE.CylinderGeometry(FLOAT.r, FLOAT.r * 0.92, 1.6, 28);
    const top = new THREE.Mesh(topGeo,
      new THREE.MeshLambertMaterial({
        color: K.PAL.grass, emissive: 0x2a7a3a, emissiveIntensity: 0.3,
      }));
    top.position.y = -0.8;
    grp.add(top);

    // rocky cone underside hanging in the air
    const rockGeo = new THREE.ConeGeometry(FLOAT.r * 0.92, 14, 20);
    rockGeo.rotateX(Math.PI);
    const rockM = new THREE.Mesh(rockGeo,
      new THREE.MeshLambertMaterial({
        color: 0xb5a3d6, emissive: 0x584a80, emissiveIntensity: 0.4,
      }));
    rockM.position.y = -8.6;
    grp.add(rockM);

    // little waterfall of sparkles from the underside is added in effects.js
    scene.add(grp);
    Island.floatingGroup = grp;

    K.platforms.push({
      heightAt(x, z) {
        const dx = x - FLOAT.x, dz = z - FLOAT.z;
        if (dx * dx + dz * dz < FLOAT.r * FLOAT.r * 0.94) return FLOAT.y;
        return null;
      },
    });
  }

  function buildRainbowBridge(scene) {
    const h1 = K.groundHeight(BRIDGE.x1, BRIDGE.z1) + 0.1;
    const h2 = FLOAT.y;
    const { x1, z1, x2, z2, w } = BRIDGE;
    // continue past the island edge slightly so there's no gap
    const dirX = x2 - x1, dirZ = z2 - z1;
    const len = Math.hypot(dirX, dirZ);
    const ux = dirX / len, uz = dirZ / len;
    const ex = x2 + ux * 6, ez = z2 + uz * 6; // end tucked into the island
    const fullLen = Math.hypot(ex - x1, ez - z1);

    function bridgeY(t) {
      // rising arc with a happy little bump
      return h1 + (h2 - h1) * t + Math.sin(t * Math.PI) * 3.2;
    }

    // rainbow plank steps
    const stepCount = 26;
    const cols = [0xff5f6d, 0xffa14f, 0xffe14f, 0x6fe07a, 0x5fb0ff, 0xb98bff];
    for (let i = 0; i <= stepCount; i++) {
      const t = i / stepCount;
      const px = x1 + (ex - x1) * t;
      const pz = z1 + (ez - z1) * t;
      const py = bridgeY(t);
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.6, 0.5, fullLen / stepCount + 0.55),
        new THREE.MeshLambertMaterial({
          color: cols[i % cols.length],
          emissive: cols[i % cols.length],
          emissiveIntensity: 0.28,
        })
      );
      plank.position.set(px, py - 0.25, pz);
      // aim each plank along the path so the ramp reads smooth
      const tA = Math.min(t, 0.98), tB = tA + 0.02;
      plank.lookAt(
        px + (ex - x1) * (tB - tA),
        py - 0.25 + (bridgeY(tB) - bridgeY(tA)),
        pz + (ez - z1) * (tB - tA)
      );
      scene.add(plank);
    }

    // glowing hand-rail dots
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xfff8d0 });
    for (let i = 0; i <= stepCount; i += 2) {
      const t = i / stepCount;
      for (const side of [-1, 1]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), dotMat);
        dot.position.set(
          x1 + (ex - x1) * t - uz * side * (w / 2 + 0.5),
          bridgeY(t) + 0.35,
          z1 + (ez - z1) * t + ux * side * (w / 2 + 0.5)
        );
        scene.add(dot);
      }
    }

    // walkable surface
    K.platforms.push({
      heightAt(x, z) {
        const relX = x - x1, relZ = z - z1;
        const t = (relX * (ex - x1) + relZ * (ez - z1)) / (fullLen * fullLen);
        if (t < 0 || t > 1) return null;
        // perpendicular distance from bridge centreline
        const cx = x1 + (ex - x1) * t, cz = z1 + (ez - z1) * t;
        const d = Math.hypot(x - cx, z - cz);
        if (d > w / 2 + 0.5) return null;
        return bridgeY(t);
      },
    });
  }

  // big decorative rainbow over the mountain
  function buildBigRainbow(scene) {
    const cols = [0xff5f6d, 0xffa14f, 0xffe14f, 0x6fe07a, 0x5fb0ff, 0xb98bff];
    const grp = new THREE.Group();
    cols.forEach((col, i) => {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(34 - i * 1.7, 0.8, 8, 48, Math.PI),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.4, fog: true,
        })
      );
      grp.add(torus);
    });
    grp.position.set(-38, 14, -78);
    grp.rotation.y = 0.5;
    scene.add(grp);
  }

  // ------------------------------------------------------------
  // lighthouse on the south shore
  // ------------------------------------------------------------
  function buildLighthouse(scene) {
    const grp = new THREE.Group();
    const bx = -34, bz = 66;
    const by = Math.max(K.groundHeight(bx, bz), 0.4);
    grp.position.set(bx, by, bz);

    // striped tower
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4 - i * 0.28, 2.6 - i * 0.28, 2.6, 14),
        new THREE.MeshLambertMaterial({ color: i % 2 ? 0xffffff : 0xff5f6d })
      );
      seg.position.y = 1.3 + i * 2.6;
      grp.add(seg);
    }
    // lamp room
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 2, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8 })
    );
    lamp.position.y = 14.3;
    grp.add(lamp);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2, 2.2, 10),
      new THREE.MeshLambertMaterial({ color: 0x4a5f88 })
    );
    roof.position.y = 16.4;
    grp.add(roof);

    // rotating light beam (visible at night)
    const beamGeo = new THREE.CylinderGeometry(0.4, 5, 46, 12, 1, true);
    beamGeo.rotateZ(Math.PI / 2);
    beamGeo.translate(23, 0, 0);
    lightBeam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xfff6c0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    lightBeam.position.y = 14.3;
    grp.add(lightBeam);

    scene.add(grp);
  }

  // ------------------------------------------------------------
  // waterfall + pond on the mountain's flank
  // ------------------------------------------------------------
  function buildWaterfall(scene) {
    const topX = -25, topZ = -17;
    const topY = K.groundHeight(-28, -21) + 0.5;
    const botX = -22, botZ = -12;
    const botY = Math.max(K.groundHeight(botX, botZ), 0.5);
    Island.waterfall = { topX, topY, topZ, botX, botY, botZ };

    // shimmering falling sheet
    const h = topY - botY;
    const sheet = new THREE.PlaneGeometry(5, h, 1, 20);
    waterfallMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.x += sin(uv.y * 14.0 + uTime * 5.0) * 0.16 * (1.0 - uv.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          // soft flowing streaks, mostly white water
          float flow = 0.8 + 0.2 * sin(vUv.y * 26.0 + uTime * 8.0 + sin(vUv.x * 18.0) * 3.0);
          float streaks = 0.85 + 0.15 * sin(vUv.x * 30.0 + sin(uTime * 2.0));
          vec3 col = mix(vec3(0.72, 0.9, 1.0), vec3(1.0), flow * streaks * 0.6);
          float alpha = 0.62 + flow * 0.15;
          alpha *= smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const wf = new THREE.Mesh(sheet, waterfallMat);
    const midY = (topY + botY) / 2;
    wf.position.set((topX + botX) / 2, midY, (topZ + botZ) / 2);
    wf.lookAt(new THREE.Vector3(botX * 2 - topX, midY, botZ * 2 - topZ));
    wf.rotation.z = 0;
    scene.add(wf);

    // pond at the bottom
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(7, 24),
      new THREE.MeshLambertMaterial({
        color: 0x5fd8e8, transparent: true, opacity: 0.85,
        emissive: 0x2288aa, emissiveIntensity: 0.25,
      })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(botX, botY + 0.15, botZ);
    scene.add(pond);
  }

  // ------------------------------------------------------------
  // bouncy mushroom trampolines
  // ------------------------------------------------------------
  function buildMushrooms(scene) {
    const spots = [
      [24, 12], [-14, 44], [40, -18], [-6, -4], [58, 22],
    ];
    const capMat = new THREE.MeshLambertMaterial({ color: 0xff5f7e });
    const dotMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xfff2dc });

    for (const [x, z] of spots) {
      const y = K.groundHeight(x, z);
      if (y < 1) continue;
      const grp = new THREE.Group();
      grp.position.set(x, y, z);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 1.6, 10), stemMat);
      stem.position.y = 0.8;
      grp.add(stem);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      cap.position.y = 1.5;
      cap.scale.y = 0.75;
      grp.add(cap);

      for (let d = 0; d < 5; d++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), dotMat);
        const a = (d / 5) * Math.PI * 2 + 0.4;
        dot.position.set(Math.cos(a) * 1.4, 2.5, Math.sin(a) * 1.4);
        grp.add(dot);
      }
      grp.userData.cap = cap;
      scene.add(grp);

      const padY = y + 3.1;
      K.bouncePads.push({ x, z, r: 2.3, y: padY, group: grp });
      K.platforms.push({
        heightAt(px, pz) {
          const dx = px - x, dz = pz - z;
          if (dx * dx + dz * dz < 2.3 * 2.3) return padY;
          return null;
        },
      });
    }
  }

  // ------------------------------------------------------------
  // carousel in the plaza (decorative, slowly spinning)
  // ------------------------------------------------------------
  function buildCarousel(scene) {
    const cx = 18, cz = 34;
    const cy = K.groundHeight(cx, cz);
    const grp = new THREE.Group();
    grp.position.set(cx, cy, cz);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(6.4, 6.8, 0.8, 20),
      new THREE.MeshLambertMaterial({ color: 0xffd9ec })
    );
    base.position.y = 0.4;
    grp.add(base);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 7, 10),
      new THREE.MeshLambertMaterial({ color: 0xfff2b8 })
    );
    pole.position.y = 4;
    grp.add(pole);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(7.4, 3.2, 14),
      new THREE.MeshLambertMaterial({ color: 0xff8fb8 })
    );
    roof.position.y = 8.6;
    grp.add(roof);
    const roofTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe14f })
    );
    roofTip.position.y = 10.6;
    grp.add(roofTip);

    // spinning part: 4 pastel ponies (simple charming shapes)
    carouselSpinner = new THREE.Group();
    carouselSpinner.position.y = 0.8;
    const ponyCols = [0xaee3ff, 0xffc7dd, 0xd9c9ff, 0xc4f5c0];
    for (let i = 0; i < 4; i++) {
      const pony = buildPony(ponyCols[i]);
      const a = (i / 4) * Math.PI * 2;
      pony.position.set(Math.cos(a) * 4.4, 1.6, Math.sin(a) * 4.4);
      pony.rotation.y = -a + Math.PI / 2;
      pony.userData.phase = a;
      // brass pole
      const pp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0xffe9a0 })
      );
      pp.position.set(Math.cos(a) * 4.4, 3.5, Math.sin(a) * 4.4);
      carouselSpinner.add(pp);
      carouselSpinner.add(pony);
    }
    grp.add(carouselSpinner);
    scene.add(grp);

    // the platform is walkable — toddlers can ride the spin!
    K.platforms.push({
      heightAt(px, pz) {
        const dx = px - cx, dz = pz - cz;
        if (dx * dx + dz * dz < 6.4 * 6.4) return cy + 0.8;
        return null;
      },
    });
  }

  function buildPony(color) {
    const mat = new THREE.MeshLambertMaterial({ color });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), mat);
    body.scale.set(1.35, 0.85, 0.8);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat);
    head.position.set(1.15, 0.65, 0);
    g.add(head);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), mat);
    ear.position.set(1.1, 1.25, 0.15);
    g.add(ear);
    const ear2 = ear.clone(); ear2.position.z = -0.15; g.add(ear2);
    const maneMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mane = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), maneMat);
    mane.position.set(0.75, 1.0, 0);
    g.add(mane);
    for (const [lx, lz] of [[0.6, 0.35], [0.6, -0.35], [-0.6, 0.35], [-0.6, -0.35]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 6), mat);
      leg.position.set(lx, -0.95, lz);
      g.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), maneMat);
    tail.position.set(-1.25, 0.2, 0);
    g.add(tail);
    return g;
  }

  // ------------------------------------------------------------
  Island.update = function (t, dt, skyState) {
    if (lightBeam) {
      lightBeam.rotation.y = t * 0.7;
      lightBeam.material.opacity = skyState.nightW * 0.4;
    }
    if (carouselSpinner) {
      carouselSpinner.rotation.y = t * 0.45;
      for (const child of carouselSpinner.children) {
        if (child.userData.phase !== undefined) {
          child.position.y = 1.6 + Math.sin(t * 2 + child.userData.phase * 2) * 0.45;
        }
      }
    }
    if (waterfallMat) waterfallMat.uniforms.uTime.value = t;
    if (Island.floatingGroup) {
      Island.floatingGroup.position.y = FLOAT.y - 0.0 + Math.sin(t * 0.5) * 0.0;
    }
  };

})(window.KIRA);
