// Bloom — a breathing kaleidoscope. Layered sine interference folded into
// n mirrored petals; mouse.x sets the petal count, mouse.y shifts the hue.

import { rot2, kaleido, unfold, spectrum, glowPoint } from "./lib/mandala.wgsl";

struct U {
  mouse: vec2f,
  time: f32,
  aspect: f32,
}

@group(0) @binding(0) var<uniform> u: U;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var p = (uv - 0.5) * 2.0;
  p.x = p.x * u.aspect;

  let breath = 0.85 + 0.22 * sin(u.time * 0.4);
  p = rot2(u.time * 0.06) * (p * breath);

  let petals = 6.0 + 2.0 * floor(u.mouse.x * 8.0);
  let ra = kaleido(p, petals);
  var q = unfold(ra);

  var v = 0.0;
  var amp = 0.9;
  for (var i = 0; i < 5; i++) {
    let fi = f32(i);
    q = rot2(0.7 + fi * 0.3) * q;
    q = q + 0.12 * vec2f(sin(u.time * 0.33 + q.y * 6.0), cos(u.time * 0.29 + q.x * 6.0));
    let freq = 9.0 + fi * 5.0;
    v = v + amp * sin(q.x * freq + u.time * 0.6) * sin(q.y * freq - u.time * 0.5);
    amp = amp * 0.62;
  }

  let t = v * 0.32 + ra.x * 1.1 - u.time * 0.07 + u.mouse.y * 0.6;
  var col = spectrum(t);
  // Crisp filigree: ridge lines carved out of the interference field.
  let ridge = pow(0.5 + 0.5 * sin(v * 6.0 + u.time * 0.8), 3.0);
  let lace = smoothstep(0.10, 0.0, abs(fract(v * 1.5 + ra.x * 3.0) - 0.5));
  col = col * (0.18 + 1.5 * ridge + 0.5 * lace);
  col = col + spectrum(t + 0.5) * lace * 0.35;
  col = col + vec3f(1.0, 0.9, 0.7) * glowPoint(ra.x, 0.03) * 0.6;
  col = col * smoothstep(1.9, 0.5, ra.x);

  return vec4f(col, 1.0);
}
