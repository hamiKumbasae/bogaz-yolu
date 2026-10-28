// Cephe modülleri: kodla çizilen duvar, pencere ve dükkân dokuları (tek doku dizisi)
// Pencere/dükkân katmanlarında alfa = sınıf: 255 opak ayrıntı, 128 cam, 0 duvar (bina rengiyle boyanır)
import * as THREE from 'three';
import { rng, } from './util.js';
import { valueNoise, fbm } from './textures.js';

const S = 512;

// katman sırası (shader bu dizinleri kullanır)
export const L = {
  // duvarlar (2 m x 2 m, döşenir)
  W_PLASTER: 0, W_PLASTER_OLD: 1, W_TILE: 2, W_BRICK: 3, W_STONE: 4, W_WOOD: 5, W_CONCRETE: 6, W_MARBLE: 7,
  // pencereler (bir bölme x bir kat)
  PVC: 8, PVC_SHUTTER: 9, ALU_WIDE: 10, LEVANT: 11, SHUTTERS: 12, CURTAIN: 13, BALC_DOOR: 14, SMALL: 15, PALACE: 16, OTTOMAN: 17,
  // dükkânlar (bir bölme x zemin kat)
  SHOP: 18, KEPENK: 19, ENTRANCE: 20, CAFE: 21, SHOP_HALF: 22, BANK: 23,
};
export const LAYERS = 24;

function layer() {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const m = document.createElement('canvas'); m.width = m.height = S;
  const cc = c.getContext('2d'), mc = m.getContext('2d');
  cc.fillStyle = '#c8c4bc'; cc.fillRect(0, 0, S, S);
  mc.fillStyle = '#000'; mc.fillRect(0, 0, S, S);
  return { c, m, cc, mc };
}

// metre → piksel (x soldan, y alttan)
function frame(mw, mh) {
  const sx = S / mw, sy = S / mh;
  return { X: (x) => x * sx, Y: (y) => S - y * sy, W: (w) => w * sx, H: (h) => h * sy, sx, sy };
}

const cls = { opaque: '#fff', glass: '#808080', wall: '#000' };

function rectC(L, x, y, w, h, color, k) {
  L.cc.fillStyle = color; L.cc.fillRect(x, y, w, h);
  if (k) { L.mc.fillStyle = cls[k]; L.mc.fillRect(x, y, w, h); }
}

// cam bölmesi: koyu degrade, gökyüzü yansıması, isteğe bağlı perde
function glass(L, x, y, w, h, r, opt = {}) {
  const g = L.cc.createLinearGradient(x, y, x + w * 0.3, y + h);
  const tint = opt.tint || [34, 46, 58];
  g.addColorStop(0, `rgb(${tint[0] + 22},${tint[1] + 28},${tint[2] + 34})`);
  g.addColorStop(0.55, `rgb(${tint[0]},${tint[1]},${tint[2]})`);
  g.addColorStop(1, `rgb(${tint[0] + 14},${tint[1] + 14},${tint[2] + 12})`);
  L.cc.fillStyle = g; L.cc.fillRect(x, y, w, h);
  L.mc.fillStyle = cls.glass; L.mc.fillRect(x, y, w, h);
  // çapraz yansıma şeridi
  L.cc.save();
  L.cc.beginPath(); L.cc.rect(x, y, w, h); L.cc.clip();
  L.cc.fillStyle = 'rgba(170,190,205,0.16)';
  L.cc.beginPath();
  const o = r() * w;
  L.cc.moveTo(x + o, y); L.cc.lineTo(x + o + w * 0.35, y); L.cc.lineTo(x + o - w * 0.25, y + h); L.cc.lineTo(x + o - w * 0.6, y + h); L.cc.fill();
  // perde
  const kind = opt.curtain !== undefined ? opt.curtain : Math.floor(r() * 4);
  if (kind === 1 || kind === 2) {
    const col = [[222, 214, 196], [205, 190, 170], [190, 200, 205], [215, 200, 205]][Math.floor(r() * 4)];
    const sides = kind === 1 ? [[x, w * (0.25 + r() * 0.15)], [x + w * (0.65 + r() * 0.1), w * 0.4]] : [[x, w]];
    for (const [cx, cw] of sides) {
      for (let k = 0; k < cw; k += 2) {
        const s = 0.82 + 0.18 * Math.sin((k / cw) * Math.PI * (6 + r() * 2));
        L.cc.fillStyle = `rgba(${col[0] * s | 0},${col[1] * s | 0},${col[2] * s | 0},${kind === 2 ? 0.45 : 0.92})`;
        L.cc.fillRect(cx + k, y, 2, h);
      }
    }
  } else if (kind === 3) {
    // stor perde yarı inik
    const sh = h * (0.2 + r() * 0.5);
    L.cc.fillStyle = 'rgb(210,203,188)'; L.cc.fillRect(x, y, w, sh);
    L.cc.fillStyle = 'rgba(0,0,0,0.12)'; L.cc.fillRect(x, y + sh - 3, w, 3);
  }
  L.cc.restore();
}

