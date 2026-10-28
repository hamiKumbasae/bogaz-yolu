// Araç modelleri: oyuncu arabası, trafik (örneklenmiş), vapur ve gemiler
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { nightLightMaterial, patch, U } from './shade.js';
import { carShape, SPECS } from './carbody.js';

// yan profil komutları → kalınlaştırılmış gövde
function profile(cmds) {
  const s = new THREE.Shape();
  for (const c of cmds) {
    if (c[0] === 'm') s.moveTo(c[1], c[2]);
    else if (c[0] === 'l') s.lineTo(c[1], c[2]);
    else if (c[0] === 'q') s.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (c[0] === 'a') { s.lineTo(c[1] - c[3], c[2] - 0.05); s.absarc(c[1], c[2], c[3], Math.PI, 0, true); }
  }
  return s;
}

function extrude(cmds, width, bevel, warp) {
  const g = new THREE.ExtrudeGeometry(profile(cmds), { depth: Math.max(0.01, width - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 12, steps: 1 });
  g.translate(0, 0, -Math.max(0.01, width - 2 * bevel) / 2);
  const p = g.attributes.position;
  if (warp) for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * warp(p.getX(i), p.getY(i)));
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const boxAt = (w, h, d, x, y, z, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
};
const cylZ = (r, len, x, y, z, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2).translate(x, y, z);
const clean = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
const merge = (arr) => mergeGeometries(arr.map(clean), false);

// ---------------------------------------------------------------- malzemeler
export function carMaterials(color) {
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0e12, metalness: 0.2, roughness: 0.04, clearcoat: 1.0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.6, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.18, metalness: 1.0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.3, metalness: 0.9 });
  const caliper = new THREE.MeshStandardMaterial({ color: 0xd8261c, roughness: 0.4, metalness: 0.3 });
  const head = nightLightMaterial(0xfff4e0, 6.0, 0.6);
  const tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a10, emissiveIntensity: 1.2, roughness: 0.3 });
  return { paint, glass, dark, chrome, rubber, rim, caliper, head, tail };
}

// ---------------------------------------------------------------- oyuncu / rakip spor araba
const ellip = (rx, ry, rz, x, y, z, rotZ = 0, rotY = 0) => {
  const g = new THREE.SphereGeometry(1, 16, 10).scale(rx, ry, rz);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  return g.translate(x, y, z);
};
function splitGroups(g) {
  const out = [];
  const idx = g.index.array;
  for (const gr of g.groups) {
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', g.attributes.position);
    ng.setAttribute('normal', g.attributes.normal);
    ng.setIndex(Array.from(idx.slice(gr.start, gr.start + gr.count)));
    out.push(ng);
  }
  return out;
}

