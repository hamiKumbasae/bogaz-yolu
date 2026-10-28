// Gökyüzü (sanatsal, bulutlu), güneş/ay, yön bağımlı sis, ortam yansıması, deniz, yağmur
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { U } from './shade.js';
import * as TX from './textures.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
// Renkler doğrusal HDR değerleridir
export const PRESETS = {
  gunduz: { name: 'Gündüz', elev: 44, azim: 214, sun: 0xfff0dc, sunI: 3.1, hemiSky: 0xa9c6ec, hemiGround: 0x5e5246, hemiI: 0.9,
    zen: C(0.09, 0.22, 0.58), horSun: C(0.80, 0.82, 0.82), horAway: C(0.52, 0.66, 0.86), glow: C(0.5, 0.42, 0.28), disk: C(14, 12, 10),
    cloud: 0.5, cloudLit: C(1.05, 1.03, 1.0), cloudDark: C(0.55, 0.6, 0.68), ground: C(0.22, 0.22, 0.22),
    exposure: 0.82, fogD: 0.00016, bloom: [0.1, 0.3, 1.6], night: 0, water: 0x0e4458, envI: 1.0 },
  aksam: { name: 'Gün batımı', elev: 4.5, azim: 252, sun: 0xff9a50, sunI: 2.7, hemiSky: 0x7d8cc0, hemiGround: 0x3d2d27, hemiI: 0.6,
    zen: C(0.035, 0.075, 0.24), horSun: C(1.35, 0.58, 0.24), horAway: C(0.30, 0.25, 0.40), glow: C(1.7, 0.62, 0.16), disk: C(40, 16, 5),
    cloud: 0.45, cloudLit: C(1.3, 0.68, 0.45), cloudDark: C(0.24, 0.19, 0.26), ground: C(0.12, 0.09, 0.09),
    exposure: 0.95, fogD: 0.00021, bloom: [0.2, 0.35, 1.4], night: 0.35, water: 0x102c3e, envI: 1.0 },
  gece: { name: 'Gece', moon: true, elev: 32, azim: 135, sun: 0x9ab4ff, sunI: 0.5, hemiSky: 0x24355c, hemiGround: 0x0d0b0a, hemiI: 0.45,
    zen: C(0.003, 0.006, 0.018), horSun: C(0.045, 0.055, 0.09), horAway: C(0.075, 0.05, 0.05), glow: C(0.05, 0.06, 0.09), disk: C(6, 6, 5.5),
    cloud: 0.35, cloudLit: C(0.09, 0.06, 0.05), cloudDark: C(0.015, 0.015, 0.022), ground: C(0.02, 0.02, 0.025),
    exposure: 1.05, fogD: 0.00025, bloom: [0.32, 0.3, 1.1], night: 1, water: 0x041219, envI: 0.7 },
};