// sıva duvar dokusu (gri; shader bina rengiyle çarpar)
function wallPlaster(L, rough, seed) {
  const n = fbm(S, 8, 5, seed), f = valueNoise(S, 256, seed + 3), g = valueNoise(S, 128, seed + 9);
  const img = L.cc.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    let v = 0.86 + (n[i] - 0.5) * (rough ? 0.22 : 0.10) + (f[i] - 0.5) * (rough ? 0.10 : 0.05) + (g[i] - 0.5) * 0.04;
    if (rough && n[i] > 0.72) v -= (n[i] - 0.72) * 0.6;
    const k = Math.max(0, Math.min(1, v)) * 255;
    d[i * 4] = k; d[i * 4 + 1] = k; d[i * 4 + 2] = k; d[i * 4 + 3] = 255;
  }
  L.cc.putImageData(img, 0, 0);
  if (rough) {
    const r = rng(seed);
    L.cc.strokeStyle = 'rgba(60,60,60,0.35)';
    for (let k = 0; k < 6; k++) {
      let x = r() * S, y = r() * S, a = r() * 6.28;
      L.cc.lineWidth = 1; L.cc.beginPath(); L.cc.moveTo(x, y);
      for (let s = 0; s < 14; s++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 7; y += Math.sin(a) * 7; L.cc.lineTo(x, y); }
      L.cc.stroke();
    }
  }
}

function wallTile(L) {
  // 1970'ler İstanbul apartman seramik kaplaması (5 x 5 cm)
  const r = rng(31);
  const t = 12.8;
  L.cc.fillStyle = 'rgb(150,150,150)'; L.cc.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += t) for (let x = 0; x < S; x += t) {
    const v = 205 + (r() - 0.5) * 26;
    L.cc.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    L.cc.fillRect(x + 1, y + 1, t - 2, t - 2);
  }
  const n = fbm(S, 6, 4, 77);
  const img = L.cc.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < S * S; i++) { const m = 0.85 + n[i] * 0.25; d[i * 4] *= m; d[i * 4 + 1] *= m; d[i * 4 + 2] *= m; }
  L.cc.putImageData(img, 0, 0);
}

function wallBrick(L) {
  const r = rng(41);
  L.cc.fillStyle = 'rgb(178,170,158)'; L.cc.fillRect(0, 0, S, S);
  const bh = S / 30, bw = S / 9.3;
  for (let j = 0; j < 31; j++) {
    const off = (j % 2) * bw / 2;
    for (let i = -1; i < 11; i++) {
      const t = 0.75 + r() * 0.35;
      const base = r() < 0.12 ? [120, 62, 46] : [158, 78, 54];
      L.cc.fillStyle = `rgb(${base[0] * t | 0},${base[1] * t | 0},${base[2] * t | 0})`;
      L.cc.fillRect(i * bw + off + 2, j * bh + 2, bw - 3, bh - 3);
    }
  }
  const n = fbm(S, 6, 4, 43);
  const img = L.cc.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < S * S; i++) { const m = 0.8 + n[i] * 0.35; d[i * 4] *= m; d[i * 4 + 1] *= m; d[i * 4 + 2] *= m; }
  L.cc.putImageData(img, 0, 0);
}

function wallStone(L) {
  const r = rng(51);
  L.cc.fillStyle = 'rgb(150,145,135)'; L.cc.fillRect(0, 0, S, S);
  const bh = S / 6.6;
  for (let j = 0; j < 7; j++) {
    let x = -r() * 120;
    while (x < S) {
      const w = 110 + r() * 90, t = 0.85 + r() * 0.2;
      L.cc.fillStyle = `rgb(${222 * t | 0},${214 * t | 0},${196 * t | 0})`;
      L.cc.fillRect(x + 2, j * bh + 2, w - 4, bh - 4);
      L.cc.fillStyle = 'rgba(255,255,255,0.12)'; L.cc.fillRect(x + 2, j * bh + 2, w - 4, 3);
      x += w;
    }
  }
  const n = fbm(S, 8, 5, 53), f = valueNoise(S, 256, 54);
  const img = L.cc.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < S * S; i++) { const m = 0.82 + n[i] * 0.28 + (f[i] - 0.5) * 0.08; d[i * 4] *= m; d[i * 4 + 1] *= m; d[i * 4 + 2] *= m; }
  L.cc.putImageData(img, 0, 0);
}

