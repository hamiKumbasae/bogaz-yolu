// Trafik ve rakip yarışçılar (rota boyunca)
import * as THREE from 'three';
import { clamp, damp, rng } from './util.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();

// rota örneğindeki yol genişliği ve tek yön bilgisi
export function laneInfo(path, route) {
  const N = path.N;
  const W = new Float32Array(N), OW = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const k = Math.min(route.w.length - 1, Math.round(path.src[i]));
    W[i] = Math.max(6.4, route.w[k]);
    OW[i] = route.ow[k];
  }
  // ani değişimleri yumuşat
  const W2 = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - 6); j <= Math.min(N - 1, i + 6); j++) { s += W[j]; n++; }
    W2[i] = s / n;
  }
  return { W: W2, OW };
}

export function laneOffset(li, i, dir, lane) {
  const w = li.W[i], ow = li.OW[i];
  if (dir > 0) {
    const a = ow ? -w / 2 : 0;
    const n = Math.max(1, Math.round((w / 2 - a) / 3.2));
    const lw = (w / 2 - a) / n;
    return w / 2 - lw * (Math.min(lane, n - 1) + 0.5);
  }
  if (ow) return null;
  const n = Math.max(1, Math.round(w / 2 / 3.2));
  const lw = w / 2 / n;
  return -(w / 2 - lw * (Math.min(lane, n - 1) + 0.5));
}

