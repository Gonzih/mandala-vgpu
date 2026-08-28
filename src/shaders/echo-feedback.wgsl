// Echo (accumulation pass) — samples the previous frame through a slow
// rotate + zoom, decays it, and injects new light at the cursor folded
// through 8-way symmetry. Trails become mandalas; you play it like an
// instrument. u.mouse arrives already mapped to target space ([-1, 1]²).

import { rot2, kaleido, unfold, spectrum, glowPoint, softRing } from "./lib/mandala.wgsl";

struct U {
  mouse: vec2f,
  time: f32,
  energy: f32,
}

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var prev: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var p = (uv - 0.5) * 2.0;

  let swirl = 0.0035 + 0.0025 * sin(u.time * 0.11);
  let sampled = rot2(swirl) * (p * 0.9975);
  let suv = sampled * 0.5 + 0.5;
  var acc = textureSampleLevel(prev, samp, suv, 0.0).rgb * 0.972;

  let folds = 8.0;
  let pw = unfold(kaleido(p, folds));
  let mw = unfold(kaleido(u.mouse, folds));

  let d = distance(pw, mw);
  let ink = glowPoint(d, 0.00015) * u.energy;
  acc = acc + spectrum(u.time * 0.31 + length(u.mouse) * 0.8) * ink * 0.35;

  // Faint ambient pulse so the mandala breathes even before you touch it.
  let pulse = softRing(length(p), 0.55 + 0.2 * sin(u.time * 0.3), 0.06);
  acc = acc + spectrum(u.time * 0.05 + 0.5) * pulse * 0.006;

  return vec4f(acc, 1.0);
}
