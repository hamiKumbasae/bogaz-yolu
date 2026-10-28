// Boğaz Yolu — pist ve yarış kuralları (iki mod), ayrıca bir botla bütün rotaların süre dengesi.
// node tests/core.test.js [-v]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['track.js', 'core.js', 'bot.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
const TR = ctx.BY_TRACK, BY = ctx.BY, bot = ctx.BY_BOT;
const { SEG, RW, MAX, PLAYER_Z } = BY;
const dt = 1 / 60;
const V = process.argv.includes('-v');

let fails = 0, passes = 0;
function ok(c, m) { if (c) passes++; else { fails++; console.log('FAIL ' + m); } }
const NONE = { steer: 0, gas: 0, brake: false };
function run(G, inp, secs, until) {
  const n = Math.round(secs / dt);
  for (let i = 0; i < n; i++) {
    BY.step(G, typeof inp === 'function' ? inp(G, i * dt) : inp, dt);
    if (until && until(G)) return true;
  }
  return false;
}
function startRace(seed, at) {
  const G = BY.newRace({ seed }); run(G, NONE, 3.5);
  if (at) { G.pos = G.track[at].z - PLAYER_Z; G.px = G.track[at].cx; }
  return G;
}

// ---------- pist ----------
const KNOWN = ['lamba', 'korkuluk', 'cinar', 'servi', 'agac', 'apartman', 'yali', 'cami', 'hisar', 'kiz_kulesi', 'tekne', 'vapur', 'balikci',
  'simitci', 'durak', 'tabela', 'kopru_kule', 'aski', 'semsiye', 'saray', 'kale', 'kopru_uzak', 'basla', 'kontrol', 'bitis', 'ayrim',
  'sur', 'ayasofya', 'sultanahmet', 'galata_kulesi', 'camlica_kulesi', 'camlica_camii', 'bariyer', 'otoyol_lamba', 'levha', 'ustgecit', 'tunel_agzi', 'tunel_levha',
  'ahsap_ev', 'han', 'tas_bina', 'site', 'rezidans', 'plaza', 'reklam', 'iskele', 'balikekmek', 'misir_carsisi', 'kumpir', 'saat_kulesi', 'kruvaziyer'];