export class Traffic {
  constructor(path, li, fleet, models, H, col) {
    this.path = path; this.li = li; this.fleet = fleet; this.models = models; this.H = H; this.col = col;
    this.cars = [];
    this.r = rng(777);
    this.count = 40;
    this.events = [];
    this._pt = {};
    const tot = models.reduce((a, m) => a + m.w, 0);
    this.pick = () => { let x = this.r() * tot; for (let i = 0; i < models.length; i++) { x -= models[i].w; if (x <= 0) return i; } return 0; };
  }
  setDensity(n) { this.count = n; }
  reset() { this.cars.length = 0; }
  spawn(sp, initial) {
    const r = this.r;
    for (let tries = 0; tries < 12; tries++) {
      const dir = r() < 0.38 ? -1 : 1;
      let s;
      if (initial) s = sp + (r() * 1300 - 250);
      else if (dir > 0) s = r() < 0.75 ? sp + 280 + r() * 700 : sp - 200 - r() * 150;
      else s = sp + 350 + r() * 800;
      if (s < 30 || s > this.path.length - 30) continue;
      if (initial && Math.abs(s - sp) < 60) continue;
      const i = Math.round(s / this.path.step);
      const lanes = 3;
      const lane = Math.floor(r() * lanes);
      const off = laneOffset(this.li, i, dir, lane);
      if (off === null) continue;
      // kalabalık kontrolü
      if (this.cars.some((c) => c.dir === dir && Math.abs(c.s - s) < 16 && Math.abs(c.off - off) < 2.5)) continue;
      const mi = this.pick();
      const M = this.models[mi];
      const v = (M.bus ? 9 + r() * 3 : 11 + r() * 7) * (dir < 0 ? 1.05 : 1);
      this.cars.push({ s, dir, lane, off, v, vT: v, mi, color: new THREE.Color(M.colors[Math.floor(r() * M.colors.length)]), L: M.L, W: M.W, mass: M.mass,
        state: 0, x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, w: 0, t: 0, passed: false, bus: !!M.bus });
      return true;
    }
    return false;
  }
  update(dt, player, ps, raceOn) {
    const P = this.path;
    // eksikleri tamamla, uzaktakileri kaldır
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const c = this.cars[k];
      const far = c.s < ps - 420 || c.s > ps + 1500 || (c.state === 1 && c.t > 14 && Math.abs(c.s - ps) > 120);
      if (far || c.s < 5 || c.s > P.length - 5) this.cars.splice(k, 1);
    }
    let guard = 0;
    while (this.cars.length < this.count && guard++ < 6) this.spawn(ps, this.cars.length < this.count * 0.5 && this.initial);
    this.initial = false;
    const pfx = Math.cos(player.h), pfz = Math.sin(player.h);
    for (const c of this.cars) {
      if (c.state === 0) {
        // önündeki araç
        let gap = 1e9, lv = c.v;
        for (const o of this.cars) {
          if (o === c || o.dir !== c.dir) continue;
          const ds = (o.s - c.s) * c.dir;
          if (ds > 0 && ds < gap && Math.abs(o.off - c.off) < 2.4) { gap = ds - (o.L + c.L) / 2; lv = o.state === 0 ? o.v : 0; }
        }
        // oyuncu önündeyse
        const pd = (ps - c.s) * c.dir;
        if (pd > 0 && pd < 60 && Math.abs(this.playerLat - c.off) < 2.4) {
          const g2 = pd - 3.5;
          if (g2 < gap) { gap = g2; lv = Math.max(0, player.vf * c.dir); }
        }
        const safe = 5 + c.v * 1.3;
        // yavaş ya da kaza yapmış araç önündeyse şerit değiştir
        c.blockT = gap < safe + 6 && lv < c.vT - 3 ? (c.blockT || 0) + dt : 0;
        if (c.blockT > 1.2 && !c.changing) this.tryLane(c, ps);
        let vT = c.vT;
        if (gap < safe) vT = Math.min(vT, Math.max(0, lv - (safe - gap) * 0.5));
        c.v = c.v < vT ? Math.min(vT, c.v + 2.5 * dt) : Math.max(vT, c.v - 9 * dt);
        if (gap < 1.2) c.v = Math.min(c.v, lv);
        c.s += c.dir * c.v * dt;
        const i = clamp(Math.round(c.s / P.step), 0, P.N - 1);
        let off = laneOffset(this.li, i, c.dir, c.lane);
        if (off === null) off = -(this.li.W[i] / 2 + 3.8);
        c.off = damp(c.off, off, 1.5, dt);
        const p = P.at(c.s, this._pt);
        const rx = -p.tz, rz = p.tx;
        c.x = p.x + rx * c.off; c.z = p.z + rz * c.off;
        c.h = Math.atan2(p.tz, p.tx) + (c.dir < 0 ? Math.PI : 0);
        c.vx = Math.cos(c.h) * c.v; c.vz = Math.sin(c.h) * c.v;
      } else {
        // kaza sonrası kayma; durunca yeniden trafiğe karışır
        c.t += dt;
        if (c.t > 4 && Math.hypot(c.vx, c.vz) < 0.6) {
          const nr = P.nearest(c.x, c.z, Math.round(c.s / P.step), 40);
          const p = P.at(nr.s, this._pt);
          const fwd = Math.cos(c.h) * p.tx + Math.sin(c.h) * p.tz;
          if (nr.d < 12) {
            c.state = 0; c.s = nr.s; c.off = nr.lat; c.dir = fwd >= 0 ? 1 : -1; c.v = 0; c.passed = false;
            c.lane = 0;
            continue;
          }
        }
        c.x += c.vx * dt; c.z += c.vz * dt; c.h += c.w * dt;
        const sp = Math.hypot(c.vx, c.vz);
        const dec = Math.max(0, sp - 7 * dt) / (sp || 1);
        c.vx *= dec; c.vz *= dec; c.w *= Math.exp(-2.2 * dt);
        if (this.col) {
          const hit = this.col.circle(c.x, c.z, c.W / 2 + 0.2, {});
          if (hit.hit) { c.x += hit.px; c.z += hit.pz; const vn = c.vx * hit.nx + c.vz * hit.nz; if (vn < 0) { c.vx -= 1.3 * vn * hit.nx; c.vz -= 1.3 * vn * hit.nz; } }
        }
        const nr = P.nearest(c.x, c.z, Math.round(c.s / P.step), 40);
        c.s = nr.s;
      }
      c.y = this.H.ground(c.x, c.z);
      // oyuncu ile çarpışma
      this.collidePlayer(c, player, pfx, pfz, raceOn);
    }
    // araç-araç (kaza yapanlar diğerlerini iter)
    for (const c of this.cars) {
      if (c.state !== 1) continue;
      for (const o of this.cars) {
        if (o === c) continue;
        const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), R = (c.W + o.W) / 2 + 0.6;
        if (d < R && d > 1e-3) {
          const nx = dx / d, nz = dz / d, pen = R - d;
          o.x += nx * pen * 0.5; o.z += nz * pen * 0.5; c.x -= nx * pen * 0.5; c.z -= nz * pen * 0.5;
          if (o.state === 0) { o.state = 1; o.t = 0; o.vx += nx * 2; o.vz += nz * 2; o.w = (this.r() - 0.5) * 1.5; }
        }
      }
    }
  }
  tryLane(c, ps) {
    const i = clamp(Math.round(c.s / this.path.step), 0, this.path.N - 1);
    for (const nl of [c.lane + 1, c.lane - 1]) {
      if (nl < 0 || nl > 2) continue;
      const off = laneOffset(this.li, i, c.dir, nl);
      if (off === null || Math.abs(off - c.off) < 1.5) continue;
      let free = true;
      for (const o of this.cars) {
        if (o === c) continue;
        const ds = (o.s - c.s) * c.dir;
        if (ds > -12 && ds < 25 && Math.abs(o.off - off) < 2.2) { free = false; break; }
      }
      const pd = (ps - c.s) * c.dir;
      if (pd > -10 && pd < 20 && Math.abs(this.playerLat - off) < 2.4) free = false;
      if (free) { c.lane = nl; c.blockT = 0; return true; }
    }
    return false;
  }
  collidePlayer(c, pl, pfx, pfz, raceOn) {
    const cfx = Math.cos(c.h), cfz = Math.sin(c.h);
    const nC = c.bus ? 4 : 2;
    let hit = null;
    for (let a = 0; a < nC; a++) {
      const oa = nC === 2 ? (a ? -1 : 1) * c.L * 0.25 : (a - 1.5) * c.L * 0.24;
      const ax = c.x + cfx * oa, az = c.z + cfz * oa, ra = c.W / 2 + 0.05;
      for (const ob of [1.45, 0, -1.45]) {
        const bx = pl.x + pfx * ob, bz = pl.z + pfz * ob;
        const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), R = ra + 1.0;
        if (d < R && (!hit || R - d > hit.pen)) hit = { nx: d > 1e-4 ? dx / d : 1, nz: d > 1e-4 ? dz / d : 0, pen: R - d, ob, oa };
      }
    }
    // yakın geçiş
    const dsx = pl.x - c.x, dsz = pl.z - c.z;
    const along = dsx * cfx + dsz * cfz, lat = Math.abs(-dsx * cfz + dsz * cfx);
    if (!hit && !c.passed && pl.speed > 22 && Math.abs(along) < 1.5 && lat < 3.1 && lat > 1.5) {
      c.passed = true;
      this.events.push({ type: 'near', x: c.x, z: c.z });
    }
    if (!hit) return;
    const { nx, nz, pen } = hit;
    const m = c.mass;
    // ayrıştır
    pl.x += nx * pen * (m / (1 + m)); pl.z += nz * pen * (m / (1 + m));
    c.x -= nx * pen / (1 + m); c.z -= nz * pen / (1 + m);
    const rvx = pl.vx - c.vx, rvz = pl.vz - c.vz;
    const vn = rvx * nx + rvz * nz;
    if (vn >= 0) return;
    const e = 0.25;
    const j = -(1 + e) * vn / (1 + 1 / m);
    pl.vx += j * nx; pl.vz += j * nz;
    if (c.state === 0) { c.state = 1; c.t = 0; }
    c.vx -= (j / m) * nx; c.vz -= (j / m) * nz;
    c.w += (hit.oa >= 0 ? 1 : -1) * (j / m) * 0.35 * (this.r() < 0.5 ? 1 : -1);
    pl.w += hit.ob * (pfx * nz - pfz * nx) * j * 0.02;
    pl.impact = Math.max(pl.impact, -vn);
    this.events.push({ type: 'crash', power: -vn, x: c.x, z: c.z });
  }
  render() {
    this.fleet.begin();
    for (const c of this.cars) {
      _e.set(0, -c.h, 0);
      _q.setFromEuler(_e);
      _p.set(c.x, c.y, c.z);
      _m.compose(_p, _q, _s);
      this.fleet.put(c.mi, _m, c.color);
    }
    this.fleet.end();
  }
}

