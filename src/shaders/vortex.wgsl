// Vortex — a volumetric mandala in the tweet-shader idiom: raymarched fog,
// cosine turbulence folds, exponential glow accumulation, tanh tonemap.
// The screen is kaleido-folded before the ray is cast, so the smoke itself
// becomes the mandala. mouse.x sets the fold count, mouse.y the twist.

import { rot2, kaleido, unfold, hsv } from "./lib/mandala.wgsl";

struct U {
  mouse: vec2f,
  time: f32,
  aspect: f32,
}

@group(0) @binding(0) var<uniform> u: U;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var s2 = (uv - 0.5) * 2.0;
  s2.x = s2.x * u.aspect;
  let folds = 6.0 + 2.0 * floor(u.mouse.x * 5.0);
  s2 = unfold(kaleido(s2, folds));

  let dir = normalize(vec3f(s2, 1.1));
  var o = vec3f(0.0);
  var z = 0.05;

  for (var i = 0; i < 90; i++) {
    var q = dir * z;
    q.z = q.z + u.time * 1.6;
    let twist = rot2(q.z * (0.12 + u.mouse.y * 0.25));
    q = vec3f(twist * q.xy, q.z);

    var s = 1.0;
    for (var k = 0; k < 5; k++) {
      q = q + (abs(cos(q.yzx * s)) - 0.68) / s;
      s = s * 2.0;
    }

    let d = 0.006 + abs(length(q.xy) - 1.5) * 0.28;
    z = z + d;
    o = o + hsv(0.55 + sin(q.z * 0.3) * 0.15, 0.65, 0.9) * exp(-z * 0.45) * min(0.010 / d, 1.0);
  }

  o = tanh(o * 0.35);
  return vec4f(o, 1.0);
}
