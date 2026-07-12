/* ================================================================
   materials.js — toon shading + the paint system
   Every "paintable" starts as pencil-sketch grey and blooms into
   colour with a bouncy tween when the magic brush touches it.
   ================================================================ */
window.GAME = window.GAME || {};

GAME.Mat = (function () {
  const T = THREE;

  /* ---------- toon gradient map (4 bands, soft) ---------- */
  let gradientMap = null;
  function getGradient() {
    if (gradientMap) return gradientMap;
    const steps = [64, 122, 182, 228];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => {
      data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    });
    gradientMap = new T.DataTexture(data, steps.length, 1, T.RGBAFormat);
    gradientMap.minFilter = T.NearestFilter;
    gradientMap.magFilter = T.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
    return gradientMap;
  }

  /* ---------- material factories ---------- */

  // plain toon material (already coloured, not paintable).
  // colours are converted sRGB→linear so the sRGB output stage shows
  // the exact hex we picked (rich, not washed out).
  function toon(hex, opts) {
    const m = new T.MeshToonMaterial(Object.assign({
      color: hex,
      gradientMap: getGradient(),
    }, opts || {}));
    m.color.convertSRGBToLinear();
    if (m.emissive) m.emissive.convertSRGBToLinear();
    return m;
  }

  // the sketchy grey a colour collapses to before it is painted
  // works in linear space (material colours are linear by then)
  const GREY_TINT = new T.Color(0x7d8598).convertSRGBToLinear();
  function greyOf(color) {
    const c = (color && color.isColor) ? color : new T.Color(color);
    const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const g = new T.Color(lum, lum, lum);
    g.lerp(GREY_TINT, 0.5);
    g.multiplyScalar(0.7); // pencil sketch, clearly dimmer than the painted world
    return g;
  }

  /* ---------- paintable registry ---------- */

  const paintables = [];   // { group, mats:[{mat, target, grey}], painted, zone, popupScale }
  let paintedCount = 0;

  /* Mark a whole prop group as paintable. Clones materials so each
     prop tweens independently, stores target colours, greys it out. */
  function makePaintable(group, zoneId) {
    const entry = { group, mats: [], painted: false, zone: zoneId, anim: 0 };
    group.traverse((o) => {
      if (o.isMesh) {
        const orig = o.material;
        const mat = orig.clone();
        o.material = mat;
        const target = mat.color.clone();
        const grey = greyOf(target);
        mat.color.copy(grey);
        let emissive = null;
        if (mat.emissive && mat.emissive.getHex() !== 0) {
          emissive = mat.emissive.clone();
          mat.emissive.setScalar(0);
        }
        entry.mats.push({ mat, target, grey, emissive });
      }
    });
    group.userData.paintable = entry;
    paintables.push(entry);
    return entry;
  }

  const activeTweens = [];

  /* Trigger the grey → colour bloom. Returns false if already painted. */
  function paint(entry) {
    if (entry.painted) return false;
    entry.painted = true;
    paintedCount++;
    activeTweens.push({ entry, t: 0 });
    return true;
  }

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  const _tmpC = new T.Color();
  function update(dt) {
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      const tw = activeTweens[i];
      tw.t += dt / 0.8;                       // 0.8s bloom
      const t = Math.min(1, tw.t);
      const colT = Math.min(1, t * 1.6);      // colour arrives faster than bounce
      tw.entry.mats.forEach((m) => {
        m.mat.color.copy(_tmpC.copy(m.grey).lerp(m.target, colT));
        if (m.emissive) m.mat.emissive.copy(_tmpC.set(0)).lerp(m.emissive, colT);
      });
      // bouncy scale pop: swells to ~125% then settles back
      const base = tw.entry.group.userData.baseScale || 1;
      tw.entry.group.scale.setScalar(base * (1 + 0.25 * Math.sin(t * Math.PI) * easeOutBack(Math.min(1, t + 0.2)) * 0.9));
      if (t >= 1) {
        tw.entry.group.scale.setScalar(base);
        activeTweens.splice(i, 1);
      }
    }
  }

  return {
    toon, getGradient, greyOf, makePaintable, paint, update,
    get paintables() { return paintables; },
    get paintedCount() { return paintedCount; },
    get total() { return paintables.length; },
  };
})();
