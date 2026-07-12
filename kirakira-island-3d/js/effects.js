/* ============================================================
   effects.js — the きらきら (sparkle) engine.
   A pooled CPU particle system driving:
   * star-collect bursts, jump puffs, running pixie-dust trail
   * heart bursts when a friend is found
   * confetti, rising balloons, full fireworks shows
   * drifting cherry-blossom petals, waterfall spray
   * fireflies that only wake up at night
   ============================================================ */

(function (K) {
  "use strict";

  const Effects = {};
  K.Effects = Effects;

  let scene;

  // ------------------------------------------------------------
  // canvas textures
  // ------------------------------------------------------------
  function dotTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function heartTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.translate(32, 34);
    g.scale(1.5, 1.5);
    g.beginPath();
    g.moveTo(0, 6);
    g.bezierCurveTo(-14, -6, -7, -16, 0, -8);
    g.bezierCurveTo(7, -16, 14, -6, 0, 6);
    g.fillStyle = "#ffffff";
    g.fill();
    return new THREE.CanvasTexture(c);
  }

  // ------------------------------------------------------------
  // generic particle pool (Points-based)
  // ------------------------------------------------------------
  function makePool(capacity, texture, blending) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(capacity * 3);
    const col = new Float32Array(capacity * 3);
    const siz = new Float32Array(capacity);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(siz, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending,
      uniforms: { uTex: { value: texture } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (170.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        varying vec3 vColor;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * t;
        }`,
      vertexColors: true,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    const P = {
      capacity,
      // per-particle simulation data
      px: new Float32Array(capacity), py: new Float32Array(capacity), pz: new Float32Array(capacity),
      vx: new Float32Array(capacity), vy: new Float32Array(capacity), vz: new Float32Array(capacity),
      r: new Float32Array(capacity), g: new Float32Array(capacity), b: new Float32Array(capacity),
      size: new Float32Array(capacity),
      life: new Float32Array(capacity),
      maxLife: new Float32Array(capacity),
      grav: new Float32Array(capacity),
      drag: new Float32Array(capacity),
      twinkle: new Float32Array(capacity),
      fadeIn: new Float32Array(capacity),
      cursor: 0,
      geo, posAttr: geo.attributes.position, colAttr: geo.attributes.color,
      sizAttr: geo.attributes.size,
    };

    P.spawn = function (o) {
      const i = P.cursor;
      P.cursor = (P.cursor + 1) % capacity;
      P.px[i] = o.x; P.py[i] = o.y; P.pz[i] = o.z;
      P.vx[i] = o.vx || 0; P.vy[i] = o.vy || 0; P.vz[i] = o.vz || 0;
      P.r[i] = o.r; P.g[i] = o.g; P.b[i] = o.b;
      P.size[i] = o.size || 1;
      P.life[i] = P.maxLife[i] = o.life || 1;
      P.grav[i] = o.grav || 0;
      P.drag[i] = o.drag !== undefined ? o.drag : 0.4;
      P.twinkle[i] = o.twinkle || 0;
      P.fadeIn[i] = o.fadeIn || 0;
    };

    P.update = function (dt, t) {
      const pa = P.posAttr.array, ca = P.colAttr.array, sa = P.sizAttr.array;
      for (let i = 0; i < capacity; i++) {
        if (P.life[i] <= 0) {
          sa[i] = 0;
          ca[i * 3] = ca[i * 3 + 1] = ca[i * 3 + 2] = 0;
          continue;
        }
        P.life[i] -= dt;
        const dragF = 1 - P.drag[i] * dt;
        P.vx[i] *= dragF; P.vz[i] *= dragF;
        P.vy[i] = P.vy[i] * dragF + P.grav[i] * dt;
        P.px[i] += P.vx[i] * dt;
        P.py[i] += P.vy[i] * dt;
        P.pz[i] += P.vz[i] * dt;

        const frac = Math.max(P.life[i] / P.maxLife[i], 0);
        let a = frac;
        if (P.fadeIn[i] > 0) {
          const age = P.maxLife[i] - P.life[i];
          a *= Math.min(age / P.fadeIn[i], 1);
        }
        if (P.twinkle[i] > 0) {
          a *= 0.6 + 0.4 * Math.sin(t * P.twinkle[i] + i * 1.7);
        }
        pa[i * 3] = P.px[i]; pa[i * 3 + 1] = P.py[i]; pa[i * 3 + 2] = P.pz[i];
        ca[i * 3] = P.r[i] * a; ca[i * 3 + 1] = P.g[i] * a; ca[i * 3 + 2] = P.b[i] * a;
        sa[i] = P.size[i] * (0.4 + 0.6 * frac);
      }
      P.posAttr.needsUpdate = true;
      P.colAttr.needsUpdate = true;
      P.sizAttr.needsUpdate = true;
    };

    return P;
  }

  let glowPool;   // additive — sparkles, fireworks, dust, fireflies
  let softPool;   // normal — petals, confetti, water spray
  let heartPool;  // hearts

  // ------------------------------------------------------------
  // balloons (mesh pool)
  // ------------------------------------------------------------
  const balloons = [];
  function makeBalloons() {
    for (let i = 0; i < 16; i++) {
      const grp = new THREE.Group();
      const col = K.PAL.balloonCols[i % K.PAL.balloonCols.length];
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 12, 10),
        new THREE.MeshLambertMaterial({
          color: col, emissive: col, emissiveIntensity: 0.25,
        })
      );
      ball.scale.y = 1.15;
      grp.add(ball);
      const knot = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.2, 6),
        ball.material
      );
      knot.position.y = -0.78;
      grp.add(knot);
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 1.6, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      string.position.y = -1.6;
      grp.add(string);
      grp.visible = false;
      scene.add(grp);
      balloons.push({ grp, life: 0, phase: Math.random() * 10 });
    }
  }

  Effects.balloonRelease = function (pos, n) {
    let released = 0;
    for (const b of balloons) {
      if (b.life > 0) continue;
      b.life = K.rand(6, 9);
      b.grp.position.set(
        pos.x + K.rand(-1.5, 1.5), pos.y + K.rand(0, 1), pos.z + K.rand(-1.5, 1.5));
      b.grp.visible = true;
      b.vy = K.rand(1.6, 2.6);
      if (++released >= n) break;
    }
  };

  // ------------------------------------------------------------
  // fireworks
  // ------------------------------------------------------------
  const rockets = [];
  let showTime = 0; // >0 while the grand celebration show runs

  Effects.launchFirework = function (x, z) {
    rockets.push({
      x, y: 2, z,
      vy: K.rand(26, 34),
      hue: Math.random(),
      fuse: K.rand(1.1, 1.5),
    });
    if (K.Audio.ctx) K.Audio.sfxFirework();
  };

  Effects.celebrate = function (seconds) {
    showTime = seconds;
  };

  function explode(r) {
    const col = new THREE.Color().setHSL(r.hue, 0.9, 0.65);
    const col2 = new THREE.Color().setHSL((r.hue + 0.12) % 1, 0.9, 0.75);
    for (let i = 0; i < 90; i++) {
      // spherical burst
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = K.rand(7, 15);
      const c = Math.random() > 0.5 ? col : col2;
      glowPool.spawn({
        x: r.x, y: r.y, z: r.z,
        vx: Math.sin(ph) * Math.cos(th) * sp,
        vy: Math.cos(ph) * sp,
        vz: Math.sin(ph) * Math.sin(th) * sp,
        r: c.r, g: c.g, b: c.b,
        size: K.rand(1.2, 2.4),
        life: K.rand(1.2, 2.1),
        grav: -4.5, drag: 0.9, twinkle: 8,
      });
    }
  }

  // ------------------------------------------------------------
  // public burst helpers
  // ------------------------------------------------------------
  Effects.starBurst = function (p) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = K.rand(2, 7);
      glowPool.spawn({
        x: p.x, y: p.y, z: p.z,
        vx: Math.cos(a) * sp, vy: K.rand(2, 8), vz: Math.sin(a) * sp,
        r: 1, g: K.rand(0.75, 0.95), b: K.rand(0.2, 0.5),
        size: K.rand(0.8, 1.8), life: K.rand(0.5, 1.1),
        grav: -6, drag: 1.6, twinkle: 10,
      });
    }
  };

  Effects.heartBurst = function (p) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      heartPool.spawn({
        x: p.x + K.rand(-0.5, 0.5), y: p.y + K.rand(0.5, 2), z: p.z + K.rand(-0.5, 0.5),
        vx: Math.cos(a) * K.rand(0.5, 2.5), vy: K.rand(2.5, 5), vz: Math.sin(a) * K.rand(0.5, 2.5),
        r: 1, g: K.rand(0.35, 0.65), b: K.rand(0.55, 0.8),
        size: K.rand(1.4, 2.6), life: K.rand(1.2, 2),
        grav: 1.2, drag: 1.4,
      });
    }
  };

  Effects.confettiBurst = function (p) {
    for (let i = 0; i < 60; i++) {
      const c = new THREE.Color(K.pick(K.PAL.balloonCols));
      const a = Math.random() * Math.PI * 2;
      softPool.spawn({
        x: p.x, y: p.y + 0.5, z: p.z,
        vx: Math.cos(a) * K.rand(1, 6), vy: K.rand(5, 12), vz: Math.sin(a) * K.rand(1, 6),
        r: c.r, g: c.g, b: c.b,
        size: K.rand(0.7, 1.3), life: K.rand(1.4, 2.6),
        grav: -7, drag: 1.4, twinkle: 6,
      });
    }
  };

  Effects.jumpPuff = function (p) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      softPool.spawn({
        x: p.x + Math.cos(a) * 0.5, y: p.y + 0.15, z: p.z + Math.sin(a) * 0.5,
        vx: Math.cos(a) * 2.4, vy: K.rand(0.4, 1.2), vz: Math.sin(a) * 2.4,
        r: 1, g: 1, b: 1,
        size: K.rand(0.8, 1.4), life: 0.5, grav: -1, drag: 2.5,
      });
    }
  };

  Effects.splash = function (p) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      softPool.spawn({
        x: p.x, y: 0.2, z: p.z,
        vx: Math.cos(a) * K.rand(1, 5), vy: K.rand(4, 9), vz: Math.sin(a) * K.rand(1, 5),
        r: 0.75, g: 0.92, b: 1,
        size: K.rand(0.6, 1.2), life: K.rand(0.5, 1), grav: -14, drag: 0.6,
      });
    }
  };

  // pixie-dust trail while running
  let trailAcc = 0;
  Effects.runTrail = function (p, dt, speed01) {
    trailAcc += dt * speed01 * 22;
    while (trailAcc > 1) {
      trailAcc -= 1;
      glowPool.spawn({
        x: p.x + K.rand(-0.35, 0.35), y: p.y + K.rand(0.05, 0.4), z: p.z + K.rand(-0.35, 0.35),
        vx: K.rand(-0.4, 0.4), vy: K.rand(0.4, 1.4), vz: K.rand(-0.4, 0.4),
        r: 1, g: 0.92, b: 0.55,
        size: K.rand(0.35, 0.8), life: K.rand(0.4, 0.9),
        grav: 0.4, drag: 1, twinkle: 12,
      });
    }
  };

  // ------------------------------------------------------------
  // fireflies — persistent gentle wanderers, alive at night
  // ------------------------------------------------------------
  const fireflies = [];
  function makeFireflies() {
    const tex = dotTexture();
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0xd0ffa0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.scale.setScalar(K.rand(0.5, 0.9));
      let x, z, guard = 0;
      do {
        x = K.rand(-70, 70); z = K.rand(-70, 70); guard++;
      } while (K.groundHeight(x, z) < 2 && guard < 40);
      scene.add(s);
      fireflies.push({ s, x, z, phase: Math.random() * 20, r: K.rand(2, 8) });
    }
  }

  // ------------------------------------------------------------
  Effects.init = function (sc) {
    scene = sc;
    const dot = dotTexture();
    glowPool = makePool(2600, dot, THREE.AdditiveBlending);
    softPool = makePool(1400, dot, THREE.NormalBlending);
    heartPool = makePool(240, heartTexture(), THREE.NormalBlending);
    makeBalloons();
    makeFireflies();
  };

  let petalAcc = 0, sprayAcc = 0, moteAcc = 0, showAcc = 0;

  Effects.update = function (t, dt, playerPos, skyState) {
    glowPool.update(dt, t);
    softPool.update(dt, t);
    heartPool.update(dt, t);

    // rockets rise, then burst
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.fuse -= dt;
      r.y += r.vy * dt;
      r.vy *= 1 - 0.25 * dt;
      // glittering tail
      glowPool.spawn({
        x: r.x + K.rand(-0.15, 0.15), y: r.y, z: r.z + K.rand(-0.15, 0.15),
        vx: 0, vy: -2, vz: 0,
        r: 1, g: 0.85, b: 0.6,
        size: 0.7, life: 0.45, grav: -2, drag: 1,
      });
      if (r.fuse <= 0) {
        explode(r);
        rockets.splice(i, 1);
      }
    }

    // celebration show: keep launching rockets around the island
    if (showTime > 0) {
      showTime -= dt;
      showAcc += dt;
      if (showAcc > 0.55) {
        showAcc = 0;
        const a = Math.random() * Math.PI * 2;
        const r = K.rand(20, 60);
        Effects.launchFirework(playerPos.x + Math.cos(a) * r, playerPos.z + Math.sin(a) * r);
      }
    }

    // balloons drift upward, swaying
    for (const b of balloons) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.grp.position.y += b.vy * dt;
      b.grp.position.x += Math.sin(t * 1.4 + b.phase) * 0.6 * dt;
      b.grp.rotation.z = Math.sin(t * 1.8 + b.phase) * 0.12;
      if (b.life <= 0) b.grp.visible = false;
    }

    // cherry-blossom petals drop from sakura trees
    petalAcc += dt * 6;
    while (petalAcc > 1) {
      petalAcc -= 1;
      const tr = K.pick(K.Nature.sakuraTrees);
      if (!tr) break;
      const a = Math.random() * Math.PI * 2;
      softPool.spawn({
        x: tr.x + Math.cos(a) * K.rand(0, tr.r),
        y: tr.y + K.rand(-1, 1),
        z: tr.z + Math.sin(a) * K.rand(0, tr.r),
        vx: K.rand(-0.8, 0.8), vy: K.rand(-0.6, -0.2), vz: K.rand(-0.8, 0.8),
        r: 1, g: K.rand(0.6, 0.78), b: K.rand(0.78, 0.9),
        size: K.rand(0.4, 0.75), life: K.rand(3, 5),
        grav: -0.35, drag: 0.25, twinkle: 3, fadeIn: 0.4,
      });
    }

    // waterfall mist at the plunge pool
    const wf = K.Island.waterfall;
    if (wf) {
      sprayAcc += dt * 24;
      while (sprayAcc > 1) {
        sprayAcc -= 1;
        // droplets along the falling sheet + mist at the bottom
        const p = Math.random();
        softPool.spawn({
          x: K.lerp(wf.topX, wf.botX, p) + K.rand(-2, 2),
          y: K.lerp(wf.topY, wf.botY, p),
          z: K.lerp(wf.topZ, wf.botZ, p) + K.rand(-2, 2),
          vx: K.rand(-0.5, 0.5), vy: p > 0.8 ? K.rand(2, 5) : K.rand(-2, -0.5),
          vz: K.rand(-0.5, 0.5),
          r: 0.8, g: 0.94, b: 1,
          size: K.rand(0.5, 1.1), life: K.rand(0.5, 1.2), grav: -6, drag: 0.8,
        });
      }
    }

    // ambient pixie-dust motes floating near the player (day & night)
    moteAcc += dt * 4;
    while (moteAcc > 1) {
      moteAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = K.rand(3, 22);
      const x = playerPos.x + Math.cos(a) * r;
      const z = playerPos.z + Math.sin(a) * r;
      const gy = Math.max(K.groundHeight(x, z), 0);
      glowPool.spawn({
        x, y: gy + K.rand(0.5, 5), z,
        vx: K.rand(-0.3, 0.3), vy: K.rand(0.15, 0.55), vz: K.rand(-0.3, 0.3),
        r: K.rand(0.7, 1), g: K.rand(0.75, 1), b: K.rand(0.55, 1),
        size: K.rand(0.25, 0.55), life: K.rand(2.5, 4.5),
        drag: 0.1, twinkle: 5, fadeIn: 0.8,
      });
    }

    // fireflies awake at night
    const glowAmt = skyState.nightW;
    for (const f of fireflies) {
      const fx = f.x + Math.sin(t * 0.5 + f.phase) * f.r;
      const fz = f.z + Math.cos(t * 0.37 + f.phase * 1.3) * f.r;
      const gy = Math.max(K.groundHeight(fx, fz), 0);
      f.s.position.set(fx, gy + 1.2 + Math.sin(t * 1.1 + f.phase * 2) * 0.7, fz);
      f.s.material.opacity =
        glowAmt * (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.3 + f.phase * 5)));
    }
  };

})(window.KIRA);