function commonStageChecks(st, S) {
  const kinds = new Set();
  for (const s of st.segs) for (const sp of s.sprites) kinds.add(sp.k);
  const unknown = [...kinds].filter((k) => !KNOWN.includes(k));
  ok(unknown.length === 0, `${S.name}: bilinmeyen nesne ${unknown}`);
  ok(st.segs.every((s) => Math.abs(s.curve) < 7.5), `${S.name}: virajlar sınırlı`);
  ok(Math.abs(st.segs[st.len - 1].y2) < 1, `${S.name}: etap düz bitiyor`);
  // yola (|x|<1) çarpışan nesne konmamış (kapılar ve ayrım levhası adada)
  const onRoad = [];
  st.segs.forEach((s) => { for (const sp of s.sprites) if (BY.HIT[sp.k] && !sp.nohit && s.fork === 0 && Math.abs(sp.x) - BY.HIT[sp.k] / 2 < 1.05) onRoad.push(sp.k); });
  ok(onRoad.length === 0, `${S.name}: yolun üstünde engel yok ${onRoad.slice(0, 3)}`);
}
{
  ok(TR.STAGES.length === 17, '17 etap (Boğaz Yolu 10, İstanbul Turu 7)');
  ok(JSON.stringify(TR.LAYERS.map((l) => l.length)) === '[1,2,3,4]', 'katmanlar 1-2-3-4');
  for (let i = 0; i < 10; i++) {
    const st = TR.buildStage(i);
    const S = TR.STAGES[i];
    ok(st.len > 3000 && st.len < 5000, `${S.name}: uzunluk ${st.len}`);
    ok(st.final === (S.layer === 3), `${S.name}: son etap mı`);
    if (!st.final) {
      const nx = TR.nextStages(i);
      ok(nx.length === 2 && TR.STAGES[nx[0]].layer === S.layer + 1, `${S.name}: iki sonraki etap`);
      ok(st.segs[st.lockAt].fork > RW, `${S.name}: kilit noktasında ada başladı`);
      ok(st.segs.slice(st.forkStart).every((s) => s.curve === 0), `${S.name}: ayrım düz`);
    }
    commonStageChecks(st, S);
  }
}
{
  // İstanbul Turu: Cankurtaran'dan Cankurtaran'a ayrımsız 7 etap
  const C = TR.COURSES.tur;
  ok(C.count === 7 && TR.STAGES[C.first].id === 'cankurtaran', 'tur Cankurtaran\'dan başlar');
  const seas = new Set();
  for (let k = 0; k < C.count; k++) {
    const i = C.first + k, S = TR.STAGES[i], st = TR.buildStage(i);
    ok(S.num === k + 1, `${S.name}: etap numarası ${S.num}`);
    ok(st.forkStart === -1 && st.lockAt === -1, `${S.name}: yol ayrımı yok`);
    ok(st.final === (k === C.count - 1) && st.linear === !st.final, `${S.name}: son / doğrusal`);
    if (!st.final) ok(TR.nextStages(i)[0] === i + 1, `${S.name}: sonraki etap`);
    ok(st.len > 2000 && st.len < 4500, `${S.name}: uzunluk ${st.len}`);
    ok(st.segs[10].sprites.some((sp) => sp.k === (k === 0 ? 'basla' : 'kontrol')), `${S.name}: başlangıç / kontrol kapısı`);
    for (const s of st.segs) seas.add(s.sea);
    commonStageChecks(st, S);
    if (st.parts.some((p) => p.sea === 'T')) {
      const p = st.parts.find((q) => q.sea === 'T');
      ok(Math.min(...st.segs.slice(p.start, p.end).map((s) => s.y2)) < -2000, 'tünel denizin altına iniyor');
      ok(st.segs[p.start].sprites.some((sp) => sp.k === 'tunel_agzi'), 'tünelin ağzı var');
    }
  }
  ok(['R', 'G', 'B', 'N', 'T'].every((c) => seas.has(c)), 'turda sahil, Galata Köprüsü, asma köprü, otoyol ve tünel var');
  const last = TR.STAGES[C.first + C.count - 1];
  ok(last.ending === 'tur' && TR.ENDINGS.tur && last.short === 'CANKURTARAN', 'tur Cankurtaran\'da biter');
  // yarış: sonraki etap önceden eklenir, etap geçişinde yol kesintisiz
  const G = BY.newRace({ seed: 3, course: 'tur' });
  ok(G.course === 'tur' && G.route.length === 2 && G.route[0] === C.first, 'turda ilk iki etap hazır');
  ok(G.track.every((s) => s.cx === 0), 'turda yol merkezi kaymıyor');
  // otoyolda ve tünelde iki yanda duvar
  const hw = G.track.find((s) => s.sea === 'R');
  const [L1, R1] = BY.limits(hw);
  ok(R1 < 1.1 * RW && L1 < -4 * RW, 'sahilde yalnız deniz tarafında duvar');
  for (const sea of ['N', 'T', 'G']) { const [L, R] = BY.limits({ sea, fork: 0, cx: 0 }); ok(R < 1.1 * RW && L > -1.1 * RW, `${sea}: iki yanda duvar`); }
  // Eminönü – Galata – Karaköy'de T1 tramvay yolu: kara tarafında ve köprüde solda; arabanın girmesine duvar izin vermez
  const tst = TR.buildStage(C.first + 1);
  ok(tst.parts.every((p) => p.tram !== 0) && tst.segs.slice(0, tst.bodyEnd).every((s) => s.tram === -1), 'tramvay yolu Eminönü\'nden Karaköy\'e solda');
  { const [L, R] = BY.limits(Object.assign({}, tst.segs[100], { cx: 0 })); ok(L > -1.1 * RW && R < 1.1 * RW, 'tramvaylı yolda iki yanda duvar'); }
  // semtlerin dokusu: her semtin kendine özgü yapıları var
  const kindsOf = (i, p) => { const st = TR.buildStage(i), g = st.parts[p], ks = new Set(); for (const s of st.segs.slice(g.start, g.end)) for (const sp of s.sprites) ks.add(sp.k); return ks; };
  ok(kindsOf(C.first + 1, 0).has('han') && kindsOf(C.first + 1, 0).has('balikekmek'), 'Eminönü: taş hanlar ve balık-ekmek tekneleri');
  ok(kindsOf(C.first + 1, 2).has('tas_bina'), 'Karaköy: taş binalar');
  ok(kindsOf(C.first + 2, 2).has('kumpir') && kindsOf(C.first + 2, 2).has('ahsap_ev'), 'Ortaköy: kumpir büfeleri ve ahşap evler');
  ok(kindsOf(C.first + 4, 1).has('site') && !kindsOf(C.first + 4, 1).has('apartman'), 'Şile Otoyolu: modern siteler');
  ok(kindsOf(C.first + 5, 0).has('plaza'), 'E-5: plazalar');
}

