// Şehir: yollar, çizgiler, kaldırımlar, parklar, iskeleler, binalar, şehir dokusu
import * as THREE from 'three';
import * as TX from './textures.js';
import { facadeMaterial, asphaltMaterial, wetMaterial, U } from './shade.js';
import { rng, hash2, ringArea, obb } from './util.js';

const TILE = 1024;
const tileKey = (x, z) => Math.floor(x / TILE) + ',' + Math.floor(z / TILE);

// ---------------------------------------------------------------- yardımcılar
function subdivide(v, idx, maxLen) {
  const out = [];
  const ml2 = maxLen * maxLen;
  const st = [];
  for (let t = 0; t < idx.length; t += 3) {
    st.push([v[idx[t] * 2], v[idx[t] * 2 + 1], v[idx[t + 1] * 2], v[idx[t + 1] * 2 + 1], v[idx[t + 2] * 2], v[idx[t + 2] * 2 + 1]]);
    while (st.length) {
      const [ax, az, bx, bz, cx, cz] = st.pop();
      const ab = (ax - bx) ** 2 + (az - bz) ** 2, bc = (bx - cx) ** 2 + (bz - cz) ** 2, ca = (cx - ax) ** 2 + (cz - az) ** 2;
      const m = Math.max(ab, bc, ca);
      if (m <= ml2) { out.push(ax, az, bx, bz, cx, cz); continue; }
      if (m === ab) { const mx = (ax + bx) / 2, mz = (az + bz) / 2; st.push([ax, az, mx, mz, cx, cz], [mx, mz, bx, bz, cx, cz]); }
      else if (m === bc) { const mx = (bx + cx) / 2, mz = (bz + cz) / 2; st.push([ax, az, bx, bz, mx, mz], [ax, az, mx, mz, cx, cz]); }
      else { const mx = (cx + ax) / 2, mz = (cz + az) / 2; st.push([ax, az, bx, bz, mx, mz], [mx, mz, bx, bz, cx, cz]); }
    }
  }
  return out;
}

// düz üçgen listesi (x,z) → arazi üstünde parça parça ağlar
function surface(flat, H, yoff, uvs, mat, group, opts = {}) {
  const tiles = new Map();
  const nrm = new THREE.Vector3();
  for (let t = 0; t < flat.length; t += 6) {
    let ax = flat[t], az = flat[t + 1], bx = flat[t + 2], bz = flat[t + 3], cx = flat[t + 4], cz = flat[t + 5];
    // yukarı bakan sarım
    if ((bx - ax) * (cz - az) - (bz - az) * (cx - ax) > 0) { const tx = bx, tz = bz; bx = cx; bz = cz; cx = tx; cz = tz; }
    const k = tileKey((ax + bx + cx) / 3, (az + bz + cz) / 3);
    let T = tiles.get(k);
    if (!T) tiles.set(k, (T = { p: [], n: [], uv: [] }));
    for (const [x, z] of [[ax, az], [bx, bz], [cx, cz]]) {
      const y = (opts.deck ? H.ground(x, z) : H.at(x, z)) + yoff;
      T.p.push(x, y, z);
      H.normal(x, z, nrm);
      T.n.push(nrm.x, nrm.y, nrm.z);
      T.uv.push(x / uvs, z / uvs);
    }
  }
  for (const T of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(T.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(T.uv, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.renderOrder = opts.order || 0;
    group.add(m);
  }
}

function boundaryEdges(v, idx) {
  const cnt = new Map();
  const third = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = idx[t + e], b = idx[t + (e + 1) % 3], c = idx[t + (e + 2) % 3];
      const k = a < b ? a * 4194304 + b : b * 4194304 + a;
      cnt.set(k, (cnt.get(k) || 0) + 1);
      third.set(k, [a, b, c]);
    }
  }
  const out = [];
  for (const [k, n] of cnt) {
    if (n !== 1) continue;
    const [a, b, c] = third.get(k);
    out.push([v[a * 2], v[a * 2 + 1], v[b * 2], v[b * 2 + 1], v[c * 2], v[c * 2 + 1]]);
  }
  return out;
}

