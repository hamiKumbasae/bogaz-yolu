// Sokak hayatı: yürüyen yayalar, duraklar, trafik ışıkları, banklar, çöp kutuları, babalar, büfeler
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch, wetMaterial, nightLightMaterial, U } from './shade.js';
import { rng, clamp, damp } from './util.js';

const clean = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
// parça: renk + bölge kimliği (0 gövde, 1 sol bacak, 2 sağ bacak, 3 sol kol, 4 sağ kol, 5 gömlek)
function part(g, color, id) {
  g = clean(g);
  const n = g.attributes.position.count, c = new THREE.Color(color), col = [], pid = [];
  for (let i = 0; i < n; i++) { col.push(c.r, c.g, c.b); pid.push(id); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(pid, 1));
  return g;
}
const colored = (g, c) => part(g, c, 0);

function personGeometry() {
  const skin = 0xc99a7a, hair = 0x2b2018, pants = 0x2c3442, shoe = 0x1c1c1c;
  return mergeGeometries([
    part(new THREE.BoxGeometry(0.15, 0.82, 0.17).translate(-0.1, 0.45, 0), pants, 1),
    part(new THREE.BoxGeometry(0.15, 0.82, 0.17).translate(0.1, 0.45, 0), pants, 2),
    part(new THREE.BoxGeometry(0.16, 0.08, 0.26).translate(-0.1, 0.04, 0.04), shoe, 1),
    part(new THREE.BoxGeometry(0.16, 0.08, 0.26).translate(0.1, 0.04, 0.04), shoe, 2),
    part(new THREE.BoxGeometry(0.42, 0.62, 0.24).translate(0, 1.16, 0), 0xffffff, 5),
    part(new THREE.BoxGeometry(0.11, 0.6, 0.13).translate(-0.27, 1.13, 0), 0xffffff, 3),
    part(new THREE.BoxGeometry(0.11, 0.6, 0.13).translate(0.27, 1.13, 0), 0xffffff, 4),
    part(new THREE.SphereGeometry(0.06, 6, 4).translate(-0.27, 0.8, 0), skin, 3),
    part(new THREE.SphereGeometry(0.06, 6, 4).translate(0.27, 0.8, 0), skin, 4),
    part(new THREE.BoxGeometry(0.1, 0.08, 0.1).translate(0, 1.5, 0), skin, 0),
    part(new THREE.SphereGeometry(0.115, 10, 8).scale(1, 1.15, 1.05).translate(0, 1.66, 0), skin, 0),
    part(new THREE.SphereGeometry(0.122, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.1, 1.08).translate(0, 1.68, -0.01), hair, 0),
  ]);
}

function pedMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  return patch(m, 'ped', {
    vdecl: 'attribute float aPart; attribute vec4 iWalk; attribute vec3 iShirt; varying float vPart; varying vec3 vShirt;',
    vpre: `
      {
        float ph = uTime * iWalk.y + iWalk.x;
        float sw = sin(ph) * iWalk.z;
        float ang = 0.0; float py = 0.86;
        if (aPart > 0.5 && aPart < 1.5) ang = sw;
        else if (aPart > 1.5 && aPart < 2.5) ang = -sw;
        else if (aPart > 2.5 && aPart < 3.5) { ang = -sw * 0.8; py = 1.42; }
        else if (aPart > 3.5 && aPart < 4.5) { ang = sw * 0.8; py = 1.42; }
        if (ang != 0.0) {
          float c = cos(ang), s = sin(ang);
          vec3 p = transformed - vec3(0.0, py, 0.0);
          transformed = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c) + vec3(0.0, py, 0.0);
        }
        transformed.y += abs(cos(ph)) * 0.035 * step(0.01, iWalk.z);
      }
    `,
    vmain: 'vPart = aPart; vShirt = iShirt;',
    fdecl: 'varying float vPart; varying vec3 vShirt;',
    color: 'if (vPart > 2.5) diffuseColor.rgb *= (vPart > 4.5 || (vPart > 2.5 && vPart < 4.5 && diffuseColor.r > 0.95)) ? vShirt : vec3(1.0);',
  });
}