export function makeSportsCar(color = 0xc81d25) {
  const M = carMaterials(color);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const sp = SPECS.sport;
  const S = carShape(sp, 1);
  const bodyMesh = new THREE.Mesh(S.body, M.paint);
  const cabMesh = new THREE.Mesh(S.cab, [M.glass, M.paint]);
  bodyMesh.castShadow = cabMesh.castShadow = true;
  body.add(bodyMesh, cabMesh);
  const { xf, xr, ax } = S;
  // farlar: koyu cam yuva + ince LED şerit
  const hx = xf - 0.26;
  const lensG = merge([1, -1].map((sd) => ellip(0.2, 0.045, 0.14, hx, S.sh(hx) - 0.03, sd * (S.halfW(hx) - 0.2), -0.3, sd * 0.3)));
  body.add(new THREE.Mesh(lensG, M.glass));
  const headG = merge([1, -1].map((sd) => ellip(0.13, 0.018, 0.035, hx + 0.03, S.sh(hx) - 0.012, sd * (S.halfW(hx) - 0.24), -0.3, sd * 0.45)));
  const headM = new THREE.Mesh(headG, M.head);
  body.add(headM);
  // stop lambaları: arka yüz boyunca şerit + köşe lambaları
  const tx = xr + 0.012;
  const ty = sp.top[1][1] - 0.1;
  const tailG = merge([
    boxAt(0.03, 0.045, 2 * S.halfW(xr + 0.03) * 0.8, tx, ty, 0),
    ...[1, -1].map((sd) => boxAt(0.05, 0.09, 0.32, xr + 0.02, ty - 0.01, sd * (S.halfW(xr + 0.03) * 0.8 - 0.16))),
  ]);
  const tailM = new THREE.Mesh(tailG, M.tail);
  body.add(tailM);
  // koyu ayrıntılar
  const darkG = merge([
    boxAt(0.08, 0.14, 1.05, xf - 0.1, S.bottom(xf - 0.1) + 0.1, 0),           // ızgara
    boxAt(0.36, 0.13, 1.5, xr + 0.16, S.bottom(xr + 0.16) + 0.04, 0),         // difüzör
    boxAt(0.2, 0.025, 1.4, xr + 0.12, S.tp(xr + 0.12) + 0.03, 0),            // rüzgârlık dudağı
    ...[1, -1].map((sd) => boxAt(1.6, 0.07, 0.05, 0, sp.clear + 0.05, sd * (S.halfW(0) - 0.01))),  // marşpiyel
    ...[1, -1].map((sd) => boxAt(0.06, 0.05, 0.12, sp.g0 - 0.3, S.sh(sp.g0 - 0.3) + 0.05, sd * (S.halfW(sp.g0 - 0.3) * 0.9 + 0.05))), // ayna kolu
    boxAt(0.03, 0.05, 0.4, xr + 0.005, ty - 0.12, 0),                          // plaka yeri
  ]);
  const dm = new THREE.Mesh(darkG, M.dark); dm.castShadow = true; body.add(dm);
  const mirrorG = merge([1, -1].map((sd) => ellip(0.075, 0.045, 0.09, sp.g0 - 0.3, S.sh(sp.g0 - 0.3) + 0.1, sd * (S.halfW(sp.g0 - 0.3) * 0.9 + 0.12))));
  body.add(new THREE.Mesh(mirrorG, M.paint));
  body.add(new THREE.Mesh(merge([0.5, 0.36, -0.36, -0.5].map((z) => new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12).rotateZ(Math.PI / 2).translate(xr + 0.05, S.bottom(xr + 0.05) + 0.07, z))), M.chrome));
  const plate = new THREE.Mesh(boxAt(0.012, 0.11, 0.52, xr - 0.005, ty - 0.12, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
  body.add(plate);
  // tekerlekler
  const WR = sp.wr;
  const wheels = [];
  const tireG = new THREE.CylinderGeometry(WR, WR, 0.27, 32).rotateX(Math.PI / 2);
  const sideG = new THREE.TorusGeometry(WR - 0.045, 0.045, 8, 32);
  const rimG = merge([new THREE.CylinderGeometry(0.235, 0.235, 0.24, 24).rotateX(Math.PI / 2).translate(0, 0, -0.02),
    ...[0, 1, 2, 3, 4].map((k) => boxAt(0.045, 0.43, 0.03, 0, 0, 0.125).rotateZ(k * Math.PI / 5 * 2)),
    ...[0, 1, 2, 3, 4].map((k) => boxAt(0.035, 0.43, 0.03, 0, 0, 0.125).rotateZ(k * Math.PI / 5 * 2 + 0.22))]);
  const hubG = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12).rotateX(Math.PI / 2).translate(0, 0, 0.13);
  const calG = boxAt(0.14, 0.13, 0.05, 0.13, 0.07, 0.05);
  for (const [x, sd] of [[ax, 1], [ax, -1], [-ax, 1], [-ax, -1]]) {
    const z = sd * (S.halfW(x) - 0.17);
    const steer = new THREE.Group();
    steer.position.set(x, WR, z);
    const spin = new THREE.Group();
    const t = new THREE.Mesh(tireG, M.rubber); t.castShadow = true;
    const sw = new THREE.Mesh(sideG, M.rubber); sw.position.z = 0.12 * sd;
    const rm = new THREE.Mesh(rimG, M.rim); rm.scale.z = sd;
    const hb = new THREE.Mesh(hubG, M.chrome); hb.scale.z = sd;
    spin.add(t, sw, rm, hb);
    steer.add(spin);
    const cal = new THREE.Mesh(calG, M.caliper); cal.scale.z = sd;
    steer.add(cal);
    root.add(steer);
    wheels.push({ steer, spin, front: x > 0 });
  }
  return { root, body, wheels, M, headM, tailM };
}

