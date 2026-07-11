/* ============================================================
   ocean.js — a living, glittering sea.
   Gerstner-ish rolling waves in the vertex shader; in the
   fragment shader: turquoise shallows fading to deep blue,
   an animated foam ring hugging the beach, thousands of
   sun-glints that follow the day/night cycle, and a fresnel
   sky reflection so the water always matches the mood.
   ============================================================ */

(function (K) {
  "use strict";

  const Ocean = {};
  K.Ocean = Ocean;

  let mesh, uniforms;

  Ocean.init = function (scene) {
    uniforms = {
      uTime:     { value: 0 },
      uNight:    { value: 0 },
      uSkyColor: { value: new THREE.Color(0xbdeafc) },
      uSunDir:   { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xfff3c8) },
      uShallow:  { value: new THREE.Color(0x46d4d0) },
      uDeep:     { value: new THREE.Color(0x1359a8) },
      uFogColor: { value: new THREE.Color(0xbdeafc) },
      uFogNear:  { value: 60 },
      uFogFar:   { value: 340 },
    };

    const geo = new THREE.PlaneGeometry(
      K.CONFIG.WORLD_SIZE, K.CONFIG.WORLD_SIZE, 150, 150
    );
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        varying float vWave;
        void main() {
          vec3 p = position;
          float d = length(p.xz);
          // three overlapping wave trains, calmer far away
          float w =
              sin(p.x * 0.10 + uTime * 1.1) * 0.32
            + sin(p.z * 0.13 - uTime * 0.9) * 0.26
            + sin((p.x + p.z) * 0.055 + uTime * 0.6) * 0.42;
          w *= smoothstep(420.0, 120.0, d) * 0.65 + 0.35;
          p.y += w;
          vWave = w;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform float uNight;
        uniform vec3 uSkyColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec3 vWorld;
        varying float vWave;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          float r = length(vWorld.xz);

          // shore shaping (island radius ~92, wobble the edge organically)
          float wob = sin(atan(vWorld.z, vWorld.x) * 7.0) * 3.0
                    + sin(atan(vWorld.z, vWorld.x) * 13.0 + 2.1) * 1.6;
          float shoreR = 88.0 + wob;

          // depth colour: turquoise near the beach, deep blue offshore
          float shallowT = smoothstep(shoreR + 46.0, shoreR - 6.0, r);
          vec3 col = mix(uDeep, uShallow, shallowT);

          // day/night grade
          col = mix(col, col * vec3(0.16, 0.22, 0.42) + vec3(0.02, 0.03, 0.10), uNight);

          // fresnel-ish blend towards the sky at grazing angles
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 2.2);
          col = mix(col, uSkyColor, fres * 0.55);

          // rolling highlight from the wave height
          col += vec3(0.05, 0.09, 0.10) * clamp(vWave, 0.0, 1.0) * (1.0 - uNight * 0.7);

          // ---- sparkling glints ----
          vec2 gp = vWorld.xz * 0.9;
          vec2 cell = floor(gp);
          float h = hash(cell);
          vec2 f = fract(gp) - 0.5;
          float tw = sin(uTime * (2.0 + h * 4.0) + h * 40.0);
          float glint = smoothstep(0.22, 0.0, length(f)) * step(0.965, h) * max(tw, 0.0);
          float sunUp = clamp(uSunDir.y * 2.0, 0.05, 1.0);
          col += uSunColor * glint * 2.4 * sunUp * (1.0 - uNight * 0.35);
          // moon glitter road at night
          col += vec3(0.75, 0.8, 1.0) * glint * 1.8 * uNight;

          // ---- animated foam ring on the beach ----
          float band = r - (shoreR + sin(uTime * 0.8) * 1.8);
          float foamEdge = smoothstep(3.5, 0.6, abs(band));
          float foamNoise = step(0.35, fract(hash(cell * 3.0) + uTime * 0.12));
          float foam = foamEdge * (0.55 + 0.45 * foamNoise);
          // second, fainter ripple line further out
          float band2 = r - (shoreR + 7.0 + sin(uTime * 0.8 + 2.0) * 2.4);
          foam += smoothstep(2.0, 0.3, abs(band2)) * 0.28;
          col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * (1.0 - uNight * 0.45));

          // soft alpha at the very shoreline so sand shows through
          float alpha = mix(0.94, 0.62, smoothstep(6.0, 0.0, band));

          // manual fog (matches scene fog colour)
          float dist = length(cameraPosition - vWorld);
          float fogF = smoothstep(uFogNear, uFogFar, dist);
          col = mix(col, uFogColor, fogF);

          gl_FragColor = vec4(col, alpha);
        }`,
    });

    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = K.CONFIG.SEA_LEVEL;
    mesh.renderOrder = 1;
    scene.add(mesh);
  };

  Ocean.update = function (t, skyState, fogNear, fogFar) {
    uniforms.uTime.value = t;
    uniforms.uNight.value = skyState.nightW;
    uniforms.uSkyColor.value.copy(skyState.fogColor);
    uniforms.uSunDir.value.copy(skyState.sunDir);
    uniforms.uFogColor.value.copy(skyState.fogColor);
    uniforms.uFogNear.value = fogNear;
    uniforms.uFogFar.value = fogFar;
  };

})(window.KIRA);
