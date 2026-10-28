// Boğaz Yolu — yarış çekirdeği: hız, direksiyon, yol dışı, çarpışmalar, trafik, süre, yol ayrımı.
// Çizimden bağımsızdır; Node'da da çalışır (testler bunu kullanır).
(function (root) {
  'use strict';
  const TR = root.BY_TRACK;
  const { SEG, RW, STAGES } = TR;

  const CAM_H = 1000;
  const FOV = 100;
  const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
  const PLAYER_Z = 1.6 * CAM_H * CAM_DEPTH; // kameradan arabaya uzaklık
  const MAX = 12000;            // en yüksek hız (birim/sn) ≈ 290 km/s
  const KMH = 290 / MAX;
  const P = {
    accel: 0.42, accelDrop: 0.3, brake: 1.25, decel: 0.2, offDecel: 0.9, offLimit: 0.3,
    steer: 2.0, centri: 0.24, playerW: 0.42, plen: 1.4,
  };
  const START_TIME = 80;
  const EXTEND = [0, 62, 64, 66]; // katmana göre eklenen süre
  // mod başına süre: başlangıç süresi, etap süresinin en yüksek hızda geçiş süresine oranı ve eki.
  // Turun virajları daha yumuşak, trafiği daha seyrek: aynı yol daha kısa sürede alınır.
  const TIMING = { bogaz: { start: START_TIME, k: 1.15, add: 8 }, tur: { start: 62, k: 1.0, add: 8 } };
  const CRASH_TIME = 1.8;

  // nesnelerin çarpışma genişliği (yarı yol genişliği cinsinden); listede olmayanlar çarpışmaz
  const HIT = {
    lamba: 0.14, cinar: 0.5, agac: 0.45, servi: 0.25, apartman: 1.5, yali: 1.4, durak: 0.6, simitci: 0.4, semsiye: 0.5,
    tabela: 0.16, ayrim: 0.5, cami: 2.2, hisar: 1.0, kale: 1.6, saray: 2.5, sur: 2.0, galata_kulesi: 1.3,
    ahsap_ev: 1.7, han: 2.0, tas_bina: 2.0, kumpir: 0.6,
  };
  // trafik araçları: genişlik (yarı yol cinsinden), boy (segment), hız aralığı (en yüksek hıza oran)
  const CARS = {
    araba: { w: 0.42, len: 1.4, v: [0.3, 0.5] },
    taksi: { w: 0.42, len: 1.4, v: [0.33, 0.52] },
    dolmus: { w: 0.52, len: 1.8, v: [0.28, 0.42] },
    otobus: { w: 0.7, len: 3.2, v: [0.22, 0.34] },
    kamyon: { w: 0.7, len: 2.8, v: [0.2, 0.32] },
    motor: { w: 0.22, len: 1, v: [0.35, 0.55] },
    motosiklet: { w: 0.22, len: 1, v: [0.38, 0.58] },
    polis: { w: 0.44, len: 1.4, v: [0.5, 0.62], police: true },
    polis_motor: { w: 0.22, len: 1, v: [0.5, 0.64], police: true },
    // bisiklet ve scooter: yolun sağ kenarında, yavaş, şerit değiştirmez; otoyola, köprüye ve tünele girmez
    bisiklet: { w: 0.16, len: 0.8, v: [0.08, 0.11], edge: true },
    scooter: { w: 0.15, len: 0.6, v: [0.07, 0.09], edge: true },
  };
  const CAR_KINDS = ['araba', 'araba', 'taksi', 'taksi', 'dolmus', 'otobus', 'kamyon', 'araba', 'motor', 'motosiklet', 'polis', 'bisiklet', 'scooter'];
  const EDGE_X = 0.84;
  const NO_EDGE = { N: 1, B: 1, T: 1 };
  const LANE_X = [-2 / 3, 0, 2 / 3];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // opts.course: 'bogaz' (yol ayrımlı Boğaz Yolu, varsayılan) ya da 'tur' (İstanbul Turu)
  function newRace(opts) {
    opts = opts || {};
    const course = TR.COURSES[opts.course] ? opts.course : 'bogaz';
    const G = {
      course,
      track: [], stages: [], route: [], cur: 0,
      pos: 0, speed: 0, px: 0, steerVis: 0,
      phase: 'count', countT: 3.2, t: 0, time: TIMING[course].start, score: 0, ev: [],
      cars: [], crashT: 0, crashDir: 1, offroad: false, bumpT: 0, skid: 0,
      lockSide: null, nextIdx: null, goalT: 0, result: null, lapTimes: [], stageT: 0,
      rand: TR.rng(opts.seed || 12345), passedGates: new Set(), extendShow: 0, lastExtend: 0,
      ending: null,
    };
    appendStage(G, TR.COURSES[course].first, 0);
    ensureNext(G);
    return G;
  }
  // Ayrımsız etaplarda sonraki etap önceden eklenir; böylece yol ufka kadar kesintisiz görünür.
  function ensureNext(G) {
    const last = G.stages[G.stages.length - 1];
    if (!last.linear || G.stages.length - 1 > G.cur) return;
    appendStage(G, TR.nextStages(last.idx)[0], G.track[last.end - 1].cx);
  }

  // Etabı pistin sonuna ekle; cx: bu etabın yol merkezinin dünya x'i
  function appendStage(G, idx, cx, tailFrom) {
    const st = TR.buildStage(idx);
    const start = G.track.length;
    for (let i = 0; i < st.segs.length; i++) {
      const s = st.segs[i];
      s.i = start + i;
      s.cx = cx;
      s.z = (start + i) * SEG;
      // ayrılan öteki kolun kuyruğu: etabın başında uzaklaşarak kaybolur
      if (tailFrom && i < 260) {
        s.tail = tailFrom.x0 + tailFrom.dir * (i * i * 0.6 + i * 40);
        s.tailA = 1 - i / 260;
      }
      G.track.push(s);
    }
    const info = { idx, start, end: G.track.length, bodyEnd: start + st.bodyEnd, forkStart: st.forkStart >= 0 ? start + st.forkStart : -1, lockAt: st.lockAt >= 0 ? start + st.lockAt : -1, final: st.final, linear: st.linear, gate: start + 10,
      parts: st.parts.map((p) => ({ sea: p.sea, land: p.land, tram: p.tram, start: start + p.start, end: start + p.end })) };
    G.stages.push(info);
    G.route.push(idx);
    return info;
  }

  const segAt = (G, z) => G.track[Math.min(G.track.length - 1, Math.max(0, Math.floor(z / SEG)))];
  function roadsAt(s) { return s.fork > 0 ? [s.cx - s.fork, s.cx + s.fork] : [s.cx]; }
  function nearestRoad(s, x) {
    let best = s.cx, d = Infinity;
    for (const c of roadsAt(s)) { const dd = Math.abs(x - c); if (dd < d) { d = dd; best = c; } }
    return best;
  }
  // denize düşmeyi önleyen duvar / kara tarafındaki görünmez sınır.
  // Köprülerde, otoyolda (bariyer) ve tünelde iki yanda da duvar var.
  const BOTH = { B: 1, G: 1, N: 1, T: 1 };
  const wallR = (sea) => sea === 'R' || !!BOTH[sea];
  const wallL = (sea) => sea === 'L' || !!BOTH[sea];
  function limits(s) {
    const roads = roadsAt(s);
    const lo = Math.min(...roads), hi = Math.max(...roads);
    const wall = 1.05 * RW, far = 4.5 * RW;
    let L = lo - far, R = hi + far;
    if (wallR(s.sea) || s.tram) R = hi + wall;
    if (wallL(s.sea) || s.tram) L = lo - wall;
    return [L, R];
  }

  // Etabı en yüksek hızda geçme süresinin biraz fazlası eklenir.
  function extendFor(G, st) { const T = TIMING[G.course]; return Math.round((st.end - st.start) * SEG / MAX * T.k + T.add); }
  function ev(G, e, extra) { G.ev.push(extra ? Object.assign({ e }, extra) : { e }); }
  const curStage = (G) => G.stages[G.cur];

  // ---------------- trafik ----------------
  function crowded(G, z) { for (const c of G.cars) if (Math.abs(c.z - z) < SEG * 10) return true; return false; }
  // bisiklet ya da scooter önündeki ~20 saniyelik yolda otoyola, köprüye ya da tünele girecek mi
  function noEdgeAhead(G, z) {
    for (let k = 0; k <= 130; k += 5) if (NO_EDGE[segAt(G, z + k * SEG).sea]) return true;
    return false;
  }
  function spawnCar(G, z, avoidPlayer) {
    if (crowded(G, z)) return null;
    let kind = CAR_KINDS[Math.floor(G.rand() * CAR_KINDS.length)];
    if (kind === 'polis' && G.rand() < 0.3) kind = 'polis_motor';
    if (CARS[kind].edge && noEdgeAhead(G, z)) kind = 'araba';
    const D = CARS[kind];
    let lane = Math.floor(G.rand() * 3);
    if (avoidPlayer) {
      const s = segAt(G, z);
      const pn = (G.px - s.cx) / RW;
      if (Math.abs(LANE_X[lane] - pn) < 0.4) lane = (lane + 1 + Math.floor(G.rand() * 2)) % 3;
    }
    const x = D.edge ? EDGE_X : LANE_X[lane];
    const c = { kind, z, x, tx: x, speed: MAX * (D.v[0] + G.rand() * (D.v[1] - D.v[0])), w: D.w, len: D.len, laneT: 3 + G.rand() * 6, color: Math.floor(G.rand() * 5), edge: !!D.edge, police: !!D.police };
    G.cars.push(c);
    return c;
  }
  function trafficTarget(G) {
    const st = curStage(G), S = STAGES[st.idx];
    return Math.round(S.traffic * (5 + S.lvl * 1.0));
  }
  function inBody(G, z) {
    const st = curStage(G);
    const i = Math.floor(z / SEG);
    return i > st.start + 60 && i < st.bodyEnd - 30;
  }
  function updateTraffic(G, dt) {
    const pz = G.pos + PLAYER_Z;
    for (const c of G.cars) {
      // bisiklet ve scooter kenarda düz gider
      if (c.edge) { c.z += c.speed * dt; if (NO_EDGE[segAt(G, c.z).sea]) c.gone = true; continue; }
      // önündeki yavaş araca takılma ve şerit değiştirme
      c.laneT -= dt;
      let blocked = null;
      for (const o of G.cars) {
        if (o === c || Math.abs(o.x - c.x) > 0.5) continue;
        const d = o.z - c.z;
        if (d > 0 && d < SEG * 6 && o.speed < c.speed) { blocked = o; break; }
      }
      // oyuncu yakınken onun şeridine kırmaz (önüne aniden çıkmasın)
      const near = c.z - pz > -SEG * 4 && c.z - pz < SEG * 35;
      if ((blocked || c.laneT <= 0) && Math.abs(c.x - c.tx) < 0.05) {
        const pn = (G.px - segAt(G, c.z).cx) / RW;
        const opts = LANE_X.filter((x) => Math.abs(x - c.x) > 0.3 && Math.abs(x - c.x) < 0.8 && (!near || Math.abs(x - pn) > 0.6));
        const free = opts.filter((x) => !G.cars.some((o) => o !== c && Math.abs(o.x - x) < 0.4 && Math.abs(o.z - c.z) < SEG * 5));
        if (free.length) c.tx = free[Math.floor(G.rand() * free.length)];
        else if (blocked) c.speed = Math.min(c.speed, blocked.speed);
        c.laneT = 4 + G.rand() * 6;
      }
      c.x += clamp(c.tx - c.x, -0.45 * dt, 0.45 * dt);
      c.z += c.speed * dt;
    }
    // görüş dışında kalanları yeniden ileri koy
    const want = trafficTarget(G);
    G.cars = G.cars.filter((c) => !c.gone && c.z > G.pos - SEG * 3 && inBody(G, c.z));
    let tries = 0;
    while (G.cars.length < want && tries++ < 6) {
      const z = pz + SEG * (230 + G.rand() * 60);
      if (!inBody(G, z)) break;
      spawnCar(G, z, false);
    }
  }
  function seedTraffic(G) {
    const st = curStage(G);
    const want = trafficTarget(G);
    for (let k = 0; k < want; k++) {
      const z = (st.start + 70 + G.rand() * 280) * SEG;
      if (inBody(G, z)) spawnCar(G, z, true);
    }
  }

  // ---------------- çarpışmalar ----------------
  function crash(G, dir) {
    if (G.phase !== 'race') return;
    G.phase = 'crash'; G.crashT = 0; G.crashDir = dir || (G.rand() < 0.5 ? -1 : 1);
    ev(G, 'crash');
  }
  function collideSprites(G, s) {
    const pn = G.px;
    for (const sp of s.sprites) {
      const hw = HIT[sp.k];
      if (!hw || sp.nohit) continue;
      const sx = s.cx + sp.x * RW;
      if (Math.abs(pn - sx) < (P.playerW + hw) / 2 * RW) {
        if (G.speed > MAX * 0.22) crash(G, pn < sx ? -1 : 1);
        else { G.speed = 0; G.px += (pn < sx ? -1 : 1) * 0.1 * RW; ev(G, 'bump'); }
        return true;
      }
    }
    return false;
  }
  function collideCars(G) {
    const pz = G.pos + PLAYER_Z;
    const s = segAt(G, pz);
    const pn = (G.px - s.cx) / RW;
    for (const c of G.cars) {
      const front = c.z, back = c.z + c.len * SEG;
      if (pz + P.plen * SEG * 0.5 < front || pz > back) continue;
      const half = (P.playerW + c.w) / 2 * 0.9;
      const lat = Math.abs(pn - c.x);
      if (lat > half) continue;
      if (G.speed > c.speed) {
        const hit = (G.speed - c.speed) / MAX;
        if ((half - lat) / half < 0.3) {
          // sıyırma: yana itilir, biraz yavaşlar
          G.px = s.cx + (c.x + (pn < c.x ? -1 : 1) * (half + 0.02)) * RW;
          G.speed *= 0.85; G.bumpT = 0.3;
          ev(G, 'bump');
        } else if (hit > 0.42) { crash(G, pn < c.x ? -1 : 1); c.speed *= 1.1; }
        else {
          G.speed = c.speed * 0.75;
          G.pos = front - PLAYER_Z - P.plen * SEG * 0.5 - 1;
          G.px += (pn < c.x ? -1 : 1) * 0.12 * RW;
          G.bumpT = 0.4;
          ev(G, 'bump');
        }
      }
      return true;
    }
    return false;
  }

  // ---------------- ana adım ----------------
  // inp: { steer: -1..1, gas: 0..1, brake: bool }
  function step(G, inp, dt) {
    G.ev.length = 0;
    G.t += dt;
    G.bumpT = Math.max(0, G.bumpT - dt);
    G.extendShow = Math.max(0, G.extendShow - dt);
    const pz0 = G.pos + PLAYER_Z;
    const s = segAt(G, pz0);
    const sp = G.speed / MAX;

    if (G.phase === 'count') {
      const before = Math.ceil(G.countT);
      G.countT -= dt;
      if (Math.ceil(G.countT) !== before && G.countT > 0) ev(G, 'beep');
      if (G.countT <= 0) { G.phase = 'race'; ev(G, 'go'); seedTraffic(G); }
      G.rev = inp.gas;
      return;
    }

    let gas = inp.gas || 0, brake = !!inp.brake, steer = clamp(inp.steer || 0, -1, 1);
    if (G.phase === 'crash') {
      G.crashT += dt;
      G.speed = Math.max(0, G.speed - MAX * 2.2 * dt);
      gas = 0; brake = false; steer = 0;
      G.px += G.crashDir * dt * RW * 0.6 * sp;
      if (G.crashT > CRASH_TIME) {
        // yola geri koy, önü boşalt
        const c = nearestRoad(s, G.px);
        G.px = c + clamp((G.px - c) / RW, -0.66, 0.66) * RW;
        G.speed = 0; G.phase = 'race';
        G.cars = G.cars.filter((k) => k.z < pz0 - SEG * 4 || k.z > pz0 + SEG * 30);
        ev(G, 'recover');
      }
    } else if (G.phase === 'timeup' || G.phase === 'goal') {
      gas = G.phase === 'goal' ? 0.25 : 0; brake = G.phase === 'goal' && sp > 0.35;
      steer = clamp(-((G.px - nearestRoad(s, G.px)) / RW) * 1.5, -1, 1) * (G.phase === 'goal' ? 1 : 0);
    }

    // süre
    if (G.phase === 'race' || G.phase === 'crash') {
      const before = Math.ceil(G.time);
      G.time -= dt;
      G.stageT += dt;
      if (G.time <= 10 && Math.ceil(G.time) !== before && G.time > 0) ev(G, 'timelow');
      if (G.time <= 0) { G.time = 0; G.phase = 'timeup'; G.goalT = 0; ev(G, 'timeup'); }
    }

    // hız
    if (gas > 0) G.speed += MAX * (P.accel - P.accelDrop * sp) * gas * dt;
    if (brake) G.speed -= MAX * P.brake * dt;
    else if (!gas) G.speed -= MAX * P.decel * dt;
    const road = nearestRoad(s, G.px);
    const nx = (G.px - road) / RW;
    G.offroad = Math.abs(nx) > 1;
    if (G.offroad && G.speed > MAX * P.offLimit) G.speed -= MAX * P.offDecel * dt;
    G.speed = clamp(G.speed, 0, MAX);

    // direksiyon ve savrulma
    const sp2 = G.speed / MAX;
    const steerPow = Math.min(1, sp2 * 2.5);
    G.px += steer * dt * P.steer * steerPow * RW;
    const pull = dt * P.steer * sp2 * sp2 * s.curve * P.centri * RW;
    G.px -= pull;
    G.steerVis += (steer - G.steerVis) * Math.min(1, dt * 10);
    // sert virajda lastik sesi
    G.skid = (Math.abs(s.curve) > 3 && sp2 > 0.7 && Math.abs(steer) > 0.6) || (brake && sp2 > 0.5) ? 1 : 0;

    // ilerle
    G.pos += G.speed * dt;
    if (G.phase === 'race') G.score += Math.round(sp2 * dt * 1500);
    const pz = G.pos + PLAYER_Z;
    const s2 = segAt(G, pz);
    const [L, R] = limits(s2);
    if (G.px > R || G.px < L) {
      G.px = clamp(G.px, L, R);
      if (G.speed > MAX * 0.25 && ((G.px >= R && wallR(s2.sea)) || (G.px <= L && wallL(s2.sea)))) { G.speed *= 0.55; G.bumpT = 0.4; ev(G, 'wall'); }
    }

    if (G.phase === 'race') {
      if (G.offroad) collideSprites(G, s2) || collideSprites(G, segAt(G, pz + SEG));
      collideCars(G);
      updateTraffic(G, dt);
    } else if (G.phase === 'crash') updateTraffic(G, dt);

    // kontrol noktası, yol ayrımı, etap geçişi, bitiş
    const st = curStage(G);
    const pi = Math.floor(pz / SEG);
    if (G.cur > 0 && pi >= st.gate && !G.passedGates.has(st.gate)) {
      G.passedGates.add(st.gate);
      // süre bitmiş ama araba kayarak kontrol noktasına yetiştiyse yarış sürer
      if (G.phase === 'timeup') { G.phase = 'race'; G.goalT = 0; ev(G, 'saved'); }
      const add = extendFor(G, st);
      G.time += add; G.lastExtend = add; G.extendShow = 2.5;
      G.lapTimes.push(G.stageT); G.stageT = 0;
      ev(G, 'extend', { add });
    }
    if (st.lockAt >= 0 && G.lockSide === null && pi >= st.lockAt) {
      const ls = G.track[st.lockAt];
      const side = G.px < ls.cx ? 0 : 1;
      G.lockSide = side;
      G.nextIdx = TR.nextStages(st.idx)[side];
      const last = G.track[st.end - 1];
      const dir = side ? 1 : -1;
      const chosen = last.cx + dir * last.fork, other = last.cx - dir * last.fork;
      appendStage(G, G.nextIdx, chosen, { x0: other, dir: -dir });
      ev(G, 'fork', { side, next: G.nextIdx });
    }
    if (G.cur < G.stages.length - 1 && pi >= st.end) {
      // yeni etaba geç: herşeyi seçilen yolun merkezine göre kaydır (görünmez)
      G.cur++;
      const nst = curStage(G);
      const shift = G.track[nst.start].cx;
      for (let i = Math.max(0, nst.start - 600); i < G.track.length; i++) {
        const t = G.track[i];
        t.cx -= shift;
        if (t.tail !== null && t.tail !== undefined) t.tail -= shift;
      }
      G.px -= shift;
      G.lockSide = null;
      ensureNext(G);
      G.cars = [];
      seedTraffic(G);
      ev(G, 'stage', { idx: nst.idx });
    }
    if (st.final && G.phase === 'race' && pi >= st.bodyEnd + 40) {
      G.phase = 'goal'; G.goalT = 0;
      G.lapTimes.push(G.stageT);
      G.bonus = Math.floor(G.time) * 2000;
      G.score += G.bonus;
      G.ending = STAGES[st.idx].ending;
      ev(G, 'goal');
    }
    if (G.phase === 'goal') { G.goalT += dt; if (G.goalT > 3.5) G.result = 'goal'; }
    if (G.phase === 'timeup') { G.goalT += dt; if (G.speed <= 0 && G.goalT > 2) G.result = 'over'; else if (G.goalT > 6) G.result = 'over'; }
  }

  function kmh(G) { return Math.round(G.speed * KMH); }

  root.BY = {
    SEG, RW, CAM_H, CAM_DEPTH, PLAYER_Z, MAX, P, CARS, CAR_KINDS, LANE_X, EDGE_X, HIT, START_TIME, EXTEND, TIMING,
    newRace, step, segAt, roadsAt, nearestRoad, limits, kmh, curStage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