// dikey şerit (bordür, köprü yanı); kenar (ax,az)-(bx,bz), dış taraf c noktasının tersine
function wallStrip(P, N, ax, az, bx, bz, ya0, ya1, yb0, yb1, outx, outz) {
  let nx = bz - az, nz = -(bx - ax);
  const L = Math.hypot(nx, nz) || 1;
  nx /= L; nz /= L;
  if (nx * outx + nz * outz < 0) { nx = -nx; nz = -nz; }
  // sarım: normal yönüne göre
  const cr = -(bz - az) * 1, crx = -(bz - az), crz = bx - ax; // (pb,qb,qt) sarımının normali (-dz,0,dx)
  const flip = crx * nx + crz * nz < 0;
  const v = [[ax, ya0, az], [bx, yb0, bz], [bx, yb1, bz], [ax, ya1, az]];
  const tri = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
  for (const i of tri) { P.push(...v[i]); N.push(nx, 0, nz); }
  return cr;
}

function offsetPolyline(g, off) {
  const out = [];
  for (let i = 0; i < g.length; i++) {
    const p = g[Math.max(0, i - 1)], q = g[Math.min(g.length - 1, i + 1)];
    let tx = q[0] - p[0], tz = q[1] - p[1];
    const L = Math.hypot(tx, tz) || 1;
    tx /= L; tz /= L;
    let mit = 1;
    if (i > 0 && i < g.length - 1) {
      const ax = g[i][0] - g[i - 1][0], az = g[i][1] - g[i - 1][1], La = Math.hypot(ax, az) || 1;
      const c = (ax / La) * tx + (az / La) * tz;
      mit = 1 / Math.max(0.5, Math.sqrt((1 + c) / 2));
    }
    out.push([g[i][0] - tz * off * mit, g[i][1] + tx * off * mit]);
  }
  return out;
}

// çizgi boyunca şerit dörtgenleri (kesikli/düz)
function stripeQuads(P, line, width, dash, gap, maxSeg = 4) {
  let acc = 0;
  const period = dash + gap;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-3) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    const nx = -uz * width / 2, nz = ux * width / 2;
    let s = 0;
    while (s < L - 1e-3) {
      let s1;
      let on;
      if (gap <= 0) { on = true; s1 = Math.min(L, s + maxSeg); }
      else {
        const ph = (acc + s) % period;
        on = ph < dash;
        s1 = Math.min(L, s + (on ? dash - ph : period - ph));
      }
      if (on && s1 - s > 0.05) {
        const x0 = a[0] + ux * s, z0 = a[1] + uz * s, x1 = a[0] + ux * s1, z1 = a[1] + uz * s1;
        P.push(x0 - nx, z0 - nz, x1 - nx, z1 - nz, x1 + nx, z1 + nz, x0 - nx, z0 - nz, x1 + nx, z1 + nz, x0 + nx, z0 + nz);
      }
      s = s1;
    }
    acc += L;
  }
}

// ---------------------------------------------------------------- binalar
const PAL = {
  apt: ['#e8dcc3', '#d9c9a8', '#efe6d2', '#cdbb9b', '#e3cfb4', '#d6d2c8', '#c9b8a4', '#e9d6c0', '#bfb6a8', '#e0c9a6', '#d8b89a', '#c2c8cc', '#e6c7a8', '#f0e2c8', '#b8a99a', '#d9a98c', '#c7d1d4', '#e2d4b0', '#cfc0a0'],
  modern: ['#8f9aa3', '#a9b3ba', '#6f7b84', '#c3c8cc', '#5b6770', '#9aa7ad', '#b9b1a5'],
  stone: ['#cbb592', '#bfa67f', '#d6c4a1', '#b89c78', '#c9b28c', '#d2c1a3'],
  house: ['#b5523b', '#d9b44a', '#7a9a8c', '#c97b4a', '#e8d9b5', '#8c5a3c', '#a8b8a0', '#d8c7a0', '#b9785a'],
  palace: ['#f2eee6', '#ece6da', '#f4efe2'],
  pier: ['#9a9590', '#b0aba5', '#c8c2b8'],
  church: ['#cbb592', '#bfa67f', '#a89a88'],
  mosque: ['#d8d0c0'],
};
const STYLE_ID = { apt: 0, modern: 1, stone: 2, house: 3, palace: 4, pier: 5, church: 2, mosque: 2 };
const ROOF = ['#7d7a75', '#8a8680', '#6e6c69', '#999189', '#7b746b', '#5f5e5c'];
const TERRA = ['#9a4a2c', '#a85634', '#8c4128', '#b0603a'];

