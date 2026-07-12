// ============================================================
// ユーティリティ — 乱数・ノイズ・数学ヘルパー
// ============================================================
import * as THREE from 'three';

export const rand = (a = 1, b) =>
  b === undefined ? Math.random() * a : a + Math.random() * (b - a);

export const randInt = (a, b) => Math.floor(rand(a, b + 1));

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const lerp = (a, b, t) => a + (b - a) * t;

// フレームレート非依存の減衰補間
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// なめらかなバリューノイズ（地形などに使用）
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, octaves = 3) {
  let value = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2.1;
  }
  return value;
}

// Canvas に描いた絵をテクスチャにする（スプライト用）
export function makeCanvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 2D距離（XZ平面）
export function distXZ(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// 円コライダー群の外へ押し出す
export function resolveColliders(pos, colliders, selfRadius = 0.4) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const r = c.r + selfRadius;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = c.x + (dx / d) * r;
      pos.z = c.z + (dz / d) * r;
    }
  }
}
