/* ============================================================
   input.js — toddler-proof controls.
   * Left half of the screen = floating virtual joystick
     (appears wherever the thumb lands, so tiny hands never
     have to aim for a fixed spot).
   * Big green jump button on the right (also: whole right
     half of the screen jumps, because 4-year-olds mash).
   * Arrow keys / WASD / Space for desktop testing.
   ============================================================ */

(function (K) {
  "use strict";

  const Input = {
    moveX: 0,          // -1 .. 1
    moveY: 0,          // -1 .. 1 (forward = -1 on screen up)
    jumpPressed: false, // edge-triggered, consumed by game loop
    jumpHeld: false,
  };
  K.Input = Input;

  const keys = {};

  Input.init = function () {
    const zone = document.getElementById("joystick-zone");
    const base = document.getElementById("joystick-base");
    const knob = document.getElementById("joystick-knob");
    const jumpBtn = document.getElementById("jump-button");

    const baseHome = { left: base.style.left, bottom: base.style.bottom };
    let stickId = null;
    let origin = { x: 0, y: 0 };
    const RADIUS = 52;

    function setStick(dx, dy) {
      const len = Math.hypot(dx, dy);
      const capped = Math.min(len, RADIUS);
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      knob.style.transform = `translate(${nx * capped}px, ${ny * capped}px)`;
      // dead-zone so resting thumbs don't drift
      const t = capped < 10 ? 0 : (capped - 10) / (RADIUS - 10);
      Input.moveX = nx * t;
      Input.moveY = ny * t;
    }

    function placeBaseAt(x, y) {
      const r = zone.getBoundingClientRect();
      const half = base.offsetWidth / 2;
      const bx = K.clamp(x - r.left, half + 6, r.width - half - 6);
      const by = K.clamp(y - r.top, half + 6, r.height - half - 6);
      base.style.left = (bx - half) + "px";
      base.style.bottom = (r.height - by - half) + "px";
    }

    zone.addEventListener("touchstart", (e) => {
      for (const t of e.changedTouches) {
        if (stickId === null) {
          stickId = t.identifier;
          origin = { x: t.clientX, y: t.clientY };
          placeBaseAt(t.clientX, t.clientY);
          setStick(0, 0);
        }
      }
      e.preventDefault();
    }, { passive: false });

    zone.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          setStick(t.clientX - origin.x, t.clientY - origin.y);
        }
      }
      e.preventDefault();
    }, { passive: false });

    function endStick(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null;
          Input.moveX = 0; Input.moveY = 0;
          knob.style.transform = "translate(0px, 0px)";
          base.style.left = baseHome.left;
          base.style.bottom = baseHome.bottom;
        }
      }
    }
    zone.addEventListener("touchend", endStick);
    zone.addEventListener("touchcancel", endStick);

    // mouse fallback (desktop testing)
    let mouseDown = false;
    zone.addEventListener("mousedown", (e) => {
      mouseDown = true;
      origin = { x: e.clientX, y: e.clientY };
      placeBaseAt(e.clientX, e.clientY);
    });
    window.addEventListener("mousemove", (e) => {
      if (mouseDown) setStick(e.clientX - origin.x, e.clientY - origin.y);
    });
    window.addEventListener("mouseup", () => {
      if (!mouseDown) return;
      mouseDown = false;
      Input.moveX = 0; Input.moveY = 0;
      knob.style.transform = "translate(0px, 0px)";
      base.style.left = baseHome.left;
      base.style.bottom = baseHome.bottom;
    });

    // ----- jump -----
    function jumpDown(e) {
      Input.jumpPressed = true;
      Input.jumpHeld = true;
      jumpBtn.classList.add("pressed");
      if (e) e.preventDefault();
    }
    function jumpUp() {
      Input.jumpHeld = false;
      jumpBtn.classList.remove("pressed");
    }
    jumpBtn.addEventListener("touchstart", jumpDown, { passive: false });
    jumpBtn.addEventListener("touchend", jumpUp);
    jumpBtn.addEventListener("touchcancel", jumpUp);
    jumpBtn.addEventListener("mousedown", jumpDown);
    window.addEventListener("mouseup", jumpUp);

    // mashing anywhere on the right side also jumps (kids!)
    document.getElementById("game-canvas").addEventListener("touchstart", (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.5) { jumpDown(); break; }
      }
    }, { passive: true });

    // ----- keyboard -----
    window.addEventListener("keydown", (e) => {
      if (keys[e.code]) return;
      keys[e.code] = true;
      if (e.code === "Space" || e.code === "ArrowUp" && keys["KeyW"]) { /* no-op */ }
      if (e.code === "Space") { Input.jumpPressed = true; Input.jumpHeld = true; }
      updateKeyMove();
    });
    window.addEventListener("keyup", (e) => {
      keys[e.code] = false;
      if (e.code === "Space") Input.jumpHeld = false;
      updateKeyMove();
    });

    function updateKeyMove() {
      let x = 0, y = 0;
      if (keys["ArrowLeft"] || keys["KeyA"]) x -= 1;
      if (keys["ArrowRight"] || keys["KeyD"]) x += 1;
      if (keys["ArrowUp"] || keys["KeyW"]) y -= 1;
      if (keys["ArrowDown"] || keys["KeyS"]) y += 1;
      const l = Math.hypot(x, y) || 1;
      // only override when a key is actually held, so touch still works
      if (x || y || wasKeyMove) { Input.moveX = x / l; Input.moveY = y / l; }
      wasKeyMove = !!(x || y);
    }
    let wasKeyMove = false;

    // block iOS gestures (double-tap zoom, pinch, scroll-bounce)
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("dblclick", (e) => e.preventDefault());
  };

  // consume the edge-triggered jump flag
  Input.consumeJump = function () {
    const j = Input.jumpPressed;
    Input.jumpPressed = false;
    return j;
  };

})(window.KIRA);