export function buildBuildings(data, H, group) {
  const tiles = new Map();
  const col = new THREE.Color();
  const getT = (x, z) => {
    const k = tileKey(x, z);
    let T = tiles.get(k);
    if (!T) tiles.set(k, (T = { p: [], n: [], c: [], f: [], b: [] }));
    return T;
  };
  const r = rng(1234);
  let nb = 0;
  for (const b of data.buildings) {
    const ring = b.r;
    if (ring.length < 3) continue;
    const seed = (b.v % 1000) / 1000 + 0.0001;
    const style = b.s in STYLE_ID ? b.s : 'apt';
    const sid = STYLE_ID[style];
    const pal = PAL[style] || PAL.apt;
    col.set(pal[Math.floor(seed * 997) % pal.length]);
    const cr = col.r, cg = col.g, cb = col.b;
    let gmin = 1e9, gmax = -1e9, gsum = 0;
    for (const p of ring) { const h = H.ground(p[0], p[1]); gmin = Math.min(gmin, h); gmax = Math.max(gmax, h); gsum += h; }
    const gavg = gsum / ring.length;
    let top = gavg + b.h;
    if (top < gmax + 2.5) top = gmax + 2.5;
    const bh = top - gavg;
    const base = (b.mh > 0 ? gavg + b.mh : gmin - 1.5);
    const cxz = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    const T = getT(cxz[0], cxz[1]);
    const A = ringArea(ring);
    // duvarlar
    let u = seed * 50;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      let nx = dz / L, nz = -dx / L;
      if (A < 0) { nx = -nx; nz = -nz; }
      const v0 = base - gavg, v1 = top - gavg;
      const pb = [p[0], base, p[1]], qb = [q[0], base, q[1]], qt = [q[0], top, q[1]], pt = [p[0], top, p[1]];
      const fp = [[u, v0], [u + L, v0], [u + L, v1], [u, v1]];
      // (pb,qb,qt) normali (-dz,0,dx)
      const flip = (-dz) * nx + dx * nz < 0;
      const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      const vs = [pb, qb, qt, pt];
      for (const k of order) {
        T.p.push(vs[k][0], vs[k][1], vs[k][2]);
        T.n.push(nx, 0, nz);
        T.c.push(cr, cg, cb);
        T.f.push(fp[k][0], fp[k][1]);
        T.b.push(sid, seed, 0, bh);
      }
      u += L;
    }
    // çatı
    col.set(ROOF[Math.floor(seed * 131) % ROOF.length]);
    let rr = col.r, rg = col.g, rb = col.b;
    let hip = null;
    if (ring.length <= 14 && bh < 24 && (style === 'house' || style === 'apt' || style === 'stone') && Math.abs(A) < 700) {
      const o = obb(ring);
      if (o && Math.abs(A) / o.area > 0.88 && o.W > 4 && hash2(b.v, 77) < (style === 'house' ? 0.9 : 0.42)) hip = o;
    }
    if (hip) {
      col.set(TERRA[Math.floor(seed * 71) % TERRA.length]);
      rr = col.r; rg = col.g; rb = col.b;
      const o = hip, ex = 0.35;
      const L2 = o.L / 2 + ex, W2 = o.W / 2 + ex;
      const rh = Math.min(o.W * 0.32, 3.6);
      const ux = o.ux, uz = o.uz, vx = -uz, vz = ux;
      const C = (a, bb, y) => [o.cx + ux * a + vx * bb, y, o.cz + uz * a + vz * bb];
      const c1 = C(-L2, -W2, top), c2 = C(L2, -W2, top), c3 = C(L2, W2, top), c4 = C(-L2, W2, top);
      const rl = Math.max(0.05, L2 - W2);
      const r1 = C(-rl, 0, top + rh), r2 = C(rl, 0, top + rh);
      const tris = [[c1, c2, r2], [c1, r2, r1], [c2, c3, r2], [c3, c4, r1], [c3, r1, r2], [c4, c1, r1]];
      for (let [a, bb, c] of tris) {
        let ex1 = bb[0] - a[0], ey1 = bb[1] - a[1], ez1 = bb[2] - a[2];
        let ex2 = c[0] - a[0], ey2 = c[1] - a[1], ez2 = c[2] - a[2];
        let nx = ey1 * ez2 - ez1 * ey2, ny = ez1 * ex2 - ex1 * ez2, nz = ex1 * ey2 - ey1 * ex2;
        if (ny < 0) { [bb, c] = [c, bb]; nx = -nx; ny = -ny; nz = -nz; }
        const nl = Math.hypot(nx, ny, nz) || 1;
        for (const q of [a, bb, c]) {
          T.p.push(q[0], q[1], q[2]); T.n.push(nx / nl, ny / nl, nz / nl); T.c.push(rr, rg, rb); T.f.push(q[0], q[2]); T.b.push(sid, seed, 2, bh);
        }
      }
    } else {
      const contour = ring.map((p) => new THREE.Vector2(p[0], p[1]));
      let tris;
      try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
      for (const t of tris) {
        let [a, bb, c] = t.map((i) => ring[i]);
        if ((bb[0] - a[0]) * (c[1] - a[1]) - (bb[1] - a[1]) * (c[0] - a[0]) > 0) [bb, c] = [c, bb];
        for (const q of [a, bb, c]) {
          T.p.push(q[0], top, q[1]); T.n.push(0, 1, 0); T.c.push(rr, rg, rb); T.f.push(q[0], q[1]); T.b.push(sid, seed, 1, bh);
        }
      }
    }
    nb++;
  }
  const mat = facadeMaterial(false);
  for (const T of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(T.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(T.c, 3));
    g.setAttribute('aF', new THREE.Float32BufferAttribute(T.f, 2));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(T.b, 4));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  return nb;
}

