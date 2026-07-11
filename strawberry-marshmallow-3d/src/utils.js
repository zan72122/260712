/* =========================================================
 * いちごましゅまろのおか — utils.js
 * 共有ユーティリティ（数学・テクスチャ・マテリアル）
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  // ---------- math ----------
  IM.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  IM.lerp = (a, b, t) => a + (b - a) * t;
  IM.smoothstep = (a, b, t) => {
    const x = IM.clamp((t - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  };
  IM.rand = (a, b) => a + Math.random() * (b - a);
  IM.randInt = (a, b) => Math.floor(IM.rand(a, b + 1));
  IM.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  IM.TAU = Math.PI * 2;

  // angle lerp (shortest path)
  IM.lerpAngle = (a, b, t) => {
    let d = (b - a) % IM.TAU;
    if (d > Math.PI) d -= IM.TAU;
    if (d < -Math.PI) d += IM.TAU;
    return a + d * t;
  };

  // color lerp helper (THREE.Color instances)
  const _c1 = null;
  IM.mixColor = (out, a, b, t) => {
    out.r = IM.lerp(a.r, b.r, t);
    out.g = IM.lerp(a.g, b.g, t);
    out.b = IM.lerp(a.b, b.b, t);
    return out;
  };

  // ---------- toon material ----------
  let _gradientMap = null;
  IM.getGradientMap = function () {
    if (_gradientMap) return _gradientMap;
    // 4-step gradient for soft cel shading
    const data = new Uint8Array([120, 180, 230, 255]);
    const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    _gradientMap = tex;
    return tex;
  };

  IM.toon = function (color, opts) {
    opts = opts || {};
    const m = new THREE.MeshToonMaterial({
      color: color,
      gradientMap: IM.getGradientMap(),
      transparent: !!opts.transparent,
      opacity: opts.opacity !== undefined ? opts.opacity : 1,
      side: opts.side || THREE.FrontSide,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 1,
    });
    if (opts.vertexColors) m.vertexColors = true;
    return m;
  };

  // ---------- canvas sprite textures ----------
  IM.makeGlowTexture = function (inner, outer, size) {
    size = size || 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 1;
    return tex;
  };

  IM.makeCircleTexture = function (color, size) {
    size = size || 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 2, 0, IM.TAU);
    g.fill();
    return new THREE.CanvasTexture(c);
  };

  IM.makeStarTexture = function (color, size) {
    size = size || 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.fillStyle = color;
    g.beginPath();
    const R = size / 2 - 2, r = R * 0.45;
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (i / 10) * IM.TAU - Math.PI / 2;
      g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath();
    g.fill();
    return new THREE.CanvasTexture(c);
  };

  // 目・ほっぺ用の丸い顔テクスチャ
  IM.makeFaceDotTexture = function (color, size) {
    return IM.makeCircleTexture(color, size || 32);
  };

  // ---------- geometry helpers ----------
  // 上に置く: y = groundHeight + offset で配置
  IM.placeOnGround = function (obj, x, z, offset) {
    obj.position.set(x, IM.groundHeight(x, z) + (offset || 0), z);
  };

  // 簡易カプセル（円柱+球）ジオメトリの代わり: CapsuleGeometry は r139+ にあるので使える
  IM.capsule = function (r, len, color) {
    const geo = new THREE.CapsuleGeometry(r, len, 4, 8);
    return new THREE.Mesh(geo, IM.toon(color));
  };

  // すべての子メッシュに影を設定
  IM.setShadow = function (obj, cast, receive) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = cast;
        o.receiveShadow = receive;
      }
    });
    return obj;
  };
})();
