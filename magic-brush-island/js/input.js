/* ================================================================
   input.js — floating touch joystick + tap detection + keyboard
   A drag anywhere becomes a joystick; a quick tap fires a paint
   shot. The jump button is a separate DOM element.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.Input = (function () {
  const state = {
    vec: { x: 0, z: 0 },     // movement direction, length <= 1
    active: false,
    jumpQueued: false,
    taps: [],                // {x, y} screen taps this frame
  };

  const keys = {};
  let joyId = null;          // pointer id driving the joystick
  let joyOrigin = { x: 0, y: 0 };
  let joyStartT = 0;
  let joyMoved = false;
  let joyEl, baseEl, knobEl, jumpEl;
  let enabled = false;

  const JOY_R = 52;          // px radius of full deflection
  const TAP_MS = 260;
  const TAP_DIST = 14;

  function updateKnob(dx, dy) {
    const len = Math.hypot(dx, dy);
    const c = len > JOY_R ? JOY_R / len : 1;
    knobEl.style.transform = `translate(${dx * c}px, ${dy * c}px)`;
  }

  function setVecFrom(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 8) { state.vec.x = 0; state.vec.z = 0; return; }
    const m = Math.min(1, len / JOY_R);
    state.vec.x = (dx / len) * m;
    state.vec.z = (dy / len) * m;
  }

  function onDown(e) {
    GAME.Audio.resume();
    if (!enabled) return;
    if (e.target.closest('button')) return;    // let buttons work
    if (joyId !== null) return;
    joyId = e.pointerId;
    joyOrigin.x = e.clientX; joyOrigin.y = e.clientY;
    joyStartT = performance.now();
    joyMoved = false;
    state.active = true;
    baseEl.style.left = e.clientX + 'px';
    baseEl.style.top = e.clientY + 'px';
    joyEl.classList.remove('hidden');
    updateKnob(0, 0);
  }

  function onMove(e) {
    if (e.pointerId !== joyId) return;
    const dx = e.clientX - joyOrigin.x;
    const dy = e.clientY - joyOrigin.y;
    if (Math.hypot(dx, dy) > TAP_DIST) joyMoved = true;
    if (joyMoved) { setVecFrom(dx, dy); updateKnob(dx, dy); }
  }

  function onUp(e) {
    if (e.pointerId !== joyId) return;
    const dt = performance.now() - joyStartT;
    if (!joyMoved && dt < TAP_MS) {
      state.taps.push({ x: joyOrigin.x, y: joyOrigin.y });
    }
    joyId = null;
    state.active = false;
    state.vec.x = 0; state.vec.z = 0;
    joyEl.classList.add('hidden');
  }

  function keyVec() {
    let x = 0, z = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) x -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) x += 1;
    if (keys['ArrowUp'] || keys['KeyW']) z -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) z += 1;
    if (x || z) {
      const l = Math.hypot(x, z);
      state.vec.x = x / l; state.vec.z = z / l;
      state.active = true;
    } else if (joyId === null) {
      state.vec.x = 0; state.vec.z = 0;
      state.active = false;
    }
  }

  function init() {
    joyEl = document.getElementById('joystick');
    baseEl = document.getElementById('joy-base');
    knobEl = document.getElementById('joy-knob');
    jumpEl = document.getElementById('btn-jump');

    const root = document.getElementById('game-root');
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);

    jumpEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      GAME.Audio.resume();
      state.jumpQueued = true;
    });

    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Space') { state.jumpQueued = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // block iOS double-tap zoom / scroll
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  function update() { keyVec(); }

  function consumeJump() {
    const j = state.jumpQueued;
    state.jumpQueued = false;
    return j;
  }

  function consumeTaps() {
    const t = state.taps;
    state.taps = [];
    return t;
  }

  return {
    init, update, consumeJump, consumeTaps,
    setEnabled(v) { enabled = v; },
    get vec() { return state.vec; },
    get active() { return state.active; },
  };
})();
