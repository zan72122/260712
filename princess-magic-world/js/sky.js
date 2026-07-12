// ============================================================
// 空と光 — グラデーションの空・太陽・月・星・雲・昼夕夜の移り変わり
// ============================================================
import * as THREE from 'three';
import { rand, damp } from './utils.js';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uMoonDir;
  uniform float uNight;
  uniform float uSunsetGlow;
  uniform float uTime;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col;
    if (h > 0.12) {
      col = mix(uMid, uTop, smoothstep(0.12, 0.8, h));
    } else {
      col = mix(uBottom, uMid, smoothstep(-0.2, 0.12, h));
    }

    // 太陽（昼〜夕）
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColor * pow(sd, 700.0) * 2.2;      // 太陽の円盤
    col += uSunColor * pow(sd, 24.0) * 0.30;      // ハロー
    col += uSunColor * pow(sd, 3.0) * 0.22 * uSunsetGlow; // 夕焼けの広がり

    // 月（夜）
    float md = max(dot(d, normalize(uMoonDir)), 0.0);
    vec3 moonCol = vec3(0.92, 0.96, 1.0);
    col += moonCol * pow(md, 1400.0) * 2.4 * uNight;
    col += moonCol * pow(md, 40.0) * 0.22 * uNight;

    // 星（夜だけ、チカチカまたたく）
    if (uNight > 0.02 && d.y > -0.05) {
      vec2 uv = vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0)));
      uv *= vec2(26.0, 16.0);
      vec2 id = floor(uv);
      vec2 f = fract(uv);
      float star = hash21(id);
      vec2 sp = vec2(hash21(id + 7.13), hash21(id + 3.71)) * 0.7 + 0.15;
      float dist = length(f - sp);
      float tw = 0.55 + 0.45 * sin(uTime * (1.0 + star * 2.5) + star * 43.0);
      float s = smoothstep(0.10, 0.0, dist) * step(0.68, star) * tw;
      col += vec3(1.0, 0.96, 0.88) * s * uNight * smoothstep(-0.02, 0.25, d.y) * 1.6;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 昼・夕・夜のカラーパレット
const PHASES = {
  day: {
    top: 0x3f8ef0, mid: 0xa8dcff, bottom: 0xfff0dc,
    fog: 0xcfe9ff, fogNear: 42, fogFar: 150,
    sun: 0xfff3d0, sunIntensity: 2.4,
    hemiSky: 0xbfe3ff, hemiGround: 0xffe9c9, hemiIntensity: 0.95,
    sunPos: new THREE.Vector3(28, 42, 22),
    night: 0, sunsetGlow: 0.12, cloud: 0.92, rainbow: 0.5,
    exposure: 1.05,
  },
  sunset: {
    top: 0x3b3f96, mid: 0xff9d72, bottom: 0xffd9a0,
    fog: 0xf2ab84, fogNear: 38, fogFar: 140,
    sun: 0xffb36b, sunIntensity: 1.7,
    hemiSky: 0xd6a8e8, hemiGround: 0xffc490, hemiIntensity: 0.8,
    sunPos: new THREE.Vector3(-20, 7, -40),
    night: 0, sunsetGlow: 1.0, cloud: 0.85, rainbow: 0.22,
    exposure: 1.05,
  },
  night: {
    top: 0x0a1034, mid: 0x22306e, bottom: 0x40549a,
    fog: 0x1b2550, fogNear: 34, fogFar: 130,
    sun: 0x9db8e8, sunIntensity: 0.55,
    hemiSky: 0x5b6fc4, hemiGround: 0x2e3a70, hemiIntensity: 0.62,
    sunPos: new THREE.Vector3(24, 34, -34), // 夜は月の位置として使う
    night: 1, sunsetGlow: 0, cloud: 0.28, rainbow: 0.06,
    exposure: 1.0,
  },
};

const PHASE_ORDER = ['day', 'sunset', 'night'];
const WHITE = new THREE.Color(0xffffff);

export class SkyAndLights {
  constructor(ctx) {
    this.ctx = ctx;
    const scene = ctx.scene;
    this.phase = 'day';

    // ---- 空のドーム ----
    this.uniforms = {
      uTop: { value: new THREE.Color(PHASES.day.top) },
      uMid: { value: new THREE.Color(PHASES.day.mid) },
      uBottom: { value: new THREE.Color(PHASES.day.bottom) },
      uSunDir: { value: PHASES.day.sunPos.clone().normalize() },
      uSunColor: { value: new THREE.Color(PHASES.day.sun) },
      uMoonDir: { value: new THREE.Vector3(0.4, 0.6, -0.6).normalize() },
      uNight: { value: 0 },
      uSunsetGlow: { value: 0.12 },
      uTime: { value: 0 },
    };
    const skyGeo = new THREE.SphereGeometry(200, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(skyGeo, skyMat);
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // ---- ライト ----
    this.hemi = new THREE.HemisphereLight(PHASES.day.hemiSky, PHASES.day.hemiGround, PHASES.day.hemiIntensity);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(PHASES.day.sun, PHASES.day.sunIntensity);
    this.sun.position.copy(PHASES.day.sunPos);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.4;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // ---- 霧 ----
    scene.fog = new THREE.Fog(PHASES.day.fog, PHASES.day.fogNear, PHASES.day.fogFar);

    // ---- ふわふわの雲 ----
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, transparent: true, opacity: 0.92,
      emissive: 0xffffff, emissiveIntensity: 0.18,
    });
    for (let i = 0; i < 10; i++) {
      const group = new THREE.Group();
      const mat = cloudMat.clone();
      const blobs = 3 + Math.floor(rand(3));
      for (let b = 0; b < blobs; b++) {
        const r = rand(2.2, 4.6);
        const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
        blob.position.set(rand(-4.5, 4.5), rand(-0.8, 0.8), rand(-1.8, 1.8));
        blob.scale.y = 0.55;
        group.add(blob);
      }
      const angle = rand(Math.PI * 2);
      const radius = rand(55, 95);
      group.position.set(Math.cos(angle) * radius, rand(26, 44), Math.sin(angle) * radius);
      group.userData = { speed: rand(0.4, 1.1), mat };
      this.clouds.push(group);
      ctx.scene.add(group);
    }

