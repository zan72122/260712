/* ================================================================
   config.js — palette, world layout, tuning constants
   ================================================================ */
window.GAME = window.GAME || {};

GAME.CONFIG = {
  ISLAND_R: 46,          // island radius (terrain reaches sea outside)
  SEA_LEVEL: 0.55,
  PAINT_RADIUS: 4.2,     // auto-paint distance around the player
  PLAYER_SPEED: 7.2,
  GRAVITY: -26,
  JUMP_V: 9.5,
  STAR_TOTAL: 20,
};

/* Kid-friendly saturated palette (hand tuned for ACES tone mapping) */
GAME.PAL = {
  grassA: 0x6fd45f, grassB: 0x3fae52, grassC: 0x9ae06e,
  sand:  0xf7df9e,
  trunk: 0x8a5a33, trunkDark: 0x6e4526,
  leaf1: 0x4fc457, leaf2: 0x37a94e, leaf3: 0x7fd648, pine: 0x2e9e5b,
  blossom: 0xff9ec6,
  red: 0xff5a5a, orange: 0xffa03c, yellow: 0xffd93c, green: 0x51c95b,
  blue: 0x4aa8ff, purple: 0xb07aff, pink: 0xff8fb5, white: 0xfff6ec,
  roof1: 0xff6a5e, roof2: 0x5db7ff, roof3: 0xffc04d, roof4: 0xb586ff,
  wall1: 0xfff1d6, wall2: 0xffe3ee, wall3: 0xe4f4ff,
  mushroomCap: 0xff5f5f, mushroomCap2: 0xffa54d, mushroomStem: 0xfff2dc,
  water: 0x3fa9e8, waterDeep: 0x2272c8, waterShallow: 0x7fe0e8,
};

/* ---- Zones : themed areas of the island -------------------------
   Each paintable prop belongs to a zone; when every prop of a zone
   is painted, colour floods across the ground and a rainbow appears. */
GAME.ZONES = [
  { id: 'hana',    name: 'おはなばたけ',  emoji: '🌸', cx:  20, cz: -13, r: 15 },
  { id: 'kinoko',  name: 'きのこのもり',  emoji: '🍄', cx: -19, cz:  15, r: 14 },
  { id: 'minato',  name: 'みなとまち',    emoji: '🏠', cx:   1, cz: -27, r: 15 },
  { id: 'mori',    name: 'もりのくに',    emoji: '🌳', cx:  21, cz:  17, r: 15 },
  { id: 'oshiro',  name: 'おしろのおか',  emoji: '🏰', cx: -24, cz: -17, r: 15 },
  { id: 'yuuen',   name: 'ゆうえんち',    emoji: '🎠', cx:  -3, cz:  30, r: 14 },
];

/* Utility: soft pseudo random (deterministic, seeded) */
GAME.rng = (function () {
  let s = 1234567;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
})();
