// İstanbul Turbo — ana döngü
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Height, buildTerrain } from './terrain.js';
import { buildGround, buildBuildings, coverage, buildFiller } from './city.js';
import { buildLandmarks, updateBridgeLights } from './landmarks.js';
import { buildProps, BuildingIndex, buildGates } from './props.js';
import { Atmosphere, PRESETS } from './atmosphere.js';
import { makeSportsCar, trafficModels, Fleet, makeFerry, makeShip } from './vehicles.js';
import { Collision, Car, ChaseCam } from './physics.js';
import { Traffic, Rival, laneInfo, laneOffset } from './traffic.js';
import { Hud, fmtTime } from './hud.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { U } from './shade.js';
import { Path, nextFrame, clamp, damp, rng } from './util.js';
import * as TX from './textures.js';

const $ = (id) => document.getElementById(id);
const QN = ['Düşük', 'Orta', 'Yüksek', 'Ultra'];
const TIMES = ['gunduz', 'aksam', 'gece'];
const WEATHER = [['acik', 'Açık'], ['yagmur', 'Yağmurlu']];
const TRAFFIC = [['az', 'Az', 18], ['normal', 'Normal', 38], ['yogun', 'Yoğun', 62]];
const PAINTS = [['Ateş kırmızısı', 0xc81d25], ['Boğaz mavisi', 0x1f5fbf], ['Gece siyahı', 0x16181b], ['İnci beyazı', 0xeeeeea], ['Lale sarısı', 0xf2b705], ['Zümrüt', 0x0f7a5a], ['Turuncu', 0xff6a13]];
const RIVALS = [['Kartal', 0x1f5fbf, 0.85, -1], ['Poyraz', 0xeeeeea, 0.7, 1], ['Lodos', 0x0f7a5a, 0.55, -1]];

const params = new URLSearchParams(location.search);
const defaults = { time: 'aksam', weather: 'acik', traffic: 'normal', quality: 2, paint: 0, fps: false };
const settings = (() => { try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem('istanbulTurbo') || '{}')); } catch (e) { return { ...defaults }; } })();
if (params.has('q')) settings.quality = +params.get('q');
if (params.has('t')) settings.time = params.get('t');
if (params.has('w')) settings.weather = params.get('w');
const save = () => { try { localStorage.setItem('istanbulTurbo', JSON.stringify(settings)); } catch (e) { /* özel pencere */ } };
const Q = clamp(settings.quality | 0, 0, 3);

// ---------------------------------------------------------------- görüntüleyici
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = Q >= 1;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 12000);
camera.layers.enable(1); // ayrıntılar (suya yansımaz)
const maxH = [720, 900, 1080, 1440][Q];
let dynScale = 1; // kare hızı düşerse çözünürlük otomatik azalır
function resize() {
  const pr = Math.min(window.devicePixelRatio || 1, maxH / innerHeight, 2) * dynScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
}
let composer, bloom, grade;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uBlur: { value: 0 }, uVig: { value: 0.32 }, uSat: { value: 1.08 }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uBlur, uVig, uSat; uniform vec3 uTint; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (uBlur > 0.001) {
        float k = uBlur * smoothstep(0.12, 0.6, length(c));
        vec3 acc = col;
        for (int i = 1; i < 7; i++) acc += texture2D(tDiffuse, vUv - c * k * float(i) * 0.012).rgb;
        col = acc / 7.0;
      }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat) * uTint;
      col *= 1.0 - uVig * dot(c, c) * 1.6;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
function setupComposer() {
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: Q >= 2 ? 4 : 0 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.3, 0.5, 0.85);
  bloom.enabled = Q >= 1;
  composer.addPass(bloom);
  grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
}
setupComposer();
resize();
addEventListener('resize', resize);

// ---------------------------------------------------------------- yükleme
async function fetchProgress(url, onp, type = 'json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !total) return type === 'json' ? r.json() : r.arrayBuffer();
  const reader = r.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onp(Math.min(1, got / total));
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  return type === 'json' ? JSON.parse(new TextDecoder().decode(buf)) : buf.buffer;
}
const loadFill = $('loadFill'), loadTxt = $('loadTxt');
const prog = (f, t) => { loadFill.style.width = (f * 100).toFixed(1) + '%'; if (t) loadTxt.textContent = t; };

// ---------------------------------------------------------------- oyun durumu
const G = {
  state: 'loading', t: 0, raceT: 0, countdown: 0, cpIdx: 0, maxS: 0, finishOrder: [], wrongT: 0, best: null,
  data: null, H: null, path: null, li: null, col: null, car: null, carModel: null, chase: null, traffic: null, rivals: [], rivalModels: [],
  hud: null, atm: null, input: new Input(), sound: new Sound(), gates: [], ferries: [], ships: [], props: null, mode: 'race',
};
window.__ist = G;
G.renderer = renderer;
G.post = () => ({ bloom, grade, composer });
G.applyLook = (t, w) => { if (t) settings.time = t; if (w) settings.weather = w; applyLook(); };
G.start = (m) => startRace(m);
G.placeAt = (s, lane = 0) => { placeOnRoute(G.car, s, lane); G.chase.init = false; };
try { G.best = JSON.parse(localStorage.getItem('istanbulTurboBest') || 'null'); } catch (e) { G.best = null; }

