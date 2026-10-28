// Cephe ayrıntıları: çıkıntılı balkonlar, klimalar, dükkân tabelaları, tenteler (rota çevresinde, örnekli)
import * as THREE from 'three';
import { patch, wetMaterial, U } from './shade.js';
import { rng } from './util.js';

const SHOPS = ['BAKKAL', 'ECZANE', 'KUAFÖR', 'LOKANTA', 'SİMİTÇİ', 'BÜFE', 'TEKEL', 'EMLAK', 'OPTİK', 'KUYUMCU', 'PASTANE', 'KASAP',
  'DÖNER', 'ÇAY OCAĞI', 'BERBER', 'MARKET', 'FIRIN', 'KIRTASİYE', 'BALIKÇI', 'KAFE', 'TERZİ', 'NALBUR', 'ÇİÇEKÇİ', 'SAATÇİ',
  'PİDE SALONU', 'KÖFTECİ', 'MANAV', 'ELEKTRİK', 'TUHAFİYE', 'TELEFONCU', 'BÖREKÇİ', 'LOSTRA'];
const SIGN_COLS = [['#c62828', '#fff'], ['#1565c0', '#fff'], ['#2e7d32', '#fff'], ['#f9a825', '#1a1a1a'], ['#fafafa', '#c62828'], ['#212121', '#ffd54f'],
  ['#6a1b9a', '#fff'], ['#00838f', '#fff'], ['#ef6c00', '#fff'], ['#fafafa', '#1565c0'], ['#4e342e', '#ffe0b2'], ['#ad1457', '#fff']];