function wallWood(L) {
  const r = rng(61);
  const bh = S / 13;
  for (let j = 0; j < 14; j++) {
    const v = 205 + (r() - 0.5) * 20;
    L.cc.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; L.cc.fillRect(0, j * bh, S, bh);
    L.cc.fillStyle = 'rgba(0,0,0,0.28)'; L.cc.fillRect(0, j * bh + bh - 4, S, 4);
    L.cc.fillStyle = 'rgba(255,255,255,0.18)'; L.cc.fillRect(0, j * bh, S, 2);
  }
  const n = valueNoise(S, 64, 62);
  const img = L.cc.getImageData(0, 0, S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const grain = 0.92 + 0.08 * Math.sin(x * 0.09 + n[i] * 6);
    d[i * 4] *= grain; d[i * 4 + 1] *= grain; d[i * 4 + 2] *= grain;
  }
  L.cc.putImageData(img, 0, 0);
}

function wallConcrete(L) {
  wallPlaster(L, false, 71);
  const r = rng(72);
  L.cc.strokeStyle = 'rgba(70,70,70,0.45)'; L.cc.lineWidth = 3;
  for (const p of [0, S * 0.6]) { L.cc.beginPath(); L.cc.moveTo(p, 0); L.cc.lineTo(p, S); L.cc.stroke(); }
  for (const p of [0, S * 0.5]) { L.cc.beginPath(); L.cc.moveTo(0, p); L.cc.lineTo(S, p); L.cc.stroke(); }
  // akıntı lekeleri
  for (let k = 0; k < 10; k++) {
    const x = r() * S, w = 4 + r() * 18;
    const g = L.cc.createLinearGradient(0, 0, 0, S * (0.3 + r() * 0.7));
    g.addColorStop(0, 'rgba(60,60,60,0.25)'); g.addColorStop(1, 'rgba(60,60,60,0)');
    L.cc.fillStyle = g; L.cc.fillRect(x, 0, w, S);
  }
}

function wallMarble(L) {
  const n = fbm(S, 4, 6, 81);
  const img = L.cc.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const vein = Math.abs(Math.sin((x * 0.012 + y * 0.02) + n[i] * 9));
    const v = 210 + n[i] * 30 - (vein < 0.06 ? 40 * (1 - vein / 0.06) : 0);
    d[i * 4] = v; d[i * 4 + 1] = v * 0.98; d[i * 4 + 2] = v * 0.95; d[i * 4 + 3] = 255;
  }
  L.cc.putImageData(img, 0, 0);
  L.cc.strokeStyle = 'rgba(90,90,90,0.5)'; L.cc.lineWidth = 2;
  for (const p of [0, S / 2]) { L.cc.beginPath(); L.cc.moveTo(p, 0); L.cc.lineTo(p, S); L.cc.stroke(); L.cc.beginPath(); L.cc.moveTo(0, p); L.cc.lineTo(S, p); L.cc.stroke(); }
}

// ---------------------------------------------------------------- pencereler
function sill(L, f, x, y, w) {
  rectC(L, f.X(x - 0.08), f.Y(y), f.W(w + 0.16), f.H(0.06), '#d4cfc4', 'opaque');
  rectC(L, f.X(x - 0.08), f.Y(y) + f.H(0.06), f.W(w + 0.16), f.H(0.03), '#8f8a80', 'opaque');
}
function reveal(L, f, x, y, w, h) {
  // pencere girintisinin gölgesi
  rectC(L, f.X(x) - 4, f.Y(y + h) - 4, f.W(w) + 8, f.H(h) + 8, '#7d7a74', 'opaque');
}

