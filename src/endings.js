// Boğaz Yolu — bitiş sahneleri (384×216 birim): Rumeli Feneri, köprüde gün batımı, Kanlıca yoğurdu, Yoros Kalesi
// ve İstanbul Turu'nun sonu (Cankurtaran).
// Çizgi film tarzı vektör; ekran ölçeğinde bir kez çizilip önbelleğe alınır.
(function (root) {
  'use strict';
  const A = root.BY_ART;
  const W = 384, H = 216, TAU = Math.PI * 2;

  function skyGrad(g, stops, h) {
    g.fillStyle = A.lgrad(g, 0, 0, 0, h, stops); g.fillRect(0, 0, W, h);
  }
  function sun(g, x, y, r) {
    const gl = g.createRadialGradient(x, y, r * 0.6, x, y, r * 4.5);
    gl.addColorStop(0, 'rgba(255,220,150,0.75)'); gl.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gl; g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    A.circ(g, x, y, r, '#ffd890', null);
    A.circ(g, x, y, r * 0.78, '#ffbe5a', null);
  }
  function cloud(g, x, y, w, col) {
    g.fillStyle = col; g.beginPath();
    for (const [dx, dy, r] of [[-0.36, 0, 0.2], [-0.12, -0.12, 0.26], [0.16, -0.06, 0.22], [0.38, 0.02, 0.16]]) { g.moveTo(x + dx * w + r * w, y + dy * w); g.arc(x + dx * w, y + dy * w, r * w, 0, TAU); }
    g.rect(x - w * 0.36, y, w * 0.74, w * 0.16); g.fill();
  }
  function sunsetSky(g, sunX, sunY, horizon) {
    skyGrad(g, [[0, '#2a2460'], [0.45, '#a0507e'], [0.8, '#ff9a62'], [1, '#ffc888']], horizon);
    sun(g, sunX, sunY, 22);
    cloud(g, 70, 34, 80, 'rgba(255,170,150,0.55)'); cloud(g, 200, 54, 96, 'rgba(255,170,150,0.45)'); cloud(g, 330, 26, 64, 'rgba(255,190,160,0.5)');
  }
  function sea(g, y, sunX, deep) {
    g.fillStyle = A.lgrad(g, 0, y, 0, H, [[0, '#7a5a96'], [0.35, deep || '#4a4a8a'], [1, '#26285a']]); g.fillRect(0, y, W, H - y);
    const r = A.rng(7);
    g.fillStyle = 'rgba(255,214,160,0.75)';
    for (let k = 0; k < 14; k++) { const yy = y + 2 + k * 3.2, w = 44 - k * 2.4; if (w > 2) g.fillRect(sunX - w / 2 + Math.sin(k * 1.7) * 4, yy, w, 1); }
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let k = 0; k < 40; k++) g.fillRect(r() * W, y + 6 + r() * (H - y - 6), 4 + r() * 12, 0.8);
  }
  function seagull(g, x, y, s) {
    g.strokeStyle = '#2a2040'; g.lineWidth = 1.2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 5 * s, y - 0.6 * s); g.quadraticCurveTo(x - 2.4 * s, y - 3.2 * s, x, y); g.quadraticCurveTo(x + 2.4 * s, y - 3.2 * s, x + 5 * s, y - 0.6 * s); g.stroke();
  }
  // park etmiş araba (yandan, sağa bakar)
  function carSide(g, x, y, col) {
    A.LW = 1.6;
    const dark = A.shade(col, -0.3), light = A.shade(col, 0.35);
    A.ell(g, x + 40, y + 27, 40, 3, 'rgba(0,0,0,0.3)', null);
    g.beginPath();
    g.moveTo(x + 2, y + 22); g.lineTo(x + 2, y + 12); g.quadraticCurveTo(x + 4, y + 8, x + 14, y + 7);
    g.lineTo(x + 24, y + 6); g.quadraticCurveTo(x + 30, y - 4, x + 42, y - 4); g.lineTo(x + 52, y - 4);
    g.quadraticCurveTo(x + 60, y - 3, x + 66, y + 6); g.lineTo(x + 76, y + 8); g.quadraticCurveTo(x + 82, y + 10, x + 82, y + 16);
    g.lineTo(x + 82, y + 22); g.closePath();
    g.fillStyle = A.lgrad(g, 0, y - 4, 0, y + 22, [[0, light], [0.45, col], [1, dark]]); g.fill();
    g.strokeStyle = A.K; g.lineWidth = 1.6; g.stroke();
    A.poly(g, [x + 27, y + 6, x + 32, y - 1.6, x + 42, y - 2, x + 42, y + 6], A.lgrad(g, 0, y - 2, 0, y + 6, [[0, '#7a9ac4'], [1, '#33456a']]), A.K, 1.1);
    A.poly(g, [x + 45, y + 6, x + 45, y - 2, x + 52, y - 2, x + 61, y + 6], A.lgrad(g, 0, y - 2, 0, y + 6, [[0, '#7a9ac4'], [1, '#33456a']]), A.K, 1.1);
    A.line(g, x + 44, y + 7, x + 44, y + 20, dark, 1);
    A.box(g, x + 77, y + 10, 5, 3, 1.2, '#fff2b0', null);
    A.box(g, x + 2, y + 11, 3.4, 4, 1, '#d02020', null);
    for (const cx of [x + 18, x + 64]) { A.circ(g, cx, y + 22, 7, '#26222c'); A.circ(g, cx, y + 22, 3.8, '#b8bec8', A.K, 1); A.circ(g, cx, y + 22, 1.2, '#6a707c', null); }
  }

  const scenes = {
    fener: (col) => (g) => {
      sunsetSky(g, 290, 118, 130);
      sea(g, 128, 290);
      for (let i = 0; i < 5; i++) seagull(g, 150 + i * 28, 46 + (i % 2) * 14, 1.1);
      // kayalık kıyı
      A.LW = 1.6;
      A.poly(g, [0, 216, 0, 146, 40, 136, 92, 140, 150, 150, 300, 158, 344, 216], '#4a3a52');
      A.poly(g, [0, 216, 0, 170, 70, 164, 150, 176, 230, 180, 270, 216], '#352a40');
      for (const [x, y, rx] of [[60, 150, 14], [120, 160, 10], [30, 176, 18]]) A.ell(g, x, y, rx, rx * 0.4, 'rgba(255,190,150,0.18)', null);
      // fener: beyaz sekizgen kule, kırmızı fener odası
      const tx = 76;
      A.poly(g, [tx - 12, 146, tx + 12, 146, tx + 8.6, 58, tx - 8.6, 58], A.lgrad(g, tx - 12, 0, tx + 12, 0, [[0, '#d8d2c8'], [0.4, '#fbf8f2'], [1, '#c4bcb0']]));
      for (const y of [80, 104, 128]) A.rect(g, tx - 11, y, 22, 1.2, 'rgba(120,110,100,0.35)');
      for (const y of [76, 100, 124]) A.box(g, tx - 2, y, 4, 7, 1.8, '#3a3a52', null);
      A.box(g, tx - 13, 54, 26, 5, 1.4, '#5a5260');
      A.box(g, tx - 8.4, 40, 16.8, 14.4, 1.6, '#fff2b0');
      for (let k = 0; k < 3; k++) A.line(g, tx - 4 + k * 4, 40.6, tx - 4 + k * 4, 53.8, '#5a5260', 0.9);
      A.poly(g, [tx - 11, 41, tx + 11, 41, tx, 27], '#c8302a');
      A.line(g, tx, 27, tx, 22, '#2a2030', 1.4);
      g.fillStyle = 'rgba(255,240,180,0.28)'; g.beginPath(); g.moveTo(tx + 8, 46); g.lineTo(236, 16); g.lineTo(236, 78); g.closePath(); g.fill();
      const gl = g.createRadialGradient(tx, 47, 2, tx, 47, 30); gl.addColorStop(0, 'rgba(255,240,180,0.6)'); gl.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gl; g.fillRect(tx - 30, 17, 60, 60);
      // küçük balıkçı köyü
      for (const [x, w, h, c] of [[112, 20, 14, '#e4b496'], [134, 16, 18, '#f0d494'], [152, 22, 12, '#c8a0b8']]) { A.box(g, x, 148 - h, w, h, 1, c); A.poly(g, [x - 2, 148 - h, x + w + 2, 148 - h, x + w / 2, 141 - h], '#8a3e2e'); A.box(g, x + w / 2 - 2, 141 - h + 10, 4, 4, 0.6, '#ffd27a', null); }
      carSide(g, 116, 160, col);
    },
    kopru: (col) => (g) => {
      sunsetSky(g, 270, 100, 140);
      sea(g, 140, 270);
      A.LW = 1.4;
      // iki yakanın tepeleri, ışıklar
      A.poly(g, [0, 140, 0, 104, 50, 96, 110, 112, 140, 140], '#3e2e58', null);
      A.poly(g, [384, 140, 384, 100, 330, 92, 280, 114, 250, 140], '#3e2e58', null);
      const r = A.rng(3);
      for (let k = 0; k < 60; k++) { const x = r() < 0.5 ? r() * 120 : 260 + r() * 124, y = 112 + r() * 26; A.rect(g, x, y, 1, 1, r() < 0.5 ? '#ffd27a' : '#fff0c0'); }
      // Fatih Sultan Mehmet Köprüsü: dikey askılar, yüksek portal kuleler
      const c = '#f2e6dc', deckY = 120;
      A.rect(g, 0, deckY, W, 3.4, c);
      const t1 = 92, t2 = 292, top = 36, low = deckY - 4, cy = 2 * low - top;
      const cab = (x) => { const t = (x - t1) / (t2 - t1); return (1 - t) * (1 - t) * top + 2 * t * (1 - t) * cy + t * t * top; };
      g.strokeStyle = 'rgba(242,230,220,0.6)'; g.lineWidth = 0.6; g.beginPath();
      for (let x = t1 + 6; x < t2; x += 6) { g.moveTo(x, cab(x)); g.lineTo(x, deckY); }
      for (let x = 6; x < t1; x += 8) { const y = deckY - (deckY - top) * Math.pow(x / t1, 1.7); g.moveTo(x, y); g.lineTo(x, deckY); }
      for (let x = t2 + 8; x < W; x += 8) { const y = deckY - (deckY - top) * Math.pow((W - x) / (W - t2), 1.7); g.moveTo(x, y); g.lineTo(x, deckY); }
      g.stroke();
      g.strokeStyle = c; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-4, deckY); g.quadraticCurveTo(t1 * 0.5, deckY - 6, t1, top); g.quadraticCurveTo((t1 + t2) / 2, cy, t2, top); g.quadraticCurveTo((t2 + W) / 2, deckY - 6, W + 4, deckY); g.stroke();
      for (const x of [t1, t2]) { A.rect(g, x - 4, top - 2, 3, H, c); A.rect(g, x + 1, top - 2, 3, H, c); for (const y of [top + 4, top + 34, deckY + 8]) A.rect(g, x - 5, y, 10, 2.4, c); A.circ(g, x, top - 4, 1.4, '#ff4a3a', null); }
      for (let x = 6; x < W; x += 12) A.rect(g, x, deckY + 0.8, 2.4, 1.6, '#ffe9a0');
      // seyir terası
      A.rect(g, 0, 182, W, 34, '#2e2438');
      A.rect(g, 0, 180, W, 3, '#6a5a6a');
      for (let x = 2; x < W; x += 12) A.box(g, x, 164, 2.6, 17, 1, '#6a5a6a', null);
      A.box(g, 0, 162, W, 3, 1.4, '#7a6a7a', null);
      carSide(g, 40, 186, col);
      for (const x of [300, 340]) { A.line(g, x, 182, x, 150, '#2a2030', 1.6); A.circ(g, x, 148, 3, '#ffe9a0', null); const gl = g.createRadialGradient(x, 148, 1, x, 148, 16); gl.addColorStop(0, 'rgba(255,233,160,0.5)'); gl.addColorStop(1, 'rgba(255,233,160,0)'); g.fillStyle = gl; g.fillRect(x - 16, 132, 32, 32); }
    },
    yogurt: (col) => (g) => {
      skyGrad(g, [[0, '#4a3e86'], [0.6, '#d07a8a'], [1, '#ffb878']], 120);
      sun(g, 300, 100, 16);
      sea(g, 120, 300, '#5a5aa0');
      A.LW = 1.2;
      // karşı kıyı ve yalılar
      A.poly(g, [0, 120, 0, 94, 120, 88, 260, 96, 384, 90, 384, 120], '#3a3058', null);
      for (let x = 8; x < 380; x += 32) {
        A.box(g, x, 102, 24, 18, 0.6, '#7a3a34', null); A.poly(g, [x - 2, 102, x + 26, 102, x + 22, 97, x + 2, 97], '#4a2a2a', null);
        A.rect(g, x + 4, 107, 4, 5, '#ffd27a'); A.rect(g, x + 14, 107, 4, 5, '#ffd27a');
      }
      // iskele, Kanlıca levhası
      A.rect(g, 0, 150, W, 66, '#7a5436');
      g.strokeStyle = '#5a3a24'; g.lineWidth = 1; for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x - 30, 216); g.stroke(); }
      A.rect(g, 0, 150, W, 3, '#9a7454');
      A.line(g, 340, 150, 340, 112, '#3a3040', 2);
      A.box(g, 316, 104, 48, 12, 2, '#1e4a8a', A.K, 1.2); A.label(g, 'KANLICA', 340, 110.4, 7.4, '#ffffff');
      // masa
      A.LW = 1.6;
      A.box(g, 148, 134, 156, 9, 2, '#fbf6ea');
      for (const x of [160, 290]) A.box(g, x - 2, 143, 4, 42, 1, '#5a4030');
      // yoğurt kâsesi (mavi çizgili), pudra şekeri, kaşık
      g.beginPath(); g.moveTo(178, 116); g.lineTo(272, 116); g.quadraticCurveTo(268, 134, 248, 136); g.lineTo(202, 136); g.quadraticCurveTo(182, 134, 178, 116); g.closePath();
      g.fillStyle = '#fbfbf8'; g.fill(); g.strokeStyle = A.K; g.lineWidth = 1.6; g.stroke();
      g.save(); g.clip(); A.rect(g, 170, 121, 110, 3, '#2a6ab0'); A.rect(g, 170, 127, 110, 2, '#2a6ab0'); g.restore();
      A.ell(g, 225, 116, 47, 8, '#fffaf0');
      const r = A.rng(5);
      for (let i = 0; i < 180; i++) { const a = r() * TAU, d = Math.sqrt(r()); A.circ(g, 225 + Math.cos(a) * d * 40, 115 + Math.sin(a) * d * 6, 0.6, '#ffffff', null); }
      A.ell(g, 225, 114, 20, 3.4, '#ffffff', null);
      A.LW = 1.2;
      A.box(g, 251, 92, 3.4, 24, 1.4, '#c8ccd4'); A.ell(g, 252.7, 92, 4.2, 3, '#c8ccd4');
      // ince belli çay bardağı ve tabağı
      A.ell(g, 288, 134, 9, 2, '#fbf6ea');
      g.beginPath(); g.moveTo(283, 118); g.quadraticCurveTo(286, 124, 284.6, 127); g.quadraticCurveTo(283, 131, 284.5, 133); g.lineTo(291.5, 133); g.quadraticCurveTo(293, 131, 291.4, 127); g.quadraticCurveTo(290, 124, 293, 118); g.closePath();
      g.fillStyle = A.lgrad(g, 283, 0, 293, 0, [[0, '#9a1e10'], [0.5, '#d2421e'], [1, '#8a1a0c']]); g.fill(); g.strokeStyle = A.K; g.lineWidth = 1; g.stroke();
      A.rect(g, 283.4, 118, 9.2, 1.4, 'rgba(255,255,255,0.4)');
      carSide(g, 18, 180, col);
    },
    kale: (col) => (g) => {
      sunsetSky(g, 300, 112, 124);
      sea(g, 122, 300);
      A.LW = 1.4;
      // Karadeniz'e açılan Boğaz ağzı
      A.poly(g, [0, 122, 0, 98, 60, 102, 92, 122], '#3e2e58', null);
      A.poly(g, [384, 122, 384, 94, 320, 102, 296, 122], '#3e2e58', null);
      for (let i = 0; i < 4; i++) seagull(g, 230 + i * 26, 60 + (i % 2) * 12, 1);
      // tepe
      A.LW = 1.6;
      g.beginPath(); g.moveTo(0, 216); g.lineTo(0, 150); g.quadraticCurveTo(120, 112, 260, 128); g.quadraticCurveTo(330, 138, 384, 160); g.lineTo(384, 216); g.closePath();
      g.fillStyle = A.lgrad(g, 0, 120, 0, 216, [[0, '#5a7a3a'], [1, '#2e4424']]); g.fill(); g.strokeStyle = A.K; g.stroke();
      // kale kalıntısı
      const st = '#b09c80', sh = '#7e6c54';
      const parts = [[56, 42, 64, 1], [94, 62, 42, 2], [150, 34, 82, 3], [180, 66, 50, 4], [242, 36, 62, 5]];
      for (const [x, w, h, s] of parts) {
        const base = 136, top = base - h, rr = A.rng(s * 17);
        g.beginPath(); g.moveTo(x, base + 6); g.lineTo(x, top);
        for (let k = x; k < x + w - 4; k += 8) { const d = rr() < 0.3 ? 3 + rr() * 6 : 0; g.lineTo(k, top + d); g.lineTo(k, top - 6 + d); g.lineTo(k + 4.4, top - 6 + d); g.lineTo(k + 4.4, top + d); }
        g.lineTo(x + w, top + 2); g.lineTo(x + w, base + 6); g.closePath();
        g.fillStyle = A.lgrad(g, x, 0, x + w, 0, [[0, A.shade(st, 0.15)], [1, sh]]); g.fill(); g.strokeStyle = A.K; g.lineWidth = 1.4; g.stroke();
        g.save(); g.clip(); g.strokeStyle = 'rgba(70,56,40,0.4)'; g.lineWidth = 0.7; for (let y = top + 4; y < base + 6; y += 5) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); } g.restore();
      }
      A.archWin(g, 158, 90, 18, 28, '#2a2026', A.K);
      for (const [x, y] of [[70, 96], [118, 108], [200, 104], [256, 98]]) A.box(g, x, y, 4, 9, 1.6, '#2a2026', null);
      carSide(g, 40, 176, col);
    },
    // İstanbul Turu: Cankurtaran sahili, gün batımı; tepede Sultanahmet ve Ayasofya, önde surlar
    tur: (col) => (g) => {
      sunsetSky(g, 70, 108, 132);
      sea(g, 130, 70);
      // Marmara'da demirli gemiler, uzakta Adalar
      A.LW = 1.2;
      A.poly(g, [0, 130, 0, 122, 26, 118, 52, 124, 70, 130], '#4a3a66', null);
      for (const [x, w] of [[96, 34], [150, 24]]) { A.box(g, x, 122, w, 5, 1, '#3a2e52', null); A.rect(g, x + w * 0.6, 116, 5, 7, '#3a2e52'); }
      for (let i = 0; i < 4; i++) seagull(g, 60 + i * 30, 48 + (i % 2) * 12, 1.1);
      // tarihi yarımadanın sırtı
      g.beginPath(); g.moveTo(150, 140); g.bezierCurveTo(190, 104, 250, 96, 384, 92); g.lineTo(384, 150); g.lineTo(150, 150); g.closePath();
      g.fillStyle = A.lgrad(g, 0, 92, 0, 150, [[0, '#4e4466'], [1, '#3a3050']]); g.fill();
      const r = A.rng(11);
      for (let k = 0; k < 40; k++) { const x = 170 + r() * 214, y = 110 + r() * 34; A.rect(g, x, y, 1.2, 1.2, r() < 0.5 ? '#ffd27a' : '#fff0c0'); }
      // simgeler: gündüz çizimleri gün batımı ışığıyla boyanır
      const warm = (k, w, x, y) => {
        const img = A.sprite(k, {}, w * A.S);
        const h = w * img.lh / img.lw;
        const t = A.mk(w, h, (gg) => {
          gg.drawImage(img, 0, 0, w, h);
          gg.globalCompositeOperation = 'source-atop';
          gg.fillStyle = 'rgba(255,130,90,0.28)'; gg.fillRect(0, 0, w, h);
          gg.fillStyle = 'rgba(40,20,70,0.22)'; gg.fillRect(0, h * 0.55, w, h * 0.45);
        });
        g.drawImage(t, x, y - h, w, h);
      };
      warm('ayasofya', 112, 182, 128);
      warm('sultanahmet', 122, 262, 124);
      // sur ve sahil yolu
      A.LW = 1.4;
      A.rect(g, 140, 140, 244, 22, '#9a7e6a');
      for (let x = 142; x < 384; x += 10) A.box(g, x, 134, 6, 7, 1, '#9a7e6a', null);
      A.rect(g, 140, 147, 244, 2.4, '#8a5444'); A.rect(g, 140, 153, 244, 2, '#8a5444');
      A.poly(g, [0, 162, 0, 156, 140, 152, 384, 160, 384, 162], '#6a5a6a', null);
      // yol ve kıyı korkuluğu
      A.rect(g, 0, 162, W, 54, '#3a3442');
      for (let x = 0; x < W; x += 34) A.rect(g, x, 186, 18, 2, '#ece8e0');
      A.rect(g, 0, 160, W, 3, '#cc3a2e');
      for (const x of [40, 160, 290]) { A.line(g, x, 162, x, 128, '#2a2030', 1.6); A.circ(g, x, 126, 3, '#ffe9a0', null); const gl = g.createRadialGradient(x, 126, 1, x, 126, 16); gl.addColorStop(0, 'rgba(255,233,160,0.5)'); gl.addColorStop(1, 'rgba(255,233,160,0)'); g.fillStyle = gl; g.fillRect(x - 16, 110, 32, 32); }
      carSide(g, 150, 182, col);
      // CANKURTARAN levhası
      A.line(g, 340, 162, 340, 140, '#5a6070', 2);
      A.box(g, 300, 128, 80, 14, 2, '#1e7a4a', A.K, 1.2); A.label(g, 'CANKURTARAN', 340, 135.4, 8, '#ffffff');
    },
  };
  const cache = {};
  function scene(k, col) {
    const key = k + (col || '') + '@' + A.S;
    if (!cache[key]) cache[key] = A.mk(W, H, (scenes[k] || scenes.fener)(col || '#e0352c'));
    return cache[key];
  }
  root.BY_ENDINGS = { scene };
})(window);
