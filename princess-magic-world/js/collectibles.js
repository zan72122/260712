// ============================================================
// あつめるもの — きらめく星とハート
// 近づくと自動でゲット。10個あつめると花火のおいわい！
// ============================================================
import * as THREE from 'three';
import { rand, distXZ } from './utils.js';

function starGeometry() {
  const shape = new THREE.Shape();
  const outer = 0.3, inner = 0.13, points = 5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.28);
  s.bezierCurveTo(-0.45, 0.1, -0.22, 0.42, 0, 0.16);
  s.bezierCurveTo(0.22, 0.42, 0.45, 0.1, 0, -0.28);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2,
  });
  geo.center();
  return geo;
}

export class Collectibles {
  constructor(ctx, world) {
    this.ctx = ctx;
    this.world = world;
    this.items = [];
    this.combo = 0;
    this.onStar = null;   // コールバック（UI更新）
    this.onHeart = null;

    this.starGeo = starGeometry();
    this.heartGeo = heartGeometry();
    this.starMat = new THREE.MeshStandardMaterial({
      color: 0xffdf6e, roughness: 0.3, metalness: 0.2,
      emissive: 0xffc21e, emissiveIntensity: 1.1,
    });
    this.heartMat = new THREE.MeshStandardMaterial({
      color: 0xff6f9c, roughness: 0.3, metalness: 0.1,
      emissive: 0xff3d7e, emissiveIntensity: 1.0,
    });

    for (let i = 0; i < 11; i++) this._spawn('star');
    for (let i = 0; i < 2; i++) this._spawn('heart');
  }

  _randomSpot() {
    for (let guard = 0; guard < 60; guard++) {
      const a = rand(Math.PI * 2);
      const r = Math.sqrt(rand(1)) * 23;
      const x = Math.cos(a) * r, z = Math.sin(a) * r + 2;
      const pond = this.world.pond;
      if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 1) continue;
      if (Math.hypot(x - this.world.castlePos.x, z - this.world.castlePos.z) < 9) continue;
      let tooClose = false;
      for (const it of this.items) {
        if (it.alive && Math.hypot(it.mesh.position.x - x, it.mesh.position.z - z) < 3.2) { tooClose = true; break; }
      }
      if (tooClose) continue;
      return { x, z };
    }
    return { x: rand(-10, 10), z: rand(-5, 8) };
  }

  _spawn(kind) {
    const spot = this._randomSpot();
    const mesh = new THREE.Mesh(
      kind === 'star' ? this.starGeo : this.heartGeo,
      kind === 'star' ? this.starMat : this.heartMat
    );
    mesh.position.set(spot.x, rand(1.0, 1.9), spot.z);
    this.ctx.scene.add(mesh);
    const item = {
      kind, mesh, alive: true,
      baseY: mesh.position.y,
      phase: rand(Math.PI * 2),
      spin: rand(1.2, 2.2) * (Math.random() < 0.5 ? 1 : -1),
    };
    this.items.push(item);
    // 星を直接タップ → プリンセスがとりにいく
    this.ctx.interactables.push({
      getPos: () => item.mesh.position,
      r: 0.9, y: 0,
      enabled: () => item.alive,
      onTap: () => {
        if (this.onItemTapped) this.onItemTapped(item);
      },
    });
  }

  collect(item) {
    if (!item.alive) return;
    item.alive = false;
    item.mesh.visible = false;
    const p = item.mesh.position;
    if (item.kind === 'star') {
      this.combo++;
      this.ctx.particles.burst(p, 0xffe28a, 30, 3.0);
      this.ctx.particles.tapRing(new THREE.Vector3(p.x, 0.05, p.z), 0xffe28a);
      this.ctx.audio.playCollect(this.combo);
      if (this.onStar) this.onStar();
    } else {
      this.ctx.particles.burst(p, 0xff8fbf, 22, 2.6);
      this.ctx.particles.heartsBurst(p, 8);
      this.ctx.audio.playHeart();
      if (this.onHeart) this.onHeart();
    }
    // しばらくしたら別の場所にまた出てくる
    setTimeout(() => {
      const spot = this._randomSpot();
      item.mesh.position.set(spot.x, rand(1.0, 1.9), spot.z);
      item.baseY = item.mesh.position.y;
      item.mesh.visible = true;
      item.alive = true;
    }, 2600);
  }

  update(dt, time, princess) {
    for (const it of this.items) {
      if (!it.alive) continue;
      const m = it.mesh;
      m.rotation.y += dt * it.spin;
      m.position.y = it.baseY + Math.sin(time * 1.8 + it.phase) * 0.22;
      // 近づいたらゲット！
      if (distXZ(m.position, princess.pos) < 1.25) {
        this.collect(it);
      }
    }
    // コンボは少しずつリセット（音階が上がりすぎないように）
    if (this.combo > 0 && Math.random() < dt * 0.06) this.combo = Math.max(0, this.combo - 1);
  }

  // タップされた星があれば、その星の場所を返す（プリンセスが歩いていく）
  nearestTapped(rayPoint) {
    let best = null, bestD = 1.4;
    for (const it of this.items) {
      if (!it.alive) continue;
      const d = rayPoint.distanceTo(it.mesh.position);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }
}
