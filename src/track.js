// Boğaz Yolu — pist: 10 etap, yol ayrımları ağı, viraj/tepe üretimi ve yol kenarı nesneleri.
// Çizimden bağımsızdır; Node'da da çalışır.
(function (root) {
  'use strict';

  const SEG = 200;          // bir şeridin (segment) boyu
  const RW = 2000;          // yolun yarı genişliği
  const LANES = 3;

  // Etaplar katman katman: 1 → 2 → 3 → 4. Katmandaki j. etaptan sola dönen j'ye, sağa dönen j+1'e gider.
  // sea: denizin hangi yanda olduğu (R sağ, L sol, B köprü: iki yanda da aşağıda deniz)
  const STAGES = [
    { id: 'eminonu', layer: 0, name: 'Eminönü – Kabataş', short: 'EMİNÖNÜ', sea: 'R', land: 'city', time: 0, curv: 0.35, hills: 0.15, traffic: 0.9, len: 3000,
      landItems: ['apartman', 'apartman', 'lamba', 'durak', 'simitci', 'cinar'], seaItems: ['vapur', 'tekne', 'balikci', 'vapur'],
      marks: [{ at: 0.25, k: 'cami', side: 'land', x: 2.4 }, { at: 0.6, k: 'cami', side: 'land', x: 2.6 }] },

    { id: 'ortakoy', layer: 1, name: 'Beşiktaş – Ortaköy', short: 'ORTAKÖY', sea: 'R', land: 'city', time: 1, curv: 0.5, hills: 0.2, traffic: 1.0, len: 3200,
      landItems: ['apartman', 'cinar', 'lamba', 'durak', 'apartman', 'semsiye'], seaItems: ['tekne', 'balikci', 'vapur', 'yali'],
      marks: [{ at: 0.82, k: 'cami', side: 'sea', x: 2.4 }, { at: 0.86, k: 'kopru_uzak', side: 'sea', x: 7 }] },
    { id: 'uskudar', layer: 1, name: 'Üsküdar – Kuzguncuk', short: 'ÜSKÜDAR', sea: 'L', land: 'city', time: 1, curv: 0.5, hills: 0.3, traffic: 0.95, len: 3200,
      landItems: ['apartman', 'cinar', 'lamba', 'servi', 'simitci', 'durak'], seaItems: ['tekne', 'vapur', 'balikci'],
      marks: [{ at: 0.12, k: 'kiz_kulesi', side: 'sea', x: 6 }, { at: 0.4, k: 'cami', side: 'land', x: 2.5 }] },

    { id: 'bebek', layer: 2, name: 'Bebek – Rumelihisarı', short: 'BEBEK', sea: 'R', land: 'park', time: 2, curv: 0.65, hills: 0.35, traffic: 1.05, len: 3400,
      landItems: ['cinar', 'agac', 'lamba', 'yali', 'servi', 'semsiye'], seaItems: ['tekne', 'yali', 'balikci', 'tekne'],
      marks: [{ at: 0.7, k: 'hisar', side: 'land', x: 2.2 }, { at: 0.74, k: 'hisar', side: 'land', x: 2.6 }, { at: 0.78, k: 'hisar', side: 'land', x: 2.2 }] },
    { id: 'kopru', layer: 2, name: 'Boğaz Köprüsü', short: 'KÖPRÜ', sea: 'B', land: 'bridge', time: 2, curv: 0.25, hills: 0.5, traffic: 1.2, len: 3200,
      landItems: [], seaItems: [], marks: [] },
    { id: 'beylerbeyi', layer: 2, name: 'Beylerbeyi – Çengelköy', short: 'BEYLERBEYİ', sea: 'L', land: 'park', time: 2, curv: 0.65, hills: 0.35, traffic: 1.05, len: 3400,
      landItems: ['cinar', 'agac', 'lamba', 'semsiye', 'servi', 'yali'], seaItems: ['tekne', 'yali', 'balikci'],
      marks: [{ at: 0.15, k: 'saray', side: 'sea', x: 2.6 }, { at: 0.3, k: 'kopru_uzak', side: 'sea', x: 7 }] },

    { id: 'sariyer', layer: 3, name: 'Emirgan – Sarıyer', short: 'SARIYER', sea: 'R', land: 'park', time: 3, curv: 0.8, hills: 0.45, traffic: 1.1, len: 3600, ending: 'fener',
      landItems: ['agac', 'cinar', 'servi', 'lamba', 'yali', 'agac'], seaItems: ['tekne', 'yali', 'vapur', 'balikci'],
      marks: [{ at: 0.2, k: 'kopru_uzak', side: 'sea', x: 7 }] },
    { id: 'fsm', layer: 3, name: 'Fatih Sultan Mehmet Köprüsü', short: 'FSM', sea: 'B', land: 'bridge', time: 3, curv: 0.3, hills: 0.55, traffic: 1.35, len: 3400, ending: 'kopru',
      landItems: [], seaItems: [], marks: [] },
    { id: 'kanlica', layer: 3, name: 'Kandilli – Kanlıca', short: 'KANLICA', sea: 'L', land: 'park', time: 3, curv: 0.8, hills: 0.45, traffic: 1.1, len: 3600, ending: 'yogurt',
      landItems: ['yali', 'cinar', 'agac', 'lamba', 'semsiye', 'servi'], seaItems: ['yali', 'tekne', 'balikci', 'tekne'],
      marks: [{ at: 0.3, k: 'hisar', side: 'land', x: 2.3 }, { at: 0.34, k: 'hisar', side: 'land', x: 2.5 }] },
    { id: 'beykoz', layer: 3, name: 'Beykoz – Anadolu Kavağı', short: 'BEYKOZ', sea: 'L', land: 'forest', time: 3, curv: 0.9, hills: 0.6, traffic: 1.0, len: 3600, ending: 'kale',
      landItems: ['agac', 'agac', 'servi', 'cinar', 'lamba'], seaItems: ['tekne', 'balikci', 'vapur'],
      marks: [{ at: 0.92, k: 'kale', side: 'land', x: 3 }] },
  ];
  const LAYERS = [[0], [1, 2], [3, 4, 5], [6, 7, 8, 9]];
  const ENDINGS = {
    fener: { title: 'RUMELİ FENERİ', text: ['Karadeniz\'in kıyısındasın.', 'Fener yanıyor, martılar dönüyor.', 'Boğaz\'ın sonuna ulaştın!'] },
    kopru: { title: 'KÖPRÜDE GÜN BATIMI', text: ['Fatih Sultan Mehmet Köprüsü\'nden', 'iki kıtayı birden izliyorsun.', 'Gün Boğaz\'ın üstünde batıyor.'] },
    yogurt: { title: 'KANLICA YOĞURDU', text: ['Kanlıca iskelesinde mola.', 'Pudra şekerli yoğurdun', 'tadı her şeye değdi!'] },
    kale: { title: 'YOROS KALESİ', text: ['Anadolu Kavağı\'nın tepesinde', 'kalenin önündesin. Aşağıda', 'Boğaz Karadeniz\'e açılıyor.'] },
  };
  // katman / sıra → etap
  function layerOf(idx) { return STAGES[idx].layer; }
  function posInLayer(idx) { return LAYERS[STAGES[idx].layer].indexOf(idx); }
  function nextStages(idx) {
    const L = STAGES[idx].layer;
    if (L >= LAYERS.length - 1) return null;
    const j = posInLayer(idx);
    return [LAYERS[L + 1][j], LAYERS[L + 1][j + 1]];
  }

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const easeIn = (a, b, p) => a + (b - a) * p * p;
  const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

  // Etap kur: segmentler yerel (0'dan başlar). y dünya yüksekliği, curve viraj, fork iki yolun ayrılma payı.
  function buildStage(idx) {
    const S = STAGES[idx];
    const r = rng(idx * 7919 + 101);
    const segs = [];
    let y = 0;
    function seg(curve, ny) {
      const s = { curve, y1: y, y2: ny, sea: S.sea, land: S.land, sprites: [], fork: 0, tail: null, stage: idx };
      y = ny;
      segs.push(s);
      return s;
    }
    function road(enter, hold, leave, curve, dy) {
      const y0 = y, y1 = y + dy, total = enter + hold + leave;
      let n = 0;
      for (let i = 0; i < enter; i++, n++) seg(easeIn(0, curve, i / enter), easeInOut(y0, y1, (n + 1) / total));
      for (let i = 0; i < hold; i++, n++) seg(curve, easeInOut(y0, y1, (n + 1) / total));
      for (let i = 0; i < leave; i++, n++) seg(easeInOut(curve, 0, i / leave), easeInOut(y0, y1, (n + 1) / total));
    }
    const hill = () => (r() < S.hills ? (r() < 0.5 ? -1 : 1) * (8 + r() * 30) * SEG * 0.25 * (0.5 + S.hills) : 0);
    // giriş düzlüğü
    road(0, 60, 0, 0, 0);
    let lastSign = 1;
    while (segs.length < S.len) {
      const k = r();
      if (k < 0.18 + 0.15 * (1 - S.curv)) {
        road(20, 40 + Math.floor(r() * 90), 20, 0, hill());
      } else if (k < 0.8) {
        const mag = 1.5 + r() * 3.2 * S.curv + (r() < S.curv * 0.4 ? 1.5 : 0);
        lastSign = r() < 0.65 ? -lastSign : lastSign;
        road(25 + Math.floor(r() * 25), 40 + Math.floor(r() * 80), 25 + Math.floor(r() * 25), lastSign * mag, hill());
      } else {
        // S viraj
        const mag = 2 + r() * 2.5 * S.curv;
        road(25, 40, 25, mag, hill() / 2);
        road(25, 40, 25, -mag, hill() / 2);
      }
      // köprüde uzun düz ve yüksek yaklaşma
      if (S.sea === 'B' && segs.length < 260) road(60, 120, 60, 0, 2800);
    }
    // köprü inişi / düzleme
    road(40, 40, 40, 0, -y);
    const bodyEnd = segs.length;

    const last = S.layer === LAYERS.length - 1;
    let forkStart = -1, lockAt = -1;
    if (!last) {
      road(0, 80, 0, 0, 0);
      forkStart = segs.length;
      const split = 110, island = 320;
      for (let i = 0; i < split; i++) { const s = seg(0, y); s.fork = easeInOut(0, 1.18, i / split) * RW; }
      lockAt = segs.length;
      for (let i = 0; i < island; i++) { const s = seg(0, y); s.fork = easeIn(1.18, 5.5, i / island) * RW; }
    } else {
      road(0, 260, 0, 0, 0);
    }

    // --- yol kenarı ---
    const sideSign = S.sea === 'R' ? 1 : S.sea === 'L' ? -1 : 0; // denizin yönü
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    for (let i = 0; i < bodyEnd; i++) {
      const s = segs[i];
      if (S.sea === 'B') {
        if (i % 6 === 0) {
          const u = ((i + 300) % 600) / 600; // iki kule arası 0..1
          const h = 0.12 + Math.pow((u - 0.5) * 2, 2) * 0.88;
          s.sprites.push({ k: 'aski', x: -1.3, h }); s.sprites.push({ k: 'aski', x: 1.3, h });
        }
        if (i % 3 === 0) { s.sprites.push({ k: 'korkuluk', x: -1.28 }); s.sprites.push({ k: 'korkuluk', x: 1.28 }); }
        if (i % 600 === 300) s.sprites.push({ k: 'kopru_kule', x: 0, nohit: true });
        if (i % 40 === 20) s.sprites.push({ k: 'lamba', x: (i % 80 === 20 ? -1 : 1) * 1.3, nohit: true, flip: i % 80 !== 20 });
        if (i % 220 === 110) s.sprites.push({ k: 'vapur', x: (r() < 0.5 ? -1 : 1) * (6 + r() * 6) });
        if (i % 90 === 45) s.sprites.push({ k: 'tekne', x: (r() < 0.5 ? -1 : 1) * (4 + r() * 8) });
        continue;
      }
      // deniz tarafı: korkuluk ve fener direkleri
      if (i % 4 === 0) s.sprites.push({ k: 'korkuluk', x: sideSign * 1.28 });
      if (i % 24 === 12) s.sprites.push({ k: 'lamba', x: sideSign * 1.32, flip: sideSign > 0, nohit: true });
      if (i % 37 === 5 && S.seaItems.length) {
        const k = pick(S.seaItems);
        const x = k === 'balikci' ? 1.22 : k === 'yali' ? 2.3 + r() * 0.6 : k === 'vapur' ? 7 + r() * 8 : 3 + r() * 6;
        s.sprites.push({ k, x: sideSign * x, flip: k === 'balikci' ? sideSign < 0 : r() < 0.5, nohit: true });
      }
      // kara tarafı
      if (i % 9 === 0 && S.landItems.length && r() < 0.85) {
        const k = pick(S.landItems);
        let x = k === 'lamba' ? 1.2 : k === 'durak' || k === 'simitci' || k === 'semsiye' ? 1.35 + r() * 0.3 : k === 'apartman' || k === 'yali' ? 2.2 + r() * 1.2 : 1.45 + r() * 1.6;
        s.sprites.push({ k, x: -sideSign * x, flip: r() < 0.5, v: i });
      }
      if (i % 9 === 4 && S.land !== 'city' && r() < 0.5) s.sprites.push({ k: pick(['agac', 'servi', 'cinar']), x: -sideSign * (2.6 + r() * 2.5) });
      if (i % 9 === 4 && S.land === 'city' && r() < 0.6) s.sprites.push({ k: 'apartman', x: -sideSign * (3.6 + r() * 1.5), flip: r() < 0.5, v: i + 3 });
    }
    // özel yerler
    for (const m of S.marks) {
      const i = Math.floor(m.at * bodyEnd);
      const sgn = m.side === 'sea' ? sideSign : -sideSign;
      // o çevredeki sıradan nesneleri temizle
      for (let k = i - 6; k < i + 10; k++) if (segs[k]) segs[k].sprites = segs[k].sprites.filter((sp) => sp.k === 'korkuluk' || sp.k === 'lamba' || Math.abs(sp.x) < 1.25);
      segs[i].sprites.push({ k: m.k, x: sgn * m.x, flip: sgn < 0, nohit: m.side === 'sea' });
    }
    // tabelalar
    const dest = last ? STAGES[idx].short : null;
    const tab = (i, label) => { if (segs[i]) segs[i].sprites.push({ k: 'tabela', x: -sideSign * 1.35 || -1.35, label }); };
    if (last) { tab(bodyEnd - 300, `${dest} 2 KM`); }
    else { tab(forkStart - 150, 'YOL AYRIMI'); }
    // ayrım levhası ve ada
    if (!last) {
      const nx = nextStages(idx);
      segs[lockAt + 6].sprites.push({ k: 'ayrim', x: 0, label: [STAGES[nx[0]].short, STAGES[nx[1]].short] });
      for (let i = lockAt + 30; i < segs.length; i += 14) {
        const o = segs[i].fork / RW;
        if (o > 2.4) segs[i].sprites.push({ k: pick(['servi', 'agac', 'cinar']), x: (r() - 0.5) * (o - 2.2) * 1.4 });
      }
      // dış kenarlar
      for (let i = forkStart; i < segs.length; i += 4) {
        const o = segs[i].fork / RW;
        if (S.sea !== 'B') {
          segs[i].sprites.push({ k: 'korkuluk', x: sideSign * (o + 1.28) });
          if (i % 24 === 0) segs[i].sprites.push({ k: 'lamba', x: -sideSign * (o + 1.2) });
        } else {
          segs[i].sprites.push({ k: 'korkuluk', x: o + 1.28 }); segs[i].sprites.push({ k: 'korkuluk', x: -(o + 1.28) });
        }
      }
    } else {
      // bitiş kapısı
      segs[bodyEnd + 40].sprites.push({ k: 'bitis', x: 0 });
      for (let i = bodyEnd; i < segs.length; i += 4) segs[i].sprites.push({ k: 'korkuluk', x: (sideSign || 1) * 1.28 });
    }
    // başlangıç / kontrol kapısı
    segs[10].sprites.push({ k: S.layer === 0 ? 'basla' : 'kontrol', x: 0 });
    segs[10].line = '#f4f0e8';
    if (last) segs[bodyEnd + 40].line = '#f4f0e8';
    return { idx, segs, len: segs.length, bodyEnd, forkStart, lockAt, final: last };
  }

  root.BY_TRACK = { SEG, RW, LANES, STAGES, LAYERS, ENDINGS, nextStages, layerOf, posInLayer, buildStage, rng };
})(typeof window !== 'undefined' ? window : globalThis);