// ---------------------------------------------------------------- trafik modelleri
// Her model: malzeme anahtarı → geometri. Ölçüler metre, ileri = +x
function loftCar(spec) {
  const S = carShape(spec, 0.5);
  const [glass, roof] = splitGroups(S.cab);
  const { xf, xr, ax } = S;
  const wr = spec.wr;
  const wheels = [];
  for (const [x, sd] of [[ax, 1], [ax, -1], [-ax, 1], [-ax, -1]]) wheels.push(cylZ(wr, 0.22, x, wr, sd * (S.halfW(x) - 0.15), 14));
  const hx = xf - 0.18, ty = S.sh(xr + 0.1) - 0.06;
  return {
    paint: merge([S.body, roof]), glass: merge([glass]),
    dark: merge([...wheels, boxAt(0.08, 0.14, spec.W * 0.55, xf - 0.06, S.bottom(xf - 0.06) + 0.1, 0), boxAt(0.14, 0.12, spec.W * 0.92, xr + 0.08, S.bottom(xr + 0.08) + 0.05, 0)]),
    head: merge([1, -1].map((sd) => ellip(0.16, 0.06, 0.18, hx, S.sh(hx) - 0.04, sd * (S.halfW(hx) - 0.22), -0.25))),
    tail: merge([1, -1].map((sd) => boxAt(0.05, 0.1, 0.3, xr + 0.03, ty, sd * (S.halfW(xr + 0.05) - 0.2)))),
  };
}

function busModel(L, W, H, minibus = false) {
  const a = L / 2, wr = minibus ? 0.36 : 0.5;
  const ax1 = a - (minibus ? 1.0 : 2.6), ax2 = -a + (minibus ? 1.3 : 3.2);
  const body = extrude([['m', -a, 0.45], ['l', ax2 - 0.62, 0.42], ['a', ax2, 0.5, 0.58], ['l', ax1 - 0.62, 0.42], ['a', ax1, 0.5, 0.58], ['l', a, 0.42],
    ['l', a + 0.05, H * 0.55], ['l', a - 0.15, H - 0.05], ['l', -a + 0.05, H], ['l', -a, 0.45]], W, 0.14);
  const band = boxAt(L - 0.9, H * 0.36, W + 0.02, -0.15, H * 0.62, 0);
  const wind = boxAt(0.1, H * 0.42, W * 0.86, a - 0.07, H * 0.62, 0, 0, 0.12);
  const wheels = [];
  for (const [x, z] of [[ax1, W / 2 - 0.25], [ax1, -W / 2 + 0.25], [ax2, W / 2 - 0.25], [ax2, -W / 2 + 0.25]]) wheels.push(cylZ(wr, 0.3, x, wr, z, 14));
  return {
    paint: merge([body]), glass: merge([band, wind]), dark: merge(wheels),
    head: merge([boxAt(0.06, 0.14, 0.35, a + 0.04, 0.75, W / 2 - 0.35), boxAt(0.06, 0.14, 0.35, a + 0.04, 0.75, -W / 2 + 0.35)]),
    tail: merge([boxAt(0.06, 0.3, 0.2, -a - 0.02, 1.0, W / 2 - 0.2), boxAt(0.06, 0.3, 0.2, -a - 0.02, 1.0, -W / 2 + 0.2)]),
  };
}

