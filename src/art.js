// Boğaz Yolu — çizimler: araba, trafik, yol kenarı nesneleri, gün saatine göre renkler ve arka planlar.
// Hepsi kodla çizilmiş çizgi film tarzı vektör resimlerdir. Her nesne, ekranda göründüğü boyuta göre
// kademeli (2'nin kuvvetleri) çözünürlükte önbelleğe alınır: uzaktaki ağaç küçük, yakındaki büyük çizilir.
(function (root) {
  'use strict';
  const K = '#1c1626';
  // Gece çizimi: NIGHT doluyken pencerelerin bir kısmı ışıklı (LIT) çizilir; sonra nightPass ışıkların dışını karartır.
  let NIGHT = null;
  const LIT = '#ffd37d';
  const nl = (fill, p) => (NIGHT && NIGHT() < (p || 0.5) ? LIT : fill);
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
  // polis arabası: beyaz, mavi şerit, tavanda çakar. ph: hangi lamba yanıyor (0 kırmızı, 1 mavi)
  function polis(ph) {
    return mk(72, 52, (g) => {
      LW = 1.5;
      const body = '#f4f6fa', dark = '#a8b0bc', light = '#ffffff';
      for (const x of [4, 54]) box(g, x, 37, 14, 13, 3, '#26222c');
      box(g, 2, 29, 68, 15, 5, dark);
      box(g, 25, 33, 22, 8, 1.4, '#f6f6f2', K, 1); rect(g, 25.6, 33.6, 3, 6.8, '#2a5ad8');
      box(g, 3, 20, 66, 12, 5, lgrad(g, 0, 20, 0, 32, [[0, light], [0.4, body], [1, '#dde2ea']]));
      rect(g, 3.6, 26, 64.8, 4, '#1e4aa8');
      label(g, 'POLİS', 36, 28.2, 4.4, '#ffffff');
      for (const x of [5.5, 52]) box(g, x, 22, 14.5, 4.4, 2.2, '#c81818', K, 1);
      poly(g, [12, 21, 60, 21, 54, 12.4, 18, 12.4], body);
      poly(g, [15, 20, 57, 20, 52, 14.2, 20, 14.2], lgrad(g, 0, 14, 0, 20, [[0, '#5a7aa6'], [1, '#2a3a58']]), K, 1);
      // çakar
      box(g, 20, 6, 32, 7, 2, '#3a3e48');
      const red = ph === 0, blue = ph === 1;
      box(g, 21.5, 7.2, 13.5, 4.6, 1.6, red ? '#ff4a3a' : '#7a2020', null);
      box(g, 37, 7.2, 13.5, 4.6, 1.6, blue ? '#4a8aff' : '#1e2e6a', null);
      if (red) rect(g, 23, 7.8, 5, 1.4, 'rgba(255,255,255,0.8)');
      if (blue) rect(g, 39, 7.8, 5, 1.4, 'rgba(255,255,255,0.8)');
      g.save(); g.globalCompositeOperation = 'lighter';
      const cx = red ? 28 : 44, gr = g.createRadialGradient(cx, 9.5, 1, cx, 9.5, 16);
      gr.addColorStop(0, red ? 'rgba(255,80,60,0.75)' : 'rgba(80,140,255,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(cx - 16, 0, 32, 26);
      g.restore();
    });
  }
  // motosiklet ve polis motosikleti (arkadan, sürücüsüyle). col: mont rengi; ph: polis ise çakar
  const JACKET = ['#2a2a34', '#c8302a', '#2a5ad8', '#e8a020', '#2a8a5a'];
  function motosiklet(col, police, ph) {
    return mk(34, 56, (g) => {
      LW = 1.3;
      box(g, 14, 42, 6, 14, 2.5, '#26222c');
      box(g, 9, 34, 16, 12, 3, police ? '#f4f6fa' : '#3a3e48');
      box(g, 12.5, 38.5, 9, 3, 1.2, '#ff5a4a', null);
      if (police) { box(g, 4, 30, 26, 8, 2, '#f4f6fa'); rect(g, 4.5, 33, 25, 2.4, '#1e4aa8'); }
      // sürücü
      const jc = police ? '#1e2e5a' : JACKET[col % JACKET.length];
      box(g, 8, 16, 18, 20, 5, jc);
      if (police) rect(g, 8.5, 26, 17, 3, '#e8e04a');
      box(g, 3, 20, 7, 4, 2, jc); box(g, 24, 20, 7, 4, 2, jc);
      circ(g, 4, 23, 2.4, '#26222c'); circ(g, 30, 23, 2.4, '#26222c');
      ell(g, 17, 10, 7, 7.4, police ? '#f4f6fa' : ['#f4f4f0', '#26222c', '#c8302a', '#2a2a34', '#e8a020'][col % 5]);
      box(g, 11, 9, 12, 3, 1.2, '#3a4a64', null);
      if (police) {
        box(g, 11, 0, 12, 4, 1.4, '#3a3e48');
        box(g, 11.8, 0.6, 5, 2.8, 1, ph === 0 ? '#ff4a3a' : '#7a2020', null);
        box(g, 17.2, 0.6, 5, 2.8, 1, ph === 1 ? '#4a8aff' : '#1e2e6a', null);
      }
    });
  }
  // elektrikli kiralık scooter (markasız) ve ayakta sürücüsü
  const SHIRT = ['#e8763a', '#2aa49a', '#6a4aa8', '#d84a6a', '#4a7ad8'];
  function scooter(col) {
    return mk(24, 60, (g) => {
      LW = 1.2;
      box(g, 9.5, 48, 5, 12, 2, '#26222c');
      box(g, 6, 44, 12, 5, 2, '#2ab07a');
      rect(g, 6.5, 45.4, 11, 1.6, '#e8f8ef');
      line(g, 12, 44, 12, 22, '#5a6070', 1.8);
      box(g, 2, 19, 20, 3, 1.4, '#3a3e48');
      // sürücü (ayakta)
      box(g, 7.5, 34, 4, 12, 1.6, '#3a4a64'); box(g, 12.5, 34, 4, 12, 1.6, '#3a4a64');
      box(g, 6, 16, 12, 20, 4, SHIRT[col % SHIRT.length]);
      box(g, 7, 17, 10, 9, 3, shade(SHIRT[col % SHIRT.length], -0.2), null);
      circ(g, 12, 10, 5.4, '#4a3428');
      box(g, 6.5, 3.4, 11, 5, 2.4, '#f4f4f0');
    });
  }
  // bisikletli (arkadan): ince tekerlek, sırt çantası, kask
  function bisiklet(col) {
    return mk(26, 60, (g) => {
      LW = 1.2;
      ell(g, 13, 52, 2.6, 8, '#26222c'); ell(g, 13, 52, 1, 6, '#6a707c', null);
      line(g, 13, 44, 13, 34, '#c8302a', 1.8);
      box(g, 9, 31, 8, 3.4, 1.4, '#26222c');
      box(g, 8, 40, 4, 10, 1.6, '#2a2a34'); box(g, 14, 38, 4, 10, 1.6, '#2a2a34');
      box(g, 6, 14, 14, 20, 5, SHIRT[(col + 2) % SHIRT.length]);
      box(g, 8, 18, 10, 12, 3, '#3a3e48');
      line(g, 9, 19, 9, 29, '#5a5e68', 1); line(g, 17, 19, 17, 29, '#5a5e68', 1);
      box(g, 0.5, 16, 6, 3.4, 1.6, SHIRT[(col + 2) % SHIRT.length]); box(g, 19.5, 16, 6, 3.4, 1.6, SHIRT[(col + 2) % SHIRT.length]);
      circ(g, 13, 9, 5.4, '#f1b98f');
      g.beginPath(); g.ellipse(13, 7.6, 6.6, 5, 0, Math.PI, 0); g.closePath(); F(g, ['#f4c531', '#2a8a5a', '#e8343a', '#2a5ad8', '#f4f4f0'][col % 5]);
    });
  }
  function metrobus() {
    return mk(120, 100, (g) => {
      LW = 1.7;
      for (const x of [8, 94]) box(g, x, 88, 18, 11, 3, '#26222c');
      box(g, 2, 4, 116, 88, 10, '#f2f4f8');
      g.save(); rr(g, 2, 4, 116, 88, 10); g.clip();
      rect(g, 2, 54, 116, 7, '#d8282a'); rect(g, 2, 63, 116, 3, '#f4a020');
      rect(g, 2, 80, 116, 12, '#3a3e48');
      g.restore(); rr(g, 2, 4, 116, 88, 10); F(g, null);
      box(g, 9, 16, 102, 30, 5, lgrad(g, 0, 16, 0, 46, [[0, '#4a628a'], [1, '#22304a']]), K, 1.2);
      poly(g, [18, 44, 26, 44, 40, 18, 32, 18], 'rgba(255,255,255,0.25)', null);
      box(g, 30, 6, 60, 9, 2, '#141018', K, 1.2); label(g, '34 AVCILAR', 60, 10.8, 5.8, '#ffb030');
      for (const x of [6, 102]) { box(g, x, 68, 12, 9, 3, '#c81818', K, 1.1); }
      box(g, 44, 70, 32, 8, 1.4, '#f6f6f2', K, 1);
      label(g, 'METROBÜS', 60, 50.2, 6.4, '#2a2a3a');
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
        box(g, x + 1, y + 1, 16, 14, 0.6, r() < 0.18 ? '#f6e2a2' : nl(lgrad(g, 0, y, 0, y + 15, [[0, '#7a96bc'], [1, '#3e4e6c']])), null);
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

  // ---------------- İstanbul Turu ----------------
  // taş ve tuğla sıralı tarihi sur parçası, köşesinde burç
  OBJ.sur = [180, 80, (g) => {
    LW = 1.8;
    const st = '#d6c4a0', sh = '#a8946e', br = '#b8684c';
    const courses = (x, w, y0, y1) => {
      g.save(); g.beginPath(); g.rect(x, y0, w, y1 - y0); g.clip();
      for (let y = y0 + 8; y < y1; y += 16) { rect(g, x, y, w, 2.4, br); rect(g, x, y + 3.4, w, 2, br); }
      g.strokeStyle = 'rgba(110,90,60,0.35)'; g.lineWidth = 0.7;
      const r = rng(Math.round(x + y0));
      for (let y = y0 + 4; y < y1; y += 5) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); for (let k = x + r() * 8; k < x + w; k += 9 + r() * 6) { g.beginPath(); g.moveTo(k, y); g.lineTo(k, y + 5); g.stroke(); } }
      g.restore();
    };
    // sur duvarı
    box(g, 44, 36, 136, 44, 1, lgrad(g, 0, 36, 0, 80, [[0, shade(st, 0.08)], [1, sh]]));
    courses(44, 136, 36, 80);
    box(g, 44, 36, 136, 44, 1, null);
    for (let x = 48; x < 176; x += 12) box(g, x, 29, 7, 9, 1, st);
    rect(g, 45, 36.6, 134, 2, shade(st, 0.2));
    // burç
    box(g, 4, 12, 46, 68, 1, lgrad(g, 4, 0, 50, 0, [[0, shade(st, 0.12)], [0.7, st], [1, sh]]));
    courses(4, 46, 12, 80);
    box(g, 4, 12, 46, 68, 1, null);
    for (let x = 5; x < 48; x += 10) box(g, x, 5, 6, 9, 1, st);
    archWin(g, 21, 28, 10, 16, '#3a2c24', K);
    box(g, 2, 11, 50, 4, 1.4, shade(st, -0.08));
    // dibinde otlar
    for (const [x, rr0] of [[60, 6], [82, 4.5], [120, 7], [160, 5], [12, 5], [44, 4.5]]) circ(g, x, 80, rr0, '#5e9a3a', K, 1.2);
  }];
  // yeşil tepe (tarihi yarımadanın sırtı): ağaçlar ve birkaç ev; üstüne yapı oturur
  function hillBase(g, w, y0, h) {
    g.beginPath(); g.moveTo(0, y0 + h); g.lineTo(0, y0 + 10); g.bezierCurveTo(w * 0.2, y0 - 4, w * 0.8, y0 - 4, w, y0 + 10); g.lineTo(w, y0 + h); g.closePath();
    F(g, lgrad(g, 0, y0, 0, y0 + h, [[0, '#5e9a3e'], [1, '#3e7a32']]));
    const r = rng(w + h);
    for (let i = 0; i < 9; i++) { const x = 8 + r() * (w - 16), y = y0 + 16 + r() * (h - 24); box(g, x, y, 12 + r() * 8, 9 + r() * 5, 1, ['#e8c8a0', '#f0dcb0', '#d8b8b0'][i % 3], K, 1.1); }
    for (let i = 0; i < 12; i++) circ(g, 6 + r() * (w - 12), y0 + 8 + r() * (h - 10), 5 + r() * 5, r() < 0.5 ? '#4e8a36' : '#5e9a3e', K, 1.1);
  }
  // Ayasofya: alçak geniş kubbe, yarım kubbeler, payandalar, dört minare
  OBJ.ayasofya = [240, 214, (g) => {
    LW = 1.8;
    hillBase(g, 240, 164, 50);
    const wall = '#e9b690', wallD = '#c88d66', lead = '#8794a8', leadL = '#aab6c6';
    const mina = (x, top, w, col) => {
      poly(g, [x - w / 2, 170, x + w / 2, 170, x + w * 0.42, top + 26, x - w * 0.42, top + 26], col);
      for (const y of [top + 60, top + 36]) box(g, x - w * 0.8, y, w * 1.6, 4, 1.4, col);
      poly(g, [x - w * 0.42, top + 26, x + w * 0.42, top + 26, x, top], lead);
      line(g, x, top, x, top - 5, '#c8a020', 1.2);
    };
    mina(14, 10, 8, '#f0e8dc'); mina(226, 10, 8, '#f0e8dc');
    mina(40, 34, 10, '#d8936c'); mina(200, 34, 10, '#d8936c');
    // payandalar ve gövde
    box(g, 50, 108, 140, 62, 1, lgrad(g, 0, 108, 0, 170, [[0, wall], [1, wallD]]));
    for (const x of [50, 178]) poly(g, [x, 170, x + 12, 170, x + 12, 80, x + 3, 86], wallD);
    for (let x = 64; x < 180; x += 16) archWin(g, x, 124, 8, 16, '#4a4a64', K);
    archWin(g, 110, 140, 20, 30, '#5a4030', K);
    box(g, 66, 92, 108, 18, 1, wall);
    // yarım kubbeler
    for (const cx of [84, 156]) {
      g.beginPath(); g.ellipse(cx, 94, 24, 18, 0, Math.PI, 0); g.closePath(); F(g, lead);
      g.save(); g.clip(); ell(g, cx - 8, 84, 8, 7, leadL, null); g.restore();
    }
    // kasnak ve ana kubbe
    box(g, 84, 70, 72, 24, 1, wall);
    for (let x = 88; x < 152; x += 7) archWin(g, x, 76, 3.4, 9, '#4a4a64');
    g.beginPath(); g.ellipse(120, 72, 46, 34, 0, Math.PI, 0); g.closePath(); F(g, lead);
    g.save(); g.clip();
    ell(g, 104, 54, 16, 12, leadL, null, 0, -0.4);
    g.strokeStyle = 'rgba(40,50,70,0.35)'; g.lineWidth = 0.8;
    for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(120, 38); g.quadraticCurveTo(120 + k * 9, 46, 120 + k * 11.4, 72); g.stroke(); }
    g.restore();
    line(g, 120, 38, 120, 30, '#c8a020', 1.4);
  }];
  // Sultanahmet Camii: basamak basamak kubbeler, altı minare
  OBJ.sultanahmet = [260, 222, (g) => {
    LW = 1.8;
    hillBase(g, 260, 170, 52);
    const st = '#e8e6e0', sh = '#c8c6c0', lead = '#7f8ca4', leadL = '#a4b0c4';
    const mina = (x, top, w) => {
      poly(g, [x - w / 2, 176, x + w / 2, 176, x + w * 0.4, top + 24, x - w * 0.4, top + 24], st);
      rect(g, x + w * 0.1, top + 25, w * 0.28, 176 - top - 26, sh);
      for (const y of [top + 34, top + 62, top + 90]) if (y < 150) box(g, x - w * 0.85, y, w * 1.7, 3.6, 1.4, st);
      poly(g, [x - w * 0.4, top + 24, x + w * 0.4, top + 24, x, top], lead);
      line(g, x, top, x, top - 5, '#c8a020', 1.2);
    };
    mina(8, 24, 6); mina(252, 24, 6);
    mina(30, 6, 7); mina(230, 6, 7); mina(62, 6, 7); mina(198, 6, 7);
    const dome = (cx, by, r, ry) => {
      g.beginPath(); g.ellipse(cx, by, r, ry, 0, Math.PI, 0); g.closePath(); F(g, lead);
      g.save(); g.clip(); ell(g, cx - r * 0.4, by - ry * 0.55, r * 0.34, ry * 0.45, leadL, null, 0, -0.4); g.restore();
      line(g, cx, by - ry, cx, by - ry - Math.max(4, r * 0.18), '#c8a020', 1.2);
    };
    // avlu duvarı ve gövde
    box(g, 14, 140, 232, 36, 1, st);
    for (let x = 22; x < 240; x += 14) archWin(g, x, 150, 8, 16, '#4a5a7a', K);
    box(g, 70, 112, 120, 30, 1, st);
    for (let x = 78; x < 184; x += 13) archWin(g, x, 118, 6, 14, '#4a5a7a', K);
    for (const cx of [26, 52, 78, 182, 208, 234]) dome(cx, 141, 9, 8);
    // yarım kubbeler ve köşe kubbeleri
    for (const cx of [86, 174]) dome(cx, 113, 14, 12);
    for (const cx of [104, 156]) dome(cx, 101, 22, 18);
    box(g, 98, 82, 64, 20, 1, st);
    for (let x = 102; x < 158; x += 7) archWin(g, x, 87, 3.4, 9, '#4a5a7a');
    dome(130, 84, 40, 32);
  }];
  // Galata Kulesi: silindir taş gövde, seyir balkonu, konik külah
  OBJ.galata_kulesi = [70, 196, (g) => {
    LW = 1.8;
    const st = '#cbb58c', sh = '#9c8660';
    poly(g, [10, 196, 60, 196, 56, 52, 14, 52], lgrad(g, 10, 0, 60, 0, [[0, shade(st, 0.18)], [0.55, st], [1, sh]]));
    g.save(); g.beginPath(); g.moveTo(10, 196); g.lineTo(60, 196); g.lineTo(56, 52); g.lineTo(14, 52); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(100,80,50,0.35)'; g.lineWidth = 0.8;
    for (let y = 58; y < 196; y += 6) { g.beginPath(); g.moveTo(8, y); g.lineTo(62, y); g.stroke(); }
    g.restore();
    poly(g, [10, 196, 60, 196, 56, 52, 14, 52], null);
    for (const y of [80, 112, 144]) archWin(g, 31, y, 8, 14, '#3a3040', K);
    archWin(g, 28, 176, 14, 20, '#4a3428', K);
    // seyir katı
    box(g, 9, 44, 52, 10, 1.4, shade(st, 0.1));
    box(g, 12, 26, 46, 19, 1, '#e8dcc4');
    for (let k = 0; k < 5; k++) archWin(g, 15 + k * 8.6, 29, 5.4, 13, '#3e5476');
    box(g, 8, 22, 54, 5, 1.4, shade(st, -0.05));
    poly(g, [6, 23, 64, 23, 35, -16], lgrad(g, 6, 0, 64, 0, [[0, '#6e7c90'], [0.4, '#a2aec0'], [1, '#5a687c']]));
    line(g, 35, -16, 35, -24, '#c8a020', 1.4);
  }];
  // Çamlıca Kulesi: ince gövde, lale biçimli yayın katları, anten
  OBJ.camlica_kulesi = [80, 300, (g) => {
    LW = 1.8;
    const c = '#eef0f2', d = '#b8bec8';
    poly(g, [30, 300, 50, 300, 46, 120, 34, 120], lgrad(g, 30, 0, 50, 0, [[0, '#ffffff'], [0.6, c], [1, d]]));
    // lale gövdesi
    g.beginPath(); g.moveTo(34, 128); g.bezierCurveTo(12, 110, 10, 80, 22, 52); g.lineTo(58, 52); g.bezierCurveTo(70, 80, 68, 110, 46, 128); g.closePath();
    F(g, lgrad(g, 10, 0, 70, 0, [[0, '#ffffff'], [0.55, c], [1, d]]));
    g.save(); g.clip();
    for (const [y, h] of [[62, 6], [78, 5], [92, 4]]) rect(g, 0, y, 80, h, '#3e5a80');
    rect(g, 0, 63, 80, 1.4, 'rgba(255,255,255,0.5)');
    g.restore();
    box(g, 20, 46, 40, 8, 2, c);
    poly(g, [28, 47, 52, 47, 44, 18, 36, 18], c);
    line(g, 40, 18, 40, 0, '#8a8e98', 2.2);
    circ(g, 40, 1, 2, '#ff4a3a', null);
  }];
  // Çamlıca Camii: büyük kubbe, altı minare (uzaktan, tepede)
  OBJ.camlica_camii = [260, 190, (g) => {
    LW = 1.8;
    const st = '#f2eee6', sh = '#d0cabc', lead = '#8a96aa', leadL = '#b0bccc';
    const mina = (x, top) => {
      poly(g, [x - 3.4, 190, x + 3.4, 190, x + 2.8, top + 22, x - 2.8, top + 22], st);
      for (const y of [top + 40, top + 70, top + 100]) box(g, x - 6, y, 12, 3.6, 1.4, st);
      poly(g, [x - 2.8, top + 22, x + 2.8, top + 22, x, top], lead);
    };
    for (const [x, t] of [[10, 10], [36, 2], [60, 18], [200, 18], [224, 2], [250, 10]]) mina(x, t);
    box(g, 66, 128, 128, 62, 1, st);
    for (let x = 74; x < 188; x += 15) archWin(g, x, 140, 8, 22, '#4a5a7a', K);
    const dome = (cx, by, r, ry) => {
      g.beginPath(); g.ellipse(cx, by, r, ry, 0, Math.PI, 0); g.closePath(); F(g, lead);
      g.save(); g.clip(); ell(g, cx - r * 0.4, by - ry * 0.55, r * 0.34, ry * 0.45, leadL, null, 0, -0.4); g.restore();
      line(g, cx, by - ry, cx, by - ry - Math.max(4, r * 0.18), '#c8a020', 1.2);
    };
    for (const cx of [86, 174]) dome(cx, 129, 18, 16);
    box(g, 92, 96, 76, 34, 1, st);
    for (let x = 97; x < 164; x += 8) archWin(g, x, 104, 4, 12, '#4a5a7a');
    dome(130, 98, 46, 40);
    rect(g, 66, 186, 128, 4, sh);
  }];
  // otoyol çelik bariyeri
  OBJ.bariyer = [64, 22, (g) => {
    LW = 1.2;
    for (const x of [6, 54]) box(g, x, 6, 4, 16, 0.8, '#5a606c');
    box(g, 0, 5, 64, 9, 2, lgrad(g, 0, 5, 0, 14, [[0, '#f2f4f6'], [0.45, '#b8bec8'], [0.55, '#9aa2ae'], [1, '#d8dce2']]));
    line(g, 1, 9.5, 63, 9.5, '#8a929e', 0.8);
    for (const x of [7, 55]) box(g, x - 0.4, 8, 3.4, 3, 0.8, x === 7 ? '#e83a2a' : '#f4f4f0', K, 0.7);
  }];
  // otoyol aydınlatma direği
  OBJ.otoyol_lamba = [40, 160, (g) => {
    LW = 1.4;
    const c = '#8a909c';
    box(g, 6, 150, 12, 10, 2, '#6a707c');
    poly(g, [10, 152, 14, 152, 13.2, 24, 10.8, 24], c);
    g.strokeStyle = K; g.lineWidth = 3.4; g.beginPath(); g.moveTo(12, 26); g.quadraticCurveTo(12.6, 14, 30, 14); g.stroke();
    g.strokeStyle = c; g.lineWidth = 1.8; g.stroke();
    box(g, 24, 11, 15, 6, 2.4, '#5a606c');
    box(g, 26, 16, 11, 2.4, 1, '#fff6c8', null);
  }];
  // Avrasya Tüneli'nin ağzı: beton çerçeve, yazı bandı, üstünde yeşil tepe. Ortası boştur (tünelin içi görünür).
  // 50 birim = yarım yol genişliği; ağzın ölçüleri render.js'teki tünel kesitiyle aynıdır.
  OBJ.tunel_agzi = [600, 150, (g) => {
    LW = 2.2;
    const PX = 50, H0 = 150, k = 0.5625 * PX / 2000;
    const hW = 0.58 * 3400 * k, hT = 3400 * k;
    const op = [300 - 1.25 * PX, H0, 300 - 1.25 * PX, H0 - hW, 300 - 0.82 * PX, H0 - hT, 300 + 0.82 * PX, H0 - hT, 300 + 1.25 * PX, H0 - hW, 300 + 1.25 * PX, H0];
    // tepe
    g.beginPath(); g.moveTo(0, H0); g.lineTo(0, 70); g.bezierCurveTo(90, 30, 200, 12, 300, 14); g.bezierCurveTo(400, 12, 510, 30, 600, 70); g.lineTo(600, H0); g.closePath();
    F(g, lgrad(g, 0, 10, 0, H0, [[0, '#6aaa4a'], [1, '#3e7a32']]));
    const r = rng(5);
    for (let i = 0; i < 26; i++) { const x = 20 + r() * 560, y = 40 + r() * 30 + Math.abs(x - 300) * 0.08; circ(g, x, y, 7 + r() * 8, r() < 0.5 ? '#4e8a36' : '#5e9a3e', K, 1.2); }
    // istinat duvarları
    poly(g, [120, H0, 196, H0, 214, 56, 160, 64], '#c9c4ba');
    poly(g, [480, H0, 404, H0, 386, 56, 440, 64], '#c9c4ba');
    // ön yüz
    box(g, 196, 40, 208, 110, 3, lgrad(g, 0, 40, 0, 150, [[0, '#e6e2da'], [1, '#bcb6aa']]));
    box(g, 204, 46, 192, 24, 3, '#1e4a8a');
    label(g, 'AVRASYA TÜNELİ', 300, 58.6, 15, '#ffffff');
    // ağzın çerçevesi
    poly(g, op.map((v, i) => (i % 2 ? v - (v === H0 ? 0 : 5) : v + (v < 300 ? -6 : 6))), '#8a8478');
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(op[0], op[1]); for (let i = 2; i < op.length; i += 2) g.lineTo(op[i], op[i + 1]); g.closePath(); g.fill();
    g.restore();
    // yeşil-sarı ışıklar
    for (const x of [222, 378]) { circ(g, x, 84, 4, '#7cff6a', K, 1.2); circ(g, x, 96, 4, '#3a3a40', K, 1.2); }
  }];
  // tünel duvarındaki levhalar: SOS dolabı ya da "deniz altındasın"
  function tunelLevha(v) {
    return [64, 64, (g) => {
      LW = 1.4;
      if (v === 1) {
        box(g, 2, 8, 60, 34, 3, '#1e4a8a');
        box(g, 5, 11, 54, 28, 2, null, '#f4f0e0', 1);
        label(g, 'DENİZ ALTI', 32, 20, 9, '#ffffff');
        label(g, '−106 m', 32, 31, 10, '#9af4e4');
      } else {
        box(g, 8, 10, 48, 32, 3, '#f4f4f0');
        box(g, 8, 10, 48, 11, 3, '#2a8a4a');
        label(g, 'SOS', 32, 16, 9, '#ffffff');
        box(g, 20, 25, 24, 13, 2, '#e8e8e4', K, 1);
        circ(g, 32, 31.5, 3.4, '#e83a2a', K, 1);
      }
    }];
  }
  // otoyol yaya üst geçidi (E-5: metrobüs yolunun da üstünden geçer)
  OBJ.ustgecit = [520, 150, (g) => {
    LW = 2;
    const conc = '#cfcac0', st = '#4f6f9c';
    // ayaklar ve merdivenler
    for (const x of [6, 202, 494]) box(g, x, 40, 20, 110, 2, lgrad(g, x, 0, x + 20, 0, [[0, shade(conc, 0.1)], [1, shade(conc, -0.15)]]));
    poly(g, [494, 150, 514, 150, 514, 52, 470, 52, 470, 58], '#a8a296');
    for (let k = 0; k < 8; k++) line(g, 474 + k * 5, 56 + k * 11.4, 514, 56 + k * 11.4, '#8a8478', 1.2);
    // köprü gövdesi: kafes ve camlar
    box(g, 0, 22, 520, 20, 2, st);
    g.save(); rr(g, 0, 22, 520, 20, 2); g.clip();
    for (let x = 4; x < 520; x += 16) { line(g, x, 22, x + 8, 42, '#2e4a74', 1.6); line(g, x + 8, 42, x + 16, 22, '#2e4a74', 1.6); }
    g.restore();
    box(g, -2, 40, 524, 6, 2, '#3a5680');
    box(g, -2, 4, 524, 6, 2, '#3a5680');
    for (let x = 4; x < 516; x += 26) box(g, x, 8, 3, 15, 1, '#3a5680', null);
    box(g, 0, 10, 520, 13, 1, 'rgba(180,220,240,0.35)', null);
    box(g, 210, 12, 100, 9, 2, '#f4c531', K, 1);
    label(g, 'METROBÜS', 260, 16.6, 7, '#2a1a10');
  }];
  // otoyol levha köprüsü: iki yeşil levha, yön okları çizilir
  function arrow(g, x, y, dir, s) {
    g.save(); g.translate(x, y); g.rotate(dir === 'ur' ? Math.PI / 4 : dir === 'r' ? Math.PI / 2 : dir === 'ul' ? -Math.PI / 4 : 0);
    poly(g, [0, -s, s * 0.75, -s * 0.15, s * 0.28, -s * 0.15, s * 0.28, s, -s * 0.28, s, -s * 0.28, -s * 0.15, -s * 0.75, -s * 0.15], '#ffffff', null);
    g.restore();
  }
  function levhaDef(labels) {
    return [360, 140, (g) => {
      LW = 2;
      for (const x of [4, 344]) box(g, x, 26, 12, 114, 2, '#9aa0aa');
      box(g, 0, 22, 360, 10, 2, '#8a909c');
      for (let x = 6; x < 354; x += 12) { line(g, x, 23, x + 6, 31, '#6a707c', 1); line(g, x + 6, 31, x + 12, 23, '#6a707c', 1); }
      labels.forEach((lb, i) => {
        const [t, dir] = lb.split('>');
        const x0 = 22 + i * 162;
        box(g, x0, 0, 154, 48, 4, '#1e7a4a');
        box(g, x0 + 4, 4, 146, 40, 2.4, null, '#f4f0e0', 1.2);
        let px = 15; while (textW(t, px) > 112 && px > 8) px -= 0.5;
        label(g, t, x0 + 14 + 56, 24.5, px, '#ffffff');
        if (dir) arrow(g, x0 + 138, 24, dir, 9);
      });
    }];
  }

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

  // ---------------- semtlere özgü yapılar ----------------
  // Çeşitli (v) ve yazılı (label) çizimler: VAR[k] = [g, y, çeşit sayısı, çiz(g, v)], LBL[k] = (yazı) → [g, y, çiz]
  const VAR = {}, LBL = {};
  const glass = (g, y0, y1, c0, c1) => lgrad(g, 0, y0, 0, y1, [[0, c0], [1, c1]]);
  const winC = (g, y) => nl(lgrad(g, 0, y, 0, y + 14, [[0, '#7a96bc'], [1, '#3e4e6c']]));
  // Ahşap Osmanlı evi: cumbalı, pastel boyalı (Üsküdar, Ortaköy, Sultanahmet)
  const WOOD = ['#e8a4a0', '#f2d27a', '#9ccbe0', '#a8d4a0', '#e6b07a', '#c8a8d8'];
  VAR.ahsap_ev = [120, 156, WOOD.length, (g, v) => {
    LW = 1.8;
    const c = WOOD[v], d = shade(c, -0.18), tr = '#fbf7ee';
    box(g, 6, 44, 108, 112, 1, c);
    g.save(); rr(g, 6, 44, 108, 112, 1); g.clip();
    g.strokeStyle = shade(c, -0.12); g.lineWidth = 0.8;
    for (let y = 48; y < 156; y += 5) { g.beginPath(); g.moveTo(6, y); g.lineTo(114, y); g.stroke(); }
    g.restore(); box(g, 6, 44, 108, 112, 1, null);
    for (const x of [6, 108]) rect(g, x + 0.8, 45, 5, 110, tr);
    // cumba
    box(g, 26, 60, 68, 46, 1, shade(c, 0.1));
    for (const x of [34, 76]) poly(g, [x, 106, x + 10, 106, x + 5, 116], d, K, 1.2);
    for (let k = 0; k < 3; k++) { const x = 32 + k * 20; box(g, x, 66, 15, 32, 1, tr, K, 1.2); box(g, x + 2.4, 68.4, 10.2, 27.2, 0.6, winC(g, 68), null); line(g, x + 7.5, 68, x + 7.5, 96, tr, 1); }
    rect(g, 26, 58, 68, 3, tr);
    // yan ve alt pencereler, kapı
    for (const x of [12, 98]) { box(g, x, 66, 10, 26, 1, tr, K, 1.1); box(g, x + 1.8, 68, 6.4, 22, 0.5, winC(g, 68), null); }
    for (const x of [16, 84]) { box(g, x, 122, 18, 22, 1, tr, K, 1.2); box(g, x + 2.4, 124.4, 13.2, 17.2, 0.5, winC(g, 124), null); }
    box(g, 50, 120, 20, 36, 2, shade(c, -0.35));
    circ(g, 66, 139, 1.4, '#e8c060', null);
    // kiremit çatı
    poly(g, [-2, 46, 122, 46, 104, 18, 16, 18], '#b5523a');
    g.strokeStyle = '#8e3a26'; g.lineWidth = 0.9;
    for (let y = 24; y < 46; y += 6) { g.beginPath(); g.moveTo(16 - (y - 18) * 0.64, y); g.lineTo(104 + (y - 18) * 0.64, y); g.stroke(); }
    box(g, 82, 4, 10, 16, 1, '#8a6a5a');
  }];
  // taş han: kemerli pencereler, altta dükkânlar (Eminönü, Sirkeci)
  const HAN_SHOP = ['KURUYEMİŞ', 'BAHARAT', 'LOKUM', 'KAHVE', 'ŞEKERCİ', 'ATTAR'];
  const HAN_ST = ['#cdb994', '#d9c9a8', '#c0a988'];
  VAR.han = [140, 172, 6, (g, v) => {
    LW = 1.8;
    const st = HAN_ST[v % 3], sh = shade(st, -0.2);
    box(g, 4, 20, 132, 152, 1, st);
    g.save(); rr(g, 4, 20, 132, 152, 1); g.clip();
    g.strokeStyle = 'rgba(110,90,60,0.32)'; g.lineWidth = 0.7;
    for (let y = 26; y < 136; y += 6) { g.beginPath(); g.moveTo(4, y); g.lineTo(136, y); g.stroke(); }
    for (let y = 46; y < 136; y += 36) { rect(g, 4, y, 132, 2.2, '#b8684c'); }
    g.restore(); box(g, 4, 20, 132, 152, 1, null);
    for (let f = 0; f < 3; f++) {
      const y = 28 + f * 36;
      for (let k = 0; k < 4; k++) archWin(g, 14 + k * 31, y, 18, 24, winC(g, y), K);
      rect(g, 4, y + 30, 132, 2.4, sh);
    }
    box(g, 0, 12, 140, 9, 2, sh);
    for (const x of [24, 108]) box(g, x, 2, 9, 11, 1, shade(st, -0.1));
    // dükkânlar
    box(g, 4, 136, 132, 36, 0, '#4a3a30');
    for (let k = 0; k < 3; k++) { const x = 10 + k * 42; archWin(g, x, 142, 36, 30, lgrad(g, 0, 142, 0, 172, [[0, '#ffd88a'], [1, '#c88a3a']]), K); }
    for (let k = 0; k < 6; k++) circ(g, 22 + k * 19, 168, 5.2, ['#c84a2a', '#e8b030', '#7a4a2a', '#d87a3a', '#a8c040', '#c86a5a'][(k + v) % 6], K, 1);
    box(g, 26, 124, 88, 13, 2, '#1c3a6a', K, 1.2);
    label(g, HAN_SHOP[v], 70, 130.8, 9, '#fff2c0');
  }];
  // Karaköy'ün neoklasik taş binaları: sütunlar, alınlıklı pencereler, ferforje balkonlar
  const KK_C = ['#e8dcc4', '#d6cabb', '#ecc8b0', '#cdd2d6'];
  const KK_SHOP = ['KAFE', 'BAKLAVA', 'LOKANTA', 'ANTİKA'];
  VAR.tas_bina = [128, 184, 4, (g, v) => {
    LW = 1.8;
    const c = KK_C[v], d = shade(c, -0.2);
    box(g, 4, 18, 120, 166, 1, c);
    for (const x of [4, 62, 118]) rect(g, x, 19, 6, 132, shade(c, 0.12));
    for (let f = 0; f < 4; f++) {
      const y = 28 + f * 30;
      rect(g, 4, y + 24, 120, 2.6, d);
      for (let k = 0; k < 3; k++) {
        const x = 16 + k * 36;
        box(g, x, y, 22, 20, 1, '#f6f0e4', K, 1.1); box(g, x + 2.4, y + 2.4, 17.2, 15.6, 0.5, winC(g, y), null);
        if (f % 2 === 0) poly(g, [x - 2, y, x + 24, y, x + 11, y - 6], '#f6f0e4', K, 1);
        else box(g, x - 2, y - 4, 26, 3.4, 1, '#f6f0e4', K, 1);
        if (f === 1 || f === 3) { line(g, x - 3, y + 19, x + 25, y + 19, K, 1.2); for (let q = x - 2; q < x + 25; q += 4) line(g, q, y + 15, q, y + 19, K, 0.7); }
      }
    }
    // korniş
    box(g, 0, 10, 128, 9, 1.4, d);
    for (let x = 3; x < 126; x += 6) rect(g, x, 18.5, 3, 2.6, shade(d, -0.15));
    // zemin kat: büyük kemerler, tente, tabela
    box(g, 4, 150, 120, 34, 0, shade(c, -0.08));
    for (let k = 0; k < 3; k++) archWin(g, 12 + k * 38, 154, 28, 30, lgrad(g, 0, 154, 0, 184, [[0, '#9ab8d4'], [1, '#4a6a8a']]), K);
    const aw = ['#2a6a5a', '#8a2a2a', '#2a4a8a', '#6a4a2a'][v];
    g.save(); rr(g, 8, 145, 112, 7, 2); g.clip();
    for (let x = 8; x < 122; x += 8) rect(g, x, 145, 4, 7, x % 16 < 8 ? aw : '#f6f2e4');
    g.restore(); rr(g, 8, 145, 112, 7, 2); F(g, null, K, 1.1);
    box(g, 38, 135, 52, 10, 2, aw, K, 1.1);
    label(g, KK_SHOP[v], 64, 140.4, 7, '#ffffff');
  }];
  // modern konut sitesi (Şile Otoyolu, E-5): beyaz yüksek blok, renkli balkonlar
  const SITE_C = ['#e8763a', '#2aa49a', '#4a7ad8', '#d84a6a'];
  VAR.site = [150, 210, 4, (g, v) => {
    LW = 1.8;
    const ac = SITE_C[v];
    box(g, 6, 14, 138, 196, 2, lgrad(g, 6, 0, 144, 0, [[0, '#ffffff'], [0.7, '#eceef2'], [1, '#c8ccd4']]));
    for (let f = 0; f < 11; f++) {
      const y = 22 + f * 16.6;
      for (let k = 0; k < 4; k++) {
        const x = 14 + k * 33;
        box(g, x, y, 24, 10, 0.8, nl(glass(g, y, y + 10, '#8ab0d4', '#4a6488'), 0.4), null);
        if (k === 1 || k === 2) box(g, x - 3, y + 9, 30, 4, 1, k === 1 ? ac : shade(ac, 0.3), K, 0.8);
      }
    }
    box(g, 2, 6, 146, 10, 2, shade(ac, -0.1));
    box(g, 60, 192, 30, 18, 2, '#4a5468');
  }];
  // rezidans kulesi: cam cephe
  VAR.rezidans = [84, 270, 3, (g, v) => {
    LW = 1.8;
    const cs = [['#8ad0d8', '#2a6a88'], ['#a8c4e8', '#3a5a9a'], ['#b8d8c8', '#3a7a6a']][v];
    poly(g, [8, 270, 76, 270, 76, 30, 8, 14], glass(g, 14, 270, cs[0], cs[1]));
    g.save(); g.beginPath(); g.moveTo(8, 270); g.lineTo(76, 270); g.lineTo(76, 30); g.lineTo(8, 14); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8;
    for (let y = 20; y < 270; y += 9) { g.beginPath(); g.moveTo(8, y); g.lineTo(76, y + 4); g.stroke(); }
    for (let x = 16; x < 76; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 270); g.stroke(); }
    poly(g, [8, 14, 30, 20, 30, 270, 8, 270], 'rgba(255,255,255,0.18)', null);
    if (NIGHT) for (let y = 24; y < 266; y += 9) for (let x = 9; x < 75; x += 10) if (NIGHT() < 0.3) rect(g, x, y + (x - 8) * 0.06, 8, 6, LIT);
    g.restore(); poly(g, [8, 270, 76, 270, 76, 30, 8, 14], null);
    line(g, 60, 26, 60, 4, '#8a909c', 1.6); circ(g, 60, 4, 1.8, '#ff4a3a', null);
  }];
  // ofis plazası
  const PLAZA_T = ['PLAZA', 'İŞ MERKEZİ', 'KULE'];
  VAR.plaza = [110, 240, 3, (g, v) => {
    LW = 1.8;
    box(g, 6, 30, 98, 210, 2, glass(g, 30, 240, ['#6a8aa8', '#7aa4a0', '#8a8ab0'][v], '#2a3a54'));
    g.save(); rr(g, 6, 30, 98, 210, 2); g.clip();
    for (let x = 14; x < 104; x += 12) rect(g, x, 30, 3, 210, 'rgba(230,236,244,0.55)');
    for (let y = 40; y < 240; y += 12) rect(g, 6, y, 98, 1.2, 'rgba(20,30,50,0.4)');
    if (NIGHT) for (let y = 30; y < 238; y += 12) for (let x = 6; x < 102; x += 12) if (NIGHT() < 0.25) rect(g, x + 3.2, y + 1.4, 8.6, 10.4, LIT);
    g.restore(); box(g, 6, 30, 98, 210, 2, null);
    box(g, 16, 12, 78, 20, 2, '#e8ecf2');
    let px = 12; while (textW(PLAZA_T[v], px) > 68 && px > 7) px -= 0.5;
    label(g, PLAZA_T[v], 55, 22.4, px, '#2a3a54');
  }];
  // otoyol reklam panosu (uydurma reklamlar)
  VAR.reklam = [220, 156, 5, (g, v) => {
    LW = 2;
    for (const x of [60, 152]) box(g, x, 88, 8, 68, 1.4, '#7a808c');
    const [bg, fg, t1, t2] = [['#d8342a', '#fff2c0', 'SICAK SİMİT', 'her sabah taze'], ['#1e5aa8', '#ffffff', "İSTANBUL'U KEŞFET", 'vapurla bir tur'], ['#2a7a4a', '#fff8e0', 'ÇAY ZAMANI', 'ince belli bardakta'], ['#f4c531', '#2a1a10', 'BALIK EKMEK', 'Eminönü usulü'], ['#6a3a9a', '#ffffff', 'BOĞAZ TURU', 'iki kıta bir gün']][v];
    box(g, 2, 2, 216, 90, 4, '#e8eaee');
    box(g, 8, 8, 204, 78, 2, bg, K, 1.2);
    let px = 22; while (textW(t1, px) > 130 && px > 10) px -= 1;
    label(g, t1, 84, 38, px, fg);
    label(g, t2, 84, 62, 12, fg, 'center', 500);
    // küçük resim
    const cx = 180, cy = 47;
    if (v === 0) { g.fillStyle = '#c47a2c'; g.beginPath(); g.arc(cx, cy, 18, 0, Math.PI * 2); g.arc(cx, cy, 7, 0, Math.PI * 2, true); g.fill('evenodd'); }
    else if (v === 1) { box(g, cx - 14, cy - 6, 28, 14, 2, '#ffffff'); poly(g, [cx - 22, cy + 8, cx + 22, cy + 8, cx + 16, cy + 18, cx - 16, cy + 18], '#24324e'); }
    else if (v === 2) { poly(g, [cx - 8, cy - 18, cx + 8, cy - 18, cx + 4, cy - 2, cx + 7, cy + 14, cx - 7, cy + 14, cx - 4, cy - 2], '#c8401e'); ell(g, cx, cy + 18, 14, 3, '#fbf6ea'); }
    else if (v === 3) { ell(g, cx, cy, 22, 9, '#e8b468'); poly(g, [cx - 14, cy - 2, cx + 14, cy - 2, cx + 18, cy + 4, cx - 18, cy + 4], '#9aa8b8', K, 1); }
    else { circ(g, cx, cy, 16, '#ffd27a'); poly(g, [cx - 22, cy + 12, cx + 22, cy + 12, cx + 16, cy + 20, cx - 16, cy + 20], '#ffffff'); }
  }];
  // vapur iskelesi: kıyıda beyaz iskele binası, saat, adı yazılı
  LBL.iskele = (name) => [230, 124, (g) => {
    LW = 1.8;
    for (let x = 12; x < 220; x += 18) box(g, x, 104, 6, 20, 1, '#6a5a4a');
    box(g, 0, 98, 230, 8, 1.4, '#9a8a74');
    box(g, 16, 46, 198, 54, 1, '#f6f2e8');
    for (let x = 26; x < 206; x += 22) archWin(g, x, 58, 12, 26, winC(g, 58), K);
    archWin(g, 101, 66, 28, 34, '#5a4030', K);
    poly(g, [6, 48, 224, 48, 196, 26, 34, 26], '#5a6a7a');
    box(g, 98, 4, 34, 28, 2, '#f6f2e8');
    circ(g, 115, 18, 9, '#fbfbf6', K, 1.2); line(g, 115, 18, 115, 12, K, 1.2); line(g, 115, 18, 119, 20, K, 1.2);
    poly(g, [94, 6, 136, 6, 115, -8], '#5a6a7a');
    box(g, 52, 32, 126, 15, 2, '#1e4a8a', K, 1.2);
    let px = 11; while (textW(name, px) > 116 && px > 7) px -= 0.5;
    label(g, name, 115, 39.8, px, '#ffffff');
  }];
  // Eminönü'nün süslü balık-ekmek teknesi
  OBJ.balikekmek = [150, 96, (g) => {
    LW = 1.8;
    ell(g, 75, 92, 70, 3, 'rgba(255,255,255,0.4)', null);
    g.beginPath(); g.moveTo(2, 58); g.lineTo(148, 58); g.quadraticCurveTo(142, 80, 126, 88); g.lineTo(24, 88); g.quadraticCurveTo(8, 80, 2, 58); g.closePath(); F(g, '#b8262a');
    rect(g, 4, 62, 142, 5, '#e8b030');
    for (let x = 14; x < 140; x += 14) circ(g, x, 76, 3.4, '#e8b030', K, 0.9);
    box(g, 20, 30, 110, 30, 2, '#e8d4a0');
    for (let x = 26; x < 126; x += 18) archWin(g, x, 34, 10, 20, '#6a2a1a', K);
    poly(g, [12, 32, 138, 32, 124, 18, 26, 18], '#b8262a');
    for (let x = 30; x < 122; x += 10) poly(g, [x, 32, x + 10, 32, x + 5, 38], '#e8b030', null);
    box(g, 36, 4, 78, 15, 2, '#1c1626');
    label(g, 'BALIK EKMEK', 75, 11.8, 9, '#ffd27a');
    for (const [x, y, r0] of [[116, 12, 5], [122, 4, 6], [128, -4, 7]]) circ(g, x, y, r0, 'rgba(240,240,240,0.7)', null);
  }];
  // Mısır Çarşısı: uzun taş yapı, kemerli kapı, kubbecikler
  OBJ.misir_carsisi = [300, 150, (g) => {
    LW = 1.8;
    const st = '#d4c09c', sh = '#a8946e';
    box(g, 4, 56, 292, 94, 1, lgrad(g, 0, 56, 0, 150, [[0, shade(st, 0.08)], [1, sh]]));
    g.save(); rr(g, 4, 56, 292, 94, 1); g.clip();
    g.strokeStyle = 'rgba(110,90,60,0.3)'; g.lineWidth = 0.7;
    for (let y = 62; y < 150; y += 6) { g.beginPath(); g.moveTo(4, y); g.lineTo(296, y); g.stroke(); }
    g.restore(); box(g, 4, 56, 292, 94, 1, null);
    for (let x = 14; x < 290; x += 22) if (Math.abs(x + 6 - 150) > 30) archWin(g, x, 74, 12, 26, '#4a3a2a', K);
    for (let x = 20; x < 290; x += 34) { g.beginPath(); g.ellipse(x, 57, 12, 10, 0, Math.PI, 0); g.closePath(); F(g, '#8794a8'); }
    // ana kapı
    box(g, 116, 26, 68, 124, 1, st);
    archWin(g, 128, 64, 44, 86, '#3a2c24', K);
    box(g, 112, 20, 76, 8, 1.4, sh);
    g.beginPath(); g.ellipse(150, 21, 22, 18, 0, Math.PI, 0); g.closePath(); F(g, '#8794a8');
    line(g, 150, 3, 150, -4, '#c8a020', 1.4);
    box(g, 132, 32, 36, 12, 2, '#1e4a8a', K, 1); label(g, 'ÇARŞI', 150, 38.4, 7, '#ffffff');
  }];
  // Ortaköy kumpir büfesi
  OBJ.kumpir = [76, 84, (g) => {
    LW = 1.6;
    box(g, 6, 40, 64, 44, 3, '#f4f0e6');
    box(g, 10, 46, 56, 18, 2, 'rgba(200,230,250,0.7)', K, 1.1);
    for (let k = 0; k < 4; k++) ell(g, 18 + k * 13, 57, 5.4, 4, '#c8945a', K, 0.9);
    box(g, 2, 26, 72, 16, 3, '#e8b030');
    g.save(); rr(g, 2, 26, 72, 16, 3); g.clip(); for (let x = 2; x < 76; x += 10) rect(g, x, 26, 5, 16, '#d8342a'); g.restore(); rr(g, 2, 26, 72, 16, 3); F(g, null);
    box(g, 12, 6, 52, 18, 3, '#1c1626');
    label(g, 'KUMPİR', 38, 15.4, 10, '#ffd27a');
    rect(g, 6, 68, 64, 4, '#d8342a');
  }];
  // Dolmabahçe Saat Kulesi
  OBJ.saat_kulesi = [60, 210, (g) => {
    LW = 1.8;
    const st = '#f2ece0', sh = '#cfc6b4';
    box(g, 10, 120, 40, 90, 1, st); rect(g, 40, 121, 9, 88, sh);
    archWin(g, 22, 160, 16, 34, '#5a6a8a', K);
    box(g, 6, 112, 48, 9, 1.4, sh);
    box(g, 14, 64, 32, 50, 1, st); rect(g, 38, 65, 7, 48, sh);
    circ(g, 30, 88, 10, '#fbfbf6', K, 1.4); line(g, 30, 88, 30, 81, K, 1.2); line(g, 30, 88, 35, 90, K, 1.2);
    box(g, 10, 58, 40, 7, 1.4, sh);
    box(g, 18, 30, 24, 30, 1, st);
    for (const x of [22, 32]) archWin(g, x, 36, 6, 16, '#5a6a8a');
    g.beginPath(); g.ellipse(30, 31, 14, 14, 0, Math.PI, 0); g.closePath(); F(g, '#8794a8');
    line(g, 30, 17, 30, 6, '#c8a020', 1.6);
  }];
  // Galataport önünde kruvaziyer gemisi
  OBJ.kruvaziyer = [440, 140, (g) => {
    LW = 2;
    ell(g, 220, 136, 210, 4, 'rgba(255,255,255,0.4)', null);
    g.beginPath(); g.moveTo(0, 90); g.lineTo(440, 90); g.quadraticCurveTo(432, 116, 410, 130); g.lineTo(24, 130); g.quadraticCurveTo(6, 116, 0, 90); g.closePath(); F(g, '#1e3a6a');
    rect(g, 2, 92, 436, 8, '#ffffff');
    for (let k = 0; k < 5; k++) { const y = 26 + k * 13, inset = 30 + (4 - k) * 0; box(g, inset + k * 6, y, 380 - k * 12, 14, 2, '#fbfbfb'); for (let x = inset + k * 6 + 8; x < 400 - k * 6; x += 9) rect(g, x, y + 4, 5, 5, '#3e5476'); }
    box(g, 300, 4, 34, 24, 3, '#e8e8ec');
    rect(g, 300, 8, 34, 6, '#c8302a');
    for (let x = 40; x < 400; x += 26) circ(g, x, 112, 3, '#ffd27a', null);
  }];
  // T1 tramvayı (arkadan)
  function tramvay() {
    return mk(110, 104, (g) => {
      LW = 1.7;
      line(g, 40, 2, 70, 14, '#3a3a44', 1.6); line(g, 70, 2, 40, 14, '#3a3a44', 1.6); box(g, 38, 13, 34, 4, 1, '#3a3a44');
      for (const x of [10, 82]) box(g, x, 94, 18, 9, 3, '#26222c');
      box(g, 4, 16, 102, 82, 14, '#f4f4f0');
      g.save(); rr(g, 4, 16, 102, 82, 14); g.clip();
      rect(g, 4, 70, 102, 10, '#d8282a'); rect(g, 4, 82, 102, 16, '#3a3e48');
      g.restore(); rr(g, 4, 16, 102, 82, 14); F(g, null);
      box(g, 12, 32, 86, 32, 8, lgrad(g, 0, 32, 0, 64, [[0, '#4a628a'], [1, '#22304a']]), K, 1.2);
      poly(g, [22, 62, 30, 62, 44, 34, 36, 34], 'rgba(255,255,255,0.25)', null);
      box(g, 26, 20, 58, 10, 2, '#141018', K, 1.1); label(g, 'T1 KABATAŞ', 55, 25.4, 6.4, '#ffb030');
      for (const x of [8, 90]) box(g, x, 72, 12, 7, 2.4, '#ffd060', K, 1);
    });
  }

  // ---------------- Boğaz kıyısı ----------------
  // Emirgan köşkleri: iki katlı geniş ahşap köşk, ortada alınlıklı çıkma (sarı, pembe, beyaz)
  const KOSK = ['#f2d27a', '#f0b8c0', '#f6f2ea'];
  VAR.kosk = [184, 132, 3, (g, v) => {
    LW = 1.8;
    const c = KOSK[v], d = shade(c, -0.2), tr = '#fbf8f0';
    box(g, 8, 44, 168, 82, 1, c);
    g.save(); rr(g, 8, 44, 168, 82, 1); g.clip();
    g.strokeStyle = shade(c, -0.1); g.lineWidth = 0.7;
    for (let y = 48; y < 126; y += 5) { g.beginPath(); g.moveTo(8, y); g.lineTo(176, y); g.stroke(); }
    g.restore(); box(g, 8, 44, 168, 82, 1, null);
    rect(g, 8, 84, 168, 3, tr);
    // ortadaki çıkma ve alınlık
    box(g, 66, 34, 52, 92, 1, shade(c, 0.08));
    poly(g, [60, 36, 124, 36, 92, 16], c, K, 1.6); poly(g, [72, 33, 112, 33, 92, 22], tr, null);
    circ(g, 92, 29, 3, shade(c, -0.25), null);
    for (const y of [46, 92]) for (const x of [72, 90]) { box(g, x, y, 14, 26, 1, tr, K, 1.1); box(g, x + 2, y + 2, 10, 22, 0.5, winC(g, y), null); }
    for (const y of [50, 94]) for (const x of [16, 36, 136, 156]) { box(g, x, y, 12, 24, 1, tr, K, 1.1); box(g, x + 2, y + 2, 8, 20, 0.5, winC(g, y), null); }
    // basık kırma çatı ve saçak
    poly(g, [0, 46, 184, 46, 166, 30, 18, 30], '#8a6a5a');
    rect(g, 2, 44, 180, 3, d);
    // bahçe duvarı ve basamaklar
    box(g, 0, 122, 184, 10, 1, '#e8e0d0');
    box(g, 78, 116, 28, 8, 1, '#d8d0c0');
  }];
  // lale tarhı (Emirgan Korusu)
  OBJ.lale = [96, 36, (g) => {
    LW = 1.2;
    ell(g, 48, 28, 46, 8, '#5a9a3a', K, 1.2);
    const cols = ['#e8343a', '#f4c531', '#f07ab0', '#ffffff', '#e8343a'];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 9 - row; k++) {
      const x = 10 + row * 4 + k * 10, y = 26 - row * 6;
      line(g, x, y + 4, x, y, '#2e6a2a', 1.2);
      g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x - 3, y - 6); g.lineTo(x - 1.5, y - 4); g.lineTo(x, y - 7); g.lineTo(x + 1.5, y - 4); g.lineTo(x + 3, y - 6); g.lineTo(x + 3, y); g.closePath();
      F(g, cols[(k + row) % 5], K, 0.8);
    }
  }];
  // yelkenli
  OBJ.yelkenli = [70, 96, (g) => {
    LW = 1.4;
    ell(g, 35, 92, 30, 2.4, 'rgba(255,255,255,0.45)', null);
    g.beginPath(); g.moveTo(4, 76); g.lineTo(66, 76); g.quadraticCurveTo(62, 86, 52, 90); g.lineTo(16, 90); g.quadraticCurveTo(8, 86, 4, 76); g.closePath(); F(g, '#2a5ad8');
    rect(g, 6, 77, 58, 2, '#ffffff');
    line(g, 34, 76, 34, 4, '#5a5a64', 1.6);
    poly(g, [36, 6, 36, 72, 62, 72], '#fbfbf6', K, 1.2);
    poly(g, [32, 14, 32, 72, 10, 72], '#f2f0e8', K, 1.2);
    g.fillStyle = '#e30a17'; g.fillRect(34, 0, 8, 5);
  }];
  // Kuleli Askeri Lisesi: kıyıda iki sivri kuleli uzun beyaz bina (Çengelköy)
  OBJ.kuleli = [330, 176, (g) => {
    LW = 1.8;
    const st = '#f6f2ea', sh = '#d6d0c4', lead = '#7e8ea2';
    box(g, 30, 96, 270, 80, 1, st);
    for (let x = 40; x < 290; x += 18) { archWin(g, x, 108, 10, 20, winC(g, 108), K); archWin(g, x, 140, 10, 22, winC(g, 140), K); }
    rect(g, 30, 132, 270, 3, sh);
    box(g, 26, 90, 278, 8, 1.4, sh);
    box(g, 140, 70, 50, 26, 1, st); poly(g, [134, 72, 196, 72, 165, 56], lead);
    for (const x of [6, 286]) {
      box(g, x, 52, 38, 124, 1, st); rect(g, x + 30, 53, 7, 122, sh);
      for (const y of [64, 96, 128]) archWin(g, x + 13, y, 12, 22, winC(g, y), K);
      box(g, x - 3, 46, 44, 8, 1.4, sh);
      poly(g, [x - 2, 47, x + 40, 47, x + 19, 0], lead);
      line(g, x + 19, 0, x + 19, -6, '#c8a020', 1.4);
    }
    box(g, 0, 170, 330, 6, 1, '#a8a29a');
  }];
  // kıyıda balık lokantası: beyaz-mavi ahşap, teras, ışık zinciri
  OBJ.balik_lokantasi = [160, 96, (g) => {
    LW = 1.7;
    for (let x = 10; x < 160; x += 22) box(g, x, 82, 6, 14, 1, '#6a5a4a');
    box(g, 0, 76, 160, 8, 1.4, '#9a7e5e');
    box(g, 14, 30, 132, 48, 1, '#f6f6f2');
    rect(g, 14, 60, 132, 18, '#2a6ab0');
    for (let x = 24; x < 140; x += 22) { box(g, x, 38, 14, 18, 1, '#f6f6f2', K, 1.1); box(g, x + 2, 40, 10, 14, 0.5, winC(g, 40), null); }
    poly(g, [6, 32, 154, 32, 138, 14, 22, 14], '#2a6ab0');
    box(g, 44, 2, 72, 15, 2, '#f4c531', K, 1.2);
    label(g, 'BALIK', 80, 9.8, 10, '#1c1626');
    // masalar ve ışıklar
    for (const x of [22, 62, 102, 136]) { box(g, x - 8, 66, 16, 3, 1, '#ffffff', K, 0.8); line(g, x, 69, x, 76, K, 1); }
    g.strokeStyle = '#3a3440'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(14, 30); g.quadraticCurveTo(80, 44, 146, 30); g.stroke();
    for (let k = 1; k < 10; k++) { const t = k / 10, x = 14 + t * 132, y = 30 + 2 * t * (1 - t) * 14 * 2; circ(g, x, y + 1.5, 1.4, '#ffe9a0', null); }
  }];

  // ---------------- gün saatleri ----------------
  // 0 sabah, 1 öğle, 2 ikindi, 3 gün batımı
  const TIMES = [
    { sky: ['#5fb6f2', '#cfeeff'], sea: '#2f86c8', seaDark: '#2672ae', haze: '#d6ecfa', shore: '#7d9ab6', shore2: '#9ab4ca', sun: { y: 30, r: 9, c: '#fffbe0' }, grass: ['#6aaa3e', '#5e9a36'], park: ['#5aa040', '#4e9038'], forest: ['#3e7a32', '#36702c'], pave: ['#b8b4ac', '#aca8a0'], lights: 0 },
    { sky: ['#3aa2ee', '#b8e2ff'], sea: '#2a7cc0', seaDark: '#226aa6', haze: '#c8e4f8', shore: '#6e8eac', shore2: '#8eaac4', sun: { y: 18, r: 9, c: '#ffffff' }, grass: ['#62a63a', '#579834'], park: ['#55a03c', '#4a9034'], forest: ['#3a7630', '#326c2a'], pave: ['#bcb8b0', '#b0aca4'], lights: 0 },
    { sky: ['#6c96d8', '#ffd8a0'], sea: '#3a72a8', seaDark: '#30628f', haze: '#f0d8b0', shore: '#6c7896', shore2: '#8a90a8', sun: { y: 56, r: 12, c: '#fff0b0' }, grass: ['#7a9a3a', '#6c8c34'], park: ['#6a9a3c', '#5e8c36'], forest: ['#4a6a30', '#40602a'], pave: ['#c4b8a4', '#b8ac98'], lights: 0.15 },
    { sky: ['#2c2458', '#ff9058'], sea: '#4a4a86', seaDark: '#3a3a70', haze: '#e8907a', shore: '#3a2c50', shore2: '#4e3a62', sun: { y: 92, r: 18, c: '#ffb050' }, grass: ['#5a6a3a', '#4e5e34'], park: ['#4e6a3a', '#445e34'], forest: ['#34502e', '#2c4628'], pave: ['#9a8a8a', '#8e7e80'], lights: 0.7 },
    // 4: gece (ay, ışıklı kıyılar)
    { sky: ['#070a22', '#1e2650'], sea: '#141c3a', seaDark: '#0e1530', haze: '#141a36', shore: '#121630', shore2: '#1c2244', sun: { y: 26, r: 7, c: '#f4f2e0' }, grass: ['#1a2c1e', '#16281a'], park: ['#18301e', '#152a1a'], forest: ['#12261a', '#102216'], pave: ['#34343e', '#2e2e38'], lights: 1 },
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
  // Gece: ışıklı renkler (pencere, lamba, stop lambası, çakar) olduğu gibi kalır, gerisi koyu maviye çekilir.
  // 'flood': camiler, kuleler, saray gibi ışıklandırılan yapılar altın rengi ışık alır.
  const KEEP_LIT = ['#ffd37d', '#f6e2a2', '#fff2b0', '#fff6c8', '#ffe9a0', '#ffd27a', '#fff1c0', '#c81818', '#ff3a2a', '#b81818', '#ff6a50', '#ff5a4a',
    '#ff7a5a', '#ffe0b0', '#ff4a3a', '#4a8aff', '#ffd060', '#f4a020', '#ffb030', '#7cff6a', '#ff4a3a'].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const FLOOD = { cami: 1, ayasofya: 1, sultanahmet: 1, camlica_camii: 1, camlica_kulesi: 1, galata_kulesi: 1, kiz_kulesi: 1, saray: 1, hisar: 1, kale: 1, kuleli: 1,
    saat_kulesi: 1, misir_carsisi: 1, kopru_kule: 1, iskele: 1, tunel_agzi: 1, basla: 1, kontrol: 1, bitis: 1, tabela: 1, levha: 1, ayrim: 1, reklam: 1, tunel_levha: 1 };
  // ışıklı renkler: tam eşleşme (dolgu içleri tam bu renkte çizilir), 32 bit tek arama
  const LIT_SET = new Set(KEEP_LIT.map(([r, g, b]) => (r << 16) | (g << 8) | b));
  function nightPass(c, mode) {
    const g = c.getContext('2d', { willReadFrequently: true });
    const im = g.getImageData(0, 0, c.width, c.height);
    const d = new Uint32Array(im.data.buffer);
    // katsayılar: [r çarpanı, r eki, g çarpanı, g eki, b çarpanı, b eki]
    const k = mode === 'sign' ? [0.72, 4, 0.72, 6, 0.78, 14] : mode === 'flood' ? [0.8, 18, 0.66, 12, 0.42, 14] : [0.27, 6, 0.3, 10, 0.42, 26];
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!(v >>> 24)) continue;
      const r = v & 255, gg = (v >>> 8) & 255, b = (v >>> 16) & 255;
      if (LIT_SET.has((r << 16) | (gg << 8) | b)) continue;
      d[i] = (v & 0xff000000) | (((b * k[4] + k[5]) & 255) << 16) | (((gg * k[2] + k[3]) & 255) << 8) | ((r * k[0] + k[1]) & 255);
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  const SIGN = { tabela: 1, levha: 1, ayrim: 1, basla: 1, kontrol: 1, bitis: 1, reklam: 1, tunel_levha: 1, iskele: 0 };
  function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function getLodNight(key, w, h, scale, fn, mode) {
    let c = lod.get(key);
    if (c) { lod.delete(key); lod.set(key, c); return c; }
    const old = NIGHT; NIGHT = rng(hashStr(key));
    try { c = mk(w, h, fn, scale); } finally { NIGHT = old; }
    nightPass(c, mode);
    lod.set(key, c); lodPx += c.width * c.height;
    while (lodPx > LOD_BUDGET && lod.size > 1) { const k0 = lod.keys().next().value; const c0 = lod.get(k0); lodPx -= c0.width * c0.height; lod.delete(k0); }
    return c;
  }
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
    if (k === 'levha') return ['levha:' + sp.label.join('|'), levhaDef(sp.label)];
    if (k === 'tunel_levha') return ['tl:' + (sp.v || 0), tunelLevha(sp.v || 0)];
    if (VAR[k]) { const [w, h, n, fn] = VAR[k], v = (sp.v || 0) % n; return ['v:' + k + ':' + v, [w, h, (g) => fn(g, v)]]; }
    if (LBL[k]) return ['l:' + k + ':' + sp.label, LBL[k](sp.label)];
    if (OBJ[k]) return ['o:' + k, OBJ[k]];
    return ['o:?', [8, 8, (g) => rect(g, 0, 0, 8, 8, '#f0f')]];
  }
  const defCache = new Map();
  function sprite(k, sp, needPx, night) {
    const dk = k === 'tabela' ? 'tabela:' + sp.label : k === 'ayrim' ? 'ayrim:' + sp.label.join('|') : k === 'apartman' ? 'apt:' + ((sp.v || 0) % 7)
      : k === 'levha' ? 'levha:' + sp.label.join('|') : k === 'tunel_levha' ? 'tl:' + (sp.v || 0)
      : VAR[k] ? 'v:' + k + ':' + ((sp.v || 0) % VAR[k][2]) : LBL[k] ? 'l:' + k + ':' + sp.label : 'o:' + k;
    let d = defCache.get(dk);
    if (!d) { d = defOf(k, sp)[1]; defCache.set(dk, d); }
    const [w, h, fn] = d;
    const L = lodLevel(w, h, needPx === undefined ? w * S : needPx);
    if (night) return getLodNight(dk + '@' + L + 'n', w, h, Math.pow(2, L), fn, SIGN[k] ? 'sign' : FLOOD[k] ? 'flood' : 'dark');
    return getLod(dk + '@' + L, w, h, Math.pow(2, L), fn);
  }
  const CAR_DEF = {
    taksi: [72, 44, () => sedan(0, true)], dolmus: [84, 64, dolmus], otobus: [116, 96, otobus], kamyon: [108, 88, kamyon], motor: [32, 48, motor], metrobus: [120, 100, metrobus], tramvay: [110, 104, tramvay],
    polis: [72, 52], polis_motor: [34, 56], motosiklet: [34, 56], scooter: [24, 60], bisiklet: [26, 60],
  };
  // renk (ya da çakar karesi) önbellek anahtarına girenler
  const PER_COLOR = { polis: 1, polis_motor: 1, motosiklet: 1, scooter: 1, bisiklet: 1 };
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
        case 'metrobus': return metrobus();
        case 'tramvay': return tramvay();
        case 'polis': return polis(color % 2);
        case 'polis_motor': return motosiklet(0, true, color % 2);
        case 'motosiklet': return motosiklet(color, false);
        case 'scooter': return scooter(color);
        case 'bisiklet': return bisiklet(color);
        default: return sedan(color, false);
      }
    });
  }
  function car(kind, color, needPx, night) {
    const [w, h] = CAR_DEF[kind] || [72, 44];
    const L = lodLevel(w, h, needPx === undefined ? w * S : needPx);
    const key = 'c:' + kind + ':' + (CAR_DEF[kind] && !PER_COLOR[kind] ? '' : color) + '@' + L + (night ? 'n' : '');
    let c = lod.get(key);
    if (c) { lod.delete(key); lod.set(key, c); return c; }
    c = carCanvas(kind, color, Math.pow(2, L));
    if (night) nightPass(c, 'sign');
    lod.set(key, c); lodPx += c.width * c.height;
    while (lodPx > LOD_BUDGET && lod.size > 1) { const k0 = lod.keys().next().value; const c0 = lod.get(k0); lodPx -= c0.width * c0.height; lod.delete(k0); }
    return c;
  }
  function player(turn, brake, color, night) {
    return getScaled(`p:${turn}:${brake ? 1 : 0}:${color}${night ? ':n' : ''}`, () => { const c = playerCar(turn, brake, color); return night ? nightPass(c, 'sign') : c; });
  }
  // ışık parlaması (eklemeli çizim için), renk başına bir kez
  function glow(col) {
    return getScaled('glow:' + col, () => mk(32, 32, (g) => {
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, col); gr.addColorStop(0.35, col.replace(/[\d.]+\)$/, (m) => String(parseFloat(m) * 0.45) + ')')); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    }));
  }

  // uzak kıyı panoraması (ufkun üstünde, 1024 birim, yatayda tekrarlar)
  function minaret(g, x, by, h, w, col) {
    poly(g, [x - w / 2, by, x + w / 2, by, x + w * 0.4, by - h + w * 3, x - w * 0.4, by - h + w * 3], col, null);
    rect(g, x - w * 0.85, by - h * 0.62, w * 1.7, Math.max(0.6, w * 0.5), col);
    poly(g, [x - w / 2, by - h + w * 3, x + w / 2, by - h + w * 3, x, by - h], col, null);
  }
  function domeShape(g, cx, by, r, col) { g.beginPath(); g.ellipse(cx, by, r, r * 0.9, 0, Math.PI, 0); g.closePath(); g.fillStyle = col; g.fill(); }
  // style 'towers': ufukta gökdelen kümeleri (Anadolu yakasından Avrupa'ya ya da Ataşehir'e bakış)
  function panorama(time, seed, style) {
    return getScaled('pan:' + time + ':' + seed + ':' + (style || ''), () => {
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
        // gökdelen kümeleri
        if (style === 'towers') {
          const tc = mix(T.shore, T.shore2, 0.35), lit = T.lights;
          for (const cx0 of [150, 520, 860]) {
            for (let k = 0; k < 9; k++) {
              const w = 4 + r() * 6, h = 24 + r() * 32 * (1 - Math.abs(k - 4) / 6), x = cx0 + (k - 4) * 9 + r() * 4;
              rect(g, x, H - 6 - h, w, h + 6, tc);
              if (r() < 0.4) poly(g, [x, H - 6 - h, x + w, H - 6 - h, x + w / 2, H - 12 - h], tc, null);
              if (lit) for (let q = 0; q < h / 4; q++) if (r() < lit * 0.8) rect(g, x + 1 + r() * (w - 2), H - 4 - h + r() * h, 0.8, 0.8, '#ffe0a0');
            }
          }
        }
        // camiler ve servi ağaçları
        for (let k = 0; k < (style === 'towers' ? 3 : 6); k++) {
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
  function clouds(time, style) {
    return getScaled('cl:' + time + (style || ''), () => {
      const r = rng(time * 5 + 1);
      const rain = style === 'rain';
      const col = rain ? 'rgba(112,118,130,0.95)' : time === 4 ? 'rgba(60,68,110,0.55)' : time === 3 ? 'rgba(255,176,150,0.7)' : time === 2 ? 'rgba(255,244,228,0.85)' : 'rgba(255,255,255,0.92)';
      const sh = rain ? 'rgba(70,74,86,0.8)' : time === 4 ? 'rgba(20,24,50,0.5)' : time === 3 ? 'rgba(170,90,110,0.45)' : time === 2 ? 'rgba(220,180,150,0.45)' : 'rgba(170,200,230,0.5)';
      return mk(1024, 70, (g) => {
        for (let k = 0; k < (rain ? 22 : 9); k++) {
          const x = 40 + r() * 944, y = (rain ? 4 : 18) + r() * (rain ? 46 : 38), w = (rain ? 70 : 34) + r() * (rain ? 90 : 56);
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
    sur: 2.8, ayasofya: 8, sultanahmet: 8.5, galata_kulesi: 2.2, camlica_kulesi: 3.4, camlica_camii: 7, bariyer: 0.55, otoyol_lamba: 0.24,
    levha: 3.6, ustgecit: 5.2, tunel_agzi: 12, tunel_levha: 0.64,
    ahsap_ev: 2.2, han: 2.6, tas_bina: 2.5, site: 3.2, rezidans: 2.2, plaza: 2.6, reklam: 2.6, iskele: 4.4, balikekmek: 2.2,
    misir_carsisi: 6.5, kumpir: 0.9, saat_kulesi: 1.3, kruvaziyer: 10,
    kosk: 3.4, lale: 1.2, yelkenli: 1.1, kuleli: 7.2, balik_lokantasi: 2.8,
  };
  const CAR_SIZE = { araba: 0.42, taksi: 0.42, dolmus: 0.52, otobus: 0.72, kamyon: 0.72, motor: 0.2, metrobus: 0.74, tramvay: 0.72,
    polis: 0.44, polis_motor: 0.22, motosiklet: 0.22, scooter: 0.15, bisiklet: 0.16 };

  function setScale(s) { if (Math.abs(s - S) < 1e-6) return; S = s; scaled.clear(); }
  function clearAll() { scaled.clear(); lod.clear(); lodPx = 0; defCache.clear(); }

  root.BY_ART = {
    K, mk, rr, box, circ, ell, poly, line, rect, lgrad, archWin, shade, mix, rng, label, textW, FONT,
    TIMES, panorama, clouds, sprite, car, player, glow, SIZE, CAR_DEF, CAR_SIZE, CAR_COLORS, setScale, clearAll, get S() { return S; },
    set LW(v) { LW = v; }, get LW() { return LW; },
  };
})(window);