export class StreetLife {
  constructor(path, li, H, bidx, scene, quality) {
    this.path = path; this.li = li; this.H = H; this.bidx = bidx;
    this.r = rng(2024);
    this.N = quality >= 3 ? 320 : quality >= 2 ? 220 : quality >= 1 ? 120 : 0;
    this.peds = [];
    const geo = personGeometry();
    this.walk = new Float32Array(this.N * 4);
    this.shirt = new Float32Array(this.N * 3);
    geo.setAttribute('iWalk', new THREE.InstancedBufferAttribute(this.walk, 4));
    geo.setAttribute('iShirt', new THREE.InstancedBufferAttribute(this.shirt, 3));
    this.mesh = new THREE.InstancedMesh(geo, pedMaterial(), Math.max(1, this.N));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.layers.set(1);
    scene.add(this.mesh);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1); this.up = new THREE.Vector3(0, 1, 0);
    this.shirts = [0x9c2b2b, 0x2b4f9c, 0xe0e0dc, 0x1d1d20, 0x3f6b3a, 0xc9a24a, 0x6a3f86, 0x8a8f96, 0xd46a2a, 0x2f8a8a, 0xb5485f, 0x4a4036].map((c) => new THREE.Color(c));
    this.pt = {};
  }
  spawn(ps, initial) {
    const r = this.r;
    for (let t = 0; t < 8; t++) {
      const s = initial ? ps + (r() - 0.3) * 600 : ps + (r() < 0.75 ? 200 + r() * 250 : -(120 + r() * 120));
      if (s < 5 || s > this.path.length - 5) continue;
      const i = Math.round(s / this.path.step);
      const w = this.li.W[i];
      const side = this.li.OW[i] || r() < 0.5 ? 1 : -1;   // tek yönlü yolda sol taraf diğer şerittir
      const off = side * (w / 2 + 0.9 + r() * 1.6);
      const p = this.path.at(s, this.pt);
      const x = p.x - p.tz * off, z = p.z + p.tx * off;
      if (this.H.at(x, z) < 0.2 && this.H.ground(x, z) <= 0.01 && r() < 0.6) continue;
      if (this.bidx.inside(x, z, 0.4)) continue;
      const k = this.peds.length;
      const stand = r() < 0.14;
      const sp = stand ? 0 : 1.05 + r() * 0.55;
      this.peds.push({ s, off, base: off, dir: r() < 0.5 ? 1 : -1, sp, dodge: 0, x, z, h: 0, k });
      const c = this.shirts[Math.floor(r() * this.shirts.length)];
      return { c, phase: r() * 6.28, freq: sp * 5.2, amp: stand ? 0 : 0.42 + r() * 0.12 };
    }
    return null;
  }
  update(dt, car, ps) {
    if (!this.N) return;
    // uzaktakileri çıkar
    for (let k = this.peds.length - 1; k >= 0; k--) {
      const p = this.peds[k];
      if (p.s < ps - 300 || p.s > ps + 650 || p.s < 3 || p.s > this.path.length - 3) this.peds.splice(k, 1);
    }
    let guard = 0;
    while (this.peds.length < this.N && guard++ < 12) {
      const info = this.spawn(ps, this.peds.length < this.N * 0.6 && this.initial);
      if (!info) break;
      const p = this.peds[this.peds.length - 1];
      p.info = info;
    }
    this.initial = false;
    const csp = car.speed;
    for (const p of this.peds) {
      p.s += p.dir * p.sp * dt;
      const pt = this.path.at(p.s, this.pt);
      let x = pt.x - pt.tz * p.off, z = pt.z + pt.tx * p.off;
      // araba yaklaşırsa kenara kaç
      const dx = x - car.x, dz = z - car.z, d = Math.hypot(dx, dz);
      if (d < 7 && csp > 3) {
        p.dodge = Math.min(2.5, p.dodge + dt * 6);
      } else p.dodge = Math.max(0, p.dodge - dt * 0.8);
      const off = p.off + Math.sign(p.off || 1) * p.dodge;
      x = pt.x - pt.tz * off; z = pt.z + pt.tx * off;
      p.x = x; p.z = z;
      p.h = Math.atan2(pt.tz * p.dir, pt.tx * p.dir);
    }
    // örnekleri yaz
    const n = this.peds.length;
    for (let k = 0; k < n; k++) {
      const p = this.peds[k];
      this.q.setFromAxisAngle(this.up, Math.PI / 2 - p.h);
      this.v.set(p.x, this.H.ground(p.x, p.z) + 0.17, p.z);
      this.m4.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(k, this.m4);
      const inf = p.info || { c: this.shirts[0], phase: 0, freq: 6, amp: 0.4 };
      this.walk[k * 4] = inf.phase; this.walk[k * 4 + 1] = inf.freq; this.walk[k * 4 + 2] = p.dodge > 0.1 ? 0.55 : inf.amp;
      this.shirt[k * 3] = inf.c.r; this.shirt[k * 3 + 1] = inf.c.g; this.shirt[k * 3 + 2] = inf.c.b;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.iWalk.needsUpdate = true;
    this.mesh.geometry.attributes.iShirt.needsUpdate = true;
  }
  reset() { this.peds.length = 0; this.initial = true; }
}

