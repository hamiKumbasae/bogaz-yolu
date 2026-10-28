// Binalar: mimari tür (apartman, Levanten, modern, tuğla, ahşap ev, saray, taş), yola bakan cephe,
// kat yüksekliği, pencere bölmeleri, korniş/parapet, geri çekilmiş çatı katı
import * as THREE from 'three';
import { facadeMaterial, U } from './shade.js';
import { facadeArray, L as FL } from './facadetex.js';
import { rng, hash2, ringArea, obb } from './util.js';

const TILE = 1024;
const tileKey = (x, z) => Math.floor(x / TILE) + ',' + Math.floor(z / TILE);

const P = {
  apt: ['#ead9bf', '#e3cfb2', '#efe7d6', '#d9c3a3', '#e7c7b3', '#c9d6dc', '#e8d9a8', '#d4ccc0', '#f0ece2', '#b7c4b0', '#dcb9a3', '#c8bfb2', '#e2d2c0', '#cfd9cf', '#f2e3cf'],
  tile: ['#e6dccb', '#c7d3d6', '#dcc4b8', '#e0d7a8', '#d6d6d0', '#c9c3b4'],
  concrete: ['#c9c7c2', '#bdbab3', '#d2d0c9', '#b2b0aa'],
  levant: ['#d8c3a5', '#cfa98a', '#c4b8a6', '#e2cfb0', '#b9a48a', '#d6b4a0', '#a9a49a', '#cdb79b', '#e0c7aa'],
  modern: ['#c3c8cc', '#a9b1b8', '#d0d0cc', '#b8b2a8'],
  brick: ['#f4efe8', '#ebe3d8', '#f7f3ee'],
  house: ['#c96b4f', '#e2c06a', '#8fb3a2', '#d7c9a9', '#9a6a4a', '#c8d3c0', '#b0563f', '#e6dcc2'],
  palace: ['#f4f0e6', '#efe9dc'],
  stone: ['#efe6d4', '#e2d6be', '#d8cdb6', '#e9e1cf'],
  pier: ['#cfccc6', '#bdbab4'],
};

// mimari türler: duvar dokuları, pencere çiftleri, kat yüksekliği, bölme genişliği, zemin kat, balkon olasılığı, dükkân çiftleri
const A = {
  apt: { walls: [FL.W_PLASTER, FL.W_PLASTER, FL.W_PLASTER_OLD, FL.W_TILE, FL.W_CONCRETE], wins: [[FL.PVC, FL.PVC_SHUTTER], [FL.PVC_SHUTTER, FL.PVC], [FL.ALU_WIDE, FL.PVC_SHUTTER], [FL.PVC, FL.ALU_WIDE]],
    fh: [2.85, 3.2], mw: [2.6, 3.4], gh: [3.9, 4.6], balc: 0.6, shops: [[FL.SHOP, FL.KEPENK], [FL.SHOP, FL.SHOP_HALF], [FL.CAFE, FL.SHOP], [FL.SHOP, FL.BANK]], lit: 0.42, cornice: false },
  levant: { walls: [FL.W_PLASTER_OLD, FL.W_STONE, FL.W_PLASTER], wins: [[FL.LEVANT, FL.LEVANT]], fh: [4.0, 4.6], mw: [2.3, 2.9], gh: [4.4, 5.2], balc: 0,
    shops: [[FL.CAFE, FL.SHOP], [FL.SHOP, FL.KEPENK], [FL.SHOP, FL.SHOP_HALF]], lit: 0.36, cornice: true },
  modern: { walls: [FL.W_CONCRETE, FL.W_MARBLE], wins: [[FL.CURTAIN, FL.CURTAIN]], fh: [3.6, 4.0], mw: [1.4, 1.8], gh: [4.5, 5.2], balc: 0,
    shops: [[FL.SHOP, FL.BANK], [FL.BANK, FL.SHOP]], lit: 0.55, cornice: false },
  brick: { walls: [FL.W_BRICK], wins: [[FL.ALU_WIDE, FL.SMALL], [FL.PVC, FL.PVC]], fh: [3.4, 4.0], mw: [2.8, 3.6], gh: [4.0, 4.6], balc: 0,
    shops: [[FL.KEPENK, FL.SHOP]], lit: 0.25, cornice: true },
  house: { walls: [FL.W_WOOD, FL.W_WOOD, FL.W_PLASTER], wins: [[FL.SHUTTERS, FL.OTTOMAN], [FL.OTTOMAN, FL.SHUTTERS]], fh: [2.8, 3.1], mw: [2.2, 2.8], gh: null, balc: 0,
    shops: null, lit: 0.45, cornice: true },
  palace: { walls: [FL.W_STONE, FL.W_PLASTER], wins: [[FL.PALACE, FL.PALACE]], fh: [5.2, 6.0], mw: [3.0, 3.6], gh: null, balc: 0, shops: null, lit: 0.25, cornice: true },
  stone: { walls: [FL.W_STONE, FL.W_PLASTER_OLD], wins: [[FL.LEVANT, FL.PVC], [FL.PALACE, FL.PALACE]], fh: [4.2, 4.8], mw: [2.6, 3.2], gh: [4.4, 5.0], balc: 0,
    shops: [[FL.SHOP, FL.CAFE]], lit: 0.25, cornice: true },
  pier: { walls: [FL.W_CONCRETE], wins: [[FL.ALU_WIDE, FL.ALU_WIDE]], fh: [4.5, 5.0], mw: [3.5, 4.5], gh: null, balc: 0, shops: null, lit: 0.3, cornice: false },
};
const ROOF = ['#7d7a75', '#8a8680', '#6e6c69', '#999189', '#7b746b', '#5f5e5c', '#86817a'];
const TERRA = ['#9a4a2c', '#a85634', '#8c4128', '#b0603a'];

