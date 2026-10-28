// Boğaz Yolu — oyun kabuğu: ekranlar, HUD, giriş (klavye, dokunmatik, eğme, oyun kolu), ses, rekorlar.
(function () {
  'use strict';
  const BY = window.BY, TR = window.BY_TRACK, ART = window.BY_ART, RD = window.BY_RENDER, AU = window.BY_AUDIO, END = window.BY_ENDINGS, BOT = window.BY_BOT;
  const canvas = document.getElementById('oyun');
  const ctx = canvas.getContext('2d');
  const W = 384, H = 216;
  const params = new URLSearchParams(location.search);
  if (params.has('tv')) document.body.classList.add('tv');
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  // ---------- çözünürlük ----------
  // Oyun 384×216 birimlik bir ekranda düşünülür; kanvas ekranın gerçek piksel sayısında çizilir.
  // S (birim başına piksel) 1/8'lik adımlara yuvarlanır: kanvas boyu tam sayı olur, önbellekli
  // katmanlar yeniden örneklenmeden 1:1 kopyalanır.
  // Ölçek en çok 3; yarış sırasında kareler yavaş kalırsa (zayıf cihaz) kendiliğinden düşer.
  let S = 3, maxS = 3;
  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ideal = Math.max(1, Math.min(maxS, ((r.width || W * 3) * dpr) / W));
    const s = Math.max(1, Math.floor(ideal * 8) / 8);
    const w = Math.round(W * s), h = Math.round(H * s);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    S = s;
    ART.setScale(S);
  }
  fit();
  addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);

  // ---------- kayıt ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yok */ } },
  };
  const COLORS = ['kirmizi', 'beyaz', 'turkuaz'];
  const COLOR_NAMES = { kirmizi: 'KIRMIZI', beyaz: 'BEYAZ', turkuaz: 'TURKUAZ' };
  const settings = Object.assign({ radio: 0, color: 'kirmizi', tilt: false, autoGas: coarse, course: 'bogaz', weather: 'acik' }, store.get('by-ayar', {}));
  const WEATHER_OPTS = ['acik', 'sis', 'yagmur', 'gece', 'rastgele'];
  const WEATHER_NAMES = { acik: 'AÇIK', sis: 'SİS', yagmur: 'YAĞMUR', gece: 'GECE', rastgele: 'RASTGELE' };
  if (!WEATHER_OPTS.includes(settings.weather)) settings.weather = 'acik';
  const pickWeather = () => (settings.weather === 'rastgele' ? BY.WEATHERS[Math.floor(Math.random() * BY.WEATHERS.length)] : settings.weather);
  if (!TR.COURSES[settings.course]) settings.course = 'bogaz';
  const saveSettings = () => store.set('by-ayar', settings);

  // ---------- yazı ----------
  // Fredoka: yuvarlak hatlı, Türkçe harflerin hepsi düzgün (OFL lisanslı).
  const FONT = ART.FONT;
  if (window.FontFace && document.fonts) {
    const loads = [];
    for (const wt of [500, 600]) for (const [file, range] of [
      ['latin', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215'],
      ['latin-ext', 'U+0100-0130, U+0132-024F, U+1E00-1EFF, U+20A0-20AB, U+20AD-20CF'],
    ]) {
      loads.push(new FontFace('Fredoka', `url(src/fonts/fredoka-${file}-${wt}-normal.woff2)`, { weight: String(wt), unicodeRange: range })
        .load().then((f) => document.fonts.add(f)).catch(() => { /* sistem yazı tipine düşer */ }));
    }
    // yazı tipi gelince yazı içeren önbellekli çizimleri (levhalar, plakalar) yenile
    Promise.all(loads).then(() => ART.clearAll());
  }
  // y: yazının üst kenarı; size: göz yüksekliği (eski 8'lik ölçüyle uyumlu)
  function text(s, x, y, col = '#fff8ec', size = 8, align = 'left', shadow = '#1a1430', weight = 600) {
    s = String(s);
    const px = size * 1.32;
    ctx.font = `${weight} ${px}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    const yy = y + size * 0.5;
    if (shadow) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.6, px * 0.24); ctx.strokeStyle = shadow; ctx.strokeText(s, x, yy); }
    ctx.fillStyle = col; ctx.fillText(s, x, yy);
  }
  function panel(x, y, w, h, r = 6, fill = 'rgba(22,18,48,0.7)', stroke = 'rgba(255,255,255,0.16)') {
    ART.rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  function tri(x, y, s, dir, col) { ART.poly(ctx, [x + dir * s, y, x - dir * s * 0.7, y - s, x - dir * s * 0.7, y + s], col, null); }
  const up = (s) => s.toLocaleUpperCase('tr-TR');

  // ---------- giriş ----------
  const keys = new Set();
  const touch = { left: false, right: false, gas: false, brake: false };
  const remote = { steer: 0, gas: false, brake: false, active: false };
  let pad = { steer: 0, gas: 0, brake: false, left: false, right: false, up: false, down: false, a: false, b: false, start: false };
  let padPrev = pad;
  let tiltSteer = 0, tiltOk = false;
  let steerDig = 0;
  function readPad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const n = { steer: 0, gas: 0, brake: false, left: false, right: false, up: false, down: false, a: false, b: false, start: false };
    for (const gp of gps) {
      if (!gp) continue;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const v = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.abs(ax) > 0.12) n.steer = ax;
      n.left = n.left || b(14) || ax < -0.5; n.right = n.right || b(15) || ax > 0.5;
      n.up = n.up || b(12) || ay < -0.5; n.down = n.down || b(13) || ay > 0.5;
      n.gas = Math.max(n.gas, v(7), b(0) ? 1 : 0, b(5) ? 1 : 0);
      n.brake = n.brake || v(6) > 0.3 || b(2) || b(4);
      n.a = n.a || b(0); n.b = n.b || b(1); n.start = n.start || b(9);
    }
    padPrev = pad; pad = n;
    if (n.up && !padPrev.up) menuKey('up');
    if (n.down && !padPrev.down) menuKey('down');
    if (n.left && !padPrev.left) menuKey('left');
    if (n.right && !padPrev.right) menuKey('right');
    if (n.a && !padPrev.a) menuKey('ok');
    if (n.start && !padPrev.start) menuKey('start');
    if (n.b && !padPrev.b && app.screen !== 'race') menuKey('back');
  }
  const KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], gas: ['ArrowUp', 'KeyZ', 'KeyW', 'Space'], brake: ['ArrowDown', 'KeyX', 'KeyS'],
  };
  const held = (name) => KEYS[name].some((c) => keys.has(c));
  function controls(dt) {
    const left = held('left') || touch.left || pad.left, right = held('right') || touch.right || pad.right;
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    // dijital direksiyon yumuşakça döner
    if (target === 0) steerDig = 0;
    else steerDig += (target - steerDig) * Math.min(1, dt * 9);
    let steer = steerDig;
    if (Math.abs(pad.steer) > 0.12) steer = pad.steer;
    if (settings.tilt && tiltOk && !left && !right) steer = tiltSteer;
    if (remote.active && Math.abs(remote.steer) > 0.04) steer = remote.steer;
    const brake = held('brake') || touch.brake || pad.brake || remote.brake;
    let gas = held('gas') || touch.gas || remote.gas ? 1 : pad.gas;
    if (settings.autoGas && coarse && !brake) gas = 1;
    if (brake) gas = 0;
    return { steer: Math.max(-1, Math.min(1, steer)), gas, brake };
  }
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    AU.unlock();
    const c = e.code;
    if (c.startsWith('Arrow') || c === 'Space' || c === 'Enter' || c === 'Escape') e.preventDefault();
    if (!e.repeat) {
      if (c === 'ArrowUp' || c === 'KeyW') menuKey('up');
      if (c === 'ArrowDown' || c === 'KeyS') menuKey('down');
      if (c === 'ArrowLeft' || c === 'KeyA') menuKey('left');
      if (c === 'ArrowRight' || c === 'KeyD') menuKey('right');
      if (c === 'Enter' || c === 'Space' || c === 'KeyZ') menuKey('ok');
      if (c === 'Escape') menuKey('back');
      if (c === 'KeyP') menuKey('start');
      if (c === 'KeyM') toggleSound();
      if (c === 'KeyR') nextRadio();
      if (c === 'KeyF') fullscreen();
      if (c === 'KeyK' && window.__by.bridge.open) window.__by.bridge.open();
    }
    keys.add(c);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); if (app.screen === 'race') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.screen === 'race') pause(); });

  for (const [id, name] of [['tusSol', 'left'], ['tusSag', 'right'], ['tusGaz', 'gas'], ['tusFren', 'brake']]) {
    const el = document.getElementById(id);
    if (!el) continue;
    const on = (e) => {
      e.preventDefault(); AU.unlock();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* yok */ }
      touch[name] = true; el.classList.add('basili');
      if (name === 'gas') menuKey('ok');
      if (name === 'left') menuKey('left');
      if (name === 'right') menuKey('right');
      if (name === 'brake') menuKey('down');
      if (navigator.vibrate) navigator.vibrate(8);
    };
    const off = (e) => { e.preventDefault(); touch[name] = false; el.classList.remove('basili'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // menüye dokunma
  canvas.addEventListener('pointerdown', (e) => {
    AU.unlock();
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (app.menuItems && app.menuItems.length) {
      for (let i = 0; i < app.menuItems.length; i++) {
        const it = app.menuItems[i];
        if (y >= it.y - 4 && y < it.y + 12) {
          app.menu = i;
          if (it.adjust) menuKey(x < W / 2 ? 'left' : 'right'); else menuKey('ok');
          return;
        }
      }
    }
    if (app.screen === 'race' && y < 30) pause();
    else if (app.screen === 'scores' && y > 28 && y < 48) menuKey(x < W / 2 ? 'left' : 'right');
    else if (['help', 'ending', 'over', 'scores'].includes(app.screen)) menuKey('ok');
  });

  // eğerek sürme (telefonun kendisinde)
  function onTilt(e) {
    if (e.beta === null || e.gamma === null) return;
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    let v;
    if (ang === 90) v = e.beta; else if (ang === -90 || ang === 270) v = -e.beta; else v = e.gamma;
    tiltSteer = Math.max(-1, Math.min(1, v / 28));
    tiltOk = true;
  }
  async function enableTilt(on) {
    if (on && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { if (await DeviceOrientationEvent.requestPermission() !== 'granted') on = false; } catch (e) { on = false; }
    }
    settings.tilt = on; saveSettings();
    if (on) addEventListener('deviceorientation', onTilt); else removeEventListener('deviceorientation', onTilt);
    document.body.classList.toggle('egim', on);
    document.getElementById('egim').setAttribute('aria-pressed', String(on));
  }
  if (settings.tilt && coarse) enableTilt(true);
  document.getElementById('egim').addEventListener('click', () => enableTilt(!settings.tilt));
  const otoBtn = document.getElementById('otoGaz');
  otoBtn.setAttribute('aria-pressed', String(settings.autoGas));
  otoBtn.addEventListener('click', () => { settings.autoGas = !settings.autoGas; saveSettings(); otoBtn.setAttribute('aria-pressed', String(settings.autoGas)); });
  document.getElementById('duraklat').addEventListener('click', () => { if (app.screen === 'race') pause(); else if (app.screen === 'pause') resume(); });
  document.getElementById('ses').addEventListener('click', toggleSound);
  document.getElementById('radyo').addEventListener('click', nextRadio);
  document.getElementById('tamEkran').addEventListener('click', fullscreen);
  function toggleSound() { AU.unlock(); AU.setMuted(!AU.muted); updateButtons(); }
  function radioName() { return settings.radio < 0 ? 'KAPALI' : AU.STATIONS[settings.radio].name; }
  function nextRadio(dir) {
    AU.unlock();
    settings.radio = settings.radio + (dir === -1 ? -1 : 1);
    if (settings.radio > 2) settings.radio = -1;
    if (settings.radio < -1) settings.radio = 2;
    saveSettings(); updateButtons();
    AU.playRadio(settings.radio);
    app.radioShow = 2;
  }
  function updateButtons() {
    document.getElementById('ses').textContent = AU.muted ? 'Ses: kapalı' : 'Ses: açık';
    document.getElementById('radyo').textContent = 'Radyo: ' + (settings.radio < 0 ? 'kapalı' : AU.STATIONS[settings.radio].name.replace('İ', 'i').toLowerCase().replace('fm', 'FM'));
  }
  updateButtons();
  function fullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* yok */ } }).catch(() => {});
  }

  // ---------- uygulama ----------
  const app = {
    screen: 'title', menu: settings.course === 'tur' ? 1 : 0, menuItems: [], t: 0, G: null, demo: null, demoT: 0,
    endT: 0, overT: 0, banner: null, radioShow: 0, name: ['A', 'A', 'A'], nameIdx: 0, lastStage: -1,
    // rekorlar mod başına ayrı tutulur (tur daha uzun, puanı da daha yüksek)
    scores: { bogaz: store.get('by-rekorlar', []), tur: store.get('by-rekorlar-tur', []) }, scoreCourse: settings.course,
  };
  const SCORE_KEY = { bogaz: 'by-rekorlar', tur: 'by-rekorlar-tur' };
  window.__by = { app, BY, start: (c) => startRace(c), render: () => render() };

  function newDemo() {
    const choices = [Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0];
    app.demo = BY.newRace({ seed: Math.floor(Math.random() * 1e6), course: Math.random() < 0.5 ? 'bogaz' : 'tur', weather: pickWeather() });
    app.demo.bot = BOT(choices); app.demo.bgX = 0; app.demoT = 0;
    app.demo.countT = 0.01; // gösteride geri sayım yok
  }
  function startRace(course) {
    AU.unlock();
    course = TR.COURSES[course] ? course : settings.course;
    if (settings.course !== course) { settings.course = course; saveSettings(); }
    app.G = BY.newRace({ seed: Math.floor(Math.random() * 1e9), course, weather: pickWeather() });
    app.hornT = 4 + Math.random() * 6;
    app.G.bgX = 0;
    app.screen = 'race'; app.lastStage = -1; app.banner = null;
    AU.engineStart();
    AU.playRadio(settings.radio);
  }
  function pause() { if (app.screen !== 'race') return; app.screen = 'pause'; app.menu = 0; AU.sfx('pause'); AU.engineStop(); AU.stopRadio(); }
  function resume() { app.screen = 'race'; AU.playRadio(settings.radio); }
  function toTitle() { app.screen = 'title'; app.menu = settings.course === 'tur' ? 1 : 0; app.G = null; AU.engineStop(); AU.playRadio(settings.radio); newDemo(); }
  function qualifies(score, course) { const L = app.scores[course]; return score > 0 && (L.length < 5 || score > L[L.length - 1].s); }
  function finishRun() {
    const G = app.G;
    app.scoreCourse = G.course;
    if (qualifies(G.score, G.course)) { app.screen = 'name'; app.name = ['A', 'A', 'A']; app.nameIdx = 0; }
    else { app.screen = 'scores'; app.endT = 0; app.newEntry = null; }
  }
  function saveName() {
    const G = app.G, c = G.course;
    const entry = { n: app.name.join(''), s: G.score, e: G.ending || '', r: TR.STAGES[G.route[G.route.length - 1]].short };
    const L = app.scores[c];
    L.push(entry);
    L.sort((a, b) => b.s - a.s);
    app.scores[c] = L.slice(0, 5);
    store.set(SCORE_KEY[c], app.scores[c]);
    app.screen = 'scores'; app.endT = 0; app.newEntry = entry; app.scoreCourse = c;
  }
  const LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');

  function titleItems() {
    const items = [
      { label: 'BOĞAZ YOLU', act: () => startRace('bogaz'), course: 'bogaz' },
      { label: 'İSTANBUL TURU', act: () => startRace('tur'), course: 'tur' },
      { label: 'HAVA: ' + WEATHER_NAMES[settings.weather], adjust: (d) => {
        const i = WEATHER_OPTS.indexOf(settings.weather), n = WEATHER_OPTS.length;
        settings.weather = WEATHER_OPTS[(i + (d < 0 ? n - 1 : 1)) % n]; saveSettings(); newDemo();
      } },
      { label: 'RADYO: ' + radioName(), adjust: (d) => nextRadio(d) },
      { label: 'ARABA: ' + COLOR_NAMES[settings.color], adjust: (d) => { const i = COLORS.indexOf(settings.color); settings.color = COLORS[(i + (d < 0 ? 2 : 1)) % 3]; saveSettings(); }, car: true },
      { label: 'NASIL OYNANIR', act: () => { app.screen = 'help'; } },
      { label: 'REKORLAR', act: () => { app.screen = 'scores'; app.endT = 9; app.newEntry = null; } },
    ];
    if (window.__by.bridge && window.__by.bridge.open) items.push({ label: 'TELEFONLA OYNA', act: () => window.__by.bridge.open() });
    return items;
  }
  function menuKey(k) {
    const s = app.screen;
    if (s === 'title') {
      const items = titleItems();
      if (k === 'up') { app.menu = (app.menu + items.length - 1) % items.length; AU.sfx('move'); }
      if (k === 'down') { app.menu = (app.menu + 1) % items.length; AU.sfx('move'); }
      const it = items[Math.min(app.menu, items.length - 1)];
      if ((k === 'left' || k === 'right') && it.adjust) { it.adjust(k === 'left' ? -1 : 1); AU.sfx('move'); }
      if (k === 'ok' || k === 'start') { AU.unlock(); AU.sfx('select'); if (it.act) it.act(); else if (it.adjust) it.adjust(1); }
    } else if (s === 'help') {
      if (k === 'ok' || k === 'back' || k === 'start') { app.screen = 'title'; AU.sfx('select'); }
    } else if (s === 'race') {
      if (k === 'start' || k === 'back') pause();
    } else if (s === 'pause') {
      const items = ['DEVAM', 'YENİDEN BAŞLA', 'ANA MENÜ'];
      if (k === 'up') { app.menu = (app.menu + 2) % 3; AU.sfx('move'); }
      if (k === 'down') { app.menu = (app.menu + 1) % 3; AU.sfx('move'); }
      if (k === 'start' || k === 'back') resume();
      if (k === 'ok') { AU.sfx('select'); if (app.menu === 0) resume(); else if (app.menu === 1) startRace(app.G.course); else toTitle(); }
      void items;
    } else if (s === 'ending') {
      if (app.endT > 2.5 && (k === 'ok' || k === 'start')) finishRun();
    } else if (s === 'over') {
      if (app.overT > 2 && (k === 'ok' || k === 'start')) finishRun();
    } else if (s === 'name') {
      const i = LETTERS.indexOf(app.name[app.nameIdx]);
      if (k === 'up' || k === 'right') { app.name[app.nameIdx] = LETTERS[(i + 1) % LETTERS.length]; AU.sfx('letter'); }
      if (k === 'down' || k === 'left') { app.name[app.nameIdx] = LETTERS[(i + LETTERS.length - 1) % LETTERS.length]; AU.sfx('letter'); }
      if (k === 'ok' || k === 'start') { AU.sfx('select'); app.nameIdx++; if (app.nameIdx >= 3) saveName(); }
      if (k === 'back' && app.nameIdx > 0) app.nameIdx--;
    } else if (s === 'scores') {
      if (k === 'left' || k === 'right') { app.scoreCourse = app.scoreCourse === 'tur' ? 'bogaz' : 'tur'; app.newEntry = app.G && app.G.course === app.scoreCourse ? app.newEntry : null; AU.sfx('move'); }
      if (app.endT > 1 && (k === 'ok' || k === 'start' || k === 'back')) toTitle();
    }
  }

  // ---------- olaylar ----------
  function handleEvents(G) {
    for (const e of G.ev) {
      switch (e.e) {
        case 'stage': {
          const S = TR.STAGES[e.idx];
          app.banner = { a: `${S.num}. ETAP`, b: up(S.name), t: 3.2 };
          break;
        }
        case 'fork': AU.sfx('fork'); break;
        case 'goal': AU.sfx('goal'); break;
        case 'timeup': AU.sfx('timeup'); AU.stopRadio(); break;
        default: AU.sfx(e.e);
      }
      if (window.__byRemote && window.__byRemote.count()) {
        const buzz = { crash: 250, bump: 60, wall: 80, extend: 90, goal: 300 }[e.e];
        if (buzz) window.__byRemote.vibrate(buzz);
      }
    }
  }

  // ---------- döngü ----------
  const DT = 1 / 60;
  let acc = 0, lastT = performance.now(), slowT = 0;
  function frame(now) {
    let dt = Math.max(0, (now - lastT) / 1000); lastT = now;
    if (dt > 0.1) dt = 0.1;
    app.t += dt;
    if (app.screen === 'race' && dt > 0.026) slowT += dt; else slowT = Math.max(0, slowT - dt * 0.5);
    if (slowT > 2 && S > 1.5) { maxS = Math.max(1.5, S - 0.5); slowT = 0; fit(); }
    readPad();
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  function advance(G, inp, dt) {
    BY.step(G, inp, dt);
    const s = BY.segAt(G, G.pos + BY.PLAYER_Z);
    G.bgX = (G.bgX || 0) + s.curve * (G.speed / BY.MAX) * dt * 36;
  }
  // en yakın polis aracının sireni (yalnız yarışta)
  function sirenLevel() {
    const G = app.G;
    if (app.screen !== 'race' || !G || G.phase === 'count') return 0;
    const pz = G.pos + BY.PLAYER_Z;
    let best = 0;
    for (const c of G.cars) if (c.police) best = Math.max(best, 1 - Math.abs(c.z - pz) / (BY.SEG * 140));
    return best;
  }
  function update(dt) {
    app.radioShow = Math.max(0, app.radioShow - dt);
    AU.siren(sirenLevel());
    // yağmur sesi (tünelde kesilir) ve sisli havada arada bir vapur düdüğü
    const G0 = app.screen === 'race' ? app.G : null;
    const inTunnel = G0 && BY.segAt(G0, G0.pos + BY.PLAYER_Z).sea === 'T';
    AU.rain(G0 && G0.weather === 'yagmur' ? (inTunnel ? 0.15 : 1) : 0);
    if (G0 && G0.weather === 'sis' && G0.phase !== 'count') {
      app.hornT -= dt;
      if (app.hornT <= 0) { AU.sfx('duduk'); app.hornT = 13 + Math.random() * 10; }
    }
    if (app.screen === 'title' || app.screen === 'help' || app.screen === 'scores') {
      if (!app.demo) newDemo();
      app.demoT += dt;
      acc += dt;
      while (acc >= DT) { advance(app.demo, app.demo.bot(app.demo), DT); acc -= DT; }
      if (app.demo.result || app.demoT > 75 || app.demo.phase === 'crash') { if (app.demo.result || app.demoT > 75) newDemo(); }
      if (app.screen === 'scores') app.endT += dt;
    } else if (app.screen === 'race') {
      const G = app.G;
      acc += dt;
      const inp = controls(dt);
      let n = 0;
      while (acc >= DT && n < 6) {
        advance(G, inp, DT);
        handleEvents(G);
        acc -= DT; n++;
        if (G.result) break;
      }
      if (n >= 6) acc = 0;
      if (app.banner) { app.banner.t -= dt; if (app.banner.t <= 0) app.banner = null; }
      if (G.cur !== app.lastStage && G.phase !== 'count') { app.lastStage = G.cur; if (G.cur === 0) { const S = TR.STAGES[G.route[0]]; app.banner = { a: '1. ETAP', b: up(S.name), t: 3 }; } }
      AU.engineUpdate(G.speed / BY.MAX, G.phase === 'count' ? inp.gas : inp.gas, true, G.skid, G.offroad && G.speed > BY.MAX * 0.1);
      if (G.result === 'goal') { app.screen = 'ending'; app.endT = 0; AU.engineStop(); }
      else if (G.result === 'over') { app.screen = 'over'; app.overT = 0; AU.engineStop(); }
      app.lastInput = inp;
    } else if (app.screen === 'ending') {
      app.endT += dt;
    } else if (app.screen === 'over') app.overT += dt;
  }

  // ---------- çizim ----------
  function menu(items, y0, sel, gap, w) {
    gap = gap || 15; w = w || 220;
    app.menuItems = [];
    const x0 = W / 2 - w / 2;
    panel(x0, y0 - 7, w, items.length * gap + 5, 9);
    items.forEach((it, i) => {
      const y = y0 + i * gap, on = i === sel;
      const label = typeof it === 'string' ? it : it.label;
      if (on) {
        ART.rr(ctx, x0 + 4, y - 4.5, w - 8, gap - 1.5, 6.5); ctx.fillStyle = '#f4c531'; ctx.fill();
        if (it.adjust) { tri(x0 + 13, y + 2.8, 3.4, -1, '#2a1a10'); tri(x0 + w - 13, y + 2.8, 3.4, 1, '#2a1a10'); }
        else tri(x0 + 13, y + 2.8, 3.4, 1, '#2a1a10');
      }
      text(label, W / 2, y - 0.4, on ? '#2a1a10' : '#fff8ec', 7.2, 'center', on ? null : '#1a1430');
      app.menuItems.push({ y, adjust: !!(it && it.adjust) });
    });
  }
  function routeMap(G, x, y) {
    // 1-2-3-4 yol ağı, gidilen yol sarı
    ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let L = 0; L < 3; L++) {
      const n = TR.LAYERS[L].length;
      for (let j = 0; j < n; j++) {
        const idx = TR.LAYERS[L][j], cx = x + (j - (n - 1) / 2) * 10, cy = y + L * 7;
        for (const [d, nidx] of [[0, TR.LAYERS[L + 1][j]], [1, TR.LAYERS[L + 1][j + 1]]]) {
          const nx = x + (j + d - n / 2) * 10;
          const on = G.route.includes(idx) && G.route.includes(nidx);
          ctx.strokeStyle = on ? '#f4c531' : 'rgba(255,255,255,0.22)';
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, cy + 7); ctx.stroke();
        }
      }
    }
    for (let L = 0; L < 4; L++) {
      const n = TR.LAYERS[L].length;
      for (let j = 0; j < n; j++) {
        const idx = TR.LAYERS[L][j];
        const cx = x + (j - (n - 1) / 2) * 10, cy = y + L * 7;
        const on = G.route.includes(idx), cur = G.route[G.cur] === idx;
        ART.circ(ctx, cx, cy, cur ? 2.6 : 2, cur ? (Math.floor(app.t * 4) % 2 ? '#ffffff' : '#f4c531') : on ? '#f4c531' : 'rgba(255,255,255,0.35)', null);
      }
    }
  }
  function ringMap(G, x, y) {
    // İstanbul Turu: halka biçiminde 7 etap; geçilen yay sarı
    const C = TR.COURSES.tur, n = C.count, R = 10;
    const ang = (i) => -Math.PI / 2 + i / n * Math.PI * 2;
    ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
    const st = BY.curStage(G), pi = Math.floor((G.pos + BY.PLAYER_Z) / BY.SEG);
    const prog = G.cur + Math.max(0, Math.min(1, (pi - st.start) / (st.end - st.start)));
    if (prog > 0.01) { ctx.strokeStyle = '#f4c531'; ctx.beginPath(); ctx.arc(x, y, R, ang(0), ang(prog)); ctx.stroke(); }
    for (let i = 0; i < n; i++) {
      const cur = i === G.cur, done = i < G.cur;
      ART.circ(ctx, x + Math.cos(ang(i)) * R, y + Math.sin(ang(i)) * R, cur ? 2.4 : 1.7, cur ? (Math.floor(app.t * 4) % 2 ? '#ffffff' : '#f4c531') : done ? '#f4c531' : 'rgba(255,255,255,0.4)', null);
    }
  }
  function hud(G) {
    // skor
    panel(4, 4, 78, 26, 8);
    text('SKOR', 12, 7.5, '#9af4e4', 5.4, 'left', null);
    text(String(G.score).padStart(7, '0'), 12, 16.5, '#fff8ec', 8, 'left', null);
    // süre
    const tm = Math.ceil(G.time);
    const low = G.time < 10 && G.phase !== 'goal';
    panel(W / 2 - 32, 3, 64, 33, 10, low ? 'rgba(90,16,24,0.78)' : 'rgba(22,18,48,0.72)');
    text('SÜRE', W / 2, 6, '#9af4e4', 5.4, 'center', null);
    text(String(Math.max(0, tm)).padStart(2, '0'), W / 2, 14.5, low && Math.floor(app.t * 4) % 2 ? '#ff6a5a' : '#f4c531', 14, 'center', '#1a1430');
    // etap, rota haritası, ilerleme
    const st = BY.curStage(G), S2 = TR.STAGES[st.idx];
    panel(W - 96, 4, 92, 33, 8);
    text(G.course === 'tur' ? `ETAP ${S2.num}/${TR.COURSES.tur.count}` : `ETAP ${S2.num}`, W - 88, 7.5, '#9af4e4', 5.6, 'left', null);
    const pi = Math.floor((G.pos + BY.PLAYER_Z) / BY.SEG);
    const prog = Math.max(0, Math.min(1, (pi - st.start) / (st.end - st.start)));
    ART.rr(ctx, W - 88, 18, 44, 4, 2); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    if (prog > 0.02) { ART.rr(ctx, W - 88, 18, 44 * prog, 4, 2); ctx.fillStyle = '#f4c531'; ctx.fill(); }
    text(S2.short, W - 88, 25, '#fff8ec', 5, 'left', null, 500);
    if (G.course === 'tur') ringMap(G, W - 22, 20.5); else routeMap(G, W - 22, 10);
    // hız göstergesi
    const kmh = BY.kmh(G);
    panel(4, H - 34, 104, 30, 9);
    text(String(kmh), 44, H - 31, '#ffffff', 13, 'right', null);
    text('km/sa', 48, H - 25.5, '#9af4e4', 5.6, 'left', null, 500);
    const bars = Math.round(kmh / 290 * 14);
    for (let i = 0; i < 14; i++) {
      ART.rr(ctx, 11 + i * 6.4, H - 12, 4.4, 4, 1.4);
      ctx.fillStyle = i < bars ? (i > 10 ? '#ff5a4a' : i > 7 ? '#f4c531' : '#7cff6a') : 'rgba(255,255,255,0.16)'; ctx.fill();
    }
    if (app.radioShow > 0 || G.t < 6) {
      const s = '♪ ' + radioName();
      ctx.font = `600 ${7 * 1.32}px ${FONT}`;
      const w = ctx.measureText(s).width + 14;
      panel(W - 4 - w, H - 20, w, 15, 7.5);
      text(s, W - 4 - w / 2, H - 16.5, '#fff8ec', 7, 'center', null);
    }
    // ortadaki duyurular
    if (G.phase === 'count') {
      const n = Math.ceil(G.countT);
      panel(W / 2 - 46, 44, 92, 22, 11, 'rgba(16,14,24,0.85)');
      for (let i = 0; i < 3; i++) {
        const on = 3 - n > i, cx = W / 2 - 26 + i * 26;
        if (on) { const gl = ctx.createRadialGradient(cx, 55, 2, cx, 55, 14); gl.addColorStop(0, 'rgba(255,80,60,0.7)'); gl.addColorStop(1, 'rgba(255,80,60,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - 14, 41, 28, 28); }
        ART.circ(ctx, cx, 55, 7, on ? '#ff4a3a' : '#3a2a2e', ART.K, 1);
        if (on) ART.circ(ctx, cx - 2, 53, 2, 'rgba(255,255,255,0.6)', null);
      }
      if (n <= 3 && n >= 1) text(String(n), W / 2, 74, '#ffffff', 30, 'center');
    } else if (G.t < 4.2 && G.phase === 'race' && G.cur === 0) {
      if (Math.floor(app.t * 6) % 2) text('BAŞLA!', W / 2, 92, '#7cff6a', 18, 'center');
    }
    if (G.extendShow > 0) {
      panel(W / 2 - 60, 44, 120, 38, 10);
      text('SÜRE UZATILDI', W / 2, 48, '#ffffff', 7, 'center', null);
      text('+' + G.lastExtend, W / 2, 59, '#7cff6a', 15, 'center');
    }
    if (app.banner && G.extendShow <= 0 && G.phase === 'race') {
      panel(W / 2 - 110, 42, 220, 32, 10);
      text(app.banner.a, W / 2, 46, '#f4c531', 7, 'center', null);
      text(app.banner.b, W / 2, 58, '#ffffff', 9, 'center', null);
    }
    const pz = G.pos + BY.PLAYER_Z, pi2 = Math.floor(pz / BY.SEG);
    if (st.forkStart >= 0 && pi2 > st.forkStart - 260 && G.lockSide === null && G.phase === 'race') {
      const nx = TR.nextStages(st.idx);
      if (Math.floor(app.t * 3) % 2 || pi2 > st.forkStart) {
        panel(W / 2 - 100, 40, 200, 30, 10, 'rgba(22,18,48,0.78)');
        text('YOL AYRIMI', W / 2, 43.5, '#f4c531', 7, 'center', null);
        tri(W / 2 - 92, 61, 3.6, -1, '#9af4e4'); text(TR.STAGES[nx[0]].short, W / 2 - 86, 56.5, '#ffffff', 7.6, 'left', null);
        tri(W / 2 + 92, 61, 3.6, 1, '#9af4e4'); text(TR.STAGES[nx[1]].short, W / 2 + 86, 56.5, '#ffffff', 7.6, 'right', null);
      }
    }
    if (G.phase === 'timeup') {
      panel(W / 2 - 90, 70, 180, 34, 12, 'rgba(60,12,20,0.82)');
      text('SÜRE BİTTİ', W / 2, 77, '#ff6a5a', 16, 'center');
    }
    if (G.ev.some((e) => e.e === 'saved')) app.savedT = 2;
    if (app.savedT > 0) { app.savedT -= 1 / 60; text('SON ANDA!', W / 2, 92, '#7cff6a', 16, 'center'); }
    if (G.phase === 'goal') {
      panel(W / 2 - 100, 64, 200, 50, 12);
      text('BİTİŞ!', W / 2, 69, '#f4c531', 18, 'center');
      text('SÜRE BONUSU +' + G.bonus, W / 2, 97, '#ffffff', 7.4, 'center', null);
    }
  }

  function logo(cx, y) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `600 38px ${FONT}`;
    ctx.strokeStyle = '#1e1438'; ctx.lineWidth = 8; ctx.strokeText('BOĞAZ YOLU', cx, y + 2);
    ctx.lineWidth = 7; ctx.strokeText('BOĞAZ YOLU', cx, y);
    ctx.fillStyle = ART.lgrad(ctx, 0, y - 28, 0, y, [[0, '#fff2a0'], [0.5, '#ffc93a'], [1, '#ff8a2a']]); ctx.fillText('BOĞAZ YOLU', cx, y);
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.rect(0, y - 30, W, 8); ctx.clip(); ctx.fillText('BOĞAZ YOLU', cx, y);
    ctx.restore();
    // turkuaz kurdele
    const ry = y + 6, rw = 176;
    ART.poly(ctx, [cx - rw / 2 - 10, ry + 2, cx - rw / 2 + 2, ry + 2, cx - rw / 2 + 2, ry + 14, cx - rw / 2 - 10, ry + 14, cx - rw / 2 - 6, ry + 8], '#127068', '#1e1438', 0.9);
    ART.poly(ctx, [cx + rw / 2 + 10, ry + 2, cx + rw / 2 - 2, ry + 2, cx + rw / 2 - 2, ry + 14, cx + rw / 2 + 10, ry + 14, cx + rw / 2 + 6, ry + 8], '#127068', '#1e1438', 0.9);
    ART.box(ctx, cx - rw / 2, ry, rw, 13, 2, '#1fa39a', '#1e1438', 0.9);
    text('SAHİL YOLUNDA SÜREYE KARŞI', cx, ry + 2.8, '#ffffff', 7, 'center', null);
  }
  function drawTitle() {
    const G = app.demo;
    RD.render(ctx, G, { color: 'kirmizi' });
    ctx.fillStyle = ART.lgrad(ctx, 0, 0, 0, 80, [[0, 'rgba(16,14,40,0.55)'], [1, 'rgba(16,14,40,0)']]); ctx.fillRect(0, 0, W, 80);
    logo(W / 2, 40);
    const items = titleItems();
    app.menu = Math.min(app.menu, items.length - 1);
    menu(items, 73, app.menu, items.length > 6 ? 13.8 : 14.5, 210);
    // seçilen arabanın önizlemesi
    if (items[app.menu].car) {
      const img = ART.player(0, false, settings.color);
      panel(W - img.lw - 14, H - img.lh - 30, img.lw + 10, img.lh + 10, 8);
      ctx.drawImage(img, W - img.lw - 9, H - img.lh - 25, img.lw, img.lh);
    }
    // menüde seçili modun (yoksa son oynananın) rekoru
    const rc = items[app.menu].course || settings.course, best = app.scores[rc][0];
    if (best) { const s = 'REKOR ' + best.n + ' ' + best.s; panel(W / 2 - 52, H - 17, 104, 13, 6.5); text(s, W / 2, H - 14.6, '#ffe08a', 6.2, 'center', null); }
  }
  function screenDim(a) { ctx.fillStyle = `rgba(14,12,34,${a})`; ctx.fillRect(0, 0, W, H); }
  function drawHelp() {
    RD.render(ctx, app.demo, { color: 'kirmizi' });
    screenDim(0.55);
    panel(14, 8, W - 28, H - 16, 12, 'rgba(18,16,42,0.86)');
    text('NASIL OYNANIR', W / 2, 15, '#f4c531', 10, 'center');
    const story = ['Süre bitmeden sür! Her kontrol noktası süre ekler.', 'BOĞAZ YOLU: yol ayrımında sol RUMELİ, sağ ANADOLU ya da KÖPRÜ, 4 son.', 'İSTANBUL TURU: Cankurtaran\'dan köprüyle Asya\'ya, tünelle geri, 7 etap.',
      'HAVA: siste görüş kısalır, yağmurda yol kayar, gece farlarla sürersin.'];
    story.forEach((s, i) => text(s, W / 2, 28 + i * 10, '#fff8ec', 6.2, 'center', null, 500));
    const keys = [['← →', 'direksiyon'], ['↑ / Z', 'gaz'], ['↓ / X', 'fren'], ['R', 'radyo kanalı'], ['P', 'duraklat'], ['M', 'ses']];
    keys.forEach(([k, s], i) => {
      const cx = i < 3 ? 70 : 230, y = 72 + (i % 3) * 14.5;
      ART.rr(ctx, cx - 40, y - 2, 40, 12, 4); ctx.fillStyle = 'rgba(154,244,228,0.14)'; ctx.fill();
      text(k, cx - 20, y, '#9af4e4', 6.6, 'center', null);
      text(s, cx + 6, y, '#fff8ec', 6.6, 'left', null, 500);
    });
    const tips = ['Trafiğe hızla arkadan çarpma: kaza yaparsın.', 'Yol kenarındaki ağaç, direk ve binalara dikkat et.', 'Sert virajlarda hız kes, yoksa dışa savrulursun.'];
    tips.forEach((s, i) => text(s, W / 2, 123 + i * 11, '#d8dcec', 6.4, 'center', null, 500));
    const A = ART;
    const sample = [[A.car('taksi', 0, 40 * S), 40], [A.car('polis', Math.floor(app.t * 5) % 2, 40 * S), 40], [A.car('otobus', 0, 48 * S), 48], [A.car('motor', 0, 16 * S), 16], [A.car('bisiklet', 1, 14 * S), 14], [A.car('scooter', 2, 13 * S), 13]];
    let x = W / 2 - 112;
    for (const [img, w] of sample) { const h = w * img.lh / img.lw; ctx.drawImage(img, x, 192 - h, w, h); x += w + 12; }
    if (Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, H - 22, '#f4c531', 6.6, 'center');
    app.menuItems = [];
  }
  function drawEnding() {
    const G = app.G;
    const img = END.scene(G.ending, ART.CAR_COLORS[settings.color][0]);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(img, 0, 0); ctx.restore();
    const E = TR.ENDINGS[G.ending];
    const a = Math.min(1, app.endT / 1.5);
    ctx.globalAlpha = a;
    panel(W / 2 - 120, 6, 240, 62, 12, 'rgba(18,14,40,0.62)');
    text(E.title, W / 2, 12, '#f4c531', 14, 'center');
    E.text.forEach((s, i) => text(s, W / 2, 34 + i * 10, '#ffffff', 6.8, 'center', null, 500));
    ctx.globalAlpha = 1;
    if (app.endT > 1.5) {
      const rh = G.lapTimes.length > 4 ? 8.6 : 11;
      const ph = 22 + G.lapTimes.length * rh + 14, px = W - 128, py = H - ph - 22;
      panel(px, py, 120, ph, 10, 'rgba(18,14,40,0.72)');
      text('ETAP SÜRELERİ', px + 60, py + 6, '#9af4e4', 6.4, 'center', null);
      G.lapTimes.forEach((t, i) => { text(`${i + 1}. etap`, px + 12, py + 19 + i * rh, '#d8dcec', 6.2, 'left', null, 500); text(`${t.toFixed(1)} sn`, px + 108, py + 19 + i * rh, '#ffffff', 6.2, 'right', null); });
      text('SKOR ' + G.score, px + 60, py + 21 + G.lapTimes.length * rh, '#f4c531', 7.4, 'center', null);
    }
    if (app.endT > 2.5 && Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, H - 14, '#f4c531', 6.6, 'center');
    app.menuItems = [];
  }
  function drawOver() {
    RD.render(ctx, app.G, { color: settings.color });
    screenDim(0.45);
    panel(W / 2 - 120, 48, 240, 96, 14, 'rgba(30,12,30,0.82)');
    text('SÜRE BİTTİ', W / 2, 58, '#ff6a5a', 18, 'center');
    const G = app.G, S2 = TR.STAGES[G.route[G.cur]];
    text(`${S2.num}. etapta kaldın: ${S2.name}`, W / 2, 90, '#ffffff', S2.name.length > 30 ? 6 : 6.8, 'center', null, 500);
    text('SKOR ' + G.score, W / 2, 104, '#f4c531', 8, 'center', null);
    if (app.overT > 2 && Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, 126, '#f4c531', 6.6, 'center');
    app.menuItems = [];
  }
  function drawName() {
    ctx.fillStyle = ART.lgrad(ctx, 0, 0, 0, H, [[0, '#2a2460'], [1, '#10121c']]); ctx.fillRect(0, 0, W, H);
    text('YENİ REKOR!', W / 2, 26, '#f4c531', 18, 'center');
    text('SKOR ' + app.G.score, W / 2, 56, '#ffffff', 8, 'center', null);
    text('ADINI YAZ', W / 2, 78, '#9af4e4', 7, 'center', null);
    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 40 + i * 40, on = i === app.nameIdx;
      ART.box(ctx, x - 15, 92, 30, 36, 8, on ? '#f4c531' : '#2e3460', on ? '#ffffff' : 'rgba(255,255,255,0.2)', 1.2);
      text(app.name[i], x, 101, on ? '#2a1a10' : '#ffffff', 16, 'center', null);
      if (on) { ART.poly(ctx, [x - 4, 88, x + 4, 88, x, 84], '#f4c531', null); ART.poly(ctx, [x - 4, 132, x + 4, 132, x, 136], '#f4c531', null); }
    }
    text('↑↓ harf   Z onay', W / 2, 148, '#aab0c8', 6.6, 'center', null, 500);
    app.menuItems = [];
  }
  function drawScores() {
    RD.render(ctx, app.demo, { color: 'kirmizi' });
    screenDim(0.45);
    panel(40, 12, W - 80, H - 24, 12, 'rgba(18,16,42,0.88)');
    text('REKORLAR', W / 2, 18, '#f4c531', 12, 'center');
    const list = app.scores[app.scoreCourse];
    text(TR.COURSES[app.scoreCourse].name, W / 2, 36, '#9af4e4', 6.6, 'center', null);
    tri(W / 2 - 58, 39.5, 3.2, -1, '#9af4e4'); tri(W / 2 + 58, 39.5, 3.2, 1, '#9af4e4');
    if (!list.length) text('Henüz rekor yok', W / 2, 96, '#ffffff', 8, 'center', null, 500);
    list.forEach((e, i) => {
      const y = 52 + i * 24, mine = app.newEntry && e === app.newEntry;
      if (mine) { ART.rr(ctx, 52, y - 4, W - 104, 23, 6); ctx.fillStyle = Math.floor(app.t * 4) % 2 ? 'rgba(244,197,49,0.22)' : 'rgba(244,197,49,0.1)'; ctx.fill(); }
      ART.circ(ctx, 66, y + 6, 6.4, i === 0 ? '#f4c531' : i === 1 ? '#c8ccd8' : i === 2 ? '#d08a4a' : '#2e3460', null);
      text(String(i + 1), 66, y + 2.6, i < 3 ? '#2a1a10' : '#ffffff', 6.6, 'center', null);
      text(e.n, 80, y - 0.5, '#ffffff', 8, 'left', null);
      text(String(e.s), W - 60, y - 0.5, '#f4c531', 8, 'right', null);
      text(e.e ? TR.ENDINGS[e.e].title : e.r, 80, y + 10.5, '#9af4e4', 5.8, 'left', null, 500);
    });
    if (app.endT > 1 && Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, H - 24, '#f4c531', 6.6, 'center');
    app.menuItems = [];
  }
  function render() {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (!['title', 'pause'].includes(app.screen)) app.menuItems = [];
    switch (app.screen) {
      case 'title': drawTitle(); break;
      case 'help': drawHelp(); break;
      case 'race': RD.render(ctx, app.G, { brake: app.lastInput && app.lastInput.brake, color: settings.color }); hud(app.G); break;
      case 'pause':
        RD.render(ctx, app.G, { color: settings.color }); hud(app.G);
        screenDim(0.6);
        text('DURAKLATILDI', W / 2, 60, '#f4c531', 12, 'center');
        menu(['DEVAM', 'YENİDEN BAŞLA', 'ANA MENÜ'], 92, app.menu);
        break;
      case 'ending': drawEnding(); break;
      case 'over': drawOver(); break;
      case 'name': drawName(); break;
      case 'scores': drawScores(); break;
    }
  }

  // ---------- kumanda köprüsü (remote.js) ----------
  window.__by.bridge = {
    wheel(s) { remote.active = true; remote.steer = Math.max(-1, Math.min(1, +s.s || 0)); remote.gas = !!s.g; remote.brake = !!s.b; },
    button(b) { AU.unlock(); menuKey(b === 'pause' ? 'start' : b); },
    release() { remote.active = false; remote.steer = 0; remote.gas = false; remote.brake = false; },
    info() { const G = app.G; return { screen: app.screen, paused: app.screen === 'pause', kmh: G ? BY.kmh(G) : 0, time: G ? Math.ceil(G.time) : 0 }; },
    open: null,
  };

  newDemo();
  addEventListener('pointerdown', () => { if (app.screen === 'title' && AU.current() === null && settings.radio >= 0) AU.playRadio(settings.radio); });
  addEventListener('keydown', () => { if (app.screen === 'title' && AU.current() === null && settings.radio >= 0) AU.playRadio(settings.radio); });
  requestAnimationFrame(frame);
})();