// ---------- fizik ----------
{
  const G = BY.newRace({ seed: 1 });
  ok(G.phase === 'count', 'geri sayımla başlar');
  run(G, { steer: 0, gas: 1, brake: false }, 2);
  ok(G.speed === 0 && G.phase === 'count', 'geri sayımda araba durur');
  run(G, NONE, 1.5);
  ok(G.phase === 'race', 'yarış başladı');
  G.cars = [];
  const t0 = G.t;
  run(G, (g) => { g.cars = []; g.px = BY.segAt(g, g.pos + PLAYER_Z).cx; return { steer: 0, gas: 1 }; }, 10, (g) => g.speed > MAX * 0.97);
  const accelT = G.t - t0;
  ok(accelT > 3 && accelT < 8, `0'dan en yüksek hıza ${accelT.toFixed(1)} sn`);
  ok(BY.kmh(G) > 280, `hız göstergesi ${BY.kmh(G)} km/s`);
  run(G, (g) => { g.px = BY.segAt(g, g.pos + PLAYER_Z).cx; return { steer: 0, gas: 0, brake: true }; }, 3, (g) => g.speed === 0);
  ok(G.speed === 0, 'fren durdurdu');
}
{
  // yol dışı yavaşlatır
  const G = startRace(2);
  G.cars = []; G.speed = MAX;
  const s = BY.segAt(G, G.pos + PLAYER_Z);
  G.px = s.cx - 1.5 * RW * (s.sea === 'R' ? 1 : -1);
  for (const t of G.track) t.sprites = [];
  run(G, (g) => ({ steer: 0, gas: 1 }), 1.5);
  ok(G.speed < MAX * 0.45, `yol dışında yavaşladı (${BY.kmh(G)} km/s)`);
}
{
  // virajda savrulma: en yüksek hızda direksiyonsuz dışa kayar
  const G = startRace(3);
  G.cars = [];
  let i = G.track.findIndex((s, k) => k > 80 && Math.abs(s.curve) > 3);
  G.pos = G.track[i].z - PLAYER_Z; G.speed = MAX; G.px = G.track[i].cx;
  const c = G.track[i].curve;
  run(G, { steer: 0, gas: 1 }, 0.3);
  const d = (G.px - BY.segAt(G, G.pos + PLAYER_Z).cx) / RW;
  ok(Math.sign(d) === -Math.sign(c) && Math.abs(d) > 0.1, `virajda dışa savrulma (${d.toFixed(2)}, viraj ${c.toFixed(1)})`);
}
{
  // yol kenarındaki nesneye çarpma
  const G = startRace(4);
  G.cars = [];
  const i = G.track.findIndex((s, k) => k > 100 && s.sprites.some((sp) => BY.HIT[sp.k] && !sp.nohit && Math.abs(sp.x) < 2.5));
  const sp = G.track[i].sprites.find((p) => BY.HIT[p.k] && !p.nohit && Math.abs(p.x) < 2.5);
  G.pos = G.track[i - 3].z - PLAYER_Z; G.speed = MAX * 0.7; G.px = G.track[i].cx + sp.x * RW;
  run(G, { steer: 0, gas: 1 }, 0.5, (g) => g.phase === 'crash');
  ok(G.phase === 'crash', `nesneye (${sp.k}) çarpınca kaza`);
  run(G, NONE, 2.2);
  ok(G.phase === 'race' && G.speed === 0 && Math.abs((G.px - BY.nearestRoad(BY.segAt(G, G.pos + PLAYER_Z), G.px)) / RW) <= 0.67, 'kazadan sonra yola geri kondu');
}
{
  // trafiğe hızla çarpma kaza, yavaş çarpma tampon
  const G = startRace(5, 400);
  const s = BY.segAt(G, G.pos + PLAYER_Z);
  G.cars = [{ kind: 'araba', z: G.pos + PLAYER_Z + SEG * 3, x: 0, tx: 0, speed: MAX * 0.3, w: 0.42, len: 1.4, laneT: 99, color: 0 }];
  G.px = s.cx; G.speed = MAX;
  run(G, { steer: 0, gas: 1 }, 0.5, (g) => g.phase === 'crash');
  ok(G.phase === 'crash', 'hızla arabaya çarpınca kaza');
  const G2 = startRace(6, 400);
  const s2 = BY.segAt(G2, G2.pos + PLAYER_Z);
  G2.cars = [{ kind: 'araba', z: G2.pos + PLAYER_Z + SEG * 3, x: 0, tx: 0, speed: MAX * 0.4, w: 0.42, len: 1.4, laneT: 99, color: 0 }];
  G2.px = s2.cx; G2.speed = MAX * 0.6;
  let bumped = false;
  run(G2, (g) => { if (g.ev.some((e) => e.e === 'bump')) bumped = true; g.cars.length = Math.min(1, g.cars.length); return { steer: 0, gas: 1 }; }, 1);
  ok(bumped && G2.phase === 'race', 'yavaşça arabaya değince tampon, kaza yok');
  // deniz duvarı
  const G3 = startRace(7, 400);
  G3.cars = [];
  const s3 = BY.segAt(G3, G3.pos + PLAYER_Z);
  G3.speed = MAX; G3.px = s3.cx;
  let wall = false;
  run(G3, (g) => { if (g.ev.some((e) => e.e === 'wall')) wall = true; g.cars = []; return { steer: 1, gas: 1 }; }, 2);
  const [, R] = BY.limits(BY.segAt(G3, G3.pos + PLAYER_Z));
  ok(wall && G3.px <= R + 1e-6, 'deniz tarafındaki duvar arabayı tutar');
}
{
  // süre biter
  const G = startRace(8);
  G.time = 0.5;
  run(G, { steer: 0, gas: 1 }, 10, (g) => g.result);
  ok(G.result === 'over', 'süre bitince oyun biter');
}

