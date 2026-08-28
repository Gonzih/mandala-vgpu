import { init, effect, surface, frameLoop, clock, sampler, pingPong } from "vgpu";
import { canvasMouseTracker } from "@vgpu/render/utils";
import { buildCodex } from "./codex.js";
import bloomSrc from "./shaders/bloom.wgsl";
import tunnelSrc from "./shaders/tunnel.wgsl";
import moireSrc from "./shaders/moire.wgsl";
import yantraSrc from "./shaders/yantra.wgsl";
import vortexSrc from "./shaders/vortex.wgsl";
import echoFeedbackSrc from "./shaders/echo-feedback.wgsl";
import echoPresentSrc from "./shaders/echo-present.wgsl";

// Must match SCALE in echo-present.wgsl — maps canvas space into the square
// accumulation target so injected light lands under the cursor.
const ECHO_SCALE = 0.55;
const ECHO_SIZE = 1024;
const IDLE_SECONDS = 4;
const CYCLE_SECONDS = 14;
const ECHO_MODE = 3;
const CODEX_MODE = 6;
const MODE_COUNT = 7;

const canvas = document.getElementById("gl") as HTMLCanvasElement;
const ui = document.getElementById("ui")!;
const hint = document.getElementById("hint")!;
const codexLabel = document.getElementById("codex-label")!;

