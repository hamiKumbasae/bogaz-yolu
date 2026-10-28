// Simgeler: camiler, Ayasofya parçaları, Galata Kulesi, Kız Kulesi, Saat Kulesi, 15 Temmuz Köprüsü, Çamlıca
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { monumentMaterial, nightLightMaterial, wetMaterial, U } from './shade.js';
import { ringArea } from './util.js';

const LL = (la, lo) => [(lo - 28.995) * Math.cos(41.025 * Math.PI / 180) * 111320, (41.025 - la) * 110540];

class Bag {
  constructor() { this.parts = new Map(); }
  add(mat, geo, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (m) g.applyMatrix4(m);
    let arr = this.parts.get(mat);
    if (!arr) this.parts.set(mat, (arr = []));
    arr.push(g);
  }
  build(group, shadow = true) {
    for (const [mat, arr] of this.parts) {
      const g = mergeGeometries(arr, false);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}

const M = new THREE.Matrix4();
const tr = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
};

// halka → dikey duvar geometrisi (y0..y1)
function prism(ring, y0, y1) {
  const P = [], N = [];
  const A = ringArea(ring);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    if (L < 0.02) continue;
    let nx = dz / L, nz = -dx / L;
    if (A < 0) { nx = -nx; nz = -nz; }
    const flip = (-dz) * nx + dx * nz < 0;
    const v = [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]];
    for (const k of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) { P.push(...v[k]); N.push(nx, 0, nz); }
  }
  // üst kapak
  const tris = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), []);
  for (const t of tris) {
    let [a, b, c] = t.map((i) => ring[i]);
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) [b, c] = [c, b];
    for (const q of [a, b, c]) { P.push(q[0], y1, q[1]); N.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
}

const dome = (r, flat = 0.92, seg = 28) => new THREE.SphereGeometry(r, seg, Math.ceil(seg / 3), 0, Math.PI * 2, 0, Math.PI / 2).scale(1, flat, 1);
const halfDome = (r) => new THREE.SphereGeometry(r, 20, 8, 0, Math.PI, 0, Math.PI / 2);
const cyl = (r0, r1, h, seg = 16, open = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, open).translate(0, h / 2, 0);
const cone = (r, h, seg = 16) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);

