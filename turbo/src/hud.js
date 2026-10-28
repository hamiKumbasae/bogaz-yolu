// Gösterge: hız saati, mini harita, süre, sıra, mesajlar
const $ = (id) => document.getElementById(id);

export function fmtTime(t) {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export class Hud {
  constructor(data, path, cps) {
    this.el = $('hud');
    this.gauge = $('gauge').getContext('2d');
    this.mm = $('minimap').getContext('2d');
    this.path = path;
    this.cps = cps;
    this.msgT = 0; this.bonusT = 0;
    this.buildMap(data);
    // ilerleme çubuğu işaretleri
    const ticks = $('progTicks');
    ticks.innerHTML = '';
    cps.forEach((c, k) => {
      const d = document.createElement('div');
      d.className = 'tk' + (k % 2 ? ' lo' : '');
      d.style.left = (c.s / path.length * 100).toFixed(2) + '%';
      d.innerHTML = `<span>${c.name}</span>`;
      ticks.appendChild(d);
    });
    this.rivDots = [];
  }
  show(on) { this.el.classList.toggle('hidden', !on); }
  buildMap(data) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < this.path.N; i++) { x0 = Math.min(x0, this.path.x[i]); x1 = Math.max(x1, this.path.x[i]); z0 = Math.min(z0, this.path.z[i]); z1 = Math.max(z1, this.path.z[i]); }
    const pad = 900;
    x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
    const S = 3072;
    const sc = S / Math.max(x1 - x0, z1 - z0);
    this.map = { x0, z0, sc, S };
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#123247'; g.fillRect(0, 0, S, S);
    const tx = (x) => (x - x0) * sc, tz = (z) => (z - z0) * sc;
    const fillTris = (t, col) => {
      g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 0.6;
      g.beginPath();
      for (let k = 0; k < t.i.length; k += 3) {
        const a = t.i[k] * 2, b = t.i[k + 1] * 2, d = t.i[k + 2] * 2;
        g.moveTo(tx(t.v[a]), tz(t.v[a + 1])); g.lineTo(tx(t.v[b]), tz(t.v[b + 1])); g.lineTo(tx(t.v[d]), tz(t.v[d + 1])); g.closePath();
      }
      g.fill(); g.stroke();
    };
    fillTris(data.land, '#2b2f33');
    fillTris(data.park, '#2c4a2c');
    g.fillStyle = '#3d4247';
    for (const b of data.buildings) {
      if (b.far) continue;
      g.beginPath();
      b.r.forEach((p, i) => (i ? g.lineTo(tx(p[0]), tz(p[1])) : g.moveTo(tx(p[0]), tz(p[1]))));
      g.closePath(); g.fill();
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of data.roads) {
      if (r.e) continue;
      g.strokeStyle = r.hw.startsWith('motorway') || r.hw.startsWith('trunk') || r.hw.startsWith('primary') ? '#9aa1a8' : '#6c7378';
      g.lineWidth = Math.max(1.2, r.w * sc * 0.9);
      g.beginPath();
      r.g.forEach((p, i) => (i ? g.lineTo(tx(p[0]), tz(p[1])) : g.moveTo(tx(p[0]), tz(p[1]))));
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,120,40,0.95)'; g.lineWidth = 7 * sc * 1.6;
    g.shadowColor = 'rgba(255,120,40,0.8)'; g.shadowBlur = 10;
    g.beginPath();
    for (let i = 0; i < this.path.N; i += 2) (i ? g.lineTo(tx(this.path.x[i]), tz(this.path.z[i])) : g.moveTo(tx(this.path.x[i]), tz(this.path.z[i])));
    g.stroke();
    g.shadowBlur = 0;
    this.mapCanvas = c;
  }
  minimap(px, pz, h, others, cpNext) {
    const g = this.mm, W = 420;
    const { x0, z0, sc } = this.map;
    const zoom = 1.5; // ekran pikseli / harita pikseli
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#123247'; g.fillRect(0, 0, W, W);
    g.translate(W / 2, W * 0.58);
    g.rotate(-h - Math.PI / 2);
    g.scale(zoom, zoom);
    g.translate(-(px - x0) * sc, -(pz - z0) * sc);
    g.drawImage(this.mapCanvas, 0, 0);
    const dot = (x, z, col, r) => { g.fillStyle = col; g.beginPath(); g.arc((x - x0) * sc, (z - z0) * sc, r / zoom, 0, Math.PI * 2); g.fill(); };
    for (const o of others) dot(o.x, o.z, o.col, o.r || 5);
    if (cpNext) {
      dot(cpNext.x, cpNext.z, '#ffd23a', 9);
    }
    g.restore();
    // oyuncu oku
    g.save();
    g.translate(W / 2, W * 0.58);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4;
    g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 3, 0, Math.PI * 2); g.stroke();
    // kuzey işareti
    const na = -h - Math.PI / 2 - Math.PI / 2;
    g.fillStyle = '#ff5a1f'; g.font = 'bold 26px "Barlow Condensed", Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('K', W / 2 + Math.cos(na) * (W / 2 - 24), W / 2 + Math.sin(na) * (W / 2 - 24));
  }
  speedo(kmh, rpm, gear, nitro, nitroOn) {
    const g = this.gauge, S = 440, c = S / 2;
    g.clearRect(0, 0, S, S);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.lineCap = 'butt';
    g.lineWidth = 22;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.arc(c, c, 180, a0, a1); g.stroke();
    // devir yayı
    const f = Math.min(1, rpm / 8000);
    const grad = g.createLinearGradient(0, S, S, 0);
    grad.addColorStop(0, '#ffc23a'); grad.addColorStop(0.7, '#ff7a1f'); grad.addColorStop(1, '#ff2a1a');
    g.strokeStyle = grad;
    g.beginPath(); g.arc(c, c, 180, a0, a0 + (a1 - a0) * f); g.stroke();
    // çentikler
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (a1 - a0) * k / 8;
      g.beginPath(); g.moveTo(c + Math.cos(a) * 160, c + Math.sin(a) * 160); g.lineTo(c + Math.cos(a) * 196, c + Math.sin(a) * 196); g.stroke();
    }
    // kırmızı bölge
    g.strokeStyle = 'rgba(255,40,30,0.8)'; g.lineWidth = 6;
    g.beginPath(); g.arc(c, c, 200, a0 + (a1 - a0) * 0.85, a1); g.stroke();
    $('spd').textContent = Math.round(kmh);
    $('gear').textContent = gear < 0 ? 'G' : gear;
    const nf = $('nitroFill');
    nf.style.width = (nitro * 100).toFixed(1) + '%';
    nf.style.filter = nitroOn ? 'brightness(1.6)' : '';
  }
  time(t, split) {
    $('time').textContent = fmtTime(t);
    if (split !== undefined) $('split').textContent = split;
  }
  position(p, n) { $('pos').innerHTML = `${p}<span>/${n}</span>`; }
  progress(f, rivals) {
    $('progFill').style.width = (f * 100).toFixed(2) + '%';
    $('progMe').style.left = `calc(${(f * 100).toFixed(2)}% - 3px)`;
    const t = $('progTicks');
    while (this.rivDots.length < rivals.length) {
      const d = document.createElement('div'); d.className = 'riv'; t.appendChild(d); this.rivDots.push(d);
    }
    rivals.forEach((r, i) => { this.rivDots[i].style.left = (r.f * 100).toFixed(2) + '%'; this.rivDots[i].style.background = r.col; });
  }
  nextCp(text) { $('nextCp').textContent = text; }
  msg(html, dur = 1.6) {
    const m = $('msg');
    m.innerHTML = html;
    m.classList.add('on');
    this.msgT = dur;
  }
  bonus(text) {
    const b = $('bonus');
    b.textContent = text;
    b.classList.add('on');
    this.bonusT = 1.2;
  }
  tick(dt) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) $('msg').classList.remove('on'); }
    if (this.bonusT > 0) { this.bonusT -= dt; if (this.bonusT <= 0) $('bonus').classList.remove('on'); }
  }
}
