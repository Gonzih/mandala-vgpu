// Sacred geometry forms. Pure module — outline/field distances for the
// classic constructions: vesica piscis, Seed/Flower of Life, Metatron's
// cube, regular polygons and triangles, lotus petal rings, golden-angle
// phyllotaxis and the golden log-spiral.

import { TAU, rot2, kaleido, unfold } from "./mandala.wgsl";

// Distance to the outline of a circle of radius rad centered at c.
export fn ringAt(p: vec2f, c: vec2f, rad: f32) -> f32 {
  return abs(distance(p, c) - rad);
}

export fn sdSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Vesica piscis: two circles of radius r whose centers sit r apart.
export fn vesica(p: vec2f, r: f32) -> f32 {
  return min(ringAt(p, vec2f(-r * 0.5, 0.0), r), ringAt(p, vec2f(r * 0.5, 0.0), r));
}

// Seed → Fruit of Life: 19-circle hexagonal lattice, min outline distance.
export fn flowerOfLife(p: vec2f, r: f32) -> f32 {
  var d = ringAt(p, vec2f(0.0), r);
  for (var i = 0; i < 6; i++) {
    let a = f32(i) * TAU / 6.0;
    let dir = vec2f(cos(a), sin(a));
    d = min(d, ringAt(p, dir * r, r));
    d = min(d, ringAt(p, dir * (2.0 * r), r));
    let a2 = a + TAU / 12.0;
    d = min(d, ringAt(p, vec2f(cos(a2), sin(a2)) * (1.7320508 * r), r));
  }
  return d;
}

// Metatron's cube: the 13 Fruit-of-Life centers with every pair joined.
export fn metatron(p: vec2f, r: f32) -> f32 {
  var nodes: array<vec2f, 13>;
  nodes[0] = vec2f(0.0);
  for (var i = 0; i < 6; i++) {
    let a = f32(i) * TAU / 6.0 + TAU / 12.0;
    let dir = vec2f(cos(a), sin(a));
    nodes[1 + i] = dir * r;
    nodes[7 + i] = dir * (2.0 * r);
  }
  var d = 1e9;
  for (var i = 0; i < 13; i++) {
    for (var j = 0; j < 13; j++) {
      if (j <= i) { continue; }
      d = min(d, sdSegment(p, nodes[i], nodes[j]));
    }
  }
  return d;
}

// Regular n-gon outline (radial distance to the edge along the ray).
export fn ngon(p: vec2f, r: f32, n: f32) -> f32 {
  let a = atan2(p.y, p.x);
  let seg = TAU / n;
  let b = a - seg * floor(a / seg) - seg * 0.5;
  let edge = r * cos(seg * 0.5) / cos(b);
  return abs(length(p) - edge);
}

// Equilateral triangle outline; flip=1 points up, flip=-1 points down.
export fn triGlyph(p: vec2f, r: f32, flip: f32) -> f32 {
  return ngon(rot2(TAU * 0.25) * vec2f(p.x, p.y * flip), r, 3.0);
}

// Lotus ring: `count` elongated petal outlines at radius rad, size s.
export fn lotus(p: vec2f, count: f32, rad: f32, s: f32) -> f32 {
  let q = unfold(kaleido(p, count));
  let d = length((q - vec2f(rad, 0.0)) * vec2f(1.0, 2.4));
  return abs(d - s);
}

// Golden-angle seed spiral — returns accumulated glow, not a distance.
export fn phyllotaxis(p: vec2f, spread: f32, t: f32) -> f32 {
  var glow = 0.0;
  for (var i = 1; i < 90; i++) {
    let fi = f32(i);
    let a = fi * 2.3999632 + t;
    let rad = spread * sqrt(fi);
    let c = vec2f(cos(a), sin(a)) * rad;
    let d2 = dot(p - c, p - c);
    glow = glow + 0.0006 / (d2 + 0.0022 + rad * 0.0012);
  }
  return glow;
}

// Golden log-spiral interference: bright where the spiral arms pass.
export fn goldenSpiral(p: vec2f, arms: f32, t: f32) -> f32 {
  let r = length(p) + 1e-4;
  let a = atan2(p.y, p.x);
  return cos(log(r) * 3.2646 - a * arms + t);
}