// ---------------------------------------------------------------- OSM kapsama dokusu (şehir dokusu deseni ve dolgu binalar)
export function coverage(data) {
  const [x0, z0, x1, z1] = data.world;
  const C = 32;
  const nx = Math.ceil((x1 - x0) / C), nz = Math.ceil((z1 - z0) / C);
  const a = new Float32Array(nx * nz);
  const mark = (x, z, r) => {
    const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) a[jj * nx + ii] = 1;
    }
  };
  for (const b of data.buildings) for (const p of b.r) mark(p[0], p[1], 1);
  const v = data.asphalt.v;
  for (let i = 0; i < v.length; i += 2) mark(v[i], v[i + 1], 1);
  for (const r of data.roads) for (const p of r.g) mark(p[0], p[1], 0);
  // yumuşat
  const out = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let s = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) { s += a[jj * nx + ii]; n++; }
    }
    out[j * nx + i] = Math.round((s / n) * 255);
  }
  const tex = new THREE.DataTexture(out, nx, nz, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  U.uCover.value = tex;
  U.uCoverBox.value.set(x0, z0, x0 + nx * C, z0 + nz * C);
  return { nx, nz, C, x0, z0, a: out, at(x, z) {
    const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return 0;
    return out[j * nx + i] / 255;
  } };
}

