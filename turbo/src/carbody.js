// Parametrik araba gövdesi: boy boyunca kesitlerden örülen pürüzsüz yüzey
import * as THREE from 'three';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ease = (t) => t * t * (3 - 2 * t);

// anahtar noktalar arasında monoton kübik geçiş (dalgasız yüzey)
function keys(arr) {
  const n = arr.length, X = arr.map((p) => p[0]), Y = arr.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= X[0]) return Y[0];
    if (x >= X[n - 1]) return Y[n - 1];
    let i = 0;
    while (x > X[i + 1]) i++;
    const h = X[i + 1] - X[i], t = (x - X[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// spec: L, W, wb (dingil), wr (teker yarıçapı), clear, archR, noseR, tailR, flare,
//       shoulder: [[x,y]...], top: [[x,y]...], g0 (ön cam tabanı x), g1 (arka cam sonu x), wsLen, rearLen, roof, glassIn, roofIn
export function carShape(sp, res = 1) {
  const { L, W, wb } = sp;
  const xf = L / 2, xr = -L / 2, ax = wb / 2;
  const sh = keys(sp.shoulder), tp = keys(sp.top);
  const halfW = (x) => {
    let w = W / 2;
    w -= (sp.noseTaper || 0.12) * ease(clamp((x - (xf - 1.0)) / 1.0, 0, 1));
    w -= (sp.tailTaper || 0.05) * ease(clamp(((xr + 0.9) - x) / 0.9, 0, 1));
    for (const a of [ax, -ax]) { const d = (x - a) / 0.9; if (Math.abs(d) < 1) w += (sp.flare || 0) * Math.cos(d * Math.PI / 2) ** 2; }
    if (x > xf - sp.noseR) { const t = (x - (xf - sp.noseR)) / sp.noseR; w *= Math.sqrt(Math.max(0, 1 - t * t)); }
    if (x < xr + sp.tailR) { const t = ((xr + sp.tailR) - x) / sp.tailR; w *= Math.sqrt(Math.max(0, 1 - t * t)); }
    return w;
  };
  const bottom = (x) => {
    let y = sp.clear;
    for (const a of [ax, -ax]) { const d = Math.abs(x - a); if (d < sp.archR) y = Math.max(y, sp.wr - 0.02 + Math.sqrt(sp.archR * sp.archR - d * d)); }
    y = Math.max(y, sp.clear + 0.14 * ease(clamp((x - (xf - 0.45)) / 0.45, 0, 1)) + 0.12 * ease(clamp(((xr + 0.4) - x) / 0.4, 0, 1)));
    return y;
  };
  // gövde kesiti, t: 0 alt orta → 1 üst orta
  const section = (x, t) => {
    const w = halfW(x), y0 = bottom(x), ys = Math.max(sh(x), y0 + 0.12), yt = tp(x);
    if (t < 0.18) { const k = t / 0.18; return [w * 0.9 * k, y0]; }
    if (t < 0.32) { const k = (t - 0.18) / 0.14, a = k * Math.PI / 2; return [w * 0.9 + w * 0.1 * Math.sin(a), y0 + 0.07 * (1 - Math.cos(a))]; }
    if (t < 0.55) { const k = (t - 0.32) / 0.23; return [w * (1 - 0.012 * k), y0 + 0.07 + (ys - y0 - 0.07) * k]; }
    const k = (t - 0.55) / 0.45, a = k * Math.PI / 2, n = 2.7;
    const c = Math.cos(a), s = Math.sin(a);
    return [w * 0.988 * Math.pow(c, 2 / n), ys + (yt - ys) * Math.pow(s, 2 / n)];
  };
  const xs = [];
  const st = 0.035 / res;
  for (let x = xr; x < xf; x += (x < xr + 0.3 || x > xf - 0.4) ? st * 0.5 : st) xs.push(x);
  xs.push(xf);
  const NV = Math.round(22 * res) * 2;
  const grid = (xsArr, fn, nv) => {
    const P = [];
    for (const x of xsArr) {
      for (let j = 0; j <= nv; j++) {
        const v = j / (nv / 2);
        const t = v <= 1 ? v : 2 - v;
        const side = v <= 1 ? 1 : -1;
        const [z, y] = fn(x, t);
        P.push(x, y, side * z);
      }
    }
    const I = [];
    const row = nv + 1;
    for (let i = 0; i < xsArr.length - 1; i++) for (let j = 0; j < nv; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      I.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(I);
    g.computeVertexNormals();
    return g;
  };
  const body = grid(xs, section, NV);
  // cam kabin
  const g0 = sp.g0, g1 = sp.g1;
  const prof = (x) => {
    const t1 = clamp((g0 - x) / sp.wsLen, 0, 1), t2 = clamp((x - g1) / sp.rearLen, 0, 1);
    return (1 - (1 - t1) * (1 - t1)) * (sp.fastback ? Math.sqrt(t2) * ease(t2) ** 0.3 : 1 - (1 - t2) * (1 - t2));
  };
  const cabSec = (x, t) => {
    const yb = sh(x) - 0.015, f = prof(x);
    const yr = yb + (sp.roof - yb) * f;
    const wb2 = halfW(x) * (sp.glassIn || 0.88), wt = wb2 * (sp.roofIn || 0.78);
    if (t < 0.5) { const k = t / 0.5; const kk = Math.sin(k * Math.PI / 2); return [wb2 + (wt - wb2) * k - 0.03 * Math.sin(k * Math.PI), yb + (yr - yb) * kk * (0.5 + 0.5 * k)]; }
    const k = (t - 0.5) / 0.5, a = k * Math.PI / 2;
    return [wt * Math.pow(Math.cos(a), 2 / 2.4), yr + 0.035 * f * Math.pow(Math.sin(a), 2 / 2.4)];
  };
  const cxs = [];
  for (let x = g1; x <= g0 + 1e-6; x += st) cxs.push(x);
  const NC = Math.round(12 * res) * 2;
  const cab = grid(cxs, cabSec, NC);
  // tavan boyalı, gerisi cam (gruplar)
  const roofI = [], glassI = [];
  const I = cab.index.array, row = NC + 1;
  for (let q = 0; q < I.length; q += 6) {
    const a = I[q], i = Math.floor(a / row), j = a % row;
    const x = cxs[i], f = prof(x);
    const v = j / (NC / 2), t = v <= 1 ? v : 2 - v;
    const pillar = Math.abs(x - (sp.bPillar ?? -0.45)) < 0.07 && t < 0.5;
    const roof = (f > 0.93 && t > 0.62) || pillar || (sp.cPillar && x < g1 + sp.rearLen * 0.9 && t < 0.5);
    for (let k = 0; k < 6; k++) (roof ? roofI : glassI).push(I[q + k]);
  }
  cab.setIndex([...glassI, ...roofI]);
  cab.clearGroups();
  cab.addGroup(0, glassI.length, 0);
  cab.addGroup(glassI.length, roofI.length, 1);
  return { body, cab, halfW, bottom, sh, tp, xf, xr, ax };
}

// spor araba ve trafik gövdeleri için hazır ölçüler
export const SPECS = {
  sport: {
    L: 4.55, W: 1.98, wb: 2.72, wr: 0.35, clear: 0.24, archR: 0.42, noseR: 0.2, tailR: 0.07, flare: 0.035, noseTaper: 0.16, tailTaper: 0.05,
    shoulder: [[-2.275, 0.84], [-1.7, 0.9], [-1.36, 0.9], [-0.4, 0.84], [0.8, 0.8], [1.36, 0.76], [2.0, 0.66], [2.275, 0.5]],
    top: [[-2.275, 0.86], [-2.15, 0.96], [-1.6, 0.93], [-0.4, 0.86], [0.8, 0.81], [1.5, 0.74], [2.1, 0.64], [2.275, 0.5]],
    g0: 0.95, g1: -1.95, wsLen: 0.95, rearLen: 1.2, roof: 1.22, glassIn: 0.86, roofIn: 0.76, fastback: true, bPillar: -0.42,
  },
  sedan: {
    L: 4.6, W: 1.8, wb: 2.7, wr: 0.32, clear: 0.2, archR: 0.4, noseR: 0.16, tailR: 0.1, flare: 0.0, noseTaper: 0.12, tailTaper: 0.06,
    shoulder: [[-2.3, 0.9], [-1.3, 0.94], [0, 0.9], [1.3, 0.86], [2.0, 0.8], [2.3, 0.62]],
    top: [[-2.3, 0.92], [-2.1, 0.98], [-1.3, 0.98], [0, 0.92], [1.0, 0.9], [2.0, 0.82], [2.3, 0.62]],
    g0: 0.95, g1: -1.35, wsLen: 0.8, rearLen: 0.6, roof: 1.45, glassIn: 0.88, roofIn: 0.8, bPillar: -0.25, cPillar: true,
  },
  hatch: {
    L: 4.05, W: 1.76, wb: 2.55, wr: 0.31, clear: 0.2, archR: 0.39, noseR: 0.16, tailR: 0.08, flare: 0.0, noseTaper: 0.12, tailTaper: 0.04,
    shoulder: [[-2.025, 0.92], [-1.0, 0.95], [0.6, 0.9], [1.5, 0.84], [2.025, 0.64]],
    top: [[-2.025, 0.95], [-1.0, 0.98], [0.6, 0.92], [1.5, 0.86], [2.025, 0.64]],
    g0: 0.85, g1: -1.98, wsLen: 0.8, rearLen: 0.22, roof: 1.48, glassIn: 0.88, roofIn: 0.82, bPillar: -0.35, cPillar: true,
  },
  suv: {
    L: 4.7, W: 1.9, wb: 2.8, wr: 0.38, clear: 0.3, archR: 0.47, noseR: 0.18, tailR: 0.08, flare: 0.02, noseTaper: 0.1, tailTaper: 0.04,
    shoulder: [[-2.35, 1.08], [-1.0, 1.1], [0.6, 1.05], [1.6, 1.0], [2.35, 0.8]],
    top: [[-2.35, 1.1], [-1.0, 1.12], [0.6, 1.08], [1.6, 1.04], [2.35, 0.8]],
    g0: 0.95, g1: -2.25, wsLen: 0.75, rearLen: 0.25, roof: 1.72, glassIn: 0.9, roofIn: 0.84, bPillar: -0.35, cPillar: true,
  },
};
