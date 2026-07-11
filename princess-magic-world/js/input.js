// ============================================================
// 入力 — タップひとつで遊べるかんたん操作
// 地面タップ→歩く / なかまタップ→ふれあい / 星タップ→とりにいく
// ============================================================
import * as THREE from 'three';

export class Input {
  constructor(ctx, canvas, handlers) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.handlers = handlers; // { onGroundTap, onInteract }
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._down = null;

    canvas.addEventListener('pointerdown', (e) => {
      this._down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!this._down) return;
      const dx = e.clientX - this._down.x;
      const dy = e.clientY - this._down.y;
      const dt = performance.now() - this._down.t;
      this._down = null;
      if (Math.hypot(dx, dy) < 18 && dt < 450) {
        this._tap(e.clientX, e.clientY);
      }
    });
    canvas.addEventListener('pointercancel', () => { this._down = null; });
  }

  _tap(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.ctx.camera);
    const ray = this.raycaster.ray;

    // 1) タップできるなかまを先にチェック（レイと球の距離で判定）
    let best = null, bestDist = Infinity;
    const tmp = new THREE.Vector3();
    for (const it of this.ctx.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const center = tmp.copy(it.getPos());
      center.y += it.y || 0.5;
      const distToRay = ray.distanceToPoint(center);
      if (distToRay < it.r) {
        const along = center.clone().sub(ray.origin).dot(ray.direction);
        if (along > 0 && along < bestDist) { bestDist = along; best = it; }
      }
    }
    if (best) {
      this.handlers.onInteract(best);
      return;
    }

    // 2) 地面へのタップ
    const hits = this.raycaster.intersectObject(this.ctx.groundMesh, false);
    if (hits.length > 0) {
      this.handlers.onGroundTap(hits[0].point);
    }
  }
}
