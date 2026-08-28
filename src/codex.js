// The Codex — a seeded generator of volumetric mandala shaders.
//
// Each seed births a complete WGSL raymarcher in the tweet-shader idiom
// (turbulence folds, exp-glow accumulation, tanh tonemap), with its
// structure drawn from sacred geometry: fold symmetries from the sacred
// counts, twist and turbulence constants from φ and √3, three archetypes —
// smoke (turbulent tube), lattice (repeating cell grid), weave (log-spherical
// interference shells). Plain JS so both the Vite app and the Node snapshot
// script can use it. effect(gpu, wgsl) takes the string directly — shaders
// are born at runtime, no bundler involved.

const PHI = 1.6180339887;
const SQRT3 = 1.7320508;

// Sacred symmetry counts; 0 = free rotation, no fold.
const FOLDS = [0, 3, 5, 6, 7, 8, 9, 12];

const PREFIXES = ["Vajra", "Padma", "Akasha", "Ananta", "Surya", "Chandra", "Bindu", "Karuna", "Meru", "Nada", "Indra", "Kali"];
const SUFFIXES = ["Wheel", "Gate", "Veil", "Bloom", "Storm", "Field", "Mirror", "Chakra", "Halo", "Root"];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (x) => x.toFixed(4);

// WGSL prelude baked into every generated shader (no imports at runtime).
const PRELUDE = /* wgsl */ `
const TAU: f32 = 6.2831853071795864;

fn rot2(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

fn kaleido(p: vec2f, n: f32) -> vec2f {
  let r = length(p);
  var a = atan2(p.y, p.x);
  let slice = TAU / n;
  a = a - slice * floor(a / slice);
  a = abs(a - slice * 0.5);
  return vec2f(r, a);
}

fn unfold(ra: vec2f) -> vec2f {
  return vec2f(cos(ra.y), sin(ra.y)) * ra.x;
}

fn hsv(h: f32, s: f32, v: f32) -> vec3f {
  let k = abs(fract(vec3f(h) + vec3f(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return v * mix(vec3f(1.0), clamp(k - 1.0, vec3f(0.0), vec3f(1.0)), s);
}

struct U {
  mouse: vec2f,
  time: f32,
  aspect: f32,
}

@group(0) @binding(0) var<uniform> u: U;
`;

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

// Distance-field expression per archetype, in terms of warped sample `q`.
function smokeField(rng) {
  const tubeR = range(rng, 1.0, 2.2);
  const sharp = range(rng, 0.2, 0.4);
  return {
    warp: `
    var s = 1.0;
    for (var k = 0; k < ${pick(rng, [4, 5, 6])}; k++) {
      q = q + (abs(cos(q.yzx * s)) - ${f(range(rng, 0.55, 0.78))}) / s;
      s = s * 2.0;
    }`,
    dist: `0.006 + abs(length(q.xy) - ${f(tubeR)}) * ${f(sharp)}`,
    hue: `sin(q.z * ${f(range(rng, 0.2, 0.45))})`,
  };
}

function latticeField(rng) {
  const cell = range(rng, 0.8, 1.6);
  const nodeR = range(rng, 0.18, 0.34);
  return {
    warp: `
    var s = 1.0;
    for (var k = 0; k < 3; k++) {
      q = q + (abs(cos(q.zxy * s)) - ${f(range(rng, 0.6, 0.75))}) / (s * 2.0);
      s = s * 2.0;
    }
    q = q - round(q / ${f(cell)}) * ${f(cell)};`,
    dist: `0.012 + abs(length(q.xy) - ${f(nodeR)}) * ${f(range(rng, 0.35, 0.55))}`,
    hue: `sin(q.x + q.y)`,
    gainScale: 0.3,
  };
}

function shellField(rng) {
  const tubeR = range(rng, 0.9, 1.7);
  const arms = pick(rng, [3, 5, 6, 8]);
  return {
    warp: `
    var s = 1.0;
    for (var k = 0; k < 4; k++) {
      q = q + (abs(cos(q.yzx * s)) - ${f(range(rng, 0.6, 0.75))}) / (s * ${f(range(rng, 1.5, 2.5))});
      s = s * 2.0;
    }`,
    dist: `0.006 + abs(length(q.xy) - ${f(tubeR)} + sin(atan2(q.y, q.x) * ${f(arms)} + q.z * ${f(range(rng, 0.5, 1.2))}) * ${f(range(rng, 0.2, 0.45))}) * ${f(range(rng, 0.22, 0.35))}`,
    hue: `sin(q.z * ${f(range(rng, 0.2, 0.4))} + length(q.xy))`,
  };
}

const ARCHETYPES = [
  { key: "smoke", build: smokeField },
  { key: "lattice", build: latticeField },
  { key: "shell", build: shellField },
];

export function buildCodex(seed) {
  const rng = mulberry32(seed);
  const arche = pick(rng, ARCHETYPES);
  const field = arche.build(rng);

  const folds = pick(rng, FOLDS);
  const twist = range(rng, 0.06, 0.3) * (rng() < 0.5 ? 1 : -1);
  const speed = range(rng, 0.8, 2.4);
  const hueBase = rng();
  const hueAmp = range(rng, 0.08, 0.25);
  const sat = range(rng, 0.45, 0.85);
  const falloff = range(rng, 0.35, 0.6);
  const gain = range(rng, 0.004, 0.008) * (field.gainScale ?? 1.0);
  const exposure = range(rng, 0.28, 0.5);
  const fov = range(rng, 0.9, 1.4);
  const drift = range(rng, 0.02, PHI * 0.06);

  const foldExpr =
    folds === 0
      ? `s2 = rot2(u.time * ${f(drift)}) * s2;`
      : `s2 = unfold(kaleido(rot2(u.time * ${f(drift)}) * s2, ${f(folds)} + 2.0 * floor(u.mouse.x * 3.0)));`;

  const name = `${pick(rng, PREFIXES)} ${pick(rng, SUFFIXES)}`;

  const wgsl = `${PRELUDE}
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var s2 = (uv - 0.5) * 2.0;
  s2.x = s2.x * u.aspect;
  ${foldExpr}

  let dir = normalize(vec3f(s2, ${f(fov)}));
  var o = vec3f(0.0);
  var z = 0.05;

  for (var i = 0; i < 90; i++) {
    var q = dir * z;
    q.z = q.z + u.time * ${f(speed)};
    let tw = rot2(q.z * (${f(twist)} + (u.mouse.y - 0.5) * 0.2));
    q = vec3f(tw * q.xy, q.z);
    ${field.warp}

    let d = ${field.dist};
    z = z + d;
    o = o + hsv(${f(hueBase)} + (${field.hue}) * ${f(hueAmp)}, ${f(sat)}, 0.9)
          * exp(-z * ${f(falloff)}) * min(${f(gain)} / d, 1.0);
  }

  o = tanh(o * ${f(exposure)});
  return vec4f(o, 1.0);
}
`;

  return { wgsl, name, seed, archetype: arche.key, folds };
}
