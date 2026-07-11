/* ================================================================
   effects.js — joy machinery
   Pooled point-sprite particles (paint bursts, sparkles, fireworks,
   petals), fluttering butterflies and floating hearts.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.Effects = (function () {
  const T = THREE;

  /* ---------- sprite textures drawn on canvas ---------- */
  function makeTex(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    draw(c.getContext('2d'));
    const t = new T.CanvasTexture(c);
    t.minFilter = T.LinearFilter;
    return t;
  }
  const softTex = makeTex((g) => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.55, 'rgba(255,255,255,.95)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
  const glowTex = makeTex((g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,.65)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
  const heartTex = makeTex((g) => {
    g.translate(32, 34); g.scale(1.35, 1.35);
    g.fillStyle = '#ff5f8a';
    g.beginPath();
    g.moveTo(0, 10);
    g.bezierCurveTo(-16, -4, -9, -16, 0, -7);
    g.bezierCurveTo(9, -16, 16, -4, 0, 10);
    g.fill();
  });

  /* ---------- generic particle pool ---------- */
  class Pool {
    constructor(scene, count, tex, blending) {
      this.count = count;
      this.pos = new Float32Array(count * 3);
      this.col = new Float32Array(count * 3);
      this.size = new Float32Array(count);
      this.alpha = new Float32Array(count);
      this.vel = new Float32Array(count * 3);
      this.life = new Float32Array(count);
      this.maxLife = new Float32Array(count);
      this.grav = new Float32Array(count);
      this.drag = new Float32Array(count);
      this.baseSize = new Float32Array(count);
      this.cursor = 0;
      this.alive = 0;

      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(this.pos, 3));
      geo.setAttribute('color', new T.BufferAttribute(this.col, 3));
      geo.setAttribute('size', new T.BufferAttribute(this.size, 1));
      geo.setAttribute('alpha', new T.BufferAttribute(this.alpha, 1));

      const mat = new T.ShaderMaterial({
        uniforms: { tex: { value: tex } },
        vertexShader: `
          attribute float size;
          attribute float alpha;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = color;
            vAlpha = alpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (240.0 / max(1.0, -mv.z));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D tex;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec4 t = texture2D(tex, gl_PointCoord);
            gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
            if (gl_FragColor.a < 0.01) discard;
          }`,
        transparent: true,
        depthWrite: false,
        blending: blending,
        vertexColors: true,
      });
      this.points = new T.Points(geo, mat);
      this.points.frustumCulled = false;
      scene.add(this.points);
      // park everything far away
      for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -9999;
    }

    spawn(x, y, z, vx, vy, vz, color, size, life, grav, drag) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
      this.baseSize[i] = size;
      this.size[i] = size;
      this.alpha[i] = 1;
      this.life[i] = life; this.maxLife[i] = life;
      this.grav[i] = grav; this.drag[i] = drag;
    }

    update(dt) {
      const n = this.count;
      for (let i = 0; i < n; i++) {
        if (this.life[i] <= 0) continue;
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          this.pos[i * 3 + 1] = -9999;
          this.alpha[i] = 0;
          continue;
        }
        const d = Math.pow(this.drag[i], dt * 60);
        this.vel[i * 3] *= d;
        this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.grav[i] * dt;
        this.vel[i * 3 + 2] *= d;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        const k = this.life[i] / this.maxLife[i];
        this.alpha[i] = Math.min(1, k * 2.5);
        this.size[i] = this.baseSize[i] * (0.4 + 0.6 * k);
      }
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
      g.attributes.size.needsUpdate = true;
      g.attributes.alpha.needsUpdate = true;
    }
  }

  /* ---------- module state ---------- */
  let softPool, glowPool, heartPool;
  let sceneRef = null;
  const butterflies = [];
  const petalEmitters = [];
  const rockets = [];
  const _c = new T.Color();

  const RAINBOW = [0xff5a5a, 0xffa03c, 0xffd93c, 0x51c95b, 0x4aa8ff, 0xb07aff, 0xff8fb5];

  function init(scene) {
    sceneRef = scene;
    softPool = new Pool(scene, 700, softTex, T.NormalBlending);
    glowPool = new Pool(scene, 1000, glowTex, T.AdditiveBlending);
    heartPool = new Pool(scene, 48, heartTex, T.NormalBlending);
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- public effect recipes ---------- */

  // a prop just got painted — rainbow blob explosion + sparkles
  function paintBurst(pos, mainHexes) {
    const hexes = (mainHexes && mainHexes.length) ? mainHexes : RAINBOW;
    for (let i = 0; i < 26; i++) {
      _c.setHex(hexes[i % hexes.length]);
      const a = Math.random() * Math.PI * 2;
      const r = rand(1.5, 4.5);
      softPool.spawn(pos.x, pos.y + rand(0.4, 1.6), pos.z,
        Math.cos(a) * r, rand(2.5, 7), Math.sin(a) * r,
        _c, rand(0.5, 1.15), rand(0.5, 1.0), -9, 0.94);
    }
    for (let i = 0; i < 16; i++) {
      _c.setHex(RAINBOW[i % RAINBOW.length]);
      const a = Math.random() * Math.PI * 2;
      const r = rand(1, 3.5);
      glowPool.spawn(pos.x, pos.y + rand(0.5, 2), pos.z,
        Math.cos(a) * r, rand(1, 5), Math.sin(a) * r,
        _c, rand(0.4, 0.9), rand(0.6, 1.2), -2, 0.96);
    }
  }

  // brush trail while running
  function trail(pos, hue) {
    _c.setHSL(hue % 1, 0.85, 0.65);
    glowPool.spawn(pos.x + rand(-0.2, 0.2), pos.y + rand(0, 0.3), pos.z + rand(-0.2, 0.2),
      rand(-0.4, 0.4), rand(0.5, 1.4), rand(-0.4, 0.4),
      _c, rand(0.25, 0.5), rand(0.4, 0.8), 0, 0.95);
  }

  function starBurst(pos) {
    for (let i = 0; i < 22; i++) {
      _c.setHSL(0.13 + rand(-0.04, 0.04), 1, 0.65);
      const a = (i / 22) * Math.PI * 2;
      glowPool.spawn(pos.x, pos.y, pos.z,
        Math.cos(a) * rand(2, 5), rand(1, 4.5), Math.sin(a) * rand(2, 5),
        _c, rand(0.4, 0.8), rand(0.5, 0.9), -4, 0.94);
    }
  }

  function jumpPuff(pos) {
    _c.setHex(0xffffff);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      softPool.spawn(pos.x, pos.y + 0.15, pos.z,
        Math.cos(a) * rand(1, 2.5), rand(0.3, 1), Math.sin(a) * rand(1, 2.5),
        _c, rand(0.4, 0.8), rand(0.3, 0.55), 0, 0.9);
    }
  }

  function heart(pos) {
    _c.setHex(0xffffff);
    heartPool.spawn(pos.x + rand(-0.3, 0.3), pos.y, pos.z + rand(-0.3, 0.3),
      rand(-0.2, 0.2), rand(1.2, 1.8), rand(-0.2, 0.2),
      _c, rand(0.6, 0.9), 1.2, 1.2, 0.97);
  }

  // paint shot: little arcing blob fired at a target
  function paintShot(from, to, hex, onHit) {
    rockets.push({
      type: 'shot',
      p: from.clone(), t: 0,
      from: from.clone(), to: to.clone(),
      dur: Math.max(0.25, from.distanceTo(to) / 26),
      hex, onHit,
    });
  }

  // fireworks!
  function firework(x, z, hex) {
    rockets.push({
      type: 'rocket',
      p: new T.Vector3(x, 2, z), t: 0,
      from: new T.Vector3(x, 2, z),
      to: new T.Vector3(x + rand(-4, 4), rand(20, 30), z + rand(-4, 4)),
      dur: rand(0.8, 1.1),
      hex: hex !== undefined ? hex : RAINBOW[(Math.random() * RAINBOW.length) | 0],
    });
    if (GAME.Audio) GAME.Audio.sfx.firework();
  }

  function burst(pos, hex) {
    _c.setHex(hex);
    const n = 70;
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rand(-1, 1));
      const sp = rand(5, 11);
      glowPool.spawn(pos.x, pos.y, pos.z,
        Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp,
        _c, rand(0.5, 1.0), rand(0.9, 1.6), -4.5, 0.955);
    }
    // white core flash
    _c.setHex(0xffffff);
    for (let i = 0; i < 12; i++) {
      const th = Math.random() * Math.PI * 2;
      glowPool.spawn(pos.x, pos.y, pos.z,
        Math.cos(th) * rand(1, 3), rand(-2, 3), Math.sin(th) * rand(1, 3),
        _c, rand(0.8, 1.3), rand(0.4, 0.7), -3, 0.94);
    }
  }

  /* ---------- butterflies ---------- */
  function makeButterfly(hex) {
    const g = new T.Group();
    // rounded petal-shaped wing (semicircle), reads as a butterfly from afar
    const wingGeo = new T.CircleGeometry(0.24, 7, -Math.PI / 2, Math.PI); // half-disc, spans +x
    wingGeo.scale(1.35, 0.95, 1);
    wingGeo.translate(0.05, 0, 0);
    const mat = new T.MeshBasicMaterial({ color: new T.Color(hex).convertSRGBToLinear(), side: T.DoubleSide });
    const wl = new T.Mesh(wingGeo, mat);
    const wr = new T.Mesh(wingGeo, mat);
    wr.scale.x = -1;
    g.add(wl); g.add(wr);
    g.userData = { wl, wr };
    return g;
  }

  function spawnButterflies(center, n, radius) {
    for (let i = 0; i < n; i++) {
      if (butterflies.length >= 26) return;
      const hex = RAINBOW[(Math.random() * RAINBOW.length) | 0];
      const b = makeButterfly(hex);
      const bb = {
        mesh: b,
        anchor: center.clone(),
        radius: radius || 5,
        phase: Math.random() * 100,
        speed: rand(0.4, 0.8),
        h: rand(1.2, 3.2),
      };
      b.position.copy(center);
      sceneRef.add(b);
      butterflies.push(bb);
    }
  }

  /* ---------- ambient petal emitters ---------- */
  function addPetalEmitter(center, radius, hex) {
    petalEmitters.push({ center, radius, hex, acc: 0 });
  }

  /* ---------- per-frame update ---------- */
  const _v = new T.Vector3();
  function update(dt, time) {
    softPool.update(dt);
    glowPool.update(dt);
    heartPool.update(dt);

    // rockets & paint shots
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt / r.dur;
      const t = Math.min(1, r.t);
      if (r.type === 'rocket') {
        r.p.lerpVectors(r.from, r.to, t);
        _c.setHex(r.hex);
        glowPool.spawn(r.p.x, r.p.y, r.p.z, rand(-0.3, 0.3), -1, rand(-0.3, 0.3),
          _c, 0.5, 0.5, 0, 0.95);
        if (t >= 1) { burst(r.to, r.hex); rockets.splice(i, 1); }
      } else {
        // arcing shot
        r.p.lerpVectors(r.from, r.to, t);
        r.p.y += Math.sin(t * Math.PI) * 2.2;
        _c.setHex(r.hex);
        glowPool.spawn(r.p.x, r.p.y, r.p.z, 0, 0, 0, _c, 0.55, 0.35, 0, 0.9);
        if (t >= 1) {
          rockets.splice(i, 1);
          if (r.onHit) r.onHit();
        }
      }
    }

    // butterflies flutter around their anchor
    for (const b of butterflies) {
      const t = time * b.speed + b.phase;
      const r = b.radius * (0.55 + 0.45 * Math.sin(t * 0.43));
      _v.set(
        b.anchor.x + Math.cos(t) * r,
        b.anchor.y + b.h + Math.sin(t * 1.7) * 0.8,
        b.anchor.z + Math.sin(t * 0.83) * r
      );
      const d = _v.clone().sub(b.mesh.position);
      b.mesh.position.addScaledVector(d, Math.min(1, dt * 2.2));
      if (d.lengthSq() > 0.0001) {
        b.mesh.rotation.y = Math.atan2(d.x, d.z);
      }
      const flap = Math.sin(time * 18 + b.phase) * 1.05;
      b.mesh.userData.wl.rotation.y = flap;
      b.mesh.userData.wr.rotation.y = -flap;
    }

    // petals drift down
    for (const p of petalEmitters) {
      p.acc += dt;
      if (p.acc > 0.55) {
        p.acc = 0;
        _c.setHex(p.hex);
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * p.radius;
        softPool.spawn(
          p.center.x + Math.cos(a) * rr, p.center.y + rand(3, 6), p.center.z + Math.sin(a) * rr,
          rand(-0.6, 0.6), rand(-0.8, -0.4), rand(-0.6, 0.6),
          _c, rand(0.28, 0.5), rand(3, 5), -0.12, 0.985);
      }
    }
  }

  return {
    init, update,
    paintBurst, trail, starBurst, jumpPuff, heart,
    paintShot, firework, burst,
    spawnButterflies, addPetalEmitter,
    RAINBOW,
  };
})();
