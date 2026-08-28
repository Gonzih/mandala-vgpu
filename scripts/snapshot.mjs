// Headless snapshots of every mode via vgpu/node — no browser, no eyes needed.
// Renders each shader at a chosen moment and writes PNGs into assets/.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { init, effect, target, sampler, pingPong, frame } from "vgpu/node";

const WIDTH = 1280;
const HEIGHT = 720;
const ECHO_SCALE = 0.55;

const shaderPath = (name) =>
  fileURLToPath(new URL(`../src/shaders/${name}.wgsl`, import.meta.url));

const outPath = (name) =>
  fileURLToPath(new URL(`../assets/${name}.png`, import.meta.url));

mkdirSync(fileURLToPath(new URL("../assets", import.meta.url)), { recursive: true });

const gpu = await init();
const shot = target(gpu, { size: [WIDTH, HEIGHT] });
const aspect = WIDTH / HEIGHT;

async function save(name) {
  const pixels = await shot.read();
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  png.data.set(pixels);
  // Snapshots read back fully opaque; shaders write alpha 1 but belt-and-braces.
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  writeFileSync(outPath(name), PNG.sync.write(png));
  console.log(`assets/${name}.png`);
}

// Flat modes: one draw each at a photogenic moment.
const flat = [
  { name: "bloom", time: 12.4, mouse: [0.62, 0.35] },
  { name: "tunnel", time: 8.2, mouse: [0.5, 0.45] },
  { name: "moire", time: 21.7, mouse: [0.42, 0.3] },
  { name: "yantra", time: 6.5, mouse: [0.5, 0.6] },
  { name: "vortex", time: 9.3, mouse: [0.55, 0.4] },
];

for (const { name, time, mouse } of flat) {
  const resolved = await resolveShader({ entry: shaderPath(name) });
  const fx = effect(gpu, resolved.wgsl, { set: { u: { mouse, time, aspect } } });
  fx.draw(shot);
  await save(name);
}

// Echo: run the feedback loop for a few hundred frames with the autopilot
// cursor, then present the accumulation.
const feedbackResolved = await resolveShader({ entry: shaderPath("echo-feedback") });
const presentResolved = await resolveShader({ entry: shaderPath("echo-present") });
const linear = sampler(gpu, { minFilter: "linear", magFilter: "linear" });
const echo = pingPong(gpu, 1024, 1024, { format: "rgba16float" });
const feedback = effect(gpu, feedbackResolved.wgsl, {
  set: { u: { mouse: [0, 0], time: 0, energy: 1 }, prev: echo.read.color, samp: linear },
});
const present = effect(gpu, presentResolved.wgsl, {
  set: { u: { aspect, time: 0 }, acc: echo.read.color, samp: linear },
});

const FRAMES = 700;
const DT = 1 / 60;
for (let i = 0; i < FRAMES; i++) {
  const t = i * DT;
  const mx = 0.62 * Math.sin(t * 0.5) * Math.cos(t * 0.23);
  const my = 0.62 * Math.sin(t * 0.37 + 1.3);
  frame(gpu, (f) => {
    feedback.set({ u: { mouse: [mx, my], time: t, energy: 1 }, prev: echo.read.color });
    f.pass(echo.write, feedback);
  });
  echo.swap();
}
present.set({ u: { aspect, time: FRAMES * DT }, acc: echo.read.color });
present.draw(shot);
await save("echo");

// Codex births: runtime-generated volumetric mandalas, one per seed.
const { buildCodex } = await import("../src/codex.js");
for (const seed of [7, 90210, 4, 1]) {
  const born = buildCodex(seed);
  console.log(`codex seed ${seed}: ${born.name} (${born.archetype}, folds ${born.folds})`);
  const fx = effect(gpu, born.wgsl, { set: { u: { mouse: [0.5, 0.5], time: 11.0, aspect } } });
  fx.draw(shot);
  await save(`codex-${seed}`);
}

gpu.dispose();
