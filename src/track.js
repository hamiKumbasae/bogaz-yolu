// Boğaz Yolu — pist: iki mod (Boğaz Yolu, İstanbul Turu), etaplar, yol ayrımları, viraj/tepe üretimi ve yol kenarı nesneleri.
// Çizimden bağımsızdır; Node'da da çalışır.
(function (root) {
  'use strict';

  const SEG = 200;          // bir şeridin (segment) boyu
  const RW = 2000;          // yolun yarı genişliği
  const LANES = 3;
  const TUN_H = 3400;       // tünel tavanının yoldan yüksekliği
  const TUN_D = 2400;       // tünelin denizin altına inişi
  const TRAM_W = 1.25;      // tramvay yolunun genişliği (yarı yol genişliği cinsinden)

  // Bir etap bir ya da birkaç bölümden (parts) oluşur. Bölümün "sea" alanı yolun iki yanını belirler:
  //   R deniz sağda, L deniz solda, B asma köprü (iki yanda aşağıda deniz), G alçak köprü (Galata, iki yanda deniz),
  //   N otoyol (iki yanda bariyer, deniz yok), T tünel (duvar ve tavan).
  // land: kara tarafının görünümü (city, park, forest, bridge, hwy, e5, tunnel).

  // ---------------- Boğaz Yolu: etaplar katman katman 1 → 2 → 3 → 4 ----------------
  // Katmandaki j. etaptan sola dönen j'ye, sağa dönen j+1'e gider.
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
  for (const S of STAGES) { S.course = 'bogaz'; S.num = S.layer + 1; S.lvl = S.layer; }

  // ---------------- İstanbul Turu: Cankurtaran'dan başlayıp Cankurtaran'da biten tek yol ----------------
  // Sahilden Haliç'e, Galata Köprüsü'nden Karaköy'e, Ortaköy'den 1. Köprü ile Anadolu'ya; Üsküdar, Şile Otoyolu ve
  // E-5'ten sonra Avrasya Tüneli ile denizin altından Avrupa'ya dönüp Kennedy Caddesi'nden Cankurtaran'a.
  // Her bölüm kendi semtinin dokusuyla döşenir (style: true):
  //   bldg ön sıra yapıları, back arka sıra, near yol kenarındaki küçük şeyler, behind surların arkası,
  //   tram: kara tarafında T1 tramvay yolu (Galata Köprüsü'nde solda).
  const TUR = [
    { id: 'cankurtaran', name: 'Cankurtaran – Sirkeci', short: 'SİRKECİ', sign: 'CANKURTARAN', time: 0, curv: 0.4, hills: 0.1, traffic: 0.8,
      parts: [
        { len: 2300, sea: 'R', land: 'park', style: true, sur: true, behind: ['ahsap_ev', 'cinar', 'ahsap_ev', 'servi', 'ahsap_ev'],
          seaItems: ['vapur', 'tekne', 'balikci', 'balikci', 'vapur'] },
      ],
      marks: [
        { p: 0, at: 0.12, k: 'sultanahmet', side: 'land', x: 7, clear: 110 },
        { p: 0, at: 0.3, k: 'ayasofya', side: 'land', x: 6.6, clear: 110 },
        { p: 0, at: 0.62, k: 'kiz_kulesi', side: 'sea', x: 9 },
      ],
      signs: [{ p: 0, at: 0.5, text: 'SARAYBURNU' }] },

    { id: 'galata', name: 'Eminönü – Galata Köprüsü – Karaköy', short: 'KARAKÖY', sign: 'EMİNÖNÜ', time: 0, curv: 0.4, hills: 0.15, traffic: 0.9,
      parts: [
        { len: 750, sea: 'R', land: 'city', curv: 0.3, style: true, tram: true, bldg: ['han'], back: ['han', 'han', 'apartman'], near: ['simitci', 'simitci', 'durak'],
          seaItems: ['balikekmek', 'vapur', 'balikekmek', 'tekne', 'balikekmek'] },
        { len: 850, sea: 'G', land: 'bridge', kind: 'low', tram: true },
        { len: 850, sea: 'R', land: 'city', style: true, tram: true, bldg: ['tas_bina'], back: ['tas_bina', 'tas_bina', 'apartman'], near: ['durak', 'simitci', 'semsiye'],
          seaItems: ['tekne', 'vapur', 'balikci'] },
      ],
      marks: [
        { p: 0, at: 0.2, k: 'iskele', side: 'sea', x: 3.2, label: 'EMİNÖNÜ' },
        { p: 0, at: 0.32, k: 'misir_carsisi', side: 'land', x: 5.6, clear: 70 },
        { p: 0, at: 0.55, k: 'cami', side: 'land', x: 4.2, clear: 90 },
        { p: 2, at: 0.14, k: 'galata_kulesi', side: 'land', x: 5.4, clear: 75 },
        { p: 2, at: 0.3, k: 'iskele', side: 'sea', x: 3.2, label: 'KARAKÖY' },
        { p: 2, at: 0.62, k: 'kruvaziyer', side: 'sea', x: 9, clear: 60 },
      ],
      signs: [{ p: 0, at: 0.85, text: 'GALATA KÖPRÜSÜ' }, { p: 2, at: 0.82, text: 'TOPHANE' }] },

    { id: 'ortakoy2', name: 'Kabataş – Beşiktaş – Ortaköy', short: 'ORTAKÖY', sign: 'KABATAŞ', time: 1, curv: 0.42, hills: 0.2, traffic: 1.0,
      parts: [
        { len: 760, sea: 'R', land: 'city', style: true, bldg: ['tas_bina', 'apartman'], back: ['apartman', 'tas_bina'], near: ['durak', 'cinar', 'simitci'], seaItems: ['tekne', 'vapur'] },
        { len: 620, sea: 'R', land: 'city', style: true, bldg: ['apartman', 'han', 'apartman'], back: ['apartman'], near: ['simitci', 'durak', 'semsiye'], seaItems: ['vapur', 'tekne', 'balikci'] },
        { len: 840, sea: 'R', land: 'city', style: true, bldg: ['ahsap_ev'], back: ['ahsap_ev', 'cinar'], near: ['kumpir', 'kumpir', 'semsiye', 'simitci'], seaItems: ['tekne', 'balikci', 'vapur'] },
      ],
      marks: [
        { p: 0, at: 0.12, k: 'iskele', side: 'sea', x: 3.2, label: 'KABATAŞ' },
        { p: 0, at: 0.62, k: 'saat_kulesi', side: 'sea', x: 2.2, clear: 120 },
        { p: 0, at: 0.75, k: 'saray', side: 'sea', x: 2.9, clear: 60 },
        { p: 1, at: 0.4, k: 'iskele', side: 'sea', x: 3.2, label: 'BEŞİKTAŞ' },
        { p: 2, at: 0.75, k: 'cami', side: 'sea', x: 2.4 },
        { p: 2, at: 0.8, k: 'kopru_uzak', side: 'sea', x: 7 },
      ],
      signs: [{ p: 1, at: 0.1, text: 'BEŞİKTAŞ' }, { p: 2, at: 0.08, text: 'ORTAKÖY' }] },

    { id: 'kopru1', name: '15 Temmuz Şehitler Köprüsü', short: '1. KÖPRÜ', sign: '1. KÖPRÜ', time: 1, curv: 0.25, hills: 0.5, traffic: 1.15,
      parts: [{ len: 2400, sea: 'B', land: 'bridge' }],
      marks: [] },

    { id: 'sile', name: 'Üsküdar – Şile Otoyolu', short: 'ŞİLE OTOYOLU', sign: 'ÜSKÜDAR', time: 2, curv: 0.45, hills: 0.4, traffic: 1.0, pano: 'towers',
      parts: [
        { len: 850, sea: 'R', land: 'city', style: true, bldg: ['ahsap_ev'], back: ['ahsap_ev', 'servi', 'ahsap_ev'], near: ['semsiye', 'semsiye', 'simitci', 'cinar'], seaItems: ['vapur', 'tekne', 'balikci'] },
        { len: 1650, sea: 'N', land: 'hwy', curv: 0.45, hills: 0.6, style: true, landItems: ['site', 'agac', 'site', 'rezidans', 'servi', 'agac'] },
      ],
      marks: [
        { p: 0, at: 0.2, k: 'cami', side: 'land', x: 2.8, clear: 60 },
        { p: 0, at: 0.4, k: 'iskele', side: 'sea', x: 3.2, label: 'ÜSKÜDAR' },
        { p: 0, at: 0.62, k: 'kiz_kulesi', side: 'sea', x: 5.5 },
        { p: 1, at: 0.2, k: 'levha', side: 'right', x: 0, label: ['ÇAMLICA>ur', 'ŞİLE>u'] },
        { p: 1, at: 0.42, k: 'camlica_camii', side: 'right', x: 9, clear: 260 },
        { p: 1, at: 0.445, k: 'camlica_kulesi', side: 'right', x: 14, clear: 260 },
        { p: 1, at: 0.8, k: 'levha', side: 'right', x: 0, label: ['ÜMRANİYE>ur', 'KADIKÖY E-5>u'] },
      ],
      signs: [{ p: 1, at: 0.06, text: 'ŞİLE OTOYOLU' }, { p: 1, at: 0.62, text: 'ÜMRANİYE' }] },

    { id: 'e5', name: 'E-5 (D-100)', short: 'E-5', sign: 'E-5', time: 2, curv: 0.35, hills: 0.3, traffic: 1.2, pano: 'towers',
      parts: [
        { len: 2400, sea: 'N', land: 'e5', style: true, landItems: ['plaza', 'site', 'rezidans', 'apartman', 'agac', 'plaza'] },
      ],
      marks: [
        { p: 0, at: 0.12, k: 'ustgecit', side: 'right', x: -0.6 },
        { p: 0, at: 0.3, k: 'levha', side: 'right', x: 0, label: ['ACIBADEM>ur', 'GÖZTEPE>u'] },
        { p: 0, at: 0.48, k: 'ustgecit', side: 'right', x: -0.6 },
        { p: 0, at: 0.82, k: 'ustgecit', side: 'right', x: -0.6 },
        { p: 0, at: 0.9, k: 'levha', side: 'right', x: 0, label: ['BOSTANCI>u', 'AVRASYA TÜNELİ>ur'] },
      ],
      signs: [{ p: 0, at: 0.2, text: 'KADIKÖY' }, { p: 0, at: 0.65, text: 'GÖZTEPE' }] },

    { id: 'avrasya', name: 'Avrasya Tüneli – Kennedy Caddesi', short: 'CANKURTARAN', sign: 'AVRASYA TÜNELİ', time: 3, curv: 0.4, hills: 0.15, traffic: 1.05, ending: 'tur',
      parts: [
        { len: 320, sea: 'N', land: 'hwy', curv: 0.2, hills: 0, style: true, landItems: ['site', 'agac', 'servi'] },
        { len: 1100, sea: 'T', land: 'tunnel', kind: 'tunnel' },
        { len: 1500, sea: 'R', land: 'park', style: true, sur: true, behind: ['ahsap_ev', 'cinar', 'ahsap_ev', 'servi'], seaItems: ['vapur', 'tekne', 'balikci', 'vapur'] },
      ],
      marks: [
        { p: 0, at: 0.3, k: 'levha', side: 'right', x: 0, label: ['AVRUPA YAKASI>u', 'AVRASYA TÜNELİ>u'] },
        { p: 2, at: 0.55, k: 'sultanahmet', side: 'land', x: 7, clear: 110 },
        { p: 2, at: 0.72, k: 'ayasofya', side: 'land', x: 6.6, clear: 110 },
      ],
      signs: [{ p: 2, at: 0.08, text: 'KAZLIÇEŞME' }, { p: 2, at: 0.35, text: 'YENİKAPI' }] },
  ];
  const TUR_FIRST = STAGES.length;
  TUR.forEach((S, k) => {
    S.course = 'tur'; S.num = k + 1; S.lvl = k * 0.5;
    if (k < TUR.length - 1) S.next = TUR_FIRST + k + 1;
    S.sea = S.parts[0].sea; S.land = S.parts[0].land;
    STAGES.push(S);
  });

  const COURSES = {
    bogaz: { id: 'bogaz', name: 'BOĞAZ YOLU', first: 0, count: 4 },
    tur: { id: 'tur', name: 'İSTANBUL TURU', first: TUR_FIRST, count: TUR.length },
  };
  const ENDINGS = {
    fener: { title: 'RUMELİ FENERİ', text: ['Karadeniz\'in kıyısındasın.', 'Fener yanıyor, martılar dönüyor.', 'Boğaz\'ın sonuna ulaştın!'] },
    kopru: { title: 'KÖPRÜDE GÜN BATIMI', text: ['Fatih Sultan Mehmet Köprüsü\'nden', 'iki kıtayı birden izliyorsun.', 'Gün Boğaz\'ın üstünde batıyor.'] },
    yogurt: { title: 'KANLICA YOĞURDU', text: ['Kanlıca iskelesinde mola.', 'Pudra şekerli yoğurdun', 'tadı her şeye değdi!'] },
    kale: { title: 'YOROS KALESİ', text: ['Anadolu Kavağı\'nın tepesinde', 'kalenin önündesin. Aşağıda', 'Boğaz Karadeniz\'e açılıyor.'] },
    tur: { title: 'TUR TAMAM!', text: ['Cankurtaran\'a geri döndün.', 'Köprüden Asya\'ya geçtin,', 'denizin altından Avrupa\'ya döndün!'] },
  };
  // katman / sıra → etap
  function layerOf(idx) { return STAGES[idx].layer; }
  function posInLayer(idx) { return LAYERS[STAGES[idx].layer].indexOf(idx); }
  // Sonraki etaplar: [sol, sağ]. Turda ayrım yoktur, iki yol da aynı etaba gider. Son etapta null.
  function nextStages(idx) {
    const S = STAGES[idx];
    if (S.course === 'tur') return S.next === undefined ? null : [S.next, S.next];
    const L = S.layer;
    if (L >= LAYERS.length - 1) return null;
    const j = posInLayer(idx);
    return [LAYERS[L + 1][j], LAYERS[L + 1][j + 1]];
  }
  // ayrımsız (doğrudan sonraki etaba bağlanan) etap mı
  function linear(idx) { return STAGES[idx].next !== undefined; }
  // denizin hangi yanda olduğu: 1 sağ, -1 sol, 0 iki yanda ya da hiç
  function seaSide(sea) { return sea === 'R' ? 1 : sea === 'L' ? -1 : 0; }

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
    const parts = S.parts || [{ len: S.len, sea: S.sea, land: S.land, landItems: S.landItems, seaItems: S.seaItems }];
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
    // giriş düzlüğü
    road(0, 60, 0, 0, 0);
    let lastSign = 1;
    const ranges = [];
    parts.forEach((P, pi) => {
      const p0 = pi === 0 ? 0 : segs.length;
      const target = p0 + P.len;
      const curv = P.curv !== undefined ? P.curv : S.curv, hills = P.hills !== undefined ? P.hills : S.hills;
      const hill = () => (r() < hills ? (r() < 0.5 ? -1 : 1) * (8 + r() * 30) * SEG * 0.25 * (0.5 + hills) : 0);
      if (P.kind === 'tunnel') {
        // denizin altına iniş, yumuşak virajlar, çıkış
        road(80, 100, 80, 0, -TUN_D);
        while (segs.length < target - 260) {
          lastSign = -lastSign;
          road(40, 50 + Math.floor(r() * 70), 40, lastSign * (0.8 + r() * 1.6), 0);
        }
        road(80, 100, 80, 0, TUN_D);
      } else if (P.kind === 'low') {
        // alçak köprü: düz, hafif kıvrımlı
        while (segs.length < target) road(30, 60 + Math.floor(r() * 80), 30, (r() - 0.5) * 1.4, 0);
      } else {
        while (segs.length < target) {
          const k = r();
          if (k < 0.18 + 0.15 * (1 - curv)) {
            road(20, 40 + Math.floor(r() * 90), 20, 0, hill());
          } else if (k < 0.8) {
            const mag = 1.5 + r() * 3.2 * curv + (r() < curv * 0.4 ? 1.5 : 0);
            lastSign = r() < 0.65 ? -lastSign : lastSign;
            road(25 + Math.floor(r() * 25), 40 + Math.floor(r() * 80), 25 + Math.floor(r() * 25), lastSign * mag, hill());
          } else {
            // S viraj
            const mag = 2 + r() * 2.5 * curv;
            road(25, 40, 25, mag, hill() / 2);
            road(25, 40, 25, -mag, hill() / 2);
          }
          // köprüde uzun düz ve yüksek yaklaşma
          if (P.sea === 'B' && segs.length - p0 < 260) road(60, 120, 60, 0, 2800);
        }
      }
      // köprü inişi / tünel çıkışı / düzleme
      road(40, 40, 40, 0, -y);
      ranges.push({ start: p0, end: segs.length, P });
    });
    const bodyEnd = segs.length;
    const lastP = parts[parts.length - 1];

    const nx = nextStages(idx);
    const last = !nx, lin = linear(idx);
    let forkStart = -1, lockAt = -1;
    if (lin) {
      // turda ayrım yok: bir sonraki etap doğrudan buradan başlar
    } else if (!last) {
      road(0, 80, 0, 0, 0);
      forkStart = segs.length;
      const split = 110, island = 320;
      for (let i = 0; i < split; i++) { const s = seg(0, y); s.fork = easeInOut(0, 1.18, i / split) * RW; }
      lockAt = segs.length;
      for (let i = 0; i < island; i++) { const s = seg(0, y); s.fork = easeIn(1.18, 5.5, i / island) * RW; }
    } else {
      road(0, 260, 0, 0, 0);
    }
    for (let i = bodyEnd; i < segs.length; i++) { segs[i].sea = lastP.sea; segs[i].land = lastP.land; }

    // --- yol kenarı ---
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    // deniz tarafı ve otoyol kenarı için uzaklıklar (yarı yol genişliği cinsinden)
    const SEA_X = { balikci: () => 1.22, vapur: () => 7 + r() * 8, tekne: () => 3 + r() * 6, balikekmek: () => 2.7 + r() * 0.7, yali: () => 2.3 + r() * 0.6 };
    const HWY_X = { site: () => 3.3 + r() * 1.4, rezidans: () => 3.5 + r() * 2.4, plaza: () => 3.3 + r() * 1.6, apartman: () => 3 + r() * 1.6 };
    let pk = 0;
    for (let i = 0; i < bodyEnd; i++) {
      while (i >= ranges[pk].end) pk++;
      const P = ranges[pk].P, li = i - ranges[pk].start, pLen = ranges[pk].end - ranges[pk].start;
      const s = segs[i];
      s.sea = P.sea; s.land = P.land;
      const sideSign = seaSide(P.sea); // denizin yönü
      if (P.sea === 'B') {
        if (li % 6 === 0) {
          const u = ((li + 300) % 600) / 600; // iki kule arası 0..1
          const h = 0.12 + Math.pow((u - 0.5) * 2, 2) * 0.88;
          s.sprites.push({ k: 'aski', x: -1.3, h }); s.sprites.push({ k: 'aski', x: 1.3, h });
        }
        if (li % 3 === 0) { s.sprites.push({ k: 'korkuluk', x: -1.28 }); s.sprites.push({ k: 'korkuluk', x: 1.28 }); }
        if (li % 600 === 300) s.sprites.push({ k: 'kopru_kule', x: 0, nohit: true });
        if (li % 40 === 20) s.sprites.push({ k: 'lamba', x: (li % 80 === 20 ? -1 : 1) * 1.3, nohit: true, flip: li % 80 !== 20 });
        if (li % 220 === 110) s.sprites.push({ k: 'vapur', x: (r() < 0.5 ? -1 : 1) * (6 + r() * 6) });
        if (li % 90 === 45) s.sprites.push({ k: 'tekne', x: (r() < 0.5 ? -1 : 1) * (4 + r() * 8) });
        continue;
      }
      if (P.sea === 'G') {
        // Galata Köprüsü: iki yanda korkuluk, oltalarını Haliç'e sarkıtan balıkçılar, fenerler, vapurlar;
        // tramvay yolu solda (sol korkuluk ve balıkçılar onun dışında)
        const tr = P.tram ? TRAM_W : 0;
        if (P.tram) s.tram = -1;
        if (li % 4 === 0) { s.sprites.push({ k: 'korkuluk', x: -1.28 - tr }); s.sprites.push({ k: 'korkuluk', x: 1.28 }); }
        if (li % 30 === 15) { s.sprites.push({ k: 'lamba', x: 1.32, flip: true, nohit: true }); s.sprites.push({ k: 'lamba', x: -1.32 - tr, nohit: true }); }
        if (tr && li % 30 === 0) s.sprites.push({ k: 'lamba', x: -1.16, nohit: true });
        if (li % 5 === 1 && r() < 0.55) s.sprites.push({ k: 'balikci', x: 1.22, nohit: true });
        if (li % 5 === 3 && r() < 0.55) s.sprites.push({ k: 'balikci', x: -1.22 - tr, flip: true, nohit: true });
        if (li % 160 === 80) { const sd = r() < 0.5 ? -1 : 1; s.sprites.push({ k: 'vapur', x: sd * (7 + r() * 6 + (sd < 0 ? tr : 0)), flip: r() < 0.5, nohit: true }); }
        if (li % 60 === 30) { const sd = r() < 0.5 ? -1 : 1; s.sprites.push({ k: 'tekne', x: sd * (3.5 + r() * 6 + (sd < 0 ? tr : 0)), flip: r() < 0.5, nohit: true }); }
        continue;
      }
      if (P.sea === 'N') {
        // otoyol: iki yanda çelik bariyer, yüksek direkler; E-5'te solda metrobüs yolu
        const e5 = P.land === 'e5';
        if (li % 4 === 0) {
          s.sprites.push({ k: 'bariyer', x: 1.24 }); s.sprites.push({ k: 'bariyer', x: -1.24, flip: true });
          if (e5) s.sprites.push({ k: 'bariyer', x: -2.46 });
        }
        if (li % 36 === 18) s.sprites.push({ k: 'otoyol_lamba', x: e5 ? -2.6 : (li % 72 === 18 ? 1.42 : -1.42), flip: e5 ? false : li % 72 === 18, nohit: true });
        if (li % 9 === 0 && P.landItems.length && r() < 0.8) {
          const k = pick(P.landItems);
          const side = e5 ? 1 : (r() < 0.5 ? -1 : 1);
          const x = HWY_X[k] ? HWY_X[k]() : 1.9 + r() * 2.4;
          s.sprites.push({ k, x: side * x, flip: r() < 0.5, v: Math.floor(r() * 6), nohit: true });
        }
        if (li % 9 === 4 && r() < 0.55) {
          const side = e5 ? (r() < 0.5 ? -1 : 1) : (r() < 0.5 ? -1 : 1);
          const k = e5 && side < 0 ? pick(['site', 'apartman']) : pick(['agac', 'servi', 'cinar']);
          s.sprites.push({ k, x: side * (e5 && side < 0 ? 3.7 + r() * 1.2 : 4 + r() * 3), flip: r() < 0.5, v: Math.floor(r() * 6), nohit: true });
        }
        // reklam panoları
        if (P.style && li % 150 === 75) s.sprites.push({ k: 'reklam', x: (e5 || li % 300 === 75 ? 1 : -1) * 2.35, v: Math.floor(li / 150) % 5, nohit: true });
        continue;
      }
      if (P.sea === 'T') {
        // tünel: duvarda acil durum levhaları
        if (li === 0) s.sprites.push({ k: 'tunel_agzi', x: 0, nohit: true });
        if (li > 30 && li < pLen - 30 && li % 110 === 55) s.sprites.push({ k: 'tunel_levha', x: (li % 220 === 55 ? 1 : -1) * 1.16, nohit: true, v: li % 330 === 55 ? 1 : 0 });
        continue;
      }
      if (P.sur) {
        // tarihi surlar kara tarafında; ağaçlar arkasında
        if (i % 4 === 0) s.sprites.push({ k: 'korkuluk', x: sideSign * 1.28 });
        if (i % 24 === 12) s.sprites.push({ k: 'lamba', x: sideSign * 1.32, flip: sideSign > 0, nohit: true });
        if (i % 37 === 5 && P.seaItems.length) {
          const k = pick(P.seaItems);
          const x = k === 'balikci' ? 1.22 : k === 'vapur' ? 7 + r() * 8 : 3 + r() * 6;
          s.sprites.push({ k, x: sideSign * x, flip: k === 'balikci' ? sideSign < 0 : r() < 0.5, nohit: true });
        }
        // surların arkasındaki yamaçta ahşap evler ve ağaçlar (aynı segmentte surdan önce çizilir)
        if (i % 8 === 4 && r() < 0.8) { const k = pick(P.behind); s.sprites.push({ k, x: -sideSign * (k === 'ahsap_ev' ? 3.8 + r() * 0.8 : 4.2 + r() * 2), flip: r() < 0.5, v: Math.floor(r() * 6) }); }
        if (i % 7 === 0) s.sprites.push({ k: 'sur', x: -sideSign * 2.5, flip: (i / 7) % 3 === 1, v: i % 3 });
        if (i % 24 === 0) s.sprites.push({ k: 'lamba', x: -sideSign * 1.2, flip: sideSign < 0 });
        continue;
      }
      if (P.style) {
        // semtin dokusu: ön sırada semt yapıları, yol kenarında semtin küçük şeyleri, deniz tarafında iskeleler ve tekneler.
        // Tramvaylı bölümde kara tarafındaki her şey tramvay yolunun dışına kayar.
        const ls = -sideSign, tr = P.tram ? TRAM_W : 0;
        if (P.tram) s.tram = ls;
        if (i % 4 === 0) s.sprites.push({ k: 'korkuluk', x: sideSign * 1.28 });
        if (i % 24 === 12) s.sprites.push({ k: 'lamba', x: sideSign * 1.32, flip: sideSign > 0, nohit: true });
        if (i % 31 === 5 && P.seaItems.length) {
          const k = pick(P.seaItems);
          s.sprites.push({ k, x: sideSign * (SEA_X[k] ? SEA_X[k]() : 3 + r() * 5), flip: k === 'balikci' ? sideSign < 0 : r() < 0.5, nohit: true });
        }
        if (i % 24 === 0) s.sprites.push({ k: 'lamba', x: ls * (1.2 + tr), flip: ls < 0, nohit: !!tr });
        if (P.near && i % 11 === 0 && r() < 0.55) s.sprites.push({ k: pick(P.near), x: ls * (1.4 + tr + r() * 0.25), flip: r() < 0.5, nohit: !!tr });
        if (P.bldg && i % 8 === 3) s.sprites.push({ k: pick(P.bldg), x: ls * (2.4 + tr + r() * 0.5), v: Math.floor(r() * 6), flip: r() < 0.5, nohit: !!tr });
        if (P.back && i % 11 === 6 && r() < 0.65) s.sprites.push({ k: pick(P.back), x: ls * (3.9 + tr + r() * 1.6), v: Math.floor(r() * 6), flip: r() < 0.5, nohit: !!tr });
        continue;
      }
      // deniz tarafı: korkuluk ve fener direkleri
      if (i % 4 === 0) s.sprites.push({ k: 'korkuluk', x: sideSign * 1.28 });
      if (i % 24 === 12) s.sprites.push({ k: 'lamba', x: sideSign * 1.32, flip: sideSign > 0, nohit: true });
      if (i % 37 === 5 && P.seaItems.length) {
        const k = pick(P.seaItems);
        const x = k === 'balikci' ? 1.22 : k === 'yali' ? 2.3 + r() * 0.6 : k === 'vapur' ? 7 + r() * 8 : 3 + r() * 6;
        s.sprites.push({ k, x: sideSign * x, flip: k === 'balikci' ? sideSign < 0 : r() < 0.5, nohit: true });
      }
      // kara tarafı
      if (i % 9 === 0 && P.landItems.length && r() < 0.85) {
        const k = pick(P.landItems);
        let x = k === 'lamba' ? 1.2 : k === 'durak' || k === 'simitci' || k === 'semsiye' ? 1.35 + r() * 0.3 : k === 'apartman' || k === 'yali' ? 2.2 + r() * 1.2 : 1.45 + r() * 1.6;
        s.sprites.push({ k, x: -sideSign * x, flip: r() < 0.5, v: i });
      }
      if (i % 9 === 4 && P.land !== 'city' && r() < 0.5) s.sprites.push({ k: pick(['agac', 'servi', 'cinar']), x: -sideSign * (2.6 + r() * 2.5) });
      if (i % 9 === 4 && P.land === 'city' && r() < 0.6) s.sprites.push({ k: 'apartman', x: -sideSign * (3.6 + r() * 1.5), flip: r() < 0.5, v: i + 3 });
    }
    // simge önü temizlenirken kalanlar
  const KEEP = { korkuluk: 1, lamba: 1, bariyer: 1, sur: 1, otoyol_lamba: 1, tabela: 1, levha: 1, ustgecit: 1, tunel_agzi: 1 };
  // bir bölümün içindeki konum → segment
    const at = (m) => (m.p !== undefined ? ranges[m.p].start + Math.floor(m.at * (ranges[m.p].end - ranges[m.p].start)) : Math.floor(m.at * bodyEnd));
    // özel yerler: önce çevreleri temizlenir, sonra hepsi yerleştirilir (bir simgenin temizliği ötekini silmesin)
    const markSide = (m, i) => { const ss = seaSide(segs[i].sea); return m.side === 'right' ? 1 : m.side === 'left' ? -1 : m.side === 'sea' ? ss : -ss; };
    for (const m of S.marks) {
      const i = at(m), sgn = markSide(m, i);
      // o çevredeki sıradan nesneleri temizle
      for (let k = i - 6; k < i + 10; k++) if (segs[k]) segs[k].sprites = segs[k].sprites.filter((sp) => sp.k === 'korkuluk' || sp.k === 'lamba' || sp.k === 'bariyer' || sp.k === 'sur' || Math.abs(sp.x) < 1.25);
      // uzaktan görünen simgelerin önündeki (yaklaşırken arada kalan) binaları ve ağaçları kaldır
      if (m.clear) for (let k = Math.max(0, i - m.clear); k < i; k++) segs[k].sprites = segs[k].sprites.filter((sp) => KEEP[sp.k] || Math.abs(sp.x) < 1.6 || Math.sign(sp.x) !== Math.sign(sgn));
    }
    for (const m of S.marks) {
      const i = at(m), sgn = markSide(m, i);
      const sp = { k: m.k, x: sgn * m.x, flip: sgn < 0, nohit: m.side === 'sea' };
      if (m.label) { sp.label = m.label; sp.nohit = true; }
      if (m.side === 'right' || m.side === 'left') sp.nohit = true;
      segs[i].sprites.push(sp);
    }
    // tabelalar: kara tarafında; otoyolda sağda
    const tab = (i, label) => {
      const s = segs[i];
      if (!s || s.sea === 'G' || s.sea === 'T') return;
      const ss = seaSide(s.sea);
      s.sprites.push({ k: 'tabela', x: s.sea === 'N' ? 1.5 : -ss * 1.35 || -1.35, label });
    };
    for (const g of S.signs || []) tab(at(g), g.text);
    if (last) { tab(bodyEnd - 300, `${S.short} 2 KM`); }
    else if (lin) { tab(bodyEnd - 150, STAGES[nx[0]].sign); }
    else { tab(forkStart - 150, 'YOL AYRIMI'); }
    // ayrım levhası ve ada
    const sideSign = seaSide(lastP.sea);
    if (!last && !lin) {
      segs[lockAt + 6].sprites.push({ k: 'ayrim', x: 0, label: [STAGES[nx[0]].short, STAGES[nx[1]].short] });
      for (let i = lockAt + 30; i < segs.length; i += 14) {
        const o = segs[i].fork / RW;
        if (o > 2.4) segs[i].sprites.push({ k: pick(['servi', 'agac', 'cinar']), x: (r() - 0.5) * (o - 2.2) * 1.4 });
      }
      // dış kenarlar
      for (let i = forkStart; i < segs.length; i += 4) {
        const o = segs[i].fork / RW;
        if (lastP.sea !== 'B') {
          segs[i].sprites.push({ k: 'korkuluk', x: sideSign * (o + 1.28) });
          if (i % 24 === 0) segs[i].sprites.push({ k: 'lamba', x: -sideSign * (o + 1.2) });
        } else {
          segs[i].sprites.push({ k: 'korkuluk', x: o + 1.28 }); segs[i].sprites.push({ k: 'korkuluk', x: -(o + 1.28) });
        }
      }
    } else if (last) {
      // bitiş kapısı
      segs[bodyEnd + 40].sprites.push({ k: 'bitis', x: 0 });
      for (let i = bodyEnd; i < segs.length; i += 4) segs[i].sprites.push({ k: 'korkuluk', x: (sideSign || 1) * 1.28 });
    }
    // başlangıç / kontrol kapısı
    segs[10].sprites.push({ k: S.num === 1 ? 'basla' : 'kontrol', x: 0 });
    segs[10].line = '#f4f0e8';
    if (last) segs[bodyEnd + 40].line = '#f4f0e8';
    const partInfo = ranges.map((g) => ({ start: g.start, end: g.end, sea: g.P.sea, land: g.P.land, tram: g.P.tram ? (g.P.sea === 'G' ? -1 : -seaSide(g.P.sea)) : 0 }));
    return { idx, segs, len: segs.length, bodyEnd, forkStart, lockAt, final: last, linear: lin, parts: partInfo };
  }

  root.BY_TRACK = { SEG, RW, LANES, TUN_H, TRAM_W, STAGES, LAYERS, COURSES, ENDINGS, nextStages, linear, seaSide, layerOf, posInLayer, buildStage, rng };
})(typeof window !== 'undefined' ? window : globalThis);