// tarihî doku bölgesi (Karaköy, Galata, Tophane, Eminönü, Sirkeci)
const historic = (x, z) => x > -2150 && x < -880 && z > -480 && z < 1250;

function chooseArch(b, cx, cz, r) {
  const s = b.s;
  if (s === 'house') return 'house';
  if (s === 'palace') return 'palace';
  if (s === 'stone' || s === 'church' || s === 'mosque') return 'stone';
  if (s === 'pier') return 'pier';
  if (s === 'modern') return r < 0.7 ? 'modern' : 'apt';
  if (historic(cx, cz)) return r < 0.58 ? 'levant' : r < 0.66 ? 'brick' : 'apt';
  if (r < 0.05) return 'brick';
  if (r < 0.12 && b.h > 18) return 'modern';
  return 'apt';
}

// yol kenarı sorgusu için yol parçaları ızgarası
function roadGrid(data) {
  const g = new Map(), C = 30;
  for (const r of data.roads) {
    if (r.e || r.hw === 'service' && r.w < 5) continue;
    for (let i = 0; i < r.g.length - 1; i++) {
      const [ax, az] = r.g[i], [bx, bz] = r.g[i + 1];
      const x0 = Math.floor((Math.min(ax, bx) - 12) / C), x1 = Math.floor((Math.max(ax, bx) + 12) / C);
      const z0 = Math.floor((Math.min(az, bz) - 12) / C), z1 = Math.floor((Math.max(az, bz) + 12) / C);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = x * 100003 + z;
        let a = g.get(k);
        if (!a) g.set(k, (a = []));
        a.push([ax, az, bx, bz, r.w / 2]);
      }
    }
  }
  return (x, z) => {
    const a = g.get(Math.floor(x / C) * 100003 + Math.floor(z / C));
    if (!a) return 1e9;
    let best = 1e9;
    for (const [ax, az, bx, bz, hw] of a) {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - hw;
      if (d < best) best = d;
    }
    return best;
  };
}

// içe doğru ötelenmiş halka (dışbükeye yakın çokgenler için); başarısızsa null
function inset(ring, d) {
  const n = ring.length;
  const A = ringArea(ring);
  const s = A > 0 ? 1 : -1;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    if (L < 1e-3) return null;
    // içe normal: CCW için sol (-dz, dx)
    const nx = (-dz / L) * s, nz = (dx / L) * s;
    lines.push([p[0] + nx * d, p[1] + nz * d, dx / L, dz / L]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i + n - 1) % n], b = lines[i];
    const den = a[2] * b[3] - a[3] * b[2];
    if (Math.abs(den) < 1e-3) out.push([b[0], b[1]]);
    else {
      const t = ((b[0] - a[0]) * b[3] - (b[1] - a[1]) * b[2]) / den;
      out.push([a[0] + a[2] * t, a[1] + a[3] * t]);
    }
  }
  const A2 = ringArea(out);
  if (Math.sign(A2) !== Math.sign(A) || Math.abs(A2) < Math.abs(A) * 0.25) return null;
  for (let i = 0; i < n; i++) {
    const p = out[i], q = out[(i + 1) % n], o = ring[i], oq = ring[(i + 1) % n];
    if ((q[0] - p[0]) * (oq[0] - o[0]) + (q[1] - p[1]) * (oq[1] - o[1]) <= 0) return null;
  }
  return out;
}