const SKY = {
  vertexShader: /* glsl */`
    varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w; }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uZen, uHorSun, uHorAway, uGlow, uDisk, uCloudLit, uCloudDark, uGround, uSunDir, uCenter;
    uniform float uCloud, uTime, uNightK, uMoon, uOvercast;
    varying vec3 vW;
    float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.; for (int i = 0; i < 5; i++) { s += vn(p) * a; p = p * 2.03 + 11.7; a *= 0.5; } return s; }
    void main(){
      vec3 d = normalize(vW - uCenter);
      float y = d.y;
      vec2 sh = normalize(uSunDir.xz + 1e-5);
      float sdh = dot(normalize(d.xz + 1e-5), sh) * 0.5 + 0.5;
      vec3 hor = mix(uHorAway, uHorSun, pow(sdh, 3.0));
      float hy = max(y, 0.0);
      vec3 col = mix(hor, uZen, pow(smoothstep(0.0, 1.0, hy), 0.5));
      float sd = max(dot(d, uSunDir), 0.0);
      col += uGlow * (pow(sd, 8.0) * 0.8 + pow(sd, 2.0) * 0.25) * exp(-hy * 2.5);
      // bulutlar
      if (y > 0.0 && uCloud > 0.0) {
        vec2 uv = d.xz / (y + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
        float n = fbm(uv * 1.3);
        float cov = 1.0 - uCloud;
        float c = smoothstep(cov - 0.05, cov + 0.25, n) * smoothstep(0.0, 0.12, y);
        float lit = clamp((n - 0.35) * 2.2, 0.0, 1.0);
        vec3 cc = mix(uCloudLit, uCloudDark, lit * (1.0 - pow(sd, 3.0) * 0.6));
        cc += uGlow * pow(sd, 6.0) * 0.6;
        col = mix(col, mix(cc, hor, smoothstep(0.25, 0.0, y) * 0.6), c * 0.92);
      }
      // gece: yıldızlar
      if (uNightK > 0.5) {
        vec3 q = d * 380.0; vec3 id = floor(q); vec3 f = fract(q) - 0.5;
        float h = h31(id);
        float star = step(0.9966, h) * smoothstep(0.42, 0.0, length(f)) * smoothstep(0.03, 0.25, y);
        col += vec3(0.9, 0.95, 1.0) * star * (0.6 + 0.8 * fract(h * 91.0)) * (0.75 + 0.25 * sin(uTime * 3.0 + h * 60.0)) * 1.6 * (1.0 - uOvercast);
      }
      // güneş / ay diski
      float disk = smoothstep(uMoon > 0.5 ? 0.99975 : 0.99965, uMoon > 0.5 ? 0.99988 : 0.99985, dot(d, uSunDir));
      col += uDisk * disk * (1.0 - uOvercast * 0.9);
      if (y < 0.0) col = mix(hor, uGround, smoothstep(0.0, -0.12, y));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const WATER_FRAG = /* glsl */`
  uniform sampler2D mirrorSampler;
  uniform float alpha;
  uniform float time;
  uniform float size;
  uniform float distortionScale;
  uniform sampler2D normalSampler;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  uniform vec3 eye;
  uniform vec3 waterColor;
  uniform float uReflect;
  uniform vec3 uFogSun; uniform vec3 uFogAway; uniform vec3 uSunDir;
  varying vec4 mirrorCoord;
  varying vec4 worldPosition;
  vec4 getNoise( vec2 uv ) {
    vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
    vec2 uv1 = uv / 107.0 - vec2( time / -19.0, time / 31.0 );
    vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
    vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
    vec4 noise = texture2D( normalSampler, uv0 ) + texture2D( normalSampler, uv1 ) + texture2D( normalSampler, uv2 ) + texture2D( normalSampler, uv3 );
    return noise * 0.5 - 1.0;
  }
  #include <common>
  #include <packing>
  #include <bsdfs>
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec3 toEye = eye - worldPosition.xyz;
    float dist = length(toEye);
    vec3 e = toEye / dist;
    vec4 noise = getNoise( worldPosition.xz * size );
    vec3 n = normalize( noise.xzy * vec3( 0.55, 1.0, 0.55 ) );
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(80.0, 1800.0, dist) * 0.7));
    vec2 distortion = n.xz * ( 0.001 + 1.0 / dist ) * distortionScale;
    vec3 fd = -e;
    vec2 shd = normalize(uSunDir.xz + 1e-5);
    float sdh = dot(normalize(fd.xz + 1e-5), shd) * 0.5 + 0.5;
    vec3 hor = mix(uFogAway, uFogSun, pow(sdh, 3.0));
    vec3 refl = uReflect > 0.5 ? texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ).rgb : mix(hor, waterColor * 3.0 + vec3(0.02, 0.04, 0.06), 0.55);
    float cosT = clamp(dot(e, n), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 body = waterColor * (0.5 + 0.5 * cosT);
    vec3 col = mix(body, refl, clamp(F, 0.0, 0.92));
    vec3 R = reflect(-sunDirection, n);
    float sp = pow(max(dot(e, R), 0.0), 300.0) * 5.0 + pow(max(dot(e, R), 0.0), 30.0) * 0.08;
    col += sunColor * sp * getShadowMask() * step(0.0, sunDirection.y);
    gl_FragColor = vec4( col, alpha );
    #ifdef USE_FOG
      float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, hor, fogF);
    #endif
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function skyMaterial(shared) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({
      uZen: { value: new THREE.Color() }, uHorSun: U.uFogSun, uHorAway: U.uFogAway, uGlow: { value: new THREE.Color() }, uDisk: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uSunDir: U.uSunDir,
      uCloud: { value: 0.5 }, uTime: U.uTime, uNightK: { value: 0 }, uMoon: { value: 0 }, uOvercast: { value: 0 }, uCenter: { value: new THREE.Vector3() },
    }, shared || {}),
    vertexShader: SKY.vertexShader, fragmentShader: SKY.fragmentShader, side: THREE.BackSide, depthWrite: false,
  });
}

