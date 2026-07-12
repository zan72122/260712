/* ============================================================
   input.js — 入力
   どこでもバーチャルスティック / タップ / キーボード(開発用)
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  G.createInput = function (canvas, camera) {
    const input = (G.input = {
      moveX: 0, moveZ: 0,   // ワールド方向の移動意図
      stickX: 0, stickY: 0, // 画面上のスティック(-1..1)
      _tapped: false,
    });

    const joyEl = document.getElementById('joystick');
    const baseEl = document.getElementById('joystick-base');
    const thumbEl = document.getElementById('joystick-thumb');
    const RADIUS = 52;

    let stickId = null;
    let baseX = 0, baseY = 0;
    const taps = new Map(); // pointerId -> {x, y, t}

    function setThumb(dx, dy) {
      thumbEl.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!G.state.started) return;
      canvas.setPointerCapture(e.pointerId);
      taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      if (stickId === null) {
        stickId = e.pointerId;
        baseX = e.clientX; baseY = e.clientY;
        baseEl.style.left = baseX + 'px';
        baseEl.style.top = baseY + 'px';
        joyEl.classList.remove('hidden');
        setThumb(0, 0);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickId) {
        let dx = e.clientX - baseX;
        let dy = e.clientY - baseY;
        const len = Math.hypot(dx, dy);
        if (len > RADIUS) { dx = dx / len * RADIUS; dy = dy / len * RADIUS; }
        setThumb(dx, dy);
        input.stickX = dx / RADIUS;
        input.stickY = dy / RADIUS;
      }
    });

    function endPointer(e) {
      if (e.pointerId === stickId) {
        stickId = null;
        input.stickX = 0; input.stickY = 0;
        joyEl.classList.add('hidden');
      }
      const rec = taps.get(e.pointerId);
      if (rec) {
        taps.delete(e.pointerId);
        const dist = Math.hypot(e.clientX - rec.x, e.clientY - rec.y);
        const dur = performance.now() - rec.t;
        if (dist < 14 && dur < 350) {
          handleTap(e.clientX, e.clientY);
        }
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    /* ---- タップ処理：3Dオブジェクトを調べる ---- */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function handleTap(cx, cy) {
      input._tapped = true;
      ndc.x = (cx / window.innerWidth) * 2 - 1;
      ndc.y = -(cy / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      let best = null, bestDist = Infinity;
      for (const t of G.tappables) {
        if (!t.obj.visible) continue;
        const hits = raycaster.intersectObject(t.obj, true);
        if (hits.length && hits[0].distance < bestDist) {
          bestDist = hits[0].distance;
          best = t;
        }
      }
      if (best) best.onTap();
    }

    /** つり用：このフレームにタップがあったか（消費式） */
    input.consumeTap = function () {
      const t = input._tapped;
      input._tapped = false;
      return t;
    };

    /* ---- キーボード（PCでの確認用） ---- */
    const keys = {};
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'Enter') {
        const btn = document.getElementById('btn-action');
        if (!btn.classList.contains('hidden')) btn.click();
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    /* ---- 毎フレーム：カメラ基準でワールド方向へ変換 ---- */
    const fwd = new THREE.Vector3();
    let tapAge = 0;
    input.update = function () {
      // タップフラグは2フレームで消える（consumeされなければ）
      if (input._tapped) {
        tapAge++;
        if (tapAge > 2) { input._tapped = false; tapAge = 0; }
      } else {
        tapAge = 0;
      }
      let sx = input.stickX, sy = input.stickY;
      if (keys.ArrowLeft || keys.KeyA) sx -= 1;
      if (keys.ArrowRight || keys.KeyD) sx += 1;
      if (keys.ArrowUp || keys.KeyW) sy -= 1;
      if (keys.ArrowDown || keys.KeyS) sy += 1;
      const len = Math.hypot(sx, sy);
      if (len > 1) { sx /= len; sy /= len; }

      if (len > 0.03) {
        // カメラの向き（水平のみ）
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        const rightX = -fwd.z, rightZ = fwd.x;
        input.moveX = rightX * sx + fwd.x * -sy;
        input.moveZ = rightZ * sx + fwd.z * -sy;
      } else {
        input.moveX = 0;
        input.moveZ = 0;
      }
    };

    return input;
  };
})();
