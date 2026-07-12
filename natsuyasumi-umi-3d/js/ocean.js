/* ============================================================
   ocean.js — 海
   うねる波 / 深さで変わる色 / 太陽のきらめき / 岸辺の白い泡
   JS 側の islandHeight と同じ式を GLSL に移植して浅瀬を判定
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  const vert = `
    uniform float uTime;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying float vShallow;  // 0=ふかい 1=あさい
    varying float vFoam;     // 岸の泡

    float smootherstep(float a, float b, float x) {
      float t = clamp((x - a) / (b - a), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }

    // JS 側 G.islandHeight と同じ形
    float islandH(vec2 p) {
      float d = sqrt(p.x * p.x * 0.85 + p.y * p.y * 1.18);
      float core = 1.0 - smootherstep(16.0, 44.0, d);
      float h = 6.0 * pow(core, 1.35);
      vec2 hp = p - vec2(-15.0, -17.0);
      h += 7.0 * exp(-dot(hp, hp) / 110.0);
      h += 0.55 * sin(p.x * 0.32 + 1.7) * sin(p.y * 0.27) * clamp(core * 2.2, 0.0, 1.0);
      h -= 2.6 * smootherstep(44.0, 56.0, d);
      h -= 3.5 * smootherstep(56.0, 95.0, d);
      return h;
    }

    // 3方向の波の合成
    float waveH(vec2 p, float t) {
      float h = 0.0;
      h += 0.22 * sin(dot(p, vec2(0.14, 0.10)) + t * 1.1);
      h += 0.14 * sin(dot(p, vec2(-0.10, 0.17)) + t * 1.55);
      h += 0.08 * sin(dot(p, vec2(0.28, -0.22)) + t * 2.3);
      return h;
    }

    void main() {
      vec3 pos = position;
      vec2 wp = (modelMatrix * vec4(position, 1.0)).xz;

      float ih = islandH(wp);
      float depth = max(-ih, 0.0);
      vShallow = 1.0 - clamp(depth / 3.0, 0.0, 1.0);

      // 浅瀬ほど波をおだやかに（打ち寄せる感じは泡で出す）
      float amp = mix(1.0, 0.35, vShallow);
      float h = waveH(wp, uTime) * amp;
      pos.z += h; // plane はローカルで z が上（回転前）

      // 法線を近傍差分で
      float e = 1.2;
      float hx = waveH(wp + vec2(e, 0.0), uTime) * amp;
      float hz = waveH(wp + vec2(0.0, e), uTime) * amp;
      vNormal = normalize(vec3(h - hx, e * 0.9, h - hz));

      // 岸の泡：波打ち際で 呼吸するようにいったりきたり
      float edge = 1.0 - clamp(abs(ih + 0.15) / 0.9, 0.0, 1.0);
      float pulse = 0.6 + 0.4 * sin(uTime * 0.9 + wp.x * 0.08 + wp.y * 0.06);
      vFoam = edge * pulse;

      vec4 world = modelMatrix * vec4(pos, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;

  const frag = `
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uSkyColor;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uTime;
    uniform float uNight;
    uniform sampler2D uNoise;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying float vShallow;
    varying float vFoam;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(cameraPosition - vWorld);

      // 深さの色
      vec3 col = mix(uDeep, uShallow, vShallow * vShallow);

      // フレネル：視線が浅いほど空の色
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
      col = mix(col, uSkyColor, fres * 0.5);

      // 太陽（月）の反射スパークル
      vec3 R = reflect(-normalize(uSunDir), N);
      float spec = pow(max(dot(R, V), 0.0), 140.0);
      float n1 = texture2D(uNoise, vWorld.xz * 0.06 + vec2(uTime * 0.02, uTime * 0.013)).r;
      float n2 = texture2D(uNoise, vWorld.xz * 0.11 - vec2(uTime * 0.017, uTime * 0.021)).r;
      float glitter = smoothstep(0.72, 0.95, n1 * n2 * 1.9);
      col += uSunColor * spec * (2.2 + glitter * 5.0);

      // 広いサンロード（夕日・月光の帯）
      vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
      vec3 toFrag = normalize(vec3(vWorld.x - cameraPosition.x, 0.0, vWorld.z - cameraPosition.z));
      float road = pow(max(dot(sunFlat, toFrag), 0.0), 18.0) * (0.35 + uNight * 0.4);
      col += uSunColor * road * glitter * (1.0 - vShallow) * 0.8;

      // 波間のきらめき（昼のプランクトン的な微光）
      col += uShallow * glitter * 0.08 * (1.0 - uNight);

      // 泡（よるは月あかりにあわせて減光）
      float foamTex = texture2D(uNoise, vWorld.xz * 0.22 + vec2(0.0, uTime * 0.05)).r;
      float foam = vFoam * smoothstep(0.35, 0.75, foamTex + vFoam * 0.35);
      vec3 foamCol = vec3(1.0, 1.0, 0.98) * (1.0 - uNight * 0.62);
      col = mix(col, foamCol, clamp(foam, 0.0, 0.9));

      float alpha = mix(0.93, 0.72, vShallow);
      gl_FragColor = vec4(col, alpha);

      // fog
      #ifdef USE_FOG
      #endif
    }`;

  G.createOcean = function (scene) {
    const uniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x0a63a0) },
      uShallow: { value: new THREE.Color(0x2fd6c8) },
      uSkyColor: { value: new THREE.Color(0xaad9f2) },
      uSunColor: { value: new THREE.Color(0xfffbe8) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
      uNoise: { value: G.noiseTexture(256) },
    };

    const geo = new THREE.PlaneGeometry(620, 620, 190, 190);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);

    return {
      mesh,
      update(dt, elapsed) {
        uniforms.uTime.value = elapsed;
        uniforms.uDeep.value.copy(G.env.waterDeep || uniforms.uDeep.value);
        uniforms.uShallow.value.copy(G.env.waterShallow || uniforms.uShallow.value);
        uniforms.uSkyColor.value.copy(G.env.skyHorizon);
        uniforms.uSunColor.value.copy(G.env.sunColor);
        uniforms.uSunDir.value.copy(G.env.sunDir);
        uniforms.uNight.value = G.env.nightGlow;
        // 夜は月の反射に
        if (G.env.nightGlow > 0.6) {
          uniforms.uSunColor.value.set(0xcfe0ff);
        }
      },
      // うきの高さなどに使う波の高さ（GLSLと同じ式）
      waveHeight(x, z, elapsed) {
        let h = 0;
        h += 0.22 * Math.sin(x * 0.14 + z * 0.10 + elapsed * 1.1);
        h += 0.14 * Math.sin(-x * 0.10 + z * 0.17 + elapsed * 1.55);
        h += 0.08 * Math.sin(x * 0.28 - z * 0.22 + elapsed * 2.3);
        const ih = G.islandHeight(x, z);
        const shallow = 1 - G.clamp(Math.max(-ih, 0) / 3, 0, 1);
        return h * G.lerp(1, 0.35, shallow);
      },
    };
  };
})();
