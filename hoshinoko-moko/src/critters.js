// ほしのこモコ — いきものたち（ちょうちょ・ことり）
// 昼はちょうちょとことりが飛び、夜はホタル（effects側）に交代する。

import * as THREE from 'three';

function rand(a, b) { return a + Math.random() * (b - a); }

export class Critters {
  constructor(scene) {
    this.scene = scene;
    this.butterflies = [];
    this.birds = [];
    this._buildButterflies();
    this._buildBirds();
  }

  addButterfly() {
    if (this.butterflies.length >= 10) return;
    this._makeButterfly();
  }

  _buildButterflies() {
    for (let i = 0; i < 5; i++) this._makeButterfly();
  }

  _makeButterfly() {
    const colors = [0xffd75e, 0xff9ec4, 0x9fd8ff, 0xd9a8ff, 0xfff3a0];
    const col = colors[this.butterflies.length % colors.length];
    const g = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(0.16, 0.22);
    wingGeo.translate(0.08, 0, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: col, side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.25,
    });
    const wl = new THREE.Mesh(wingGeo, mat);
    const wr = new THREE.Mesh(wingGeo, mat);
    wr.rotation.y = Math.PI;
    g.add(wl, wr);
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.018, 0.1, 4, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4a44 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    this.scene.add(g);
    this.butterflies.push({
      g, wl, wr,
      cx: rand(-4.5, 4.5), cz: rand(-4.5, 4.5),
      r: rand(0.8, 2.6), h: rand(0.6, 2.2),
      s: rand(0.25, 0.6), ph: rand(0, 10), flap: rand(9, 13),
    });
  }

  _buildBirds() {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: [0xfff3e8, 0xaed9ff, 0xffd9b8][i], flatShading: true });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat);
      body.scale.set(1.4, 0.9, 0.9);
      g.add(body);
      const wingGeo = new THREE.PlaneGeometry(0.24, 0.09);
      wingGeo.translate(0.12, 0, 0);
      const wmat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const wl = new THREE.Mesh(wingGeo, wmat);
      wl.rotation.y = Math.PI / 2;
      const wr = new THREE.Mesh(wingGeo, wmat);
      wr.rotation.y = -Math.PI / 2;
      g.add(wl, wr);
      const beak = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.09, 6),
        new THREE.MeshLambertMaterial({ color: 0xffa347 }));
      beak.rotation.z = -Math.PI / 2;
      beak.position.x = 0.22;
      g.add(beak);
      this.scene.add(g);
      this.birds.push({
        g, wl, wr,
        r: rand(14, 19), h: rand(5, 8), s: rand(0.12, 0.2) * (i % 2 ? 1 : -1),
        a: rand(0, Math.PI * 2), flap: rand(7, 10), ph: rand(0, 10),
      });
    }
  }

  update(dt, t, night) {
    const dayness = 1 - night;

    for (const b of this.butterflies) {
      const a = t * b.s + b.ph;
      b.g.position.set(
        b.cx + Math.cos(a) * b.r,
        b.h + Math.sin(t * 0.9 + b.ph) * 0.35,
        b.cz + Math.sin(a * 1.3) * b.r);
      b.g.rotation.y = -a * 1.1 + Math.PI / 2;
      const flap = Math.sin(t * b.flap + b.ph) * 1.05;
      b.wl.rotation.y = flap;
      b.wr.rotation.y = Math.PI - flap;
      b.g.visible = dayness > 0.35;
      b.g.scale.setScalar(Math.max(0.001, Math.min(1, dayness * 2)));
    }

    for (const bd of this.birds) {
      bd.a += bd.s * dt;
      bd.g.position.set(Math.cos(bd.a) * bd.r, bd.h + Math.sin(t * 0.7 + bd.ph) * 0.5, Math.sin(bd.a) * bd.r);
      bd.g.rotation.y = -bd.a + (bd.s > 0 ? Math.PI : 0);
      const flap = Math.sin(t * bd.flap + bd.ph) * 0.8;
      bd.wl.rotation.z = flap;
      bd.wr.rotation.z = -flap;
      bd.g.visible = dayness > 0.35;
    }
  }
}