// ---------- bot: bütün rotalar süresinde bitiyor mu ----------
{
  const results = [];
  for (let r = 0; r < 8; r++) {
    const choices = [r & 1, (r >> 1) & 1, (r >> 2) & 1];
    const G = BY.newRace({ seed: 100 + r });
    let crashes = 0, bumps = 0, minTime = 999;
    run(G, (g) => { if (g.ev.some((e) => e.e === 'crash')) crashes++; if (g.ev.some((e) => e.e === 'bump')) bumps++; if (g.phase === 'race' && g.stageT > 2) minTime = Math.min(minTime, g.time); return bot(choices)(g); }, 600, (g) => g.result);
    const route = G.route.map((i) => TR.STAGES[i].short).join(' → ');
    results.push({ route, result: G.result, left: G.time, minTime, crashes, bumps, laps: G.lapTimes.map((t) => t.toFixed(0)).join('/'), score: G.score });
    ok(G.result === 'goal', `rota ${route}: bot bitirdi (${G.result}, kalan ${G.time.toFixed(1)} sn, kaza ${crashes})`);
    ok(G.route.length === 4, `rota 4 etap: ${route}`);
    ok(G.ending, 'bitiş sahnesi seçildi');
  }
  if (V) for (const r of results) console.log(`${r.route.padEnd(42)} ${r.result} kalan ${r.left.toFixed(1).padStart(5)} sn, en düşük ${r.minTime.toFixed(1)}, kaza ${r.crashes}, tampon ${r.bumps}, etaplar ${r.laps} sn, skor ${r.score}`);
  // farklı seçimler farklı etaplara gider
  const ends = new Set(results.map((r) => r.route.split(' → ')[3]));
  ok(ends.size === 4, 'dört farklı son etap: ' + [...ends].join(', '));
}

// ---------- bot: İstanbul Turu süresinde bitiyor mu ----------
{
  for (let r = 0; r < 4; r++) {
    const G = BY.newRace({ seed: 300 + r * 17, course: 'tur' });
    let crashes = 0, minTime = 999;
    run(G, (g) => { if (g.ev.some((e) => e.e === 'crash')) crashes++; if (g.phase === 'race' && g.stageT > 2) minTime = Math.min(minTime, g.time); return bot([])(g); }, 900, (g) => g.result);
    ok(G.result === 'goal', `tur: bot bitirdi (${G.result}, kalan ${G.time.toFixed(1)} sn, kaza ${crashes})`);
    ok(G.route.length === 7 && G.ending === 'tur', 'tur 7 etap, sonu Cankurtaran');
    if (V) console.log(`tur ${r}: kalan ${G.time.toFixed(1)} sn, en düşük ${minTime.toFixed(1)}, kaza ${crashes}, etaplar ${G.lapTimes.map((t) => t.toFixed(0)).join('/')} sn, skor ${G.score}`);
  }
}

console.log(fails ? `${fails} hata, ${passes} geçti` : `core: ${passes} denetim geçti`);
process.exit(fails ? 1 : 0);