function winPVC(L, shutter, seed) {
  const r = rng(seed);
  const f = frame(3, 3);
  const x = 0.85, y = 0.9, w = 1.3, h = 1.45;
  reveal(L, f, x, y, w, h);
  rectC(L, f.X(x), f.Y(y + h), f.W(w), f.H(h), '#ecebe6', 'opaque');
  const m = 8, mid = 10;
  const px = f.X(x) + m, py = f.Y(y + h) + m, pw = f.W(w) - 2 * m, ph = f.H(h) - 2 * m;
  let gy = py, gh = ph;
  if (shutter) {
    const box = 26;
    rectC(L, f.X(x), f.Y(y + h) - box, f.W(w), box, '#e2dfd6', 'opaque');
    const down = ph * (0.25 + r() * 0.55);
    for (let k = 0; k < down; k += 9) {
      L.cc.fillStyle = k % 18 ? '#d6d1c5' : '#c9c3b6'; L.cc.fillRect(px - m, py + k - m + 2, pw + 2 * m, 9);
      L.mc.fillStyle = cls.opaque; L.mc.fillRect(px - m, py + k - m + 2, pw + 2 * m, 9);
    }
    gy = py + down; gh = ph - down;
  }
  if (gh > 6) {
    glass(L, px, gy, pw / 2 - mid / 2, gh, r);
    glass(L, px + pw / 2 + mid / 2, gy, pw / 2 - mid / 2, gh, r, { curtain: Math.floor(r() * 4) });
  }
  rectC(L, px + pw / 2 - mid / 2, py, mid, ph, '#e8e7e2', 'opaque');
  rectC(L, px + pw / 2 + 8, py + ph * 0.5, 4, 14, '#bdbab2', 'opaque');
  sill(L, f, x, y - 0.06, w);
}

function winAluWide(L, seed) {
  const r = rng(seed);
  const f = frame(3.2, 3);
  const x = 0.45, y = 0.85, w = 2.3, h = 1.5;
  reveal(L, f, x, y, w, h);
  rectC(L, f.X(x), f.Y(y + h), f.W(w), f.H(h), '#3c3f44', 'opaque');
  const m = 7, n = 3, pw = (f.W(w) - m * (n + 1)) / n;
  for (let k = 0; k < n; k++) glass(L, f.X(x) + m + k * (pw + m), f.Y(y + h) + m, pw, f.H(h) - 2 * m, r, { tint: [30, 42, 52] });
  sill(L, f, x, y - 0.06, w);
  // klima için boşluk yok; balkon korkuluğu yok
}

function winLevant(L, seed) {
  const r = rng(seed);
  const f = frame(2.6, 4.3);
  const w = 1.0, h = 2.35, x = (2.6 - w) / 2, y = 0.75;
  const sx = f.X(x), sw = f.W(w), top = f.Y(y + h), bot = f.Y(y);
  const arch = sw / 2;
  // taş söve
  const fr = 18;
  L.cc.fillStyle = '#ddd2bb'; L.mc.fillStyle = cls.opaque;
  for (const c of [L.cc, L.mc]) {
    c.beginPath();
    c.moveTo(sx - fr, bot + 6); c.lineTo(sx - fr, top + arch); c.arc(sx + sw / 2, top + arch, arch + fr, Math.PI, 0); c.lineTo(sx + sw + fr, bot + 6); c.closePath(); c.fill();
  }
  // kilit taşı
  rectC(L, sx + sw / 2 - 12, top - fr - 8, 24, 30, '#e6dcc6', 'opaque');
  // iç: ahşap doğrama ve camlar
  L.cc.fillStyle = '#5b4632';
  L.cc.beginPath(); L.cc.moveTo(sx, bot); L.cc.lineTo(sx, top + arch); L.cc.arc(sx + sw / 2, top + arch, arch, Math.PI, 0); L.cc.lineTo(sx + sw, bot); L.cc.closePath(); L.cc.fill();
  const m = 7;
  const cols = 2, rows = 3;
  const gw = (sw - m * (cols + 1)) / cols, gh = (bot - (top + arch) - m * (rows + 1)) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) glass(L, sx + m + i * (gw + m), top + arch + m + j * (gh + m), gw, gh, r, { curtain: j === 0 ? 0 : Math.floor(r() * 3) });
  // kemer camı (yelpaze)
  L.cc.save();
  L.cc.beginPath(); L.cc.arc(sx + sw / 2, top + arch, arch - m, Math.PI, 0); L.cc.closePath();
  L.cc.fillStyle = 'rgb(48,60,72)'; L.cc.fill();
  L.mc.beginPath(); L.mc.arc(sx + sw / 2, top + arch, arch - m, Math.PI, 0); L.mc.closePath(); L.mc.fillStyle = cls.glass; L.mc.fill();
  L.cc.strokeStyle = '#5b4632'; L.cc.lineWidth = 5;
  for (let k = 1; k < 4; k++) { const a = Math.PI + k * Math.PI / 4; L.cc.beginPath(); L.cc.moveTo(sx + sw / 2, top + arch); L.cc.lineTo(sx + sw / 2 + Math.cos(a) * arch, top + arch + Math.sin(a) * arch); L.cc.stroke(); }
  L.cc.restore();
  // dökme demir balkoncuk
  const by = bot - 4, bw = sw + 60, bx = sx - 30, bh2 = f.H(0.75);
  rectC(L, bx, by - bh2, bw, 5, '#2a2a2c', 'opaque');
  rectC(L, bx, by, bw, 8, '#c9bfa8', 'opaque');
  for (let k = 0; k <= 14; k++) rectC(L, bx + (k / 14) * (bw - 4), by - bh2, 4, bh2, '#2a2a2c', 'opaque');
  L.cc.strokeStyle = '#2a2a2c'; L.mc.strokeStyle = cls.opaque; L.cc.lineWidth = L.mc.lineWidth = 3;
  for (let k = 0; k < 7; k++) {
    const cx = bx + (k + 0.5) * bw / 7;
    for (const c of [L.cc, L.mc]) { c.beginPath(); c.arc(cx, by - bh2 / 2, bh2 * 0.28, 0, Math.PI * 2); c.stroke(); }
  }
  // kat silmesi
  rectC(L, 0, 0, S, 10, '#d8cdb5', 'opaque');
  rectC(L, 0, 10, S, 4, '#9c9480', 'opaque');
}

