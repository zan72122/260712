/* ================================================================
   character.js — ミミ, the little painter bunny.
   Big magic brush, red beret, squash & stretch, blinking eyes.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.Character = (function () {
  const T = THREE;
  const P = GAME.PAL;
  const C = GAME.CONFIG;
  const toon = (hex, o) => GAME.Mat.toon(hex, o);

  let root, bodyG, head, earL, earR, armL, armR, legL, legR, brushTip, eyeL, eyeR;
  let terrainH = null;

  const state = {
    pos: new T.Vector3(2, 0, 6),
    vel: new T.Vector3(),
    vy: 0,
    grounded: true,
    facing: 0,
    moveAmt: 0,       // 0..1 how fast we are moving (for anim blend)
    blinkT: 2,
    blink: 0,
    trailHue: 0,
    trailAcc: 0,
  };

  function M(geo, hex, cast, opts) {
    const m = new T.Mesh(geo, toon(hex, opts));
    m.castShadow = cast !== false;
    return m;
  }

  function build(scene, hFn) {
    terrainH = hFn;
    root = new T.Group();
    bodyG = new T.Group();          // squash/stretch pivot at feet
    root.add(bodyG);

    const FUR = 0xfff6ec;

    // --- body: white bunny in sky-blue overalls
    const body = M(new T.SphereGeometry(0.5, 14, 12), FUR);
    body.position.y = 0.62;
    body.scale.set(1, 1.1, 0.92);
    bodyG.add(body);
    const overalls = M(new T.SphereGeometry(0.52, 14, 10, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.6), P.blue);
    overalls.position.y = 0.64;
    overalls.scale.set(1.02, 1.1, 0.94);
    bodyG.add(overalls);
    const button1 = M(new T.SphereGeometry(0.06, 6, 5), P.yellow, false);
    button1.position.set(-0.12, 0.72, 0.45);
    bodyG.add(button1);
    const button2 = button1.clone();
    button2.position.x = 0.12;
    bodyG.add(button2);

    // --- head
    head = new T.Group();
    head.position.y = 1.28;
    bodyG.add(head);
    const skull = M(new T.SphereGeometry(0.44, 16, 13), FUR);
    skull.scale.set(1, 0.94, 0.94);
    head.add(skull);

    // eyes (scale.y for blinking)
    eyeL = M(new T.SphereGeometry(0.075, 8, 7), 0x2b2b3a, false);
    eyeL.position.set(-0.16, 0.06, 0.38);
    head.add(eyeL);
    eyeR = eyeL.clone();
    eyeR.position.x = 0.16;
    head.add(eyeR);
    // sparkle in the eyes
    for (const e of [eyeL, eyeR]) {
      const spark = new T.Mesh(new T.SphereGeometry(0.025, 5, 4), new T.MeshBasicMaterial({ color: 0xffffff }));
      spark.position.set(0.02, 0.03, 0.06);
      e.add(spark);
    }
    // cheeks
    for (const sx of [-0.3, 0.3]) {
      const cheek = M(new T.SphereGeometry(0.07, 6, 5), 0xffb3cf, false);
      cheek.scale.set(1, 0.6, 0.5);
      cheek.position.set(sx, -0.08, 0.33);
      head.add(cheek);
    }
    const nose = M(new T.SphereGeometry(0.06, 6, 5), 0xff8fb5, false);
    nose.position.set(0, -0.02, 0.43);
    head.add(nose);

    // ears
    const earGeo = T.CapsuleGeometry ? new T.CapsuleGeometry(0.11, 0.5, 4, 8) : new T.CylinderGeometry(0.11, 0.11, 0.66, 8);
    earL = new T.Group();
    earL.position.set(-0.18, 0.34, 0);
    const earMeshL = M(earGeo, FUR);
    earMeshL.position.y = 0.34;
    earL.add(earMeshL);
    const innerGeo = T.CapsuleGeometry ? new T.CapsuleGeometry(0.05, 0.3, 3, 6) : new T.CylinderGeometry(0.05, 0.05, 0.4, 6);
    const innerL = M(innerGeo, 0xffb3cf, false);
    innerL.position.set(0, 0.34, 0.07);
    earL.add(innerL);
    earL.rotation.z = 0.16;
    head.add(earL);
    earR = earL.clone();
    earR.position.x = 0.18;
    earR.rotation.z = -0.16;
    head.add(earR);

    // red beret
    const beret = M(new T.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), P.red);
    beret.scale.set(1.25, 0.72, 1.25);
    beret.position.set(0, 0.3, 0);
    beret.rotation.z = 0.12;
    head.add(beret);
    const nub = M(new T.SphereGeometry(0.06, 6, 5), P.red, false);
    nub.position.set(-0.04, 0.52, 0);
    head.add(nub);

    // --- arms
    armL = new T.Group();
    armL.position.set(-0.5, 0.95, 0);
    const armMeshL = M(new T.SphereGeometry(0.14, 8, 7), FUR);
    armMeshL.scale.set(1, 1.8, 1);
    armMeshL.position.y = -0.18;
    armL.add(armMeshL);
    bodyG.add(armL);

    armR = new T.Group();
    armR.position.set(0.5, 0.95, 0);
    const armMeshR = M(new T.SphereGeometry(0.14, 8, 7), FUR);
    armMeshR.scale.set(1, 1.8, 1);
    armMeshR.position.y = -0.18;
    armR.add(armMeshR);

    // --- the magic brush! (held in right arm group)
    const brush = new T.Group();
    brush.position.set(0.08, -0.35, 0.18);
    brush.rotation.x = -0.5;
    const handle = M(new T.CylinderGeometry(0.05, 0.06, 0.95, 8), P.trunk);
    handle.position.y = 0.2;
    brush.add(handle);
    const ferrule = M(new T.CylinderGeometry(0.12, 0.08, 0.18, 8), 0xd8dee9, false);
    ferrule.position.y = 0.75;
    brush.add(ferrule);
    brushTip = M(new T.ConeGeometry(0.17, 0.46, 8), P.pink, false, { emissive: 0xff4f8a, emissiveIntensity: 0.7 });
    brushTip.position.y = 1.05;
    brush.add(brushTip);
    armR.add(brush);
    bodyG.add(armR);

    // --- legs / feet
    legL = M(new T.SphereGeometry(0.17, 8, 7), FUR);
    legL.scale.set(1, 0.62, 1.7);
    legL.position.set(-0.2, 0.12, 0.06);
    bodyG.add(legL);
    legR = legL.clone();
    legR.position.x = 0.2;
    bodyG.add(legR);

    // fluffy tail
    const tail = M(new T.SphereGeometry(0.15, 7, 6), 0xffffff, false);
    tail.position.set(0, 0.5, -0.5);
    bodyG.add(tail);

    state.pos.y = terrainH(state.pos.x, state.pos.z);
    root.position.copy(state.pos);
    scene.add(root);
    return root;
  }

  /* ---------------- per-frame ---------------- */
  const _dir = new T.Vector3();

  function update(dt, time) {
    const input = GAME.Input;
    const v = input.vec;

    // --- locomotion
    const targetVx = v.x * C.PLAYER_SPEED;
    const targetVz = v.z * C.PLAYER_SPEED;
    const accel = state.grounded ? 14 : 6;
    state.vel.x += (targetVx - state.vel.x) * Math.min(1, dt * accel);
    state.vel.z += (targetVz - state.vel.z) * Math.min(1, dt * accel);

    state.pos.x += state.vel.x * dt;
    state.pos.z += state.vel.z * dt;

    // keep on the island (soft circular wall at the shallow water line)
    const r = Math.hypot(state.pos.x, state.pos.z);
    const maxR = GAME.CONFIG.ISLAND_R - 2.5;
    if (r > maxR) {
      state.pos.x *= maxR / r;
      state.pos.z *= maxR / r;
    }

    // --- jumping & gravity
    const ground = terrainH(state.pos.x, state.pos.z);
    if (input.consumeJump() && state.grounded) {
      state.vy = C.JUMP_V;
      state.grounded = false;
      GAME.Audio.sfx.jump();
      GAME.Effects.jumpPuff(state.pos);
    }
    if (!state.grounded) {
      state.vy += C.GRAVITY * dt;
      state.pos.y += state.vy * dt;
      if (state.pos.y <= ground) {
        state.pos.y = ground;
        state.grounded = true;
        state.vy = 0;
        GAME.Audio.sfx.land();
        GAME.Effects.jumpPuff(state.pos);
      }
    } else {
      // follow terrain, with a tiny tolerance for down slopes
      if (state.pos.y > ground + 0.4) {
        state.grounded = false;
        state.vy = 0;
      } else {
        state.pos.y = ground;
      }
    }

    root.position.copy(state.pos);

    // --- facing
    const speed = Math.hypot(state.vel.x, state.vel.z);
    state.moveAmt += ((speed > 0.4 ? Math.min(1, speed / C.PLAYER_SPEED) : 0) - state.moveAmt) * Math.min(1, dt * 8);
    if (speed > 0.4) {
      const want = Math.atan2(state.vel.x, state.vel.z);
      let diff = want - state.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      state.facing += diff * Math.min(1, dt * 10);
      root.rotation.y = state.facing;
    }

    // --- animation
    const m = state.moveAmt;
    const runT = time * 11;
    // bobbing + lean
    bodyG.position.y = Math.abs(Math.sin(runT)) * 0.09 * m + (state.grounded ? 0 : 0.05);
    bodyG.rotation.x = m * 0.12;
    // squash & stretch in air
    if (!state.grounded) {
      const s = T.MathUtils.clamp(state.vy / 12, -0.35, 0.5);
      bodyG.scale.set(1 - s * 0.3, 1 + s * 0.55, 1 - s * 0.3);
    } else {
      bodyG.scale.x += (1 - bodyG.scale.x) * Math.min(1, dt * 10);
      bodyG.scale.y += (1 - bodyG.scale.y) * Math.min(1, dt * 10);
      bodyG.scale.z += (1 - bodyG.scale.z) * Math.min(1, dt * 10);
    }
    // legs & arms swing
    legL.position.z = 0.06 + Math.sin(runT) * 0.16 * m;
    legR.position.z = 0.06 - Math.sin(runT) * 0.16 * m;
    legL.position.y = 0.12 + Math.max(0, Math.sin(runT)) * 0.1 * m;
    legR.position.y = 0.12 + Math.max(0, -Math.sin(runT)) * 0.1 * m;
    armL.rotation.x = Math.sin(runT) * 0.7 * m;
    armR.rotation.x = -0.25 - Math.sin(runT) * 0.5 * m - (state.grounded ? 0 : 0.9);
    // idle breathing & brush held up when idle
    if (m < 0.1) {
      bodyG.position.y += Math.sin(time * 2.2) * 0.015;
      armR.rotation.x = -0.3 + Math.sin(time * 2.2) * 0.06;
    }
    // ears trail & wiggle
    const earSwing = -m * 0.35 + Math.sin(time * 2.6) * 0.05 - (state.grounded ? 0 : state.vy * 0.03);
    earL.rotation.x = earSwing;
    earR.rotation.x = earSwing * 1.06;
    // head tilt while running
    head.rotation.z = Math.sin(runT * 0.5) * 0.05 * m;

    // --- blinking
    state.blinkT -= dt;
    if (state.blinkT <= 0) { state.blinkT = 1.8 + Math.random() * 3; state.blink = 0.14; }
    if (state.blink > 0) {
      state.blink -= dt;
      eyeL.scale.y = eyeR.scale.y = Math.max(0.1, Math.abs(state.blink - 0.07) / 0.07);
    } else {
      eyeL.scale.y = eyeR.scale.y = 1;
    }

    // --- rainbow brush trail while running
    state.trailHue += dt * 0.35;
    if (m > 0.25) {
      state.trailAcc += dt;
      if (state.trailAcc > 0.05) {
        state.trailAcc = 0;
        GAME.Effects.trail(state.pos, state.trailHue);
      }
    }
    // brush tip pulses with rainbow light
    const tipC = brushTip.material;
    tipC.emissive.setHSL(state.trailHue % 1, 0.9, 0.55);
    tipC.color.setHSL(state.trailHue % 1, 0.8, 0.7);
  }

  return {
    build, update,
    get pos() { return state.pos; },
    get root() { return root; },
    get moveAmt() { return state.moveAmt; },
  };
})();
