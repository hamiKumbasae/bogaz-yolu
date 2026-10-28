// Ortak shader parçaları ve malzeme yamaları
import * as THREE from 'three';

// Tüm şehir malzemelerinin paylaştığı değerler
export const U = {
  uNight: { value: 0 },   // 0 gündüz … 1 gece (pencere ışıkları)
  uTime: { value: 0 },
  uWet: { value: 0 },     // yağmur ıslaklığı
  uCover: { value: null }, // OSM kapsama dokusu (şehir dokusu deseni için)
  uCoverBox: { value: new THREE.Vector4(0, 0, 1, 1) },
  uSea: { value: -2 },
  uFogSun: { value: new THREE.Color(0.8, 0.6, 0.5) },   // güneş yönündeki ufuk/sis rengi
  uFogAway: { value: new THREE.Color(0.5, 0.5, 0.6) },  // karşı yöndeki
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
};

// yön bağımlı sis: gökyüzünün ufuk rengiyle birebir aynı
export const FOG_DIR = /* glsl */`
#ifdef USE_FOG
{
  vec3 fdir = normalize(vWP - cameraPosition);
  vec2 sh = normalize(uSunDir.xz + vec2(1e-5));
  float sdh = dot(normalize(fdir.xz + vec2(1e-5)), sh) * 0.5 + 0.5;
  vec3 fcol = mix(uFogAway, uFogSun, pow(sdh, 3.0));
  float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, fogF);
}
#endif
`;

export const GLSL_COMMON = /* glsl */`
uniform float uNight;
uniform float uTime;
uniform float uWet;
uniform vec3 uFogSun; uniform vec3 uFogAway; uniform vec3 uSunDir;
varying vec3 vWP;
varying vec3 vWN;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = hash12(i), b = hash12(i + vec2(1., 0.)), c = hash12(i + vec2(0., 1.)), d = hash12(i + vec2(1., 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float fbm2(vec2 p){ return vnoise(p) * .5 + vnoise(p * 2.03 + 7.1) * .25 + vnoise(p * 4.07 + 3.3) * .125 + vnoise(p * 8.1 + 1.7) * .0625; }
float boxf(float x, float a, float b, float w){ float f = fract(x); return smoothstep(a - w, a + w, f) - smoothstep(b - w, b + w, f); }
`;

const VERT_WORLD = /* glsl */`
{
  vec4 wp4 = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
    wn = mat3(instanceMatrix) * wn;
  #endif
  vWP = (modelMatrix * wp4).xyz;
  vWN = normalize(mat3(modelMatrix) * wn);
}
`;

// MeshStandardMaterial'a kanca ekler
export function patch(mat, key, o = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uNight: U.uNight, uTime: U.uTime, uWet: U.uWet, uFogSun: U.uFogSun, uFogAway: U.uFogAway, uSunDir: U.uSunDir }, o.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMMON + (o.vdecl || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.vpre || '') + VERT_WORLD + (o.vmain || ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMMON + (o.fdecl || ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.color || ''))
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + (o.rough || ''))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (o.normal || ''))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (o.emissive || ''))
      .replace('#include <fog_fragment>', FOG_DIR);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// ---------------------------------------------------------------- bina cepheleri
const FACADE_VDECL = /* glsl */`
varying vec4 vB; varying vec2 vF;
#ifdef FILLER
  attribute vec4 iB;
#else
  attribute vec4 aB; attribute vec2 aF;
#endif
`;
const FACADE_VMAIN = /* glsl */`
#ifdef FILLER
{
  float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz), sz = length(instanceMatrix[2].xyz);
  float u = abs(normal.x) > 0.5 ? (position.z + 0.5) * sz : (position.x + 0.5) * sx;
  vF = vec2(u + iB.y * 40.0, position.y * sy);
  vB = vec4(iB.x, iB.y, normal.y > 0.5 ? 1.0 : 0.0, sy);
}
#else
  vF = aF; vB = aB;
#endif
`;

