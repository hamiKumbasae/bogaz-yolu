// Ağaçlar, sokak lambaları, park etmiş arabalar, çatı su depoları, kontrol noktası kapıları
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { nightLightMaterial, wetMaterial, patch, U } from './shade.js';
import { rng, pointInRing, ringArea } from './util.js';
import * as TX from './textures.js';

// bina noktası sorgusu (ağaç/lamba binaya düşmesin)
export class BuildingIndex {
  constructor(buildings, cell = 40) {
    this.cell = cell; this.b = buildings; this.g = new Map();
    buildings.forEach((b, k) => {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const p of b.r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const key = i * 100003 + j;
        let a = this.g.get(key);
        if (!a) this.g.set(key, (a = []));
        a.push(k);
      }
    });
  }
  inside(x, z, pad = 0) {
    const a = this.g.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (!a) return false;
    for (const k of a) {
      if (pointInRing(x, z, this.b[k].r)) return true;
      if (pad > 0) for (const [dx, dz] of [[pad, 0], [-pad, 0], [0, pad], [0, -pad]]) if (pointInRing(x + dx, z + dz, this.b[k].r)) return true;
    }
    return false;
  }
}

// örnekli ağ: 512 m karolara bölünür ki görüş/gölge ayıklaması çalışsın; katman 1 = su yansımasında çizilmez
function inst(geo, mat, list, group, shadow = false, tile = 512, layer = 1) {
  if (!list.length) return null;
  const tiles = new Map();
  const v = new THREE.Vector3();
  for (const m of list) {
    v.setFromMatrixPosition(m);
    const k = Math.floor(v.x / tile) + ',' + Math.floor(v.z / tile);
    let a = tiles.get(k);
    if (!a) tiles.set(k, (a = []));
    a.push(m);
  }
  const out = [];
  for (const arr of tiles.values()) {
    const im = new THREE.InstancedMesh(geo, mat, arr.length);
    arr.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = shadow; im.receiveShadow = true;
    im.computeBoundingSphere();
    if (layer) im.layers.set(layer);
    group.add(im);
    out.push(im);
  }
  return out;
}

const clean = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
const colored = (g, c) => { g = clean(g); const col = new THREE.Color(c); const a = []; for (let i = 0; i < g.attributes.position.count; i++) a.push(col.r, col.g, col.b); g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g; };

