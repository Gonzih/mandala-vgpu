// Shared mandala math. Pure module — no bindings; vgpu resolves this import
// graph at build time and hands effect() one finished shader.

export const TAU: f32 = 6.2831853071795864;

export fn rot2(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

// Fold the plane into n mirrored wedges. Returns (radius, folded angle).
export fn kaleido(p: vec2f, n: f32) -> vec2f {
  let r = length(p);
  var a = atan2(p.y, p.x);
  let slice = TAU / n;
  a = a - slice * floor(a / slice);
  a = abs(a - slice * 0.5);
  return vec2f(r, a);
}

// Unfold a kaleido (radius, angle) pair back to cartesian wedge space.
export fn unfold(ra: vec2f) -> vec2f {
  return vec2f(cos(ra.y), sin(ra.y)) * ra.x;
}

// iq cosine palette.
export fn palette(t: f32, a: vec3f, b: vec3f, c: vec3f, d: vec3f) -> vec3f {
  return a + b * cos(TAU * (c * t + d));
}

// House spectrum: full violet → cyan → gold cycle.
export fn spectrum(t: f32) -> vec3f {
  return palette(t, vec3f(0.5), vec3f(0.5), vec3f(1.0), vec3f(0.0, 0.33, 0.67));
}

// Inverse-square point glow, k controls the falloff radius.
export fn glowPoint(d: f32, k: f32) -> f32 {
  return k / (d * d + k);
}

// Soft luminous ring at radius `center`.
export fn softRing(r: f32, center: f32, width: f32) -> f32 {
  return smoothstep(width, 0.0, abs(r - center));
}
