// ============================================================
// パーティクル — キラキラ・ハート・花火・ホタル・花びら・噴水
// 1テクスチャ = 1プール（Points + カスタムシェーダー）で軽量に
// ============================================================
import * as THREE from 'three';
import { rand, pick, makeCanvasTexture } from './utils.js';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG_ADD = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * tex.a * vAlpha, 1.0);
    if (tex.a * vAlpha < 0.01) discard;
  }
`;

const FRAG_NORMAL = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

// ---------- スプライト用テクスチャ（Canvasで手描き） ----------
function starTexture() {
  return makeCanvasTexture(64, (g, s) => {
    const c = s / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    // 十字の光条
    g.globalCompositeOperation = 'lighter';
    for (const rot of [0, Math.PI / 2]) {
      g.save();
      g.translate(c, c);
      g.rotate(rot);
      const lg = g.createLinearGradient(-c, 0, c, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(-c, -1.6, s, 3.2);
      g.restore();
    }
  });
}

function heartTexture() {
  return makeCanvasTexture(64, (g, s) => {
    g.translate(s / 2, s / 2 + 4);
    const r = s * 0.22;
    g.fillStyle = '#ff5f9e';
    g.beginPath();
    g.moveTo(0, r * 1.6);
    g.bezierCurveTo(-r * 2.2, -r * 0.4, -r * 0.9, -r * 1.9, 0, -r * 0.55);
    g.bezierCurveTo(r * 0.9, -r * 1.9, r * 2.2, -r * 0.4, 0, r * 1.6);
    g.fill();
    // ハイライト
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(-r * 0.55, -r * 0.7, r * 0.34, r * 0.22, -0.6, 0, Math.PI * 2);
    g.fill();
  });
}

function petalTexture() {
  return makeCanvasTexture(48, (g, s) => {
    g.translate(s / 2, s / 2);
    const grad = g.createRadialGradient(0, 0, 1, 0, 0, s * 0.4);
    grad.addColorStop(0, '#fff0f6');
    grad.addColorStop(1, '#ffb3d1');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, 0, s * 0.42, s * 0.26, 0.7, 0, Math.PI * 2);
    g.fill();
  });
}

function dropTexture() {
  return makeCanvasTexture(32, (g, s) => {
    const c = s / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
}

// ---------- パーティクルプール ----------
class Pool {
  constructor(scene, capacity, texture, { additive = true, gravity = 0, drag = 0 } = {}) {
    this.capacity = capacity;
    this.gravity = gravity;
    this.drag = drag;
    this.cursor = 0;

    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity).fill(1e9);
    this.life = new Float32Array(capacity).fill(1);
    this.size0 = new Float32Array(capacity);
    this.col = new Float32Array(capacity * 3);
    this.mode = new Uint8Array(capacity); // 0=縮小フェード 1=キラキラ点滅 2=ふわふわ上昇 3=花びら

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3);
    this.aSize = new THREE.BufferAttribute(new Float32Array(capacity), 1);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(capacity), 1);
    this.aColor = new THREE.BufferAttribute(this.col, 3);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aColor', this.aColor);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 400);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uScale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: additive ? FRAG_ADD : FRAG_NORMAL,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);
    this.time = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, size, color, mode = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size0[i] = size;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.mode[i] = mode;
  }

  update(dt) {
    this.time += dt;
    const n = this.capacity;
    const drag = Math.exp(-this.drag * dt);
    for (let i = 0; i < n; i++) {
      if (this.age[i] >= this.life[i]) {
        if (this.aAlpha.array[i] !== 0) {
          this.aAlpha.array[i] = 0;
          this.aSize.array[i] = 0;
        }
        continue;
      }
      this.age[i] += dt;
      const t = Math.min(1, this.age[i] / this.life[i]);
      const i3 = i * 3;
      this.vel[i3 + 1] -= this.gravity * dt;
      this.vel[i3] *= drag; this.vel[i3 + 1] *= drag; this.vel[i3 + 2] *= drag;

      let px = this.pos[i3] + this.vel[i3] * dt;
      let py = this.pos[i3 + 1] + this.vel[i3 + 1] * dt;
      let pz = this.pos[i3 + 2] + this.vel[i3 + 2] * dt;

      const mode = this.mode[i];
      if (mode === 3) { // 花びら: ひらひら横揺れ
        px += Math.sin(this.time * 2.2 + i) * dt * 0.8;
        pz += Math.cos(this.time * 1.8 + i * 1.7) * dt * 0.6;
      }
      this.pos[i3] = px; this.pos[i3 + 1] = py; this.pos[i3 + 2] = pz;

      let alpha, size;
      if (mode === 1) { // キラキラ: 点滅しながらフェード
        alpha = (1 - t) * (0.55 + 0.45 * Math.sin(this.time * 14 + i * 2.4));
        size = this.size0[i] * (1 - t * 0.4);
      } else if (mode === 2) { // ハートなど: ふくらんでフェード
        alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        size = this.size0[i] * (0.6 + t * 0.7);
      } else if (mode === 3) {
        alpha = t < 0.1 ? t / 0.1 : (t > 0.8 ? (1 - t) / 0.2 : 1);
        size = this.size0[i];
      } else { // 標準: 縮みながらフェード
        alpha = 1 - t;
        size = this.size0[i] * (1 - t * 0.7);
      }
      this.aAlpha.array[i] = alpha;
      this.aSize.array[i] = size;
    }
    this.aPos.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }

  setScale(heightPx, fov) {
    this.material.uniforms.uScale.value =
      heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  }
}

// ---------- パーティクル統括 ----------
export class Particles {
  constructor(ctx) {
    this.ctx = ctx;
    const scene = ctx.scene;
    const texStar = starTexture();
    this.sparkles = new Pool(scene, 900, texStar, { additive: true, gravity: 0.35, drag: 1.2 });
    this.fireworks = new Pool(scene, 900, texStar, { additive: true, gravity: 2.6, drag: 0.55 });
    this.hearts = new Pool(scene, 120, heartTexture(), { additive: false, gravity: -0.25, drag: 1.5 });
    this.petals = new Pool(scene, 160, petalTexture(), { additive: false, gravity: 0.28, drag: 2.0 });
    this.drops = new Pool(scene, 260, dropTexture(), { additive: true, gravity: 5.5 });
    this.pools = [this.sparkles, this.fireworks, this.hearts, this.petals, this.drops];

    this._tmpColor = new THREE.Color();
    this._magicTimer = 0;
    this._magicCenter = new THREE.Vector3();

    // タップした場所に出る波紋リング
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.42, 0.55, 40);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 15;
      scene.add(m);
      this.rings.push({ mesh: m, t: 1e9 });
    }
  }

  onResize(heightPx, fov) {
    for (const p of this.pools) p.setScale(heightPx, fov);
  }

  // 歩くプリンセスの足元のキラキラ
  trail(pos, color) {
    const c = this._tmpColor.copy(color);
    this.sparkles.spawn(
      pos.x + rand(-0.28, 0.28), pos.y + rand(0.03, 0.35), pos.z + rand(-0.28, 0.28),
      rand(-0.15, 0.15), rand(0.35, 0.9), rand(-0.15, 0.15),
      rand(0.7, 1.3), rand(0.1, 0.22), c, 1
    );
  }

  // キラキラの爆発
  burst(pos, colorHex, count = 26, speed = 2.6, size = 0.22) {
    const c = this._tmpColor.set(colorHex);
    for (let i = 0; i < count; i++) {
      const th = rand(Math.PI * 2);
      const ph = Math.acos(rand(-1, 1));
      const sp = speed * rand(0.35, 1);
      this.sparkles.spawn(
        pos.x, pos.y, pos.z,
        Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * 0.9 + 0.7, Math.sin(ph) * Math.sin(th) * sp,
        rand(0.6, 1.3), size * rand(0.6, 1.4), c, 1
      );
    }
  }

  // ハートがふわふわ
  heartsBurst(pos, count = 7) {
    const c = this._tmpColor.set(0xffffff);
    for (let i = 0; i < count; i++) {
      this.hearts.spawn(
        pos.x + rand(-0.4, 0.4), pos.y + rand(0, 0.5), pos.z + rand(-0.4, 0.4),
        rand(-0.4, 0.4), rand(0.8, 1.6), rand(-0.4, 0.4),
        rand(1.1, 1.8), rand(0.28, 0.5), c, 2
      );
    }
  }

  // 打ち上げ花火（打上げの筋 + 開花）
  firework(pos, colorHex) {
    const c = this._tmpColor.set(colorHex);
    const count = 90;
    for (let i = 0; i < count; i++) {
      const th = rand(Math.PI * 2);
      const ph = Math.acos(rand(-1, 1));
      const sp = rand(3.2, 7.5);
      const col = Math.random() < 0.25 ? this._tmpColor.set(0xfff6d8) : this._tmpColor.set(colorHex);
      this.fireworks.spawn(
        pos.x, pos.y, pos.z,
        Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp,
        rand(1.2, 2.1), rand(0.16, 0.34), col, 1
      );
    }
  }

  // 桜の花びら（木の位置から時々ひらり）
  petalAt(x, y, z) {
    const c = this._tmpColor.set(0xffffff);
    this.petals.spawn(
      x + rand(-1.6, 1.6), y + rand(-0.4, 0.6), z + rand(-1.6, 1.6),
      rand(-0.25, 0.25), rand(-0.25, -0.05), rand(-0.25, 0.25),
      rand(4, 7), rand(0.16, 0.26), c, 3
    );
  }

  // 噴水のしぶき
  fountainSpray(x, y, z) {
    const c = this._tmpColor.set(0xbfe8ff);
    for (let i = 0; i < 3; i++) {
      const th = rand(Math.PI * 2);
      const r = rand(0.05, 0.35);
      this.drops.spawn(
        x + Math.cos(th) * 0.1, y, z + Math.sin(th) * 0.1,
        Math.cos(th) * r * 2.2, rand(3.2, 4.6), Math.sin(th) * r * 2.2,
        rand(0.9, 1.3), rand(0.08, 0.16), c, 0
      );
    }
  }

  splash(pos) {
    const c = this._tmpColor.set(0xd8f2ff);
    for (let i = 0; i < 24; i++) {
      const th = rand(Math.PI * 2);
      const sp = rand(0.8, 2.4);
      this.drops.spawn(
        pos.x, pos.y + 0.1, pos.z,
        Math.cos(th) * sp, rand(1.8, 3.6), Math.sin(th) * sp,
        rand(0.5, 0.9), rand(0.1, 0.2), c, 0
      );
    }
  }

  // 魔法の杖: しばらく金色の星が降りそそぐ
  startMagicRain(center) {
    this._magicTimer = 4.5;
    this._magicCenter.copy(center);
  }
  get magicActive() { return this._magicTimer > 0; }

  // タップの波紋
  tapRing(pos, colorHex = 0xffffff) {
    let best = this.rings[0];
    for (const r of this.rings) if (r.t > best.t) best = r;
    best.t = 0;
    best.mesh.visible = true;
    best.mesh.position.set(pos.x, pos.y + 0.06, pos.z);
    best.mesh.material.color.set(colorHex);
  }

  update(dt, princessPos) {
    // 魔法の星の雨
    if (this._magicTimer > 0) {
      this._magicTimer -= dt;
      if (princessPos) this._magicCenter.lerp(princessPos, 1 - Math.exp(-4 * dt));
      const c = this._tmpColor.set(0xffe28a);
      const gold = [0xffe28a, 0xfff6c8, 0xffb3e1, 0xc7f0ff];
      for (let i = 0; i < 5; i++) {
        c.set(pick(gold));
        const th = rand(Math.PI * 2);
        const r = rand(0.4, 3.2);
        this.sparkles.spawn(
          this._magicCenter.x + Math.cos(th) * r, this._magicCenter.y + rand(3.4, 4.6),
          this._magicCenter.z + Math.sin(th) * r,
          rand(-0.2, 0.2), rand(-2.6, -1.7), rand(-0.2, 0.2),
          rand(1.4, 2.2), rand(0.14, 0.3), c, 1
        );
      }
    }

    for (const p of this.pools) p.update(dt);

    for (const r of this.rings) {
      if (r.t > 1) { r.mesh.visible = false; continue; }
      r.t += dt * 1.6;
      const t = Math.min(1, r.t);
      r.mesh.scale.setScalar(0.5 + t * 2.6);
      r.mesh.material.opacity = (1 - t) * 0.85;
    }
  }
}