export function buildProps(data, H, path, li, bidx, group, quality) {
  const r = rng(99);
  const m4 = () => new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (x, y, z, ry = 0, s = 1, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(up, ry), new THREE.Vector3(s, sy, s));

  // ---------------- ağaçlar
  const leafy = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 5, 1, true).translate(0, 1.6, 0), 0x4a3a2a),
    colored(new THREE.IcosahedronGeometry(2.0, 0).translate(0, 4.3, 0), 0x3d5a2a),
    colored(new THREE.IcosahedronGeometry(1.6, 0).rotateY(0.7).translate(1.0, 3.7, 0.4), 0x46652f),
    colored(new THREE.IcosahedronGeometry(1.5, 0).rotateX(0.5).translate(-0.8, 3.9, -0.6), 0x365224),
  ]);
  const cypress = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 5, 1, true).translate(0, 0.7, 0), 0x4a3a2a),
    colored(new THREE.ConeGeometry(0.95, 8.5, 7, 1, true).translate(0, 5.4, 0), 0x22381c),
  ]);
  const treeMat = wetMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }, 'tree');
  const trees = [], cyps = [];
  const addTree = (x, z, kind = 0) => {
    const g = H.ground(x, z);
    if (H.at(x, z) < 0.3) return;
    if (bidx.inside(x, z, 1.5)) return;
    const s = 0.75 + r() * 0.6;
    (kind ? cyps : trees).push(place(x, g - 0.1, z, r() * 6.28, s, s * (0.85 + r() * 0.3)));
  };
  for (const [x, z] of data.trees) addTree(x, z, r() < 0.15 ? 1 : 0);
  // parklar
  const pv = data.park.v, pi = data.park.i;
  let budget = quality >= 2 ? 6000 : 2500;
  for (let t = 0; t < pi.length && budget > 0; t += 3) {
    const ax = pv[pi[t] * 2], az = pv[pi[t] * 2 + 1], bx = pv[pi[t + 1] * 2], bz = pv[pi[t + 1] * 2 + 1], cx = pv[pi[t + 2] * 2], cz = pv[pi[t + 2] * 2 + 1];
    const area = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
    let n = area / 110;
    while (n > 0 && budget > 0) {
      if (n < 1 && r() > n) break;
      let u = r(), v = r();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      addTree(ax + (bx - ax) * u + (cx - ax) * v, az + (bz - az) * u + (cz - az) * v, r() < 0.12 ? 1 : 0);
      n -= 1; budget--;
    }
  }
  // rota boyunca kaldırım ağaçları
  for (let s = 10; s < path.length; s += 13 + r() * 10) {
    const p = path.at(s);
    const i = Math.round(s / path.step);
    const w = li.W[i];
    for (const side of [1, -1]) {
      if (r() < 0.45) continue;
      const o = side * (w / 2 + 2.3);
      const x = p.x - p.tz * o, z = p.z + p.tx * o;
      addTree(x, z, 0);
    }
  }
  // cami bahçelerinde servi
  for (const q of data.mosques) {
    for (let k = 0; k < 5; k++) {
      const a = r() * 6.28, d = Math.max(q.L, q.W) * (0.55 + r() * 0.3);
      addTree(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d, 1);
    }
  }
  inst(leafy, treeMat, trees, group, true);
  inst(cypress, treeMat, cyps, group, true);

  // ---------------- sokak lambaları ve ışık havuzları
  const pole = mergeGeometries([
    clean(new THREE.CylinderGeometry(0.07, 0.11, 8.5, 6).translate(0, 4.25, 0)),
    clean(new THREE.BoxGeometry(1.9, 0.08, 0.08).translate(0.9, 8.4, 0)),
    clean(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 6).translate(0, 0.3, 0)),
  ]);
  const head = clean(new THREE.BoxGeometry(0.75, 0.14, 0.3).translate(1.75, 8.3, 0));
  const poleMat = wetMaterial({ color: 0x3b4046, metalness: 0.6, roughness: 0.5 }, 'pole');
  const headMat = nightLightMaterial(0xffc98a, 5.0, 0.0);
  const poolTex = TX.radial('rgba(255,190,120,1)', 'rgba(255,190,120,0)', 128);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: true });
  const pool = new THREE.PlaneGeometry(15, 15).rotateX(-Math.PI / 2);
  const poles = [], pools = [];
  const lampAt = (x, z, dx, dz) => {
    if (bidx.inside(x, z, 0.6)) return;
    const L = Math.hypot(dx, dz) || 1;
    dx /= L; dz /= L;
    const ang = Math.atan2(-dz, dx);
    const g = H.ground(x, z);
    poles.push(place(x, g, z, ang));
    const hx = x + dx * 1.75, hz = z + dz * 1.75;
    pools.push(new THREE.Matrix4().makeTranslation(hx, H.ground(hx, hz) + 0.1, hz));
  };
  for (let s = 6; s < path.length; s += 32) {
    const p = path.at(s);
    const i = Math.round(s / path.step);
    const w = li.W[i], ow = li.OW[i];
    for (const side of ow ? [1] : [1, -1]) {
      const o = side * (w / 2 + 0.8);
      const x = p.x - p.tz * o, z = p.z + p.tx * o;
      lampAt(x, z, p.tz * side, -p.tx * side);
    }
  }
  // köprü korkuluklarında lambalar (kol yola doğru)
  for (const line of data.deck) {
    let acc = 0;
    for (let k = 0; k < line.length - 1; k++) {
      const [ax, az] = line[k], [bx, bz] = line[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      while (acc < L) {
        const t = acc / L;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const nr = path.nearest(x, z);
        if (nr.d < 45) { const q = path.at(nr.s); lampAt(x, z, q.x - x, q.z - z); }
        acc += 30;
      }
      acc -= L;
    }
  }
  const pm = inst(pole, poleMat, poles, group, true);
  const hm = inst(head, headMat, poles, group, false, 512, 0);
  const pl = inst(pool, poolMat, pools, group, false);
  if (pl) pl.forEach((m) => { m.receiveShadow = false; m.renderOrder = 2; });

  // ---------------- çatı su depoları ve çanak antenler
  const tank = mergeGeometries([clean(new THREE.CylinderGeometry(0.65, 0.65, 1.5, 7).rotateZ(Math.PI / 2).translate(0, 0.8, 0)),
    clean(new THREE.BoxGeometry(1.4, 0.5, 0.9).translate(0, 0.25, 0))]);
  const tankMat = wetMaterial({ color: 0xd9d6cf, roughness: 0.6, metalness: 0.3 }, 'tank');
  const tanks = [];
  for (const b of data.buildings) {
    if (b.far || b.s === 'palace' || b.s === 'stone') continue;
    const A = Math.abs(ringArea(b.r));
    if (A < 70 || A > 2500 || r() < 0.35) continue;
    let cx = 0, cz = 0, gs = 0, gmax = -1e9;
    for (const p of b.r) { cx += p[0]; cz += p[1]; const g = H.ground(p[0], p[1]); gs += g; gmax = Math.max(gmax, g); }
    cx /= b.r.length; cz /= b.r.length;
    let top = gs / b.r.length + b.h;
    if (top < gmax + 2.5) top = gmax + 2.5;
    if (!pointInRing(cx, cz, b.r)) continue;
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const x = cx + (r() - 0.5) * 3, z = cz + (r() - 0.5) * 3;
      if (!pointInRing(x, z, b.r)) continue;
      tanks.push(place(x, top, z, r() * 6.28, 0.8 + r() * 0.4));
    }
  }
  inst(tank, tankMat, tanks, group, false);

  // ---------------- park etmiş arabalar (basit kutu modeller)
  const parked = buildParked(data, H, bidx, r, quality);
  for (const p of parked) group.add(p);

  return { poolMat, counts: { trees: trees.length + cyps.length, lamps: poles.length, tanks: tanks.length } };
}

