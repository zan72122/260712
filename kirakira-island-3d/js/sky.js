/* ============================================================
   sky.js — the mood engine of the island.
   A shader sky-dome blends sunrise → noon → golden sunset →
   starry night, with a travelling sun & moon, twinkling star
   field, drifting marshmallow clouds and shooting stars.
   Sky.update() also computes the light/fog rig for main.js.
   ============================================================ */

(function (K) {
  "use strict";

  const Sky = {};
  K.Sky = Sky;

  // key colour grades (top / horizon), blended by sun elevation
  const GRADE = {
    day:    { top: new THREE.Color(0x3fa0e8), hor: new THREE.Color(0xbdeafc) },
    sunset: { top: new THREE.Color(0x6a4fb8), hor: new THREE.Color(0xffb066) },
    night:  { top: new THREE.Color(0x0a1238), hor: new THREE.Color(0x2b3a78) },
  };

  let dome, domeUniforms, starField, moon, sunGlow;
  let clouds = [];
  let shootingStar = null, shootTimer = 5;

  Sky.init = function (scene) {
    // ---------- gradient dome ----------
    domeUniforms = {
      topColor:   { value: new THREE.Color() },
      horColor:   { value: new THREE.Color() },
      sunDir:     { value: new THREE.Vector3(0, 1, 0) },
      sunColor:   { value: new THREE.Color(0xfff3c8) },
      sunSize:    { value: 0.9994 },
      night:      { value: 0 },
    };
    const domeMat = new THREE.ShaderMaterial({
      uniforms: domeUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horColor;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        uniform float sunSize;
        uniform float night;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          // gentle gradient, extra glow hugging the horizon
          vec3 col = mix(horColor, topColor, pow(h, 0.62));
          float horizonGlow = pow(1.0 - h, 6.0) * 0.25 * (1.0 - night);
          col += horColor * horizonGlow;

          // the sun: crisp disc + big soft halo
          float s = dot(d, normalize(sunDir));
          float disc = smoothstep(sunSize, sunSize + 0.0012, s);
          float halo = pow(clamp(s, 0.0, 1.0), 24.0) * 0.55
                     + pow(clamp(s, 0.0, 1.0), 6.0) * 0.16;
          col += sunColor * (disc * 1.2 + halo) * (1.0 - night * 0.92);

          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    dome = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), domeMat);
    scene.add(dome);

    // ---------- twinkling stars ----------
    const starGeo = new THREE.BufferGeometry();
    const COUNT = 700;
    const pos = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // upper hemisphere only
      const u = Math.random(), v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - v * 0.95);
      const r = 400;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.9 + 20;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      phase[i] = Math.random() * Math.PI * 2;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        uniform float uNight;
        varying float vA;
        void main() {
          float tw = 0.55 + 0.45 * sin(uTime * 2.2 + aPhase * 7.0);
          vA = uNight * tw;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.6 + 2.2 * fract(aPhase)) * tw * 2.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.05, length(c));
          gl_FragColor = vec4(1.0, 1.0, 0.95, d * vA);
        }`,
    });
    starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ---------- moon ----------
    moon = new THREE.Mesh(
      new THREE.SphereGeometry(14, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff9e0, fog: false })
    );
    const moonGlowTex = makeGlowTexture("#fffbe8");
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonGlowTex, color: 0xfff6cf, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    moonGlow.scale.set(90, 90, 1);
    moon.add(moonGlow);
    scene.add(moon);

    // ---------- sun glow sprite (extra bloom feel) ----------
    sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture("#fff2b8"), color: 0xffe9a8, transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    sunGlow.scale.set(170, 170, 1);
    scene.add(sunGlow);

    // ---------- marshmallow clouds ----------
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, emissive: 0x9db4d8, emissiveIntensity: 0.35,
      transparent: true, opacity: 0.92, fog: false,
    });
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + ((Math.random() * 4) | 0);
      let w = 0;
      for (let p = 0; p < puffs; p++) {
        const s = K.rand(7, 14);
        const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cloudMat);
        puff.position.set(w, K.rand(-2.5, 2.5), K.rand(-4, 4));
        puff.scale.y = 0.62;
        cloud.add(puff);
        w += s * K.rand(0.75, 1.05);
      }
      const angle = Math.random() * Math.PI * 2;
      const rad = K.rand(150, 330);
      cloud.position.set(Math.cos(angle) * rad, K.rand(55, 120), Math.sin(angle) * rad);
      cloud.userData.speed = K.rand(0.8, 2.2);
      scene.add(cloud);
      clouds.push(cloud);
    }
  };

  function makeGlowTexture(colorStr) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, colorStr);
    grad.addColorStop(0.35, colorStr + "");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }
  Sky.makeGlowTexture = makeGlowTexture;

  const _c1 = new THREE.Color(), _c2 = new THREE.Color();

  // phase: 0=sunrise, 0.25=noon, 0.5=sunset, 0.75=midnight
  Sky.update = function (t, phase, camPos, scene) {
    const ang = phase * Math.PI * 2;
    const elev = Math.sin(ang);
    const sunDir = new THREE.Vector3(
      Math.cos(ang) * 0.85,
      elev,
      Math.sin(ang * 0.5) * 0.4 - 0.55
    ).normalize();

    // blend weights
    const dayW = smooth01((elev - 0.02) / 0.38);
    const nightW = smooth01((-elev - 0.06) / 0.28);
    const sunsetW = Math.max(0, 1 - dayW - nightW);

    // dome colours
    _c1.copy(GRADE.night.top).multiplyScalar(nightW)
       .add(_c2.copy(GRADE.day.top).multiplyScalar(dayW))
       .add(_c2.copy(GRADE.sunset.top).multiplyScalar(sunsetW));
    domeUniforms.topColor.value.copy(_c1);

    _c1.copy(GRADE.night.hor).multiplyScalar(nightW)
       .add(_c2.copy(GRADE.day.hor).multiplyScalar(dayW))
       .add(_c2.copy(GRADE.sunset.hor).multiplyScalar(sunsetW));
    domeUniforms.horColor.value.copy(_c1);
    const fogColor = _c1.clone();

    domeUniforms.sunDir.value.copy(sunDir);
    domeUniforms.night.value = nightW;
    domeUniforms.sunColor.value.setHSL(0.11 - sunsetW * 0.045, 0.9, 0.78 - sunsetW * 0.1);

    // dome follows the camera so the horizon never "ends"
    dome.position.copy(camPos);
    starField.position.copy(camPos);
    starField.material.uniforms.uTime.value = t;
    starField.material.uniforms.uNight.value = nightW;

    // sun sprite + moon on opposite sides
    sunGlow.position.copy(camPos).addScaledVector(sunDir, 380);
    sunGlow.material.opacity = 0.85 * (1 - nightW);
    moon.position.copy(camPos).addScaledVector(sunDir, -380);
    moon.position.y = camPos.y + Math.max(30, -elev * 340);
    moon.visible = nightW > 0.02;

    // clouds drift and take on the sky's tint
    for (const cl of clouds) {
      cl.position.x += cl.userData.speed * 0.016;
      if (cl.position.x > 360) cl.position.x = -360;
      const m = cl.children[0].material;
      m.emissive.setRGB(
        0.62 * dayW + 1.0 * sunsetW * 0.9 + 0.12 * nightW,
        0.70 * dayW + 0.55 * sunsetW + 0.14 * nightW,
        0.86 * dayW + 0.50 * sunsetW + 0.30 * nightW
      );
      m.opacity = 0.92 - nightW * 0.45;
    }

    // occasional shooting star at night
    shootTimer -= 0.016;
    if (nightW > 0.5 && shootTimer <= 0 && !shootingStar) {
      spawnShootingStar(scene, camPos);
      shootTimer = K.rand(4, 9);
    }
    if (shootingStar) {
      shootingStar.life -= 0.016;
      shootingStar.mesh.position.addScaledVector(shootingStar.vel, 0.016);
      shootingStar.mesh.material.opacity = Math.min(1, shootingStar.life * 2) * nightW;
      if (shootingStar.life <= 0) {
        scene.remove(shootingStar.mesh);
        shootingStar.mesh.geometry.dispose();
        shootingStar = null;
      }
    }

    // ---------- light rig numbers for main.js ----------
    return {
      sunDir,
      nightW, dayW, sunsetW,
      fogColor,
      lightColor: _c1.setRGB(
        1.0 * dayW + 1.0 * sunsetW + 0.35 * nightW,
        0.97 * dayW + 0.62 * sunsetW + 0.42 * nightW,
        0.88 * dayW + 0.45 * sunsetW + 0.65 * nightW
      ).clone(),
      lightIntensity: 1.15 * dayW + 0.85 * sunsetW + 0.45 * nightW,
      ambientIntensity: 0.55 * dayW + 0.45 * sunsetW + 0.42 * nightW,
    };
  };

  function spawnShootingStar(scene, camPos) {
    const geo = new THREE.BufferGeometry();
    const pts = new Float32Array([0, 0, 0, -14, 3, 0]);
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 1, fog: false,
    });
    const mesh = new THREE.Line(geo, mat);
    mesh.position.set(
      camPos.x + K.rand(-160, 160),
      camPos.y + K.rand(120, 200),
      camPos.z + K.rand(-220, -120)
    );
    scene.add(mesh);
    shootingStar = {
      mesh,
      vel: new THREE.Vector3(K.rand(40, 70), K.rand(-28, -16), 0),
      life: K.rand(1.2, 2),
    };
  }

  function smooth01(x) {
    x = K.clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  }

})(window.KIRA);