export function trafficModels() {
  const s = loftCar(SPECS.sedan);
  const h = loftCar(SPECS.hatch);
  const taxi = loftCar(SPECS.sedan);
  taxi.sign = boxAt(0.3, 0.17, 0.7, -0.3, SPECS.sedan.roof + 0.1, 0);
  const suv = loftCar(SPECS.suv);
  const bus = busModel(12, 2.55, 3.1);
  const dolmus = busModel(6.2, 2.05, 2.55, true);
  const van = busModel(5.2, 1.95, 2.2, true);
  return [
    { name: 'sedan', g: s, L: 4.55, W: 1.8, mass: 1.3, colors: [0xe9e9e9, 0x1d1f22, 0x8c9196, 0x6b0f12, 0x1f3b66, 0xbfc3c7, 0x3a4a3a, 0xd0c7b0], w: 30 },
    { name: 'hatch', g: h, L: 4.05, W: 1.75, mass: 1.1, colors: [0xf2f2f2, 0xb81d1d, 0x2c5aa0, 0x333333, 0xc9c1a4, 0x8a8f94], w: 22 },
    { name: 'taksi', g: taxi, L: 4.6, W: 1.8, mass: 1.3, colors: [0xf2c200], w: 22 },
    { name: 'suv', g: suv, L: 4.7, W: 1.9, mass: 1.8, colors: [0x2b2d30, 0xe3e3e3, 0x5d646b, 0x4a3b2c], w: 12 },
    { name: 'otobüs', g: bus, L: 12, W: 2.55, mass: 9, colors: [0xf1f1ee], w: 4, bus: true },
    { name: 'dolmuş', g: dolmus, L: 6.2, W: 2.05, mass: 3, colors: [0xf0c400, 0xe8e8e8], w: 6 },
    { name: 'kamyonet', g: van, L: 5.2, W: 1.95, mass: 2.4, colors: [0xffffff, 0xe0e0e0, 0x1f3b66], w: 6 },
  ];
}

// Örneklenmiş trafik çizici: model başına malzeme başına bir InstancedMesh
export class Fleet {
  constructor(models, capacity, group, shadow = true) {
    this.models = models;
    this.mats = {
      paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1015, metalness: 0.2, roughness: 0.06, clearcoat: 1.0 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7 }),
      head: nightLightMaterial(0xfff2d8, 3.0, 0.3),
      tail: nightLightMaterial(0xff1a10, 1.6, 0.5),
      sign: nightLightMaterial(0xffd23a, 3.0, 0.4),
    };
    this.meshes = models.map((m) => {
      const parts = {};
      for (const k of Object.keys(m.g)) {
        const im = new THREE.InstancedMesh(m.g[k], this.mats[k], capacity);
        im.count = 0;
        im.frustumCulled = false;
        im.castShadow = shadow && (k === 'paint' || k === 'glass');
        im.receiveShadow = k === 'paint';
        if (k === 'paint') im.setColorAt(0, new THREE.Color(1, 1, 1));
        group.add(im);
        parts[k] = im;
      }
      return parts;
    });
  }
  begin() { this.n = this.models.map(() => 0); }
  put(model, matrix, color) {
    const parts = this.meshes[model];
    const i = this.n[model]++;
    for (const k in parts) {
      const im = parts[k];
      if (i >= im.instanceMatrix.count) continue;
      im.setMatrixAt(i, matrix);
      if (k === 'paint') im.setColorAt(i, color);
    }
  }
  end() {
    this.meshes.forEach((parts, m) => {
      for (const k in parts) {
        const im = parts[k];
        im.count = Math.min(this.n[m], im.instanceMatrix.count);
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    });
  }
}