class Tile {
  constructor() { this.p = []; this.n = []; this.c = []; this.f = []; this.b = []; this.w = []; this.l = []; this.s = []; this.i = []; this.v = 0; }
  vert(x, y, z, nx, ny, nz, col, f0, f1, B, W, Lr, Sx) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); this.f.push(f0, f1);
    this.b.push(...B); this.w.push(...W); this.l.push(...Lr); this.s.push(...Sx);
    return this.v++;
  }
  // dikey dörtgen: (ax,az)-(bx,bz), y0..y1, dış normal (nx,nz); u0: duvar başı u değeri, vOff: v kayması
  wall(ax, az, bx, bz, y0, y1, nx, nz, col, u0, v0, B, W, Lr, Sx) {
    const Lw = Math.hypot(bx - ax, bz - az);
    const i0 = this.vert(ax, y0, az, nx, 0, nz, col, u0, v0, B, W, Lr, Sx);
    const i1 = this.vert(bx, y0, bz, nx, 0, nz, col, u0 + Lw, v0, B, W, Lr, Sx);
    const i2 = this.vert(bx, y1, bz, nx, 0, nz, col, u0 + Lw, v0 + (y1 - y0), B, W, Lr, Sx);
    const i3 = this.vert(ax, y1, az, nx, 0, nz, col, u0, v0 + (y1 - y0), B, W, Lr, Sx);
    const flip = (-(bz - az)) * nx + (bx - ax) * nz < 0;
    if (flip) this.i.push(i0, i2, i1, i0, i3, i2); else this.i.push(i0, i1, i2, i0, i2, i3);
  }
  // yatay çokgen (üst ya da alt)
  flat(ring, y, up, col, B, W, Lr, Sx) {
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), []); } catch (e) { return; }
    const base = this.v;
    for (const p of ring) this.vert(p[0], y, p[1], 0, up ? 1 : -1, 0, col, p[0], p[1], B, W, Lr, Sx);
    for (const t of tris) {
      let [a, b, c] = t;
      const pa = ring[a], pb = ring[b], pc = ring[c];
      const cross = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
      if ((cross > 0) === up) [b, c] = [c, b];
      this.i.push(base + a, base + b, base + c);
    }
  }
  tri(a, b, c, col, B, W, Lr, Sx) {
    let e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    if (ny < 0) { [b, c] = [c, b]; nx = -nx; ny = -ny; nz = -nz; }
    const L = Math.hypot(nx, ny, nz) || 1;
    for (const q of [a, b, c]) this.i.push(this.vert(q[0], q[1], q[2], nx / L, ny / L, nz / L, col, q[0], q[2], B, W, Lr, Sx));
  }
}

