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
  uFac: { value: null },   // cephe modülleri doku dizisi
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
// ---------------------------------------------------------------- bina cepheleri (doku dizisinden modüller)
const FACADE_VDECL = /* glsl */`
varying vec2 vF; varying vec4 vB; varying vec4 vW; varying vec4 vL; varying vec4 vS;
#ifdef FILLER
  attribute vec4 iB;
#else
  attribute vec2 aF; attribute vec4 aB; attribute vec4 aW; attribute vec4 aL; attribute vec4 aS;
#endif
`;
const FACADE_VMAIN = /* glsl */`
#ifdef FILLER
{
  float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz), sz = length(instanceMatrix[2].xyz);
  float u = abs(normal.x) > 0.5 ? (position.z + 0.5) * sz : (position.x + 0.5) * sx;
  float wl = abs(normal.x) > 0.5 ? sz : sx;
  float sd = iB.y;
  vF = vec2(u, position.y * sy - 2.0);
  vB = vec4(sd, normal.y > 0.5 ? 1.0 : 0.0, sy - 2.0, 0.38);
  float mw = wl / max(1.0, floor(wl / 3.0 + 0.5));
  vW = vec4(0.0, 0.0, mw, 3.0 + fract(sd * 13.0) * 0.3);
  if (iB.x > 0.5) vL = vec4(6.0, 13.0, 13.0, 0.0);
  else vL = vec4(fract(sd * 7.0) < 0.3 ? 2.0 : (fract(sd * 3.0) < 0.5 ? 0.0 : 6.0), fract(sd * 5.0) < 0.5 ? 8.0 : 10.0, 9.0, 0.0);
  vS = vec4(0.0);
}
#else
  vF = aF; vB = aB; vW = aW; vL = aL; vS = aS;
#endif
`;

const FACADE_FDECL = /* glsl */`
uniform sampler2DArray uFac;
varying vec2 vF; varying vec4 vB; varying vec4 vW; varying vec4 vL; varying vec4 vS;
vec4 facTex(vec2 cont, float layer) {
  vec2 f = fract(cont);
  return textureGrad(uFac, vec3(f.x, 1.0 - f.y, layer), dFdx(cont), dFdy(cont));
}
`;

const FACADE_COLOR = /* glsl */`
float fGlass = 0.0, fOpaque = 0.0, fLit = 0.0, fShop = 0.0;
vec3 fRGB = vec3(0.0);
if (vB.y < 0.5 || vB.y > 2.5) {
  float seed = vB.x, H = vB.z;
  float street = vW.x, gh = vW.y, modW = vW.z, fh = vW.w;
  float u = vF.x, v = vF.y;
  vec3 wallT = facTex(vec2(u, v) * 0.5, vL.x).rgb;
  vec3 wall = diffuseColor.rgb * wallT * 1.15;
  float gr = vnoise(vec2(u * 0.8 + seed * 40.0, v * 0.11)) * 0.6 + vnoise(vec2(u * 0.13, v * 0.09) + seed * 9.0) * 0.4;
  wall *= 0.86 + 0.2 * gr;
  wall *= mix(0.68, 1.0, smoothstep(0.0, 2.6, v));
  vec4 m = vec4(0.0);
  float top = H - 0.95;
  if (vB.y < 0.5 && v > 0.05 && v < top) {
    if (v < gh) {
      if (street > 0.5) {
        vec2 c = vec2(u / vS.w, v / gh);
        float bay = floor(c.x);
        float h = hash12(vec2(bay, seed * 71.0));
        float layer = abs(bay - vS.z) < 0.5 ? 20.0 : (h < 0.3 ? vS.y : vS.x);
        m = facTex(vec2(c.x, min(c.y, 0.999)), layer);
        fShop = 1.0;
        fLit = step(0.22, hash12(vec2(bay, seed * 13.0))) * (layer > 18.5 && layer < 19.5 ? 0.0 : 1.0);
      } else {
        vec2 c = vec2(u / modW, v / gh);
        float ci = floor(c.x);
        if (hash12(vec2(ci, seed * 5.0)) > 0.35) m = facTex(vec2(c.x, min(c.y, 0.999)), vL.y);
        fLit = step(0.6, hash12(vec2(ci, seed * 3.0)));
      }
    } else {
      float vv = (v - gh) / fh;
      float fi = floor(vv);
      vec2 c = vec2(u / modW, vv);
      float ci = floor(c.x);
      float h1 = hash13(vec3(ci, fi, seed * 37.0));
      float bp = floor(vL.w), bo = floor(fract(vL.w) * 10.0 + 0.5);
      bool balc = street > 0.5 && bp > 0.5 && abs(mod(ci, bp) - bo) < 0.5;
      float layer = balc ? 14.0 : (h1 < 0.3 ? vL.z : vL.y);
      bool blank = !balc && hash12(vec2(ci, seed * 91.0)) < (vL.y > 12.5 && vL.y < 13.5 ? 0.0 : 0.07);
      // son kat kesik kalıyorsa pencere koyma
      if (!blank && (fi + 1.0) * fh + gh < top + 0.4) m = facTex(c, layer);
      fLit = step(1.0 - vB.w, h1);
    }
  }
  float a = m.a;
  float wallK = 1.0 - smoothstep(0.08, 0.3, a);
  fGlass = smoothstep(0.3, 0.45, a) * (1.0 - smoothstep(0.62, 0.8, a));
  fOpaque = smoothstep(0.65, 0.9, a);
  fRGB = m.rgb;
  diffuseColor.rgb = wall * wallK + m.rgb * (1.0 - wallK);
} else {
  float n = vnoise(vWP.xz * 0.6) * 0.5 + vnoise(vWP.xz * 3.1) * 0.5;
  diffuseColor.rgb *= 0.78 + 0.36 * n;
  if (vB.y > 1.5) diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.3, 0.7, fract(vWP.y * 3.0 + n * 0.3));
}
diffuseColor.rgb *= 1.0 - 0.25 * uWet;
`;

const FACADE_ROUGH = /* glsl */`
roughnessFactor = mix(roughnessFactor, 0.07, fGlass);
roughnessFactor = mix(roughnessFactor, 0.55, fOpaque);
metalnessFactor = mix(metalnessFactor, 0.5, fGlass);
roughnessFactor *= 1.0 - 0.35 * uWet;
`;

const FACADE_EMISSIVE = /* glsl */`
{
  float hh = hash12(floor(vF * 0.37) + vB.x * 17.0);
  vec3 warm = mix(vec3(1.0, 0.68, 0.38), vec3(0.85, 0.9, 1.0), step(0.85, hh));
  vec3 litC = warm * 0.55 + fRGB * mix(1.6, 2.2, fShop);
  totalEmissiveRadiance += fGlass * fLit * litC * uNight * uNight * 1.3;
}
`;

export function facadeMaterial(filler = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: !filler, roughness: 0.88, metalness: 0.0 });
  if (filler) m.defines = { FILLER: 1 };
  return patch(m, filler ? 'facade2-filler' : 'facade2', {
    uniforms: { uFac: U.uFac },
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