// ---------------------------------------------------------------- vapur (Şehir Hatları tarzı, markasız)
export function makeFerry() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.6 });
  const win = nightLightMaterial(0xffd9a0, 2.2, 0.0);
  const winDay = new THREE.MeshStandardMaterial({ color: 0x1c2630, roughness: 0.2, metalness: 0.4 });
  const funnel = new THREE.MeshStandardMaterial({ color: 0xe8b830, roughness: 0.5 });
  const L = 66, W = 13;
  const hull = extrude([['m', -L / 2, 0], ['l', L / 2 - 4, 0], ['q', L / 2 + 1, 0.4, L / 2 + 2, 4.5], ['l', -L / 2 - 1, 4.5], ['q', -L / 2 - 1.5, 1, -L / 2, 0]], W, 0.6,
    (x) => 1 - 0.35 * sm(L / 2 - 14, L / 2 + 2, x) - 0.25 * sm(L / 2 - 10, L / 2 + 2, -x));
  const hm = new THREE.Mesh(hull, black); g.add(hm);
  const h2 = new THREE.Mesh(boxAt(L - 6, 1.2, W - 0.8, -1, 4.5, 0), white); g.add(h2);
  g.add(new THREE.Mesh(merge([boxAt(L - 14, 2.6, W - 2.2, -2, 5.7, 0), boxAt(L - 26, 2.4, W - 3.6, -3, 8.3, 0), boxAt(8, 2.2, 5, 14, 10.7, 0)]), white));
  g.add(new THREE.Mesh(merge([boxAt(L - 15, 1.0, W - 2.15, -2, 6.6, 0), boxAt(L - 27, 0.9, W - 3.55, -3, 9.1, 0), boxAt(8.05, 0.9, 5.05, 14, 11.3, 0)]), winDay));
  const wl = new THREE.Mesh(merge([boxAt(L - 15.2, 0.7, W - 2.1, -2, 6.75, 0), boxAt(L - 27.2, 0.6, W - 3.5, -3, 9.25, 0)]), win);
  g.add(wl);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 6, 14).translate(-4, 13.5, 0), funnel));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 1.2, 14).translate(-4, 16.1, 0), black));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function makeShip(len = 180, color = 0x8a2a1e) {
  const g = new THREE.Group();
  const hullM = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const deckM = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.8 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 });
  const L = len, W = len * 0.15;
  const hull = extrude([['m', -L / 2, -6], ['l', L / 2 - 14, -6], ['q', L / 2 + 2, -5, L / 2 + 4, 8], ['l', -L / 2, 8], ['l', -L / 2, -6]], W, 1,
    (x) => 1 - 0.55 * sm(L / 2 - 26, L / 2 + 4, x));
  g.add(new THREE.Mesh(hull, hullM));
  g.add(new THREE.Mesh(boxAt(L - 30, 0.6, W - 2, 0, 8, 0), deckM));
  g.add(new THREE.Mesh(merge([boxAt(16, 14, W - 4, -L / 2 + 14, 8, 0), boxAt(6, 8, 5, -L / 2 + 10, 22, 0)]), whiteM));
  const cont = [];
  const cols = [0x2a5d8f, 0xb33a2a, 0x2f7d4f, 0xd08b2a, 0x6b6f75, 0x8a2a5c];
  const conts = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const geo = [];
    for (let x = -L / 2 + 30; x < L / 2 - 26; x += 13) {
      for (let r = 0; r < 3; r++) if (((x * 7 + r * 13 + i * 31) | 0) % 6 === i) geo.push(boxAt(12, 2.6, W - 4, x, 8.6 + r * 2.7, 0));
    }
    if (geo.length) conts.add(new THREE.Mesh(merge(geo), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.7 })));
  }
  g.add(conts);
  const lamp = nightLightMaterial(0xffe8c0, 3.0);
  g.add(new THREE.Mesh(merge([boxAt(0.6, 0.6, 0.6, L / 2, 14, 0), boxAt(0.6, 0.6, 0.6, -L / 2 + 10, 31, 0)]), lamp));
  return g;
}
