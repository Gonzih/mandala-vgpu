// Echo (present pass) — composites the HDR accumulation target to the
// canvas: aspect-corrected sampling, radial chromatic aberration, Reinhard
// tone map, vignette. SCALE must match the mouse mapping in src/main.ts.

const SCALE: f32 = 0.55;

struct U {
  aspect: f32,
  time: f32,
}

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var acc: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var p = (uv - 0.5) * 2.0;
  p.x = p.x * u.aspect;
  let q = p * SCALE;

  let off = q * 0.006;
  let base = q * 0.5 + 0.5;
  let r = textureSampleLevel(acc, samp, base + off, 0.0).r;
  let g = textureSampleLevel(acc, samp, base, 0.0).g;
  let b = textureSampleLevel(acc, samp, base - off, 0.0).b;
  var col = vec3f(r, g, b);

  col = col / (1.0 + col);
  col = pow(col, vec3f(0.8));
  let luma = dot(col, vec3f(0.333));
  col = mix(vec3f(luma), col, 1.4);
  col = col * (1.0 - 0.3 * smoothstep(0.6, 1.4, length(p)));

  return vec4f(col, 1.0);
}