function buildParked(data, H, bidx, r, quality) {
  const out = [];
  const body = mergeGeometries([clean(new THREE.BoxGeometry(4.3, 0.62, 1.74).translate(0, 0.62, 0))]);
  const cab = clean(new THREE.BoxGeometry(2.2, 0.5, 1.5).translate(-0.25, 1.18, 0));
  const wheel = mergeGeometries([1.35, -1.35].map((x) => clean(new THREE.BoxGeometry(0.62, 0.6, 1.78).translate(x, 0.3, 0))));
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.4, clearcoat: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1418, metalness: 0.3, roughness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.8 });
  const colors = [0xe9e9e9, 0x1d1f22, 0x8c9196, 0x6b0f12, 0x1f3b66, 0xbfc3c7, 0xf2c200, 0xd0c7b0, 0xffffff, 0x2c5aa0, 0x3a4a3a];
  const mats = [];
  const cols = [];
  const junc = data.junc;
  const jgrid = new Map();
  for (const [x, z, w] of junc) { const k = Math.floor(x / 30) * 100003 + Math.floor(z / 30); let a = jgrid.get(k); if (!a) jgrid.set(k, (a = [])); a.push([x, z, w]); }
  const nearJ = (x, z) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = jgrid.get((Math.floor(x / 30) + i) * 100003 + Math.floor(z / 30) + j);
      if (a) for (const [jx, jz, w] of a) if (Math.hypot(jx - x, jz - z) < w / 2 + 7) return true;
    }
    return false;
  };
  const OK = new Set(['residential', 'tertiary', 'unclassified', 'secondary', 'living_street']);
  const cap = quality >= 2 ? 3000 : 1500;
  for (const rd of data.roads) {
    if (!OK.has(rd.hw) || rd.w < 5.5 || rd.b || rd.e) continue;
    const g = rd.g;
    for (let k = 0; k < g.length - 1 && mats.length < cap; k++) {
      const [ax, az] = g[k], [bx, bz] = g[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let s = 3; s < L - 3; s += 5.6) {
        for (const side of [1, -1]) {
          if (r() > 0.5) continue;
          const o = side * (rd.w / 2 - 1.05);
          const x = ax + ux * s - uz * o, z = az + uz * s + ux * o;
          if (H.at(x, z) < 0.3 || nearJ(x, z) || bidx.inside(x, z, 1.2)) continue;
          const ang = Math.atan2(uz, ux) + (r() < 0.5 ? Math.PI : 0);
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, H.ground(x, z) + 0.05, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang), new THREE.Vector3(1, 1, 1)));
          cols.push(colors[Math.floor(r() * colors.length)]);
        }
      }
    }
  }
  if (!mats.length) return out;
  const mk = (geo, mat, color) => {
    const tiles = new Map();
    const v = new THREE.Vector3();
    mats.forEach((m, i) => { v.setFromMatrixPosition(m); const k = Math.floor(v.x / 512) + ',' + Math.floor(v.z / 512); let a = tiles.get(k); if (!a) tiles.set(k, (a = [])); a.push(i); });
    const c = new THREE.Color();
    for (const ids of tiles.values()) {
      const im = new THREE.InstancedMesh(geo, mat, ids.length);
      ids.forEach((id, i) => { im.setMatrixAt(i, mats[id]); if (color) im.setColorAt(i, c.set(cols[id])); });
      im.computeBoundingSphere();
      im.receiveShadow = true;
      im.layers.set(1);
      out.push(im);
    }
  };
  mk(body, paint, true); mk(cab, glass, false); mk(wheel, dark, false);
  return out;
}

// ---------------- kontrol noktası kapıları
export function buildGates(path, li, cps, H, group) {
  const gates = [];
  const pillarMat = nightLightMaterial(0xff6a1f, 2.5, 1.2);
  for (const cp of cps) {
    const p = path.at(cp.s);
    const i = Math.round(cp.s / path.step);
    const w = li.W[i] + 3;
    const g = new THREE.Group();
    const y = H.ground(p.x, p.z);
    g.position.set(p.x, y, p.z);
    g.rotation.y = -Math.atan2(p.tz, p.tx);
    const pil = new THREE.BoxGeometry(0.5, 7.5, 0.5).translate(0, 3.75, 0);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(pil, pillarMat);
      m.position.z = s * w / 2;
      g.add(m);
    }
    const tex = TX.banner(cp.name, cp.last ? 'BİTİŞ' : null);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false }));
    ban.rotation.y = Math.PI / 2;
    ban.position.y = 7.6;
    g.add(ban);
    group.add(g);
    gates.push({ g, s: cp.s, name: cp.name });
  }
  return gates;
}