const FACADE_FDECL = /* glsl */`
varying vec4 vB; varying vec2 vF;
struct Fac { float win; vec3 lit; float shade; float frame; float rail; float slab; float shop; float shut; };
Fac facade(){
  Fac r; r.win = 0.; r.lit = vec3(0.); r.shade = 1.; r.frame = 0.; r.rail = 0.; r.slab = 0.; r.shop = 0.; r.shut = 0.;
  float st = vB.x, seed = vB.y, H = vB.w;
  float u = vF.x, v = vF.y;
  float fh = 3.1, cw = 3.0, wx = 0.27, wy0 = 0.30, wy1 = 0.84, gh = 4.2, litP = 0.34, balc = 0.55;
  if (st > 0.5 && st < 1.5) { fh = 3.8; cw = 1.6; wx = 0.05; wy0 = 0.07; wy1 = 0.95; gh = 4.6; litP = 0.5; balc = 0.0; }
  else if (st > 1.5 && st < 2.5) { fh = 4.6; cw = 3.4; wx = 0.31; wy0 = 0.26; wy1 = 0.78; gh = 0.0; litP = 0.22; balc = 0.0; }
  else if (st > 2.5 && st < 3.5) { fh = 3.0; cw = 2.4; wx = 0.29; wy0 = 0.28; wy1 = 0.80; gh = 0.0; litP = 0.42; balc = 0.0; }
  else if (st > 3.5 && st < 4.5) { fh = 5.4; cw = 2.9; wx = 0.30; wy0 = 0.20; wy1 = 0.86; gh = 0.0; litP = 0.30; balc = 0.0; }
  else if (st > 4.5) { fh = 5.0; cw = 7.0; wx = 0.12; wy0 = 0.55; wy1 = 0.86; gh = 0.0; litP = 0.18; balc = 0.0; }
  cw *= 0.85 + 0.3 * fract(seed * 7.31);
  if (H < 7.5) gh = 0.0;
  float top = H - (st > 0.5 && st < 1.5 ? 0.5 : 1.0);
  if (v < 0.25 || v > top) return r;
  if (v < gh) {
    float sw = 4.2 * (0.85 + 0.3 * fract(seed * 3.7));
    float x = u / sw; float w = min(fwidth(x) * 1.2, 0.3);
    float m = boxf(x, 0.06, 0.94, w) * smoothstep(0.30, 0.42, v) * (1.0 - smoothstep(gh - 1.15, gh - 1.05, v));
    float h = hash12(vec2(floor(x), seed * 91.));
    r.win = m * 0.95; r.shop = 1.0;
    vec3 c = mix(vec3(1.0, 0.74, 0.46), vec3(0.88, 0.95, 1.0), step(0.62, h));
    r.lit = m * c * (h < 0.86 ? 1.1 : 0.0);
    float band = smoothstep(gh - 1.0, gh - 0.95, v) * (1.0 - smoothstep(gh - 0.3, gh - 0.25, v));
    r.shade = 1.0 - band * 0.25;
    r.frame = band * boxf(x, 0.12, 0.88, w) * 0.0;
    r.lit += band * boxf(x, 0.12, 0.88, w) * step(0.5, h) * mix(vec3(1.0, 0.18, 0.12), vec3(0.15, 0.55, 1.0), step(0.5, fract(h * 7.))) * 1.8;
    return r;
  }
  float vv = (v - gh) / fh;
  float fi = floor(vv);
  float x = u / cw;
  float wu = fwidth(x), wv = fwidth(vv);
  float fw = min(wu, 0.25), fv2 = min(wv, 0.25);
  float m = boxf(x, wx, 1.0 - wx, fw) * boxf(vv, wy0, wy1, fv2);
  float fr = boxf(x, wx - 0.05, 1.0 - wx + 0.05, fw) * boxf(vv, wy0 - 0.06, wy1 + 0.03, fv2);
  float far = smoothstep(0.12, 0.4, max(wu, wv));
  float cover = (1.0 - 2.0 * wx) * (wy1 - wy0);
  float id = hash13(vec3(floor(x), fi, seed * 37.));
  // balkon: sütun gruplarında, zemin katın üstünde
  float hasB = step(1.0 - balc, hash12(vec2(floor(x * 0.5), seed * 13.))) * step(0.5, fi + 0.1);
  float fv = fract(vv);
  float slab = hasB * boxf(x, 0.02, 0.98, fw) * (1.0 - smoothstep(0.065 - fv2, 0.065 + fv2, fv));
  float railZone = hasB * boxf(x, 0.03, 0.97, fw) * smoothstep(0.065 - fv2, 0.065 + fv2, fv) * (1.0 - smoothstep(0.36 - fv2, 0.36 + fv2, fv));
  float bars = boxf(u * 7.0, 0.0, 0.35, min(fwidth(u * 7.0), 0.3));
  float rail = railZone * mix(max(bars, 1.0 - smoothstep(0.30, 0.33, fv)), 0.55, far);
  // ahşap ev pancurları
  float shut = 0.0;
  if (st > 2.5 && st < 3.5) shut = (boxf(x, wx - 0.17, wx - 0.01, fw) + boxf(x, 1.0 - wx + 0.01, 1.0 - wx + 0.17, fw)) * boxf(vv, wy0, wy1, fv2) * step(0.35, id);
  r.win = mix(m, cover, far);
  r.frame = mix(max(fr - m, 0.0), 0.0, far);
  r.slab = mix(slab, hasB * 0.07, far);
  r.rail = mix(rail, hasB * 0.15, far);
  r.shut = mix(shut, 0.0, far);
  float lit = step(1.0 - litP, id);
  vec3 lc = mix(vec3(1.0, 0.70, 0.40), vec3(1.0, 0.88, 0.70), fract(id * 13.));
  lc = mix(lc, vec3(0.72, 0.84, 1.0), step(0.86, fract(id * 29.)));
  r.lit = r.win * lit * lc * (0.7 + 1.3 * fract(id * 53.));
  r.shade = 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.07, fv)) + 0.05 * step(0.5, fract(seed * 5.)) * (smoothstep(0.9, 0.93, fv));
  return r;
}
`;