function winShutters(L, seed, color) {
  const r = rng(seed);
  const f = frame(2.8, 3);
  const w = 1.0, h = 1.45, x = (2.8 - w) / 2, y = 0.9;
  reveal(L, f, x, y, w, h);
  rectC(L, f.X(x), f.Y(y + h), f.W(w), f.H(h), '#efece4', 'opaque');
  const m = 9;
  glass(L, f.X(x) + m, f.Y(y + h) + m, f.W(w) / 2 - m * 1.5, f.H(h) - 2 * m, r);
  glass(L, f.X(x) + f.W(w) / 2 + m / 2, f.Y(y + h) + m, f.W(w) / 2 - m * 1.5, f.H(h) - 2 * m, r);
  for (const side of [-1, 1]) {
    const sx = side < 0 ? f.X(x) - f.W(0.5) - 3 : f.X(x + w) + 3, sw = f.W(0.5);
    rectC(L, sx, f.Y(y + h), sw, f.H(h), color, 'opaque');
    for (let k = 6; k < f.H(h) - 4; k += 9) { L.cc.fillStyle = 'rgba(0,0,0,0.25)'; L.cc.fillRect(sx + 6, f.Y(y + h) + k, sw - 12, 3); }
    L.cc.strokeStyle = 'rgba(0,0,0,0.3)'; L.cc.lineWidth = 3; L.cc.strokeRect(sx + 3, f.Y(y + h) + 3, sw - 6, f.H(h) - 6);
  }
  sill(L, f, x, y - 0.06, w);
}

function winCurtainWall(L, seed) {
  const r = rng(seed);
  const f = frame(1.6, 3.8);
  rectC(L, 0, 0, S, S, '#4a5258', 'opaque');
  const m = 10;
  glass(L, m, m, S - 2 * m, f.H(2.9) - m, r, { tint: [38, 58, 66], curtain: r() < 0.3 ? 3 : 0 });
  // döşeme bandı (spandrel)
  rectC(L, m, f.H(2.9) + m, S - 2 * m, S - f.H(2.9) - 2 * m, '#2c3a42', 'opaque');
  L.cc.fillStyle = 'rgba(150,180,195,0.18)'; L.cc.fillRect(m, f.H(2.9) + m, S - 2 * m, 6);
}

function winBalconyDoor(L, seed) {
  const r = rng(seed);
  const f = frame(3, 3);
  const dx = 0.55, dw = 0.85, dh = 2.25, wx = 1.5, ww = 0.95, wy = 0.9, wh = 1.35;
  reveal(L, f, dx, 0.02, dw, dh);
  reveal(L, f, wx, wy, ww, wh);
  rectC(L, f.X(dx), f.Y(dh + 0.02), f.W(dw), f.H(dh), '#ecebe6', 'opaque');
  rectC(L, f.X(wx), f.Y(wy + wh), f.W(ww), f.H(wh), '#ecebe6', 'opaque');
  const m = 9;
  glass(L, f.X(dx) + m, f.Y(dh + 0.02) + m, f.W(dw) - 2 * m, f.H(dh) * 0.62, r);
  rectC(L, f.X(dx) + m, f.Y(dh + 0.02) + m + f.H(dh) * 0.62 + 6, f.W(dw) - 2 * m, f.H(dh) * 0.38 - 2 * m - 6, '#dddbd4', 'opaque');
  glass(L, f.X(wx) + m, f.Y(wy + wh) + m, f.W(ww) - 2 * m, f.H(wh) - 2 * m, r);
}