async function boot() {
  prog(0.02, 'Harita indiriliyor…');
  const [data, hbuf] = await Promise.all([
    fetchProgress('data/istanbul.json', (f) => prog(0.02 + f * 0.3)),
    fetchProgress('data/height.bin', () => {}, 'buf'),
  ]);
  G.data = data;
  U.uSea.value = data.sea;
  const H = (G.H = new Height(data.hgrid, hbuf, data.sea));
  prog(0.34, 'Gökyüzü ve deniz…'); await nextFrame();
  G.atm = new Atmosphere(renderer, scene, Q);
  prog(0.38, 'Tepeler…'); await nextFrame();
  scene.add(buildTerrain(H, Q));
  const world = new THREE.Group();
  world.name = 'şehir';
  scene.add(world);
  prog(0.45, 'Yollar ve kaldırımlar…'); await nextFrame();
  buildGround(data, H, world, Q);
  prog(0.55, 'Binalar…'); await nextFrame();
  buildBuildings(data, H, world);
  const cov = coverage(data);
  prog(0.62, 'Şehir siluet…'); await nextFrame();
  if (Q >= 1) buildFiller(data, H, cov, world, Q);
  prog(0.68, 'Camiler, kuleler, köprü…'); await nextFrame();
  const lm = new THREE.Group();
  buildLandmarks(data, H, lm, Q);
  world.add(lm);
  G.landmarks = lm;
  // rota
  G.path = new Path(data.route.pts, 2);
  G.li = laneInfo(G.path, data.route);
  // kontrol noktaları rota örneklerine
  const cps = data.route.cps.map((c) => {
    let s = 0;
    for (let i = 0; i < G.path.N; i++) if (G.path.src[i] >= c.i) { s = i * G.path.step; break; }
    return { name: c.name, s };
  });
  cps[cps.length - 1].s = G.path.length - 6;
  cps[cps.length - 1].last = true;
  G.cps = cps;
  prog(0.74, 'Ağaçlar, lambalar, park etmiş arabalar…'); await nextFrame();
  const bidx = new BuildingIndex(data.buildings.filter((b) => !b.far));
  G.props = buildProps(data, H, G.path, G.li, bidx, world, Q);
  G.gates = buildGates(G.path, G.li, cps, H, world);
  prog(0.82, 'Çarpışma…'); await nextFrame();
  buildCollision(data, H);
  prog(0.86, 'Arabalar…'); await nextFrame();
  buildVehicles();
  buildBoats(H);
  applyLook();
  prog(0.93, 'Gösterge…'); await nextFrame();
  G.hud = new Hud(data, G.path, cps);
  G.chase = new ChaseCam(camera);
  placeStart();
  // gölge haritası ve shader derleme
  prog(0.97, 'Hazırlanıyor…'); await nextFrame();
  menuCamera(0);
  G.atm.update(camera, new THREE.Vector3(G.car.x, G.car.y, G.car.z), 0);
  renderer.compile(scene, camera);
  composer.render();
  prog(1, 'Hazır');
  $('loading').classList.add('hidden');
  openMenu();
  requestAnimationFrame(loop);
}

function buildCollision(data, H) {
  const col = (G.col = new Collision(16));
  for (const l of data.walls) col.addLine(l, 0);
  for (const b of data.buildings) if (!b.far) col.addRing(b.r, 1);
  for (const p of data.parts) col.addRing(p.r, 1);
  for (const q of data.mosques) if (q.poly) col.addRing(q.poly, 1);
  for (const s of data.specials) if (s.k === 'galata') col.addCircle(s.x, s.z, 8.6, 14, 1); else if (s.k === 'saatkulesi') col.addCircle(s.x, s.z, 4.8, 8, 1);
  col.finish();
}

function buildVehicles() {
  const pm = makeSportsCar(PAINTS[settings.paint % PAINTS.length][1]);
  scene.add(pm.root);
  G.carModel = pm;
  G.car = new Car();
  // farlar
  const spot = new THREE.SpotLight(0xfff1dc, 0, 160, 0.5, 0.6, 1.6);
  spot.position.set(1.9, 0.75, 0);
  spot.target.position.set(40, -0.6, 0);
  pm.root.add(spot, spot.target);
  G.headlight = spot;
  // gece arabayı gösteren yumuşak dolgu ışığı
  const fill = new THREE.PointLight(0xffdcb8, 0, 14, 1.5);
  fill.position.set(-3.5, 3.2, 0);
  pm.root.add(fill);
  G.fill = fill;
  // nitro alevleri
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const fl = new THREE.Group();
  for (const z of [0.45, 0.33]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8, 8).rotateZ(Math.PI / 2).translate(-0.4, 0, 0), flameMat);
    m.position.set(-2.3, 0.38, z);
    fl.add(m);
  }
  fl.visible = false;
  pm.root.add(fl);
  G.flames = fl;
  // trafik
  const models = trafficModels();
  const fleet = new Fleet(models, 24, scene, Q >= 2);
  fleet.meshes.forEach((parts) => Object.values(parts).forEach((im) => im.layers.set(1)));
  G.traffic = new Traffic(G.path, G.li, fleet, models, G.H, G.col);
  G.traffic.setDensity(TRAFFIC.find((t) => t[0] === settings.traffic)[2]);
  // rakipler
  for (const [name, color, skill, bias] of RIVALS) {
    const m = makeSportsCar(color);
    scene.add(m.root);
    G.rivalModels.push(m);
    G.rivals.push(new Rival(name, m, skill, bias));
  }
  G.smoke = makeSmoke();
  scene.add(G.smoke.points);
}