    // 現在値（なめらかに遷移させるための状態）
    this.cur = {
      top: new THREE.Color(PHASES.day.top),
      mid: new THREE.Color(PHASES.day.mid),
      bottom: new THREE.Color(PHASES.day.bottom),
      fog: new THREE.Color(PHASES.day.fog),
      sun: new THREE.Color(PHASES.day.sun),
      hemiSky: new THREE.Color(PHASES.day.hemiSky),
      hemiGround: new THREE.Color(PHASES.day.hemiGround),
      sunPos: PHASES.day.sunPos.clone(),
      sunIntensity: PHASES.day.sunIntensity,
      hemiIntensity: PHASES.day.hemiIntensity,
      night: 0, sunsetGlow: 0.12, cloud: 0.92, rainbow: 0.5,
      fogNear: PHASES.day.fogNear, fogFar: PHASES.day.fogFar,
    };

    // 遷移先パレットを THREE.Color に変換してキャッシュ（毎フレームの生成を避ける）
    this._pal = {};
    for (const [name, p] of Object.entries(PHASES)) {
      this._pal[name] = {
        ...p,
        top: new THREE.Color(p.top),
        mid: new THREE.Color(p.mid),
        bottom: new THREE.Color(p.bottom),
        fog: new THREE.Color(p.fog),
        sun: new THREE.Color(p.sun),
        hemiSky: new THREE.Color(p.hemiSky),
        hemiGround: new THREE.Color(p.hemiGround),
      };
    }
  }

  // ☀️→🌇→🌙 と順番に切り替え。戻り値は新しいフェーズ名
  cyclePhase() {
    const idx = (PHASE_ORDER.indexOf(this.phase) + 1) % PHASE_ORDER.length;
    this.phase = PHASE_ORDER[idx];
    return this.phase;
  }

  get nightFactor() { return this.cur.night; }
  get rainbowOpacity() { return this.cur.rainbow; }

  update(dt, time) {
    const target = this._pal[this.phase];
    const cur = this.cur;
    const k = 1 - Math.exp(-1.6 * dt); // 遷移スピード

    cur.top.lerp(target.top, k);
    cur.mid.lerp(target.mid, k);
    cur.bottom.lerp(target.bottom, k);
    cur.fog.lerp(target.fog, k);
    cur.sun.lerp(target.sun, k);
    cur.hemiSky.lerp(target.hemiSky, k);
    cur.hemiGround.lerp(target.hemiGround, k);
    cur.sunPos.lerp(target.sunPos, k);
    cur.sunIntensity = damp(cur.sunIntensity, target.sunIntensity, 1.6, dt);
    cur.hemiIntensity = damp(cur.hemiIntensity, target.hemiIntensity, 1.6, dt);
    cur.night = damp(cur.night, target.night, 1.6, dt);
    cur.sunsetGlow = damp(cur.sunsetGlow, target.sunsetGlow, 1.6, dt);
    cur.cloud = damp(cur.cloud, target.cloud, 1.6, dt);
    cur.rainbow = damp(cur.rainbow, target.rainbow, 1.6, dt);
    cur.fogNear = damp(cur.fogNear, target.fogNear, 1.6, dt);
    cur.fogFar = damp(cur.fogFar, target.fogFar, 1.6, dt);

    // 空シェーダーへ反映
    const u = this.uniforms;
    u.uTop.value.copy(cur.top);
    u.uMid.value.copy(cur.mid);
    u.uBottom.value.copy(cur.bottom);
    u.uSunColor.value.copy(cur.sun);
    u.uSunDir.value.copy(cur.sunPos).normalize();
    u.uNight.value = cur.night;
    u.uSunsetGlow.value = cur.sunsetGlow;
    u.uTime.value = time;

    // ライト
    this.sun.color.copy(cur.sun);
    this.sun.intensity = cur.sunIntensity;
    this.sun.position.copy(cur.sunPos);
    this.hemi.color.copy(cur.hemiSky);
    this.hemi.groundColor.copy(cur.hemiGround);
    this.hemi.intensity = cur.hemiIntensity;

    // 霧
    const fog = this.ctx.scene.fog;
    fog.color.copy(cur.fog);
    fog.near = cur.fogNear;
    fog.far = cur.fogFar;

    // 雲をゆっくり流す
    for (const c of this.clouds) {
      c.rotation.y += 0.002 * dt * c.userData.speed;
      const p = c.position;
      const a = Math.atan2(p.z, p.x) + dt * 0.006 * c.userData.speed;
      const r = Math.sqrt(p.x * p.x + p.z * p.z);
      p.x = Math.cos(a) * r;
      p.z = Math.sin(a) * r;
      c.userData.mat.opacity = cur.cloud;
      c.userData.mat.emissiveIntensity = 0.18 + cur.sunsetGlow * 0.25;
      c.userData.mat.color.copy(cur.mid).lerp(WHITE, 0.75);
    }
  }
}
