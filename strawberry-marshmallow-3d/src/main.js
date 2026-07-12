/* =========================================================
 * いちごましゅまろのおか — main.js
 * ゲーム本体: レンダラー・カメラ・入力・いちご収集・お祝い
 * ========================================================= */
(function () {
  'use strict';
  const IM = (window.IM = window.IM || {});

  const BERRY_ACTIVE = 7;      // 同時に出るいちごの数
  const COLLECT_DIST = 1.35;   // 拾える距離
  const WORLD_LIMIT = 46;      // 歩ける範囲

  function Game() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.5, 1200);
    this.camPos = new THREE.Vector3(0, 9, 14);
    this.camLook = new THREE.Vector3(0, 1.5, 0);

    // ワールド構築
    this.sky = new IM.Sky(this.scene);
    this.world = new IM.World(this.scene);
    this.effects = new IM.Effects(this.scene);

    // プレイヤー（いちごワンピの女の子）
    this.player = new IM.Character(this.scene, {});
    this.player.group.position.set(0, IM.groundHeight(0, 0), 3);

    // おともだち（金髪ロングの女の子）
    this.friend = new IM.Character(this.scene, {
      hair: 0xf2d68a,
      hairLong: true,
      dress: 0x8fb8ff,
      dressTrim: 0xffffff,
      shoes: 0x5a7fd8,
      accessory: 'ribbon',
    });
    this.friend.group.position.set(6, IM.groundHeight(6, -4), -4);
    this.friend.speed = 3.2;
    this._friendTimer = 3;
    this._friendGiftCd = 0;

    // どうぶつたち
    this.sheep = [];
    for (const [x, z] of [[-8, 10], [10, 9], [-12, -4], [7, -12], [-3, 18]]) {
      this.sheep.push(new IM.Sheep(this.scene, x, z));
    }
    this.butterflies = [];
    for (let i = 0; i < 7; i++) {
      this.butterflies.push(new IM.Butterfly(this.scene, IM.rand(-22, 22), IM.rand(-22, 22)));
    }
    this.balloons = [];
    for (let i = 0; i < 4; i++) this.balloons.push(new IM.TapBalloon(this.scene));
    this.birds = new IM.BirdFlock(this.scene);

    // いちご
    this.berries = [];
    for (let i = 0; i < BERRY_ACTIVE; i++) this._spawnBerry(true);

    // UI
    this.ui = new IM.UI();
    this.ui.bindSound(() => {
      const m = !IM.Audio.muted;
      IM.Audio.setMuted(m);
      return m;
    });
    this.ui.bindTime(() => {
      const toNight = this.sky.isDay();
      this.sky.fastForwardTo(toNight ? 'night' : 'day');
      return toNight;
    });

    // 入力
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._pointerDown = false;
    this._bindInput();

    this.clock = new THREE.Clock();
    this.time = 0;
    this.started = false;
    this._celebrating = 0;

    window.addEventListener('resize', () => this._resize());
    this._resize();

    // タイトル画面 → スタート
    this.ui.onStart(() => {
      IM.Audio.init();
      this.started = true;
      this.ui.setTimeIcon(this.sky.isDay());
    });

    // タイトルの後ろでも景色を動かしておく
    this.renderer.setAnimationLoop(() => this._tick());
  }

  // ---------- いちごのスポーン ----------
  Game.prototype._spawnBerry = function (immediate) {
    const berry = IM.makeStrawberry(IM.rand(0.85, 1.15));
    this._placeBerry(berry);
    berry.userData.bobPhase = IM.rand(0, IM.TAU);
    berry.userData.falling = 0;
    this.scene.add(berry);
    this.berries.push(berry);
    if (!immediate) {
      berry.scale.setScalar(0.01);
      berry.userData.growing = true;
    }
  };

  Game.prototype._placeBerry = function (berry) {
    // 茂みの近く or 広場のどこか
    let x, z;
    if (Math.random() < 0.6 && this.world.berrySpots.length) {
      const spot = IM.pick(this.world.berrySpots);
      x = spot.x + IM.rand(-2.5, 2.5);
      z = spot.z + IM.rand(-2.5, 2.5);
    } else {
      const a = IM.rand(0, IM.TAU);
      const r = IM.rand(4, 26);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    if (Math.hypot(x - IM.POND.x, z - IM.POND.z) < IM.POND.r + 1.5) {
      x = IM.rand(2, 10); z = IM.rand(2, 10);
    }
    berry.position.set(x, IM.groundHeight(x, z), z);
    berry.userData.baseScale = berry.scale.x;
  };

  // 風船から降ってくるいちご
  Game.prototype._dropBerryAt = function (pos) {
    const berry = IM.makeStrawberry(1.05);
    berry.position.copy(pos);
    berry.userData.bobPhase = IM.rand(0, IM.TAU);
    berry.userData.falling = 1;
    berry.userData.baseScale = 1.05;
    this.scene.add(berry);
    this.berries.push(berry);
  };

  // ---------- 入力 ----------
  Game.prototype._bindInput = function () {
    const c = this.canvas;
    const onDown = (e) => {
      if (!this.started) return;
      this._pointerDown = true;
      this._handlePointer(e, true);
    };
    const onMove = (e) => {
      if (!this.started || !this._pointerDown) return;
      this._handlePointer(e, false);
    };
    const onUp = () => { this._pointerDown = false; };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // iOSのダブルタップズームなどを抑制
    c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  };

  Game.prototype._handlePointer = function (e, isTap) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // タップした瞬間だけ、なかまへの当たり判定を見る
    if (isTap && this._tapInteractables()) return;

    // 地面 → 移動先に
    const hits = this.raycaster.intersectObject(this.world.ground, false);
    if (hits.length) {
      const p = hits[0].point;
      const d = Math.hypot(p.x, p.z);
      if (d > WORLD_LIMIT) {
        p.x *= WORLD_LIMIT / d;
        p.z *= WORLD_LIMIT / d;
      }
      // 池の中には入らない
      if (Math.hypot(p.x - IM.POND.x, p.z - IM.POND.z) < IM.POND.r + 0.8) {
        const a = Math.atan2(p.z - IM.POND.z, p.x - IM.POND.x);
        p.x = IM.POND.x + Math.cos(a) * (IM.POND.r + 1.2);
        p.z = IM.POND.z + Math.sin(a) * (IM.POND.r + 1.2);
      }
      this.player.setTarget(p.x, p.z);
      if (isTap) this.effects.showMarker(p.x, p.z);
    }
  };

  // なかまタップ判定。ヒットしたら true
  Game.prototype._tapInteractables = function () {
    const groups = [];
    for (const s of this.sheep) groups.push({ obj: s.group, type: 'sheep', ref: s });
    for (const b of this.butterflies) groups.push({ obj: b.group, type: 'butterfly', ref: b });
    for (const b of this.balloons) if (b.alive) groups.push({ obj: b.group, type: 'balloon', ref: b });
    for (const berry of this.berries) groups.push({ obj: berry, type: 'berry', ref: berry });
    groups.push({ obj: this.player.group, type: 'player', ref: this.player });
    groups.push({ obj: this.friend.group, type: 'friend', ref: this.friend });

    let best = null;
    for (const g of groups) {
      const hits = this.raycaster.intersectObject(g.obj, true);
      if (hits.length && (!best || hits[0].distance < best.dist)) {
        best = { g, dist: hits[0].distance, point: hits[0].point };
      }
    }
    if (!best) return false;

    const { g, point } = best;
    if (g.type === 'balloon') {
      if (g.ref.pop()) {
        IM.Audio.pop();
        this.effects.burst(g.ref.group.position, g.ref.color, 22, { speed: 4.5 });
        this._dropBerryAt(g.ref.group.position);
      }
    } else if (g.type === 'sheep') {
      g.ref.poke();
      IM.Audio.boing();
      this.effects.burst(point, 0xffffff, 12, { speed: 2.5 });
    } else if (g.type === 'butterfly') {
      g.ref.poke();
      IM.Audio.sparkle();
      this.effects.burst(g.ref.group.position, 0xffd166, 10, { speed: 2, grav: 1 });
    } else if (g.type === 'player') {
      g.ref.playTwirl();
      IM.Audio.giggle();
      this.effects.burst(g.ref.group.position.clone().setY(g.ref.group.position.y + 1.5), 0xffb3c8, 16, { speed: 3 });
    } else if (g.type === 'friend') {
      g.ref.playHop();
      IM.Audio.giggle();
      this.effects.burst(g.ref.group.position.clone().setY(g.ref.group.position.y + 1.5), 0x8fd8ff, 16, { speed: 3 });
      this._friendGift();
    } else if (g.type === 'berry') {
      // いちごをタップ → 拾いに行く
      this.player.setTarget(g.ref.position.x, g.ref.position.z);
      this.effects.showMarker(g.ref.position.x, g.ref.position.z);
    }
    return true;
  };

  // おともだちがいちごをくれる（クールダウンつき）
  Game.prototype._friendGift = function () {
    if (this._friendGiftCd > 0) return;
    this._friendGiftCd = 12;
    const p = this.friend.group.position;
    const a = IM.rand(0, IM.TAU);
    this._dropBerryAt(new THREE.Vector3(p.x + Math.cos(a) * 1.6, p.y + 2.5, p.z + Math.sin(a) * 1.6));
    this.effects.burst(p.clone().setY(p.y + 2), 0xfff2a8, 14, { speed: 2.5 });
  };

  // ---------- いちご収集 ----------
  Game.prototype._collectBerry = function (index) {
    const berry = this.berries[index];
    const pos = berry.position.clone().setY(berry.position.y + 0.6);
    this.scene.remove(berry);
    this.berries.splice(index, 1);

    IM.Audio.collect(this.ui.total);
    this.effects.burst(pos, 0xff8fa8, 20, { speed: 3.5 });
    this.effects.burst(pos, 0xfff2a8, 10, { speed: 2, grav: 1.5 });
    this.player.playHop();

    const full = this.ui.addBerry();
    if (full) this._celebrate();

    // 補充
    setTimeout(() => {
      if (this.berries.length < BERRY_ACTIVE) this._spawnBerry(false);
    }, IM.rand(1200, 3200));
  };

  // ---------- おおきなお祝い ----------
  Game.prototype._celebrate = function () {
    this._celebrating = 4.5;
    IM.Audio.fanfare();
    const p = this.player.group.position;
    this.effects.fireworks(p);
    this.effects.confettiRain(p);
    this.world.showRainbow(11);
    for (const s of this.sheep) s.poke();
    this.friend.playTwirl();
    this.player.playTwirl();
    this.ui.showBanner('🎉 やったー！ 🎉', 3200);
  };

  // ---------- おともだちAI ----------
  Game.prototype._updateFriend = function (dt) {
    this._friendTimer -= dt;
    this._friendGiftCd = Math.max(0, this._friendGiftCd - dt);
    const fp = this.friend.group.position;
    const pp = this.player.group.position;
    const dist = Math.hypot(fp.x - pp.x, fp.z - pp.z);

    if (dist > 14) {
      // プレイヤーに近づく
      this.friend.setTarget(pp.x + IM.rand(-3, 3), pp.z + IM.rand(-3, 3));
      this._friendTimer = IM.rand(2, 4);
    } else if (this._friendTimer <= 0) {
      if (Math.random() < 0.5) {
        const a = IM.rand(0, IM.TAU);
        const r = IM.rand(3, 8);
        let tx = IM.clamp(pp.x + Math.cos(a) * r, -WORLD_LIMIT, WORLD_LIMIT);
        let tz = IM.clamp(pp.z + Math.sin(a) * r, -WORLD_LIMIT, WORLD_LIMIT);
        if (Math.hypot(tx - IM.POND.x, tz - IM.POND.z) > IM.POND.r + 1.5) {
          this.friend.setTarget(tx, tz);
        }
      } else if (dist < 5) {
        this.friend.playHop();
      }
      this._friendTimer = IM.rand(2.5, 6);
    }
  };

  // ---------- カメラ ----------
  Game.prototype._updateCamera = function (dt, time) {
    const p = this.player.group.position;
    const portrait = this.camera.aspect < 1;
    // 縦画面は少し高く・遠くから
    const dist = portrait ? 13.5 : 11;
    const height = portrait ? 8.6 : 6.6;
    const sway = Math.sin(time * 0.25) * 0.8;

    const tx = p.x + sway;
    const ty = p.y + height;
    const tz = p.z + dist;
    const k = 1 - Math.pow(0.0015, dt); // フレームレート非依存の滑らかさ
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camera.position.copy(this.camPos);

    const lx = p.x, ly = p.y + 1.6, lz = p.z;
    this.camLook.x += (lx - this.camLook.x) * k;
    this.camLook.y += (ly - this.camLook.y) * k;
    this.camLook.z += (lz - this.camLook.z) * k;
    this.camera.lookAt(this.camLook);
  };

  // ---------- リサイズ ----------
  Game.prototype._resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 縦画面では視野を広げて見やすく
    this.camera.fov = w / h < 1 ? 60 : 52;
    this.camera.updateProjectionMatrix();
  };

  // ---------- メインループ ----------
  Game.prototype._tick = function () {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;

    // 世界
    this.sky.update(dt, this.camPos, t);
    this.world.update(dt, t, this.sky.night01);
    this.effects.update(dt, t, this.sky.night01, this.player.group.position);
    this.ui.setTimeIcon(this.sky.isDay());

    // キャラクター
    this.player.update(dt, t);
    this.friend.update(dt, t);
    this._updateFriend(dt);
    for (const s of this.sheep) s.update(dt, t);
    for (const b of this.butterflies) b.update(dt, t);
    for (const b of this.balloons) b.update(dt, t);
    this.birds.update(dt, t);

    // いちご
    const pp = this.player.group.position;
    for (let i = this.berries.length - 1; i >= 0; i--) {
      const berry = this.berries[i];
      const u = berry.userData;
      if (u.falling) {
        berry.position.y -= 7 * dt;
        const gh = IM.groundHeight(berry.position.x, berry.position.z);
        if (berry.position.y <= gh) {
          berry.position.y = gh;
          u.falling = 0;
          this.effects.burst(berry.position, 0xff8fa8, 8, { speed: 1.6 });
        }
      } else {
        // ぷかぷか・くるくる
        berry.rotation.y += dt * 1.2;
        const bob = Math.sin(t * 2.2 + u.bobPhase) * 0.07 + 0.07;
        berry.position.y = IM.groundHeight(berry.position.x, berry.position.z) + bob;
        if (u.growing) {
          const s = Math.min(berry.scale.x + dt * 1.6, u.baseScale || 1);
          berry.scale.setScalar(s);
          if (s >= (u.baseScale || 1)) u.growing = false;
        }
        // 収集判定
        if (this.started && Math.hypot(berry.position.x - pp.x, berry.position.z - pp.z) < COLLECT_DIST) {
          this._collectBerry(i);
        }
      }
    }

    if (this._celebrating > 0) this._celebrating -= dt;

    this._updateCamera(dt, t);
    this.renderer.render(this.scene, this.camera);
  };

  // ---------- 起動 ----------
  window.addEventListener('DOMContentLoaded', () => {
    try {
      window.game = new Game();
    } catch (err) {
      console.error(err);
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#ffe3ec;color:#c04a6a;font-size:18px;padding:24px;text-align:center;z-index:99';
      el.textContent = 'ゲームを読み込めませんでした。ブラウザを最新にして、もう一度ためしてね。';
      document.body.appendChild(el);
    }
  });
})();
