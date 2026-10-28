// Kodla üretilen dokular (dosya indirmeden)
import * as THREE from 'three';
import { rng } from './util.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// döşenebilir değer gürültüsü (periyot = size/period hücre)
export function valueNoise(size, cells, seed) {
  const r = rng(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(size * size);
  const s = cells / size;
  for (let y = 0; y < size; y++) {
    const fy = y * s, iy = Math.floor(fy), ty = fy - iy, uy = ty * ty * (3 - 2 * ty);
    const y0 = (iy % cells) * cells, y1 = ((iy + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const fx = x * s, ix = Math.floor(fx), tx = fx - ix, ux = tx * tx * (3 - 2 * tx);
      const x0 = ix % cells, x1 = (ix + 1) % cells;
      const a = g[y0 + x0], b = g[y0 + x1], c = g[y1 + x0], d = g[y1 + x1];
      out[y * size + x] = (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
    }
  }
  return out;
}

export function fbm(size, base, oct, seed) {
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const n = valueNoise(size, base << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function normalFromHeight(h, size, k) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xl = h[y * size + ((x - 1 + size) % size)], xr = h[y * size + ((x + 1) % size)];
    const yu = h[((y - 1 + size) % size) * size + x], yd = h[((y + 1) % size) * size + x];
    let nx = (xl - xr) * k, ny = (yd - yu) * k, nz = 1;
    const L = Math.hypot(nx, ny, nz);
    const i = (y * size + x) * 4;
    d[i] = (nx / L * 0.5 + 0.5) * 255; d[i + 1] = (ny / L * 0.5 + 0.5) * 255; d[i + 2] = (nz / L * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Asfalt: agrega taneleri, yamalar, çatlaklar
export function asphalt() {
  const S = 1024;
  const big = fbm(S, 4, 4, 11), fine = valueNoise(S, 256, 7), grit = valueNoise(S, 512, 9);
  const r = rng(5);
  const c = canvas(S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  const H = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    let v = 0.23 + (big[i] - 0.5) * 0.10 + (fine[i] - 0.5) * 0.07;
    const g = grit[i];
    if (g > 0.80) v += (g - 0.80) * 1.1;          // açık renkli taş
    if (g < 0.16) v -= (0.16 - g) * 0.7;          // koyu boşluk
    v += (r() - 0.5) * 0.05;
    H[i] = g;
    const k = Math.max(0, Math.min(1, v)) * 255;
    d[i * 4] = k * 0.98; d[i * 4 + 1] = k * 0.99; d[i * 4 + 2] = k * 1.02; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // yamalar
  for (let p = 0; p < 7; p++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '20,20,22' : '90,90,92'},${0.10 + r() * 0.12})`;
    const x = r() * S, y = r() * S, w = 80 + r() * 260, h = 60 + r() * 200;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) ctx.fillRect(x + ox, y + oy, w, h);
  }
  // çatlaklar
  ctx.strokeStyle = 'rgba(8,8,9,0.55)';
  for (let k = 0; k < 16; k++) {
    let x = r() * S, y = r() * S, a = r() * 6.28;
    ctx.lineWidth = 1 + r() * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 30; s++) {
      a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return { map: tex(c), normalMap: tex(normalFromHeight(H, S, 2.2), false) };
}

// Kaldırım: parke taşı (yarım kaydırmalı dizi), gri ve kırmızımsı tonlar
export function pavers() {
  const S = 512, rows = 10, cols = 5; // 2 m karede 0.2 x 0.4 m taşlar
  const c = canvas(S), ctx = c.getContext('2d');
  const r = rng(21);
  const H = new Float32Array(S * S);
  ctx.fillStyle = '#4b4846'; ctx.fillRect(0, 0, S, S);
  const ph = S / rows, pw = S / cols;
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * pw / 2;
    for (let i = -1; i < cols + 1; i++) {
      const x = i * pw + off, y = j * ph;
      const red = r() < 0.06;
      const t = 0.62 + r() * 0.12;
      const R = red ? 150 * t + 40 : 175 * t, G = red ? 95 * t + 25 : 170 * t, B = red ? 85 * t + 20 : 162 * t;
      ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      ctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
    }
  }
  // kir ve leke
  const n = fbm(S, 8, 4, 33);
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    const m = 0.78 + n[i] * 0.34 + (r() - 0.5) * 0.06;
    d[i * 4] *= m; d[i * 4 + 1] *= m; d[i * 4 + 2] *= m;
    const lum = d[i * 4 + 1] / 255;
    H[i] = lum > 0.3 ? 1 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: tex(normalFromHeight(H, S, 1.4), false) };
}

// Taş (rıhtım duvarı, köprü yanları)
export function stone() {
  const S = 512, c = canvas(S), ctx = c.getContext('2d');
  const r = rng(77);
  ctx.fillStyle = '#5d5a55'; ctx.fillRect(0, 0, S, S);
  const rows = 8;
  for (let j = 0; j < rows; j++) {
    let x = -r() * 80;
    while (x < S) {
      const w = 50 + r() * 70, t = 0.75 + r() * 0.35;
      ctx.fillStyle = `rgb(${(150 * t) | 0},${(143 * t) | 0},${(130 * t) | 0})`;
      ctx.fillRect(x + 2, j * (S / rows) + 2, w - 4, S / rows - 4);
      x += w;
    }
  }
  const n = fbm(S, 8, 4, 5);
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < S * S; i++) { const m = 0.75 + n[i] * 0.4; d[i * 4] *= m; d[i * 4 + 1] *= m; d[i * 4 + 2] *= m; }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

export function grass() {
  const S = 512, c = canvas(S), ctx = c.getContext('2d');
  const n = fbm(S, 8, 5, 41), f = valueNoise(S, 256, 3);
  const img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    const v = n[i] * 0.6 + f[i] * 0.4;
    d[i * 4] = 52 + v * 50; d[i * 4 + 1] = 78 + v * 62; d[i * 4 + 2] = 34 + v * 26; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

// Su yüzeyi için döşenebilir normal haritası (sinüs dalgaları toplamı)
export function waterNormals() {
  const S = 512;
  const r = rng(99);
  const H = new Float32Array(S * S);
  const waves = [];
  for (let k = 0; k < 28; k++) {
    const kx = Math.round((r() - 0.5) * (6 + k * 1.6)), ky = Math.round((r() - 0.5) * (6 + k * 1.6));
    if (!kx && !ky) continue;
    waves.push([kx, ky, r() * 6.283, 1 / Math.pow(Math.hypot(kx, ky), 1.25)]);
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0;
    for (const [kx, ky, ph, a] of waves) h += Math.sin(((kx * x + ky * y) / S) * 6.2832 + ph) * a;
    H[y * S + x] = h;
  }
  const t = tex(normalFromHeight(H, S, 9), false);
  return t;
}

export function radial(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', S = 128) {
  const c = canvas(S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c, true, false);
}

// Kontrol noktası pankartı
export function banner(text, sub) {
  const c = canvas(1024, 256), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, 'rgba(255,90,31,0)'); g.addColorStop(0.15, 'rgba(255,90,31,0.85)'); g.addColorStop(0.85, 'rgba(255,140,40,0.85)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 40, 1024, 176);
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 800 118px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, sub ? 112 : 128);
  if (sub) { ctx.font = 'italic 600 40px "Barlow Condensed", Arial, sans-serif'; ctx.fillText(sub, 512, 186); }
  return tex(c, true, false);
}

// Gece gökyüzü yıldızları için nokta dokusu
export function starDot() {
  return radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 32);
}

// Yaprak kümesi dokusu (ağaç kartları için, alfa kesimli)
export function leaves() {
  const S = 512, c = canvas(S), g = c.getContext('2d');
  const r = rng(314);
  g.clearRect(0, 0, S, S);
  for (let k = 0; k < 2600; k++) {
    // yuvarlak kümeye dağılım, kenara doğru seyrelir
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.65) * S * 0.46;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.92;
    const top = 1 - y / S;
    const l = 0.55 + top * 0.35 + (r() - 0.5) * 0.25 - (d / (S * 0.46)) * 0.12;
    const h = 95 + r() * 30;
    g.fillStyle = `hsl(${h}, ${38 + r() * 22}%, ${Math.max(10, Math.min(60, l * 46))}%)`;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI);
    g.beginPath(); g.ellipse(0, 0, 5 + r() * 6, 2.5 + r() * 3, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