export class Atmosphere {
  constructor(renderer, scene, quality) {
    this.r = renderer; this.scene = scene; this.q = quality;
    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality >= 1;
    const sz = quality >= 3 ? 4096 : quality >= 2 ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    const R = quality >= 3 ? 140 : 110;
    this.R = R;
    Object.assign(this.sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 1600 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.5;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xbfcad6, 0.0002);
    this.dir = U.uSunDir.value;
    // ortam yansıması sahnesi: aynı gökyüzü küçük ölçekte
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSkyMat = skyMaterial();
    this.envSky = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), this.envSkyMat);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 32).rotateX(-Math.PI / 2).translate(0, -3, 0), new THREE.MeshBasicMaterial({ color: 0x3a3836 }));
    this.envCity = this.cityRing();
    this.envScene.add(this.envSky, this.envGround, this.envCity);
    // deniz
    this.waterNormals = TX.waterNormals();
    const res = quality >= 3 ? 1024 : quality >= 2 ? 768 : 512;
    this.water = new Water(new THREE.PlaneGeometry(60000, 60000), {
      textureWidth: res, textureHeight: res, waterNormals: this.waterNormals, sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff,
      waterColor: 0x0f4152, distortionScale: 1.6, fog: true, alpha: 1.0,
    });
    const wu = this.water.material.uniforms;
    this.water.material.fragmentShader = WATER_FRAG;
    Object.assign(wu, { uFogSun: U.uFogSun, uFogAway: U.uFogAway, uSunDir: U.uSunDir, uReflect: { value: quality >= 1 ? 1 : 0 } });
    wu.size.value = 3.2;
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = U.uSea.value;
    this.water.receiveShadow = quality >= 2;
    this.water.renderOrder = -1;
    scene.add(this.water);
    if (quality < 1) this.water.onBeforeRender = () => {};
    this.rain = this.makeRain();
    scene.add(this.rain);
    this.rain.visible = false;
    this.preset = null;
  }
  cityRing() {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0xffb070 });
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, d = 50, y = -2 + Math.random() * 3.5;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + Math.random() * 1.4, 0.2 + Math.random() * 0.4), m);
      s.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
      s.lookAt(0, y, 0);
      g.add(s);
    }
    return g;
  }
  makeRain() {
    const N = 9000;
    const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 80, y = Math.random() * 40, z = (Math.random() - 0.5) * 80;
      pos.set([x, y, z, x + 0.05, y + 0.9, z + 0.02], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0.6, 0.65, 0.7) } },
      vertexShader: /* glsl */`
        uniform float uTime; uniform vec3 uCam;
        varying float vA;
        void main(){
          vec3 p = position;
          float fall = uTime * 26.0;
          p.y = mod(p.y - fall - uCam.y, 40.0) + uCam.y - 14.0;
          p.x = mod(p.x - uCam.x + 40.0, 80.0) - 40.0 + uCam.x - (p.y - uCam.y) * 0.05;
          p.z = mod(p.z - uCam.z + 40.0, 80.0) - 40.0 + uCam.z;
          vA = 1.0 - smoothstep(10.0, 40.0, length(p - uCam));
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, 0.32 * vA); }`,
      transparent: true, depthWrite: false,
    });
    const l = new THREE.LineSegments(g, mat);
    l.frustumCulled = false;
    return l;
  }
  set(name, weather) {
    const P = PRESETS[name];
    this.preset = P; this.weather = weather;
    const rainy = weather === 'yagmur';
    const el = THREE.MathUtils.degToRad(P.elev), az = THREE.MathUtils.degToRad(P.azim);
    this.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    const night = !!P.moon;
    // gökyüzü renkleri
    const zen = P.zen.clone(), hs = P.horSun.clone(), ha = P.horAway.clone();
    let cloud = P.cloud, over = 0;
    if (rainy) {
      const gray = night ? C(0.03, 0.035, 0.045) : C(0.42, 0.45, 0.5);
      zen.lerp(gray.clone().multiplyScalar(0.8), 0.85); hs.lerp(gray, 0.8); ha.lerp(gray, 0.85);
      cloud = 0.95; over = 1;
    }
    for (const m of [this.skyMat, this.envSkyMat]) {
      const u = m.uniforms;
      u.uZen.value.copy(zen); u.uGlow.value.copy(P.glow).multiplyScalar(rainy ? 0.2 : 1); u.uDisk.value.copy(P.disk);
      u.uCloudLit.value.copy(rainy ? zen.clone().multiplyScalar(1.15) : P.cloudLit); u.uCloudDark.value.copy(rainy ? zen.clone().multiplyScalar(0.7) : P.cloudDark);
      u.uGround.value.copy(P.ground); u.uCloud.value = cloud; u.uNightK.value = night ? 1 : 0; u.uMoon.value = night ? 1 : 0; u.uOvercast.value = over;
    }
    U.uFogSun.value.copy(hs); U.uFogAway.value.copy(ha);
    this.sun.color.set(P.sun);
    this.sun.intensity = P.sunI * (rainy ? 0.22 : 1);
    this.hemi.color.set(P.hemiSky); this.hemi.groundColor.set(P.hemiGround);
    this.hemi.intensity = P.hemiI * (rainy ? 1.2 : 1);
    this.envGround.material.color.set(night ? 0x07080a : 0x3a3836);
    this.envCity.visible = P.night > 0.3;
    this.envCity.children[0].material.color.set(night ? 0xffb070 : 0x885530);
    // ortam haritası (aynı gökyüzü)
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.04, 0.1, 200);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = P.envI * (rainy ? 0.8 : 1);
    // standart sis rengi (yamalanmamış malzemeler için): iki ufuk renginin ortası
    this.fogCol = hs.clone().lerp(ha, 0.6);
    this.scene.fog.color.copy(this.fogCol);
    this.scene.fog.density = P.fogD * (rainy ? 2.6 : 1);
    // deniz
    const wu = this.water.material.uniforms;
    wu.sunDirection.value.copy(this.dir);
    wu.sunColor.value.set(P.sun).multiplyScalar(night ? 0.5 : rainy ? 0.1 : 1.2);
    wu.waterColor.value.set(P.water);
    if (rainy) wu.waterColor.value.multiplyScalar(0.75);
    wu.distortionScale.value = rainy ? 3.0 : 1.6;
    U.uNight.value = P.night;
    U.uWet.value = rainy ? 1 : 0;
    this.rain.visible = rainy;
    this.rain.material.uniforms.uCol.value.set(night ? 0x8090a0 : 0xb0b8c0);
    return P;
  }
  update(cam, focus, t) {
    this.sky.position.copy(cam.position);
    this.skyMat.uniforms.uCenter.value.copy(cam.position);
    this.water.material.uniforms.time.value = t * 0.6;
    // gölge kamerası odak etrafında, texel'e oturtulmuş
    const d = this.dir;
    const upv = Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(upv, d).normalize();
    const v = new THREE.Vector3().crossVectors(d, u);
    const texel = (2 * this.R) / this.sun.shadow.mapSize.x;
    const a = Math.round(focus.dot(u) / texel) * texel, b = Math.round(focus.dot(v) / texel) * texel, c = focus.dot(d);
    const p = u.multiplyScalar(a).add(v.multiplyScalar(b)).add(d.clone().multiplyScalar(c));
    this.sun.target.position.copy(p);
    this.sun.position.copy(p).addScaledVector(d, 700);
    this.sun.target.updateMatrixWorld();
    if (this.rain.visible) this.rain.material.uniforms.uCam.value.copy(cam.position);
  }
}