async function boot() {
  const gpu = await init();
  const view = surface(gpu, canvas, { dpr: [1, 2] });
  const time = clock(gpu);
  const mouse = canvasMouseTracker({ canvas, normalize: true, flipY: true });

  const uInit = () => ({ u: { mouse: [0.5, 0.5], time: 0, aspect: 1 } });
  const bloom = effect(gpu, bloomSrc, { set: uInit() });
  const tunnel = effect(gpu, tunnelSrc, { set: uInit() });
  const moire = effect(gpu, moireSrc, { set: uInit() });
  const yantra = effect(gpu, yantraSrc, { set: uInit() });
  const vortex = effect(gpu, vortexSrc, { set: uInit() });

  const linear = sampler(gpu, { minFilter: "linear", magFilter: "linear" });
  const echo = pingPong(gpu, ECHO_SIZE, ECHO_SIZE, { format: "rgba16float" });
  const echoFeedback = effect(gpu, echoFeedbackSrc, {
    set: {
      u: { mouse: [0, 0], time: 0, energy: 0 },
      prev: echo.read.color,
      samp: linear,
    },
  });
  const echoPresent = effect(gpu, echoPresentSrc, {
    set: {
      u: { aspect: 1, time: 0 },
      acc: echo.read.color,
      samp: linear,
    },
  });

  // The Codex: seeded, runtime-generated volumetric mandalas.
  let codexSeed = Math.floor(Math.random() * 0xffffffff);
  const hashMatch = location.hash.match(/^#codex-(\d+)$/);
  if (hashMatch) codexSeed = Number(hashMatch[1]) >>> 0;
  let codexFx = effect(gpu, buildCodex(codexSeed).wgsl, { set: uInit() });

  function rebirthCodex(seed: number) {
    codexSeed = seed >>> 0;
    const born = buildCodex(codexSeed);
    const old = codexFx;
    codexFx = effect(gpu, born.wgsl, { set: uInit() });
    (old as { dispose?: () => void }).dispose?.();
    codexLabel.textContent = `${born.name.toLowerCase()} · seed ${codexSeed}`;
    history.replaceState(null, "", `#codex-${codexSeed}`);
  }
  codexLabel.textContent = `${buildCodex(codexSeed).name.toLowerCase()} · seed ${codexSeed}`;

  let mode = hashMatch ? CODEX_MODE : 0;
  let cycling = false;
  let lastCycleAt = 0;

  const buttons = [...document.querySelectorAll<HTMLButtonElement>("#modes button[data-mode]")];
  const cycleBtn = document.getElementById("cycle") as HTMLButtonElement;

  function setMode(next: number) {
    mode = ((next % MODE_COUNT) + MODE_COUNT) % MODE_COUNT;
    for (const b of buttons) b.classList.toggle("active", Number(b.dataset.mode) === mode);
    codexLabel.classList.toggle("visible", mode === CODEX_MODE);
  }
  setMode(mode);

  for (const b of buttons) b.addEventListener("click", () => setMode(Number(b.dataset.mode)));
  cycleBtn.addEventListener("click", () => {
    cycling = !cycling;
    cycleBtn.classList.toggle("active", cycling);
    lastCycleAt = time.time;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key >= "1" && e.key <= "7") setMode(Number(e.key) - 1);
    if (e.key === " ") {
      e.preventDefault();
      if (mode === CODEX_MODE - 1) rebirthCodex(Math.floor(Math.random() * 0xffffffff));
      setMode(mode + 1);
      lastCycleAt = time.time;
    }
    if (e.key === "c" || e.key === "C") cycleBtn.click();
    if (e.key === "g" || e.key === "G") {
      rebirthCodex(Math.floor(Math.random() * 0xffffffff));
      setMode(CODEX_MODE);
    }
    if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    }
  });

  // In fullscreen every trace of text disappears; outside it, the UI fades
  // while idle and returns on movement.
  let lastActivity = performance.now();
  const applyVisibility = () => {
    const fs = document.fullscreenElement != null;
    const idle = performance.now() - lastActivity > IDLE_SECONDS * 1000;
    ui.classList.toggle("hidden", fs || idle);
  };
  const wake = () => {
    lastActivity = performance.now();
    applyVisibility();
  };
  window.addEventListener("pointermove", wake);
  window.addEventListener("keydown", wake);
  document.addEventListener("fullscreenchange", applyVisibility);
  setInterval(applyVisibility, 500);

  // Smoothed cursor with an autopilot: when idle, a slow lissajous orbit
  // keeps the mandala alive; touch it and it follows you instead.
  let lastSeen: readonly [number, number] = mouse.position;
  let lastMoveAt = -Infinity;
  const smooth = [0.5, 0.5];

  frameLoop(gpu, (frame) => {
    const t = time.time;
    const pos = mouse.position;
    if (pos[0] !== lastSeen[0] || pos[1] !== lastSeen[1]) {
      lastSeen = pos;
      lastMoveAt = t;
    }
    const idle = t - lastMoveAt > IDLE_SECONDS || lastMoveAt === -Infinity;
    const target: [number, number] = idle
      ? [
          0.5 + 0.34 * Math.sin(t * 0.23) * Math.cos(t * 0.11),
          0.5 + 0.34 * Math.sin(t * 0.17 + 1.3),
        ]
      : [pos[0], pos[1]];
    const k = 1 - Math.exp(-time.deltaTime * 3);
    smooth[0] += (target[0] - smooth[0]) * k;
    smooth[1] += (target[1] - smooth[1]) * k;

    if (cycling && t - lastCycleAt > CYCLE_SECONDS) {
      lastCycleAt = t;
      const next = (mode + 1) % MODE_COUNT;
      if (next === CODEX_MODE) rebirthCodex(Math.floor(Math.random() * 0xffffffff));
      setMode(next);
    }

    const aspect = view.size[0] / view.size[1];

    if (mode === ECHO_MODE) {
      const mx = (smooth[0] - 0.5) * 2 * aspect * ECHO_SCALE;
      const my = (smooth[1] - 0.5) * 2 * ECHO_SCALE;
      echoFeedback.set({
        u: { mouse: [mx, my], time: t, energy: idle ? 0.6 : 1.0 },
        prev: echo.read.color,
      });
      frame.pass(echo.write, echoFeedback);
      echo.swap();
      echoPresent.set({ u: { aspect, time: t }, acc: echo.read.color });
      frame.pass(view, echoPresent);
      return;
    }

    const flat = [bloom, tunnel, moire, null, yantra, vortex, codexFx];
    const active = flat[mode]!;
    active.set({ u: { mouse: [smooth[0], smooth[1]], time: t, aspect } });
    frame.pass(view, active);
  });
}

boot().catch((err) => {
  hint.textContent = "webgpu unavailable — use chrome, edge or safari 18+";
  ui.classList.remove("hidden");
  console.error(err);
});