const FACADE_COLOR = /* glsl */`
Fac fc; fc.win = 0.; fc.lit = vec3(0.); fc.shade = 1.; fc.frame = 0.; fc.rail = 0.; fc.slab = 0.; fc.shop = 0.; fc.shut = 0.;
if (vB.z < 0.5) {
  fc = facade();
  vec3 wallC = diffuseColor.rgb * fc.shade;
  wallC *= mix(0.70, 1.0, smoothstep(0.0, 3.5, vF.y)) * (0.88 + 0.24 * vnoise(vec2(vF.x * 0.3, vF.y * 0.07) + vB.y * 13.));
  wallC = mix(wallC, vec3(0.80, 0.78, 0.74), fc.frame * 0.85);
  wallC = mix(wallC, vec3(0.62, 0.60, 0.57), fc.slab);
  wallC = mix(wallC, mix(vec3(0.42, 0.24, 0.14), vec3(0.18, 0.34, 0.26), step(0.5, fract(vB.y * 23.))), fc.shut);
  vec3 glass = mix(vec3(0.05, 0.06, 0.07), vec3(0.11, 0.12, 0.13), fract(vB.y * 17.));
  if (vB.x > 0.5 && vB.x < 1.5) glass = mix(vec3(0.07, 0.11, 0.14), vec3(0.11, 0.13, 0.11), fract(vB.y * 11.));
  if (fc.shop > 0.5) glass = vec3(0.10, 0.09, 0.08);
  diffuseColor.rgb = mix(wallC, glass, fc.win);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.065, 0.07), fc.rail);
} else {
  float n = vnoise(vWP.xz * 0.6) * 0.5 + vnoise(vWP.xz * 3.1) * 0.5;
  diffuseColor.rgb *= 0.78 + 0.36 * n;
  if (vB.z > 1.5) diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.3, 0.7, fract(vWP.y * 3.0 + n * 0.3));
}
diffuseColor.rgb *= 1.0 - 0.28 * uWet;
`;

const FACADE_ROUGH = /* glsl */`
roughnessFactor = mix(roughnessFactor, fc.shop > 0.5 ? 0.32 : 0.12, fc.win);
metalnessFactor = mix(metalnessFactor, fc.shop > 0.5 ? 0.15 : 0.5, fc.win);
metalnessFactor = mix(metalnessFactor, 0.6, fc.rail);
roughnessFactor *= 1.0 - 0.35 * uWet;
`;

const FACADE_EMISSIVE = /* glsl */`
totalEmissiveRadiance += fc.lit * uNight * uNight * 1.25;
`;

export function facadeMaterial(filler = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: !filler, roughness: 0.86, metalness: 0.0 });
  if (filler) m.defines = { FILLER: 1 };
  return patch(m, filler ? 'facade-filler' : 'facade', {
    vdecl: FACADE_VDECL, vmain: FACADE_VMAIN, fdecl: FACADE_FDECL, color: FACADE_COLOR, rough: FACADE_ROUGH, emissive: FACADE_EMISSIVE,
  });
}