// OSM verisi olmayan tepelere kutu binalar (gerçek yoğun şehir silueti için)
export function buildFiller(data, H, cov, group, quality) {
  const sp = quality >= 3 ? 38 : quality >= 2 ? 46 : 58;
  const r = rng(4242);
  const [wx0, wz0, wx1, wz1] = data.world;
  const pad = 2600;
  const tiles = new Map();
  // iş merkezleri (gökdelen kümeleri): enlem/boylam → yerel metre
  const P = (la, lo) => [(lo - 28.995) * Math.cos(41.025 * Math.PI / 180) * 111320, (41.025 - la) * 110540];
  const towers = [
    [...P(41.0790, 29.0110), 700, 210], [...P(41.0690, 29.0080), 450, 160], [...P(41.0620, 28.9940), 500, 140],
    [...P(41.1080, 29.0200), 800, 190], [...P(40.9920, 29.1240), 700, 180], [...P(41.0440, 28.9870), 120, 70],
  ];
  const towerAt = (x, z) => {
    let best = 0;
    for (const [tx, tz, rad, hmax] of towers) {
      const d = Math.hypot(x - tx, z - tz);
      if (d < rad) best = Math.max(best, hmax * (1 - d / rad) ** 0.6);
    }
    return best;
  };
  for (let z = wz0 - pad; z < wz1 + pad; z += sp) {
    for (let x = wx0 - pad; x < wx1 + pad; x += sp) {
      const px = x + (r() - 0.5) * sp * 0.4, pz = z + (r() - 0.5) * sp * 0.4;
      const g = H.at(px, pz);
      if (g < 1.5) continue;
      if (cov.at(px, pz) > 0.05) continue;
      const outside = px < wx0 || px > wx1 || pz < wz0 || pz > wz1;
      const tw = towerAt(px, pz);
      if (outside && tw <= 0 && r() < 0.35) continue;
      // eğim
      const s = Math.abs(H.at(px + 12, pz) - H.at(px - 12, pz)) + Math.abs(H.at(px, pz + 12) - H.at(px, pz - 12));
      if (s > 16) continue;
      if (r() < 0.08) continue; // boşluk / park
      let w = sp * (0.42 + r() * 0.36), d = sp * (0.42 + r() * 0.36);
      let h = 8 + r() * 13 + (r() < 0.12 ? 10 + r() * 14 : 0);
      let style = 0;
      if (tw > 0 && r() < 0.55) { h = Math.max(h, tw * (0.45 + r() * 0.55)); style = 1; w = Math.min(w, 26 + r() * 10); d = Math.min(d, 26 + r() * 10); }
      else if (r() < 0.07) style = 1;
      const ang = (Math.sin(px * 0.0021) + Math.cos(pz * 0.0017)) * 0.9 + (r() - 0.5) * 0.15;
      const k = Math.floor(px / 2048) + ',' + Math.floor(pz / 2048);
      let T = tiles.get(k);
      if (!T) tiles.set(k, (T = []));
      T.push([px, g - 2, pz, w, h + 2, d, ang, style, r()]);
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const mat = facadeMaterial(true);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  let count = 0;
  for (const T of tiles.values()) {
    const geo = box.clone();
    const iB = new Float32Array(T.length * 4);
    geo.setAttribute('iB', new THREE.InstancedBufferAttribute(iB, 4));
    const im = new THREE.InstancedMesh(geo, mat, T.length);
    T.forEach((b, i) => {
      const [x, y, z, w, h, d, ang, style, s] = b;
      ps.set(x, y, z); q.setFromAxisAngle(up, ang); sc.set(w, h, d);
      m4.compose(ps, q, sc);
      im.setMatrixAt(i, m4);
      const pal = style === 1 ? PAL.modern : PAL.apt;
      col.set(pal[Math.floor(s * 991) % pal.length]);
      im.setColorAt(i, col);
      iB[i * 4] = style; iB[i * 4 + 1] = s; iB[i * 4 + 2] = 0; iB[i * 4 + 3] = h;
    });
    im.computeBoundingSphere();
    im.receiveShadow = true;
    group.add(im);
    count += T.length;
  }
  return count;
}

// ---------------------------------------------------------------- yollar ve zemin örtüleri
export function buildGround(data, H, group, quality) {
  const at = TX.asphalt();
  const pv = TX.pavers();
  const asph = asphaltMaterial(at);
  const walk = wetMaterial({ map: pv.map, normalMap: pv.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.88,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, 'walk');
  const grass = wetMaterial({ map: TX.grass(), roughness: 0.97, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, 'grass');
  const curbM = wetMaterial({ color: 0xb9b5ab, roughness: 0.8 }, 'curb');
  const conc = wetMaterial({ map: TX.stone(), roughness: 0.9, side: THREE.DoubleSide }, 'stone');
  const paint = wetMaterial({ color: 0xe9e7df, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }, 'paint');
  const yellow = wetMaterial({ color: 0xe8b52a, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }, 'paintY');
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9ea3, metalness: 0.9, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });

  const sub = quality >= 2 ? 9 : 12;
  surface(subdivide(data.asphalt.v, data.asphalt.i, sub), H, 0.06, 6, asph, group, { deck: true });
  surface(subdivide(data.walk.v, data.walk.i, sub * 1.3), H, 0.17, 2, walk, group, { deck: true });
  surface(subdivide(data.park.v, data.park.i, 14), H, 0.10, 6, grass, group);

  // bordürler
  const P = [], N = [];
  for (const [ax, az, bx, bz, cx, cz] of boundaryEdges(data.walk.v, data.walk.i)) {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(L / 8));
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const g0 = H.ground(x0, z0), g1 = H.ground(x1, z1);
      wallStrip(P, N, x0, z0, x1, z1, g0 + 0.02, g0 + 0.17, g1 + 0.02, g1 + 0.17, mx - cx, mz - cz);
    }
  }
  const cm = addMesh(group, P, N, curbM, false);
  if (cm) cm.layers.set(1);

  // köprü yanları ve korkuluk
  const DP = [], DN = [], RP = [], RN = [];
  for (const line of data.deck) {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const ga = H.ground(ax, az), gb = H.ground(bx, bz);
      wallStrip(DP, DN, ax, az, bx, bz, ga - 1.6, ga + 0.08, gb - 1.6, gb + 0.08, 1, 0);
      wallStrip(RP, RN, ax, az, bx, bz, ga + 0.08, ga + 1.15, gb + 0.08, gb + 1.15, 1, 0);
    }
  }
  addMesh(group, DP, DN, conc, true);
  const rail = railingMaterial();
  const rm = addMesh(group, RP, RN, rail, true);
  if (rm) { const uv = []; for (let i = 0; i < RP.length / 3; i++) uv.push(RP[i * 3] + RP[i * 3 + 2], RP[i * 3 + 1]); rm.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); }

  // iskeleler
  surface(subdivide(data.piers.v, data.piers.i, 8), { at: () => 0.25, ground: () => 0.25, normal: (x, z, o) => o.set(0, 1, 0) }, 0, 3,
    wetMaterial({ map: TX.stone(), color: 0xb0a89c, roughness: 0.9 }, 'pier'), group);
  const PP = [], PN = [];
  for (const [ax, az, bx, bz, cx, cz] of boundaryEdges(data.piers.v, data.piers.i)) {
    wallStrip(PP, PN, ax, az, bx, bz, -3, 0.25, -3, 0.25, (ax + bx) / 2 - cx, (az + bz) / 2 - cz);
  }
  addMesh(group, PP, PN, conc, true);

  // yol çizgileri
  const W = [], Y = [];
  for (const m of data.marks) {
    for (const [off, kind] of m.o) {
      if (kind === 2) {
        stripeQuads(W, offsetPolyline(m.g, off - 0.14), 0.13, 1, 0);
        stripeQuads(W, offsetPolyline(m.g, off + 0.14), 0.13, 1, 0);
      } else if (kind === 1) stripeQuads(W, offsetPolyline(m.g, off), 0.16, 1, 0);
      else stripeQuads(W, offsetPolyline(m.g, off), 0.13, 3, 5);
    }
  }
  // yaya geçitleri
  for (const [x, z, a, w] of data.zebra) {
    const ux = Math.cos(a), uz = Math.sin(a), nx = -uz, nz = ux;
    const cx = x + ux * 1.6, cz = z + uz * 1.6;
    const n = Math.max(2, Math.floor((w - 0.6) / 1.0));
    for (let k = 0; k < n; k++) {
      const o = -((n - 1) * 1.0) / 2 + k * 1.0;
      const px = cx + nx * o, pz = cz + nz * o;
      stripeQuads(W, [[px - ux * 1.5, pz - uz * 1.5], [px + ux * 1.5, pz + uz * 1.5]], 0.5, 1, 0);
    }
  }
  overlay(group, W, H, 0.075, paint);
  overlay(group, Y, H, 0.075, yellow);

  // tramvay rayları
  const TR = [];
  for (const line of data.tram) {
    for (const o of [-0.7175, 0.7175]) stripeQuads(TR, offsetPolyline(line, o), 0.075, 1, 0, 3);
  }
  overlay(group, TR, H, 0.08, steel);
}

