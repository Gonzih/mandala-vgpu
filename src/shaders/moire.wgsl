// Temple — flower-of-life interference. Two counter-rotating hexagonal rings
// of wave sources; their sum produces breathing moiré mandalas.
// mouse.x sets carrier frequency, mouse.y detunes the second ring.

import { TAU, rot2, spectrum } from "./lib/mandala.wgsl";

struct U {
  mouse: vec2f,
  time: f32,
  aspect: f32,
}

@group(0) @binding(0) var<uniform> u: U;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var p = (uv - 0.5) * 2.0;
  p.x = p.x * u.aspect;
  p = rot2(u.time * 0.03) * p;

  let freq = 16.0 + u.mouse.x * 28.0;
  let detune = 1.0 + u.mouse.y * 0.07;
  let radiusA = 0.45 + 0.2 * sin(u.time * 0.17);
  let radiusB = radiusA * 1.7;

  var field = cos(length(p) * freq - u.time * 1.5);
  for (var i = 0; i < 6; i++) {
    let angA = f32(i) * TAU / 6.0 + u.time * 0.07;
    let cA = vec2f(cos(angA), sin(angA)) * radiusA;
    field = field + cos(distance(p, cA) * freq - u.time * 1.5);

    let angB = f32(i) * TAU / 6.0 - u.time * 0.05 + 0.5;
    let cB = vec2f(cos(angB), sin(angB)) * radiusB;
    field = field + cos(distance(p, cB) * freq * detune + u.time * 1.1);
  }
  field = field / 7.0;

  let ridges = pow(clamp(field * 0.85 + 0.35, 0.0, 1.0), 3.0);
  var col = spectrum(field * 0.5 + length(p) * 0.35 - u.time * 0.05);
  col = col * (0.08 + ridges * 2.6);
  col = col + vec3f(0.9, 0.95, 1.0) * pow(clamp(field * 0.75, 0.0, 1.0), 7.0) * 1.4;

  col = col * smoothstep(2.1, 0.8, length(p));

  return vec4f(col, 1.0);
}