export function buildBuildings(data, H, group) {
  U.uFac.value = facadeArray();
  const tiles = new Map();
  const getT = (x, z) => { const k = tileKey(x, z); let T = tiles.get(k); if (!T) tiles.set(k, (T = new Tile())); return T; };
  const roadDist = roadGrid(data);
  const col = new THREE.Color(), rcol = new THREE.Color(), ccol = new THREE.Color();
  const plan = [];   // ayrıntı modelleri için cephe planı
  const Z4 = [0, 0, 0, 0];
  for (const b of data.buildings) {
    const ring = b.r;
    if (ring.length < 3) continue;
    const seed = (b.v % 1000) / 1000 + 0.0001;
    const r = rng(b.v * 7919 + 13);
    let cx = 0, cz = 0;
    for (const p of ring) { cx += p[0] / ring.length; cz += p[1] / ring.length; }
    const arch = chooseArch(b, cx, cz, r());
    const D = A[arch];
    const palName = arch === 'apt' ? null : arch;
    const wallL = D.walls[Math.floor(r() * D.walls.length)];
    let pal = P[palName || 'apt'];
    if (arch === 'apt' && wallL === FL.W_TILE) pal = P.tile;
    if (arch === 'apt' && wallL === FL.W_CONCRETE) pal = P.concrete;
    col.set(pal[Math.floor(r() * pal.length)]);
    const win = D.wins[Math.floor(r() * D.wins.length)];
    let gmin = 1e9, gmax = -1e9, gsum = 0;
    for (const p of ring) { const h = H.ground(p[0], p[1]); gmin = Math.min(gmin, h); gmax = Math.max(gmax, h); gsum += h; }
    const gavg = gsum / ring.length;
    let top = gavg + b.h;
    if (top < gmax + 2.5) top = gmax + 2.5;
    const bh = top - gavg;
    const base = b.mh > 0 ? gavg + b.mh : gmin - 1.5;
    const fh = D.fh[0] + r() * (D.fh[1] - D.fh[0]);
    let gh = D.gh ? D.gh[0] + r() * (D.gh[1] - D.gh[0]) : 0;
    if (bh < gh + fh + 1) gh = 0;
    const mwT = D.mw[0] + r() * (D.mw[1] - D.mw[0]);
    const bp = D.balc && r() < D.balc ? 2 + Math.floor(r() * 2) : 0;
    const bo = bp ? Math.floor(r() * bp) : 0;
    const balc = bp ? bp + bo / 10 + 0.001 : 0;
    const shops = D.shops ? D.shops[Math.floor(r() * D.shops.length)] : null;
    const Ar = ringArea(ring);
    const T = getT(cx, cz);
    const B = [seed, 0, bh, D.lit];
    const Lr = [wallL, win[0], win[1], balc];
    // cepheler
    const walls = [];
    let longest = -1, longestL = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const dx = q[0] - p[0], dz = q[1] - p[1], Lw = Math.hypot(dx, dz);
      if (Lw < 0.05) continue;
      let nx = dz / Lw, nz = -dx / Lw;
      if (Ar < 0) { nx = -nx; nz = -nz; }
      const mx = (p[0] + q[0]) / 2 + nx * 2.5, mz = (p[1] + q[1]) / 2 + nz * 2.5;
      const street = shops && Lw > 3.2 && !b.far && roadDist(mx, mz) < 4.0 ? 1 : 0;
      walls.push({ p, q, nx, nz, Lw, street });
      if (street && Lw > longestL) { longestL = Lw; longest = walls.length - 1; }
    }
    const anyStreet = walls.some((w) => w.street);
    if (!anyStreet && gh > 0 && !D.shops) gh = 0;
    walls.forEach((w, wi) => {
      const n = Math.max(1, Math.round(w.Lw / mwT));
      const modW = w.Lw < 1.6 ? 1000 : w.Lw / n;
      const ns = Math.max(1, Math.round(w.Lw / 4.6));
      const shopW = w.Lw / ns;
      const ent = wi === longest ? Math.floor(r() * ns) : -5;
      const W = [w.street, gh, modW, fh];
      const Sx = shops ? [shops[0], shops[1], ent, shopW] : Z4;
      T.wall(w.p[0], w.p[1], w.q[0], w.q[1], base, top, w.nx, w.nz, col, 0, base - gavg, B, W, Lr, Sx);
      if (!b.far) plan.push({ ax: w.p[0], az: w.p[1], bx: w.q[0], bz: w.q[1], nx: w.nx, nz: w.nz, L: w.Lw, modW, n, gh, fh, street: w.street, bp, bo,
        y0: gavg, top, arch, seed, shopW, ns, ent, cornice: D.cornice });
    });
    // çatı
    rcol.set(ROOF[Math.floor(r() * ROOF.length)]);
    let hip = null;
    if (ring.length <= 14 && bh < 24 && (arch === 'house' || arch === 'apt' || arch === 'levant') && Math.abs(Ar) < 700) {
      const o = obb(ring);
      if (o && Math.abs(Ar) / o.area > 0.88 && o.W > 4 && r() < (arch === 'house' ? 0.9 : arch === 'levant' ? 0.3 : 0.38)) hip = o;
    }
    const RB = [seed, 1, bh, 0];
    if (hip) {
      rcol.set(TERRA[Math.floor(r() * TERRA.length)]);
      const o = hip, ex = 0.45;
      const L2 = o.L / 2 + ex, W2 = o.W / 2 + ex;
      const rh = Math.min(o.W * 0.32, 3.6);
      const ux = o.ux, uz = o.uz, vx = -uz, vz = ux;
      const Cc = (a, bb, y) => [o.cx + ux * a + vx * bb, y, o.cz + uz * a + vz * bb];
      const c1 = Cc(-L2, -W2, top - 0.15), c2 = Cc(L2, -W2, top - 0.15), c3 = Cc(L2, W2, top - 0.15), c4 = Cc(-L2, W2, top - 0.15);
      const rl = Math.max(0.05, L2 - W2);
      const r1 = Cc(-rl, 0, top + rh), r2 = Cc(rl, 0, top + rh);
      const HB = [seed, 2, bh, 0];
      for (const [a, bb, c] of [[c1, c2, r2], [c1, r2, r1], [c2, c3, r2], [c3, c4, r1], [c3, r1, r2], [c4, c1, r1]]) T.tri(a, bb, c, rcol, HB, Z4, Z4, Z4);
      // saçak altı (alttan görünür)
      T.flat([[c1[0], c1[2]], [c2[0], c2[2]], [c3[0], c3[2]], [c4[0], c4[2]]], top - 0.15, false, ccol.set('#5a524a'), RB, Z4, Z4, Z4);
    } else {
      T.flat(ring, top, true, rcol, RB, Z4, Z4, Z4);
      // parapet ve korniş: çatı kenarında dışa taşan bant
      const PB = [seed, 3, bh, 0];
      const out = D.cornice ? 0.32 : 0.1;
      const yb = top - (D.cornice ? 0.5 : 0.12), capY = top + (D.cornice ? 0.45 : 0.6);
      const pr = inset(ring, -out);
      const edgeN = (rg, i) => {
        const p = rg[i], q = rg[(i + 1) % rg.length], dx = q[0] - p[0], dz = q[1] - p[1], Lw = Math.hypot(dx, dz) || 1;
        return Ar < 0 ? [-dz / Lw, dx / Lw] : [dz / Lw, -dx / Lw];
      };
      if (pr && !b.far) {
        let u = 0;
        for (let i = 0; i < pr.length; i++) {
          const p = pr[i], q = pr[(i + 1) % pr.length];
          const [nx, nz] = edgeN(pr, i);
          T.wall(p[0], p[1], q[0], q[1], yb, capY, nx, nz, col, u, top - gavg, PB, Z4, Lr, Z4);
          u += Math.hypot(q[0] - p[0], q[1] - p[1]);
        }
        // kornişin alt yüzü ve parapet üstü
        T.flat(pr, yb, false, ccol.copy(col).multiplyScalar(0.7), PB, Z4, Z4, Z4);
        const inner = inset(ring, 0.22);
        if (inner) {
          // üst kapak: dış halka - iç halka şeridi (dörtgenler)
          for (let i = 0; i < pr.length; i++) {
            const a = pr[i], bq = pr[(i + 1) % pr.length], c = inner[(i + 1) % pr.length], d = inner[i];
            T.tri([a[0], capY, a[1]], [bq[0], capY, bq[1]], [c[0], capY, c[1]], ccol.copy(col).multiplyScalar(0.92), PB, Z4, Z4, Z4);
            T.tri([a[0], capY, a[1]], [c[0], capY, c[1]], [d[0], capY, d[1]], ccol.copy(col).multiplyScalar(0.92), PB, Z4, Z4, Z4);
          }
          // iç yüz
          for (let i = 0; i < inner.length; i++) {
            const p = inner[i], q = inner[(i + 1) % inner.length];
            const [nx, nz] = edgeN(inner, i);
            T.wall(p[0], p[1], q[0], q[1], top, capY, -nx, -nz, ccol.copy(col).multiplyScalar(0.85), 0, 50, PB, Z4, Lr, Z4);
          }
        }
      }
      // geri çekilmiş çatı katı
      const nF = Math.floor((bh - gh - 0.9) / fh);
      if (!b.far && (arch === 'apt' || arch === 'modern') && nF >= 4 && Math.abs(Ar) > 120 && Math.abs(Ar) < 2200 && r() < 0.45) {
        const ph2 = inset(ring, 2.2);
        if (ph2) {
          const t2 = top + 2.95;
          const B2 = [seed + 0.37, 0, 2.95 + 0.9, D.lit];
          const W2 = [0, 0, 2.6, 2.75];
          const L2 = [wallL, arch === 'modern' ? FL.CURTAIN : FL.ALU_WIDE, FL.PVC, 0];
          const A2 = ringArea(ph2);
          for (let i = 0; i < ph2.length; i++) {
            const p = ph2[i], q = ph2[(i + 1) % ph2.length];
            const dx = q[0] - p[0], dz = q[1] - p[1], Lw = Math.hypot(dx, dz);
            if (Lw < 0.05) continue;
            let nx = dz / Lw, nz = -dx / Lw;
            if (A2 < 0) { nx = -nx; nz = -nz; }
            const W3 = [0, 0, Lw < 1.6 ? 1000 : Lw / Math.max(1, Math.round(Lw / 2.8)), 2.75];
            T.wall(p[0], p[1], q[0], q[1], top, t2, nx, nz, col, 0, -0.1, B2, W3, L2, Z4);
          }
          T.flat(ph2, t2, true, rcol, RB, Z4, Z4, Z4);
        }
      }
    }
  }
  const mat = facadeMaterial(false);
  for (const T of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(T.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(T.c, 3));
    g.setAttribute('aF', new THREE.Float32BufferAttribute(T.f, 2));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(T.b, 4));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(T.w, 4));
    g.setAttribute('aL', new THREE.Float32BufferAttribute(T.l, 4));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(T.s, 4));
    g.setIndex(T.i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  return plan;
}
