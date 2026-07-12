// ほしのこモコ 〜ふわふわしまの まいにち〜
// メインループ / 入力 / モコのきもちAI / カメラ / ポストプロセス

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { World } from './world.js';
import { Moko } from './moko.js';
import { Effects } from './effects.js';
import { Critters } from './critters.js';
import { Props } from './props.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';

/* ---------- 起動チェック ---------- */

const canvas = document.getElementById('game-canvas');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  });
} catch (e) {
  document.getElementById('webgl-error').classList.remove('hidden');
  throw e;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

/* ---------- シーン構築 ---------- */

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300);

const world = new World(scene);
const moko = new Moko(scene);
const effects = new Effects(scene, world);
const critters = new Critters(scene);
const audio = new GameAudio();
const props = new Props(scene, world, effects, audio);
const ui = new UI();

/* ---------- ポストプロセス（ブルーム） ---------- */

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.7, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- カメラリグ ---------- */

const camRig = {
  azimuth: 0.45,
  polar: 1.12,        // y軸からの角度
  radius: 12,
  target: new THREE.Vector3(0, 1.0, 0),
  intro: 0,           // イントロ演出の進行
};

function updateCameraProjection() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = w / h;
  camera.aspect = aspect;
  // 縦画面では広角ぎみ + 引きぎみにして島全体が入るように
  camera.fov = aspect < 0.8 ? 66 : aspect < 1.1 ? 58 : 52;
  camera.updateProjectionMatrix();
  camRig.baseRadius = aspect < 0.8 ? 13.5 : aspect < 1.1 ? 12.5 : 11.5;
}

