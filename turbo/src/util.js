// Küçük yardımcılar
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// bir kare bekle; sekme arka plandaysa (requestAnimationFrame durur) zaman aşımıyla devam et
export const nextFrame = () => new Promise((r) => {
  let done = false;
  const go = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(go);
  setTimeout(go, 60);
});

export function ringArea(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const p = r[i], q = r[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function ringCentroid(r) {
  let x = 0, z = 0;
  for (const p of r) { x += p[0]; z += p[1]; }
  return [x / r.length, z / r.length];
}

export function pointInRing(x, z, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// yönlendirilmiş en küçük dikdörtgen (kenar yönleri denenir)
export function obb(r) {
  let best = null;
  for (let i = 0; i < r.length; i++) {
    const p = r[i], q = r[(i + 1) % r.length];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const L = Math.hypot(dx, dz);
    if (L < 0.5) continue;
    const ux = dx / L, uz = dz / L;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const s of r) {
      const a = s[0] * ux + s[1] * uz, b = -s[0] * uz + s[1] * ux;
      if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b;
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) {
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
      best = { area, ux, uz, L: a1 - a0, W: b1 - b0, cx: ca * ux - cb * uz, cz: ca * uz + cb * ux };
    }
  }
  return best;
}

// Yarış rotası: düzgün aralıklı yeniden örnekleme ve sorgular
export class Path {
  constructor(pts, step = 2) {
    // Catmull-Rom ile yumuşat
    const src = pts;
    const out = [];
    for (let i = 0; i < src.length - 1; i++) {
      const p0 = src[Math.max(0, i - 1)], p1 = src[i], p2 = src[i + 1], p3 = src[Math.min(src.length - 1, i + 2)];
      const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const n = Math.max(1, Math.ceil(L / 1));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), i + t]);
      }
    }
    const last = src[src.length - 1];
    out.push([last[0], last[1], src.length - 1]);
    // eşit aralık
    const cum = [0];
    for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
    this.length = cum[cum.length - 1];
    const N = Math.floor(this.length / step) + 1;
    this.step = this.length / (N - 1);
    this.x = new Float32Array(N); this.z = new Float32Array(N); this.src = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * this.step;
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const t = clamp((s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1);
      this.x[i] = lerp(out[j][0], out[j + 1][0], t);
      this.z[i] = lerp(out[j][1], out[j + 1][1], t);
      this.src[i] = lerp(out[j][2], out[j + 1][2], t);
    }
    this.N = N;
    this.tx = new Float32Array(N); this.tz = new Float32Array(N); this.curv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2);
      const dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a], L = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / L; this.tz[i] = dz / L;
    }
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 4), b = Math.min(N - 1, i + 4);
      const ang = Math.atan2(this.tz[b], this.tx[b]) - Math.atan2(this.tz[a], this.tx[a]);
      const d = Math.atan2(Math.sin(ang), Math.cos(ang));
      this.curv[i] = d / Math.max(1, (b - a) * this.step);
    }
    // ızgara: en yakın nokta araması için
    this.cell = 40;
    this.grid = new Map();
    for (let i = 0; i < N; i++) {
      const k = this.key(Math.floor(this.x[i] / this.cell), Math.floor(this.z[i] / this.cell));
      let arr = this.grid.get(k);
      if (!arr) this.grid.set(k, (arr = []));
      arr.push(i);
    }
  }
  key(i, j) { return i * 100003 + j; }
  // örnek indeksi (kesirli) → nokta
  at(s, out = {}) {
    const f = clamp(s / this.step, 0, this.N - 1.0001);
    const i = Math.floor(f), t = f - i;
    out.x = lerp(this.x[i], this.x[i + 1], t);
    out.z = lerp(this.z[i], this.z[i + 1], t);
    out.tx = lerp(this.tx[i], this.tx[i + 1], t);
    out.tz = lerp(this.tz[i], this.tz[i + 1], t);
    const L = Math.hypot(out.tx, out.tz) || 1;
    out.tx /= L; out.tz /= L;
    out.i = i;
    return out;
  }
  // en yakın nokta (s, yanal uzaklık); ipucu verilirse yerel arama
  nearest(x, z, hint = -1, win = 60) {
    let best = -1, bd = 1e18;
    if (hint >= 0) {
      const a = Math.max(0, hint - win), b = Math.min(this.N - 1, hint + win);
      for (let i = a; i <= b; i++) {
        const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (bd < 40 * 40) return this._refine(best, x, z);
    }
    const ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    for (let r = 0; r < 30 && (best < 0 || r < 2); r++) {
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const arr = this.grid.get(this.key(ci + di, cj + dj));
        if (!arr) continue;
        for (const i of arr) {
          const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
      }
    }
    if (best < 0) best = 0;
    return this._refine(best, x, z);
  }
  _refine(i, x, z) {
    const a = Math.max(0, i - 1), b = Math.min(this.N - 1, i + 1);
    let bs = i * this.step, bd = 1e18, lat = 0;
    for (let k = a; k < b; k++) {
      const dx = this.x[k + 1] - this.x[k], dz = this.z[k + 1] - this.z[k];
      const L2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - this.x[k]) * dx + (z - this.z[k]) * dz) / L2, 0, 1);
      const px = this.x[k] + dx * t, pz = this.z[k] + dz * t;
      const d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < bd) {
        bd = d; bs = (k + t) * this.step;
        const L = Math.sqrt(L2);
        // sağ normal: (-tz, tx)
        lat = ((x - px) * (-dz / L) + (z - pz) * (dx / L));
      }
    }
    return { s: bs, i: Math.round(bs / this.step), d: Math.sqrt(bd), lat };
  }
}
