// Depths — an infinite yantra tunnel. Log-polar space scrolls toward the
// viewer; a lattice of rings, spokes and nodes glows along the walls.
// mouse.x sets the wedge count, mouse.y the fall speed.

import { TAU, kaleido, spectrum, glowPoint } from "./lib/mandala.wgsl";

struct U {
  mouse: vec2f,
  time: f32,
  aspect: f32,
}

@group(0) @binding(0) var<uniform> u: U;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var p = (uv - 0.5) * 2.0;
  p.x = p.x * u.aspect;

  let wedges = 8.0 + 2.0 * floor(u.mouse.x * 6.0);
  let slice = TAU / wedges;

  let r = length(p) + 1e-4;
  var a = atan2(p.y, p.x) + u.time * 0.1;
  a = a - slice * floor(a / slice);
  a = abs(a - slice * 0.5);

  let depth = log(r) * 1.4 - u.time * (0.4 + u.mouse.y * 0.9);
  let cell = vec2f(fract(depth) - 0.5, a / slice - 0.25);

  let ring = smoothstep(0.035, 0.0, abs(abs(cell.x) - 0.32));
  let spoke = smoothstep(0.035, 0.0, abs(abs(cell.y) - 0.16));
  let node = glowPoint(length(cell), 0.012);

  var brightness = ring * 0.9 + spoke * 0.55 + node * 0.5;

  let band = floor(depth);
  var col = spectrum(band * 0.13 + u.time * 0.04) * brightness;
  col = col + spectrum(depth * 0.1 + 0.4) * 0.05 / (abs(cell.x) + 0.09);

  col = col * smoothstep(0.0, 0.32, r);
  col = col * (1.0 - 0.35 * smoothstep(1.1, 1.9, r));

  return vec4f(col, 1.0);
}
