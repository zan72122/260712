/* ============================================================
   main.js — game heart: renderer, lights, physics, camera,
   collectibles, the friend parade and the day-night cycle.
   ============================================================ */

(function (K) {
  "use strict";

  const C = K.CONFIG;

  let renderer, scene, camera, clock;
  let hemiLight, sunLight, ambLight;
  let player, playerState;
  let camYaw = Math.PI;              // camera behind the player
  let started = false;

  const stars = [];                  // collectible stars
  const gifts = [];                  // present boxes
  const friends = [];                // the five hidden friends
  let starCount = 0;
  let starCombo = 0, comboTimer = 0;
  let friendsFound = 0;
  let allDone = false;
  let dayTime = C.DAY_LENGTH * 0.05; // start just after sunrise

  // optional start time of day: ?time=asa|hiru|yuyake|yoru
  const TIME_PRESETS = {
    asa: 0.05, morning: 0.05,
    hiru: 0.2, noon: 0.2,
    yuyake: 0.47, sunset: 0.47,
    yoru: 0.72, night: 0.72,
  };
  const timeParam = new URLSearchParams(location.search).get("time");
  if (timeParam && TIME_PRESETS[timeParam] !== undefined) {
    dayTime = C.DAY_LENGTH * TIME_PRESETS[timeParam];
  }

  // ------------------------------------------------------------
  // boot
  // ------------------------------------------------------------
  function init() {
    const canvas = document.getElementById("game-canvas");
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, C.PIXEL_RATIO_CAP));
    renderer.setSize(window.innerWidth, window.innerHeight);
    // linear output: authored hex colors show exactly as designed,
    // keeping the storybook palette vivid instead of washing out
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbdeafc, 60, 340);

    camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 1000);

    // ---- lights ----
    hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x7fb56a, 0.45);
    scene.add(hemiLight);
    ambLight = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambLight);
    sunLight = new THREE.DirectionalLight(0xfff2d8, 0.95);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 240;
    const S = 46;
    sunLight.shadow.camera.left = -S;
    sunLight.shadow.camera.right = S;
    sunLight.shadow.camera.top = S;
    sunLight.shadow.camera.bottom = -S;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // ---- world ----
    K.Sky.init(scene);
    K.Ocean.init(scene);
    K.Island.init(scene);
    K.Nature.init(scene);
    K.Effects.init(scene);

    // ---- player ----
    player = K.Characters.buildBunny();
    playerState = {
      pos: new THREE.Vector3(4, K.groundHeight(4, 30), 30),
      vel: new THREE.Vector3(),
      heading: Math.PI,
      grounded: true,
      swimming: false,
      splashCool: 0,
    };
    player.group.position.copy(playerState.pos);
    scene.add(player.group);

    spawnStars();
    spawnGifts();
    spawnFriends();

    // ---- UI & input ----
    K.UI.init(onStart);
    K.Input.init();

    window.addEventListener("resize", onResize);
    onResize();

    clock = new THREE.Clock();
    renderer.setAnimationLoop(tick);
  }

  function onStart() {
    started = true;
    K.Audio.init();
    K.Audio.resume();
    setTimeout(() => K.UI.banner("⭐ おほしさまを あつめよう！", 3000), 800);
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // portrait needs a wider vertical view to see the world
    camera.fov = h > w ? 66 : 55;
    camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------
  // collectible stars
  // ------------------------------------------------------------
  function starGeometry() {
    const shape = new THREE.Shape();
    const R = 0.55, r = 0.24;
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.22, bevelEnabled: true, bevelThickness: 0.06,
      bevelSize: 0.06, bevelSegments: 2,
    });
  }

  function spawnStars() {
    const geo = starGeometry();
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffd54a, emissive: 0xffaa22, emissiveIntensity: 0.55,
    });
    const glowTex = K.Sky.makeGlowTexture("#fff0a0");

    const spots = [];
    // scattered across walkable land
    let guard = 0;
    while (spots.length < 40 && guard++ < 2000) {
      const x = K.rand(-80, 80), z = K.rand(-80, 80);
      const h = K.groundHeight(x, z);
      if (h < 1 || h > 16) continue;
      spots.push([x, z, h + 1.4]);
    }
    // a trail along the rainbow bridge
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      const x = K.lerp(46, 68, t), z = K.lerp(-26, -52, t);
      const ph = K.platformHeight(x, z);
      if (ph !== null) spots.push([x, z, ph + 1.6]);
    }
    // a crown ring on the floating island
    const F = K.Island.FLOAT;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      spots.push([F.x + Math.cos(a) * 8, F.z + Math.sin(a) * 8, F.y + 1.6]);
    }
    // rewards floating above each mushroom trampoline
    for (const pad of K.bouncePads) {
      spots.push([pad.x, pad.z, pad.y + 6.5]);
      spots.push([pad.x + 1.5, pad.z, pad.y + 9.0]);
    }

    for (const [x, z, y] of spots) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = Math.random() * Math.PI;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xffcc44, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(2.1, 2.1, 1);
      mesh.add(glow);
      scene.add(mesh);
      stars.push({ mesh, taken: false, baseY: y, phase: Math.random() * 10 });
    }
  }

  function respawnStars() {
    for (const s of stars) {
      s.taken = false;
      s.mesh.visible = true;
    }
  }

  // ------------------------------------------------------------
  // gift boxes
  // ------------------------------------------------------------
  function spawnGifts() {
    const spots = [[0, 22], [22, 62], [-46, -8], [44, 22]];
    for (const [x, z] of spots) {
      const y = K.groundHeight(x, z);
      if (y < 0.5) continue;
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      const col = K.pick(K.PAL.balloonCols);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.3, 1.6),
        new THREE.MeshLambertMaterial({ color: col })
      );
      box.position.y = 0.65;
      box.castShadow = true;
      grp.add(box);
      const ribbonMat = new THREE.MeshLambertMaterial({ color: 0xfff3b8 });
      const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.36, 1.66), ribbonMat);
      rib1.position.y = 0.65; grp.add(rib1);
      const rib2 = new THREE.Mesh(new THREE.BoxGeometry(1.66, 1.36, 0.3), ribbonMat);
      rib2.position.y = 0.65; grp.add(rib2);
      const bow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), ribbonMat);
      bow.scale.set(1.4, 0.7, 1.4); bow.position.y = 1.45; grp.add(bow);
      scene.add(grp);
      gifts.push({ grp, opened: false, x, z, y });
    }
  }

  function openGift(g) {
    g.opened = true;
    K.Audio.sfxPop();
    K.Audio.sfxFanfare();
    K.Effects.confettiBurst(g.grp.position);
    K.Effects.balloonRelease(g.grp.position, 5);
    K.UI.banner("🎁 プレゼント！ わーい！", 2400);
    // the box pops away
    g.grp.visible = false;
    // bonus ring of stars around the box
    const geoDone = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = g.x + Math.cos(a) * 3.2, z = g.z + Math.sin(a) * 3.2;
      const h = Math.max(K.groundHeight(x, z), g.y) + 1.4;
      const src = stars.find(s => s.taken && !geoDone.includes(s));
      if (src) { // recycle collected stars as the bonus ring
        geoDone.push(src);
        src.taken = false;
        src.mesh.visible = true;
        src.mesh.position.set(x, h, z);
        src.baseY = h;
      }
    }
  }

  // ------------------------------------------------------------
  // friends
  // ------------------------------------------------------------
  function spawnFriends() {
    K.Characters.FRIENDS.forEach((def, i) => {
      const built = def.build();
      const y = def.floatIsland
        ? K.Island.FLOAT.y
        : Math.max(K.groundHeight(def.x, def.z), 0.3);
      built.group.position.set(def.x, y, def.z);
      scene.add(built.group);

      // a beacon of sparkles so kids can spot friends from afar
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: K.Sky.makeGlowTexture("#ffe9f5"), color: 0xffc7e0,
        transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(4.5, 4.5, 1);
      glow.position.y = 2.2;
      built.group.add(glow);

      friends.push({
        def, built, found: false, index: i,
        pos: built.group.position,
        glow,
      });
    });
  }

  function findFriend(f) {
    f.found = true;
    friendsFound++;
    f.glow.material.opacity = 0;
    K.Audio.sfxFanfare();
    K.Effects.heartBurst(f.pos);
    K.Effects.confettiBurst(f.pos);
    K.UI.foundFriend(f.index);
    K.UI.banner(`${f.def.emoji} ${f.def.name}を みつけた！`, 2800);
    K.Effects.launchFirework(f.pos.x + 10, f.pos.z + 10);

    if (friendsFound >= K.Characters.FRIENDS.length && !allDone) {
      allDone = true;
      setTimeout(() => {
        K.UI.celebrate();
        K.Effects.celebrate(14);
        K.Effects.balloonRelease(playerState.pos, 10);
        K.Audio.sfxFanfare();
        setTimeout(() => K.Audio.sfxFanfare(), 600);
      }, 1600);
    }
  }

  // friends walk in a parade behind the player once found
  function updateFriends(t, dt) {
    let leaderPos = playerState.pos;
    let leaderHeading = playerState.heading;
    let chain = 0;
    for (const f of friends) {
      if (!f.found) {
        f.built.animate(t, "idle");
        // pulse the beacon
        f.glow.material.opacity = 0.35 + Math.sin(t * 3) * 0.18;
        // found when the player gets close
        if (f.pos.distanceTo(playerState.pos) < 3.2) findFriend(f);
        continue;
      }
      chain++;
      const gap = 2.4;
      const tx = leaderPos.x - Math.sin(leaderHeading) * gap;
      const tz = leaderPos.z - Math.cos(leaderHeading) * gap;
      const dx = tx - f.pos.x, dz = tz - f.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.4) {
        const sp = Math.min(dist * 3.2, C.PLAYER_SPEED * 1.15);
        f.pos.x += (dx / dist) * sp * dt;
        f.pos.z += (dz / dist) * sp * dt;
        f.built.group.rotation.y = Math.atan2(dx, dz);
        f.built.animate(t, "follow");
      } else {
        f.built.animate(t, "idle");
      }
      // stand on whatever surface is below
      const ph = K.platformHeight(f.pos.x, f.pos.z);
      let gy = K.groundHeight(f.pos.x, f.pos.z);
      if (ph !== null && ph <= playerState.pos.y + 1.5) gy = Math.max(gy, ph);
      f.pos.y = K.damp(f.pos.y, Math.max(gy, 0), 10, dt);
      leaderPos = f.pos;
      leaderHeading = f.built.group.rotation.y;
    }
  }

  // ------------------------------------------------------------
  // player physics
  // ------------------------------------------------------------
  function supportHeight(x, z, y) {
    let s = K.groundHeight(x, z);
    for (const p of K.platforms) {
      const h = p.heightAt(x, z);
      if (h !== null && h <= y + 0.7 && h > s) s = h;
    }
    return s;
  }

  function updatePlayer(t, dt) {
    const P = playerState;
    const inp = K.Input;

    // camera-relative move direction
    const mx = inp.moveX, my = inp.moveY;
    const mag = K.clamp(Math.hypot(mx, my), 0, 1);
    let vx = 0, vz = 0;
    if (mag > 0.01) {
      const ang = Math.atan2(mx, -my) + camYaw;
      const speed = C.PLAYER_SPEED * mag * (P.swimming ? 0.45 : 1);
      vx = Math.sin(ang) * speed;
      vz = Math.cos(ang) * speed;
      P.heading = ang;
    }
    P.pos.x += vx * dt;
    P.pos.z += vz * dt;

    // stay inside the world circle
    const rr = Math.hypot(P.pos.x, P.pos.z);
    if (rr > 130) {
      P.pos.x *= 130 / rr;
      P.pos.z *= 130 / rr;
    }

    // vertical
    const ground = supportHeight(P.pos.x, P.pos.z, P.pos.y);
    const terrain = K.groundHeight(P.pos.x, P.pos.z);

    P.swimming = terrain < -0.6 && ground === terrain;
    if (P.swimming) {
      // gentle paddling on the surface, drifting home
      P.pos.y = K.damp(P.pos.y, -0.25 + Math.sin(t * 3) * 0.12, 8, dt);
      P.vel.y = 0;
      P.grounded = false;
      const toHome = Math.hypot(P.pos.x, P.pos.z);
      if (mag < 0.05 && toHome > 1) {
        // slowly float back toward the island if not paddling
        P.pos.x -= (P.pos.x / toHome) * 2.2 * dt;
        P.pos.z -= (P.pos.z / toHome) * 2.2 * dt;
      }
      P.splashCool -= dt;
      if (P.splashCool <= 0) {
        K.Effects.splash(P.pos);
        P.splashCool = 0.55;
      }
      if (K.Input.consumeJump()) {
        P.vel.y = C.PLAYER_JUMP * 0.7;
        P.pos.y += 0.3;
        P.swimming = false;
        K.Audio.sfxJump();
      }
    } else {
      P.vel.y += C.GRAVITY * dt;
      P.pos.y += P.vel.y * dt;

      const wasAir = !P.grounded;
      if (P.pos.y <= ground) {
        P.pos.y = ground;
        if (P.vel.y < -14) K.Effects.jumpPuff(P.pos); // landing poof
        if (P.vel.y < -3 && terrain < 0.3 && ground === terrain) {
          K.Audio.sfxSplash();
          K.Effects.splash(P.pos);
        }
        P.vel.y = 0;
        P.grounded = true;

        // bounce pads!
        if (wasAir) {
          for (const pad of K.bouncePads) {
            const dxp = P.pos.x - pad.x, dzp = P.pos.z - pad.z;
            if (dxp * dxp + dzp * dzp < pad.r * pad.r &&
                Math.abs(P.pos.y - pad.y) < 1) {
              P.vel.y = C.SUPER_JUMP;
              P.grounded = false;
              K.Audio.sfxBoing();
              K.Effects.jumpPuff(P.pos);
              const cap = pad.group.userData.cap;
              if (cap) {
                cap.scale.y = 0.4; // squash, restored below
              }
              break;
            }
          }
        }
      } else if (P.pos.y > ground + 0.05) {
        P.grounded = false;
      }

      if (P.grounded && K.Input.consumeJump()) {
        P.vel.y = C.PLAYER_JUMP;
        P.grounded = false;
        K.Audio.sfxJump();
        K.Effects.jumpPuff(P.pos);
      }
    }

    // mushroom caps spring back
    for (const pad of K.bouncePads) {
      const cap = pad.group.userData.cap;
      if (cap && cap.scale.y < 0.75) {
        cap.scale.y = Math.min(cap.scale.y + dt * 1.5, 0.75);
      }
    }

    // face travel direction, smoothed
    player.group.position.copy(P.pos);
    let dy = P.heading - player.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    player.group.rotation.y += dy * Math.min(dt * 12, 1);

    // animation + pixie trail
    const speed01 = mag;
    if (!P.grounded && !P.swimming) {
      player.animate(t, "air", speed01);
    } else if (speed01 > 0.05) {
      player.animate(t, "run", speed01);
      K.Effects.runTrail(P.pos, dt, speed01);
    } else {
      player.animate(t, "idle", 0);
    }
  }

  // ------------------------------------------------------------
  // camera
  // ------------------------------------------------------------
  const camPos = new THREE.Vector3(4, 12, 48);
  function updateCamera(dt) {
    const P = playerState;
    // yaw lazily follows the player's heading while moving
    const mag = Math.hypot(K.Input.moveX, K.Input.moveY);
    if (mag > 0.1) {
      let dy = P.heading - camYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      camYaw += dy * Math.min(dt * 1.6, 1);
    }
    const portrait = window.innerHeight > window.innerWidth;
    const dist = portrait ? C.CAM_DIST_PORTRAIT : C.CAM_DIST_LANDSCAPE;
    const tx = P.pos.x - Math.sin(camYaw) * dist;
    const tz = P.pos.z - Math.cos(camYaw) * dist;
    let ty = P.pos.y + C.CAM_HEIGHT;

    camPos.x = K.damp(camPos.x, tx, 4, dt);
    camPos.y = K.damp(camPos.y, ty, 4, dt);
    camPos.z = K.damp(camPos.z, tz, 4, dt);

    // keep the camera out of the hills
    const camGround = K.groundHeight(camPos.x, camPos.z) + 1.6;
    if (camPos.y < camGround) camPos.y = camGround;

    camera.position.copy(camPos);
    camera.lookAt(P.pos.x, P.pos.y + 2.4, P.pos.z);
  }

  // ------------------------------------------------------------
  // collectibles update
  // ------------------------------------------------------------
  function updateStars(t, dt) {
    comboTimer -= dt;
    if (comboTimer <= 0) starCombo = 0;

    let remaining = 0;
    for (const s of stars) {
      if (s.taken) continue;
      remaining++;
      s.mesh.rotation.y += dt * 2;
      s.mesh.position.y = s.baseY + Math.sin(t * 2 + s.phase) * 0.25;

      const d = s.mesh.position.distanceTo(playerState.pos);
      if (d < 2.0) {
        s.taken = true;
        s.mesh.visible = false;
        starCount++;
        starCombo++;
        comboTimer = 2.5;
        K.Audio.sfxStar(starCombo);
        K.Effects.starBurst(s.mesh.position);
        K.UI.setStars(starCount);
        if (starCount % 10 === 0) {
          K.UI.banner(`⭐ すごい！ ${starCount}こ あつめたよ！`, 2200);
          K.Effects.launchFirework(playerState.pos.x + 14, playerState.pos.z);
        }
      }
    }
    // collected them all? sprinkle a fresh batch
    if (remaining === 0 && stars.length > 0) {
      respawnStars();
      K.UI.banner("🌟 おほしさま おかわり！", 2600);
    }

    for (const g of gifts) {
      if (g.opened) continue;
      g.grp.rotation.y = Math.sin(t * 1.4) * 0.12;
      g.grp.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
      const d = g.grp.position.distanceTo(playerState.pos);
      if (d < 2.4) openGift(g);
    }
  }

  // ------------------------------------------------------------
  // main loop
  // ------------------------------------------------------------
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // sky & lighting always alive (title screen shows the island too)
    dayTime += dt;
    const phase = (dayTime / C.DAY_LENGTH) % 1;
    const sky = K.Sky.update(t, phase, camPos, scene);

    // fog follows the mood; night pulls it closer & darker
    const fogNear = 70 - sky.nightW * 25;
    const fogFar = 350 - sky.nightW * 110;
    scene.fog.color.copy(sky.fogColor);
    scene.fog.near = fogNear;
    scene.fog.far = fogFar;

    sunLight.color.copy(sky.lightColor);
    sunLight.intensity = sky.lightIntensity * 0.9;
    ambLight.intensity = sky.ambientIntensity * 0.4;
    hemiLight.intensity = sky.ambientIntensity;
    hemiLight.color.copy(sky.fogColor).lerp(new THREE.Color(0xffffff), 0.4);

    // sun (or moon at night) drives the shadow light, following the player
    const lightDir = sky.sunDir.clone();
    if (lightDir.y < 0.08) lightDir.y = 0.08; // keep shadows sane at dusk
    sunLight.position
      .copy(playerState.pos)
      .addScaledVector(lightDir.normalize(), 110);
    sunLight.target.position.copy(playerState.pos);

    K.Ocean.update(t, sky, fogNear, fogFar);
    K.Island.update(t, dt, sky);
    K.Nature.update(t, dt);
    K.Effects.update(t, dt, playerState.pos, sky);

    if (started) {
      updatePlayer(t, dt);
      updateFriends(t, dt);
      updateStars(t, dt);
    } else {
      // idle bunny on the title screen, world already alive
      player.animate(t, "idle", 0);
    }
    updateCamera(dt);

    renderer.render(scene, camera);
  }

  // tiny debug handle (used by automated tests)
  K._debug = {
    get player() { return playerState; },
    teleport(x, z) {
      const ph = K.platformHeight(x, z);
      let y = Math.max(K.groundHeight(x, z), 0);
      if (ph !== null) y = Math.max(y, ph);
      playerState.pos.set(x, y + 0.5, z);
      playerState.vel.set(0, 0, 0);
    },
  };

  // go!
  init();

})(window.KIRA);