export function buildLandmarks(data, H, group, quality) {
  const stone = monumentMaterial({ color: 0xd9d1c1, roughness: 0.82 }, 'mstone', 0.42);
  const pink = monumentMaterial({ color: 0xc78d6c, roughness: 0.85 }, 'mpink', 0.42);
  const lead = monumentMaterial({ color: 0x7c8893, metalness: 0.55, roughness: 0.42 }, 'mlead', 0.18, [0.8, 0.9, 1.0]);
  const gold = monumentMaterial({ color: 0xd8aa3c, metalness: 1.0, roughness: 0.28 }, 'mgold', 0.6);
  const cream = monumentMaterial({ color: 0xece2cc, roughness: 0.8 }, 'mcream', 0.5);
  const tower = monumentMaterial({ color: 0xb4a68f, roughness: 0.9 }, 'mtower', 0.5);
  const glass = monumentMaterial({ color: 0x1b2328, metalness: 0.4, roughness: 0.15 }, 'mglass', 0.0);
  const kandil = nightLightMaterial(0xffe2a8, 4.0);
  const winGlow = nightLightMaterial(0xffc27a, 2.6);
  const bag = new Bag();

  // ---------------- camiler
  const mosques = data.mosques.slice();
  const [cx1, cz1] = LL(41.0272, 29.0686);
  mosques.push({ x: cx1, z: cz1, L: 70, W: 66, a: 0.35, n: 6, dd: 34, dh: 72, mh: 107, name: 'Büyük Çamlıca Camii' });
  for (const q of mosques) {
    const ux = Math.cos(q.a), uz = Math.sin(q.a);
    let y0 = 1e9;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
      const x = q.x + ux * sx * q.L * 0.4 - uz * sz * q.W * 0.4, z = q.z + uz * sx * q.L * 0.4 + ux * sz * q.W * 0.4;
      y0 = Math.min(y0, H.ground(x, z));
    }
    y0 -= 0.5;
    const R = q.dd / 2;
    const domeTop = y0 + q.dh;
    const ys = domeTop - R * 0.92;
    const hd = Math.max(1.6, R * 0.3);
    const bodyTop = ys - hd;
    const bL = Math.min(q.L, R * (q.dd >= 15 ? 3.4 : 2.4)), bW = Math.min(q.W, R * 2.5);
    const rot = -q.a; // yerel x ekseni (u) yönünde
    const place = (lx, lz) => [q.x + ux * lx - uz * lz, q.z + uz * lx + ux * lz];
    bag.add(stone, box(bL, bodyTop - y0 + 0.5, bW), tr(q.x, y0 - 0.5, q.z, rot));
    bag.add(stone, cyl(R * 1.04, R * 1.02, hd + 0.2, 28), tr(q.x, bodyTop - 0.2, q.z));
    bag.add(winGlow, cyl(R * 1.045, R * 1.045, hd * 0.45, 28, true), tr(q.x, bodyTop + hd * 0.28, q.z));
    bag.add(lead, dome(R * 1.0), tr(q.x, ys, q.z));
    bag.add(gold, cone(0.5, 3.2, 8), tr(q.x, domeTop - 0.3, q.z));
    if (q.dd >= 14) {
      for (const s of [-1, 1]) {
        const [hx, hz] = place(s * R * 0.98, 0);
        bag.add(lead, halfDome(R * 0.72), tr(hx, bodyTop - R * 0.05, hz, rot + (s > 0 ? Math.PI / 2 : -Math.PI / 2)));
      }
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const [hx, hz] = place(sx * bL * 0.36, sz * bW * 0.36);
        bag.add(stone, cyl(R * 0.3, R * 0.3, 1.6, 12), tr(hx, bodyTop - 0.3, hz));
        bag.add(lead, dome(R * 0.29, 0.9, 14), tr(hx, bodyTop + 1.2, hz));
      }
    } else if (q.dd >= 9) {
      // son cemaat yeri: önde küçük kubbeler
      for (const sz of [-1, 0, 1]) {
        const [hx, hz] = place(-bL / 2 - 2.5, sz * bW * 0.3);
        bag.add(stone, box(5, bodyTop - y0 - 2.5, bW * 0.32), tr(hx, y0, hz, rot));
        bag.add(lead, dome(Math.min(2.4, bW * 0.15), 0.85, 12), tr(hx, bodyTop - 2.5, hz));
      }
    }
    // minareler
    const spots = q.n === 1 ? [[-0.5, -0.5]] : q.n === 2 ? [[-0.5, -0.5], [-0.5, 0.5]] : q.n === 4 ? [[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]]
      : [[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5], [-1.1, -0.55], [-1.1, 0.55]];
    const mh = q.mh;
    const big = mh > 55;
    for (const [sx, sz] of spots) {
      const [mx, mz] = place(sx * bL + Math.sign(sx) * 2.2, sz * bW + Math.sign(sz) * 2.2);
      const g = H.ground(mx, mz) - 0.5;
      const top = y0 + mh;
      const rs = big ? 1.9 : 1.25;
      bag.add(stone, box(rs * 2.6, Math.min(10, mh * 0.12), rs * 2.6), tr(mx, g, mz, rot));
      bag.add(stone, cyl(rs * 1.15, rs, top - g - mh * 0.16, 12), tr(mx, g, mz));
      const nb = big ? 3 : mh > 36 ? 2 : 1;
      for (let b = 0; b < nb; b++) {
        const yb = y0 + mh * (0.56 + b * 0.12);
        bag.add(stone, cyl(rs * 1.25, rs * 1.75, 0.9, 14), tr(mx, yb - 0.9, mz));
        bag.add(stone, cyl(rs * 1.75, rs * 1.75, 0.8, 14, true), tr(mx, yb, mz));
        bag.add(kandil, cyl(rs * 1.78, rs * 1.78, 0.18, 14, true), tr(mx, yb + 0.55, mz));
      }
      bag.add(stone, cyl(rs * 0.85, rs * 0.85, mh * 0.05, 12), tr(mx, top - mh * 0.16, mz));
      bag.add(lead, cone(rs * 1.08, mh * 0.12, 12), tr(mx, top - mh * 0.11, mz));
      bag.add(gold, cone(0.28, 2.0, 6), tr(mx, top + 0.6, mz));
    }
  }

  // ---------------- OSM yapı parçaları (Ayasofya, Sultanahmet…)
  const [ayx, ayz] = LL(41.0086, 28.9802);
  for (const p of data.parts) {
    const ring = p.r;
    const area = Math.abs(ringArea(ring));
    let y0 = 1e9;
    for (const q of ring) y0 = Math.min(y0, H.ground(q[0], q[1]));
    y0 -= 0.3;
    const c = p.c;
    const rad = Math.sqrt(area / Math.PI);
    const mat = Math.hypot(c[0] - ayx, c[1] - ayz) < 110 ? pink : stone;
    const slim = area < 30 && p.h / Math.max(1, rad) > 6;
    if (slim) {
      bag.add(mat, cyl(rad * 1.05, rad * 0.9, p.h * 0.88, 12), tr(c[0], y0, c[1]));
      bag.add(mat, cyl(rad * 1.6, rad * 1.6, 0.8, 12), tr(c[0], y0 + p.h * 0.62, c[1]));
      bag.add(kandil, cyl(rad * 1.62, rad * 1.62, 0.2, 12, true), tr(c[0], y0 + p.h * 0.62 + 0.6, c[1]));
      bag.add(lead, cone(rad * 1.1, p.h * 0.12, 12), tr(c[0], y0 + p.h * 0.88, c[1]));
      continue;
    }
    let roofH = 0;
    if (p.roof === 'dome' || p.roof === 'onion' || p.roof === 'half-dome') roofH = p.rh || rad * 0.85;
    else if (p.roof === 'cone' || p.roof === 'pyramidal') roofH = p.rh || rad * 1.6;
    const wallTop = y0 + Math.max(p.mh + 0.5, p.h - roofH);
    const wallBot = p.mh > 0 ? y0 + p.mh : y0 - 1;
    if (wallTop - wallBot > 0.3) bag.add(mat, prism(ring, wallBot, wallTop));
    if (roofH > 0) {
      if (p.roof === 'cone' || p.roof === 'pyramidal') bag.add(lead, cone(rad, roofH, 16), tr(c[0], wallTop, c[1]));
      else bag.add(lead, dome(rad, roofH / rad, 24), tr(c[0], wallTop, c[1]));
    }
  }

  // ---------------- özel simgeler
  for (const s of data.specials) {
    const g = H.ground(s.x, s.z);
    if (s.k === 'galata') {
      bag.add(tower, cyl(8.4, 8.0, 46, 24), tr(s.x, g - 1, s.z));
      bag.add(tower, cyl(8.6, 8.6, 1.0, 24), tr(s.x, g + 18, s.z));
      bag.add(glass, cyl(8.05, 8.05, 5.2, 24), tr(s.x, g + 45, s.z));
      bag.add(winGlow, cyl(8.1, 8.1, 3.0, 24, true), tr(s.x, g + 46, s.z));
      bag.add(tower, cyl(9.6, 9.6, 0.5, 24), tr(s.x, g + 44.6, s.z));
      bag.add(tower, cyl(8.4, 8.4, 1.2, 24), tr(s.x, g + 50.2, s.z));
      bag.add(lead, cone(8.7, 15.5, 24), tr(s.x, g + 51.4, s.z));
      bag.add(gold, cone(0.35, 2.4, 6), tr(s.x, g + 66.6, s.z));
    } else if (s.k === 'kizkulesi') {
      const sea = U.uSea.value;
      bag.add(stone, cyl(17, 15, 4.2, 20), tr(s.x, sea - 1.6, s.z, 0, 1.4, 1, 0.8));
      bag.add(cream, box(20, 7, 9), tr(s.x - 4, 0.4, s.z + 1));
      bag.add(lead, cone(8.5, 3.0, 4), tr(s.x - 4, 7.4, s.z + 1, Math.PI / 4, 1.6, 1, 0.75));
      bag.add(cream, box(6.2, 12, 6.2), tr(s.x + 6, 0.4, s.z));
      bag.add(cream, cyl(3.0, 2.9, 6, 8), tr(s.x + 6, 12.6, s.z));
      bag.add(winGlow, cyl(3.05, 3.05, 2.2, 8, true), tr(s.x + 6, 15.0, s.z));
      bag.add(lead, cone(3.3, 6.0, 8), tr(s.x + 6, 18.6, s.z));
      bag.add(gold, cone(0.25, 1.8, 6), tr(s.x + 6, 24.5, s.z));
    } else if (s.k === 'saatkulesi') {
      bag.add(cream, box(7.4, 7, 7.4), tr(s.x, g - 0.5, s.z, 0.6));
      bag.add(cream, box(5.8, 6.5, 5.8), tr(s.x, g + 6.5, s.z, 0.6));
      bag.add(cream, box(4.8, 6, 4.8), tr(s.x, g + 13, s.z, 0.6));
      for (let k = 0; k < 4; k++) {
        const a = 0.6 + k * Math.PI / 2;
        const clk = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 20).rotateX(Math.PI / 2).translate(0, 0, 2.45);
        bag.add(kandil, clk, tr(s.x, g + 16.2, s.z, a));
      }
      bag.add(cream, cyl(2.0, 1.8, 4.5, 12), tr(s.x, g + 19, s.z));
      bag.add(lead, dome(2.0, 1.1, 14), tr(s.x, g + 23.5, s.z));
      bag.add(gold, cone(0.2, 1.6, 6), tr(s.x, g + 25.6, s.z));
    }
  }

  // ---------------- Çamlıca Kulesi (TV kulesi)
  {
    const [tx, tz] = LL(41.0194, 29.0705);
    const g = H.ground(tx, tz) - 2;
    bag.add(cream, cyl(16, 6.5, 205, 20), tr(tx, g, tz));
    bag.add(glass, cyl(9, 15, 22, 20), tr(tx, g + 205, tz));
    bag.add(winGlow, cyl(15.1, 15.1, 4, 20, true), tr(tx, g + 214, tz));
    bag.add(cream, cyl(15, 8, 18, 20), tr(tx, g + 227, tz));
    bag.add(cream, cyl(5, 2.2, 60, 12), tr(tx, g + 245, tz));
    bag.add(tower, cyl(1.4, 0.4, 64, 8), tr(tx, g + 305, tz));
  }

  bag.build(group, true);

  // ---------------- 15 Temmuz Şehitler Köprüsü
  buildBridge(data.b15, H, group);
}