function applyCamera(t) {
  const introEase = 1 - Math.pow(1 - Math.min(camRig.intro / 3.0, 1), 3);
  const r = THREE.MathUtils.lerp(26, camRig.radius, introEase);
  const sway = Math.sin(t * 0.25) * 0.012;
  const az = camRig.azimuth + sway;
  // 夜は視線を少し上げて、星空と流れ星がよく見えるように
  const pol = Math.min(camRig.polar + world.night * 0.17, 1.4);
  camera.position.set(
    camRig.target.x + r * Math.sin(pol) * Math.sin(az),
    camRig.target.y + r * Math.cos(pol) + Math.sin(t * 0.4) * 0.05,
    camRig.target.z + r * Math.sin(pol) * Math.cos(az));
  camera.lookAt(camRig.target);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  updateCameraProjection();
  camRig.radius = Math.min(Math.max(camRig.radius, camRig.baseRadius - 3), camRig.baseRadius + 5);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();
camRig.radius = camRig.baseRadius;

/* ---------- ゲーム状態 ---------- */

const save = loadSave();
const state = {
  started: false,
  happiness: 0.35,
  stars: save.stars || 0,
  hat: save.hat || 0,
  starCombo: 0,
  giftTimer: 45,       // 最初のプレゼントはちょっと早めに
  hintTimer: 12,
  zzzTimer: 0,
  hopTimer: 0,
  celebrated: false,
};

function loadSave() {
  try { return JSON.parse(localStorage.getItem('moko-save') || '{}'); }
  catch (e) { return {}; }
}
function persist() {
  try { localStorage.setItem('moko-save', JSON.stringify({ stars: state.stars, hat: state.hat })); }
  catch (e) { /* プライベートブラウズ等では保存なしで続行 */ }
}

ui.setStars(state.stars);
ui.setHappiness(state.happiness);
moko.setHat(state.hat);

function addHappy(amount) {
  state.happiness = Math.min(1, state.happiness + amount);
  ui.setHappiness(state.happiness);
  if (state.happiness >= 0.999 && !state.celebrated) {
    state.celebrated = true;
    celebration();
  }
}

function celebration() {
  audio.tada();
  moko.celebrate();
  world.showRainbow();
  const p = moko.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  effects.confetti(p);
  setTimeout(() => effects.confetti(p.clone().add(new THREE.Vector3(0.8, 0.4, 0))), 400);
  setTimeout(() => effects.confetti(p.clone().add(new THREE.Vector3(-0.8, 0.6, 0))), 800);
  ui.toast('もこは とっても ごきげん！ 🎉');
  setTimeout(() => {
    state.happiness = 0.4;
    ui.setHappiness(state.happiness);
    state.celebrated = false;
  }, 4200);
}

/* ---------- スタート ---------- */

ui.onStart(() => {
  audio.init();
  state.started = true;
  moko.jump();
  audio.nya();
  effects.hearts(moko.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 3);
  setTimeout(() => ui.toast('もこと あそぼう！ 🐾'), 900);
});

/* ---------- ボタン ---------- */

ui.bindButtons({
  apple() {
    if (!state.started) return;
    const apple = props.spawnApple();
    if (apple) {
      audio.chime();
      ui.pulseButton('btnApple');
    }
  },
  ball() {
    if (!state.started) return;
    props.spawnBall(moko.position);
    audio.boing();
    ui.pulseButton('btnBall');
  },
  bubble() {
    if (!state.started) return;
    props.spawnBubbles(moko.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 11);
    audio.pop();
    moko.jump();
    ui.pulseButton('btnBubble');
  },
  water() {
    if (!state.started || props.watering) return;
    props.startWatering();
    ui.pulseButton('btnWater');
    setTimeout(() => {
      world.bloomFlowers();
      world.showRainbow();
      audio.chime();
      critters.addButterfly();
      addHappy(0.1);
      ui.toast('おはなが おおきくなった！ 🌸');
    }, 4300);
  },
  sky() {
    if (!state.started) return;
    const next = (world.phase + 1) % 3;
    world.setPhase(next);
    audio.setPhase(next);
    ui.setSkyIcon(next);
    audio.chime();
    if (next === 2) {
      ui.toast('よるに なったよ。ながれぼしを タッチ！ 🌠');
    } else if (next === 0) {
      ui.toast('あさに なったよ！ ☀️');
      if (moko.state === 'sleep') moko.wake();
    } else {
      ui.toast('ゆうやけ きれいだね 🌇');
    }
  },
  mute() {
    audio.setMuted(!audio.muted);
    ui.setMuteIcon(audio.muted);
  },
});

/* ---------- 入力（タッチ / マウス） ---------- */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map(); // マルチタッチ管理
let drag = null;            // { type, startX, startY, lastX, lastY, moved, t }
let pinchDist = 0;
let petCooldown = 0;

function setNdc(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}

function intersectFirst(objects, recursive = false) {
  if (!objects.length) return null;
  const hits = raycaster.intersectObjects(objects, recursive);
  return hits.length ? hits[0] : null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!state.started) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    drag = null;
    return;
  }

  setNdc(e);

  // 1) ながれぼし
  const starHit = intersectFirst(effects.shootingHitboxes);
  if (starHit) {
    catchShootingStar(starHit.object.userData.star, starHit.point);
    drag = null;
    return;
  }

  // 2) プレゼント（落ちてくるとちゅうでもタッチでOK）
  if (props.gift && props.gift.state !== 'open') {
    const giftHit = intersectFirst([props.gift.hit]);
    if (giftHit) { openGift(); drag = null; return; }
  }

  // 3) しゃぼんだま
  const bubHit = intersectFirst(props.bubbles.map((b) => b.m));
  if (bubHit) {
    const bub = props.bubbles.find((b) => b.m === bubHit.object);
    if (bub) { props.popBubble(bub); addHappy(0.015); }
    drag = null;
    return;
  }

  // 4) ボール（フリックで投げる）
  if (props.ball) {
    const ballHit = intersectFirst([props.ball.g], true);
    if (ballHit) {
      drag = { type: 'ball', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, t: performance.now() };
      return;
    }
  }

  // 5) モコ
  const mokoHit = intersectFirst([moko.hitMesh]);
  if (mokoHit) {
    drag = { type: 'moko', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, t: performance.now() };
    return;
  }

  // 6) じめん or カメラ
  drag = { type: 'orbit', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, t: performance.now() };
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.started) return;
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }

  // ピンチでズーム
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) {
      camRig.radius = THREE.MathUtils.clamp(
        camRig.radius * (pinchDist / d),
        camRig.baseRadius - 4, camRig.baseRadius + 6);
    }
    pinchDist = d;
    return;
  }

  if (!drag) return;
  const dx = e.clientX - drag.lastX;
  const dy = e.clientY - drag.lastY;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 8) drag.moved = true;

  if (drag.type === 'orbit' && drag.moved) {
    camRig.azimuth -= dx * 0.0052;
    camRig.polar = THREE.MathUtils.clamp(camRig.polar + dy * 0.003, 0.82, 1.34);
  } else if (drag.type === 'moko') {
    // なでなで
    setNdc(e);
    if (intersectFirst([moko.hitMesh])) {
      moko.pet(0.016);
      audio.purrStart();
      petCooldown -= 0.016;
      if (petCooldown <= 0) {
        petCooldown = 0.4;
        effects.hearts(moko.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 1);
        addHappy(0.008);
      }
    }
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
  audio.purrStop();
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!state.started) return;

  const quickTap = !d.moved && performance.now() - d.t < 450;

  if (d.type === 'moko') {
    if (quickTap) {
      moko.jump();
      audio.nya();
      effects.hearts(moko.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 3);
      addHappy(0.03);
    }
    return;
  }

  if (d.type === 'ball' && props.ball) {
    // フリックの向きへ投げる（画面の動き → 地面方向へ変換）
    const fx = d.lastX - d.startX;
    const fy = d.lastY - d.startY;
    const power = Math.min(Math.hypot(fx, fy) / 40, 7);
    if (power > 0.6) {
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0; fwd.normalize();
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      const dir = new THREE.Vector3()
        .addScaledVector(right, -fx / 100)
        .addScaledVector(fwd, fy / 100)
        .normalize();
      props.kickBall(dir, 2 + power);
      addHappy(0.01);
    } else if (quickTap) {
      props.kickBall(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), 3.5);
    }
    return;
  }

  if (d.type === 'orbit' && quickTap) {
    // じめんタップ → モコがあるいてくる
    setNdc({ clientX: d.startX, clientY: d.startY });
    const hit = intersectFirst([world.ground]);
    if (hit) {
      const p = hit.point.clone();
      const distC = Math.hypot(p.x, p.z);
      if (distC > world.islandRadius - 0.4) {
        p.multiplyScalar((world.islandRadius - 0.4) / distC);
      }
      // 池には入らない（ふちで止まる）
      const pd = new THREE.Vector2(p.x - world.pondCenter.x, p.z - world.pondCenter.z);
      if (pd.length() < world.pondRadius + 0.4) {
        pd.normalize().multiplyScalar(world.pondRadius + 0.45);
        p.x = world.pondCenter.x + pd.x;
        p.z = world.pondCenter.z + pd.y;
      }
      effects.sparkle(p.clone().setY(0.1), 0xbfe8ff, 8);
      moko.walkTo(p);
    }
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

/* ---------- ながれぼし & プレゼント ---------- */

function catchShootingStar(star, point) {
  effects.catchStar(star, point);
  state.starCombo = Math.min(state.starCombo + 1, 8);
  audio.twinkle(state.starCombo - 1);
  state.stars++;
  persist();

  // 3D座標 → 画面座標で星が HUD へ飛ぶ
  const sp = point.clone().project(camera);
  const sx = (sp.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-sp.y * 0.5 + 0.5) * window.innerHeight;
  ui.flyStarTo(sx, sy, () => ui.setStars(state.stars));

  addHappy(0.04);

  if (state.starCombo % 5 === 0) {
    // 5こ つかまえたら 花火！
    audio.tada();
    moko.celebrate();
    const cols = [0xff8ab0, 0xffe38a, 0x9fd8ff];
    cols.forEach((c, i) => {
      setTimeout(() => {
        effects.firework(new THREE.Vector3((Math.random() - 0.5) * 8, 6 + i, (Math.random() - 0.5) * 8), c);
      }, i * 380);
    });
    ui.toast('ほしを 5こ あつめたよ！ 🎆');
  }
}

function openGift() {
  if (!props.openGift()) return;
  addHappy(0.12);
  const giftPos = props.gift ? props.gift.g.position.clone() : moko.position.clone();
  moko.walkTo(giftPos.clone().add(new THREE.Vector3(0.5, 0, 0.5)), () => moko.jump());
  setTimeout(() => {
    state.hat = (state.hat % 4) + 1;
    moko.setHat(state.hat);
    persist();
    effects.hearts(moko.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 4);
    ui.toast(['あたらしい ぼうし！ 🧢', 'おはなの かんむり！ 🌼', 'ぴかぴかの かんむり！ 👑', 'いちごの ベレーぼう！ 🍓'][state.hat - 1]);
  }, 900);
}

/* ---------- モコのきもちAI ---------- */

let wanderTimer = 8;

function updateMokoAI(dt) {
  // りんごを見つけたら食べにいく
  if (moko.state === 'idle') {
    const apple = props.apples.find((a) => a.state === 'rest');
    if (apple) {
      apple.state = 'target';
      moko.walkTo(apple.g.position, () => {
        moko.faceTowards(apple.g.position, 1, 100);
        moko.startEat();
        props.eatApple(apple);
        audio.crunch();
        setTimeout(() => audio.crunch(), 400);
        setTimeout(() => audio.crunch(), 800);
        setTimeout(() => {
          audio.nya();
          effects.hearts(moko.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 3);
          addHappy(0.09);
        }, 1400);
      });
      return;
    }
  }

  // ボールを追いかける
  if (moko.state === 'idle' && props.ball && props.ball.resting) {
    const d = props.ball.g.position.distanceTo(moko.position);
    if (d > 1.1 && props.ball.g.position.y < 1) {
      moko.walkTo(props.ball.g.position, () => {
        if (!props.ball) return;
        const dir = props.ball.g.position.clone().sub(moko.position);
        dir.y = 0;
        if (dir.lengthSq() < 0.01) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        // 島のそとに蹴り出しにくいよう、中心向きに補正
        dir.normalize().lerp(props.ball.g.position.clone().multiplyScalar(-1).setY(0).normalize(), 0.55).normalize();
        props.kickBall(dir, 3.6);
        moko.jump();
      });
      return;
    }
  }

  // 夜、ひまになったら おひるね
  if (world.phase === 2 && moko.state === 'idle' && moko.idleTimer > 22) {
    moko.sleep();
    audio.yawn();
    return;
  }

  // ときどき きままに おさんぽ
  if (moko.state === 'idle') {
    wanderTimer -= dt;
    if (wanderTimer <= 0) {
      wanderTimer = 7 + Math.random() * 9;
      if (Math.random() < 0.7) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 4;
        const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
        const pd = new THREE.Vector2(p.x - world.pondCenter.x, p.z - world.pondCenter.z);
        if (pd.length() > world.pondRadius + 0.5) moko.walkTo(p);
      } else {
        moko.jump();
      }
    }
  }

  // ねているあいだの Zzz
  if (moko.state === 'sleep') {
    state.zzzTimer -= dt;
    if (state.zzzTimer <= 0) {
      state.zzzTimer = 1.7;
      effects.zzz(moko.position);
    }
  }

  // あるくときの ぴょこぴょこ音
  if (moko.state === 'walk') {
    state.hopTimer -= dt;
    if (state.hopTimer <= 0) {
      state.hopTimer = 0.35;
      audio.hop();
    }
  }
}

