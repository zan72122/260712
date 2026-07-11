// ============================================================
// メイン — プリンセスと ひかりの おうこく
// レンダリング・カメラ・ゲームループ・おいわいの演出
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';

import { rand, pick, damp, clamp } from './utils.js';
import { KidsAudio } from './audio.js';
import { Particles } from './particles.js';
import { SkyAndLights } from './sky.js';
import { World } from './world.js';
import { Princess } from './princess.js';
import { Creatures } from './creatures.js';
import { Collectibles } from './collectibles.js';
import { Input } from './input.js';
import { UI } from './ui.js';

const STAR_GOAL = 10; // ⭐を10個あつめると花火のおいわい
const SAVE_KEY = 'princess-magic-world-v1';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();
    this.started = false;
    this.fireworkQueue = [];
    this.qualityTier = 0;
    this._slowTime = 0;

    const params = new URLSearchParams(location.search);
    this.fixedQuality = params.get('quality'); // low / high を指定可能

    this._setupRenderer();
    this._setupScene();
    this._loadSave();
    this._setupModules();
    this._setupUI();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._onResize(), 300));

    this.ui.hideLoading();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  // ---------------- セットアップ ----------------
  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    const maxPR = this.fixedQuality === 'low' ? 1 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);
    this.camera.position.set(0, 30, 42);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.5, 0.7, 0.82);
    this.bloomPass.enabled = this.fixedQuality !== 'low';
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  _loadSave() {
    this.save = { stars: 0, hearts: 0, dress: 0 };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(this.save, JSON.parse(raw));
    } catch (e) { /* プライベートブラウズなどでは保存なしで遊べる */ }
  }

  _persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* noop */ }
  }

  _setupModules() {
    this.audio = new KidsAudio();

    // 各モジュールで共有するコンテキスト
    this.ctx = {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      audio: this.audio,
      interactables: [],
      colliders: [],
      groundMesh: null,
      particles: null,
    };

    this.particles = new Particles(this.ctx);
    this.ctx.particles = this.particles;

    this.sky = new SkyAndLights(this.ctx);
    this.world = new World(this.ctx);
    this.ctx.groundMesh = this.world.ground;
    this.ctx.colliders = this.world.colliders;

    this.princess = new Princess(this.ctx);
    if (this.save.dress) this.princess.setDress(this.save.dress, false);
    this.creatures = new Creatures(this.ctx, this.world);
    this.collectibles = new Collectibles(this.ctx, this.world);

    // ---- タップできるもの: プリンセス本人 / お城 / 噴水 ----
    this.ctx.interactables.push({
      getPos: () => this.princess.pos, r: 1.0, y: 0.9,
      onTap: () => {
        this.princess.twirl();
        this.audio.playTwirl();
      },
    });
    const cp = this.world.castlePos;
    this.ctx.interactables.push({
      getPos: () => new THREE.Vector3(cp.x, 0, cp.z), r: 6.0, y: 5,
      onTap: () => {
        this.audio.playBell();
        this.fireworkQueue.push({ t: 0.3, x: cp.x + rand(-5, 5), y: rand(12, 16), z: cp.z + rand(-3, 3) });
      },
    });
    const ft = this.world.fountainTop;
    this.ctx.interactables.push({
      getPos: () => ft, r: 1.7, y: 0,
      onTap: () => {
        this.audio.playSplash();
        this.particles.splash(ft);
        this.audio.playGliss(84, 5, 0.04);
      },
    });

    // ---- あつめものイベント ----
    this.collectibles.onStar = () => {
      this.save.stars++;
      this._persist();
      this.ui.setStars(this.save.stars, this.save.stars % STAR_GOAL, STAR_GOAL);
      if (this.save.stars % STAR_GOAL === 0) this._celebrate();
    };
    this.collectibles.onHeart = () => {
      this.save.hearts++;
      this._persist();
      this.ui.setHearts(this.save.hearts);
    };
    this.collectibles.onItemTapped = (item) => {
      const p = item.mesh.position;
      this.princess.walkTo(p.x, p.z);
      this.particles.tapRing(new THREE.Vector3(p.x, 0.05, p.z), 0xffe28a);
    };

    // ---- 入力 ----
    this.input = new Input(this.ctx, this.canvas, {
      onGroundTap: (point) => {
        if (!this.started) return;
        this.princess.walkTo(point.x, point.z);
        this.particles.tapRing(point, 0xffffff);
        this.ui.dismissHint();
      },
      onInteract: (it) => {
        if (!this.started) return;
        it.onTap();
        this.ui.dismissHint();
      },
    });
  }

  _setupUI() {
    this.ui = new UI({
      onStart: () => this._start(),
      onTimeToggle: () => {
        const phase = this.sky.cyclePhase();
        this.ui.setTimeIcon(phase);
        this.audio.playPop();
      },
      onMagic: () => {
        this.particles.startMagicRain(this.princess.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
        this.audio.playMagic();
        this.ui.setMagicActive(true);
      },
      onDress: () => {
        const next = (this.princess.dressIndex + 1) % 5;
        this.princess.setDress(next);
        this.save.dress = next;
        this._persist();
      },
      onMusicToggle: () => {
        const muted = !this.audio.muted;
        this.audio.setMuted(muted);
        this.ui.setMusicIcon(muted);
      },
    });
    this.ui.setStars(this.save.stars, this.save.stars % STAR_GOAL, STAR_GOAL);
    this.ui.setHearts(this.save.hearts);
  }

  _start() {
    if (this.started) return;
    this.started = true;
    this.audio.init();
    this.ui.startGame();
    // オープニング: 空からプリンセスのもとへカメラが舞い降りる
    this.introT = 0;
    this.princess.twirl();
    this.particles.burst(this.princess.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd7ef, 40, 2.5);
  }

  // ---------------- 花火のおいわい ----------------
  _celebrate() {
    this.ui.celebrate();
    this.audio.playFanfare();
    this.princess.twirl();
    const cp = this.world.castlePos;
    for (let i = 0; i < 9; i++) {
      this.fireworkQueue.push({
        t: 0.4 + i * 0.42,
        x: cp.x + rand(-9, 9),
        y: rand(10, 17),
        z: cp.z + rand(-5, 4),
      });
    }
    // ちょうちょも おいわいに集まる
    this.particles.startMagicRain(this.princess.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
  }

  _updateFireworks(dt) {
    const colors = [0xff6f9c, 0xffd166, 0x8fd7ff, 0xc79bff, 0x7ee081, 0xff9d76];
    for (const fw of this.fireworkQueue) {
      fw.t -= dt;
      if (fw.t <= 0) {
        this.particles.firework(new THREE.Vector3(fw.x, fw.y, fw.z), pick(colors));
        this.audio.playFirework();
      }
    }
    this.fireworkQueue = this.fireworkQueue.filter((fw) => fw.t > 0);
  }

  // ---------------- カメラ ----------------
  _updateCamera(dt) {
    const aspect = this.camera.aspect;
    // 縦画面では高く遠くから、横画面では近くから
    const t = clamp((aspect - 0.6) / (1.7 - 0.6), 0, 1);
    const dist = 12.6 - t * 3.4;
    const height = 6.6 - t * 2.2;
    const fov = 62 - t * 9;
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this._updateParticleScale();
    }

    const p = this.princess.pos;
    const look = new THREE.Vector3(p.x, 1.4, p.z);
    let desired = new THREE.Vector3(p.x * 0.82, height, p.z + dist);

    // オープニングの舞い降り
    if (this.introT !== undefined && this.introT < 1) {
      this.introT = Math.min(1, this.introT + dt / 3.2);
      const e = 1 - Math.pow(1 - this.introT, 3);
      const from = new THREE.Vector3(0, 26, 34);
      desired = from.lerp(desired, e);
      this.camera.position.copy(desired);
    } else {
      this.camera.position.x = damp(this.camera.position.x, desired.x, 3.2, dt);
      this.camera.position.y = damp(this.camera.position.y, desired.y, 3.2, dt);
      this.camera.position.z = damp(this.camera.position.z, desired.z, 3.2, dt);
    }
    // ほんのり呼吸するようなゆらぎ
    const time = this.clock.elapsedTime;
    look.y += Math.sin(time * 0.5) * 0.06;
    this.camera.lookAt(look);
  }

  // ---------------- 画質の自動調整（カクカクしたら軽くする） ----------------
  _autoQuality(dt) {
    if (this.fixedQuality) return;
    if (dt > 0.045) this._slowTime += dt; else this._slowTime = Math.max(0, this._slowTime - dt * 0.5);
    if (this._slowTime > 2.5 && this.qualityTier < 3) {
      this.qualityTier++;
      this._slowTime = 0;
      if (this.qualityTier === 1) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      } else if (this.qualityTier === 2) {
        this.renderer.setPixelRatio(1.2);
        this.bloomPass.enabled = false;
      } else {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.sky.sun.castShadow = false;
      }
      this._onResize();
    }
  }

  // ---------------- リサイズ ----------------
  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this._updateParticleScale();
  }

  _updateParticleScale() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.particles.onResize(size.y * this.renderer.getPixelRatio(), this.camera.fov);
  }

  // ---------------- メインループ ----------------
  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;

    this.sky.update(dt, time);
    this.world.update(dt, time, this.sky, this.particles);
    this.princess.update(dt);
    this.creatures.update(dt, this.princess, this.sky.nightFactor, this.particles.magicActive);
    this.collectibles.update(dt, time, this.princess);
    this.particles.update(dt, this.princess.pos);
    this._updateFireworks(dt);
    this._updateCamera(dt);
    this._autoQuality(dt);

    if (!this.particles.magicActive) this.ui.setMagicActive(false);

    // 夜はブルームを強めて、光をよりドラマチックに
    this.bloomPass.strength = 0.45 + this.sky.nightFactor * 0.35;

    this.composer.render();
  }
}

// 起動
window.__game = new Game();