// ---------------------------------------------------------------- arazi
export function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  return patch(m, 'terrain', {
    uniforms: { uCover: U.uCover, uCoverBox: U.uCoverBox, uSea: U.uSea },
    fdecl: /* glsl */`
      uniform sampler2D uCover; uniform vec4 uCoverBox; uniform float uSea;
      float cityW; vec3 cityLit;
    `,
    color: /* glsl */`
      {
        vec2 p = vWP.xz; float h = vWP.y;
        float n1 = vnoise(p * 0.0035), n2 = vnoise(p * 0.03), n3 = vnoise(p * 0.21);
        vec3 ground = mix(vec3(0.30, 0.28, 0.25), vec3(0.40, 0.37, 0.32), n2) * (0.86 + 0.28 * n3);
        vec3 green = mix(vec3(0.10, 0.15, 0.07), vec3(0.19, 0.25, 0.11), n2) * (0.8 + 0.4 * n3);
        float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
        float veg = smoothstep(0.50, 0.78, n1 * 0.9 + slope * 1.4 + n2 * 0.15);
        vec3 c = mix(ground, green, veg);
        // şehir dokusu: OSM verisi olmayan tepelerde çatı deseni
        vec2 cuv = (p - uCoverBox.xy) / (uCoverBox.zw - uCoverBox.xy);
        float cov = texture2D(uCover, cuv).r;
        cityW = (1.0 - cov) * smoothstep(0.8, 3.0, h) * (1.0 - smoothstep(0.35, 0.6, slope)) * (1.0 - veg * 0.7) * smoothstep(250.0, 900.0, length(vWP - cameraPosition));
        vec2 q = p / 26.0; vec2 cid = floor(q); vec2 f = fract(q);
        float hb = hash12(cid);
        float wq = max(fwidth(q.x), fwidth(q.y));
        float street = 1.0 - (smoothstep(0.07 - wq, 0.07 + wq, f.x) * smoothstep(0.07 - wq, 0.07 + wq, f.y));
        street = mix(street, 0.14, smoothstep(0.15, 0.5, wq));
        vec3 roof = hb < 0.45 ? vec3(0.42, 0.20, 0.13) : (hb < 0.8 ? vec3(0.50, 0.49, 0.47) : vec3(0.62, 0.60, 0.56));
        roof *= 0.75 + 0.4 * hash12(cid + 3.1);
        vec3 city = mix(roof, vec3(0.16, 0.16, 0.17), street);
        c = mix(c, city, cityW);
        float lights = step(0.55, hash12(floor(p / 6.0))) * (1.0 - street);
        cityLit = cityW * (street * vec3(1.0, 0.55, 0.22) * 0.55 + lights * vec3(1.0, 0.78, 0.5) * 0.35 * step(0.5, hash12(floor(p / 6.0) + 9.0)));
        // kıyı: taş ve kum, su altı koyu
        float rock = 1.0 - smoothstep(-0.35, 0.25, h);
        c = mix(c, vec3(0.34, 0.31, 0.27) * (0.75 + 0.5 * n3), rock);
        c = mix(c, vec3(0.10, 0.13, 0.12), 1.0 - smoothstep(uSea - 2.5, uSea - 0.5, h));
        diffuseColor.rgb = c * (1.0 - 0.3 * uWet);
      }
    `,
    rough: 'roughnessFactor *= 1.0 - 0.4 * uWet;',
    emissive: 'totalEmissiveRadiance += cityLit * uNight * uNight * 1.6;',
  });
}

// ---------------------------------------------------------------- asfalt
export function asphaltMaterial(t) {
  const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.93, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return patch(m, 'asphalt', {
    fdecl: 'float puddle;',
    color: /* glsl */`
      {
        float big = vnoise(vWP.xz * 0.018) * 0.6 + vnoise(vWP.xz * 0.11) * 0.4;
        diffuseColor.rgb *= 0.78 + 0.42 * big;
        puddle = smoothstep(0.58, 0.72, vnoise(vWP.xz * 0.09 + 3.0) * 0.7 + vnoise(vWP.xz * 0.5) * 0.3) * uWet;
        diffuseColor.rgb *= 1.0 - 0.45 * uWet;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02), puddle * 0.7);
      }
    `,
    rough: 'roughnessFactor = mix(roughnessFactor, 0.28, uWet); roughnessFactor = mix(roughnessFactor, 0.03, puddle);',
    normal: 'normal = normalize(mix(normal, normalize(vNormal), puddle));',
  });
}

// Taş, parke, çim gibi düz yüzeyler için ıslaklık yaması
export function wetMaterial(params, key) {
  const m = new THREE.MeshStandardMaterial(params);
  return patch(m, key, {
    color: 'diffuseColor.rgb *= 1.0 - 0.32 * uWet;',
    rough: 'roughnessFactor *= 1.0 - 0.45 * uWet;',
  });
}

// Gece ışıl ışıl aydınlatılan anıt taşı (camiler, kuleler)
export function monumentMaterial(params, key, glow = 0.35, glowCol = [1.0, 0.82, 0.6]) {
  const m = new THREE.MeshStandardMaterial(params);
  return patch(m, key, {
    color: 'diffuseColor.rgb *= 1.0 - 0.2 * uWet;',
    emissive: `totalEmissiveRadiance += diffuseColor.rgb * vec3(${glowCol.map((x) => x.toFixed(3)).join(',')}) * uNight * ${glow.toFixed(3)} * (0.55 + 0.45 * smoothstep(-0.2, 0.9, vWN.y + 0.4));`,
  });
}

// yalnızca geceleri yanan ışık (lamba başı, minare kandili)
export function nightLightMaterial(color, strength = 3, day = 0.0) {
  const m = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, emissive: new THREE.Color(color) });
  return patch(m, 'nightlight-' + strength + '-' + day + '-' + color, {
    emissive: `totalEmissiveRadiance = emissive * (${day.toFixed(3)} + uNight * ${strength.toFixed(3)});`,
  });
}