/* ---------- メインループ ---------- */

const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed;

  if (state.started) {
    camRig.intro += dt;

    // ごきげんは ゆっくり下がる（さみしくなる）
    state.happiness = Math.max(0.05, state.happiness - dt * 0.004);
    if (Math.floor(t * 2) % 8 === 0) ui.setHappiness(state.happiness);

    // プレゼントのタイマー
    state.giftTimer -= dt;
    if (state.giftTimer <= 0) {
      state.giftTimer = 75 + Math.random() * 40;
      props.spawnGift();
      audio.chime();
      ui.toast('あっ！ そらから なにか おちてくるよ 🎁');
    }

    // ヒント
    state.hintTimer -= dt;
    if (state.hintTimer <= 0) {
      state.hintTimer = 26;
      ui.nextHint();
    }

    updateMokoAI(dt);
  }

  world.update(dt, t);
  moko.update(dt, t, world.night);
  effects.update(dt, t, world.night, camera);
  critters.update(dt, t, world.night);
  props.update(dt, t);

  // 夜はブルームを強めて幻想的に
  bloom.strength = 0.35 + world.night * 0.5;

  applyCamera(t);
  composer.render();
}

tick();

// デバッグ・動作確認用（本番プレイには影響しない）
window.__game = { world, moko, state, camRig, effects, props, camera, raycaster, ndc };
