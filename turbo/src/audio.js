// Sentezlenmiş sesler (dosya yok): motor, lastik, rüzgâr, nitro, çarpma, uyarılar
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.lastGear = 1; this.lastGas = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = 0.7;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    // gürültü kaynağı
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const noise = () => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
    // motor
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'square';
    this.o3 = c.createOscillator(); this.o3.type = 'sawtooth';
    const g1 = c.createGain(), g2 = c.createGain(), g3 = c.createGain();
    g1.gain.value = 0.5; g2.gain.value = 0.28; g3.gain.value = 0.16;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4); }
    shaper.curve = curve;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 2.5;
    this.eng = c.createGain(); this.eng.gain.value = 0;
    this.o1.connect(g1).connect(shaper); this.o2.connect(g2).connect(shaper); this.o3.connect(g3).connect(shaper);
    shaper.connect(this.lp).connect(this.eng).connect(this.master);
    this.o1.start(); this.o2.start(); this.o3.start();
    // lastik
    const tn = noise();
    this.tbp = c.createBiquadFilter(); this.tbp.type = 'bandpass'; this.tbp.frequency.value = 950; this.tbp.Q.value = 3;
    this.tire = c.createGain(); this.tire.gain.value = 0;
    tn.connect(this.tbp).connect(this.tire).connect(this.master);
    // rüzgâr ve yol uğultusu
    const wn = noise();
    this.wlp = c.createBiquadFilter(); this.wlp.type = 'lowpass'; this.wlp.frequency.value = 500;
    this.wind = c.createGain(); this.wind.gain.value = 0;
    wn.connect(this.wlp).connect(this.wind).connect(this.master);
    // nitro
    const nn = noise();
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    this.nit = c.createGain(); this.nit.gain.value = 0;
    nn.connect(hp).connect(this.nit).connect(this.master);
    // yağmur
    const rn = noise();
    const rlp = c.createBiquadFilter(); rlp.type = 'highpass'; rlp.frequency.value = 900;
    this.rain = c.createGain(); this.rain.gain.value = 0;
    rn.connect(rlp).connect(this.rain).connect(this.master);
  }
  setMuted(m) { this.on = !m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05); }
  update(car, inp, active, rain) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = 0.04;
    const f = (car.rpm / 60) * 2;
    this.o1.frequency.setTargetAtTime(f, t, k);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, k);
    this.o3.frequency.setTargetAtTime(f * 2.01, t, k);
    const gas = active ? inp.gas : 0;
    this.lp.frequency.setTargetAtTime(220 + gas * 1600 + car.rpm * 0.25, t, k);
    let eg = active ? 0.13 + gas * 0.16 : 0.0;
    if (car.gear !== this.lastGear && car.gear > this.lastGear && active) eg *= 0.3;
    this.eng.gain.setTargetAtTime(eg, t, car.gear !== this.lastGear ? 0.02 : 0.06);
    // gaz bırakınca turbo "pıss"
    if (active && this.lastGas > 0.6 && gas < 0.1 && car.rpm > 4500) this.burst(0.18, 2600, 0.25);
    this.lastGear = car.gear; this.lastGas = gas;
    const sp = car.speed;
    const sq = active && sp > 7 ? Math.min(1, Math.max(0, (Math.abs(car.slip) - 0.1) * 3) + (inp.hand ? 0.5 : 0)) : 0;
    this.tire.gain.setTargetAtTime(sq * 0.22, t, 0.05);
    this.tbp.frequency.setTargetAtTime(800 + sp * 4, t, 0.1);
    this.wind.gain.setTargetAtTime(active ? Math.min(0.32, sp * sp * 0.00006) : 0, t, 0.2);
    this.wlp.frequency.setTargetAtTime(300 + sp * 14, t, 0.2);
    this.nit.gain.setTargetAtTime(active && car.nitroOn && car.nitro > 0 && inp.gas > 0.1 ? 0.12 : 0, t, 0.05);
    this.rain.gain.setTargetAtTime(rain ? 0.06 : 0, t, 0.5);
  }
  burst(gain, freq, dur) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  crash(power) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const v = Math.min(1, power / 18);
    this.burst(0.5 * v + 0.1, 500, 0.35 + v * 0.3);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    const g = c.createGain(); g.gain.setValueAtTime(0.6 * v + 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.35);
  }
  tone(freq, dur = 0.18, type = 'square', gain = 0.12, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  chime() { this.tone(880, 0.18, 'triangle', 0.15); this.tone(1320, 0.3, 'triangle', 0.12, 0.09); }
  horn() { this.tone(392, 0.35, 'square', 0.05); this.tone(494, 0.35, 'square', 0.05); }
  ferry() { this.tone(98, 1.6, 'sawtooth', 0.06); this.tone(147, 1.6, 'sawtooth', 0.03); }
}
