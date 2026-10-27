// Boğaz Yolu — ses: motor, efektler ve üç radyo kanalının özgün müzikleri (Web Audio ile sentezlenir).
(function (root) {
  'use strict';
  let ac = null, master = null, musicBus = null, sfxBus = null, engine = null;
  let muted = false;
  try { muted = localStorage.getItem('by-ses') === '0'; } catch (e) { /* yok */ }

  function ctx() {
    if (!ac) {
      try {
        ac = new (root.AudioContext || root.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
        musicBus = ac.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
        sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  let pulse25 = null;
  function pulseWave() {
    if (pulse25) return pulse25;
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    pulse25 = ac.createPeriodicWave(re, im);
    return pulse25;
  }
  function osc(type, freq, t0, dur, vol, bus, slide, attack) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulseWave()); else o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.004));
    g.gain.setValueAtTime(vol, t0 + Math.max(0.005, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  let noiseBuf = null;
  function nbuf() {
    if (!noiseBuf) {
      const n = ac.sampleRate; noiseBuf = ac.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function noise(t0, dur, vol, cutoff, bus, type) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf(); f.type = type || 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(bus); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }
  const mid = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseNote(tok) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }

  // ---------------- motor ----------------
  // Sürekli çalışan iki osilatör + rüzgâr/lastik gürültüsü; her karede hıza göre güncellenir.
  function engineStart() {
    if (!ctx() || engine) return;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
    g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g).connect(sfxBus);
    o1.start(); o2.start();
    const n = ac.createBufferSource(); n.buffer = nbuf(); n.loop = true;
    const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1200; nf.Q.value = 0.8;
    const ng = ac.createGain(); ng.gain.value = 0;
    n.connect(nf).connect(ng).connect(sfxBus); n.start();
    const sk = ac.createBufferSource(); sk.buffer = nbuf(); sk.loop = true;
    const sf = ac.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 3200; sf.Q.value = 6;
    const sg = ac.createGain(); sg.gain.value = 0;
    sk.connect(sf).connect(sg).connect(sfxBus); sk.start();
    engine = { o1, o2, f, g, ng, nf, sg };
  }
  // sp: 0..1 hız, gas: 0..1, on: motor çalışıyor mu, skid/off: lastik ve toprak sesi
  function engineUpdate(sp, gas, on, skid, off) {
    if (!engine || !ac) return;
    const t = ac.currentTime;
    const gears = [0, 0.18, 0.36, 0.55, 0.76, 1.01];
    let g = 0; while (g < 4 && sp > gears[g + 1]) g++;
    const rpm = Math.max(0, Math.min(1, (sp - gears[g]) / (gears[g + 1] - gears[g])));
    const base = sp < 0.01 ? 48 + gas * 40 : 62 + rpm * 96 + g * 10;
    engine.o1.frequency.setTargetAtTime(base, t, 0.04);
    engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04);
    engine.f.frequency.setTargetAtTime(500 + rpm * 900 + gas * 500, t, 0.05);
    engine.g.gain.setTargetAtTime(on && !muted ? 0.035 + gas * 0.03 : 0, t, 0.08);
    engine.ng.gain.setTargetAtTime(on && !muted ? sp * sp * 0.05 + (off ? 0.09 : 0) : 0, t, 0.1);
    engine.nf.frequency.setTargetAtTime(off ? 500 : 1400, t, 0.1);
    engine.sg.gain.setTargetAtTime(on && !muted && skid ? 0.06 : 0, t, 0.05);
  }
  function engineStop() { if (engine && ac) { engine.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); engine.ng.gain.setTargetAtTime(0, ac.currentTime, 0.05); engine.sg.gain.setTargetAtTime(0, ac.currentTime, 0.05); } }

  // ---------------- efektler ----------------
  const last = {};
  function sfx(name) {
    if (!ctx() || muted) return;
    const t = ac.currentTime, B = sfxBus;
    const now = performance.now();
    if (last[name] && now - last[name] < 60) return;
    last[name] = now;
    const seq = (notes, step, type, vol, dur) => notes.forEach((n, i) => osc(type || 'pulse', mid(n), t + i * step, dur || step * 1.1, vol || 0.12, B));
    switch (name) {
      case 'beep': osc('square', 440, t, 0.18, 0.08, B); break;
      case 'go': osc('square', 880, t, 0.5, 0.09, B); break;
      case 'crash': noise(t, 0.9, 0.5, 1500, B); osc('triangle', 90, t, 0.5, 0.4, B, 0.4); noise(t + 0.15, 0.6, 0.2, 4000, B, 'highpass'); break;
      case 'bump': osc('triangle', 110, t, 0.15, 0.35, B, 0.6); noise(t, 0.1, 0.18, 1200, B); break;
      case 'wall': noise(t, 0.3, 0.25, 3500, B, 'highpass'); osc('square', 220, t, 0.12, 0.05, B, 0.5); break;
      case 'recover': seq([60, 64], 0.08, 'triangle', 0.2); break;
      case 'extend': seq([72, 76, 79, 84, 79, 84, 88], 0.07, 'pulse', 0.09); break;
      case 'saved': seq([84, 88, 91, 96], 0.06, 'pulse', 0.09); break;
      case 'timelow': osc('square', 1046, t, 0.08, 0.06, B); break;
      case 'timeup': seq([67, 63, 60, 55], 0.22, 'triangle', 0.3, 0.28); break;
      case 'fork': seq([67, 72], 0.08, 'pulse', 0.07); break;
      case 'goal': [[72, 0], [76, 0.14], [79, 0.28], [84, 0.42], [83, 0.7], [84, 0.84], [88, 1.0], [91, 1.2]].forEach(([n, d]) => { osc('pulse', mid(n), t + d, 0.22, 0.09, B); osc('triangle', mid(n - 24), t + d, 0.22, 0.25, B); }); break;
      case 'select': seq([72, 79], 0.05, 'pulse', 0.08); break;
      case 'move': osc('pulse', 880, t, 0.04, 0.05, B); break;
      case 'pause': seq([72, 79], 0.07, 'triangle', 0.2); break;
      case 'letter': osc('pulse', 1200, t, 0.03, 0.05, B); break;
    }
  }

  // ---------------- radyo ----------------
  const STATIONS = [
    { name: 'SAHİL FM', bpm: 124, chords: 'E C#m A B E C#m F#m B', drums: 'k.h.s.hhk.h.s.hh', bass: 'oct',
      lead: 'B4 . E5 . G#5 . B5 A5 | G#5 - E5 . C#5 . E5 . | A5 . G#5 . F#5 . E5 C#5 | D#5 - F#5 . B4 - . . | B4 . E5 . G#5 . B5 C#6 | B5 - G#5 . E5 . G#5 . | F#5 . A5 . G#5 . F#5 D#5 | E5 - - . . . B4 .' },
    { name: 'BOĞAZ FM', bpm: 118, chords: 'Am Dm E Am Am G F E', drums: 'k..hs.h.k.hhs.h.', bass: 'tek',
      lead: 'E5 . F5 G#5 . A5 B5 . | A5 G#5 F5 . E5 - . . | D5 . E5 F5 . G#5 A5 . | G#5 F5 E5 . D5 - E5 . | A5 . B5 C6 . B5 A5 . | B5 A5 G5 . F5 - . . | F5 E5 D5 . C5 D5 E5 . | E5 - - . . . E4 .' },
    { name: 'GECE FM', bpm: 108, chords: 'Am F C G Am F G E', drums: 'k...s..hk.k.s...', bass: 'arp',
      lead: 'A4 - C5 . E5 - D5 . | C5 - - . A4 - . . | G4 - C5 . E5 - G5 . | F5 - E5 . D5 - . . | A4 - C5 . E5 - A5 . | G5 - F5 . E5 - C5 . | D5 . E5 . F5 . G5 . | G#5 - - - E5 . . .' },
  ];
  function chordNotes(ch) {
    const m = /^([A-G])(#|b)?(m?)/.exec(ch);
    const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return [root, root + (m[3] ? 3 : 4), root + 7];
  }
  const compiled = [];
  function compile(i) {
    if (compiled[i]) return compiled[i];
    const S = STATIONS[i];
    const lead = S.lead.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
    const chords = S.chords.split(' ').map(chordNotes);
    const steps = [];
    for (let k = 0; k < 64; k++) {
      const tok = lead[k] || '.';
      const ch = chords[Math.floor(k / 8)];
      let len = 0;
      if (tok !== '.' && tok !== '-') { len = 1; while (lead[k + len] === '-') len++; }
      const pos = k % 8;
      let bass = null;
      if (S.bass === 'oct') bass = 36 + ch[0] + (pos % 2 ? 12 : 0);
      else if (S.bass === 'tek') bass = [0, null, 2, null, 0, 0, 2, null][pos] === null ? null : 36 + ch[[0, null, 2, null, 0, 0, 2, null][pos]];
      else bass = pos % 2 ? null : 36 + ch[[0, 1, 2, 1][pos / 2]];
      steps.push({ lead: len ? parseNote(tok) : null, len, bass, arp: 60 + ch[[1, 2, 0, 2][pos % 4]] + 12 * (pos > 3 ? 1 : 0), drum: S.drums[k % 16] });
    }
    compiled[i] = { bpm: S.bpm, steps };
    return compiled[i];
  }
  let cur = null, step = 0, nextT = 0, timer = null;
  function playRadio(i) {
    if (!ctx()) return;
    if (i === null || i === undefined || i < 0) { stopRadio(); return; }
    if (cur && cur.i === i) return;
    stopRadio();
    cur = { i, song: compile(i) };
    step = 0; nextT = ac.currentTime + 0.08;
    timer = setInterval(schedule, 25);
    schedule();
  }
  function stopRadio() { if (timer) clearInterval(timer); timer = null; cur = null; }
  function schedule() {
    if (!cur || !ac) return;
    const sp = 60 / cur.song.bpm / 2;
    while (nextT < ac.currentTime + 0.15) {
      const s = cur.song.steps[step % 64];
      if (!muted) {
        if (s.lead !== null) osc(cur.i === 2 ? 'square' : 'pulse', mid(s.lead), nextT, sp * s.len * 0.92, cur.i === 2 ? 0.05 : 0.07, musicBus, 0, cur.i === 2 ? 0.02 : 0.004);
        if (s.bass !== null) osc('triangle', mid(s.bass), nextT, sp * 0.9, 0.22, musicBus);
        osc('square', mid(s.arp), nextT, sp * 0.45, 0.016, musicBus);
        if (s.drum === 'k') osc('triangle', 120, nextT, 0.09, 0.3, musicBus, 0.4);
        else if (s.drum === 's') noise(nextT, 0.09, 0.12, 2400, musicBus);
        else if (s.drum === 'h') noise(nextT, 0.03, 0.05, 7000, musicBus, 'highpass');
      }
      nextT += sp; step++;
    }
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('by-ses', m ? '0' : '1'); } catch (e) { /* yok */ }
    if (master) master.gain.value = m ? 0 : 0.9;
  }

  root.BY_AUDIO = {
    unlock: ctx, sfx, engineStart, engineUpdate, engineStop, playRadio, stopRadio, STATIONS,
    get muted() { return muted; }, setMuted, current: () => (cur ? cur.i : null),
  };
})(window);
