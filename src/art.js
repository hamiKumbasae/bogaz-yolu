// Boğaz Yolu — çizimler: araba, trafik, yol kenarı nesneleri, gün saatine göre renkler ve arka planlar.
// Hepsi kodla çizilmiş çizgi film tarzı vektör resimlerdir. Her nesne, ekranda göründüğü boyuta göre
// kademeli (2'nin kuvvetleri) çözünürlükte önbelleğe alınır: uzaktaki ağaç küçük, yakındaki büyük çizilir.
(function (root) {
  'use strict';
  const K = '#1c1626';
  let S = 3;                       // cihaz pikseli / mantıksal piksel (main.js ayarlar)
  let LW = 1.5;                    // dış çizgi kalınlığı (tasarım birimi)

  function mk(w, h, fn, scale) {
    const sc = scale || S;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * sc)); c.height = Math.max(1, Math.ceil(h * sc));
    c.lw = w; c.lh = h;
    const g = c.getContext('2d');
    g.scale(c.width / w, c.height / h);
    g.lineJoin = 'round'; g.lineCap = 'round';
    fn(g, w, h);
    return c;
  }
  // ---------- yardımcılar ----------
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  function F(g, fill, stroke, lw) {
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke !== null) { g.strokeStyle = stroke || K; g.lineWidth = lw || LW; g.stroke(); }
  }
  function box(g, x, y, w, h, r, fill, stroke, lw) { rr(g, x, y, w, h, r); F(g, fill, stroke, lw); }
  function circ(g, x, y, r, fill, stroke, lw) { g.beginPath(); g.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); F(g, fill, stroke, lw); }
  function ell(g, x, y, rx, ry, fill, stroke, lw, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2); F(g, fill, stroke, lw); }
  function poly(g, pts, fill, stroke, lw) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); F(g, fill, stroke, lw); }
  function line(g, x1, y1, x2, y2, col, w) { g.strokeStyle = col; g.lineWidth = w || LW; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function lgrad(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  function archWin(g, x, y, w, h, col, stroke) {
    g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
    F(g, col, stroke === undefined ? null : stroke);
  }
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
  const FONT = 'Fredoka, "Trebuchet MS", system-ui, sans-serif';
  function label(g, s, x, y, px, col, align, weight) {
    g.font = `${weight || 600} ${px}px ${FONT}`; g.textAlign = align || 'center'; g.textBaseline = 'middle';
    g.fillStyle = col; g.fillText(s, x, y);
  }
  let measureCtx = null;
  function textW(s, px, weight) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = `${weight || 600} ${px}px ${FONT}`;
    return measureCtx.measureText(s).width;
  }
  // birleşik yaprak kümesi: önce bütün dairelerin dış çizgisi, sonra dolgu → tek parça görünür
  function foliage(g, blobs, cols, seed) {
    for (const [x, y, r] of blobs) circ(g, x, y, r + LW * 0.9, K, null);
    for (const [x, y, r] of blobs) circ(g, x, y, r, cols[1], null);
    const rr2 = rng(seed);
    for (const [x, y, r] of blobs) {
      circ(g, x - r * 0.25, y - r * 0.3, r * 0.62, cols[2], null);
      for (let k = 0; k < 3; k++) { const a = rr2() * 6.28, d = rr2() * r * 0.6; circ(g, x + Math.cos(a) * d, y + Math.sin(a) * d + r * 0.2, r * 0.22, cols[0], null); }
    }
    for (const [x, y, r] of blobs) circ(g, x - r * 0.35, y - r * 0.45, r * 0.18, 'rgba(255,255,255,0.22)', null);
  }

  // ---------------- oyuncu arabası (arkadan) ----------------
  const CAR_COLORS = { kirmizi: ['#e0352c', '#a01e18', '#ff7a60'], beyaz: ['#eef0f4', '#a8aeb8', '#ffffff'], turkuaz: ['#1fb0a4', '#127068', '#6ae4d8'] };
  function playerCar(turn, brake, color) {
    const [body, dark, light] = CAR_COLORS[color] || CAR_COLORS.kirmizi;
    return mk(96, 50, (g) => {
      LW = 1.6;
      const t = turn * 2.6;
      // tekerlekler
      const wl = 6 - Math.max(0, turn) * 2, wr = 72 - Math.min(0, turn) * 2;
      for (const x of [wl, wr]) { box(g, x, 31, 18, 17, 4, '#26222c'); box(g, x + 3, 33, 12, 2.4, 1, '#4a4652', null); }
      // alt gövde ve tampon
      box(g, 3, 23, 90, 17, 6, dark);
      box(g, 18, 33, 60, 6, 3, '#2a2630', null);
      for (let k = 0; k < 5; k++) rect(g, 24 + k * 11, 34, 5, 4, '#3a3640');
      // plaka
      box(g, 34, 26.5, 28, 9, 1.6, '#f6f6f2', K, 1.1);
      box(g, 34.6, 27.1, 4, 7.8, 1, '#2a5ad8', null);
      label(g, '34 BY', 50.5, 31.2, 6.4, '#1c1626', 'center', 600);
      // egzoz
      ell(g, 16, 38, 3.4, 2, '#8a8e98'); ell(g, 16, 38, 1.8, 1, '#26222c', null);
      ell(g, 80, 38, 3.4, 2, '#8a8e98'); ell(g, 80, 38, 1.8, 1, '#26222c', null);
      // yan panel (dönüşte görünür)
      if (turn < 0) box(g, 86, 14, 8, 22, 3, shade(dark, -0.15));
      if (turn > 0) box(g, 2, 14, 8, 22, 3, shade(dark, -0.15));
      // bagaj
      box(g, 4, 12, 88, 16, 6, lgrad(g, 0, 12, 0, 28, [[0, light], [0.35, body], [1, shade(body, -0.12)]]));
      // stop lambaları
      const lc = brake ? '#ff3a2a' : '#b81818';
      for (const x of [7, 65]) {
        box(g, x, 16, 24, 7, 3.2, lc, K, 1.2);
        box(g, x + 2, 17.2, 9, 2, 1, brake ? '#ffe0b0' : '#ff6a50', null);
      }
      if (brake) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const x of [19, 77]) { const gr = g.createRadialGradient(x, 19.5, 1, x, 19.5, 18); gr.addColorStop(0, 'rgba(255,90,60,0.55)'); gr.addColorStop(1, 'rgba(255,60,40,0)'); g.fillStyle = gr; g.fillRect(x - 18, 2, 36, 36); }
        g.restore();
      }
      line(g, 33, 21.5, 63, 21.5, dark, 1.6);
      box(g, 44, 17.4, 8, 3, 1.4, '#eaeaea', null);
      // tavan ve arka cam
      poly(g, [17 + t, 13.5, 79 + t, 13.5, 70 + t, 1.6, 26 + t, 1.6], body);
      poly(g, [21 + t, 12.4, 75 + t, 12.4, 67.6 + t, 4, 28.4 + t, 4], lgrad(g, 0, 4, 0, 12, [[0, '#5a7aa6'], [1, '#2a3a58']]), K, 1);
      poly(g, [31 + t, 11.6, 37 + t, 11.6, 44 + t, 4.6, 38 + t, 4.6], 'rgba(255,255,255,0.35)', null);
      // spoiler
      box(g, 9 + t / 2, 10.2, 78, 3.4, 1.6, shade(dark, -0.1));
      box(g, 11 + t / 2, 10.4, 74, 1, 0.5, light, null);
    });
  }

  // ---------------- trafik araçları ----------------
  const SEDAN = ['#eef0f4', '#9aa0aa', '#2f5aa0', '#33333c', '#9a2e2e'];
  function sedan(colIdx, taxi) {
    const body = taxi ? '#f6c21c' : SEDAN[colIdx % SEDAN.length], dark = shade(body, -0.32), light = shade(body, 0.35);
    return mk(72, 44, (g) => {
      LW = 1.5;
      if (taxi) { box(g, 25, 0.6, 22, 7, 2, '#fdf8e6'); label(g, 'TAKSİ', 36, 4.2, 5, '#1c1626'); }
      for (const x of [4, 54]) box(g, x, 29, 14, 13, 3, '#26222c');
      box(g, 2, 21, 68, 15, 5, dark);
      box(g, 25, 25, 22, 8, 1.4, '#f6f6f2', K, 1);
      rect(g, 25.6, 25.6, 3, 6.8, '#2a5ad8');
      box(g, 3, 12, 66, 12, 5, lgrad(g, 0, 12, 0, 24, [[0, light], [0.4, body], [1, shade(body, -0.1)]]));
      for (const x of [5.5, 52]) box(g, x, 15, 14.5, 5, 2.4, '#c81818', K, 1);
      poly(g, [12, 13, 60, 13, 54, 4.4, 18, 4.4], body);
      poly(g, [15, 12, 57, 12, 52, 6.2, 20, 6.2], lgrad(g, 0, 6, 0, 12, [[0, '#5a7aa6'], [1, '#2a3a58']]), K, 1);
      poly(g, [24, 11.4, 28, 11.4, 33, 6.8, 29, 6.8], 'rgba(255,255,255,0.35)', null);
      if (taxi) { rect(g, 3.5, 22.4, 65, 2.2, '#1c1626'); for (let x = 4; x < 68; x += 4.4) rect(g, x, 22.4, 2.2, 1.1, '#fdf8e6'), rect(g, x + 2.2, 23.5, 2.2, 1.1, '#fdf8e6'); }
    });
  }
  function dolmus() {
    return mk(84, 64, (g) => {
      LW = 1.6;
      const body = '#f6c21c', dark = '#b88a10';
      for (const x of [6, 64]) box(g, x, 50, 14, 13, 3, '#26222c');
      box(g, 2, 4, 80, 52, 8, lgrad(g, 0, 4, 0, 56, [[0, '#ffe27a'], [0.2, body], [1, shade(body, -0.12)]]));
      box(g, 8, 10, 31, 18, 3, lgrad(g, 0, 10, 0, 28, [[0, '#5a7aa6'], [1, '#2a3a58']]), K, 1.2);
      box(g, 45, 10, 31, 18, 3, lgrad(g, 0, 10, 0, 28, [[0, '#5a7aa6'], [1, '#2a3a58']]), K, 1.2);
      poly(g, [12, 26, 17, 26, 24, 12, 19, 12], 'rgba(255,255,255,0.3)', null);
      line(g, 42, 8, 42, 52, dark, 1.6);
      box(g, 22, 31, 40, 8, 3, '#1c1626', null); label(g, 'DOLMUŞ', 42, 35.2, 6.4, '#ffe27a');
      for (const x of [5, 69]) box(g, x, 40, 10, 7, 2, '#c81818', K, 1);
      box(g, 30, 42, 24, 8, 1.4, '#f6f6f2', K, 1);
      box(g, 2, 51, 80, 5, 2, dark);
    });
  }
  function otobus() {
    return mk(116, 96, (g) => {
      LW = 1.7;
      for (const x of [8, 90]) box(g, x, 84, 18, 11, 3, '#26222c');
      box(g, 2, 2, 112, 86, 9, '#eef1f6');
      g.save(); rr(g, 2, 2, 112, 86, 9); g.clip();
      rect(g, 2, 50, 112, 38, '#2e6ac8'); rect(g, 2, 50, 112, 3, '#6a9ae8');
      g.restore(); rr(g, 2, 2, 112, 86, 9); F(g, null);
      box(g, 8, 13, 100, 26, 4, lgrad(g, 0, 13, 0, 39, [[0, '#4a628a'], [1, '#22304a']]), K, 1.2);
      poly(g, [16, 37, 24, 37, 38, 15, 30, 15], 'rgba(255,255,255,0.25)', null);
      box(g, 28, 4, 60, 8, 2, '#141018', K, 1.2); label(g, '25E SARIYER', 58, 8.2, 5.8, '#ffb030');
      for (const x of [6, 98]) { box(g, x, 58, 12, 10, 3, '#c81818', K, 1.1); box(g, x, 71, 12, 5, 2, '#f4a020', K, 1.1); }
      box(g, 43, 69, 30, 9, 1.4, '#f6f6f2', K, 1);
      box(g, 20, 42, 76, 6, 2, '#1e4a8a', null); for (let x = 23; x < 94; x += 4) rect(g, x, 43, 2, 4, '#3a5a8a');
    });
  }
  function kamyon() {
    return mk(108, 88, (g) => {
      LW = 1.7;
      for (const x of [6, 84]) box(g, x, 76, 18, 11, 3, '#26222c');
      box(g, 2, 2, 104, 76, 5, lgrad(g, 0, 2, 0, 78, [[0, '#fbf8f0'], [1, '#d8d2c4']]));
      line(g, 54, 6, 54, 72, '#b4ad9e', 1.4);
      for (const x of [12, 96]) for (const y of [12, 60]) box(g, x - 3, y, 6, 8, 1, '#a8a294', null);
      box(g, 18, 26, 72, 20, 4, '#2a8a4a', K, 1.2);
      label(g, 'NAKLİYAT', 54, 36.4, 11, '#ffffff');
      box(g, 2, 70, 104, 10, 3, '#3a3a42');
      for (const x of [6, 90]) box(g, x, 72, 12, 5, 2, '#c81818', K, 1);
      box(g, 42, 71.5, 24, 7, 1.2, '#f6f6f2', K, 1);
    });
  }
  function motor() {
    return mk(32, 48, (g) => {
      LW = 1.3;
      box(g, 13, 35, 6, 13, 2.5, '#26222c');
      box(g, 9, 26, 14, 12, 3, '#c83a2e');
      box(g, 12, 30, 8, 3, 1.2, '#ff7a5a', null);
      box(g, 5, 7, 22, 17, 3, '#ee6a2a');
      // kurye kutusunda çatal bıçak
      line(g, 13, 11, 13, 20, '#ffffff', 1.3); line(g, 19, 11, 19, 20, '#ffffff', 1.3); line(g, 11.6, 11, 11.6, 14, '#ffffff', 0.8); line(g, 14.4, 11, 14.4, 14, '#ffffff', 0.8);
      ell(g, 16, 4.2, 6.8, 5, '#2a2a34');
      box(g, 11, 2.4, 8, 2.4, 1, '#6a7a98', null);
      box(g, 3, 22, 26, 6, 3, '#2a3a5a');
    });
  }

  // ---------------- yol kenarı ----------------
  // her nesne: [genişlik, yükseklik, çizim]
  const OBJ = {};
  OBJ.lamba = [24, 100, (g) => {
    LW = 1.4;
    const gr = '#2a5a3a';
    box(g, 7, 92, 10, 8, 2, gr);
    poly(g, [10.2, 93, 13.8, 93, 12.8, 22, 11.2, 22], gr);
    for (const y of [60, 34]) box(g, 9.6, y, 4.8, 3, 1.4, shade(gr, 0.15));
    g.strokeStyle = K; g.lineWidth = 3.4; g.beginPath(); g.moveTo(12, 24); g.quadraticCurveTo(12.4, 13, 20, 14); g.stroke();
    g.strokeStyle = gr; g.lineWidth = 1.8; g.stroke();
    line(g, 20, 14, 20, 17.5, K, 1);
    poly(g, [15.4, 21.4, 24.6, 21.4, 20, 16.6], gr);
    box(g, 16.2, 21.4, 7.6, 9, 1.2, '#fff2b0');
    rect(g, 17.2, 22.4, 2, 6.8, 'rgba(255,255,255,0.8)');
    poly(g, [16, 30.4, 24, 30.4, 20, 33.6], gr);
  }];
  OBJ.korkuluk = [64, 22, (g) => {
    LW = 1.2;
    box(g, 0, 17, 64, 5, 1, '#d6d0c4');
    rect(g, 0, 17.4, 64, 1, '#f2eee6');
    const c = '#2f6f8f';
    for (let x = 3; x < 62; x += 5.8) box(g, x, 4, 2, 13, 0.8, c);
    box(g, 0, 13.5, 64, 2.2, 1, c);
    box(g, 0, 2, 64, 3.2, 1.4, c);
    rect(g, 0.6, 2.4, 63, 0.9, '#6aa6c4');
    for (const x of [0, 61]) box(g, x, 0, 3.2, 18, 1, shade(c, 0.1));
  }];
  OBJ.cinar = [100, 128, (g) => {
    LW = 1.8;
    poly(g, [41, 128, 59, 128, 55, 74, 45, 74], '#a49a7a');
    g.save(); g.beginPath(); g.moveTo(41, 128); g.lineTo(59, 128); g.lineTo(55, 74); g.lineTo(45, 74); g.closePath(); g.clip();
    const r = rng(41);
    for (let k = 0; k < 14; k++) ell(g, 43 + r() * 14, 80 + r() * 46, 2 + r() * 3, 3 + r() * 4, ['#d8ccaa', '#7a7058', '#bfb38e'][k % 3], null);
    g.restore();
    poly(g, [41, 128, 59, 128, 55, 74, 45, 74], null);
    for (const [a, b, c, d] of [[46, 82, 32, 62], [54, 80, 68, 60], [50, 76, 50, 50]]) { g.strokeStyle = K; g.lineWidth = 6.6; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.strokeStyle = '#8a7e60'; g.lineWidth = 4; g.stroke(); }
    foliage(g, [[28, 48, 22], [72, 46, 22], [50, 30, 27], [40, 58, 18], [62, 60, 18], [50, 52, 20]], ['#3e7a2a', '#55983a', '#7cbc4e'], 7);
  }];
  OBJ.agac = [84, 100, (g) => {
    LW = 1.8;
    box(g, 37, 56, 10, 44, 3, '#7a5232');
    rect(g, 39, 60, 2.4, 36, '#9a6a42');
    foliage(g, [[42, 40, 30], [24, 50, 18], [60, 50, 18], [42, 22, 18]], ['#2e6a2a', '#45883a', '#6aaa4a'], 11);
  }];
  OBJ.servi = [34, 124, (g) => {
    LW = 1.6;
    box(g, 14.5, 108, 5, 16, 1.6, '#6a4a2a');
    g.beginPath(); g.moveTo(17, 2);
    g.bezierCurveTo(23, 22, 29, 52, 27, 82); g.bezierCurveTo(26, 98, 22, 112, 17, 114);
    g.bezierCurveTo(12, 112, 8, 98, 7, 82); g.bezierCurveTo(5, 52, 11, 22, 17, 2); g.closePath();
    F(g, lgrad(g, 6, 0, 28, 0, [[0, '#2f6a32'], [0.6, '#1f5228'], [1, '#163e1e']]));
    g.save(); g.clip();
    g.strokeStyle = 'rgba(120,190,110,0.45)'; g.lineWidth = 1.2;
    for (let y = 14; y < 112; y += 8) { g.beginPath(); g.moveTo(10, y + 4); g.quadraticCurveTo(14, y, 18, y + 3); g.stroke(); }
    g.restore();
  }];
  const FACADES = ['#eab8a0', '#f2d890', '#a8d4c4', '#ecc8d4', '#c8dcee', '#e4c098', '#dcd6ca'];
  const SHOPS = ['BAKKAL', 'BÜFE', 'FIRIN', 'ÇAY EVİ', 'BERBER', 'LOKANTA', 'ECZANE'];
  function apartman(g, v) {
    LW = 1.8;
    const col = FACADES[v % FACADES.length], r = rng(v * 31 + 7);
    box(g, 4, 10, 120, 158, 1, col);
    rect(g, 6, 11, 5, 156, shade(col, 0.25));
    box(g, 0, 5, 128, 7, 2, shade(col, -0.28));
    for (let fy = 0; fy < 6; fy++) {
      const y = 18 + fy * 24;
      for (let fx = 0; fx < 4; fx++) {
        const x = 12 + fx * 28;
        if (v % 2 && fy > 0 && fy < 5 && (fx === 1 || fx === 2)) continue;
        box(g, x - 1.5, y - 1.5, 21, 19, 1, '#f4f0e6', K, 1.2);
        box(g, x + 1, y + 1, 16, 14, 0.6, r() < 0.18 ? '#f6e2a2' : lgrad(g, 0, y, 0, y + 15, [[0, '#7a96bc'], [1, '#3e4e6c']]), null);
        line(g, x + 9, y + 1, x + 9, y + 15, '#f4f0e6', 1.2);
        if (r() < 0.35) { box(g, x - 3, y + 15, 24, 3.2, 1, shade(col, -0.25), K, 1); for (let k = x - 1; k < x + 20; k += 3) line(g, k, y + 12, k, y + 15, K, 0.7); line(g, x - 2, y + 12, x + 20, y + 12, K, 0.9); }
      }
      if (v % 2 && fy > 0 && fy < 5) {
        box(g, 44, y - 3, 40, 21, 1.4, shade(col, 0.12));
        for (let k = 0; k < 3; k++) box(g, 48 + k * 11.6, y + 0.5, 9, 14, 0.6, lgrad(g, 0, y, 0, y + 15, [[0, '#7a96bc'], [1, '#3e4e6c']]), K, 1);
        poly(g, [44, y + 18, 84, y + 18, 80, y + 21, 48, y + 21], shade(col, -0.2), K, 1);
      }
    }
    // dükkân, tente ve tabela
    box(g, 4, 148, 120, 20, 0, '#4a3e36');
    box(g, 12, 152, 32, 14, 1, lgrad(g, 0, 152, 0, 166, [[0, '#8ab0d0'], [1, '#4a6a8a']]), K, 1);
    box(g, 84, 152, 32, 14, 1, lgrad(g, 0, 152, 0, 166, [[0, '#8ab0d0'], [1, '#4a6a8a']]), K, 1);
    box(g, 52, 152, 24, 16, 1, '#6a4a32', K, 1);
    const aw = r() < 0.5 ? '#d0302a' : '#2a8a6a';
    g.save(); rr(g, 6, 140, 116, 9, 2); g.clip();
    for (let x = 6; x < 124; x += 9) rect(g, x, 140, 4.5, 9, x % 18 < 9 ? aw : '#f6f2e4');
    g.restore(); rr(g, 6, 140, 116, 9, 2); F(g, null, K, 1.2);
    for (let x = 6; x < 122; x += 9) { g.beginPath(); g.arc(x + 4.5, 149, 4.5, 0, Math.PI); F(g, (x / 9) % 2 < 1 ? aw : '#f6f2e4', K, 1); }
    box(g, 34, 129, 60, 10, 2, '#1c3a6a', K, 1.2);
    label(g, SHOPS[v % SHOPS.length], 64, 134.4, 7, '#fff2c0');
  }
  OBJ.yali = [168, 112, (g) => {
    LW = 1.8;
    const wood = '#8e3a2a', woodL = '#b45a44', trim = '#f6f0e4';
    box(g, 0, 98, 168, 14, 1, '#7a7068');
    for (const x of [20, 70, 120]) archWin(g, x, 100, 22, 12, '#2a3a4a', K);
    box(g, 6, 30, 156, 70, 1, wood);
    g.strokeStyle = shade(wood, -0.18); g.lineWidth = 0.8;
    for (let y = 34; y < 98; y += 4) { g.beginPath(); g.moveTo(7, y); g.lineTo(161, y); g.stroke(); }
    // cumba (çıkma)
    box(g, 54, 38, 60, 40, 1, woodL);
    for (const x of [58, 102]) poly(g, [x, 78, x + 8, 78, x + 4, 88], wood, K, 1.2);
    for (let k = 0; k < 4; k++) { const x = 59 + k * 13.5; box(g, x, 43, 10, 26, 1, trim, K, 1.2); box(g, x + 1.8, 45, 6.4, 22, 0.6, lgrad(g, 0, 45, 0, 67, [[0, '#6a86ac'], [1, '#2e3e5a']]), null); }
    for (const x of [14, 34, 124, 144]) { box(g, x, 44, 12, 24, 1, trim, K, 1.2); box(g, x + 1.8, 46, 8.4, 20, 0.6, lgrad(g, 0, 46, 0, 66, [[0, '#6a86ac'], [1, '#2e3e5a']]), null); line(g, x + 6, 46, x + 6, 66, trim, 1); }
    for (let k = 0; k < 7; k++) { const x = 10 + k * 22.5; box(g, x, 82, 10, 13, 1, trim, K, 1); box(g, x + 1.6, 83.6, 6.8, 9.8, 0.5, '#3a4a64', null); }
    rect(g, 6, 96, 156, 2.4, trim);
    // geniş saçaklı çatı
    poly(g, [-2, 32, 170, 32, 150, 12, 18, 12], '#5a3a32');
    g.strokeStyle = '#7a4e42'; g.lineWidth = 1;
    for (let x = 24; x < 146; x += 6) { g.beginPath(); g.moveTo(x, 13); g.lineTo(x - 4, 31); g.stroke(); }
    box(g, 74, 4, 8, 10, 1, '#6a4a3e');
  }];
  OBJ.cami = [200, 180, (g) => {
    LW = 1.8;
    const st = '#ece4d4', sh = '#c4b8a2', lead = '#8794a8', leadL = '#a8b4c4';
    for (const x of [14, 186]) {
      poly(g, [x - 4.4, 180, x + 4.4, 180, x + 3.6, 26, x - 3.6, 26], st);
      rect(g, x + 1, 27, 2.4, 152, sh);
      for (const y of [62, 102]) box(g, x - 7, y, 14, 4.2, 1.6, st);
      poly(g, [x - 4.4, 26, x + 4.4, 26, x, 2], lead);
      line(g, x, 2, x, -4, '#c8a020', 1.2);
    }
    box(g, 30, 100, 140, 80, 1, st);
    rect(g, 31, 101, 138, 3, '#fbf6ea');
    for (let x = 40; x < 160; x += 22) archWin(g, x, 118, 12, 28, lgrad(g, 0, 118, 0, 146, [[0, '#5a7aa0'], [1, '#2e3e5a']]), K);
    archWin(g, 88, 146, 24, 34, '#5a4030', K);
    box(g, 44, 90, 112, 11, 1, st);
    const dome = (cx, by, r, ry) => {
      g.beginPath(); g.ellipse(cx, by, r, ry, 0, Math.PI, 0); g.closePath(); F(g, lead);
      g.save(); g.clip(); ell(g, cx - r * 0.4, by - ry * 0.55, r * 0.35, ry * 0.5, leadL, null, 0, -0.4); g.restore();
      line(g, cx, by - ry, cx, by - ry - Math.max(4, r * 0.18), '#c8a020', 1.4);
    };
    dome(52, 101, 18, 17); dome(148, 101, 18, 17);
    box(g, 70, 82, 60, 10, 1, st);
    for (let x = 74; x < 128; x += 8) archWin(g, x, 84, 4, 7, '#3e4e6a');
    dome(100, 83, 44, 40);
  }];
  OBJ.hisar = [100, 168, (g) => {
    LW = 2;
    const st = '#c2b292', stD = '#8e7e62';
    box(g, 10, 40, 80, 128, 1, lgrad(g, 10, 0, 90, 0, [[0, '#a89878'], [0.3, '#d4c6a6'], [0.75, st], [1, stD]]));
    g.save(); rr(g, 10, 40, 80, 128, 1); g.clip();
    const r = rng(9);
    g.strokeStyle = 'rgba(90,74,50,0.45)'; g.lineWidth = 0.8;
    for (let y = 46; y < 168; y += 7) { g.beginPath(); g.moveTo(10, y); g.lineTo(90, y); g.stroke(); for (let x = 10 + (y % 14 ? 0 : 8); x < 90; x += 12 + r() * 6) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 7); g.stroke(); } }
    g.restore();
    box(g, 10, 40, 80, 128, 1, null);
    for (const [x, y] of [[46, 70], [46, 112], [26, 92], [68, 92]]) box(g, x, y, 7, 16, 3, '#2a2420', K, 1.2);
    box(g, 6, 34, 88, 8, 1.4, shade(st, -0.05));
    for (let x = 9; x < 91; x += 8) box(g, x, 41.6, 5, 4, 0.6, shade(st, -0.2), K, 0.8);
    poly(g, [4, 35, 96, 35, 50, 2], lgrad(g, 4, 0, 96, 0, [[0, '#6e7c90'], [0.4, '#a2aec0'], [1, '#5a687c']]));
    line(g, 50, 2, 50, -6, '#c8a020', 1.6);
  }];
  OBJ.kale = [200, 132, (g) => {
    LW = 1.8;
    const st = '#b6a284', sh = '#8a7658';
    box(g, -4, 124, 208, 10, 2, '#5a8a3a', null);
    const parts = [[0, 50, 92, 1], [40, 70, 62, 2], [100, 42, 112, 3], [132, 68, 72, 4]];
    for (const [x, w, h, s] of parts) {
      const top = 132 - h, r = rng(s * 13);
      g.beginPath(); g.moveTo(x, 132); g.lineTo(x, top);
      for (let k = x; k < x + w - 5; k += 9) { const d = r() < 0.25 ? 4 + r() * 6 : 0; g.lineTo(k, top + d); g.lineTo(k, top - 7 + d); g.lineTo(k + 5, top - 7 + d); g.lineTo(k + 5, top + d); }
      g.lineTo(x + w, top + 3); g.lineTo(x + w, 132); g.closePath();
      F(g, lgrad(g, x, 0, x + w, 0, [[0, shade(st, 0.12)], [1, sh]]));
      g.save(); g.clip();
      g.strokeStyle = 'rgba(80,64,44,0.45)'; g.lineWidth = 0.8;
      for (let y = top + 4; y < 132; y += 6) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
      g.restore();
    }
    archWin(g, 108, 76, 26, 40, '#2a2420', K);
    for (const [x, y] of [[20, 70], [70, 90], [160, 84]]) box(g, x, y, 5, 12, 2, '#2a2420', K, 1);
    for (const [x, y, rad] of [[30, 124, 10], [180, 122, 12], [90, 126, 8]]) circ(g, x, y, rad, '#4e7a32', null);
  }];
  OBJ.saray = [260, 116, (g) => {
    LW = 1.8;
    const st = '#f6f2ea', sh = '#d8d0c2';
    box(g, 0, 104, 260, 12, 1, '#a8a29a');
    for (let x = 6; x < 256; x += 14) rect(g, x, 106, 8, 3, '#c8c2b8');
    box(g, 0, 20, 260, 86, 1, st);
    box(g, -2, 13, 264, 9, 2, sh);
    for (let x = 0; x < 260; x += 6) box(g, x + 1, 6, 3, 7, 1, st, K, 0.9);
    line(g, -2, 6, 262, 6, K, 1.4);
    box(g, 96, 0, 68, 22, 2, st);
    circ(g, 130, 11, 6, '#d8b030', K, 1.2); circ(g, 130, 11, 3.4, st, null);
    for (let x = 10; x < 250; x += 20) {
      archWin(g, x, 30, 12, 28, lgrad(g, 0, 30, 0, 58, [[0, '#6a86ac'], [1, '#2e3e5a']]), K);
      box(g, x - 4, 60, 20, 3, 1, sh, K, 1);
      archWin(g, x, 68, 12, 30, lgrad(g, 0, 68, 0, 98, [[0, '#6a86ac'], [1, '#2e3e5a']]), K);
      if (x > 10) rect(g, x - 5, 24, 2.6, 78, sh);
    }
    rect(g, 0, 100, 260, 4, sh);
  }];
  OBJ.kiz_kulesi = [110, 130, (g) => {
    LW = 1.8;
    const wall = '#f4f0e6', sh = '#d6d0c4', lead = '#7e8ea2';
    ell(g, 55, 121, 54, 9, '#5e5a58'); ell(g, 38, 117, 18, 5, '#7a7470', null); ell(g, 76, 118, 14, 4, '#7a7470', null);
    box(g, 10, 86, 90, 32, 1, wall);
    rect(g, 10, 86, 90, 3, sh);
    for (let x = 16; x < 96; x += 12) archWin(g, x, 94, 6, 12, '#3e5476', K);
    g.beginPath(); g.ellipse(28, 87, 12, 10, 0, Math.PI, 0); g.closePath(); F(g, lead);
    box(g, 36, 34, 38, 54, 1, wall);
    rect(g, 64, 35, 9, 52, sh);
    for (const y of [46, 66]) archWin(g, 45, y, 9, 13, '#3e5476', K);
    box(g, 32, 28, 46, 7, 1.4, sh);
    box(g, 41, 12, 28, 17, 1, wall);
    for (let k = 0; k < 3; k++) archWin(g, 44 + k * 8, 15, 5, 10, '#3e5476', K);
    poly(g, [38, 13, 72, 13, 55, -10], lead);
    line(g, 55, -10, 55, -16, '#c8a020', 1.4);
    // bayrak
    line(g, 16, 54, 16, 87, '#d8dde6', 1.4);
    g.fillStyle = '#e30a17'; g.beginPath(); g.moveTo(16, 54); g.quadraticCurveTo(24, 52, 31, 55); g.lineTo(31, 65); g.quadraticCurveTo(24, 62, 16, 64); g.closePath(); g.fill();
    circ(g, 21.6, 59.2, 3, '#ffffff', null); circ(g, 22.6, 59.2, 2.4, '#e30a17', null);
    g.fillStyle = '#ffffff'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? 0.55 : 1.3; g.lineTo(26 + Math.cos(a) * d, 59.2 + Math.sin(a) * d); }
    g.closePath(); g.fill();
  }];
  OBJ.tekne = [70, 36, (g) => {
    LW = 1.6;
    ell(g, 35, 33, 32, 2.4, 'rgba(255,255,255,0.45)', null);
    g.beginPath(); g.moveTo(1, 17); g.lineTo(69, 17); g.quadraticCurveTo(66, 28, 58, 31); g.lineTo(10, 31); g.quadraticCurveTo(4, 26, 1, 17); g.closePath(); F(g, '#f6f6f2');
    rect(g, 4, 21, 63, 2.4, '#2a5ad8'); rect(g, 7, 25, 57, 1.2, '#2a5ad8');
    box(g, 24, 6, 22, 12, 2, '#f6f6f2');
    box(g, 27, 8.5, 6.4, 4.6, 1, '#4a6a94', null); box(g, 36, 8.5, 6.4, 4.6, 1, '#4a6a94', null);
    line(g, 35, 0, 35, 6, K, 1.2);
  }];
  OBJ.vapur = [200, 70, (g) => {
    LW = 1.8;
    ell(g, 100, 64, 92, 4, 'rgba(255,255,255,0.4)', null);
    g.beginPath(); g.moveTo(0, 34); g.lineTo(200, 34); g.quadraticCurveTo(196, 52, 186, 60); g.lineTo(12, 60); g.quadraticCurveTo(3, 50, 0, 34); g.closePath();
    F(g, '#24324e');
    rect(g, 1, 34.6, 198, 8, '#f6f6f2'); line(g, 1, 42.6, 199, 42.6, K, 1);
    box(g, 20, 18, 160, 17, 2, '#f6f6f2');
    for (let x = 25; x < 176; x += 10) box(g, x, 22.5, 6.4, 7, 1.2, '#3e5476', null);
    box(g, 50, 6, 100, 13, 2, '#f6f6f2');
    for (let x = 55; x < 146; x += 10) box(g, x, 9.5, 6.4, 5, 1.2, '#3e5476', null);
    box(g, 92, -2, 14, 10, 1.4, '#f2dc8a');
    rect(g, 92.6, -2, 12.8, 3, '#22222a');
    line(g, 40, 6, 40, -4, '#4a4a54', 1.2);
    g.fillStyle = '#e30a17'; g.fillRect(40, -4, 9, 6);
    circ(g, 43.2, -1, 1.6, '#ffffff', null); circ(g, 43.8, -1, 1.3, '#e30a17', null);
  }];
  OBJ.balikci = [64, 52, (g) => {
    LW = 1.4;
    g.strokeStyle = '#3a3430'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(22, 20); g.quadraticCurveTo(44, 6, 62, 2); g.stroke();
    g.strokeStyle = 'rgba(230,230,230,0.7)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(62, 2); g.lineTo(62, 44); g.stroke();
    box(g, 2, 40, 10, 10, 2, '#4a8ac8');
    box(g, 10, 34, 6, 16, 2, '#3a4a64'); box(g, 17, 34, 6, 16, 2, '#3a4a64');
    box(g, 8, 14, 18, 22, 5, '#6a7a4a');
    circ(g, 17, 9, 5.6, '#f1b98f');
    box(g, 10.6, 2, 13, 5.4, 2.4, '#2a4a8a');
    rect(g, 18, 6, 8, 1.6, '#2a4a8a');
    circ(g, 19.6, 9.4, 0.8, K, null);
    box(g, 18, 18, 9, 4.6, 2.2, '#f1b98f');
  }];
  OBJ.simitci = [50, 52, (g) => {
    LW = 1.5;
    for (const x of [12, 38]) { circ(g, x, 46, 5.2, '#2a2630'); circ(g, x, 46, 2, '#a0a6b0', null); }
    box(g, 4, 18, 42, 24, 2.4, '#d2302a');
    box(g, 6, 2, 38, 17, 2, 'rgba(220,240,255,0.7)');
    for (const [x, y] of [[13, 8], [25, 8], [37, 8], [19, 14], [31, 14]]) { g.fillStyle = '#c47a2c'; g.beginPath(); g.arc(x, y, 4.2, 0, Math.PI * 2); g.arc(x, y, 1.6, 0, Math.PI * 2, true); g.fill('evenodd'); }
    box(g, 6, 25, 38, 8, 2, '#fdf6e4', null);
    label(g, 'SİMİT', 25, 29.4, 6.6, '#d2302a');
    box(g, 2, 0, 46, 3.2, 1.4, '#a81e1a');
  }];
  OBJ.durak = [100, 84, (g) => {
    LW = 1.6;
    for (const x of [5, 92]) box(g, x, 6, 4, 78, 1, '#5a6070');
    box(g, 8, 10, 84, 50, 1, 'rgba(190,220,240,0.42)', 'rgba(28,22,38,0.6)', 1.2);
    rect(g, 10, 12, 80, 1.2, 'rgba(255,255,255,0.8)');
    box(g, 60, 14, 26, 40, 2, '#fdf6e4');
    box(g, 62.5, 17, 21, 7, 1, '#2a5ad8', null);
    for (let y = 28; y < 52; y += 4) rect(g, 63, y, 20, 1.2, '#a8aeb8');
    box(g, 12, 55, 40, 5, 2, '#8a6a3a');
    for (const x of [16, 46]) line(g, x, 60, x, 70, K, 1.6);
    box(g, 0, 0, 100, 9, 2, '#d0302a');
    label(g, 'DURAK', 50, 4.8, 6.6, '#ffffff');
  }];
  OBJ.semsiye = [64, 66, (g) => {
    LW = 1.5;
    line(g, 32, 20, 32, 56, K, 2);
    for (let k = 0; k < 6; k++) {
      const a0 = 4 + k * 9.33, a1 = a0 + 9.33;
      poly(g, [a0, 21, a1, 21, 32, 3], k % 2 ? '#d0302a' : '#fbf6e8', K, 1.1);
    }
    g.beginPath(); for (let k = 0; k < 6; k++) { const a0 = 4 + k * 9.33; g.moveTo(a0, 21); g.quadraticCurveTo(a0 + 4.66, 24.5, a0 + 9.33, 21); } g.strokeStyle = K; g.lineWidth = 1.1; g.stroke();
    box(g, 14, 49, 36, 4, 1.6, '#8a6a3a');
    for (const x of [20, 42]) line(g, x, 53, x, 66, K, 1.6);
    // ince belli çay bardakları
    for (const x of [24, 36]) { poly(g, [x - 1.6, 43, x + 1.6, 43, x + 0.8, 46, x + 1.4, 49, x - 1.4, 49, x - 0.8, 46], '#c8401e', K, 0.6); }
    for (const x of [8, 56]) { box(g, x - 4, 52, 8, 3, 1, '#8a6a3a'); line(g, x, 55, x, 66, K, 1.4); }
  }];
  OBJ.kopru_kule = [300, 420, (g) => {
    LW = 3;
    const c = '#d6d4cf', d = '#a6a29c';
    for (const x of [0, 270]) { box(g, x, 0, 30, 420, 2, lgrad(g, x, 0, x + 30, 0, [[0, shade(c, 0.1)], [0.6, c], [1, d]])); }
    for (const y of [0, 110, 220]) { box(g, 0, y, 300, 22, 2, lgrad(g, 0, y, 0, y + 22, [[0, shade(c, 0.12)], [1, d]])); }
    circ(g, 150, 4, 3.4, '#ff4a3a', null);
  }];
  OBJ.kopru_uzak = [320, 90, (g) => {
    const c = 'rgba(70,80,100,0.75)', thin = 'rgba(70,80,100,0.38)';
    rect(g, 0, 70, 320, 4, c);
    const cab = (x) => { const u = (x - 60) / 200; return u >= 0 && u <= 1 ? 4 + (1 - 4 * (u - 0.5) * (u - 0.5)) * 62 : (u < 0 ? 4 + (-u) * 220 : 4 + (u - 1) * 220); };
    g.strokeStyle = thin; g.lineWidth = 0.7; g.beginPath();
    for (let x = 64; x < 258; x += 8) { const y = cab(x); g.moveTo(x, y); g.lineTo(x + 8, 70); }
    g.stroke();
    g.strokeStyle = c; g.lineWidth = 1.6; g.beginPath();
    for (let x = 0; x <= 320; x += 2) { const y = Math.min(70, cab(x)); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    for (const x of [60, 260]) { rect(g, x - 3, 0, 6, 90, c); rect(g, x - 5, 10, 10, 2, c); rect(g, x - 5, 40, 10, 2, c); }
  }];
  function gate(text, colA, colB, checker) {
    return [320, 150, (g) => {
      LW = 2.4;
      for (const x of [0, 300]) box(g, x, 20, 20, 130, 2, lgrad(g, x, 0, x + 20, 0, [[0, '#e2e6ee'], [1, '#9aa0ac']]));
      box(g, 0, 0, 320, 40, 4, colA);
      g.save(); rr(g, 0, 0, 320, 40, 4); g.clip();
      if (checker) { for (let x = 0; x < 320; x += 10) for (let y = 0; y < 40; y += 10) if (((x + y) / 10) % 2) rect(g, x, y, 10, 10, colB); rect(g, 70, 6, 180, 28, colA); }
      else { for (let x = 0; x < 320; x += 16) { rect(g, x, 0, 8, 5, colB); rect(g, x + 8, 35, 8, 5, colB); } }
      g.restore(); rr(g, 0, 0, 320, 40, 4); F(g, null);
      g.save(); g.lineJoin = 'round'; g.font = `600 24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.strokeText(text, 160, 21.5);
      g.fillStyle = '#ffffff'; g.fillText(text, 160, 21.5); g.restore();
    }];
  }
  OBJ.basla = gate('BAŞLA', '#2a8a4a', '#f4f0e0');
  OBJ.kontrol = gate('KONTROL NOKTASI', '#2a5ad8', '#f4c531');
  OBJ.bitis = gate('BİTİŞ', '#18141e', '#f4f0e0', true);

  // levhalar
  function tabelaDef(text) {
    const w = Math.max(64, textW(text, 14) + 22);
    return [w, 70, (g) => {
      LW = 1.8;
      box(g, w / 2 - 3, 28, 6, 42, 1.4, '#a0a6b0');
      box(g, 0, 0, w, 30, 4, '#1e7a4a');
      box(g, 4, 4, w - 8, 22, 2.4, null, '#f4f0e0', 1.2);
      label(g, text, w / 2, 15.4, 14, '#ffffff');
    }];
  }
  function ayrimDef(labels) {
    const [a, b] = labels;
    const half = Math.max(textW('← ' + a, 14), textW(b + ' →', 14), textW('ANADOLU', 12)) + 22;
    const w = half * 2 + 8;
    const rb = b === 'KÖPRÜ' || b === 'FSM' ? 'KÖPRÜ' : 'ANADOLU';
    return [w, 90, (g) => {
      LW = 2;
      box(g, w / 2 - 4, 40, 8, 50, 1.4, '#a0a6b0');
      box(g, 0, 0, half, 40, 4, '#2a5ad8');
      box(g, w - half, 0, half, 40, 4, '#1e7a4a');
      label(g, 'RUMELİ', 10, 11, 12, '#f4c531', 'left');
      label(g, '← ' + a, 10, 28, 14, '#ffffff', 'left');
      label(g, rb, w - 10, 11, 12, '#f4c531', 'right');
      label(g, b + ' →', w - 10, 28, 14, '#ffffff', 'right');
    }];
  }

  // ---------------- gün saatleri ----------------
  // 0 sabah, 1 öğle, 2 ikindi, 3 gün batımı
  const TIMES = [
    { sky: ['#5fb6f2', '#cfeeff'], sea: '#2f86c8', seaDark: '#2672ae', haze: '#d6ecfa', shore: '#7d9ab6', shore2: '#9ab4ca', sun: { y: 30, r: 9, c: '#fffbe0' }, grass: ['#6aaa3e', '#5e9a36'], park: ['#5aa040', '#4e9038'], forest: ['#3e7a32', '#36702c'], pave: ['#b8b4ac', '#aca8a0'], lights: 0 },
    { sky: ['#3aa2ee', '#b8e2ff'], sea: '#2a7cc0', seaDark: '#226aa6', haze: '#c8e4f8', shore: '#6e8eac', shore2: '#8eaac4', sun: { y: 18, r: 9, c: '#ffffff' }, grass: ['#62a63a', '#579834'], park: ['#55a03c', '#4a9034'], forest: ['#3a7630', '#326c2a'], pave: ['#bcb8b0', '#b0aca4'], lights: 0 },
    { sky: ['#6c96d8', '#ffd8a0'], sea: '#3a72a8', seaDark: '#30628f', haze: '#f0d8b0', shore: '#6c7896', shore2: '#8a90a8', sun: { y: 56, r: 12, c: '#fff0b0' }, grass: ['#7a9a3a', '#6c8c34'], park: ['#6a9a3c', '#5e8c36'], forest: ['#4a6a30', '#40602a'], pave: ['#c4b8a4', '#b8ac98'], lights: 0.15 },
    { sky: ['#2c2458', '#ff9058'], sea: '#4a4a86', seaDark: '#3a3a70', haze: '#e8907a', shore: '#3a2c50', shore2: '#4e3a62', sun: { y: 92, r: 18, c: '#ffb050' }, grass: ['#5a6a3a', '#4e5e34'], park: ['#4e6a3a', '#445e34'], forest: ['#34502e', '#2c4628'], pave: ['#9a8a8a', '#8e7e80'], lights: 0.7 },
  ];

  // ---------------- önbellek ----------------
  // Ekran ölçeğine bağlı olanlar (oyuncu arabası, uzak kıyı, bulutlar) ölçek değişince silinir.
  const scaled = new Map();
  function getScaled(key, fn) { let c = scaled.get(key); if (!c) { c = fn(); scaled.set(key, c); } return c; }
  // Mesafeye göre kademeli önbellek (en son kullanılan en sonda; bütçe aşılınca en eskiler silinir)
  const lod = new Map();
  let lodPx = 0;
  const LOD_BUDGET = 18e6;
  function getLod(key, w, h, scale, fn) {
    let c = lod.get(key);
    if (c) { lod.delete(key); lod.set(key, c); return c; }
    c = mk(w, h, fn, scale);
    lod.set(key, c); lodPx += c.width * c.height;
    while (lodPx > LOD_BUDGET && lod.size > 1) { const k0 = lod.keys().next().value; const c0 = lod.get(k0); lodPx -= c0.width * c0.height; lod.delete(k0); }
    return c;
  }
  // needPx: nesnenin ekrandaki genişliği (cihaz pikseli). Tasarım boyutunun 2^L katı ≥ needPx.
  function lodLevel(w, h, needPx) {
    let L = Math.ceil(Math.log2(Math.max(needPx / w, 1 / 32)));
    L = Math.max(-5, Math.min(3, L));
    while (L > -5 && Math.max(w, h) * Math.pow(2, L) > 2048) L--;
    return L;
  }
  function defOf(k, sp) {
    if (k === 'tabela') return ['tabela:' + sp.label, tabelaDef(sp.label)];
    if (k === 'ayrim') return ['ayrim:' + sp.label.join('|'), ayrimDef(sp.label)];
    if (k === 'apartman') { const v = (sp.v || 0) % 7; return ['apt:' + v, [128, 168, (g) => apartman(g, v)]]; }
    if (OBJ[k]) return ['o:' + k, OBJ[k]];
    return ['o:?', [8, 8, (g) => rect(g, 0, 0, 8, 8, '#f0f')]];
  }
  const defCache = new Map();
  function sprite(k, sp, needPx) {
    const dk = k === 'tabela' ? 'tabela:' + sp.label : k === 'ayrim' ? 'ayrim:' + sp.label.join('|') : k === 'apartman' ? 'apt:' + ((sp.v || 0) % 7) : 'o:' + k;
    let d = defCache.get(dk);
    if (!d) { d = defOf(k, sp)[1]; defCache.set(dk, d); }
    const [w, h, fn] = d;
    const L = lodLevel(w, h, needPx === undefined ? w * S : needPx);
    return getLod(dk + '@' + L, w, h, Math.pow(2, L), fn);
  }
  const CAR_DEF = {
    taksi: [72, 44, () => sedan(0, true)], dolmus: [84, 64, dolmus], otobus: [116, 96, otobus], kamyon: [108, 88, kamyon], motor: [32, 48, motor],
  };
  // araç çizimleri kendi tuvalini kurar; istenen ölçekte kurulsun diye S geçici olarak değiştirilir
  function withScale(s, fn) { const old = S; S = s; try { return fn(); } finally { S = old; } }
  function carCanvas(kind, color, scale) {
    return withScale(scale, () => {
      switch (kind) {
        case 'taksi': return sedan(0, true);
        case 'dolmus': return dolmus();
        case 'otobus': return otobus();
        case 'kamyon': return kamyon();
        case 'motor': return motor();
        default: return sedan(color, false);
      }
    });
  }
  function car(kind, color, needPx) {
    const [w, h] = CAR_DEF[kind] || [72, 44];
    const L = lodLevel(w, h, needPx === undefined ? w * S : needPx);
    const key = 'c:' + kind + ':' + (CAR_DEF[kind] ? '' : color) + '@' + L;
    let c = lod.get(key);
    if (c) { lod.delete(key); lod.set(key, c); return c; }
    c = carCanvas(kind, color, Math.pow(2, L));
    lod.set(key, c); lodPx += c.width * c.height;
    while (lodPx > LOD_BUDGET && lod.size > 1) { const k0 = lod.keys().next().value; const c0 = lod.get(k0); lodPx -= c0.width * c0.height; lod.delete(k0); }
    return c;
  }
  function player(turn, brake, color) { return getScaled(`p:${turn}:${brake ? 1 : 0}:${color}`, () => playerCar(turn, brake, color)); }

  // uzak kıyı panoraması (ufkun üstünde, 1024 birim, yatayda tekrarlar)
  function minaret(g, x, by, h, w, col) {
    poly(g, [x - w / 2, by, x + w / 2, by, x + w * 0.4, by - h + w * 3, x - w * 0.4, by - h + w * 3], col, null);
    rect(g, x - w * 0.85, by - h * 0.62, w * 1.7, Math.max(0.6, w * 0.5), col);
    poly(g, [x - w / 2, by - h + w * 3, x + w / 2, by - h + w * 3, x, by - h], col, null);
  }
  function domeShape(g, cx, by, r, col) { g.beginPath(); g.ellipse(cx, by, r, r * 0.9, 0, Math.PI, 0); g.closePath(); g.fillStyle = col; g.fill(); }
  function panorama(time, seed) {
    return getScaled('pan:' + time + ':' + seed, () => {
      const T = TIMES[time], r = rng(seed * 97 + 13);
      const W = 1024, H = 72;
      return mk(W, H, (g) => {
        // arka tepeler
        g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 4) { const h = 28 + Math.sin(x / W * Math.PI * 4 + seed) * 10 + Math.sin(x / W * Math.PI * 10 + seed * 2) * 5; g.lineTo(x, H - h); }
        g.lineTo(W, H); g.closePath(); g.fillStyle = T.shore2; g.fill();
        // tepelerdeki evler
        for (let x = 0; x < W; x += 3 + r() * 3) {
          const h = 28 + Math.sin(x / W * Math.PI * 4 + seed) * 10 + Math.sin(x / W * Math.PI * 10 + seed * 2) * 5;
          const hw = 2 + r() * 2.4, hh = 1.6 + r() * 2.4;
          rect(g, x, H - h + 1.2 - hh, hw, hh + 3, mix(T.shore2, T.shore, 0.45));
          if (T.lights && r() < T.lights * 0.6) rect(g, x + hw * 0.4, H - h + 1.2 - hh * 0.5, 0.7, 0.7, '#ffe0a0');
        }
        // kıyıdaki binalar
        let x = 0;
        while (x < W) {
          const w = 6 + r() * 12, h = 6 + r() * 16;
          rect(g, x, H - h, w, h, T.shore);
          rect(g, x - 0.4, H - h - 0.8, w + 0.8, 1, mix(T.shore, '#000000', 0.15));
          if (T.lights) for (let k = 0; k < w * h / 16; k++) if (r() < T.lights) rect(g, x + 1 + r() * (w - 2), H - h + 1.5 + r() * (h - 2), 0.8, 0.8, r() < 0.5 ? '#ffd27a' : '#fff0b0');
          x += w + r() * 2.4;
        }
        // camiler ve servi ağaçları
        for (let k = 0; k < 6; k++) {
          const cx = 40 + r() * (W - 80), base = H - 8, rd = 7 + r() * 6;
          rect(g, cx - rd - 4, base - 10, rd * 2 + 8, 10, T.shore);
          domeShape(g, cx, base - 9.5, rd, T.shore);
          domeShape(g, cx - rd - 2, base - 9.5, rd * 0.45, T.shore); domeShape(g, cx + rd + 2, base - 9.5, rd * 0.45, T.shore);
          rect(g, cx - 0.3, base - 9.5 - rd * 0.9 - 3, 0.6, 3, T.shore);
          const mh = 30 + rd;
          minaret(g, cx - rd - 8, base, mh, 2, T.shore); minaret(g, cx + rd + 8, base, mh, 2, T.shore);
          if (r() < 0.5) { minaret(g, cx - rd - 14, base, mh * 0.8, 1.8, T.shore); minaret(g, cx + rd + 14, base, mh * 0.8, 1.8, T.shore); }
        }
        for (let k = 0; k < 18; k++) { const cx = r() * W, h = 8 + r() * 8; ell(g, cx, H - 4 - h / 2, 1.6, h / 2, mix(T.shore, '#1a3a24', 0.25), null); }
      });
    });
  }
  // bulutlar
  function clouds(time) {
    return getScaled('cl:' + time, () => {
      const r = rng(time * 5 + 1);
      const col = time === 3 ? 'rgba(255,176,150,0.7)' : time === 2 ? 'rgba(255,244,228,0.85)' : 'rgba(255,255,255,0.92)';
      const sh = time === 3 ? 'rgba(170,90,110,0.45)' : time === 2 ? 'rgba(220,180,150,0.45)' : 'rgba(170,200,230,0.5)';
      return mk(1024, 70, (g) => {
        for (let k = 0; k < 9; k++) {
          const x = 40 + r() * 944, y = 18 + r() * 38, w = 34 + r() * 56;
          const puffs = [[x - w * 0.36, y, w * 0.2], [x - w * 0.12, y - w * 0.12, w * 0.26], [x + w * 0.16, y - w * 0.06, w * 0.22], [x + w * 0.38, y + w * 0.02, w * 0.16]];
          g.fillStyle = sh; g.beginPath(); for (const [px, py, pr] of puffs) { g.moveTo(px + pr, py + 2); g.arc(px, py + 2, pr, 0, Math.PI * 2); } g.rect(x - w * 0.36, y + 2, w * 0.74, w * 0.18); g.fill();
          g.fillStyle = col; g.beginPath(); for (const [px, py, pr] of puffs) { g.moveTo(px + pr, py); g.arc(px, py, pr, 0, Math.PI * 2); } g.rect(x - w * 0.36, y, w * 0.74, w * 0.18); g.fill();
        }
      });
    });
  }

  // nesnelerin dünya genişliği (yarı yol genişliği cinsinden)
  const SIZE = {
    lamba: 0.16, korkuluk: 0.55, cinar: 1.4, agac: 1.2, servi: 0.45, apartman: 2.6, yali: 3.2, cami: 4.8, hisar: 1.9, kale: 4.5, saray: 6,
    kiz_kulesi: 2.6, tekne: 1.3, vapur: 4.6, balikci: 0.5, simitci: 0.55, durak: 1.3, semsiye: 0.95, tabela: 1.3, ayrim: 3.2,
    kopru_kule: 2.95, kopru_uzak: 18, basla: 2.6, kontrol: 2.6, bitis: 2.6, aski: 0.03,
  };
  const CAR_SIZE = { araba: 0.42, taksi: 0.42, dolmus: 0.52, otobus: 0.72, kamyon: 0.72, motor: 0.2 };

  function setScale(s) { if (Math.abs(s - S) < 1e-6) return; S = s; scaled.clear(); }
  function clearAll() { scaled.clear(); lod.clear(); lodPx = 0; defCache.clear(); }

  root.BY_ART = {
    K, mk, rr, box, circ, ell, poly, line, rect, lgrad, archWin, shade, mix, rng, label, textW, FONT,
    TIMES, panorama, clouds, sprite, car, player, SIZE, CAR_SIZE, CAR_COLORS, setScale, clearAll, get S() { return S; },
    set LW(v) { LW = v; }, get LW() { return LW; },
  };
})(window);
