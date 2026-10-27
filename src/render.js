// Boğaz Yolu — sözde-3D yol çizici: gökyüzü, uzak kıyı, yol şeritleri, deniz, nesneler, trafik, oyuncu arabası.
(function (root) {
  'use strict';
  const BY = root.BY, ART = root.BY_ART, TR = root.BY_TRACK;
  const W = 384, H = 216, HW = W / 2, HH = H / 2;
  const DRAW = 260;
  const { SEG, RW, CAM_H, CAM_DEPTH, PLAYER_Z, MAX } = BY;
  const K = '#141018';

  const skyCache = [];
  function sky(T, i) {
    if (!skyCache[i]) {
      skyCache[i] = ART.mk(W, HH + 4, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, HH);
        gr.addColorStop(0, T.sky[0]); gr.addColorStop(1, T.sky[1]);
        g.fillStyle = gr; g.fillRect(0, 0, W, HH + 4);
      });
    }
    return skyCache[i];
  }
  function tile(ctx, img, off, y) {
    const w = img.width;
    let x = -(((off % w) + w) % w);
    for (; x < W; x += w) ctx.drawImage(img, Math.round(x), Math.round(y));
  }
  function quad(ctx, x1, y1, w1, x2, y2, w2, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1);
    ctx.closePath(); ctx.fill();
  }
  function band(ctx, x1, y1, a1, b1, x2, y2, a2, b2, col) { // x+a..x+b arası şerit
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x1 + a1, y1); ctx.lineTo(x2 + a2, y2); ctx.lineTo(x2 + b2, y2); ctx.lineTo(x1 + b1, y1);
    ctx.closePath(); ctx.fill();
  }

  // seg: {X1,Y1,W1,X2,Y2,W2} ana yol merkezinin ekran izdüşümü (cx için)
  function drawStrip(ctx, s, p, T, n) {
    const light = Math.floor(s.i / 3) % 2 === 0;
    const { X1, Y1, W1, X2, Y2, W2 } = p;
    const y1 = Math.min(Y1, p.maxy);
    if (y1 <= Y2) return;
    const land = s.sea === 'B' ? (light ? T.seaDark : T.sea) : s.fork > 0 && s.land === 'city' ? (light ? T.park[0] : T.park[1]) : s.land === 'city' ? (light ? T.pave[0] : T.pave[1]) : s.land === 'forest' ? (light ? T.forest[0] : T.forest[1]) : (light ? T.park[0] : T.park[1]);
    ctx.fillStyle = land;
    ctx.fillRect(0, Math.floor(Y2), W, Math.ceil(y1 - Y2) + 1);
    const forkU = s.fork / RW;
    const roads = forkU > 0 ? [-forkU, forkU] : [0];
    // yolun en dış kenarları (yarı yol cinsinden)
    const lo = roads[0] - 1, hi = roads[roads.length - 1] + 1;
    // kaldırım ve deniz
    const seaR = s.sea === 'R' || s.sea === 'B', seaL = s.sea === 'L' || s.sea === 'B';
    const pave = light ? T.pave[0] : T.pave[1];
    if (seaR) {
      band(ctx, X1, Y1, hi * W1, (hi + 0.3) * W1, X2, Y2, hi * W2, (hi + 0.3) * W2, s.sea === 'B' ? '#8a8a92' : pave);
      band(ctx, X1, Y1, (hi + 0.3) * W1, W * 4, X2, Y2, (hi + 0.3) * W2, W * 4, light ? T.sea : T.seaDark);
    }
    if (seaL) {
      band(ctx, X1, Y1, (lo - 0.3) * W1, lo * W1, X2, Y2, (lo - 0.3) * W2, lo * W2, s.sea === 'B' ? '#8a8a92' : pave);
      band(ctx, X1, Y1, -W * 4, (lo - 0.3) * W1, X2, Y2, -W * 4, (lo - 0.3) * W2, light ? T.sea : T.seaDark);
    }
    if (s.sea === 'B') {
      // köprü kenar betonu
      band(ctx, X1, Y1, (hi + 0.3) * W1, (hi + 0.38) * W1, X2, Y2, (hi + 0.3) * W2, (hi + 0.38) * W2, '#5a5a64');
      band(ctx, X1, Y1, (lo - 0.38) * W1, (lo - 0.3) * W1, X2, Y2, (lo - 0.38) * W2, (lo - 0.3) * W2, '#5a5a64');
    }
    // öteki kolun kuyruğu (ayrımdan sonra uzaklaşır)
    if (s.tail !== null && s.tail !== undefined && s.tailA > 0) {
      const off = (s.tail - s.cx) / RW;
      ctx.globalAlpha = s.tailA;
      band(ctx, X1, Y1, (off - 1.1) * W1, (off + 1.1) * W1, X2, Y2, (off - 1.1) * W2, (off + 1.1) * W2, light ? '#e8e4dc' : '#c4302a');
      band(ctx, X1, Y1, (off - 1) * W1, (off + 1) * W1, X2, Y2, (off - 1) * W2, (off + 1) * W2, light ? '#6a6a72' : '#646470');
      ctx.globalAlpha = 1;
    }
    // kenar taşları (kırmızı-beyaz)
    const rumble = light ? '#e8e4dc' : '#c4302a';
    for (const c of roads) band(ctx, X1, Y1, (c - 1.1) * W1, (c + 1.1) * W1, X2, Y2, (c - 1.1) * W2, (c + 1.1) * W2, rumble);
    const asph = light ? '#6a6a72' : '#646470';
    for (const c of roads) band(ctx, X1, Y1, (c - 1) * W1, (c + 1) * W1, X2, Y2, (c - 1) * W2, (c + 1) * W2, asph);
    // şerit çizgileri
    if (light) {
      const lw1 = Math.max(0.5, W1 * 0.025), lw2 = Math.max(0.5, W2 * 0.025);
      for (const c of roads) for (const l of [-1 / 3, 1 / 3]) band(ctx, X1, Y1, (c + l) * W1 - lw1, (c + l) * W1 + lw1, X2, Y2, (c + l) * W2 - lw2, (c + l) * W2 + lw2, '#f0eee8');
    }
    // kontrol / başlangıç / bitiş çizgisi
    if (s.line) band(ctx, X1, Y1, -W1, W1, X2, Y2, -W2, W2, s.line);
    // sis
    const f = Math.min(1, Math.max(0, (n / DRAW - 0.2) / 0.8));
    if (f > 0) { ctx.globalAlpha = Math.pow(f, 1.4) * 0.9; ctx.fillStyle = T.haze; ctx.fillRect(0, Math.floor(Y2), W, Math.ceil(y1 - Y2) + 1); ctx.globalAlpha = 1; }
  }

  function drawSprite(ctx, img, x, y, w, clipY, flip, alpha) {
    const h = w * img.height / img.width;
    if (w < 0.6 || y - h >= clipY) return;
    let sh = img.height, dh = h;
    if (y > clipY) { const cut = (y - clipY) / h; sh = img.height * (1 - cut); dh = h * (1 - cut); }
    if (sh <= 0) return;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save(); ctx.translate(Math.round(x + w / 2), 0); ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, img.width, sh, 0, Math.round(y - h), Math.round(w), Math.round(dh));
      ctx.restore();
    } else ctx.drawImage(img, 0, 0, img.width, sh, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(dh));
    if (alpha !== undefined) ctx.globalAlpha = 1;
  }

  const fx = [];
  function render(ctx, G, opts) {
    opts = opts || {};
    const camZ = G.pos;
    const pz = camZ + PLAYER_Z;
    const ps = BY.segAt(G, pz);
    const pPct = (pz % SEG) / SEG;
    const playerY = ps.y1 + (ps.y2 - ps.y1) * pPct;
    const camY = playerY + CAM_H;
    const base = BY.segAt(G, camZ);
    const basePct = (camZ % SEG) / SEG;
    const time = TR.STAGES[ps.stage].time;
    const T = ART.TIMES[time];
    const bgX = G.bgX || 0;

    // gökyüzü ve uzak kıyı
    ctx.drawImage(sky(T, time), 0, 0);
    ctx.fillStyle = T.sky[1]; ctx.fillRect(0, HH, W, HH);
    const sx = ((W * 0.68 - bgX * 0.25) % (W * 2) + W * 2) % (W * 2) - W * 0.3;
    ART.disc(ctx, sx, T.sun.y, T.sun.r + 3, ART.mix(T.sun.c, T.sky[1], 0.6));
    ART.disc(ctx, sx, T.sun.y, T.sun.r, T.sun.c);
    tile(ctx, ART.clouds(time), bgX * 0.3, 6);
    const pan = ART.panorama(time, ps.stage % 3);
    tile(ctx, pan, bgX * 0.6, HH - pan.height + 2);
    ctx.fillStyle = T.sea; ctx.fillRect(0, HH + 1, W, HH);
    if (time >= 2) { ctx.globalAlpha = 0.35; ctx.fillStyle = T.sun.c; ctx.fillRect(sx - 10, HH + 2, 20, 2); ctx.fillRect(sx - 6, HH + 6, 12, 2); ctx.globalAlpha = 1; }

    // yol
    let maxy = H, x = 0, dx = -(base.curve * basePct);
    const drawn = [];
    for (let n = 0; n < DRAW; n++) {
      const s = G.track[base.i + n];
      if (!s) break;
      const z1 = s.i * SEG - camZ, z2 = z1 + SEG;
      const xa = x, xb = x + dx;
      x += dx; dx += s.curve;
      if (z1 <= CAM_DEPTH * 2) continue;
      const sc1 = CAM_DEPTH / z1, sc2 = CAM_DEPTH / z2;
      const X1 = HW + sc1 * (s.cx - G.px + xa) * HW, X2 = HW + sc2 * (s.cx - G.px + xb) * HW;
      const Y1 = HH - sc1 * (s.y1 - camY) * HH, Y2 = HH - sc2 * (s.y2 - camY) * HH;
      const W1 = sc1 * RW * HW, W2 = sc2 * RW * HW;
      if (Y2 >= Y1 || Y2 >= maxy) { s.vis = null; continue; }
      const p = { X1, Y1, W1, X2, Y2, W2, sc1, sc2, maxy, n };
      drawStrip(ctx, s, p, T, n);
      s.vis = p;
      drawn.push(s);
      maxy = Y2;
    }

    // trafik araçlarını segmentlere dağıt
    const carsBySeg = new Map();
    for (const c of G.cars) {
      const i = Math.floor(c.z / SEG);
      if (!carsBySeg.has(i)) carsBySeg.set(i, []);
      carsBySeg.get(i).push(c);
    }
    // nesneler ve araçlar: uzaktan yakına
    const cableTop = { '-1': null, '1': null };
    for (let k = drawn.length - 1; k >= 0; k--) {
      const s = drawn[k], p = s.vis;
      const clip = p.maxy;
      for (const sp of s.sprites) {
        const size = ART.SIZE[sp.k];
        if (!size) continue;
        const sxp = p.X1 + sp.x * p.W1;
        if (sp.k === 'aski') {
          // askı halatı: kulelerin arasında sarkan ana halatın izini çizer
          const top = p.Y1 - sp.h * 8000 * p.sc1 * HH;
          const lw = Math.max(1, p.W1 * 0.02);
          if (sxp < -50 || sxp > W + 50) continue;
          ctx.fillStyle = '#d8d4cc';
          if (top < clip) ctx.fillRect(Math.round(sxp - lw / 2), Math.round(top), Math.max(1, Math.round(lw)), Math.round(Math.min(p.Y1, clip) - top));
          const side = sp.x < 0 ? '-1' : '1';
          const prev = cableTop[side];
          if (prev && top < clip) { ctx.strokeStyle = '#e8e4dc'; ctx.lineWidth = Math.max(1, lw * 2); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(sxp, top); ctx.stroke(); }
          cableTop[side] = [sxp, top];
          continue;
        }
        const img = ART.sprite(sp.k, sp);
        const w = size * RW * p.sc1 * HW;
        if (sxp + w < -20 || sxp - w > W + 20) continue;
        drawSprite(ctx, img, sxp, p.Y1, w, clip, sp.flip);
      }
      const cars = carsBySeg.get(s.i);
      if (cars) {
        for (const c of cars) {
          const t = (c.z % SEG) / SEG;
          const sc = p.sc1 + (p.sc2 - p.sc1) * t;
          const X = p.X1 + (p.X2 - p.X1) * t, Y = p.Y1 + (p.Y2 - p.Y1) * t;
          const w = ART.CAR_SIZE[c.kind] * RW * sc * HW;
          const cx = X + c.x * (p.W1 + (p.W2 - p.W1) * t);
          const img = ART.car(c.kind, c.color);
          // gölge
          if (Y < clip && w > 3) { ctx.globalAlpha = 0.3; ART.ellipse(ctx, cx, Y - w * 0.02, Math.round(w * 0.55), Math.max(1, Math.round(w * 0.06)), '#000000'); ctx.globalAlpha = 1; }
          drawSprite(ctx, img, cx, Y, w, clip, false);
        }
      }
    }

    // oyuncu arabası
    if (!opts.noPlayer) drawPlayer(ctx, G, ps, playerY, camY, opts);
    // toz / duman
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += 1 / 60; f.x += f.vx; f.y += f.vy; f.r += 0.4;
      if (f.t > f.life) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - f.t / f.life) * 0.6; ART.disc(ctx, f.x, f.y, Math.round(f.r), f.c); ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(ctx, G, ps, playerY, camY, opts) {
    const sc = CAM_DEPTH / PLAYER_Z;
    const groundY = HH - sc * (playerY - camY) * HH;
    const sp = G.speed / MAX;
    let turn = Math.round(G.steerVis * 2 + (ps.curve > 2 ? 1 : ps.curve < -2 ? -1 : 0) * (sp > 0.3 ? 1 : 0));
    turn = Math.max(-2, Math.min(2, turn));
    let bounce = 0;
    if (G.offroad && sp > 0.1) bounce = Math.random() < 0.5 ? -1 : 1;
    else if (sp > 0.05 && Math.random() < sp * 0.15) bounce = -1;
    const img = ART.player(G.phase === 'crash' ? (Math.floor(G.crashT * 10) % 2 ? 2 : -2) * G.crashDir : turn, opts.brake || G.phase === 'crash', opts.color || 'kirmizi');
    const x = Math.round(HW - img.width / 2), y = Math.round(groundY - img.height + 2 + bounce);
    ctx.globalAlpha = 0.35; ART.ellipse(ctx, HW, groundY, 46, 4, '#000000'); ctx.globalAlpha = 1;
    if (G.phase === 'crash') {
      const a = Math.sin(G.crashT * 14) * 0.25 * Math.max(0, 1 - G.crashT / 1.6) * G.crashDir;
      ctx.save(); ctx.translate(HW, groundY - 20); ctx.rotate(a); ctx.drawImage(img, -img.width / 2, -img.height + 22); ctx.restore();
      if (Math.random() < 0.5) fx.push({ x: HW + (Math.random() - 0.5) * 60, y: groundY - 6, vx: (Math.random() - 0.5) * 1.2, vy: -0.6, r: 3, t: 0, life: 0.8, c: '#e8e4dc' });
    } else ctx.drawImage(img, x, y);
    if (G.offroad && sp > 0.15 && Math.random() < 0.6) fx.push({ x: HW + (Math.random() < 0.5 ? -36 : 36), y: groundY - 4, vx: (Math.random() - 0.5) * 0.8, vy: -0.4, r: 2, t: 0, life: 0.6, c: G.offroadColor || '#c8b890' });
    if (G.skid && Math.random() < 0.7) fx.push({ x: HW + (Math.random() < 0.5 ? -34 : 34), y: groundY - 3, vx: (Math.random() - 0.5) * 0.6, vy: -0.3, r: 2, t: 0, life: 0.5, c: '#f0f0f0' });
  }

  root.BY_RENDER = { W, H, render, fx };
})(window);
