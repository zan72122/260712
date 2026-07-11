/* ============================================================
   config.js — shared constants, color palette, math helpers,
   and the analytic terrain height function used both for the
   visual mesh and for super-cheap character physics.
   ============================================================ */

window.KIRA = window.KIRA || {};

(function (K) {
  "use strict";

  // ---------- world tuning ----------
  K.CONFIG = {
    ISLAND_RADIUS: 92,          // playable island radius
    SEA_LEVEL: 0.0,
    WORLD_SIZE: 900,            // ocean plane size
    DAY_LENGTH: 150,            // seconds for a full day-night cycle
    STAR_TOTAL: 60,             // collectible stars scattered on island
    FRIEND_TOTAL: 5,
    GRAVITY: -30,
    PLAYER_SPEED: 10.5,
    PLAYER_JUMP: 12.5,
    SUPER_JUMP: 22,             // mushroom trampoline
    CAM_DIST_LANDSCAPE: 13,
    CAM_DIST_PORTRAIT: 15.5,
    CAM_HEIGHT: 6.2,
    PIXEL_RATIO_CAP: 2,
  };

  // ---------- palette (dreamy storybook colors) ----------
  K.PAL = {
    sand:        0xffe9b8,
    sandWet:     0xf2cf8e,
    grass:       0x6fd66a,
    grassDeep:   0x3fae57,
    hill:        0x8be07a,
    rock:        0xb7a8c9,
    snow:        0xfff7ff,
    trunk:       0xa9714b,
    leaf1:       0x53c76b,
    leaf2:       0x7fdd6d,
    leafPink:    0xffb7d9,
    leafPink2:   0xff9ccb,
    water:       0x2fa8d8,
    waterDeep:   0x1f6fb8,
    flowerCols: [0xff6f9c, 0xffd93b, 0xff9c54, 0xc17bff, 0x64c8ff, 0xff8181],
    balloonCols: [0xff5f7e, 0xffc542, 0x59d98c, 0x5fb0ff, 0xc78bff],
  };

  // ---------- tiny deterministic value-noise ----------
  // Smooth 2-D value noise; cheap enough to double as physics ground.
  function hash2(ix, iz) {
    let h = ix * 374761393 + iz * 668265263;
    h = (h ^ (h >> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function valueNoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const a = hash2(ix, iz), b = hash2(ix + 1, iz);
    const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    const ux = smooth(fx), uz = smooth(fz);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }

  function fbm(x, z) {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < 4; i++) {
      v += amp * valueNoise(x * freq, z * freq);
      amp *= 0.5; freq *= 2.03;
    }
    return v; // 0..~1
  }

  K.noise = { valueNoise, fbm, hash2 };

  // ---------- terrain height ----------
  // A gentle island: sandy ring, rolling meadows, one friendly
  // mountain to the north, a flat play-plaza at the centre.
  function groundHeight(x, z) {
    const r = Math.sqrt(x * x + z * z);
    const R = K.CONFIG.ISLAND_RADIUS;

    // island silhouette: 1 at centre -> 0 at shore
    let mask = 1 - smooth(Math.min(Math.max((r - R * 0.55) / (R * 0.45), 0), 1));

    // base rolling hills
    let h = fbm(x * 0.022 + 31.7, z * 0.022 + 11.3) * 7.0;

    // friendly mountain to the north-west
    const mx = x + 38, mz = z + 40;
    const md = Math.sqrt(mx * mx + mz * mz);
    h += Math.max(0, 1 - md / 46) * 24 * (0.75 + 0.25 * fbm(x * 0.05, z * 0.05));

    // soft hill to the east
    const ex = x - 52, ez = z - 8;
    const ed = Math.sqrt(ex * ex + ez * ez);
    h += Math.max(0, 1 - ed / 30) * 9;

    // flatten a cosy central plaza where the player starts
    const pd = Math.sqrt((x - 4) * (x - 4) + (z - 30) * (z - 30));
    const plaza = smooth(Math.min(Math.max((pd - 8) / 14, 0), 1));
    h = h * (0.35 + 0.65 * plaza) + 1.35 * (1 - plaza);

    // shore shaping: land rises out of the sea, seabed drops away
    h = h * mask + 2.2 * mask - (1 - mask) * 6;

    return h;
  }
  K.groundHeight = groundHeight;

  // ---------- helpers ----------
  K.lerp = (a, b, t) => a + (b - a) * t;
  K.clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  K.rand = (a, b) => a + Math.random() * (b - a);
  K.pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // smooth exponential damping that is frame-rate independent
  K.damp = (cur, target, lambda, dt) =>
    K.lerp(cur, target, 1 - Math.exp(-lambda * dt));

})(window.KIRA);