function railingMaterial() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 64, 7); x.fillRect(0, 30, 64, 4);
  for (let i = 0; i < 4; i++) x.fillRect(i * 16 + 6, 0, 4, 64);
  x.fillRect(0, 58, 64, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.8, 1 / 1.07);
  t.offset.set(0, -0.08 / 1.07);
  return new THREE.MeshStandardMaterial({ color: 0x5f6b72, metalness: 0.7, roughness: 0.45, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
}

function addMesh(group, P, N, mat, shadow) {
  if (!P.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.castShadow = !!shadow;
  group.add(m);
  return m;
}

function overlay(group, flat, H, y, mat) {
  const tiles = new Map();
  for (let t = 0; t < flat.length; t += 6) {
    let ax = flat[t], az = flat[t + 1], bx = flat[t + 2], bz = flat[t + 3], cx = flat[t + 4], cz = flat[t + 5];
    if ((bx - ax) * (cz - az) - (bz - az) * (cx - ax) > 0) { const tx = bx, tz = bz; bx = cx; bz = cz; cx = tx; cz = tz; }
    const k = tileKey(ax, az);
    let T = tiles.get(k);
    if (!T) tiles.set(k, (T = { p: [], n: [] }));
    for (const [x, z] of [[ax, az], [bx, bz], [cx, cz]]) { T.p.push(x, H.ground(x, z) + y, z); T.n.push(0, 1, 0); }
  }
  for (const T of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(T.n, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.layers.set(1);
    group.add(m);
  }
}
