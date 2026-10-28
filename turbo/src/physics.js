// Çarpışma ızgarası, araba fiziği (arcade), kamera
import * as THREE from 'three';
import { clamp, damp, lerp } from './util.js';

// ---------------------------------------------------------------- statik çarpışma kenarları
export class Collision {
  constructor(cell = 16) {
    this.cell = cell;
    this.seg = [];   // ax, az, bx, bz, kind
    this.grid = new Map();
  }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  addSeg(ax, az, bx, bz, kind = 0) {
    const id = this.seg.length / 5;
    this.seg.push(ax, az, bx, bz, kind);
    const c = this.cell;
    const i0 = Math.floor(Math.min(ax, bx) / c), i1 = Math.floor(Math.max(ax, bx) / c);
    const j0 = Math.floor(Math.min(az, bz) / c), j1 = Math.floor(Math.max(az, bz) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      // hücre ile kesişim kabaca (kutu testi yeterli)
      const k = this.key(i, j);
      let a = this.grid.get(k);
      if (!a) this.grid.set(k, (a = []));
      a.push(id);
    }
  }
  addRing(r, kind = 1) { for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; this.addSeg(p[0], p[1], q[0], q[1], kind); } }
  addLine(l, kind = 0) { for (let i = 0; i < l.length - 1; i++) this.addSeg(l[i][0], l[i][1], l[i + 1][0], l[i + 1][1], kind); }
  addCircle(x, z, r, n = 10, kind = 1) {
    const ring = [];
    for (let k = 0; k < n; k++) ring.push([x + Math.cos(k / n * 6.283) * r, z + Math.sin(k / n * 6.283) * r]);
    this.addRing(ring, kind);
  }
  finish() { this.S = new Float32Array(this.seg); this.stamp = new Uint32Array(this.seg.length / 5); this.tick = 1; }
  // daire çarpışması: en derin itme vektörü döner
  circle(x, z, r, out) {
    const c = this.cell, S = this.S;
    out.hit = false; out.px = 0; out.pz = 0; out.nx = 0; out.nz = 0; out.depth = 0;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    const tk = ++this.tick;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.grid.get(this.key(i, j));
      if (!a) continue;
      for (const id of a) {
        if (this.stamp[id] === tk) continue;
        this.stamp[id] = tk;
        const o = id * 5;
        const ax = S[o], az = S[o + 1], bx = S[o + 2], bz = S[o + 3];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
        const qx = ax + dx * t, qz = az + dz * t;
        let ex = x - qx, ez = z - qz;
        const d = Math.hypot(ex, ez);
        if (d < r) {
          let nx, nz;
          if (d > 1e-4) { nx = ex / d; nz = ez / d; } else { const L = Math.sqrt(L2); nx = -dz / L; nz = dx / L; }
          const depth = r - d;
          out.px += nx * depth; out.pz += nz * depth;
          if (depth > out.depth) { out.depth = depth; out.nx = nx; out.nz = nz; }
          out.hit = true;
        }
      }
    }
    return out;
  }
  // ışın: (ax,az)→(bx,bz) ilk kesişme oranı (0..1), yoksa 1
  ray(ax, az, bx, bz, kindMin = 1) {
    const c = this.cell, S = this.S;
    let best = 1;
    const i0 = Math.floor(Math.min(ax, bx) / c), i1 = Math.floor(Math.max(ax, bx) / c), j0 = Math.floor(Math.min(az, bz) / c), j1 = Math.floor(Math.max(az, bz) / c);
    const tk = ++this.tick;
    const rx = bx - ax, rz = bz - az;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.grid.get(this.key(i, j));
      if (!a) continue;
      for (const id of a) {
        if (this.stamp[id] === tk) continue;
        this.stamp[id] = tk;
        const o = id * 5;
        if (S[o + 4] < kindMin) continue;
        const sx = S[o + 2] - S[o], sz = S[o + 3] - S[o + 1];
        const den = rx * sz - rz * sx;
        if (Math.abs(den) < 1e-9) continue;
        const qx = S[o] - ax, qz = S[o + 1] - az;
        const t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
        if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
      }
    }
    return best;
  }
}

