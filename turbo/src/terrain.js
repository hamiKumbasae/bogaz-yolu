// Yükseklik alanı ve arazi parçaları
import * as THREE from 'three';
import { terrainMaterial } from './shade.js';

export class Height {
  constructor(meta, buf, sea) {
    this.x0 = meta.x0; this.z0 = meta.z0; this.step = meta.step; this.nx = meta.nx; this.nz = meta.nz;
    this.h = new Int16Array(buf);
    this.sea = sea;
  }
  raw(i, j) {
    i = i < 0 ? 0 : i >= this.nx ? this.nx - 1 : i;
    j = j < 0 ? 0 : j >= this.nz ? this.nz - 1 : j;
    return this.h[j * this.nx + i] * 0.1;
  }
  at(x, z) {
    const fx = (x - this.x0) / this.step, fz = (z - this.z0) / this.step;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    // ızgara üçgenleriyle aynı bölünme (i,j)-(i+1,j+1) köşegeni
    const a = this.raw(i, j), b = this.raw(i + 1, j), c = this.raw(i, j + 1), d = this.raw(i + 1, j + 1);
    if (u > v) return a + (b - a) * u + (d - b) * v;
    return a + (d - c) * u + (c - a) * v;
  }
  // sürülebilir yüzey (köprüler deniz üstünde 0'da)
  ground(x, z) { const h = this.at(x, z); return h > 0 ? h : 0; }
  // eğim normali
  normal(x, z, out) {
    const e = 2.0;
    const hx = this.ground(x + e, z) - this.ground(x - e, z), hz = this.ground(x, z + e) - this.ground(x, z - e);
    out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
    return out;
  }
}

const CH = 64; // parça başına hücre

function chunkGeometry(H, i0, j0, cells, step, cx, cz) {
  const n = Math.floor(cells / step) + 1;
  const S = H.step;
  const pos = [], nor = [], idx = [];
  const vid = (a, b) => a * n + b;
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const i = i0 + b * step, j = j0 + a * step;
      const x = H.x0 + i * S, z = H.z0 + j * S;
      const y = H.raw(i, j);
      pos.push(x - cx, y, z - cz);
      const hx = H.raw(i + 1, j) - H.raw(i - 1, j), hz = H.raw(i, j + 1) - H.raw(i, j - 1);
      const L = Math.hypot(hx, 2 * S, hz);
      nor.push(-hx / L, (2 * S) / L, -hz / L);
    }
  }
  for (let a = 0; a < n - 1; a++) for (let b = 0; b < n - 1; b++) {
    const p = vid(a, b), q = vid(a, b + 1), r = vid(a + 1, b), s = vid(a + 1, b + 1);
    idx.push(p, r, s, p, s, q);
  }
  // etek: parça kenarlarında aşağı inen şerit (LOD çatlaklarını gizler)
  const skirt = (list) => {
    const base = pos.length / 3;
    for (const k of list) {
      pos.push(pos[k * 3], pos[k * 3 + 1] - 12, pos[k * 3 + 2]);
      nor.push(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
    }
    for (let t = 0; t < list.length - 1; t++) {
      const a = list[t], b = list[t + 1], c = base + t, d = base + t + 1;
      idx.push(a, c, b, b, c, d, a, b, c, b, d, c);
    }
  };
  const top = [], bot = [], lef = [], rig = [];
  for (let b = 0; b < n; b++) { top.push(vid(0, b)); bot.push(vid(n - 1, b)); }
  for (let a = 0; a < n; a++) { lef.push(vid(a, 0)); rig.push(vid(a, n - 1)); }
  skirt(top); skirt(bot); skirt(lef); skirt(rig);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ızgaranın dışındaki halka: tek ağ, kaba adım (iç bölgenin üstünü atlar)
function ringGeometry(H, a0, b0, a1, b1, step, inner) {
  const pos = [], nor = [], idx = [];
  const S = H.step;
  const nx = Math.floor((a1 - a0) / step) + 1, nz = Math.floor((b1 - b0) / step) + 1;
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const i = a0 + a * step, j = b0 + b * step;
    pos.push(H.x0 + i * S, H.raw(i, j), H.z0 + j * S);
    const hx = H.raw(i + step, j) - H.raw(i - step, j), hz = H.raw(i, j + step) - H.raw(i, j - step);
    const L = Math.hypot(hx, 2 * S * step, hz);
    nor.push(-hx / L, (2 * S * step) / L, -hz / L);
  }
  for (let b = 0; b < nz - 1; b++) for (let a = 0; a < nx - 1; a++) {
    const i = a0 + a * step, j = b0 + b * step;
    if (i >= inner[0] && i + step <= inner[2] && j >= inner[1] && j + step <= inner[3]) continue;
    const p = b * nx + a, q = p + 1, r = p + nx, t = r + 1;
    idx.push(p, r, t, p, t, q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function buildTerrain(H, quality) {
  const group = new THREE.Group();
  group.name = 'arazi';
  const mat = terrainMaterial();
  const ncx = Math.ceil((H.nx - 1) / CH), ncz = Math.ceil((H.nz - 1) / CH);
  const near = quality >= 2 ? 1 : 2;
  for (let cj = 0; cj < ncz; cj++) {
    for (let ci = 0; ci < ncx; ci++) {
      const i0 = ci * CH, j0 = cj * CH;
      const cx = H.x0 + (i0 + CH / 2) * H.step, cz = H.z0 + (j0 + CH / 2) * H.step;
      const lod = new THREE.LOD();
      lod.position.set(cx, 0, cz);
      const hi = new THREE.Mesh(chunkGeometry(H, i0, j0, CH, near, cx, cz), mat);
      const lo = new THREE.Mesh(chunkGeometry(H, i0, j0, CH, 4, cx, cz), mat);
      hi.receiveShadow = true;
      lod.addLevel(hi, 0);
      lod.addLevel(lo, 2300);
      group.add(lod);
    }
  }
  const ring = 4 * CH;
  const m = new THREE.Mesh(ringGeometry(H, -ring, -ring, ncx * CH + ring, ncz * CH + ring, 16, [0, 0, ncx * CH, ncz * CH]), mat);
  group.add(m);
  return group;
}
