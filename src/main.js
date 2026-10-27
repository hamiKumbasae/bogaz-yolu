// Boğaz Yolu — oyun kabuğu: ekranlar, HUD, giriş (klavye, dokunmatik, eğme, oyun kolu), ses, rekorlar.
(function () {
  'use strict';
  const BY = window.BY, TR = window.BY_TRACK, ART = window.BY_ART, RD = window.BY_RENDER, AU = window.BY_AUDIO, END = window.BY_ENDINGS, BOT = window.BY_BOT;
  const canvas = document.getElementById('oyun');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = 384, H = 216;
  const params = new URLSearchParams(location.search);
  if (params.has('tv')) document.body.classList.add('tv');
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  // ---------- kayıt ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yok */ } },
  };
  const COLORS = ['kirmizi', 'beyaz', 'turkuaz'];
  const COLOR_NAMES = { kirmizi: 'KIRMIZI', beyaz: 'BEYAZ', turkuaz: 'TURKUAZ' };
  const settings = Object.assign({ radio: 0, color: 'kirmizi', tilt: false, autoGas: coarse }, store.get('by-ayar', {}));
  const saveSettings = () => store.set('by-ayar', settings);

  // ---------- yazı ----------
  if (window.FontFace && document.fonts) {
    for (const [file, range] of [
      ['latin', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215'],
      ['latin-ext', 'U+0100-0130, U+0132-024F, U+1E00-1EFF, U+20A0-20AB, U+20AD-20CF'],
    ]) {
      new FontFace('Press Start 2P', `url(src/fonts/press-start-2p-${file}-400-normal.woff2)`, { unicodeRange: range })
        .load().then((f) => document.fonts.add(f)).catch(() => { /* monospace'e düşer */ });
    }
  }
  // Yazı tipinin büyük İ, Ö, Ü harfleri küçük harf gibi durduğu için I, O, U yazılıp noktalar elle konur.
  const DOTS = { 'İ': ['I', [3]], 'Ö': ['O', [1, 5]], 'Ü': ['U', [1, 5]] };
  function text(s, x, y, col = '#f4f0e4', size = 8, align = 'left', shadow = '#10121c') {
    s = String(s);
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const chars = [...s];
    const plain = chars.map((c) => (DOTS[c] ? DOTS[c][0] : c)).join('');
    const u = size / 8, sh = size >= 16 ? 2 : 1;
    const x0 = Math.round(x - (align === 'center' ? (chars.length * size) / 2 : align === 'right' ? chars.length * size : 0));
    const y0 = Math.round(y);
    const draw = (ox, oy, c) => {
      ctx.fillStyle = c; ctx.fillText(plain, x0 + ox, y0 + oy);
      chars.forEach((ch, i) => { if (DOTS[ch]) for (const dx of DOTS[ch][1]) ctx.fillRect(x0 + i * size + dx * u + ox, y0 - 2 * u + oy, 2 * u, u); });
    };
    if (shadow) draw(sh, sh, shadow);
    draw(0, 0, col);
  }
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
    screen: 'title', menu: 0, menuItems: [], t: 0, G: null, demo: null, demoT: 0,
    endT: 0, overT: 0, banner: null, radioShow: 0, scores: store.get('by-rekorlar', []), name: ['A', 'A', 'A'], nameIdx: 0, lastStage: -1,
  };
  window.__by = { app, BY, start: () => startRace() };

  function newDemo() {
    const choices = [Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0];
    app.demo = BY.newRace({ seed: Math.floor(Math.random() * 1e6) });
    app.demo.bot = BOT(choices); app.demo.bgX = 0; app.demoT = 0;
    app.demo.countT = 0.01; // gösteride geri sayım yok
  }
  function startRace() {
    AU.unlock();
    app.G = BY.newRace({ seed: Math.floor(Math.random() * 1e9) });
    app.G.bgX = 0;
    app.screen = 'race'; app.lastStage = -1; app.banner = null;
    AU.engineStart();
    AU.playRadio(settings.radio);
  }
  function pause() { if (app.screen !== 'race') return; app.screen = 'pause'; app.menu = 0; AU.sfx('pause'); AU.engineStop(); AU.stopRadio(); }
  function resume() { app.screen = 'race'; AU.playRadio(settings.radio); }
  function toTitle() { app.screen = 'title'; app.menu = 0; app.G = null; AU.engineStop(); AU.playRadio(settings.radio); newDemo(); }
  function qualifies(score) { return score > 0 && (app.scores.length < 5 || score > app.scores[app.scores.length - 1].s); }
  function finishRun() {
    const G = app.G;
    if (qualifies(G.score)) { app.screen = 'name'; app.name = ['A', 'A', 'A']; app.nameIdx = 0; }
    else { app.screen = 'scores'; app.endT = 0; }
  }
  function saveName() {
    const G = app.G;
    const entry = { n: app.name.join(''), s: G.score, e: G.ending || '', r: TR.STAGES[G.route[G.route.length - 1]].short };
    app.scores.push(entry);
    app.scores.sort((a, b) => b.s - a.s);
    app.scores = app.scores.slice(0, 5);
    store.set('by-rekorlar', app.scores);
    app.screen = 'scores'; app.endT = 0; app.newEntry = entry;
  }
  const LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');

  function titleItems() {
    const items = [
      { label: 'YARIŞA BAŞLA', act: () => startRace() },
      { label: 'RADYO: ' + radioName(), adjust: (d) => nextRadio(d) },
      { label: 'ARABA: ' + COLOR_NAMES[settings.color], adjust: (d) => { const i = COLORS.indexOf(settings.color); settings.color = COLORS[(i + (d < 0 ? 2 : 1)) % 3]; saveSettings(); } },
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
      if (k === 'ok') { AU.sfx('select'); if (app.menu === 0) resume(); else if (app.menu === 1) startRace(); else toTitle(); }
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
      if (app.endT > 1 && (k === 'ok' || k === 'start' || k === 'back')) toTitle();
    }
  }

  // ---------- olaylar ----------
  function handleEvents(G) {
    for (const e of G.ev) {
      switch (e.e) {
        case 'stage': {
          const S = TR.STAGES[e.idx];
          app.banner = { a: `${S.layer + 1}. ETAP`, b: up(S.name), t: 3.2 };
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
  let acc = 0, lastT = performance.now();
  function frame(now) {
    let dt = Math.max(0, (now - lastT) / 1000); lastT = now;
    if (dt > 0.1) dt = 0.1;
    app.t += dt;
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
  function update(dt) {
    app.radioShow = Math.max(0, app.radioShow - dt);
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
  function menu(items, y0, sel, gap) {
    gap = gap || 14;
    app.menuItems = [];
    items.forEach((it, i) => {
      const y = y0 + i * gap;
      const on = i === sel;
      const label = typeof it === 'string' ? it : it.label;
      if (on) { ctx.fillStyle = 'rgba(16,18,28,0.7)'; ctx.fillRect(W / 2 - 110, y - 3, 220, 13); }
      const shown = on && it.adjust ? '◀ ' + label + ' ▶' : label;
      text(shown, W / 2, y, on ? '#f4c531' : '#f4f0e4', 8, 'center');
      app.menuItems.push({ y, adjust: !!(it && it.adjust) });
    });
  }
  function routeMap(G, x, y) {
    // 1-2-3-4 yol ağı, gidilen yol sarı
    for (let L = 0; L < 4; L++) {
      const n = TR.LAYERS[L].length;
      for (let j = 0; j < n; j++) {
        const idx = TR.LAYERS[L][j];
        const cx = x + (j - (n - 1) / 2) * 10, cy = y + L * 8;
        const on = G.route.includes(idx), cur = G.route[G.cur] === idx;
        ctx.fillStyle = cur ? (Math.floor(app.t * 4) % 2 ? '#ffffff' : '#f4c531') : on ? '#f4c531' : 'rgba(255,255,255,0.35)';
        ctx.fillRect(Math.round(cx) - 2, cy - 2, 4, 4);
      }
    }
  }
  function hud(G) {
    // üst şerit
    ctx.fillStyle = 'rgba(16,18,28,0.55)'; ctx.fillRect(0, 0, W, 26);
    text('SKOR', 6, 4, '#9af4e4');
    text(String(G.score).padStart(7, '0'), 6, 14);
    const tm = Math.ceil(G.time);
    const low = G.time < 10 && G.phase !== 'goal';
    text('SÜRE', W / 2, 2, '#9af4e4', 8, 'center');
    text(String(Math.max(0, tm)).padStart(2, '0'), W / 2, 11, low && Math.floor(app.t * 4) % 2 ? '#ff5a4a' : '#f4c531', 16, 'center');
    const st = BY.curStage(G), S = TR.STAGES[st.idx];
    text(`ETAP ${S.layer + 1}`, W - 64, 4, '#9af4e4');
    routeMap(G, W - 22, 4);
    // ilerleme çubuğu
    const pi = Math.floor((G.pos + BY.PLAYER_Z) / BY.SEG);
    const prog = Math.max(0, Math.min(1, (pi - st.start) / (st.end - st.start)));
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(W - 64, 16, 40, 3);
    ctx.fillStyle = '#f4c531'; ctx.fillRect(W - 64, 16, Math.round(40 * prog), 3);
    // hız
    const kmh = BY.kmh(G);
    ctx.fillStyle = 'rgba(16,18,28,0.55)'; ctx.fillRect(4, H - 28, 92, 24);
    text(String(kmh).padStart(3, ' '), 10, H - 24, '#ffffff', 16);
    text('KM/SA', 62, H - 16, '#9af4e4');
    const bars = Math.round(kmh / 290 * 14);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = i < bars ? (i > 10 ? '#ff5a4a' : i > 7 ? '#f4c531' : '#7cff6a') : 'rgba(255,255,255,0.15)'; ctx.fillRect(10 + i * 6, H - 7, 4, 2); }
    if (app.radioShow > 0 || G.t < 6) text('♪ ' + radioName(), W - 6, H - 12, '#f4f0e4', 8, 'right');
    // ortadaki duyurular
    if (G.phase === 'count') {
      const n = Math.ceil(G.countT);
      if (n <= 3 && n >= 1) text(String(n), W / 2, 70, '#ffffff', 32, 'center');
      // başlangıç ışıkları
      for (let i = 0; i < 3; i++) { ART.disc(ctx, W / 2 - 24 + i * 24, 52, 7, '#141018'); ART.disc(ctx, W / 2 - 24 + i * 24, 52, 5, 3 - n > i ? '#ff4a3a' : '#3a2a2a'); }
    } else if (G.t < 4.2 && G.phase === 'race' && G.cur === 0) {
      if (G.t < 4.2 && Math.floor(app.t * 6) % 2) text('BAŞLA!', W / 2, 96, '#7cff6a', 16, 'center');
    }
    if (G.extendShow > 0) {
      text('SÜRE UZATILDI', W / 2, 44, '#ffffff', 8, 'center');
      text('+' + G.lastExtend, W / 2, 56, '#7cff6a', 16, 'center');
    }
    if (app.banner && G.extendShow <= 0 && G.phase === 'race') {
      ctx.fillStyle = 'rgba(16,18,28,0.6)'; ctx.fillRect(0, 40, W, 30);
      text(app.banner.a, W / 2, 44, '#f4c531', 8, 'center');
      text(app.banner.b, W / 2, 56, '#ffffff', 8, 'center');
    }
    const pz = G.pos + BY.PLAYER_Z, pi2 = Math.floor(pz / BY.SEG);
    if (st.forkStart >= 0 && pi2 > st.forkStart - 260 && G.lockSide === null && G.phase === 'race') {
      const nx = TR.nextStages(st.idx);
      if (Math.floor(app.t * 3) % 2 || pi2 > st.forkStart) {
        text('YOL AYRIMI', W / 2, 34, '#f4c531', 8, 'center');
        text('◀ ' + TR.STAGES[nx[0]].short, W / 2 - 8, 46, '#ffffff', 8, 'right');
        text(TR.STAGES[nx[1]].short + ' ▶', W / 2 + 8, 46, '#ffffff', 8, 'left');
      }
    }
    if (G.phase === 'timeup') {
      ctx.fillStyle = 'rgba(16,18,28,0.6)'; ctx.fillRect(0, 70, W, 36);
      text('SÜRE BİTTİ', W / 2, 78, '#ff5a4a', 16, 'center');
    }
    if (G.ev.some((e) => e.e === 'saved')) app.savedT = 2;
    if (app.savedT > 0) { app.savedT -= 1 / 60; text('SON ANDA!', W / 2, 90, '#7cff6a', 16, 'center'); }
    if (G.phase === 'goal') {
      ctx.fillStyle = 'rgba(16,18,28,0.6)'; ctx.fillRect(0, 64, W, 50);
      text('BİTİŞ!', W / 2, 70, '#f4c531', 16, 'center');
      text('SÜRE BONUSU +' + G.bonus, W / 2, 94, '#ffffff', 8, 'center');
    }
  }

  function drawTitle() {
    const G = app.demo;
    RD.render(ctx, G, { color: 'kirmizi' });
    ctx.fillStyle = 'rgba(16,18,28,0.6)'; ctx.fillRect(0, 14, W, 50);
    text('BOĞAZ YOLU', W / 2, 20, '#f4c531', 24, 'center', '#7a3a10');
    text('SAHİL YOLUNDA SÜREYE KARŞI', W / 2, 50, '#9af4e4', 8, 'center');
    const items = titleItems();
    app.menu = Math.min(app.menu, items.length - 1);
    ctx.fillStyle = 'rgba(16,18,28,0.45)'; ctx.fillRect(W / 2 - 116, 72, 232, items.length * 14 + 8);
    menu(items, 77, app.menu);
    // seçilen arabanın önizlemesi
    const img = ART.player(0, false, settings.color);
    if (app.menu === 2) ctx.drawImage(img, W - img.width - 6, H - img.height - 22);
    if (app.scores.length) text('REKOR ' + app.scores[0].n + ' ' + app.scores[0].s, W / 2, H - 12, '#ffffff', 8, 'center');
  }
  function drawHelp() {
    RD.render(ctx, app.demo, { color: 'kirmizi' });
    ctx.fillStyle = 'rgba(10,12,20,0.85)'; ctx.fillRect(12, 8, W - 24, H - 16);
    text('NASIL OYNANIR', W / 2, 16, '#f4c531', 8, 'center');
    const lines = [
      ['Süre bitmeden Boğaz boyunca sür!', '#f4f0e4'],
      ['Her kontrol noktası süre ekler.', '#f4f0e4'],
      ['Yol ayrımında sol RUMELİ, sağ', '#f4f0e4'],
      ['ANADOLU ya da KÖPRÜ: 4 farklı son.', '#f4f0e4'],
      ['', ''],
      ['← →        direksiyon', '#9af4e4'],
      ['↑ / Z      gaz', '#9af4e4'],
      ['↓ / X      fren', '#9af4e4'],
      ['R radyo   P duraklat   M ses', '#9af4e4'],
      ['', ''],
      ['Trafiğe hızla çarpma, yol', '#f4f0e4'],
      ['kenarındaki ağaç ve direklere', '#f4f0e4'],
      ['dikkat et. Virajda hız kes!', '#f4f0e4'],
    ];
    lines.forEach(([s, c], i) => text(s, 28, 32 + i * 12, c));
    if (Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, H - 22, '#f4c531', 8, 'center');
    app.menuItems = [];
  }
  function drawEnding() {
    const G = app.G;
    const img = END.scene(G.ending, ART.CAR_COLORS[settings.color][0]);
    ctx.drawImage(img, 0, 0);
    const E = TR.ENDINGS[G.ending];
    const a = Math.min(1, app.endT / 1.5);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,12,20,0.6)'; ctx.fillRect(0, 6, W, 58);
    text(E.title, W / 2, 12, '#f4c531', 16, 'center');
    E.text.forEach((s, i) => text(s, W / 2, 32 + i * 10, '#ffffff', 8, 'center'));
    ctx.globalAlpha = 1;
    if (app.endT > 1.5) {
      const ph = 18 + G.lapTimes.length * 10 + 24, py = H - ph - 20;
      ctx.fillStyle = 'rgba(10,12,20,0.6)'; ctx.fillRect(W - 150, py, 144, ph);
      text('ETAP SÜRELERİ', W - 78, py + 4, '#9af4e4', 8, 'center');
      G.lapTimes.forEach((t, i) => text(`${i + 1}. ${t.toFixed(1)} SN`, W - 140, py + 18 + i * 10, '#ffffff'));
      text('SKOR ' + G.score, W - 140, py + 22 + G.lapTimes.length * 10, '#f4c531');
    }
    if (app.endT > 2.5 && Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, H - 12, '#f4c531', 8, 'center');
    app.menuItems = [];
  }
  function drawOver() {
    RD.render(ctx, app.G, { color: settings.color });
    ctx.fillStyle = 'rgba(10,12,20,0.7)'; ctx.fillRect(0, 50, W, 90);
    text('SÜRE BİTTİ', W / 2, 60, '#ff5a4a', 16, 'center');
    const G = app.G, S = TR.STAGES[G.route[G.cur]];
    text(`${S.layer + 1}. ETAPTA KALDIN: ${up(S.short)}`, W / 2, 86, '#ffffff', 8, 'center');
    text('SKOR ' + G.score, W / 2, 100, '#f4c531', 8, 'center');
    if (app.overT > 2 && Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, 122, '#f4c531', 8, 'center');
    app.menuItems = [];
  }
  function drawName() {
    ctx.fillStyle = '#10121c'; ctx.fillRect(0, 0, W, H);
    text('YENİ REKOR!', W / 2, 30, '#f4c531', 16, 'center');
    text('SKOR ' + app.G.score, W / 2, 56, '#ffffff', 8, 'center');
    text('ADINI YAZ', W / 2, 80, '#9af4e4', 8, 'center');
    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 36 + i * 36;
      ctx.fillStyle = i === app.nameIdx ? '#f4c531' : '#3a4058'; ctx.fillRect(x - 12, 96, 24, 30);
      ctx.fillStyle = '#10121c'; ctx.fillRect(x - 10, 98, 20, 26);
      text(app.name[i], x, 102, i === app.nameIdx ? '#f4c531' : '#ffffff', 16, 'center');
    }
    text('↑↓ HARF   Z ONAY', W / 2, 146, '#9aa0b4', 8, 'center');
    app.menuItems = [];
  }
  function drawScores() {
    RD.render(ctx, app.demo, { color: 'kirmizi' });
    ctx.fillStyle = 'rgba(10,12,20,0.82)'; ctx.fillRect(40, 16, W - 80, H - 32);
    text('REKORLAR', W / 2, 26, '#f4c531', 16, 'center');
    if (!app.scores.length) text('HENÜZ REKOR YOK', W / 2, 90, '#ffffff', 8, 'center');
    app.scores.forEach((e, i) => {
      const col = app.newEntry && e === app.newEntry && Math.floor(app.t * 4) % 2 ? '#f4c531' : '#ffffff';
      const end = e.e ? TR.ENDINGS[e.e].title : e.r;
      text(`${i + 1}. ${e.n}  ${String(e.s).padStart(7, ' ')}`, 60, 54 + i * 22, col);
      text(end, 84, 64 + i * 22, '#9af4e4');
    });
    if (app.endT > 1 && Math.floor(app.t * 2) % 2) text('DEVAM İÇİN Z', W / 2, H - 28, '#f4c531', 8, 'center');
    app.menuItems = [];
  }
  function render() {
    ctx.imageSmoothingEnabled = false;
    if (!['title', 'pause'].includes(app.screen)) app.menuItems = [];
    switch (app.screen) {
      case 'title': drawTitle(); break;
      case 'help': drawHelp(); break;
      case 'race': RD.render(ctx, app.G, { brake: app.lastInput && app.lastInput.brake, color: settings.color }); hud(app.G); break;
      case 'pause':
        RD.render(ctx, app.G, { color: settings.color }); hud(app.G);
        ctx.fillStyle = 'rgba(10,12,20,0.7)'; ctx.fillRect(0, 0, W, H);
        text('DURAKLATILDI', W / 2, 60, '#f4c531', 8, 'center');
        menu(['DEVAM', 'YENİDEN BAŞLA', 'ANA MENÜ'], 86, app.menu);
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
