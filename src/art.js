// Boğaz Yolu — çizimler: araba, trafik, yol kenarı nesneleri, gün saatine göre renkler ve arka planlar.
// Hepsi kodla çizilmiş özgün piksel resimlerdir.
(function (root) {
  'use strict';

  function mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    fn(g, w, h);
    return c;
  }
  const R = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function disc(g, cx, cy, r, col) {
    g.fillStyle = col;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + 0.35); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  }
  function ellipse(g, cx, cy, rx, ry, col) {
    g.fillStyle = col;
    for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); }
  }
  function poly(g, pts, col) { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  const K = '#141018';

  // küçük piksel yazı (3×5) — plakalar ve tabelalar için
  const F3 = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
    N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', Y: '101101010010010', Z: '111001010100111', Ç: '011100100011010', Ş: '011100010001110',
    Ü: '101000101101111', Ö: '101010101101010', İ: '010000010010010', Ğ: '111000011101011', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111',
    3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
    ' ': '000000000000000', '-': '000000111000000', '→': '000010111010000', '←': '000010111010000', '.': '000000000000010',
  };
  function tiny(g, s, x, y, col, scale) {
    scale = scale || 1;
    let cx = x;
    for (const ch of s) {
      const m = F3[ch] || F3[' '];
      for (let i = 0; i < 15; i++) if (m[i] === '1') R(g, cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale, col);
      cx += 4 * scale;
    }
    return cx - x;
  }
  const tinyW = (s, scale) => s.length * 4 * (scale || 1) - (scale || 1);

  // ---------------- oyuncu arabası (arkadan) ----------------
  // turn: -2..2 (sola/sağa dönüş), brake: fren lambaları
  const CAR_COLORS = { kirmizi: ['#d8302a', '#a01e18', '#ff6a50'], beyaz: ['#e8eaee', '#a8aeb8', '#ffffff'], turkuaz: ['#1fa39a', '#127068', '#5ad8cc'] };
  function playerCar(turn, brake, color) {
    const [body, dark, light] = CAR_COLORS[color] || CAR_COLORS.kirmizi;
    return mk(96, 50, (g) => {
      const t = turn * 3; // üst gövdenin kayması
      // tekerlekler
      R(g, 6 - Math.max(0, turn) * 2, 34, 18, 14, K); R(g, 72 - Math.min(0, turn) * 2, 34, 18, 14, K);
      R(g, 8 - Math.max(0, turn) * 2, 36, 14, 10, '#2a2630'); R(g, 74 - Math.min(0, turn) * 2, 36, 14, 10, '#2a2630');
      // alt gövde / tampon
      R(g, 4, 26, 88, 14, K);
      R(g, 6, 27, 84, 11, dark);
      R(g, 6, 27, 84, 2, body);
      // plaka
      R(g, 34, 29, 28, 9, K); R(g, 35, 30, 26, 7, '#f2f2f2'); R(g, 35, 30, 3, 7, '#2a5ad8');
      tiny(g, '34BY', 39, 31, K);
      // egzoz
      R(g, 12, 38, 6, 3, '#5a5e68'); R(g, 13, 39, 4, 1, '#202028');
      // bagaj kapağı ve stoplar
      R(g, 5, 14, 86, 14, K);
      R(g, 6, 15, 84, 12, body);
      R(g, 6, 15, 84, 2, light);
      const lc = brake ? '#ff3a2a' : '#c41818', lc2 = brake ? '#ffd0a0' : '#ff5a40';
      R(g, 8, 19, 24, 6, K); R(g, 9, 20, 22, 4, lc); R(g, 10, 20, 8, 2, lc2);
      R(g, 64, 19, 24, 6, K); R(g, 65, 20, 22, 4, lc); R(g, 78, 20, 8, 2, lc2);
      R(g, 32, 21, 32, 2, dark);
      R(g, 44, 18, 8, 3, '#e8e8e8');
      // yan panel (dönüşte görünür)
      if (turn < 0) R(g, 90, 16, 4, 20, dark);
      if (turn > 0) R(g, 2, 16, 4, 20, dark);
      // tavan ve arka cam
      poly(g, [18 + t, 15, 78 + t, 15, 70 + t, 2, 26 + t, 2], K);
      poly(g, [21 + t, 14, 75 + t, 14, 68 + t, 4, 28 + t, 4], '#3a4a64');
      R(g, 30 + t, 6, 18, 2, '#8aa6c8'); R(g, 34 + t, 9, 10, 1, '#6a86a8');
      R(g, 26 + t, 3, 44, 1, body);
      // spoiler
      R(g, 10 + t / 2, 12, 76, 3, K); R(g, 12 + t / 2, 12, 72, 1, dark);
    });
  }

  // ---------------- trafik araçları ----------------
  const SEDAN = ['#e8eaee', '#9aa0aa', '#2a4a8a', '#2a2a30', '#8a2a2a'];
  function sedan(colIdx, taxi) {
    const body = taxi ? '#f4c21a' : SEDAN[colIdx % SEDAN.length], dark = shade(body, -0.35), light = shade(body, 0.3);
    return mk(72, 44, (g) => {
      if (taxi) { R(g, 26, 0, 20, 7, K); R(g, 27, 1, 18, 5, '#f4f0e0'); tiny(g, 'TAKSİ', 27, 1, K); }
      R(g, 4, 30, 14, 12, K); R(g, 54, 30, 14, 12, K);
      R(g, 2, 22, 68, 14, K); R(g, 3, 23, 66, 11, dark); R(g, 3, 23, 66, 2, body);
      R(g, 26, 25, 20, 7, K); R(g, 27, 26, 18, 5, '#f0f0f0');
      R(g, 3, 13, 66, 11, K); R(g, 4, 14, 64, 9, body); R(g, 4, 14, 64, 1, light);
      R(g, 6, 16, 14, 5, K); R(g, 7, 17, 12, 3, '#c41818'); R(g, 52, 16, 14, 5, K); R(g, 53, 17, 12, 3, '#c41818');
      poly(g, [12, 14, 60, 14, 54, 5, 18, 5], K);
      poly(g, [15, 13, 57, 13, 52, 7, 20, 7], '#3a4a64');
      R(g, 24, 8, 12, 1, '#8aa6c8');
      if (taxi) { R(g, 4, 24, 64, 1, '#18141e'); for (let x = 6; x < 66; x += 6) R(g, x, 24, 3, 1, '#f4f0e0'); }
    });
  }
  function dolmus() {
    return mk(84, 64, (g) => {
      const body = '#f2c41e', dark = '#b08a10';
      R(g, 6, 50, 14, 12, K); R(g, 64, 50, 14, 12, K);
      R(g, 2, 4, 80, 52, K); R(g, 3, 5, 78, 49, body); R(g, 3, 5, 78, 2, '#ffe070');
      R(g, 8, 10, 32, 18, K); R(g, 9, 11, 30, 16, '#3a4a64'); R(g, 44, 10, 32, 18, K); R(g, 45, 11, 30, 16, '#3a4a64');
      R(g, 12, 13, 8, 2, '#8aa6c8'); R(g, 48, 13, 8, 2, '#8aa6c8');
      R(g, 41, 8, 2, 44, dark);
      R(g, 5, 34, 10, 6, '#c41818'); R(g, 69, 34, 10, 6, '#c41818');
      R(g, 30, 42, 24, 8, K); R(g, 31, 43, 22, 6, '#f0f0f0');
      tiny(g, 'DOLMUŞ', 30, 31, K);
      R(g, 2, 52, 80, 4, dark);
    });
  }
  function otobus() {
    return mk(116, 96, (g) => {
      const body = '#2e6ac8', dark = '#1e4a8a';
      R(g, 8, 84, 18, 12, K); R(g, 90, 84, 18, 12, K);
      R(g, 2, 2, 112, 86, K); R(g, 3, 3, 110, 83, '#e8ecf2');
      R(g, 3, 50, 110, 36, body); R(g, 3, 50, 110, 3, '#5a8ae8');
      R(g, 8, 8, 100, 30, K); R(g, 9, 9, 98, 28, '#2a3448');
      R(g, 30, 4, 56, 9, K); R(g, 31, 5, 54, 7, '#18141e'); tiny(g, '25E SARIYER', 33, 6, '#ffb030');
      R(g, 14, 14, 20, 3, '#5a6a88');
      R(g, 6, 60, 12, 10, '#c41818'); R(g, 98, 60, 12, 10, '#c41818'); R(g, 6, 72, 12, 5, '#f4a020'); R(g, 98, 72, 12, 5, '#f4a020');
      R(g, 44, 70, 28, 9, K); R(g, 45, 71, 26, 7, '#f0f0f0');
      R(g, 20, 40, 76, 6, dark); for (let x = 22; x < 94; x += 4) R(g, x, 41, 2, 4, '#3a4a64');
    });
  }
  function kamyon() {
    return mk(108, 88, (g) => {
      R(g, 6, 76, 18, 12, K); R(g, 84, 76, 18, 12, K);
      R(g, 2, 2, 104, 78, K); R(g, 3, 3, 102, 75, '#e4e0d4'); R(g, 3, 3, 102, 3, '#f8f4ea');
      for (let x = 10; x < 100; x += 18) R(g, x, 6, 2, 66, '#bcb6a8');
      R(g, 22, 26, 64, 18, '#2a8a4a'); tiny(g, 'NAKLİYAT', 31, 30, '#ffffff', 2);
      R(g, 2, 70, 104, 10, '#3a3a40'); R(g, 6, 72, 12, 5, '#c41818'); R(g, 90, 72, 12, 5, '#c41818');
      R(g, 42, 72, 24, 7, '#f0f0f0');
    });
  }
  function motor() {
    return mk(32, 48, (g) => {
      R(g, 13, 36, 6, 12, K); R(g, 14, 37, 4, 10, '#3a3a40');
      R(g, 9, 26, 14, 12, K); R(g, 10, 27, 12, 10, '#c83a2e');
      R(g, 12, 30, 8, 3, '#ff5a40');
      // kurye kutusu ve sürücü
      R(g, 6, 8, 20, 16, K); R(g, 7, 9, 18, 14, '#e8642a'); tiny(g, 'YE', 11, 13, '#ffffff');
      R(g, 9, 0, 14, 9, K); R(g, 10, 1, 12, 7, '#2a2a30'); R(g, 11, 2, 6, 2, '#5a6a88');
      R(g, 4, 22, 24, 6, K); R(g, 5, 23, 22, 4, '#2a3a5a');
    });
  }

  // ---------------- yol kenarı ----------------
  const OBJ = {};
  OBJ.lamba = () => mk(24, 100, (g) => {
    R(g, 10, 20, 4, 78, K); R(g, 11, 20, 2, 78, '#2a5a3a');
    R(g, 7, 94, 10, 6, K); R(g, 8, 95, 8, 4, '#2a5a3a');
    R(g, 11, 14, 11, 3, K); R(g, 18, 14, 4, 8, K);
    R(g, 15, 21, 10, 10, K); R(g, 16, 22, 8, 7, '#f4e8a0'); R(g, 17, 22, 3, 2, '#ffffff');
    R(g, 15, 19, 10, 2, '#2a5a3a');
  });
  OBJ.korkuluk = () => mk(64, 22, (g) => {
    R(g, 0, 2, 64, 3, K); R(g, 0, 3, 64, 1, '#3a6a8a');
    R(g, 0, 14, 64, 2, K);
    for (let x = 2; x < 64; x += 6) { R(g, x, 4, 2, 12, K); R(g, x, 4, 1, 12, '#3a6a8a'); }
    for (const x of [0, 62]) { R(g, x, 0, 3, 22, K); R(g, x + 1, 0, 1, 22, '#4a7a9a'); }
    R(g, 0, 18, 64, 4, '#c8c4bc'); R(g, 0, 18, 64, 1, '#e8e4dc');
  });
  function treeBlob(g, cx, cy, r, cols, seed) {
    const rr = rng(seed);
    disc(g, cx, cy, r + 1, K);
    disc(g, cx, cy, r, cols[1]);
    for (let i = 0; i < 18; i++) { const a = rr() * 6.28, d = rr() * r * 0.75; disc(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d - 1, Math.max(2, Math.round(r * (0.25 + rr() * 0.2))), rr() < 0.5 ? cols[0] : cols[2]); }
  }
  OBJ.cinar = () => mk(100, 128, (g) => {
    R(g, 44, 70, 12, 58, K); R(g, 45, 70, 10, 58, '#8a7a5a'); R(g, 47, 80, 3, 30, '#c8b890'); R(g, 52, 96, 2, 20, '#5a4a32');
    R(g, 38, 60, 8, 20, '#6a5a3a'); R(g, 54, 58, 8, 18, '#6a5a3a');
    const cols = ['#5a9a3a', '#3a7a2a', '#7aba4a'];
    treeBlob(g, 30, 46, 26, cols, 3); treeBlob(g, 70, 44, 26, cols, 5); treeBlob(g, 50, 30, 30, cols, 7);
  });
  OBJ.agac = () => mk(84, 100, (g) => {
    R(g, 38, 58, 8, 42, K); R(g, 39, 58, 6, 42, '#6a4a2a');
    treeBlob(g, 42, 40, 34, ['#4a8a3a', '#2e6a2a', '#6aaa4a'], 11);
  });
  OBJ.servi = () => mk(34, 124, (g) => {
    R(g, 15, 112, 4, 12, K);
    for (let y = 0; y < 116; y++) {
      const w = Math.round(Math.sin(Math.min(1, y / 20) * Math.PI / 2) * 11 * (1 - Math.max(0, (y - 70) / 70) * 0.35));
      R(g, 17 - w - 1, y + 2, w * 2 + 2, 1, K);
      R(g, 17 - w, y + 2, w * 2, 1, y % 7 < 3 ? '#2a5a2a' : '#1e4a22');
      if (w > 3 && y % 9 === 2) R(g, 17 - w + 2, y + 2, 3, 1, '#3a7a3a');
    }
  });
  const FACADES = ['#e8b8a0', '#f0d890', '#a8d0c0', '#e8c8d0', '#c8d8ea', '#e0c098', '#d8d4c8'];
  function apartman(v) {
    return mk(128, 168, (g) => {
      const col = FACADES[v % FACADES.length], r = rng(v * 31 + 7);
      R(g, 4, 10, 120, 158, K); R(g, 5, 11, 118, 157, col);
      R(g, 0, 6, 128, 6, K); R(g, 1, 7, 126, 4, shade(col, -0.3));
      R(g, 5, 11, 4, 157, shade(col, 0.25));
      for (let fy = 0; fy < 6; fy++) {
        const y = 18 + fy * 24;
        for (let fx = 0; fx < 4; fx++) {
          const x = 12 + fx * 28;
          R(g, x, y, 18, 16, K); R(g, x + 1, y + 1, 16, 14, r() < 0.15 ? '#f4e0a0' : '#4a5a74');
          R(g, x + 1, y + 1, 16, 2, '#8aa0c0'); R(g, x + 8, y + 1, 1, 14, K);
          if (r() < 0.4) { R(g, x - 2, y + 15, 22, 3, K); R(g, x - 1, y + 15, 20, 2, shade(col, -0.2)); }
        }
        // cumba
        if (fy > 0 && fy < 5 && v % 2) { R(g, 46, y - 2, 36, 20, K); R(g, 47, y - 1, 34, 18, shade(col, 0.1)); R(g, 52, y + 2, 24, 12, '#4a5a74'); }
      }
      // dükkan ve tente
      R(g, 5, 150, 118, 18, '#3a3430');
      R(g, 8, 144, 112, 6, r() < 0.5 ? '#c8302a' : '#2a8a6a'); for (let x = 8; x < 120; x += 8) R(g, x, 148, 4, 3, '#f4f0e0');
      R(g, 14, 154, 30, 12, '#5a6a84'); R(g, 84, 154, 30, 12, '#5a6a84');
    });
  }
  OBJ.apartman = () => apartman(0);
  OBJ.yali = () => mk(168, 112, (g) => {
    const wood = '#8a3a2a', light = '#b05a44';
    R(g, 0, 100, 168, 12, '#5a5048');
    R(g, 6, 30, 156, 72, K); R(g, 7, 31, 154, 70, wood);
    for (let y = 33; y < 100; y += 4) R(g, 7, y, 154, 1, shade(wood, -0.15));
    // çatı
    poly(g, [0, 32, 168, 32, 150, 12, 18, 12], K); poly(g, [3, 31, 165, 31, 148, 14, 20, 14], '#5a3a32');
    for (let x = 22; x < 148; x += 5) R(g, x, 16, 2, 14, '#4a2e28');
    // cumba
    R(g, 58, 40, 52, 40, K); R(g, 59, 41, 50, 38, light);
    for (let k = 0; k < 4; k++) { const x = 16 + k * 36 + (k > 1 ? 16 : 0); if (x > 50 && x < 112) continue; R(g, x, 46, 14, 22, '#f4f0e6'); R(g, x + 2, 48, 10, 18, '#3a4a64'); R(g, x + 6, 48, 1, 18, '#f4f0e6'); }
    for (let k = 0; k < 3; k++) { const x = 62 + k * 16; R(g, x, 46, 12, 26, '#f4f0e6'); R(g, x + 2, 48, 8, 22, '#3a4a64'); }
    for (let k = 0; k < 6; k++) { const x = 12 + k * 26; R(g, x, 82, 10, 14, '#f4f0e6'); R(g, x + 2, 84, 6, 10, '#4a5a74'); }
    R(g, 6, 98, 156, 3, '#f4f0e6');
  });
  OBJ.cami = () => mk(200, 180, (g) => {
    const st = '#e4dccc', sh = '#b8ae9c';
    // minareler
    for (const x of [10, 182]) {
      R(g, x - 1, 22, 10, 158, K); R(g, x, 22, 8, 158, st); R(g, x + 6, 22, 2, 158, sh);
      R(g, x - 4, 60, 16, 5, K); R(g, x - 3, 61, 14, 3, st); R(g, x - 4, 100, 16, 5, K); R(g, x - 3, 101, 14, 3, st);
      poly(g, [x - 1, 22, x + 9, 22, x + 4, 0], K); poly(g, [x + 1, 21, x + 7, 21, x + 4, 4], '#7a8a98');
    }
    // gövde
    R(g, 30, 100, 140, 80, K); R(g, 31, 101, 138, 79, st); R(g, 31, 101, 138, 3, '#f4ecdc');
    for (let x = 40; x < 160; x += 22) { R(g, x, 120, 12, 26, K); R(g, x + 1, 121, 10, 24, '#3a4a64'); disc(g, x + 6, 121, 6, K); disc(g, x + 6, 122, 5, '#3a4a64'); }
    R(g, 88, 150, 24, 30, K); R(g, 89, 151, 22, 29, '#4a3a2a'); disc(g, 100, 151, 12, K); disc(g, 100, 152, 11, '#4a3a2a');
    // kubbeler
    const dome = (cx, by, r) => { for (let y = 0; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); R(g, cx - w - 1, by - y, w * 2 + 2, 1, K); R(g, cx - w, by - y, w * 2, 1, y > r * 0.75 ? '#9aaab8' : '#7a8a98'); } R(g, cx - 1, by - r - 8, 2, 8, '#c8a020'); };
    R(g, 46, 92, 108, 10, K); R(g, 47, 93, 106, 8, st);
    dome(100, 93, 46); dome(52, 102, 18); dome(148, 102, 18);
  });
  OBJ.hisar = () => mk(100, 168, (g) => {
    const st = '#b8a888', sh = '#8a7a60';
    R(g, 8, 24, 84, 144, K); R(g, 9, 25, 82, 143, st);
    for (let y = 30; y < 168; y += 8) for (let x = (y % 16 ? 9 : 17); x < 90; x += 16) R(g, x, y, 1, 7, sh);
    for (let y = 30; y < 168; y += 8) R(g, 9, y, 82, 1, sh);
    R(g, 9, 25, 10, 143, shade(st, 0.15)); R(g, 78, 25, 13, 143, sh);
    for (let x = 4; x < 96; x += 14) { R(g, x, 10, 10, 16, K); R(g, x + 1, 11, 8, 15, st); }
    R(g, 4, 22, 92, 4, K);
    R(g, 44, 60, 10, 18, K); R(g, 45, 61, 8, 16, '#2a2420'); R(g, 44, 110, 10, 18, K); R(g, 45, 111, 8, 16, '#2a2420');
  });
  OBJ.kale = () => mk(200, 132, (g) => {
    const st = '#a89878', sh = '#7a6a50';
    for (const [x, w, h] of [[0, 50, 90], [40, 70, 60], [100, 40, 110], [130, 70, 70]]) {
      R(g, x, 132 - h, w, h, K); R(g, x + 1, 133 - h, w - 2, h - 1, st);
      for (let y = 136 - h; y < 132; y += 7) R(g, x + 1, y, w - 2, 1, sh);
      for (let k = x + 2; k < x + w - 6; k += 10) { R(g, k, 124 - h, 6, 9, K); R(g, k + 1, 125 - h, 4, 8, st); }
    }
    R(g, 108, 60, 12, 30, K); R(g, 109, 61, 10, 29, '#2a2420');
    R(g, 0, 128, 200, 4, '#5a7a3a');
  });
  OBJ.saray = () => mk(260, 116, (g) => {
    const st = '#f2eee4', sh = '#c8c0b0';
    R(g, 0, 20, 260, 96, K); R(g, 1, 21, 258, 95, st);
    R(g, 0, 12, 260, 10, K); R(g, 1, 13, 258, 8, sh);
    for (let x = 10; x < 250; x += 20) { R(g, x, 30, 12, 28, K); R(g, x + 1, 31, 10, 26, '#4a5a74'); disc(g, x + 6, 31, 6, K); disc(g, x + 6, 32, 5, '#4a5a74'); R(g, x + 1, 66, 10, 30, '#4a5a74'); R(g, x - 3, 62, 18, 3, sh); }
    R(g, 100, 0, 60, 22, K); R(g, 101, 1, 58, 21, st); disc(g, 130, 12, 8, '#c8a020'); disc(g, 130, 12, 6, st);
    R(g, 0, 100, 260, 16, sh); for (let x = 0; x < 260; x += 8) R(g, x, 100, 4, 16, st);
  });
  OBJ.kiz_kulesi = () => mk(110, 130, (g) => {
    ellipse(g, 55, 120, 54, 9, '#5a5048'); ellipse(g, 55, 118, 50, 7, '#8a7a68');
    R(g, 10, 84, 90, 34, K); R(g, 11, 85, 88, 32, '#f0ece4'); for (let x = 16; x < 96; x += 12) { R(g, x, 92, 6, 10, '#4a5a74'); }
    R(g, 36, 30, 38, 56, K); R(g, 37, 31, 36, 55, '#f0ece4'); R(g, 64, 31, 9, 55, '#c8c4bc');
    R(g, 46, 44, 8, 12, '#4a5a74'); R(g, 46, 64, 8, 12, '#4a5a74');
    R(g, 32, 26, 46, 6, K); R(g, 33, 27, 44, 4, '#c8c4bc');
    R(g, 40, 10, 30, 18, K); R(g, 41, 11, 28, 16, '#f0ece4'); R(g, 46, 14, 6, 8, '#4a5a74'); R(g, 58, 14, 6, 8, '#4a5a74');
    poly(g, [38, 11, 72, 11, 55, -12], K); poly(g, [41, 10, 69, 10, 55, -8], '#7a8a98');
    R(g, 54, -14, 2, 6, '#c8a020');
  });
  OBJ.tekne = () => mk(70, 36, (g) => {
    poly(g, [0, 18, 70, 18, 62, 32, 6, 32], K); poly(g, [2, 19, 68, 19, 61, 30, 7, 30], '#f2f2f2');
    R(g, 4, 22, 62, 2, '#2a5ad8'); R(g, 24, 6, 22, 13, K); R(g, 25, 7, 20, 12, '#f2f2f2'); R(g, 28, 9, 6, 4, '#3a4a64'); R(g, 36, 9, 6, 4, '#3a4a64');
    R(g, 34, 0, 2, 8, K); R(g, 6, 32, 58, 3, 'rgba(255,255,255,0.5)');
  });
  OBJ.vapur = () => mk(200, 70, (g) => {
    poly(g, [0, 34, 200, 34, 190, 60, 10, 60], K); poly(g, [2, 35, 198, 35, 189, 58, 11, 58], '#f2f2f2');
    R(g, 8, 50, 184, 6, '#c8302a');
    R(g, 20, 18, 160, 18, K); R(g, 21, 19, 158, 16, '#f2f2f2'); for (let x = 26; x < 176; x += 10) R(g, x, 23, 6, 7, '#3a4a64');
    R(g, 50, 6, 100, 13, K); R(g, 51, 7, 98, 12, '#f2f2f2'); for (let x = 56; x < 146; x += 10) R(g, x, 10, 6, 5, '#3a4a64');
    R(g, 92, 0, 14, 8, K); R(g, 93, 0, 12, 7, '#2a2a30'); R(g, 93, 2, 12, 2, '#c8302a');
    R(g, 10, 60, 180, 4, 'rgba(255,255,255,0.45)');
  });
  OBJ.balikci = () => mk(64, 52, (g) => {
    // olta denize doğru (sağa) uzanır
    for (let i = 0; i < 40; i++) R(g, 22 + i, 18 - i * 0.4, 1, 1, '#3a3430');
    R(g, 61, 2, 1, 40, 'rgba(220,220,220,0.6)');
    R(g, 10, 2, 14, 12, K); R(g, 11, 3, 12, 6, '#2a4a8a'); R(g, 13, 8, 8, 5, '#f1b98f');
    R(g, 8, 14, 18, 20, K); R(g, 9, 15, 16, 18, '#6a7a4a');
    R(g, 20, 18, 8, 4, '#f1b98f');
    R(g, 10, 34, 14, 16, K); R(g, 11, 34, 5, 15, '#3a4a64'); R(g, 18, 34, 5, 15, '#3a4a64');
    R(g, 2, 42, 10, 8, K); R(g, 3, 43, 8, 6, '#4a8ac8');
  });
  OBJ.simitci = () => mk(50, 52, (g) => {
    R(g, 4, 18, 42, 24, K); R(g, 5, 19, 40, 22, '#c8302a');
    R(g, 6, 2, 38, 18, K); R(g, 7, 3, 36, 16, 'rgba(220,240,255,0.85)');
    for (const [x, y] of [[12, 8], [24, 8], [36, 8], [18, 14], [30, 14]]) { disc(g, x, y, 4, '#b8701e'); disc(g, x, y, 1, 'rgba(220,240,255,0.85)'); }
    R(g, 5, 26, 40, 6, '#f4f0e0'); tiny(g, 'SİMİT', 15, 26, '#c8302a');
    disc(g, 12, 46, 5, K); disc(g, 38, 46, 5, K); disc(g, 12, 46, 2, '#9aa0aa'); disc(g, 38, 46, 2, '#9aa0aa');
  });
  OBJ.durak = () => mk(100, 84, (g) => {
    R(g, 0, 0, 100, 8, K); R(g, 1, 1, 98, 6, '#c8302a');
    for (const x of [4, 92]) { R(g, x, 8, 4, 76, K); }
    R(g, 8, 10, 84, 52, 'rgba(180,210,230,0.45)'); R(g, 8, 10, 84, 1, '#ffffff');
    R(g, 60, 14, 26, 40, K); R(g, 61, 15, 24, 38, '#f4f0e0'); R(g, 63, 18, 20, 6, '#2a5ad8'); for (let y = 28; y < 50; y += 4) R(g, 63, y, 18, 1, '#9aa0aa');
    R(g, 12, 56, 40, 6, K); R(g, 13, 57, 38, 4, '#8a6a3a');
    tiny(g, 'DURAK', 14, 2, '#ffffff');
  });
  OBJ.semsiye = () => mk(64, 66, (g) => {
    poly(g, [0, 22, 64, 22, 32, 2], K); poly(g, [3, 21, 61, 21, 32, 4], '#f4f0e0');
    for (let k = 0; k < 4; k++) poly(g, [6 + k * 14, 21, 13 + k * 14, 21, 32, 4], k % 2 ? '#c8302a' : '#f4f0e0');
    R(g, 31, 22, 2, 34, K);
    R(g, 14, 50, 36, 4, K); R(g, 15, 50, 34, 2, '#8a6a3a'); R(g, 20, 54, 2, 12, K); R(g, 42, 54, 2, 12, K);
    // çay bardakları
    R(g, 24, 46, 3, 4, '#c8501e'); R(g, 36, 46, 3, 4, '#c8501e');
    R(g, 4, 52, 8, 3, K); R(g, 6, 55, 2, 10, K); R(g, 52, 52, 8, 3, K); R(g, 56, 55, 2, 10, K);
  });
  OBJ.kopru_kule = () => mk(300, 420, (g) => {
    const c = '#c8c4bc', d = '#8a8680';
    for (const x of [0, 270]) { R(g, x, 0, 30, 420, K); R(g, x + 2, 0, 26, 420, c); R(g, x + 22, 0, 6, 420, d); }
    for (const y of [0, 110, 220]) { R(g, 0, y, 300, 22, K); R(g, 2, y + 2, 296, 18, c); R(g, 2, y + 16, 296, 4, d); }
    R(g, 140, 0, 20, 4, '#f04a3a');
  });
  OBJ.kopru_uzak = () => mk(320, 90, (g) => {
    const c = 'rgba(70,80,100,0.75)';
    R(g, 0, 70, 320, 5, c);
    for (const x of [60, 260]) { R(g, x - 4, 0, 3, 90, c); R(g, x + 2, 0, 3, 90, c); R(g, x - 4, 10, 9, 2, c); }
    for (let x = 0; x < 320; x++) {
      const u = (x - 60) / 200;
      const y = u >= 0 && u <= 1 ? 2 + (1 - 4 * (u - 0.5) * (u - 0.5)) * 64 : (u < 0 ? 2 + (-u) * 220 : 2 + (u - 1) * 220);
      if (y < 70) R(g, x, y, 1, 2, c);
      if (x % 8 === 0 && y < 70) R(g, x, y, 1, 70 - y, 'rgba(70,80,100,0.35)');
    }
  });
  function gate(label, colA, colB) {
    return mk(320, 150, (g) => {
      for (const x of [0, 300]) { R(g, x, 20, 20, 130, K); R(g, x + 2, 20, 16, 130, '#c8ccd4'); R(g, x + 14, 20, 4, 130, '#8a909c'); }
      R(g, 0, 0, 320, 40, K); R(g, 2, 2, 316, 36, colA);
      for (let x = 2; x < 318; x += 16) R(g, x, 2, 8, 4, colB);
      for (let x = 2; x < 318; x += 16) R(g, x + 8, 34, 8, 4, colB);
      const w = tinyW(label, 4);
      tiny(g, label, 160 - w / 2, 10, '#ffffff', 4);
    });
  }
  OBJ.basla = () => gate('BAŞLA', '#2a8a4a', '#f4f0e0');
  OBJ.kontrol = () => gate('KONTROL NOKTASI', '#2a5ad8', '#f4c531');
  OBJ.bitis = () => gate('BİTİŞ', '#18141e', '#f4f0e0');

  // levhalar: yazı her levha için ayrı önbelleğe alınır
  function tabela(label) {
    const w = Math.max(64, tinyW(label, 2) + 16);
    return mk(w, 70, (g) => {
      R(g, w / 2 - 3, 28, 6, 42, K); R(g, w / 2 - 2, 28, 4, 42, '#9aa0aa');
      R(g, 0, 0, w, 30, K); R(g, 2, 2, w - 4, 26, '#1e7a4a'); R(g, 4, 4, w - 8, 22, '#1e7a4a');
      g.strokeStyle = '#f4f0e0'; g.lineWidth = 1; g.strokeRect(4.5, 4.5, w - 9, 21);
      tiny(g, label, 8, 10, '#ffffff', 2);
    });
  }
  function ayrim(labels) {
    const [a, b] = labels;
    const wa = tinyW('← ' + a, 2), wb = tinyW(b + ' →', 2);
    const w = Math.max(wa, wb) * 2 + 40;
    return mk(w, 90, (g) => {
      R(g, w / 2 - 4, 40, 8, 50, K); R(g, w / 2 - 3, 40, 6, 50, '#9aa0aa');
      R(g, 0, 0, w / 2 - 2, 40, K); R(g, 2, 2, w / 2 - 6, 36, '#2a5ad8');
      R(g, w / 2 + 2, 0, w / 2 - 2, 40, K); R(g, w / 2 + 4, 2, w / 2 - 6, 36, '#1e7a4a');
      tiny(g, 'RUMELİ', 10, 6, '#f4c531', 2);
      tiny(g, '← ' + a, 10, 22, '#ffffff', 2);
      const rb = b === 'KÖPRÜ' || b === 'FSM' ? 'KÖPRÜ' : 'ANADOLU';
      tiny(g, rb, w - 10 - tinyW(rb, 2), 6, '#f4c531', 2);
      tiny(g, b + ' →', w - 10 - wb, 22, '#ffffff', 2);
    });
  }

  // ---------------- gün saatleri ----------------
  // 0 sabah, 1 öğle, 2 ikindi, 3 gün batımı
  const TIMES = [
    { sky: ['#5fb6f2', '#cfeeff'], sea: '#2f86c8', seaDark: '#2672ae', haze: '#d6ecfa', shore: '#7d9ab6', shore2: '#9ab4ca', sun: { y: 30, r: 9, c: '#fffbe0' }, grass: ['#6aaa3e', '#5e9a36'], park: ['#5aa040', '#4e9038'], forest: ['#3e7a32', '#36702c'], pave: ['#b8b4ac', '#aca8a0'], lights: 0 },
    { sky: ['#3aa2ee', '#b8e2ff'], sea: '#2a7cc0', seaDark: '#226aa6', haze: '#c8e4f8', shore: '#6e8eac', shore2: '#8eaac4', sun: { y: 18, r: 9, c: '#ffffff' }, grass: ['#62a63a', '#579834'], park: ['#55a03c', '#4a9034'], forest: ['#3a7630', '#326c2a'], pave: ['#bcb8b0', '#b0aca4'], lights: 0 },
    { sky: ['#6c96d8', '#ffd8a0'], sea: '#3a72a8', seaDark: '#30628f', haze: '#f0d8b0', shore: '#6c7896', shore2: '#8a90a8', sun: { y: 56, r: 12, c: '#fff0b0' }, grass: ['#7a9a3a', '#6c8c34'], park: ['#6a9a3c', '#5e8c36'], forest: ['#4a6a30', '#40602a'], pave: ['#c4b8a4', '#b8ac98'], lights: 0.15 },
    { sky: ['#2c2458', '#ff9058'], sea: '#4a4a86', seaDark: '#3a3a70', haze: '#e8907a', shore: '#3a2c50', shore2: '#4e3a62', sun: { y: 92, r: 18, c: '#ffb050' }, grass: ['#5a6a3a', '#4e5e34'], park: ['#4e6a3a', '#445e34'], forest: ['#34502e', '#2c4628'], pave: ['#9a8a8a', '#8e7e80'], lights: 0.7 },
  ];

  // uzak kıyı panoraması (ufkun üstünde, 1024 piksel, yatayda tekrarlar)
  const panCache = new Map();
  function panorama(time, seed) {
    const key = time + ':' + seed;
    if (panCache.has(key)) return panCache.get(key);
    const T = TIMES[time], r = rng(seed * 97 + 13);
    const W = 1024, H = 72;
    const c = mk(W, H, (g) => {
      // tepeler
      for (let x = 0; x < W; x++) {
        const h = 26 + Math.sin(x / W * Math.PI * 4 + seed) * 10 + Math.sin(x / W * Math.PI * 10 + seed * 2) * 5;
        R(g, x, H - h, 1, h, T.shore2);
      }
      // binalar, camiler, minareler
      let x = 0;
      while (x < W) {
        const w = 6 + Math.floor(r() * 14), h = 6 + Math.floor(r() * 18);
        R(g, x, H - h, w, h, T.shore);
        if (T.lights) for (let k = 0; k < w * h / 18; k++) if (r() < T.lights) R(g, x + Math.floor(r() * w), H - h + Math.floor(r() * h), 1, 1, r() < 0.5 ? '#ffd27a' : '#fff0b0');
        x += w + Math.floor(r() * 3);
      }
      for (let k = 0; k < 6; k++) {
        const cx = Math.floor(r() * W), base = H - 8, rd = 8 + Math.floor(r() * 6);
        for (let y = 0; y <= rd; y++) { const w = Math.round(Math.sqrt(rd * rd - y * y)); R(g, cx - w, base - 10 - y, w * 2, 1, T.shore); }
        R(g, cx - rd - 4, base - 10, rd * 2 + 8, 10, T.shore);
        for (const mx of [cx - rd - 8, cx + rd + 6]) { R(g, mx, base - 34, 2, 34, T.shore); R(g, mx, base - 38, 1, 4, T.shore); }
      }
    });
    panCache.set(key, c);
    return c;
  }
  // bulutlar
  const cloudCache = new Map();
  function clouds(time) {
    if (cloudCache.has(time)) return cloudCache.get(time);
    const r = rng(time * 5 + 1);
    const col = time === 3 ? 'rgba(255,170,140,0.55)' : time === 2 ? 'rgba(255,240,220,0.7)' : 'rgba(255,255,255,0.8)';
    const c = mk(1024, 70, (g) => {
      for (let k = 0; k < 9; k++) {
        const x = r() * 1024, y = 10 + r() * 46, w = 30 + r() * 60;
        for (let i = 0; i < 5; i++) ellipse(g, x + (i - 2) * w * 0.22, y - (i % 2) * 3, Math.round(w * 0.22), 4 + (i % 2) * 2, col);
      }
    });
    cloudCache.set(time, c);
    return c;
  }

  // ---------------- önbellek ----------------
  const cache = new Map();
  function get(key, fn) { let c = cache.get(key); if (!c) { c = fn(); cache.set(key, c); } return c; }
  function sprite(k, sp) {
    if (k === 'tabela') return get('tabela:' + sp.label, () => tabela(sp.label));
    if (k === 'ayrim') return get('ayrim:' + sp.label.join('|'), () => ayrim(sp.label));
    if (k === 'apartman') return get('apt:' + ((sp.v || 0) % 7), () => apartman((sp.v || 0) % 7));
    return get('o:' + k, () => (OBJ[k] ? OBJ[k]() : mk(8, 8, (g) => R(g, 0, 0, 8, 8, '#f0f'))));
  }
  function car(kind, color) {
    switch (kind) {
      case 'taksi': return get('c:taksi', () => sedan(0, true));
      case 'dolmus': return get('c:dolmus', dolmus);
      case 'otobus': return get('c:otobus', otobus);
      case 'kamyon': return get('c:kamyon', kamyon);
      case 'motor': return get('c:motor', motor);
      default: return get('c:araba' + color, () => sedan(color, false));
    }
  }
  function player(turn, brake, color) { return get(`p:${turn}:${brake ? 1 : 0}:${color}`, () => playerCar(turn, brake, color)); }

  // nesnelerin dünya genişliği (yarı yol genişliği cinsinden)
  const SIZE = {
    lamba: 0.16, korkuluk: 0.55, cinar: 1.4, agac: 1.2, servi: 0.45, apartman: 2.6, yali: 3.2, cami: 4.8, hisar: 1.9, kale: 4.5, saray: 6,
    kiz_kulesi: 2.6, tekne: 1.3, vapur: 4.6, balikci: 0.5, simitci: 0.55, durak: 1.3, semsiye: 0.95, tabela: 1.3, ayrim: 3.2,
    kopru_kule: 2.95, kopru_uzak: 18, basla: 2.6, kontrol: 2.6, bitis: 2.6, aski: 0.03,
  };
  const CAR_SIZE = { araba: 0.42, taksi: 0.42, dolmus: 0.52, otobus: 0.72, kamyon: 0.72, motor: 0.2 };

  root.BY_ART = { mk, R, disc, ellipse, poly, shade, mix, rng, tiny, tinyW, TIMES, panorama, clouds, sprite, car, player, SIZE, CAR_SIZE, CAR_COLORS };
})(window);