// ---------------------------------------------------------------- lastik dumanı
function makeSmoke() {
  const N = 160;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: TX.radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64) }, uCol: { value: new THREE.Color(0.75, 0.75, 0.75) }, uScale: { value: 600 } },
    vertexShader: 'attribute float size; attribute float alpha; varying float vA; uniform float uScale; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 uCol; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(uCol, t.a * vA * 0.5); }',
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  const parts = Array.from({ length: N }, () => ({ life: 0, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, s: 1 }));
  let k = 0;
  return {
    points: pts,
    emit(x, y, z, vx, vz) {
      const p = parts[k++ % N];
      p.life = 1; p.x = x; p.y = y; p.z = z; p.vx = vx * 0.3 + (Math.random() - 0.5); p.vy = 0.6 + Math.random() * 0.5; p.vz = vz * 0.3 + (Math.random() - 0.5); p.s = 1 + Math.random();
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        if (p.life > 0) { p.life -= dt * 0.7; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.97; p.vz *= 0.97; p.s += dt * 3.2; }
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.life > 0 ? p.y : -999; pos[i * 3 + 2] = p.z;
        size[i] = p.s; alpha[i] = Math.max(0, p.life);
      }
      g.attributes.position.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- vapurlar ve gemiler
function buildBoats(H) {
  const P = (la, lo) => [(lo - 28.995) * Math.cos(41.025 * Math.PI / 180) * 111320, (41.025 - la) * 110540];
  const wet = (a, b) => { for (let k = 0; k <= 20; k++) { const x = a[0] + (b[0] - a[0]) * k / 20, z = a[1] + (b[1] - a[1]) * k / 20; if (H.at(x, z) > -2.6) return false; } return true; };
  const piers = { karakoy: P(41.0215, 28.9800), kadikoy: P(40.9935, 29.0190), uskudar: P(41.0272, 29.0105), besiktas: P(41.0395, 29.0085), eminonu: P(41.0190, 28.9765), kabatas: P(41.0330, 28.9945) };
  const lines = [['karakoy', 'kadikoy'], ['eminonu', 'uskudar'], ['besiktas', 'kadikoy'], ['kabatas', 'uskudar'], ['eminonu', 'kadikoy']];
  const r = rng(5);
  for (const [a, b] of lines) {
    const A = piers[a], B = piers[b];
    if (!wet(A, B)) continue;
    const f = makeFerry();
    scene.add(f);
    G.ferries.push({ m: f, A, B, u: r(), dir: r() < 0.5 ? 1 : -1, len: Math.hypot(B[0] - A[0], B[1] - A[1]), h: 0, wait: 0 });
  }
  const chan = [P(40.995, 28.985), P(41.012, 28.997), P(41.030, 29.008), P(41.042, 29.030), P(41.055, 29.045), P(41.075, 29.057)];
  for (const [len, color, u, dir] of [[190, 0x8a2a1e, 0.25, 1], [150, 0x1d3b5c, 0.7, -1]]) {
    const s = makeShip(len, color);
    scene.add(s);
    G.ships.push({ m: s, pts: chan, u, dir, speed: 5.5 });
  }
  for (const [la, lo, a] of [[40.990, 28.970, 0.6], [40.985, 29.000, 2.1], [40.995, 28.950, 1.2]]) {
    const s = makeShip(160 + r() * 60, [0x5a2d22, 0x263c52, 0x3d4a3a][Math.floor(r() * 3)]);
    const [x, z] = P(la, lo);
    s.position.set(x, U.uSea.value, z); s.rotation.y = a;
    scene.add(s);
  }
}

function updateBoats(dt) {
  const sea = U.uSea.value;
  for (const f of G.ferries) {
    if (f.wait > 0) { f.wait -= dt; continue; }
    f.u += (f.dir * 6.5 * dt) / f.len;
    if (f.u > 1 || f.u < 0) { f.u = clamp(f.u, 0, 1); f.dir *= -1; f.wait = 8; }
    const e = f.u * f.u * (3 - 2 * f.u) * 0.15 + f.u * 0.85;
    const x = f.A[0] + (f.B[0] - f.A[0]) * e, z = f.A[1] + (f.B[1] - f.A[1]) * e;
    const ht = Math.atan2((f.B[1] - f.A[1]) * f.dir, (f.B[0] - f.A[0]) * f.dir);
    let d = ht - f.h; d = Math.atan2(Math.sin(d), Math.cos(d));
    f.h += d * Math.min(1, dt * 0.25);
    f.m.position.set(x, sea + Math.sin(G.t * 0.7 + f.len) * 0.15, z);
    f.m.rotation.set(Math.sin(G.t * 0.5) * 0.01, -f.h, 0);
  }
  for (const s of G.ships) {
    const n = s.pts.length - 1;
    let total = 0;
    const segs = [];
    for (let i = 0; i < n; i++) { const L = Math.hypot(s.pts[i + 1][0] - s.pts[i][0], s.pts[i + 1][1] - s.pts[i][1]); segs.push(L); total += L; }
    s.u += (s.dir * s.speed * dt) / total;
    if (s.u > 1) s.u -= 1; if (s.u < 0) s.u += 1;
    let d = s.u * total, i = 0;
    while (i < n - 1 && d > segs[i]) { d -= segs[i]; i++; }
    const t = d / segs[i];
    const a = s.pts[i], b = s.pts[i + 1];
    s.m.position.set(a[0] + (b[0] - a[0]) * t, sea, a[1] + (b[1] - a[1]) * t);
    s.m.rotation.y = -Math.atan2((b[1] - a[1]) * s.dir, (b[0] - a[0]) * s.dir);
  }
}

// ---------------------------------------------------------------- başlangıç ve sıfırlama
function placeOnRoute(car, s, laneRight = 0) {
  const p = G.path.at(s);
  const i = Math.round(s / G.path.step);
  let off = laneOffset(G.li, i, 1, laneRight);
  if (off === null) off = 0;
  car.place(p.x - p.tz * off, p.z + p.tx * off, Math.atan2(p.tz, p.tx));
  car.y = G.H.ground(car.x, car.z);
}
function placeStart() {
  const s0 = 14;
  const car = G.car;
  placeOnRoute(car, s0, 0);
  car.nitro = 0.6;
  const w = G.li.W[Math.round(s0 / G.path.step)];
  const grid = [[s0 + 10, -w / 4], [s0 + 10, w / 4], [s0 + 1, -w / 4]];
  G.rivals.forEach((r, k) => { r.reset(grid[k][0], grid[k][1]); r.place(G.path); });
  G.maxS = s0; G.cpIdx = 0; G.raceT = 0; G.finishOrder = []; G.wrongT = 0;
  G.traffic.reset();
  G.traffic.initial = true;
  G.chase.init = false;
  for (const gt of G.gates) gt.g.visible = G.mode === 'race';
  G.lastNr = null;
}

function resetToRoad() {
  const car = G.car;
  const nr = G.path.nearest(car.x, car.z);
  placeOnRoute(car, Math.max(5, nr.s), 0);
  G.chase.init = false;
  G.hud.msg('YOLA DÖNÜLDÜ', 1);
}

// ---------------------------------------------------------------- menüler
const menuEl = $('menu'), pauseEl = $('pause'), resEl = $('result');
let menuItems = [], menuSel = 0, menuBox = null;
function renderMenu(box, items) {
  box.innerHTML = '';
  items.forEach((it, i) => {
    const d = document.createElement('div');
    d.className = 'mItem' + (i === menuSel ? ' sel' : '');
    let v = it.val ? it.val() : '';
    d.innerHTML = `<span>${it.label}</span>` + (it.val ? `<span class="val">${v}</span>` : '');
    d.onmouseenter = () => { menuSel = i; renderMenu(box, items); };
    d.onclick = (e) => {
      menuSel = i;
      if (it.val && it.change) { const r = d.getBoundingClientRect(); it.change(e.clientX < r.left + r.width * 0.6 && e.clientX > r.left + r.width * 0.45 ? -1 : 1); renderMenu(box, items); }
      else if (it.act) it.act();
    };
    box.appendChild(d);
  });
}
function menuInput(edges) {
  for (const e of edges) {
    const it = menuItems[menuSel];
    if (e === 'up') menuSel = (menuSel + menuItems.length - 1) % menuItems.length;
    else if (e === 'down') menuSel = (menuSel + 1) % menuItems.length;
    else if ((e === 'left' || e === 'right') && it.change) { it.change(e === 'left' ? -1 : 1); }
    else if (e === 'ok') { if (it.act) it.act(); else if (it.change) it.change(1); }
    else if (e === 'fullscreen') toggleFS();
    else if (e === 'back' && G.state === 'pause') resume();
    else if (e === 'pause' && G.state === 'pause') resume();
    else continue;
    G.sound.init();
    if (G.state === 'menu' || G.state === 'pause' || G.state === 'result') G.sound.tone(660, 0.05, 'triangle', 0.05);
    if (menuBox) renderMenu(menuBox, menuItems);
  }
}
function cycle(arr, cur, d) { const i = arr.indexOf(cur); return arr[(i + d + arr.length) % arr.length]; }
function toggleFS() {
  try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) { /* desteklenmiyor */ }
}
function openMenu() {
  G.state = 'menu';
  G.hud.show(false);
  menuEl.classList.remove('hidden'); pauseEl.classList.add('hidden'); resEl.classList.add('hidden');
  menuSel = 0;
  menuBox = $('menuItems');
  menuItems = [
    { label: 'YARIŞ', act: () => startRace('race') },
    { label: 'SERBEST SÜRÜŞ', act: () => startRace('free') },
    { label: 'ZAMAN', val: () => PRESETS[settings.time].name, change: (d) => { settings.time = cycle(TIMES, settings.time, d); applyLook(); } },
    { label: 'HAVA', val: () => WEATHER.find((w) => w[0] === settings.weather)[1], change: (d) => { settings.weather = cycle(WEATHER.map((w) => w[0]), settings.weather, d); applyLook(); } },
    { label: 'TRAFİK', val: () => TRAFFIC.find((t) => t[0] === settings.traffic)[1], change: (d) => { settings.traffic = cycle(TRAFFIC.map((t) => t[0]), settings.traffic, d); G.traffic.setDensity(TRAFFIC.find((t) => t[0] === settings.traffic)[2]); save(); } },
    { label: 'ARABA', val: () => `${PAINTS[settings.paint][0]}<i class="sw" style="background:#${PAINTS[settings.paint][1].toString(16).padStart(6, '0')}"></i>`,
      change: (d) => { settings.paint = (settings.paint + d + PAINTS.length) % PAINTS.length; G.carModel.M.paint.color.set(PAINTS[settings.paint][1]); save(); } },
    { label: 'GRAFİK', val: () => QN[settings.quality] + (settings.quality !== Q ? ' (yeniden yükle: ENTER)' : ''),
      change: (d) => { settings.quality = clamp(settings.quality + d, 0, 3); save(); }, act: () => { if (settings.quality !== Q) { save(); location.reload(); } } },
    { label: 'TAM EKRAN', act: toggleFS },
  ];
  renderMenu(menuBox, menuItems);
  $('menuHelp').innerHTML = `<b>W / ↑</b> gaz &nbsp; <b>S / ↓</b> fren-geri &nbsp; <b>A D / ← →</b> direksiyon<br><b>BOŞLUK</b> el freni (drift) &nbsp; <b>SHIFT</b> nitro &nbsp; <b>C</b> kamera &nbsp; <b>R</b> yola dön &nbsp; <b>ESC</b> duraklat<br>Kumanda: <b>RT</b> gaz, <b>LT</b> fren, <b>A</b> nitro, <b>X</b> el freni, <b>Y</b> kamera`
    + (G.best ? `<br>En iyi süre: <b>${fmtTime(G.best)}</b>` : '');
  placeStart();
}
function applyLook() {
  const P = G.atm.set(settings.time, settings.weather);
  bloom.strength = P.bloom[0] * (settings.weather === 'yagmur' ? 1.2 : 1);
  bloom.radius = P.bloom[1]; bloom.threshold = P.bloom[2];
  renderer.toneMappingExposure = P.exposure * (settings.weather === 'yagmur' ? 0.92 : 1);
  G.props.poolMat.opacity = Math.max(0, (P.night - 0.5) * 2) * 0.45;
  G.headlight.intensity = P.night > 0.9 ? 150 : settings.weather === 'yagmur' ? 70 : 0;
  grade.uniforms.uSat.value = P.night > 0.9 ? 1.12 : 1.06;
  G.fill.intensity = P.night > 0.9 ? 18 : settings.weather === 'yagmur' ? 8 : 0;
  save();
}
function startRace(mode) {
  G.mode = mode;
  G.sound.init();
  menuEl.classList.add('hidden');
  G.hud.show(true);
  $('posBox').style.visibility = mode === 'race' ? 'visible' : 'hidden';
  $('progress').style.visibility = mode === 'race' ? 'visible' : 'hidden';
  placeStart();
  for (const m of G.rivalModels) m.root.visible = mode === 'race';
  if (mode === 'race') { G.state = 'countdown'; G.countdown = 3.999; G.lastCd = 4; }
  else { G.state = 'free'; G.hud.msg('SERBEST SÜRÜŞ<small>İSTANBUL SENİN</small>', 2); }
}
function pause() {
  G.prevState = G.state; G.state = 'pause';
  pauseEl.classList.remove('hidden');
  menuSel = 0; menuBox = $('pauseItems');
  menuItems = [
    { label: 'DEVAM', act: resume },
    { label: 'YENİDEN BAŞLA', act: () => { pauseEl.classList.add('hidden'); startRace(G.mode); } },
    { label: 'KAMERA', val: () => ['Yakın', 'Uzak', 'Kaput'][G.chase.mode], change: (d) => { G.chase.mode = (G.chase.mode + d + 3) % 3; } },
    { label: 'SES', val: () => (G.sound.on ? 'Açık' : 'Kapalı'), change: () => G.sound.setMuted(G.sound.on) },
    { label: 'ANA MENÜ', act: () => { pauseEl.classList.add('hidden'); openMenu(); } },
  ];
  renderMenu(menuBox, menuItems);
}
function resume() { pauseEl.classList.add('hidden'); G.state = G.prevState || 'free'; }
function finish() {
  G.state = 'result';
  const t = G.raceT;
  const rows = [{ name: 'SEN', t, me: true }];
  for (const r of G.rivals) {
    let rt = r.time;
    if (!r.done) { const rem = G.path.length - r.s; rt = G.raceT + rem / Math.max(20, r.v); }
    rows.push({ name: r.name.toUpperCase(), t: rt });
  }
  rows.sort((a, b) => a.t - b.t);
  const place = rows.findIndex((r) => r.me) + 1;
  let rec = '';
  if (!G.best || t < G.best) { G.best = t; rec = '<br><span style="color:#38d9ff">YENİ REKOR!</span>'; try { localStorage.setItem('istanbulTurboBest', JSON.stringify(t)); } catch (e) { /* */ } }
  $('resTitle').textContent = place === 1 ? 'BİRİNCİ!' : `${place}. OLDUN`;
  $('resBody').innerHTML = `<table>${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}.</td><td>${r.name}</td><td class="t">${fmtTime(r.t)}</td></tr>`).join('')}</table>`
    + `<div style="margin-top:14px;font-size:.8em;color:rgba(255,255,255,.7)">En yüksek hız ${Math.round(G.topSpeed || 0)} km/s · Drift ${Math.round(G.driftScore || 0)} puan${rec}</div>`;
  resEl.classList.remove('hidden');
  menuSel = 0; menuBox = $('resItems');
  menuItems = [
    { label: 'TEKRAR', act: () => { resEl.classList.add('hidden'); startRace('race'); } },
    { label: 'SERBEST SÜRÜŞ', act: () => { resEl.classList.add('hidden'); startRace('free'); } },
    { label: 'ANA MENÜ', act: () => { resEl.classList.add('hidden'); openMenu(); } },
  ];
  renderMenu(menuBox, menuItems);
  G.sound.chime();
}

// ---------------------------------------------------------------- görsel eşitleme
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1), AX = new THREE.Vector3(1, 0, 0);
function syncModel(m, x, y, z, h, pitch, roll, steer, wheelRot, accel, lat) {
  m.root.position.set(x, y, z);
  _q1.setFromAxisAngle(AY, -h); _q2.setFromAxisAngle(AZ, pitch); _q3.setFromAxisAngle(AX, -roll);
  m.root.quaternion.copy(_q1).multiply(_q2).multiply(_q3);
  m.body.rotation.z = clamp(accel * 0.0035, -0.035, 0.035);
  m.body.rotation.x = clamp(-lat * 0.0035, -0.045, 0.045);
  m.body.position.y = 0.0;
  for (const w of m.wheels) {
    if (w.front) w.steer.rotation.y = -steer;
    w.spin.rotation.z = -wheelRot;
  }
}

// ---------------------------------------------------------------- otomatik sürücü (deneme ve tanıtım)
function autopilot(car, inp) {
  const nr = G.path.nearest(car.x, car.z, G.lastNr ? G.lastNr.i : -1, 30);
  const look = nr.s + 7 + car.speed * 0.55;
  const p = G.path.at(look);
  const i = Math.round(Math.min(look, G.path.length - 1) / G.path.step);
  // önde trafik varsa boş şeride geç
  const laneFree = (ln) => {
    const o = laneOffset(G.li, i, 1, ln);
    if (o === null) return -1;
    let free = 999;
    for (const c of G.traffic.cars) { const ds = c.s - nr.s; if (ds > -4 && ds < 70 && Math.abs(c.off - o) < 2.3) free = Math.min(free, ds); }
    return free;
  };
  const cur = laneFree(G.autoLane || 0);
  if (cur < 60) {
    let best = G.autoLane || 0, bf = cur;
    for (const ln of [0, 1, 2]) { const f = laneFree(ln); if (f > bf + 10) { bf = f; best = ln; } }
    G.autoLane = best;
  }
  let off = laneOffset(G.li, i, 1, G.autoLane || 0);
  if (off === null) off = 0;
  const tx = p.x - p.tz * off, tz = p.z + p.tx * off;
  let d = Math.atan2(tz - car.z, tx - car.x) - car.h;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  inp.steer = clamp(d * 2.8, -1, 1);
  let vT = G.autoMax || 55;
  for (let k = i; k < Math.min(G.path.N, i + 45); k += 2) {
    const dist = (k - i) * G.path.step;
    const vA = Math.sqrt(10 / Math.max(Math.abs(G.path.curv[k]), 1e-4));
    vT = Math.min(vT, Math.sqrt(vA * vA + 2 * 12 * dist));
  }
  // sıkışırsa yola dön
  G.autoStuck = car.speed < 1.5 && G.state === 'race' ? (G.autoStuck || 0) + 1 / 30 : 0;
  if (G.autoStuck > 3) { resetToRoad(); G.autoStuck = 0; }
  inp.gas = car.vf < vT ? 1 : 0;
  inp.brake = car.vf > vT + 4 ? 1 : 0;
  inp.hand = false;
  inp.nitro = car.vf < vT - 10;
}

// ---------------------------------------------------------------- ana döngü
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsT = 0;
const STEP = 1 / 120;
let acc = 0;
const focus = new THREE.Vector3();
function menuCamera(t) {
  const c = G.car;
  const a = t * 0.12 + 2.3;
  camera.position.set(c.x + Math.cos(a) * 7.5, c.y + 2.0 + Math.sin(t * 0.2) * 0.3, c.z + Math.sin(a) * 7.5);
  camera.lookAt(c.x, c.y + 0.7, c.z);
  camera.fov = 50; camera.updateProjectionMatrix();
}

G.manual = params.has('shot');
G.step = (dt = 1 / 30, n = 1, render = true) => { for (let i = 0; i < n; i++) frame(dt, render && i === n - 1); };
function loop(now) {
  if (G.manual) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frame(dt, true);
}
function frame(dt, render) {
  G.t += dt;
  U.uTime.value = G.t;
  const inp = G.input.poll(dt);
  const edges = G.input.take();
  const car = G.car;
  const playing = G.state === 'race' || G.state === 'free' || G.state === 'countdown';
  if (G.auto && playing) autopilot(car, inp);

  if (G.state === 'menu' || G.state === 'pause' || G.state === 'result') menuInput(edges);
  else {
    for (const e of edges) {
      if (e === 'pause') { pause(); break; }
      if (e === 'camera') G.chase.mode = (G.chase.mode + 1) % 3;
      if (e === 'reset') resetToRoad();
      if (e === 'mute') G.sound.setMuted(G.sound.on);
      if (e === 'fullscreen') toggleFS();
    }
  }

  if (playing) {
    const drive = G.state !== 'countdown';
    car.nitroOn = drive && inp.nitro;
    if (drive) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n++ < 8) { car.update(STEP, inp, G.H, G.col); acc -= STEP; }
      if (n >= 8) acc = 0;
    } else {
      // geri sayım: araba yerinde, gaz ile devir yükselir
      car.vx = car.vz = car.w = 0;
      car.rpm = damp(car.rpm, 900 + inp.gas * 6000, 6, dt);
    }
    // rota üzerindeki konum
    const nr = G.path.nearest(car.x, car.z, G.lastNr ? G.lastNr.i : -1, 30);
    G.lastNr = nr;
    G.traffic.playerLat = nr.lat;
    if (G.state === 'countdown') {
      G.countdown -= dt;
      const c = Math.ceil(G.countdown);
      if (c !== G.lastCd && c > 0) { G.hud.msg(String(c), 0.9); G.sound.tone(440, 0.2, 'square', 0.1); G.lastCd = c; }
      if (G.countdown <= 0) { G.state = 'race'; G.hud.msg('BAŞLA!', 1.0); G.sound.tone(880, 0.45, 'square', 0.12); G.topSpeed = 0; G.driftScore = 0; }
    }
    if (G.state === 'race') {
      G.raceT += dt;
      if (nr.d < 60) G.maxS = Math.max(G.maxS, Math.min(nr.s, G.maxS + 80));
      const cp = G.cps[G.cpIdx];
      if (cp && G.maxS >= cp.s) {
        G.cpIdx++;
        G.sound.chime();
        G.gates.forEach((g) => { if (g.s <= cp.s + 1) g.g.visible = false; });
        if (cp.last) { finish(); }
        else G.hud.msg(`${cp.name}<small>${fmtTime(G.raceT)}</small>`, 1.8);
      }
      G.topSpeed = Math.max(G.topSpeed || 0, car.speed * 3.6);
    }
    // ters yön
    const p = G.path.at(nr.s);
    const along = car.vx * p.tx + car.vz * p.tz;
    if (G.state === 'race' && along < -6 && nr.d < 40) { G.wrongT += dt; if (G.wrongT > 1.2) { G.hud.msg('TERS YÖN!', 0.6); G.wrongT = 0.6; } } else G.wrongT = 0;
    if (G.state === 'race' && nr.d > 80 && !G.offMsg) { G.hud.msg('ROTADAN ÇIKTIN<small>R: YOLA DÖN</small>', 2); G.offMsg = true; } else if (nr.d < 50) G.offMsg = false;
    // nitro dolumu
    if (drive) {
      let fill = 0.02;
      if (car.drift > 0.5 && car.speed > 14) { fill += 0.16; G.driftScore = (G.driftScore || 0) + car.speed * dt * 2; }
      car.nitro = Math.min(1, car.nitro + fill * dt);
    }
    // trafik ve rakipler
    G.traffic.update(dt, car, nr.s, G.state === 'race');
    for (const ev of G.traffic.events) {
      if (ev.type === 'near') { car.nitro = Math.min(1, car.nitro + 0.1); G.hud.bonus('YAKIN GEÇİŞ +NİTRO'); }
      if (ev.type === 'crash') { G.sound.crash(ev.power); G.input.rumble(ev.power / 15, 200); G.chase.shake = Math.min(0.5, ev.power * 0.02); if (ev.power > 6 && Math.random() < 0.5) G.sound.horn(); }
    }
    G.traffic.events.length = 0;
    if (car.impact > 3) { G.sound.crash(car.impact); G.chase.shake = Math.min(0.45, car.impact * 0.02); G.input.rumble(car.impact / 20, 150); }
    if (G.mode === 'race') {
      for (const r of G.rivals) {
        r.update(dt, G.path, G.li, G.traffic, car, G.maxS, G.state === 'race');
        if (!r.done && r.s >= G.path.length - 6) { r.done = true; r.time = G.raceT; }
        r.y = G.H.ground(r.x, r.z);
        r.wheel = (r.wheel || 0) + r.v * dt / 0.35;
        syncModel(r.model, r.x, r.y, r.z, r.h, 0, 0, 0, r.wheel, 0, 0);
      }
    }
    // duman
    if (car.speed > 8 && (Math.abs(car.slip) > 0.2 || (inp.hand && drive))) {
      const fx = Math.cos(car.h), fz = Math.sin(car.h);
      for (const s of [-0.85, 0.85]) G.smoke.emit(car.x - fx * 1.35 - fz * s, car.y + 0.3, car.z - fz * 1.35 + fx * s, car.vx, car.vz);
    }
    G.flames.visible = car.nitroOn && car.nitro > 0 && inp.gas > 0.1;
    if (G.flames.visible) G.flames.children.forEach((m) => { m.scale.set(0.8 + Math.random() * 0.6, 1, 1); });
    syncModel(G.carModel, car.x, car.y, car.z, car.h, car.pitch, car.roll, car.steer, car.wheelRot, car.accel, car.latAcc);
    G.carModel.M.tail.emissiveIntensity = inp.brake > 0.1 && car.vf > 0.5 ? 6 : U.uNight.value > 0.3 ? 2 : 0.8;
    G.chase.update(dt, car, G.col, G.t);
    // gösterge
    const hud = G.hud;
    hud.time(G.mode === 'race' ? G.raceT : G.t, '');
    hud.speedo(Math.abs(car.vf) * 3.6, car.rpm, car.gear, car.nitro, car.nitroOn && car.nitro > 0);
    if (G.mode === 'race') {
      const all = [{ s: G.maxS, me: true }, ...G.rivals.map((r) => ({ s: r.done ? 1e9 - r.time : r.s }))].sort((a, b) => b.s - a.s);
      hud.position(all.findIndex((a) => a.me) + 1, all.length);
      const cols = ['#1f5fbf', '#eeeeea', '#0f7a5a'];
      hud.progress(G.maxS / G.path.length, G.rivals.map((r, i) => ({ f: Math.min(1, r.s / G.path.length), col: cols[i] })));
      const cp = G.cps[G.cpIdx];
      hud.nextCp(cp ? `SONRAKİ: ${cp.name} · ${Math.max(0, Math.round(cp.s - G.maxS))} m` : '');
    } else hud.nextCp('');
    const others = G.traffic.cars.map((c) => ({ x: c.x, z: c.z, col: 'rgba(220,220,220,0.8)', r: 3.5 }));
    if (G.mode === 'race') G.rivals.forEach((r, i) => others.push({ x: r.x, z: r.z, col: ['#4c8dff', '#ffffff', '#21c08b'][i], r: 6 }));
    const cpn = G.mode === 'race' && G.cps[G.cpIdx] ? G.path.at(G.cps[G.cpIdx].s) : null;
    hud.minimap(car.x, car.z, Math.atan2(car.vz, car.vx) * (car.speed > 3 ? 1 : 0) + (car.speed > 3 ? 0 : car.h), others, cpn);
    hud.tick(dt);
    // hız bulanıklığı
    const kmh = car.speed * 3.6;
    grade.uniforms.uBlur.value = damp(grade.uniforms.uBlur.value, clamp((kmh - 140) / 160, 0, 1) * 0.9 + (G.flames.visible ? 0.5 : 0), 4, dt);
    G.sound.update(car, inp, drive, settings.weather === 'yagmur');
    focus.set(car.x + Math.cos(car.h) * 30, car.y, car.z + Math.sin(car.h) * 30);
  } else {
    if (G.state === 'menu') {
      menuCamera(G.t);
      syncModel(G.carModel, car.x, car.y, car.z, car.h, 0, 0, 0, 0, 0, 0);
      G.rivalModels.forEach((m) => (m.root.visible = false));
    }
    G.sound.update(car, { gas: 0 }, false, false);
    focus.set(car.x, car.y, car.z);
    grade.uniforms.uBlur.value = 0;
  }
  if (G.state !== 'pause') {
    G.traffic.render();
    G.smoke.update(dt);
    updateBoats(dt);
  }
  updateBridgeLights(G.landmarks, G.t, U.uNight.value);
  if (G.debugCam) {
    const d = G.debugCam;
    camera.position.set(d[0], d[1], d[2]); camera.lookAt(d[3], d[4], d[5]);
    camera.fov = d[6] || 60; camera.updateProjectionMatrix();
    focus.set(d[3], d[4], d[5]);
  }
  G.atm.update(camera, focus, G.t);
  if (!render) return;
  renderer.info.reset();
  composer.render();
  // uyarlanır çözünürlük: yavaş makinede akıcılığı korur
  if (!G.manual && (G.state === 'race' || G.state === 'free')) {
    G.ftAvg = G.ftAvg ? G.ftAvg * 0.97 + dt * 0.03 : dt;
    G.dynT = (G.dynT || 0) + dt;
    if (G.dynT > 2.5) {
      G.dynT = 0;
      const old = dynScale;
      if (G.ftAvg > 1 / 45 && dynScale > 0.6) dynScale = Math.max(0.6, dynScale - 0.1);
      else if (G.ftAvg < 1 / 58 && dynScale < 1) dynScale = Math.min(1, dynScale + 0.05);
      if (old !== dynScale) resize();
    }
  }
  // fps
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) {
    if (settings.fps || params.has('fps')) {
      const el = $('fps'); el.classList.remove('hidden');
      const info = renderer.info.render;
      el.textContent = `${Math.round(fpsN / fpsAcc)} fps  ${(info.triangles / 1e6).toFixed(2)}M üçgen  ${info.calls} çağrı  çözünürlük ${(dynScale * 100).toFixed(0)}%`;
    }
    fpsAcc = 0; fpsN = 0;
  }
}

boot().catch((e) => {
  console.error(e);
  loadTxt.textContent = 'Yüklenemedi: ' + e.message;
});