// ---------------------------------------------------------------- araba
export class Car {
  constructor(spec = {}) {
    this.x = 0; this.z = 0; this.y = 0; this.h = 0;
    this.vx = 0; this.vz = 0; this.w = 0; this.steer = 0;
    this.vf = 0; this.vr = 0;
    this.nitro = 0.6; this.nitroOn = false;
    this.pitch = 0; this.roll = 0;
    this.accel = 0; this.latAcc = 0;
    this.slip = 0; this.drift = 0; this.impact = 0; this.onGround = true;
    this.vmax = spec.vmax || 74; this.power = spec.power || 10.5;
    this.L = 4.5; this.W = 1.96; this.wheelbase = 2.72;
    this.wheelRot = 0;
    this.gear = 1; this.rpm = 900;
    this.surface = 'road';
    this._c = {}; this._n = new THREE.Vector3();
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  place(x, z, h) { this.x = x; this.z = z; this.h = h; this.vx = this.vz = this.w = 0; this.steer = 0; this.vf = this.vr = 0; }
  update(dt, inp, H, col) {
    const fx = Math.cos(this.h), fz = Math.sin(this.h), rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vr = this.vx * rx + this.vz * rz;
    const sp = Math.abs(vf);
    // yokuş
    const gA = H.ground(this.x + fx * 1.4, this.z + fz * 1.4), gB = H.ground(this.x - fx * 1.4, this.z - fz * 1.4);
    const slope = (gA - gB) / 2.8;
    // sürüş kuvvetleri
    let a = 0;
    const boost = this.nitroOn && this.nitro > 0 && inp.gas > 0.1;
    const vmax = boost ? this.vmax * 1.2 : this.vmax;
    if (inp.gas > 0.01 && vf < -0.5) a += 17 * inp.gas; // geri giderken gaz = fren
    else if (inp.gas > 0.01) {
      const k = clamp(vf / vmax, 0, 1);
      a += inp.gas * this.power * (1 - k * k * k) * (vf < 8 ? 0.85 + Math.max(0, vf) / 50 : 1);
      if (boost) a += 5.0;
    }
    if (inp.brake > 0.01) {
      if (vf > 0.8) a -= 17 * inp.brake;
      else if (vf > -13) a -= 6.5 * inp.brake;
    }
    if (inp.gas < 0.01 && inp.brake < 0.01) a -= Math.sign(vf) * Math.min(Math.abs(vf) / Math.max(dt, 1e-3), 0.9);
    a -= vf * Math.abs(vf) * 0.00055;
    a -= slope * 9.81 * 0.9;
    if (inp.hand) a -= Math.sign(vf) * Math.min(Math.abs(vf) / Math.max(dt, 1e-3), 3.2);
    vf += a * dt;
    if (boost) this.nitro = Math.max(0, this.nitro - dt / 4.5);
    this.accel = a;
    // direksiyon
    const maxSt = 0.6 / (1 + sp / 13);
    const target = inp.steer * maxSt;
    this.steer = damp(this.steer, target, inp.steer === 0 ? 10 : 7, dt);
    // kayma ve tutunma
    const slipAng = Math.atan2(vr, Math.max(4, Math.abs(vf)));
    this.slip = slipAng;
    const drifting = sp > 11 && (inp.hand || Math.abs(slipAng) > 0.16);
    this.drift = damp(this.drift, drifting ? 1 : 0, 6, dt);
    let wT = (vf * Math.tan(this.steer)) / this.wheelbase;
    let grip = 11;
    if (inp.hand) { grip = 1.4; wT *= 1.55; }
    else if (this.drift > 0.5) { grip = inp.gas > 0.3 ? 3.0 : 5.5; wT *= 1.25; }
    // karşı direksiyon: kayma yönünde çevirince toparlar
    const wK = inp.hand ? 3.2 : this.drift > 0.5 ? 4.5 : 9;
    this.w = damp(this.w, wT, wK, dt);
    this.h += this.w * dt;
    const nfx = Math.cos(this.h), nfz = Math.sin(this.h), nrx = -nfz, nrz = nfx;
    // hızı yeni yöne aktar: ileri bileşen korunur, yanal bileşen sönümlenir
    const wx = fx * vf + rx * vr, wz = fz * vf + rz * vr;
    let nvf = wx * nfx + wz * nfz, nvr = wx * nrx + wz * nrz;
    nvr *= Math.exp(-grip * dt);
    if (Math.abs(nvr) > 0.5 && this.drift > 0.5) nvf += Math.abs(nvr) * (1 - Math.exp(-grip * dt)) * 0.35; // kayarken hız kaybı az
    this.latAcc = (nvr - vr) / Math.max(dt, 1e-3) + this.w * nvf;
    this.vx = nfx * nvf + nrx * nvr;
    this.vz = nfz * nvf + nrz * nvr;
    this.vf = nvf; this.vr = nvr;
    // hareket
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    // çarpışma (3 daire)
    this.impact = 0;
    if (col) {
      for (let it = 0; it < 2; it++) {
        for (const off of [1.45, 0, -1.45]) {
          const cx = this.x + nfx * off, cz = this.z + nfz * off;
          const c = col.circle(cx, cz, 1.0, this._c);
          if (!c.hit) continue;
          this.x += c.px; this.z += c.pz;
          const L = Math.hypot(c.px, c.pz) || 1;
          const nx = c.px / L, nz = c.pz / L;
          const vn = this.vx * nx + this.vz * nz;
          if (vn < 0) {
            this.impact = Math.max(this.impact, -vn);
            const e = 0.18;
            this.vx -= (1 + e) * vn * nx; this.vz -= (1 + e) * vn * nz;
            const fr = clamp(1 - (-vn) * 0.02, 0.6, 1);
            this.vx *= fr; this.vz *= fr;
            // dönme: ön/arka çarpması yalpa yaratır
            const torque = (off * (nfx * nz - nfz * nx)) * vn * 0.08;
            this.w += torque;
          }
        }
      }
    }
    // zemin
    this.y = H.ground(this.x, this.z);
    const gf = H.ground(this.x + nfx * 1.35, this.z + nfz * 1.35), gb = H.ground(this.x - nfx * 1.35, this.z - nfz * 1.35);
    const gr = H.ground(this.x + nrx * 0.8, this.z + nrz * 0.8), gl = H.ground(this.x - nrx * 0.8, this.z - nrz * 0.8);
    this.pitch = damp(this.pitch, Math.atan2(gf - gb, 2.7), 12, dt);
    this.roll = damp(this.roll, Math.atan2(gr - gl, 1.6), 12, dt);
    this.y = Math.max(this.y, (gf + gb) / 2);
    // vites ve devir (ses için)
    const kmh = Math.abs(nvf) * 3.6;
    const tops = [0, 62, 104, 146, 190, 236, 330];
    let g = 1;
    while (g < 6 && kmh > tops[g] * 0.97) g++;
    this.gear = nvf < -0.5 ? -1 : g;
    const lo = tops[g - 1] * 0.62, hi = tops[g];
    this.rpm = 900 + clamp((kmh - lo) / Math.max(1, hi - lo), 0, 1) * 6400 + (inp.gas > 0.1 && kmh < 8 ? 1800 * inp.gas : 0);
    this.wheelRot += (nvf / 0.35) * dt;
  }
}

// ---------------------------------------------------------------- kamera
export class ChaseCam {
  constructor(camera) {
    this.cam = camera;
    this.mode = 0; // 0 yakın, 1 uzak, 2 kaput
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.dir = 0;
    this.fov = 62;
    this.shake = 0;
    this.init = false;
  }
  update(dt, car, col, t) {
    const sp = car.speed;
    const kmh = sp * 3.6;
    // hız yönü ile araç yönü karışımı (drift'te kamera dışarıdan bakar)
    let ang = car.h;
    if (sp > 4) {
      const va = Math.atan2(car.vz, car.vx);
      let d = va - car.h; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (car.vf > 0) ang = car.h + d * 0.45;
    }
    if (!this.init) { this.dir = ang; }
    let dd = ang - this.dir; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    this.dir += dd * (1 - Math.exp(-(this.mode === 2 ? 30 : 7) * dt));
    const fx = Math.cos(this.dir), fz = Math.sin(this.dir);
    let dist, height, lookH, lookA;
    if (this.mode === 0) { dist = 5.9 + Math.min(sp, 80) * 0.02; height = 2.05 + Math.min(sp, 80) * 0.004; lookH = 1.4; lookA = 7; }
    else if (this.mode === 1) { dist = 8.6 + Math.min(sp, 80) * 0.03; height = 3.1; lookH = 1.2; lookA = 8; }
    else { dist = -0.6; height = 1.12; lookH = 1.05; lookA = 20; }
    const tx = car.x - fx * dist, tz = car.z - fz * dist;
    let ty = car.y + height;
    // binaların içine girmesin
    let px = tx, pz = tz;
    if (col && this.mode !== 2) {
      const ox = car.x + fx * 0.5, oz = car.z + fz * 0.5;
      const f = col.ray(ox, oz, tx, tz, 1);
      if (f < 1) { const ff = Math.max(0.15, f - 0.12); px = ox + (tx - ox) * ff; pz = oz + (tz - oz) * ff; ty += (1 - f) * 1.2; }
    }
    if (!this.init) { this.pos.set(px, ty, pz); this.init = true; }
    const k = this.mode === 2 ? 60 : 14;
    this.pos.x = damp(this.pos.x, px, k, dt);
    this.pos.z = damp(this.pos.z, pz, k, dt);
    this.pos.y = damp(this.pos.y, ty, 8, dt);
    if (this.mode === 2) this.pos.set(px, car.y + height, pz);
    this.look.set(car.x + fx * lookA, car.y + lookH, car.z + fz * lookA);
    // titreşim
    const shake = (kmh > 150 ? (kmh - 150) / 200 : 0) * 0.035 + this.shake;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sx = (Math.sin(t * 37.1) + Math.sin(t * 23.7)) * shake, sy = (Math.sin(t * 41.3) + Math.cos(t * 29.9)) * shake;
    this.cam.position.set(this.pos.x + sx * -fz, this.pos.y + sy, this.pos.z + sx * fx);
    this.cam.lookAt(this.look);
    const fovT = (this.mode === 2 ? 70 : 60) + Math.min(kmh, 300) * 0.07 + (car.nitroOn && car.nitro > 0 ? 9 : 0);
    this.fov = damp(this.fov, fovT, 3, dt);
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();
  }
}