// tabela atlası: 4 sütun x 8 satır, her tabela 512 x 128
function signAtlas() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const g = c.getContext('2d');
  const r = rng(808);
  for (let k = 0; k < 32; k++) {
    const x = (k % 4) * 512, y = Math.floor(k / 4) * 128;
    const [bg, fg] = SIGN_COLS[Math.floor(r() * SIGN_COLS.length)];
    g.fillStyle = bg; g.fillRect(x, y, 512, 128);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, 512, 10);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + 118, 512, 10);
    const name = SHOPS[k];
    g.fillStyle = fg;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 78;
    g.font = `bold ${fs}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
    while (g.measureText(name).width > 440 && fs > 30) { fs -= 4; g.font = `bold ${fs}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`; }
    g.fillText(name, x + 256, y + 66);
    if (name === 'ECZANE') { g.fillStyle = '#fff'; g.fillRect(x + 30, y + 44, 40, 40); g.fillStyle = '#c62828'; g.font = 'bold 40px Arial'; g.fillText('E', x + 50, y + 66); }
    // ufak telefon numarası
    g.font = '22px Arial'; g.globalAlpha = 0.8;
    g.fillText('0212 ' + (200 + Math.floor(r() * 700)) + ' ' + (10 + Math.floor(r() * 89)) + ' ' + (10 + Math.floor(r() * 89)), x + 256, y + 108);
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function stripeTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b9b9b9'; g.fillRect(i * 32, 0, 32, 64); }
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 56, 256, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// karolara bölünmüş örnekli ağ
function tiled(geo, mat, items, group, { shadow = false, color = false, extra = null } = {}) {
  const tiles = new Map();
  for (const it of items) {
    const k = Math.floor(it.x / 512) + ',' + Math.floor(it.z / 512);
    let a = tiles.get(k);
    if (!a) tiles.set(k, (a = []));
    a.push(it);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  for (const arr of tiles.values()) {
    const g = extra ? geo.clone() : geo;
    if (extra) g.setAttribute(extra.name, new THREE.InstancedBufferAttribute(new Float32Array(arr.map(extra.get)), 1));
    const im = new THREE.InstancedMesh(g, mat, arr.length);
    arr.forEach((it, i) => {
      q.setFromAxisAngle(up, it.ry);
      m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx || 1, it.sy || 1, it.sz || 1));
      im.setMatrixAt(i, m4);
      if (color) im.setColorAt(i, c.set(it.col));
    });
    im.computeBoundingSphere();
    im.castShadow = shadow; im.receiveShadow = true;
    im.layers.set(1);
    group.add(im);
  }
}

export function buildDetails(plan, path, quality, group) {
  const r = rng(4711);
  const near = (x, z) => path.nearest(x, z).d < (quality >= 3 ? 300 : 220);
  const slabs = [], rails = [], solids = [], acs = [], signs = [], awn = [];
  const wallCols = ['#e9e2d4', '#d9d2c4', '#f1ede4', '#cfc6b8'];
  for (const w of plan) {
    const mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2;
    if (!near(mx, mz)) continue;
    const ux = (w.bx - w.ax) / w.L, uz = (w.bz - w.az) / w.L;
    const ry = Math.atan2(w.nx, w.nz);  // yerel +z dışa, yerel x duvar boyunca
    const along = (u, out, y) => ({ x: w.ax + ux * u + w.nx * out, y, z: w.az + uz * u + w.nz * out });
    const nF = Math.floor((w.top - w.y0 - w.gh - 0.95) / w.fh);
    // balkonlar
    if (w.street && w.bp > 0 && w.modW < 100) {
      const solid = (w.seed * 7.13) % 1 < 0.45;
      const wc = wallCols[Math.floor(((w.seed * 31.7) % 1) * wallCols.length)];
      for (let ci = 0; ci < w.n; ci++) {
        if (ci % w.bp !== w.bo) continue;
        const bw = Math.max(1.8, w.modW * 0.92);
        for (let fi = 0; fi < nF; fi++) {
          const y = w.y0 + w.gh + fi * w.fh;
          const p = along((ci + 0.5) * w.modW, 0.55, y);
          slabs.push({ ...p, ry, sx: bw, sy: 1, sz: 1 });
          const rp = along((ci + 0.5) * w.modW, 1.08, y + 0.14);
          const list = solid ? solids : rails;
          list.push({ ...rp, ry, sx: bw, sy: 1, sz: 1, col: wc });
          for (const sd of [-1, 1]) list.push({ ...along((ci + 0.5) * w.modW + sd * (bw / 2 - 0.03), 0.55, y + 0.14), ry: ry + Math.PI / 2, sx: 1.06, sy: 1, sz: 1, col: wc });
        }
      }
    }
    // klimalar
    if (w.modW < 100) {
      for (let ci = 0; ci < w.n; ci++) for (let fi = 0; fi < nF; fi++) {
        if (r() > (w.arch === 'apt' ? 0.07 : w.arch === 'modern' ? 0.02 : 0.04)) continue;
        if (w.street && w.bp > 0 && ci % w.bp === w.bo) continue;
        const side = r() < 0.5 ? -1 : 1;
        const u = (ci + 0.5 + side * 0.36) * w.modW;
        if (u < 0.6 || u > w.L - 0.6) continue;
        const y = w.y0 + w.gh + fi * w.fh + 0.45 + r() * 0.3;
        acs.push({ ...along(u, 0.0, y), ry });
      }
    }
    // tabelalar ve tenteler
    if (w.street && w.gh > 0) {
      for (let k = 0; k < w.ns; k++) {
        if (k === w.ent) continue;
        const u = (k + 0.5) * w.shopW;
        const sw = Math.min(w.shopW * 0.86, 6);
        const y = w.y0 + w.gh - 0.92;
        signs.push({ ...along(u, 0.07, y), ry, sx: sw, sy: 1, sz: 1, idx: Math.floor(r() * 32) });
        if (r() < 0.35) {
          const cols = ['#b71c1c', '#1b5e20', '#0d47a1', '#e65100', '#4a148c', '#795548', '#00695c', '#c62828'];
          awn.push({ ...along(u, 0, y - 0.12), ry, sx: sw, sy: 1, sz: 1, col: cols[Math.floor(r() * cols.length)] });
        }
      }
    }
  }
  // ---- geometriler ve malzemeler
  const conc = wetMaterial({ color: 0xd7d2c8, roughness: 0.85 }, 'balcony');
  const slabG = new THREE.BoxGeometry(1, 0.17, 1.1).translate(0, 0.085, 0);
  tiled(slabG, conc, slabs, group, { shadow: true });
  // metal korkuluk: dikey çubuklar (yerel x'e göre kesilir)
  const railM = new THREE.MeshStandardMaterial({ color: 0x2d2f33, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  patch(railM, 'rail', {
    vdecl: 'varying vec2 vRail;',
    vmain: '{ float sxr = 1.0; \n#ifdef USE_INSTANCING\n sxr = length(instanceMatrix[0].xyz);\n#endif\n vRail = vec2(position.x * sxr, position.y); }',
    fdecl: 'varying vec2 vRail;',
    color: 'if (vRail.y < 0.86 && vRail.y > 0.05 && fract(vRail.x * 8.0) > 0.28) discard;',
  });
  const railG = new THREE.BoxGeometry(1, 1.0, 0.05).translate(0, 0.5, 0);
  tiled(railG, railM, rails, group, { shadow: true });
  const solidM = wetMaterial({ color: 0xffffff, roughness: 0.85 }, 'balcsolid');
  tiled(new THREE.BoxGeometry(1, 0.95, 0.1).translate(0, 0.475, 0), solidM, solids, group, { shadow: true, color: true });
  // klima: gövde + ızgara
  const acG = new THREE.BoxGeometry(0.82, 0.58, 0.3).translate(0, 0, 0.15);
  const acM = wetMaterial({ color: 0xe2e1dc, roughness: 0.6 }, 'ac');
  tiled(acG, acM, acs, group, { shadow: true });
  const fanG = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16).rotateX(Math.PI / 2).translate(0.12, 0, 0.305);
  tiled(fanG, new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.7 }), acs, group);
  // tabelalar: ön yüz atlas parçası, gece yanar
  const atlas = signAtlas();
  const signM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas, roughness: 0.4 });
  patch(signM, 'sign', {
    vdecl: 'attribute float aSign; varying float vFront;',
    vpre: '',
    vmain: `
      #ifdef USE_MAP
        float si = aSign;
        vec2 cell = vec2(mod(si, 4.0), floor(si / 4.0));
        vFront = step(0.5, normal.z);
        vMapUv = vFront > 0.5 ? (vec2(uv.x, uv.y) + vec2(cell.x, 7.0 - cell.y)) / vec2(4.0, 8.0) : vec2(cell.x + 0.02, 7.5 - cell.y) / vec2(4.0, 8.0);
      #endif
    `,
    fdecl: 'varying float vFront;',
    emissive: 'totalEmissiveRadiance += diffuseColor.rgb * vFront * (0.15 + uNight * 1.3);',
  });
  const signG = new THREE.BoxGeometry(1, 0.78, 0.14).translate(0, 0.39, 0.07);
  tiled(signG, signM, signs, group, { shadow: false, extra: { name: 'aSign', get: (it) => it.idx } });
  // tenteler: eğimli çizgili bez
  const aw = new THREE.BufferGeometry();
  const v = [-0.5, 0, 0, 0.5, 0, 0, 0.5, -0.5, 1.2, -0.5, -0.5, 1.2, -0.5, -0.5, 1.2, 0.5, -0.5, 1.2, 0.5, -0.8, 1.2, -0.5, -0.8, 1.2];
  aw.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  aw.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 4, 1, 4, 0, 0, 0, 0, 1, 4, 1, 4, 0.8, 0, 0.8], 2));
  aw.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]);
  aw.computeVertexNormals();
  const st = stripeTex();
  st.wrapS = THREE.RepeatWrapping;
  const awM = wetMaterial({ color: 0xffffff, map: st, roughness: 0.9, side: THREE.DoubleSide }, 'awning');
  tiled(aw, awM, awn, group, { shadow: true, color: true });
  return { balconies: slabs.length, ac: acs.length, signs: signs.length, awnings: awn.length };
}