function buildBridge(b, H, group) {
  const ax = b.a[0], az = b.a[1], bx = b.b[0], bz = b.b[1];
  const Lt = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / Lt, uz = (bz - az) / Lt, nx = -uz, nz = ux;
  const ang = Math.atan2(uz, ux);
  const half = 537; // ana açıklık 1074 m
  const cs = Lt / 2;
  const deckY = (s) => {
    const t = (s - cs) / cs;
    return 66 - 5 * t * t;
  };
  const steel = wetMaterial({ color: 0xa9b0b5, metalness: 0.5, roughness: 0.5 }, 'bsteel');
  const conc = wetMaterial({ color: 0xbfbab0, roughness: 0.85 }, 'bconc');
  const bag = new Bag();
  // tabliye (parça parça, kemerli)
  const seg = 40;
  for (let k = 0; k < seg; k++) {
    const s0 = (k / seg) * Lt, s1 = ((k + 1) / seg) * Lt, sm = (s0 + s1) / 2;
    const y = deckY(sm);
    const x = ax + ux * sm, z = az + uz * sm;
    const gb = new THREE.BoxGeometry(s1 - s0 + 0.2, 3.2, b.w).translate(0, -1.6, 0);
    const m = new THREE.Matrix4().makeRotationY(-ang);
    m.setPosition(x, y, z);
    bag.add(steel, gb, m);
  }
  // kuleler
  const towers = [];
  for (const sg of [-1, 1]) {
    const s = cs + sg * half;
    const x = ax + ux * s, z = az + uz * s;
    const base = Math.max(H.at(x, z), U.uSea.value) - 3;
    towers.push({ s, x, z, top: 165 });
    for (const side of [-1, 1]) {
      const lx = x + nx * side * (b.w / 2 + 3), lz = z + nz * side * (b.w / 2 + 3);
      bag.add(conc, cyl(4.2, 3.0, 165 - base, 4), tr(lx, base, lz, -ang + Math.PI / 4, 1.2, 1, 0.9));
    }
    for (const yb of [deckY(s) - 6, 112, 160]) {
      const gb = new THREE.BoxGeometry(5, 4.5, b.w + 6).translate(0, 0, 0);
      const m = new THREE.Matrix4().makeRotationY(-ang);
      m.setPosition(x, yb, z);
      bag.add(conc, gb, m);
    }
  }
  bag.build(group, false);
  // ana kablolar
  const cablePts = (side) => {
    const pts = [];
    const off = side * (b.w / 2 + 1.5);
    const [t1, t2] = towers;
    const sag = (s) => {
      if (s < t1.s) { const t = s / t1.s; return deckY(0) + 2 + (t1.top - deckY(0) - 2) * t * t; }
      if (s > t2.s) { const t = (Lt - s) / (Lt - t2.s); return deckY(Lt) + 2 + (t2.top - deckY(Lt) - 2) * t * t; }
      const t = (s - cs) / half;
      return deckY(s) + 3 + (t1.top - deckY(cs) - 3) * t * t;
    };
    for (let k = 0; k <= 120; k++) {
      const s = (k / 120) * Lt;
      pts.push(new THREE.Vector3(ax + ux * s + nx * off, sag(s), az + uz * s + nz * off));
    }
    return { pts, sag };
  };
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x8d969c, metalness: 0.6, roughness: 0.4, emissive: new THREE.Color(0x000000) });
  const hangerPos = [];
  for (const side of [-1, 1]) {
    const { pts, sag } = cablePts(side);
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.7, 6, false);
    group.add(new THREE.Mesh(tube, cableMat));
    for (let s = 12; s < Lt - 12; s += 18) {
      const off = side * (b.w / 2 + 1.5);
      const x = ax + ux * s + nx * off, z = az + uz * s + nz * off;
      hangerPos.push(x, sag(s), z, x, deckY(s), z);
    }
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(hangerPos, 3));
  const hangerMat = new THREE.LineBasicMaterial({ color: 0x6d767d, transparent: true, opacity: 0.45 });
  group.add(new THREE.LineSegments(hg, hangerMat));
  // gece LED ışıkları (kablolar boyunca renk değiştirir)
  group.userData.bridgeLights = { cableMat, hangerMat };
}

// Köprü ışıklarının renk döngüsü
export function updateBridgeLights(group, t, night) {
  const L = group.userData.bridgeLights;
  if (!L) return;
  const hue = (t * 0.03) % 1;
  if (night > 0.05) {
    L.cableMat.emissive.setHSL(hue, 0.9, 0.5).multiplyScalar(night * 2.2);
    L.hangerMat.color.setHSL((hue + 0.08) % 1, 0.85, 0.6);
  } else {
    L.cableMat.emissive.setRGB(0, 0, 0);
    L.hangerMat.color.set(0x6d767d);
  }
}