function winSmall(L, seed) {
  const r = rng(seed);
  const f = frame(2.4, 3);
  const w = 0.6, h = 0.6, x = (2.4 - w) / 2, y = 1.7;
  reveal(L, f, x, y, w, h);
  rectC(L, f.X(x), f.Y(y + h), f.W(w), f.H(h), '#e9e8e3', 'opaque');
  glass(L, f.X(x) + 7, f.Y(y + h) + 7, f.W(w) - 14, f.H(h) - 14, r, { curtain: 0 });
}

function winPalace(L, seed) {
  const r = rng(seed);
  const f = frame(3.4, 5.6);
  // pilastrlar
  for (const px of [0, S - f.W(0.35)]) {
    rectC(L, px, 0, f.W(0.35), S, '#f1ede4', 'opaque');
    L.cc.fillStyle = 'rgba(0,0,0,0.08)'; L.cc.fillRect(px + f.W(0.3), 0, f.W(0.05), S);
  }
  const w = 1.15, h = 2.7, x = (3.4 - w) / 2, y = 1.2;
  rectC(L, f.X(x) - 16, f.Y(y + h) - 16, f.W(w) + 32, f.H(h) + 16, '#efeadf', 'opaque');
  // alınlık
  for (const c of [L.cc, L.mc]) {
    c.fillStyle = c === L.cc ? '#f3efe6' : cls.opaque;
    c.beginPath(); c.moveTo(f.X(x) - 30, f.Y(y + h) - 22); c.lineTo(f.X(x + w / 2), f.Y(y + h) - 22 - f.H(0.55)); c.lineTo(f.X(x + w) + 30, f.Y(y + h) - 22); c.closePath(); c.fill();
  }
  L.cc.strokeStyle = 'rgba(0,0,0,0.15)'; L.cc.lineWidth = 3;
  L.cc.beginPath(); L.cc.moveTo(f.X(x) - 30, f.Y(y + h) - 22); L.cc.lineTo(f.X(x + w) + 30, f.Y(y + h) - 22); L.cc.stroke();
  rectC(L, f.X(x), f.Y(y + h), f.W(w), f.H(h), '#e5e0d4', 'opaque');
  const m = 8;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) {
    const gw = (f.W(w) - 3 * m) / 2, gh = (f.H(h) - 5 * m) / 4;
    glass(L, f.X(x) + m + i * (gw + m), f.Y(y + h) + m + j * (gh + m), gw, gh, r, { curtain: 2 });
  }
  rectC(L, f.X(x) - 20, f.Y(y), f.W(w) + 40, 14, '#e8e2d4', 'opaque');
  // kat kornişi
  rectC(L, 0, 0, S, 14, '#ece7dc', 'opaque'); rectC(L, 0, 14, S, 5, '#b9b2a2', 'opaque');
}

function winOttoman(L, seed) {
  const r = rng(seed);
  const f = frame(2.4, 3);
  const w = 0.9, h = 1.5, x = (2.4 - w) / 2, y = 0.85;
  rectC(L, f.X(x) - 14, f.Y(y + h) - 14, f.W(w) + 28, f.H(h) + 28, '#efe6d2', 'opaque');
  rectC(L, f.X(x), f.Y(y + h), f.W(w), f.H(h), '#f6f0e2', 'opaque');
  const m = 7, gw = (f.W(w) - 3 * m) / 2, gh = (f.H(h) - 4 * m) / 3;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) glass(L, f.X(x) + m + i * (gw + m), f.Y(y + h) + m + j * (gh + m), gw, gh, r, { curtain: j ? 2 : 0 });
  rectC(L, 0, 0, S, 8, '#e9dfca', 'opaque');
}

