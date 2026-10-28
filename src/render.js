// Boğaz Yolu — sözde-3D yol çizici: gökyüzü, uzak kıyı, yol şeritleri, deniz, köprü, otoyol, tünel, nesneler, trafik, oyuncu arabası.
// Mantıksal ekran 384×216 birimdir; kanvas ekranın gerçek çözünürlüğünde, ctx S ölçeğinde gelir (main.js).
(function (root) {
  'use strict';
  const BY = root.BY, ART = root.BY_ART, TR = root.BY_TRACK;
  const W = 384, H = 216, HW = W / 2, HH = H / 2;
  const DRAW = 260;
  const { SEG, RW, CAM_H, CAM_DEPTH, PLAYER_Z, MAX } = BY;
  const TUN_H = TR.TUN_H;
  const TUN_HAZE = '#20222c';
  // tünel kesiti (yarı yol genişliği / tavan yüksekliği cinsinden): duvar, pah, tavan
  const TW = 1.25, TC = 0.82, TWH = 0.58;
  // yüksek simgeler: tepe arkasında kalsalar da üstleri görünür
  const TALL = { cami: 1, saray: 1, kale: 1, hisar: 1, kiz_kulesi: 1, kopru_uzak: 1, kopru_kule: 1, ayasofya: 1, sultanahmet: 1, galata_kulesi: 1, camlica_kulesi: 1, camlica_camii: 1 };

  // sis rengi karışımları önbelleği (renk + 32 kademe)
  const fogCache = new Map();
  function fog(col, haze, f) {
    if (f <= 0) return col;
    const q = Math.min(31, Math.round(f * 31));
    const key = col + haze + q;
    let c = fogCache.get(key);
    if (!c) { c = ART.mix(col, haze, q / 31); fogCache.set(key, c); if (fogCache.size > 4000) fogCache.clear(); }
    return c;
  }
  // gökyüzü: saat başına bir kez, cihaz ölçeğinde
  const skyCache = new Map();
  function sky(T, i) {
    const key = i + '@' + ART.S;
    let c = skyCache.get(key);
    if (!c) {
      c = ART.mk(W, HH + 4, (g) => {
        g.fillStyle = ART.lgrad(g, 0, 0, 0, HH, [[0, T.sky[0]], [1, T.sky[1]]]);
        g.fillRect(0, 0, W, HH + 4);
      });
      skyCache.set(key, c);
    }
    return c;
  }
  // tekrarlanan şerit görüntü (bulutlar, uzak kıyı): cihaz pikseline oturtulur
  function tile(ctx, img, off, y) {
    const S = ART.S, Wd = Math.round(img.lw * S), Hd = Math.round(img.lh * S);
    let X = -Math.round((((off % img.lw) + img.lw) % img.lw) * S);
    const Y = Math.round(y * S);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (; X < W * S; X += Wd) ctx.drawImage(img, X, Y, Wd, Hd);
    ctx.restore();
  }
  function band(ctx, x1, y1, a1, b1, x2, y2, a2, b2, col) { // x+a..x+b arası şerit
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x1 + a1, y1); ctx.lineTo(x2 + a2, y2); ctx.lineTo(x2 + b2, y2); ctx.lineTo(x1 + b1, y1);
    ctx.closePath(); ctx.fill();
  }
  // dörtgen: dolgu ve aynı renkte ince çizgi (yan yana yüzeylerin arasında dikiş kalmasın)
  function quad(ctx, pts, col, noStroke) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); ctx.fill();
    if (!noStroke) { ctx.strokeStyle = col; ctx.lineWidth = 0.6; ctx.stroke(); }
  }
  // tünel kesitinin ekrandaki noktası: x yol genişliği, h dünya yüksekliği
  const tp = (X, Y, Wd, sc, x, h) => [X + x * Wd, Y - sc * h * HH];
  // tünel kesiti çokgeni (bir şeridin uzak kenarında)
  function tunnelSection(X, Y, Wd, sc) {
    const pts = [];
    for (const [x, h] of [[-TW, 0], [-TW, TWH * TUN_H], [-TC, TUN_H], [TC, TUN_H], [TW, TWH * TUN_H], [TW, 0]]) pts.push(...tp(X, Y, Wd, sc, x, h));
    return pts;
  }

  // Şeritler uzaktan yakına çizilir. Üst ve alt kenarlar cihaz pikseli satırlarına oturtulur:
  // yatay kenarlarda yumuşatma olmadığı için ardışık şeritlerin arasında ince çizgiler görünmez.
  // Sis renklere karıştırılır.
  function drawStrip(ctx, s, p, T) {
    const S = ART.S;
    const light = Math.floor(s.i / 3) % 2 === 0;
    const { X1, W1, X2, W2, n } = p;
    const Y1 = Math.round(p.Y1 * S) / S, Y2 = Math.round(p.Y2 * S) / S;
    const tun = s.sea === 'T';
    if (p.tallOnly || (Y1 <= Y2 && !p.hidden)) return;
    const f = Math.min(1, Math.max(0, (n / DRAW - 0.2) / 0.8));
    const fa = f > 0 ? Math.pow(f, 1.4) * 0.9 : 0;
    const C = tun ? (c) => fog(c, TUN_HAZE, Math.min(1, fa * 1.1)) : (c) => fog(c, T.haze, fa);
    const X2e = X2, W2e = W2;
    const B = (a1, b1, a2, b2, col) => band(ctx, X1, Y1, a1 * W1, b1 * W1, X2e, Y2, a2 * W2e, b2 * W2e, col);
    const forkU = s.fork / RW;
    const roads = forkU > 0 ? [-forkU, forkU] : [0];
    const lo = roads[0] - 1, hi = roads[roads.length - 1] + 1;
    if (!p.hidden) {
      const water = s.sea === 'B' || s.sea === 'G';
      const hwy = s.sea === 'N';
      const land = tun ? '#4a4e5c' : water ? (light ? T.seaDark : T.sea) : s.fork > 0 && s.land === 'city' ? (light ? T.park[0] : T.park[1]) : s.land === 'city' ? (light ? T.pave[0] : T.pave[1]) : s.land === 'forest' ? (light ? T.forest[0] : T.forest[1]) : (light ? T.park[0] : T.park[1]);
      ctx.fillStyle = C(land);
      ctx.fillRect(0, Y2, W, Y1 - Y2);
      const seaR = s.sea === 'R' || water, seaL = s.sea === 'L' || water;
      const pave = C(light ? T.pave[0] : T.pave[1]);
      const seaC = C(light ? T.sea : T.seaDark);
      if (seaR) {
        B(hi, hi + 0.3, hi, hi + 0.3, s.sea === 'B' ? C('#8a8a92') : pave);
        band(ctx, X1, Y1, (hi + 0.3) * W1, W * 4, X2e, Y2, (hi + 0.3) * W2e, W * 4, seaC);
      }
      if (seaL) {
        B(lo - 0.3, lo, lo - 0.3, lo, s.sea === 'B' ? C('#8a8a92') : pave);
        band(ctx, X1, Y1, -W * 4, (lo - 0.3) * W1, X2e, Y2, -W * 4, (lo - 0.3) * W2e, seaC);
      }
      if (water) {
        const edge = C(s.sea === 'G' ? '#3a4a6a' : '#5a5a64');
        B(hi + 0.3, hi + 0.38, hi + 0.3, hi + 0.38, edge);
        B(lo - 0.38, lo - 0.3, lo - 0.38, lo - 0.3, edge);
      }
      if (hwy) {
        // banket ve beton ayaklar; E-5'te solda metrobüs yolu ve karşı bariyer
        const conc = C(light ? '#c4bfb4' : '#b8b3a8');
        B(hi, hi + 0.22, hi, hi + 0.22, conc);
        B(lo - 0.22, lo, lo - 0.22, lo, conc);
        if (s.land === 'e5') {
          B(lo - 1.42, lo - 0.22, lo - 1.42, lo - 0.22, C(light ? '#5c5c66' : '#585862'));
          if (light) B(lo - 0.84, lo - 0.8, lo - 0.84, lo - 0.8, C('#e8c84a'));
          B(lo - 1.62, lo - 1.42, lo - 1.62, lo - 1.42, conc);
        }
      }
      if (tun) B(lo - 0.25, hi + 0.25, lo - 0.25, hi + 0.25, C(light ? '#7a7e8a' : '#727682'));
      // öteki kolun kuyruğu (ayrımdan sonra uzaklaşır)
      if (s.tail !== null && s.tail !== undefined && s.tailA > 0) {
        const off = (s.tail - s.cx) / RW;
        ctx.globalAlpha = s.tailA;
        B(off - 1.1, off + 1.1, off - 1.1, off + 1.1, C(light ? '#ece8e0' : '#cc3a2e'));
        B(off - 1, off + 1, off - 1, off + 1, C(light ? '#6a6a72' : '#646470'));
        ctx.globalAlpha = 1;
      }
      // kenar taşları (kırmızı-beyaz), asfalt, şerit çizgileri
      const rumble = C(light ? '#ece8e0' : '#cc3a2e');
      for (const c of roads) B(c - 1.1, c + 1.1, c - 1.1, c + 1.1, rumble);
      const asph = C(light ? '#6a6a72' : '#646470');
      for (const c of roads) B(c - 1, c + 1, c - 1, c + 1, asph);
      if (light) {
        const lw1 = Math.max(0.25, W1 * 0.025), lw2 = Math.max(0.25, W2e * 0.025);
        const lc = C('#f4f2ec');
        for (const c of roads) for (const l of [-1 / 3, 1 / 3]) band(ctx, X1, Y1, (c + l) * W1 - lw1, (c + l) * W1 + lw1, X2e, Y2, (c + l) * W2e - lw2, (c + l) * W2e + lw2, lc);
      }
      if (s.line) B(-1, 1, -1, 1, C(s.line));
    }
    if (tun) {
      // tünel: duvarlar (alt kaplama, şerit, üst kaplama), pahlar (lamba sırası) ve tavan
      const P1 = (x, h) => tp(X1, p.Y1, W1, p.sc1, x, h), P2 = (x, h) => tp(X2, p.Y2, W2, p.sc2, x, h);
      // uzaktaki küçük şeritlerde dikiş görünmez: çizgi yok, duvar tek parça
      const small = W1 < 22, tiny = W1 < 7;
      const face = (xa, ha, xb, hb, col) => quad(ctx, [...P1(xa, ha), ...P1(xb, hb), ...P2(xb, hb), ...P2(xa, ha)], C(col), small);
      const lamp = s.i % 4 === 0;
      const wh = TWH * TUN_H;
      for (const sg of [-1, 1]) {
        if (tiny) face(sg * TW, 0, sg * TW, wh, light ? '#c4c8d0' : '#bcc0c8');
        else {
          face(sg * TW, 0, sg * TW, 0.16 * TUN_H, light ? '#8e94a2' : '#868c9a');
          face(sg * TW, 0.16 * TUN_H, sg * TW, 0.23 * TUN_H, light ? '#2a6ad8' : '#2662c8');
          face(sg * TW, 0.23 * TUN_H, sg * TW, wh, light ? '#d6d9e0' : '#cbced6');
        }
        const mx = sg * (TW + TC) / 2, mh = (wh + TUN_H) / 2;
        face(sg * TW, wh, mx, mh, lamp ? '#fff1c0' : light ? '#9a9eaa' : '#9296a2');
        face(mx, mh, sg * TC, TUN_H, light ? '#7a7e8c' : '#747886');
      }
      face(-TC, TUN_H, TC, TUN_H, light ? '#4a4e5c' : '#444856');
    }
  }

  // yazı taşıyan nesneler aynalanmaz (tabelalar ters okunmasın)
  const NOFLIP = { apartman: 1, durak: 1, simitci: 1, tabela: 1, ayrim: 1, basla: 1, kontrol: 1, bitis: 1, levha: 1, tunel_agzi: 1, ustgecit: 1, tunel_levha: 1 };
  function drawSprite(ctx, img, x, y, w, clipY, flip) {
    const h = w * img.lh / img.lw;
    if (w < 0.4 || y - h >= clipY) return;
    let sh = img.height, dh = h;
    if (y > clipY) { const cut = (y - clipY) / h; sh = img.height * (1 - cut); dh = h * (1 - cut); }
    if (sh <= 0.5) return;
    if (flip) {
      ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, img.width, sh, -w / 2, y - h, w, dh);
      ctx.restore();
    } else ctx.drawImage(img, 0, 0, img.width, sh, x - w / 2, y - h, w, dh);
  }

  // E-5'in metrobüs yolundaki otobüsler: yalnız görüntü, çarpışmaz. Dünyada sabit aralıklı bir sıra halinde ilerler.
  const MB_GAP = 95 * SEG, MB_V = MAX * 0.5, MB_X = -1.72;
  function metrobuses(G, out) {
    const zlo = G.pos - SEG * 20, zhi = G.pos + SEG * (DRAW + 10);
    const off = (G.t * MB_V) % MB_GAP;
    for (const st of G.stages) {
      if (st.end * SEG < zlo || st.start * SEG > zhi) continue;
      for (const p of st.parts) {
        if (p.land !== 'e5') continue;
        const a = Math.max(zlo, p.start * SEG), b = Math.min(zhi, p.end * SEG);
        if (a >= b) continue;
        for (let k = Math.ceil((a - off) / MB_GAP); k * MB_GAP + off < b; k++) out.push({ kind: 'metrobus', z: k * MB_GAP + off, x: MB_X, color: 0 });
      }
    }
  }

  const fx = [];
  function render(ctx, G, opts) {
    opts = opts || {};
    const S = ART.S;
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

    // yol: önce görünür şeritleri yakından uzağa hesapla (tepe arkasında kalanlar atlanır; tünelde tavanları yine gerekir)
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
      const p = { X1, Y1, W1, X2, Y2, W2, sc1, sc2, maxy, n };
      if (Y2 >= Y1 || Y2 >= maxy) {
        // görünmeyen şerit (tepe arkasında ya da göz hizasının üstünde): tünelde tavanı, yüksek simgelerde
        // (cami, kule) tepeden taşan üstü yine çizilir
        if (s.sea === 'T' && Y2 < Y1) { p.hidden = true; s.vis = p; drawn.push(s); } else if (s.sprites.some((sp) => TALL[sp.k])) { p.hidden = p.tallOnly = true; s.vis = p; drawn.push(s); } else s.vis = null;
        continue;
      }
      s.vis = p;
      drawn.push(s);
      maxy = Y2;
    }
    // tünel: içerideyken ya da ağzına bakarken çıkışın ötesi yalnız çıkış kesitinden görünür
    let exitK = -1, exitPoly = null;
    for (let k = 0, inTun = false; k < drawn.length; k++) {
      if (drawn[k].sea === 'T') inTun = true;
      else if (inTun) { const q = drawn[k - 1].vis; exitK = k; exitPoly = tunnelSection(q.X2, q.Y2, q.W2, q.sc2); break; }
    }
    const lastTun = drawn.length && drawn[drawn.length - 1].sea === 'T';
    const camTun = base.sea === 'T' && exitK < 0;

    // gökyüzü, güneş, bulutlar, uzak kıyı
    if (camTun) {
      ctx.fillStyle = TUN_HAZE; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(sky(T, time), 0, 0); ctx.restore();
      ctx.fillStyle = T.sky[1]; ctx.fillRect(0, HH, W, HH);
      const sx = ((W * 0.68 - bgX * 0.25) % (W * 2) + W * 2) % (W * 2) - W * 0.3;
      const glow = ctx.createRadialGradient(sx, T.sun.y, T.sun.r * 0.6, sx, T.sun.y, T.sun.r * 4);
      glow.addColorStop(0, ART.mix(T.sun.c, T.sky[1], 0.2) + 'cc'); glow.addColorStop(1, T.sun.c + '00');
      ctx.fillStyle = glow; ctx.fillRect(sx - T.sun.r * 4, T.sun.y - T.sun.r * 4, T.sun.r * 8, T.sun.r * 8);
      ART.circ(ctx, sx, T.sun.y, T.sun.r, T.sun.c, null);
      tile(ctx, ART.clouds(time), bgX * 0.3, 4);
      const pan = ART.panorama(time, ps.stage % 3);
      tile(ctx, pan, bgX * 0.6, HH - pan.lh + 2);
      ctx.fillStyle = ART.lgrad(ctx, 0, HH, 0, H, [[0, ART.mix(T.sea, T.haze, 0.35)], [0.25, T.sea], [1, T.seaDark]]);
      ctx.fillRect(0, HH + 1.5, W, HH);
      if (time >= 2) {
        ctx.globalAlpha = 0.45; ctx.fillStyle = T.sun.c;
        for (let k = 0; k < 4; k++) { const w = 22 - k * 5; ctx.fillRect(sx - w / 2 + Math.sin(k * 2 + bgX * 0.01) * 2, HH + 3 + k * 2.6, w, 0.9); }
        ctx.globalAlpha = 1;
      }
    }
    // tünelin arkasına koyu zemin: uzaktaki küçük yüzeylerin arasından gökyüzü sızmasın.
    // Çıkış görünüyorsa çıkışın kesiti boş bırakılır; görünmüyorsa tünelin ucu da kararır.
    const kt = drawn.findIndex((s) => s.sea === 'T');
    if (kt >= 0) {
      const q = drawn[kt].vis, near = tunnelSection(q.X1, q.Y1, q.W1, q.sc1);
      ctx.fillStyle = TUN_HAZE; ctx.beginPath();
      for (const poly of exitPoly ? [near, exitPoly] : [near]) { ctx.moveTo(poly[0], poly[1]); for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]); ctx.closePath(); }
      ctx.fill('evenodd');
    }
    if (lastTun) {
      const q = drawn[drawn.length - 1].vis;
      quad(ctx, tunnelSection(q.X2, q.Y2, q.W2, q.sc2), TUN_HAZE);
    }
    for (let k = drawn.length - 1; k >= 0; k--) drawStrip(ctx, drawn[k], drawn[k].vis, T);

    // trafik araçlarını (ve metrobüsleri) segmentlere dağıt
    const carsBySeg = new Map();
    const cars = G.cars.slice();
    metrobuses(G, cars);
    for (const c of cars) {
      const i = Math.floor(c.z / SEG);
      if (!carsBySeg.has(i)) carsBySeg.set(i, []);
      carsBySeg.get(i).push(c);
    }
    // nesneler ve araçlar: uzaktan yakına
    const cableTop = { '-1': null, '1': null };
    let clipped = false;
    if (exitPoly) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(exitPoly[0], exitPoly[1]);
      for (let i = 2; i < exitPoly.length; i += 2) ctx.lineTo(exitPoly[i], exitPoly[i + 1]);
      ctx.closePath(); ctx.clip(); clipped = true;
    }
    for (let k = drawn.length - 1; k >= 0; k--) {
      if (clipped && k < exitK) { ctx.restore(); clipped = false; }
      const s = drawn[k], p = s.vis;
      if (p.hidden && !p.tallOnly) continue;
      const clip = p.maxy;
      for (const sp of s.sprites) {
        const size = ART.SIZE[sp.k];
        if (!size || (p.tallOnly && !TALL[sp.k])) continue;
        const sxp = p.X1 + sp.x * p.W1;
        if (sp.k === 'aski') {
          // askı halatı: kulelerin arasında sarkan ana halatın izini çizer
          const top = p.Y1 - sp.h * 8000 * p.sc1 * HH;
          const lw = Math.max(0.4, p.W1 * 0.02);
          if (sxp < -50 || sxp > W + 50) continue;
          if (top < clip) { ctx.fillStyle = '#e2ded6'; ctx.fillRect(sxp - lw / 2, top, lw, Math.min(p.Y1, clip) - top); }
          const side = sp.x < 0 ? '-1' : '1';
          const prev = cableTop[side];
          if (prev && top < clip) { ctx.strokeStyle = '#eeeae2'; ctx.lineWidth = Math.max(0.8, lw * 2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(sxp, top); ctx.stroke(); }
          cableTop[side] = [sxp, top];
          continue;
        }
        const w = size * RW * p.sc1 * HW;
        if (w < 0.4 || sxp + w < -20 || sxp - w > W + 20) continue;
        drawSprite(ctx, ART.sprite(sp.k, sp, w * S), sxp, p.Y1, w, clip, sp.flip && !NOFLIP[sp.k]);
      }
      const segCars = p.tallOnly ? null : carsBySeg.get(s.i);
      if (segCars) {
        for (const c of segCars) {
          const t = (c.z % SEG) / SEG;
          const sc = p.sc1 + (p.sc2 - p.sc1) * t;
          const X = p.X1 + (p.X2 - p.X1) * t, Y = p.Y1 + (p.Y2 - p.Y1) * t;
          const w = ART.CAR_SIZE[c.kind] * RW * sc * HW;
          if (w < 0.4) continue;
          const cx = X + c.x * (p.W1 + (p.W2 - p.W1) * t);
          if (Y < clip && w > 2) ART.ell(ctx, cx, Y - w * 0.02, w * 0.55, Math.max(0.5, w * 0.06), 'rgba(0,0,0,0.3)', null);
          drawSprite(ctx, ART.car(c.kind, c.color, w * S), cx, Y, w, clip, false);
        }
      }
    }
    if (clipped) ctx.restore();

    // oyuncu arabası
    if (!opts.noPlayer) drawPlayer(ctx, G, ps, playerY, camY, opts);
    // toz / duman
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += 1 / 60; f.x += f.vx; f.y += f.vy; f.r += 0.4;
      if (f.t > f.life) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - f.t / f.life) * 0.6; ART.circ(ctx, f.x, f.y, f.r, f.c, null); ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(ctx, G, ps, playerY, camY, opts) {
    const S = ART.S;
    const sc = CAM_DEPTH / PLAYER_Z;
    const groundY = HH - sc * (playerY - camY) * HH;
    const sp = G.speed / MAX;
    let turn = Math.round(G.steerVis * 2 + (ps.curve > 2 ? 1 : ps.curve < -2 ? -1 : 0) * (sp > 0.3 ? 1 : 0));
    turn = Math.max(-2, Math.min(2, turn));
    let bounce = 0;
    if (G.offroad && sp > 0.1) bounce = Math.random() < 0.5 ? -0.8 : 0.8;
    else if (sp > 0.05 && Math.random() < sp * 0.15) bounce = -0.6;
    const img = ART.player(G.phase === 'crash' ? (Math.floor(G.crashT * 10) % 2 ? 2 : -2) * G.crashDir : turn, opts.brake || G.phase === 'crash', opts.color || 'kirmizi');
    const x = Math.round((HW - img.lw / 2) * S) / S, y = Math.round((groundY - img.lh + 2 + bounce) * S) / S;
    ART.ell(ctx, HW, groundY, 47, 4.2, 'rgba(0,0,0,0.35)', null);
    if (G.phase === 'crash') {
      const a = Math.sin(G.crashT * 14) * 0.25 * Math.max(0, 1 - G.crashT / 1.6) * G.crashDir;
      ctx.save(); ctx.translate(HW, groundY - 20); ctx.rotate(a); ctx.drawImage(img, -img.lw / 2, -img.lh + 22, img.lw, img.lh); ctx.restore();
      if (Math.random() < 0.5) fx.push({ x: HW + (Math.random() - 0.5) * 60, y: groundY - 6, vx: (Math.random() - 0.5) * 1.2, vy: -0.6, r: 3, t: 0, life: 0.8, c: '#ece8e0' });
    } else ctx.drawImage(img, x, y, img.lw, img.lh);
    if (G.offroad && sp > 0.15 && Math.random() < 0.6) fx.push({ x: HW + (Math.random() < 0.5 ? -36 : 36), y: groundY - 4, vx: (Math.random() - 0.5) * 0.8, vy: -0.4, r: 2, t: 0, life: 0.6, c: G.offroadColor || '#c8b890' });
    if (G.skid && Math.random() < 0.7) fx.push({ x: HW + (Math.random() < 0.5 ? -34 : 34), y: groundY - 3, vx: (Math.random() - 0.5) * 0.6, vy: -0.3, r: 2, t: 0, life: 0.5, c: '#f4f4f4' });
  }

  root.BY_RENDER = { W, H, render, fx };
})(window);