// ---------------------------------------------------------------- rakipler
export class Rival {
  constructor(name, model, skill, laneBias) {
    this.name = name; this.model = model; this.skill = skill; this.bias = laneBias;
    this.s = 0; this.off = 0; this.v = 0; this.x = 0; this.z = 0; this.y = 0; this.h = 0; this.vx = 0; this.vz = 0;
    this.done = false; this.time = 0; this.push = 0; this.pushV = 0;
  }
  reset(s, off) { this.s = s; this.off = off; this.v = 0; this.done = false; this.time = 0; this.push = 0; this.pushV = 0; }
  update(dt, path, li, traffic, player, ps, go) {
    if (!go) { this.place(path); return; }
    if (this.done) { this.v = Math.max(0, this.v - 8 * dt); }
    // viraj hızı: önümüzdeki 90 m'nin en keskin eğriliği
    const i = clamp(Math.round(this.s / path.step), 0, path.N - 1);
    let kmax = 0;
    for (let k = i; k < Math.min(path.N, i + Math.round((30 + this.v * 2.2) / path.step)); k += 2) {
      const dist = (k - i) * path.step;
      const kk = Math.abs(path.curv[k]);
      const vAllow = Math.sqrt((9.5 + this.skill * 3) / Math.max(kk, 1e-4));
      const need = Math.sqrt(Math.max(0, vAllow * vAllow + 2 * 13 * dist));
      if (kmax === 0 || need < kmax) kmax = need;
    }
    let vT = Math.min(62 + this.skill * 12, kmax);
    const gapP = this.s - ps;
    if (gapP > 120) vT *= 0.86; else if (gapP < -120) vT *= 1.1;
    if (!this.done) {
      // trafikten kaçın
      let block = 1e9;
      for (const c of traffic.cars) {
        const ds = c.s - this.s;
        if (ds > -3 && ds < 45 && Math.abs(c.off - this.off) < 2.3) block = Math.min(block, ds);
      }
      const w = li.W[i];
      const ow = li.OW[i];
      let bestO = this.off, bestF = block;
      if (block < 45) {
        for (const cand of [this.off - 3.3, this.off + 3.3, this.off - 6.4, this.off + 6.4]) {
          if (cand < -w / 2 + 1.2 || cand > w / 2 - 1.2) continue;
          let free = 1e9;
          for (const c of traffic.cars) {
            const ds = (c.s - this.s);
            const closing = c.dir < 0 ? 2.5 : 1;
            if (ds > -6 && ds < 70 * closing && Math.abs(c.off - cand) < 2.3) free = Math.min(free, ds / closing);
          }
          if (free > bestF + 8) { bestF = free; bestO = cand; }
        }
      } else {
        // tercih edilen hat
        const pref = ow ? this.bias * (w / 2 - 1.8) : (w / 2) * (0.25 + 0.4 * (this.bias * 0.5 + 0.5));
        bestO = pref;
      }
      this.tOff = bestO;
      if (block < 18 && bestO === this.off) vT = Math.min(vT, 8);
    }
    this.off += clamp((this.tOff ?? this.off) - this.off, -3.2 * dt, 3.2 * dt);
    this.off += this.pushV * dt; this.pushV *= Math.exp(-3 * dt);
    const w = li.W[i];
    this.off = clamp(this.off, -w / 2 + 1.0, w / 2 - 1.0);
    this.v = this.v < vT ? Math.min(vT, this.v + (8 + this.skill * 2) * dt * (1 - this.v / 90)) : Math.max(vT, this.v - 14 * dt);
    this.s = Math.min(this.s + this.v * dt, path.length - 1);
    this.place(path);
    // oyuncuyla temas
    const dx = player.x - this.x, dz = player.z - this.z, d = Math.hypot(dx, dz);
    if (d < 3.2 && d > 1e-3) {
      const fx = Math.cos(this.h), fz = Math.sin(this.h);
      const along = dx * fx + dz * fz, lat = -dx * fz + dz * fx;
      if (Math.abs(along) < 4.3 && Math.abs(lat) < 2.0) {
        const nx = dx / d, nz = dz / d;
        const pen = 2.0 - Math.abs(lat);
        player.x += Math.sign(lat) * -fz * pen * 0.5; player.z += Math.sign(lat) * fx * pen * 0.5;
        this.pushV -= Math.sign(lat) * pen * 4;
        const vn = (player.vx - this.vx) * nx + (player.vz - this.vz) * nz;
        if (vn < 0) { player.vx -= vn * nx * 0.6; player.vz -= vn * nz * 0.6; this.v += vn * 0.3; player.impact = Math.max(player.impact, -vn * 0.6); }
      }
    }
  }
  place(path) {
    const p = path.at(this.s, this._p || (this._p = {}));
    const rx = -p.tz, rz = p.tx;
    this.x = p.x + rx * this.off; this.z = p.z + rz * this.off;
    const nh = Math.atan2(p.tz, p.tx) + this.pushV * 0.02;
    this.h = nh;
    this.vx = Math.cos(nh) * this.v; this.vz = Math.sin(nh) * this.v;
  }
}
