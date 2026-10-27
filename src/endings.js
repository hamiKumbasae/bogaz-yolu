// Boğaz Yolu — dört bitiş sahnesi (384×216): Rumeli Feneri, köprüde gün batımı, Kanlıca yoğurdu, Yoros Kalesi.
(function (root) {
  'use strict';
  const A = root.BY_ART;
  const { mk, R, disc, ellipse, poly } = A;
  const W = 384, H = 216, K = '#141018';

  function skyGrad(g, top, bottom, h) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, W, h);
  }
  function sea(g, y, col, light) {
    R(g, 0, y, W, H - y, col);
    const r = A.rng(7);
    for (let i = 0; i < 60; i++) R(g, r() * W, y + 4 + r() * (H - y), 6 + r() * 14, 1, light);
  }
  function carSide(g, x, y, col) {
    // park etmiş araba (yandan)
    const dark = A.shade(col, -0.35);
    R(g, x, y + 8, 76, 14, K); R(g, x + 1, y + 9, 74, 12, col); R(g, x + 1, y + 9, 74, 2, A.shade(col, 0.3));
    poly(g, [x + 16, y + 9, x + 54, y + 9, x + 46, y - 2, x + 24, y - 2], K);
    poly(g, [x + 19, y + 8, x + 51, y + 8, x + 44, y, x + 26, y], '#3a4a64');
    R(g, x + 34, y, 2, 8, dark);
    R(g, x + 70, y + 11, 5, 3, '#ffe9a0'); R(g, x + 1, y + 11, 4, 3, '#c41818');
    for (const cx of [x + 16, x + 60]) { disc(g, cx, y + 22, 6, K); disc(g, cx, y + 22, 3, '#9aa0aa'); }
  }
  function sunset(g, sunY) {
    skyGrad(g, '#2c2458', '#ff9058', 130);
    disc(g, 270, sunY, 26, '#ffd090'); disc(g, 270, sunY, 20, '#ffb050');
    for (const [x, y, w] of [[60, 30, 70], [180, 50, 90], [320, 24, 60]]) for (let i = 0; i < 4; i++) ellipse(g, x + i * w * 0.2, y - (i % 2) * 3, Math.round(w * 0.2), 4, 'rgba(255,170,140,0.6)');
  }

  const scenes = {
    fener: (col) => mk(W, H, (g) => {
      sunset(g, 118);
      sea(g, 128, '#4a4a86', 'rgba(255,190,140,0.5)');
      R(g, 240, 128, 60, 2, '#ffd090'); R(g, 250, 136, 40, 2, '#ffd090');
      // kayalık kıyı
      poly(g, [0, 216, 0, 150, 60, 140, 140, 150, 200, 170, 240, 216], '#3a2c40');
      poly(g, [0, 216, 0, 166, 80, 160, 170, 176, 210, 216], '#2a2030');
      // deniz feneri
      R(g, 66, 54, 22, 90, K); R(g, 67, 55, 20, 89, '#f2eee4');
      for (const y of [70, 96, 122]) R(g, 67, y, 20, 8, '#c8302a');
      R(g, 62, 40, 30, 16, K); R(g, 64, 42, 26, 12, '#ffe9a0'); R(g, 60, 52, 34, 4, K);
      poly(g, [62, 40, 92, 40, 77, 26], K);
      g.fillStyle = 'rgba(255,240,180,0.25)'; g.beginPath(); g.moveTo(90, 46); g.lineTo(220, 20); g.lineTo(220, 72); g.closePath(); g.fill();
      for (let i = 0; i < 5; i++) { const x = 150 + i * 30, y = 40 + (i % 2) * 14; R(g, x, y, 4, 1, K); R(g, x - 2, y - 1, 2, 1, K); R(g, x + 4, y - 1, 2, 1, K); }
      carSide(g, 120, 160, col);
    }),
    kopru: (col) => mk(W, H, (g) => {
      sunset(g, 96);
      sea(g, 140, '#4a4a86', 'rgba(255,190,140,0.5)');
      // iki yakanın tepeleri
      poly(g, [0, 140, 0, 110, 50, 100, 110, 116, 130, 140], '#3a2c50');
      poly(g, [384, 140, 384, 106, 330, 98, 280, 118, 260, 140], '#3a2c50');
      // köprü
      const c = '#e8dcd4';
      R(g, 0, 120, W, 4, c);
      for (const x of [90, 294]) { R(g, x - 3, 40, 3, 84, c); R(g, x + 3, 40, 3, 84, c); R(g, x - 3, 56, 9, 2, c); R(g, x - 3, 84, 9, 2, c); }
      for (let x = 0; x < W; x++) {
        const u = (x - 92) / 204;
        let y;
        if (u >= 0 && u <= 1) y = 42 + (1 - 4 * (u - 0.5) * (u - 0.5)) * 72; else y = 42 + Math.abs(u < 0 ? u : u - 1) * 204 * 0.7;
        if (y < 120) { R(g, x, y, 1, 1, c); if (x % 6 === 0) R(g, x, y, 1, 120 - y, 'rgba(232,220,212,0.45)'); }
      }
      for (let x = 10; x < W; x += 18) R(g, x, 116, 3, 2, '#ffe9a0');
      // seyir terası
      R(g, 0, 180, W, 36, '#2a2030'); R(g, 0, 178, W, 3, '#5a4a5a');
      for (let x = 0; x < W; x += 12) R(g, x, 166, 2, 14, '#5a4a5a');
      R(g, 0, 166, W, 2, '#5a4a5a');
      carSide(g, 40, 190, col);
    }),
    yogurt: (col) => mk(W, H, (g) => {
      skyGrad(g, '#5a4a8a', '#ffb070', 120);
      disc(g, 300, 100, 18, '#ffd090');
      sea(g, 120, '#5a5a96', 'rgba(255,200,150,0.5)');
      // karşı kıyı ve yalılar
      poly(g, [0, 120, 0, 96, 120, 90, 260, 98, 384, 92, 384, 120], '#3a3050');
      for (let x = 10; x < 380; x += 34) { R(g, x, 104, 22, 16, '#6a3a3a'); R(g, x + 4, 108, 4, 4, '#ffd27a'); R(g, x + 12, 108, 4, 4, '#ffd27a'); }
      // iskele ve masa
      R(g, 0, 150, W, 66, '#6a4a32'); for (let x = 0; x < W; x += 16) R(g, x, 150, 1, 66, '#4a3222'); R(g, 0, 150, W, 3, '#8a6a4a');
      R(g, 150, 136, 150, 8, K); R(g, 152, 137, 146, 5, '#f4f0e6');
      R(g, 160, 144, 4, 40, K); R(g, 286, 144, 4, 40, K);
      // yoğurt kâsesi, pudra şekeri ve kaşık
      ellipse(g, 225, 118, 48, 12, K); poly(g, [177, 118, 273, 118, 258, 136, 192, 136], K);
      poly(g, [180, 118, 270, 118, 256, 134, 194, 134], '#f2f2f2');
      R(g, 186, 124, 78, 3, '#2a6ab0'); R(g, 192, 129, 66, 2, '#2a6ab0');
      ellipse(g, 225, 117, 45, 9, '#fffaf0');
      const r = A.rng(5);
      for (let i = 0; i < 260; i++) { const a = r() * 6.28, d = Math.sqrt(r()); R(g, 225 + Math.cos(a) * d * 40, 117 + Math.sin(a) * d * 7, 1, 1, '#ffffff'); }
      ellipse(g, 225, 116, 18, 3, '#ffffff');
      R(g, 252, 94, 3, 24, '#c8c8c8'); ellipse(g, 253, 94, 4, 3, '#c8c8c8');
      // çay
      R(g, 274, 124, 8, 12, K); R(g, 275, 125, 6, 10, '#c8501e'); R(g, 270, 135, 16, 2, '#c8c8c8');
      carSide(g, 20, 176, col);
    }),
    kale: (col) => mk(W, H, (g) => {
      sunset(g, 110);
      sea(g, 124, '#4a4a86', 'rgba(255,190,140,0.5)');
      // Karadeniz'e açılan Boğaz ağzı
      poly(g, [0, 124, 0, 100, 60, 104, 90, 124], '#3a2c50');
      poly(g, [384, 124, 384, 96, 320, 104, 300, 124], '#3a2c50');
      // tepe ve kale
      poly(g, [0, 216, 0, 150, 120, 120, 260, 130, 384, 160, 384, 216], '#3a4a2e');
      const st = '#8a7a6a';
      for (const [x, w, h] of [[60, 40, 60], [96, 60, 40], [150, 30, 76], [176, 64, 46], [236, 34, 58]]) {
        R(g, x, 130 - h, w, h, K); R(g, x + 1, 131 - h, w - 2, h - 1, st);
        for (let k = x + 2; k < x + w - 4; k += 8) { R(g, k, 124 - h, 5, 7, K); R(g, k + 1, 125 - h, 3, 6, st); }
        for (let y = 134 - h; y < 130; y += 6) R(g, x + 1, y, w - 2, 1, '#6a5a4a');
      }
      R(g, 160, 90, 10, 20, K);
      carSide(g, 230, 176, col);
    }),
  };
  const cache = {};
  function scene(k, col) { const key = k + (col || ''); if (!cache[key]) cache[key] = (scenes[k] || scenes.fener)(col || '#d8302a'); return cache[key]; }
  root.BY_ENDINGS = { scene };
})(window);