// ---------------------------------------------------------------- dükkânlar (zemin kat, 4.5 m bölme)
function shopFront(L, seed, half) {
  const r = rng(seed);
  const f = frame(4.5, 4.4);
  rectC(L, 0, 0, S, f.H(1.0), '#2f3033', 'opaque');          // tabela bandı (tabela ayrı model)
  rectC(L, 0, f.Y(0.45), S, f.H(0.45), '#3a3b3e', 'opaque');   // alt kaplama
  rectC(L, 0, f.H(1.0), S, f.Y(0.45) - f.H(1.0), '#2a2b2e', 'opaque');
  const m = 8, gx = m, gy = f.H(1.0) + m, gw = S - 2 * m - f.W(1.1), gh = f.Y(0.45) - gy - m;
  // vitrin içi: raflar ve renkli ürünler
  glass(L, gx, gy, gw, gh, r, { curtain: 0, tint: [50, 50, 48] });
  L.cc.save(); L.cc.beginPath(); L.cc.rect(gx, gy, gw, gh); L.cc.clip();
  for (let j = 0; j < 4; j++) {
    const yy = gy + gh * (0.25 + j * 0.2);
    L.cc.fillStyle = 'rgba(120,110,100,0.8)'; L.cc.fillRect(gx, yy, gw, 4);
    for (let k = 0; k < 18; k++) {
      const c = [[200, 60, 50], [60, 120, 190], [230, 190, 60], [90, 160, 90], [220, 220, 210], [160, 90, 160]][Math.floor(r() * 6)];
      L.cc.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.75)`;
      const w = 10 + r() * 20, h = 12 + r() * 26;
      L.cc.fillRect(gx + r() * gw, yy - h, w, h);
    }
  }
  L.cc.restore();
  // kapı
  const dx = S - m - f.W(1.1);
  glass(L, dx + 6, gy, f.W(1.1) - 12, f.Y(0) - gy - 4, r, { curtain: 0, tint: [44, 46, 46] });
  rectC(L, dx + f.W(0.9), gy + gh * 0.5, 6, 30, '#b8b8b8', 'opaque');
  if (half) {
    const down = gh * (0.45 + r() * 0.2);
    for (let k = 0; k < down; k += 10) { rectC(L, gx - m, gy + k - m, S, 10, k % 20 ? '#9b9fa3' : '#8a8e92', 'opaque'); }
  }
}

function shopKepenk(L, seed) {
  const r = rng(seed);
  const f = frame(4.5, 4.4);
  rectC(L, 0, 0, S, f.H(1.0), '#2f3033', 'opaque');
  rectC(L, 0, f.H(1.0), S, 22, '#7d8186', 'opaque');
  for (let y = f.H(1.0) + 22; y < S; y += 11) rectC(L, 0, y, S, 11, ((y / 11) | 0) % 2 ? '#a3a7ab' : '#93979b', 'opaque');
  // kir ve biraz yazı izi
  L.cc.fillStyle = 'rgba(40,40,40,0.15)';
  for (let k = 0; k < 30; k++) L.cc.fillRect(r() * S, f.H(1.0) + r() * (S - f.H(1.0)), 4 + r() * 40, 2 + r() * 8);
  L.cc.fillStyle = 'rgba(60,30,30,0.0)';
}

function shopEntrance(L, seed) {
  const r = rng(seed);
  const f = frame(4.5, 4.4);
  const dw = 1.6, dh = 2.6, dx = (4.5 - dw) / 2;
  rectC(L, f.X(dx) - 20, f.Y(dh) - 20, f.W(dw) + 40, f.H(dh) + 20, '#d9d4c8', 'opaque');
  rectC(L, f.X(dx), f.Y(dh), f.W(dw), f.H(dh), '#55585c', 'opaque');
  const m = 8;
  glass(L, f.X(dx) + m, f.Y(dh) + m, f.W(dw) / 2 - m * 1.5, f.H(dh) - 2 * m, r, { curtain: 0, tint: [40, 44, 46] });
  glass(L, f.X(dx) + f.W(dw) / 2 + m / 2, f.Y(dh) + m, f.W(dw) / 2 - m * 1.5, f.H(dh) - 2 * m, r, { curtain: 0, tint: [40, 44, 46] });
  // saçak
  rectC(L, f.X(dx) - 40, f.Y(dh) - 34, f.W(dw) + 80, 16, '#6c6f73', 'opaque');
  // kapı numarası (mavi plaka)
  rectC(L, f.X(dx + dw) + 30, f.Y(2.0), 40, 26, '#1f4fa0', 'opaque');
  rectC(L, f.X(dx + dw) + 38, f.Y(2.0) + 7, 24, 12, '#ffffff', 'opaque');
  // diyafon
  rectC(L, f.X(dx) - 50, f.Y(1.5), 22, 40, '#9ea2a6', 'opaque');
  // yan pencereler
  for (const sx of [0.25, 3.45]) {
    rectC(L, f.X(sx), f.Y(2.4), f.W(0.8), f.H(1.1), '#ecebe6', 'opaque');
    glass(L, f.X(sx) + 7, f.Y(2.4) + 7, f.W(0.8) - 14, f.H(1.1) - 14, r);
    for (let k = 0; k < 6; k++) rectC(L, f.X(sx) + 8 + k * (f.W(0.8) - 16) / 5, f.Y(2.4), 4, f.H(1.1), '#3a3a3c', 'opaque');
  }
}

function shopCafe(L, seed) {
  const r = rng(seed);
  const f = frame(4.5, 4.4);
  rectC(L, 0, 0, S, f.H(1.0), '#2f2a26', 'opaque');
  rectC(L, 0, f.H(1.0), S, S - f.H(1.0), '#4e3424', 'opaque');
  const m = 12;
  const gw = (S - 4 * m) / 3, gy = f.H(1.0) + m, gh = f.Y(0.5) - gy;
  for (let k = 0; k < 3; k++) {
    glass(L, m + k * (gw + m), gy, gw, gh, r, { curtain: 0, tint: [62, 46, 34] });
    // masa siluetleri ve sıcak lamba
    L.cc.save(); L.cc.beginPath(); L.cc.rect(m + k * (gw + m), gy, gw, gh); L.cc.clip();
    L.cc.fillStyle = 'rgba(30,20,14,0.7)';
    for (let t = 0; t < 2; t++) { const tx = m + k * (gw + m) + 20 + r() * (gw - 60); L.cc.fillRect(tx, gy + gh * 0.65, 50, 8); L.cc.fillRect(tx + 22, gy + gh * 0.65, 6, gh * 0.35); }
    const g = L.cc.createRadialGradient(m + k * (gw + m) + gw / 2, gy + 30, 4, m + k * (gw + m) + gw / 2, gy + 30, 70);
    g.addColorStop(0, 'rgba(255,200,130,0.7)'); g.addColorStop(1, 'rgba(255,200,130,0)');
    L.cc.fillStyle = g; L.cc.fillRect(m + k * (gw + m), gy, gw, gh);
    L.cc.restore();
  }
}

function shopBank(L, seed) {
  const r = rng(seed);
  wallMarble(L);
  L.mc.fillStyle = cls.opaque; L.mc.fillRect(0, 0, S, S);
  const f = frame(4.5, 4.4);
  rectC(L, 0, 0, S, f.H(1.0), '#2b3440', 'opaque');
  const m = 10;
  rectC(L, f.X(0.7), f.Y(3.1), f.W(3.1), f.H(2.4), '#3a3d42', 'opaque');
  glass(L, f.X(0.7) + m, f.Y(3.1) + m, f.W(3.1) - 2 * m, f.H(2.4) - 2 * m, r, { curtain: 0, tint: [40, 52, 60] });
}

// ---------------------------------------------------------------- doku dizisi
let cached = null;
export function facadeArray() {
  if (cached) return cached;
  const draws = [
    (l) => wallPlaster(l, false, 3), (l) => wallPlaster(l, true, 5), wallTile, wallBrick, wallStone, wallWood, wallConcrete, wallMarble,
    (l) => winPVC(l, false, 11), (l) => winPVC(l, true, 12), (l) => winAluWide(l, 13), (l) => winLevant(l, 14), (l) => winShutters(l, 15, '#4f6e58'),
    (l) => winCurtainWall(l, 16), (l) => winBalconyDoor(l, 17), (l) => winSmall(l, 18), (l) => winPalace(l, 19), (l) => winOttoman(l, 20),
    (l) => shopFront(l, 21, false), (l) => shopKepenk(l, 22), (l) => shopEntrance(l, 23), (l) => shopCafe(l, 24), (l) => shopFront(l, 25, true), (l) => shopBank(l, 26),
  ];
  const data = new Uint8Array(S * S * 4 * draws.length);
  draws.forEach((fn, k) => {
    const l = layer();
    fn(l);
    const ci = l.cc.getImageData(0, 0, S, S).data;
    const mi = l.mc.getImageData(0, 0, S, S).data;
    const off = k * S * S * 4;
    const wall = k < 8;
    for (let i = 0; i < S * S; i++) {
      data[off + i * 4] = ci[i * 4]; data[off + i * 4 + 1] = ci[i * 4 + 1]; data[off + i * 4 + 2] = ci[i * 4 + 2];
      data[off + i * 4 + 3] = wall ? 255 : mi[i * 4];
    }
  });
  const t = new THREE.DataArrayTexture(data, S, S, draws.length);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  cached = t;
  return t;
}

// önizleme için tek katmanı tuvale çiz
export function previewSheet() {
  const draws = 24;
  const out = document.createElement('canvas');
  out.width = 6 * 256; out.height = 4 * 256;
  const g = out.getContext('2d');
  const t = facadeArray();
  const d = t.image.data;
  for (let k = 0; k < draws; k++) {
    const img = new ImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const a = d[k * S * S * 4 + i * 4 + 3];
      const wallC = [150, 170, 190];
      const mix = a / 255 < 0.2 ? 1 : 0;
      for (let c = 0; c < 3; c++) img.data[i * 4 + c] = mix ? wallC[c] : d[k * S * S * 4 + i * 4 + c];
      img.data[i * 4 + 3] = 255;
    }
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = S;
    tmp.getContext('2d').putImageData(img, 0, 0);
    g.drawImage(tmp, (k % 6) * 256, Math.floor(k / 6) * 256, 256, 256);
  }
  return out;
}