// ---------------------------------------------------------------- sabit sokak eşyaları
function tiledInst(geo, mat, list, group, shadow, extra) {
  const tiles = new Map();
  for (const it of list) { const k = Math.floor(it[0] / 512) + ',' + Math.floor(it[2] / 512); let a = tiles.get(k); if (!a) tiles.set(k, (a = [])); a.push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (const arr of tiles.values()) {
    const g = extra ? geo.clone() : geo;
    if (extra) g.setAttribute(extra.name, new THREE.InstancedBufferAttribute(new Float32Array(arr.map(extra.get)), 1));
    const im = new THREE.InstancedMesh(g, mat, arr.length);
    arr.forEach((it, i) => { q.setFromAxisAngle(up, it[3]); v.set(it[0], it[1], it[2]); m4.compose(v, q, one); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere();
    im.castShadow = shadow; im.receiveShadow = true;
    im.layers.set(1);
    group.add(im);
  }
}

export function buildStreetFurniture(data, path, li, H, bidx, group, quality) {
  const r = rng(77);
  const metal = wetMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }, 'furn');
  // otobüs durağı
  const stop = mergeGeometries([
    colored(new THREE.BoxGeometry(3.6, 0.08, 1.5).translate(0, 2.5, 0), 0x8a9096),
    colored(new THREE.BoxGeometry(0.08, 2.5, 0.08).translate(-1.75, 1.25, -0.65), 0x6c7277),
    colored(new THREE.BoxGeometry(0.08, 2.5, 0.08).translate(1.75, 1.25, -0.65), 0x6c7277),
    colored(new THREE.BoxGeometry(3.5, 2.0, 0.04).translate(0, 1.3, -0.68), 0x7c97a6),
    colored(new THREE.BoxGeometry(0.04, 2.0, 1.2).translate(1.75, 1.3, -0.1), 0x7c97a6),
    colored(new THREE.BoxGeometry(2.4, 0.06, 0.4).translate(-0.3, 0.48, -0.42), 0x9b6d45),
    colored(new THREE.BoxGeometry(0.08, 3.0, 0.08).translate(2.2, 1.5, 0.5), 0x6c7277),
    colored(new THREE.BoxGeometry(0.6, 0.6, 0.06).translate(2.2, 2.75, 0.5), 0x1f5fa8),
  ]);
  // bank, çöp kutusu, baba (bollard), büfe
  const bench = mergeGeometries([
    colored(new THREE.BoxGeometry(1.8, 0.06, 0.45).translate(0, 0.45, 0), 0x8b5e3c),
    colored(new THREE.BoxGeometry(1.8, 0.4, 0.05).translate(0, 0.7, -0.22), 0x8b5e3c),
    colored(new THREE.BoxGeometry(0.06, 0.45, 0.45).translate(-0.8, 0.22, 0), 0x3a3d40),
    colored(new THREE.BoxGeometry(0.06, 0.45, 0.45).translate(0.8, 0.22, 0), 0x3a3d40),
  ]);
  const bin = mergeGeometries([colored(new THREE.CylinderGeometry(0.28, 0.24, 0.85, 10).translate(0, 0.43, 0), 0x3c6e4a), colored(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10).translate(0, 0.88, 0), 0x2b2d30)]);
  const bollard = mergeGeometries([colored(new THREE.CylinderGeometry(0.07, 0.09, 0.8, 6).translate(0, 0.4, 0), 0x2f3236), colored(new THREE.SphereGeometry(0.075, 6, 4).translate(0, 0.8, 0), 0x2f3236)]);
  const kiosk = mergeGeometries([
    colored(new THREE.BoxGeometry(2.4, 2.4, 1.8).translate(0, 1.2, 0), 0xd9d4c4),
    colored(new THREE.BoxGeometry(2.7, 0.15, 2.1).translate(0, 2.47, 0), 0x2f5d8a),
    colored(new THREE.BoxGeometry(2.0, 1.0, 0.04).translate(0, 1.45, 0.91), 0x26333c),
    colored(new THREE.BoxGeometry(2.1, 0.35, 0.05).translate(0, 2.2, 0.93), 0xc62828),
  ]);
  const stops = [], benches = [], bins = [], bolls = [], kiosks = [];
  const at = (s, off) => {
    const p = path.at(s);
    const x = p.x - p.tz * off, z = p.z + p.tx * off;
    return [x, z, p];
  };
  for (let s = 180; s < path.length - 50; s += 380 + r() * 200) {
    const i = Math.round(s / path.step);
    const w = li.W[i];
    const [x, z, p] = at(s, w / 2 + 1.6);
    if (bidx.inside(x, z, 1.5) || H.at(x, z) < 0.2) continue;
    stops.push([x, H.ground(x, z) + 0.17, z, Math.atan2(p.tz, -p.tx)]);
  }
  for (let s = 30; s < path.length - 10; s += 22 + r() * 40) {
    const i = Math.round(s / path.step);
    const w = li.W[i];
    for (const side of [1, -1]) {
      if (li.OW[i] && side < 0) continue;
      const off = side * (w / 2 + 2.6 + r() * 0.6);
      const [x, z, p] = at(s, off);
      if (bidx.inside(x, z, 0.8) || H.at(x, z) < 0.2) continue;
      const ry = Math.atan2(side * p.tz, -side * p.tx);
      const k = r();
      if (k < 0.25) benches.push([x, H.ground(x, z) + 0.17, z, ry]);
      else if (k < 0.5) bins.push([x, H.ground(x, z) + 0.17, z, 0]);
      else if (k < 0.53 && w > 8) kiosks.push([x, H.ground(x, z) + 0.17, z, ry]);
    }
  }
  // babalar: binaların yola yakın olduğu kesimlerde kaldırım kenarı boyunca
  for (let s = 20; s < path.length - 10;) {
    const len = 30 + r() * 80;
    const on = r() < 0.4;
    for (let t = s; on && t < s + len && t < path.length - 5; t += 2.4) {
      const i = Math.round(t / path.step);
      const w = li.W[i];
      for (const side of [1, -1]) {
        if (li.OW[i] && side < 0) continue;
        const [x, z] = at(t, side * (w / 2 + 0.35));
        if (H.at(x, z) < 0.2 || bidx.inside(x, z, 0.3)) continue;
        bolls.push([x, H.ground(x, z) + 0.17, z, 0]);
      }
    }
    s += len + 20 + r() * 60;
  }
  tiledInst(stop, metal, stops, group, true);
  tiledInst(bench, metal, benches, group, true);
  tiledInst(bin, metal, bins, group, true);
  tiledInst(bollard, metal, bolls, group, false);
  tiledInst(kiosk, metal, kiosks, group, true);
  // trafik ışıkları: rotaya yakın kavşaklar
  const tl = [];
  for (const [jx, jz, jw] of data.junc) {
    const nr = path.nearest(jx, jz);
    if (nr.d > 6 || jw < 9) continue;
    if (tl.some((t) => Math.hypot(t[0] - jx, t[2] - jz) < 40)) continue;
    const p = path.at(Math.max(0, nr.s - jw / 2 - 4));
    const i = Math.round(nr.s / path.step);
    const w = li.W[i];
    const off = w / 2 + 0.6;
    const x = p.x - p.tz * off, z = p.z + p.tx * off;
    tl.push([x, H.ground(x, z) + 0.17, z, Math.atan2(-p.tx, -p.tz), r()]);
  }
  const tpole = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6).translate(0, 1.7, 0), 0x3a3d40),
    colored(new THREE.BoxGeometry(0.36, 1.0, 0.3).translate(0, 3.0, 0), 0x2b2d30),
    colored(new THREE.BoxGeometry(0.46, 1.1, 0.04).translate(0, 3.0, -0.17), 0x1d1f21),
  ]);
  tiledInst(tpole, metal, tl, group, true);
  // ışıklar: tek geometri, lamba kimliği (0 kırmızı, 1 sarı, 2 yeşil), örnek başına evre
  const lamps = [];
  [[0xff2a1a, 3.32], [0xffb21a, 3.0], [0x1aff6a, 2.68]].forEach(([c, y], id) => {
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12).rotateX(Math.PI / 2).translate(0, y, 0.17);
    const col = new THREE.Color(c), arr = [], ids = [];
    for (let k = 0; k < g.attributes.position.count; k++) { arr.push(col.r, col.g, col.b); ids.push(id); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    g.setAttribute('aLamp', new THREE.Float32BufferAttribute(ids, 1));
    lamps.push(clean2(g));
  });
  const lampG = mergeGeometries(lamps);
  const lampM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0xffffff });
  patch(lampM, 'tlight', {
    vdecl: 'attribute float aLamp; attribute float iPh; varying float vOn;',
    vmain: `{ float st = fract(uTime / 28.0 + iPh); float want = st < 0.55 ? 2.0 : (st < 0.64 ? 1.0 : 0.0); vOn = abs(aLamp - want) < 0.5 ? 1.0 : 0.0; }`,
    fdecl: 'varying float vOn;',
    color: 'diffuseColor.rgb *= 0.25 + 0.75 * vOn;',
    emissive: 'totalEmissiveRadiance = vColor * vOn * (1.6 + uNight * 1.8);',
  });
  tiledInst(lampG, lampM, tl, group, false, { name: 'iPh', get: (it) => it[4] });
  return { stops: stops.length, benches: benches.length, bins: bins.length, bollards: bolls.length, kiosks: kiosks.length, lights: tl.length };
}

function clean2(g) {
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aLamp'].includes(k)) g.deleteAttribute(k);
  return g;
}
