// Yantra — a Sri Yantra homage. Nine interlocking triangles (four Shiva up,
// five Shakti down) around the bindu, lotus rings of 8 and 16 petals, three
// circles, rotated-square bhupura gates, a faint Flower of Life ground.
// mouse.x rotates the whole instrument, mouse.y raises its energy.

import { TAU, rot2, palette, glowPoint } from "./lib/mandala.wgsl";
import { flowerOfLife, ngon, triGlyph, lotus } from "./lib/sacred.wgsl";

struct U {
  mouse: vec2f,
  time: f32,
  aspect: f32,
}

@group(0) @binding(0) var<uniform> u: U;

fn gold(t: f32) -> vec3f {
  return palette(t, vec3f(0.58, 0.40, 0.30), vec3f(0.45, 0.32, 0.35), vec3f(0.55), vec3f(0.00, 0.10, 0.22));
}

fn edge(d: f32, w: f32) -> f32 {
  return smoothstep(w, 0.0, d) + 0.004 / (d + 0.006);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var p = (uv - 0.5) * 2.0;
  p.x = p.x * u.aspect;
  p = p * (1.15 + 0.05 * sin(u.time * 0.3));
  p = rot2(u.time * 0.02 + (u.mouse.x - 0.5) * 1.5) * p;

  var col = vec3f(0.0);

  col = col + vec3f(1.0, 0.85, 0.55) * glowPoint(length(p), 0.0025) * 0.6;

  var upR = array<f32, 4>(0.30, 0.50, 0.70, 0.90);
  var dnR = array<f32, 5>(0.24, 0.42, 0.58, 0.76, 0.94);
  for (var i = 0; i < 4; i++) {
    let d = triGlyph(p, upR[i] * 0.62, 1.0);
    col = col + gold(0.15 + f32(i) * 0.07 + u.time * 0.02) * edge(d, 0.012) * 0.32;
  }
  for (var i = 0; i < 5; i++) {
    let d = triGlyph(p, dnR[i] * 0.62, -1.0);
    col = col + gold(0.55 + f32(i) * 0.06 - u.time * 0.02) * edge(d, 0.012) * 0.32;
  }

  col = col + gold(0.30) * edge(lotus(p, 8.0, 0.68, 0.10), 0.010) * 0.30;
  col = col + gold(0.80) * edge(lotus(p, 16.0, 0.82, 0.075), 0.010) * 0.28;

  col = col + gold(0.50) * edge(abs(length(p) - 0.96), 0.006) * 0.30;
  col = col + gold(0.60) * edge(abs(length(p) - 1.02), 0.004) * 0.20;

  col = col + gold(0.05) * edge(ngon(p, 1.16, 4.0), 0.010) * 0.30;
  col = col + gold(0.12) * edge(ngon(rot2(TAU / 8.0) * p, 1.26, 4.0), 0.010) * 0.25;

  col = col + gold(0.40) * smoothstep(0.02, 0.0, flowerOfLife(p, 0.33)) * 0.06;

  col = col * (1.1 + u.mouse.y * 1.0);
  col = col * smoothstep(2.3, 0.9, length(p));

  return vec4f(col, 1.0);
}
