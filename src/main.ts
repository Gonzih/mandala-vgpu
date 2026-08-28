import { init, effect, surface, frameLoop, clock, sampler, pingPong } from "vgpu";
import { canvasMouseTracker } from "@vgpu/render/utils";
import bloomSrc from "./shaders/bloom.wgsl";
import tunnelSrc from "./shaders/tunnel.wgsl";
import moireSrc from "./shaders/moire.wgsl";
import echoFeedbackSrc from "./shaders/echo-feedback.wgsl";
import echoPresentSrc from "./shaders/echo-present.wgsl";

// Must match SCALE in echo-present.wgsl — maps canvas space into the square
// accumulation target so injected light lands under the cursor.
const ECHO_SCALE = 0.55;
const ECHO_SIZE = 1024;
const IDLE_SECONDS = 4;

const canvas = document.getElementById("gl") as HTMLCanvasElement;
const ui = document.getElementById("ui")!;
const hint = document.getElementById("hint")!;

async function boot() {
  const gpu = await init();
  const view = surface(gpu, canvas, { dpr: [1, 2] });
  const time = clock(gpu);
  const mouse = canvasMouseTracker({ canvas, normalize: true, flipY: true });

  const baseUniforms = { u: { mouse: [0.5, 0.5], time: 0, aspect: 1 } };
  const bloom = effect(gpu, bloomSrc, { set: { u: { ...baseUniforms.u } } });
  const tunnel = effect(gpu, tunnelSrc, { set: { u: { ...baseUniforms.u } } });
  const moire = effect(gpu, moireSrc, { set: { u: { ...baseUniforms.u } } });

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

  const flatModes = [bloom, tunnel, moire];
  let mode = 0;

  const buttons = [...document.querySelectorAll<HTMLButtonElement>("#modes button")];
  function setMode(next: number) {
    mode = next;
    for (const b of buttons) b.classList.toggle("active", Number(b.dataset.mode) === mode);
  }
  for (const b of buttons) b.addEventListener("click", () => setMode(Number(b.dataset.mode)));

  window.addEventListener("keydown", (e) => {
    if (e.key >= "1" && e.key <= "4") setMode(Number(e.key) - 1);
    if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    }
  });

  // UI fades out while you're entranced, returns on movement.
  let lastActivity = performance.now();
  const wake = () => {
    lastActivity = performance.now();
    ui.classList.remove("hidden");
  };
  window.addEventListener("pointermove", wake);
  window.addEventListener("keydown", wake);
  setInterval(() => {
    if (performance.now() - lastActivity > IDLE_SECONDS * 1000) ui.classList.add("hidden");
  }, 500);

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

    const aspect = view.size[0] / view.size[1];

    if (mode < 3) {
      const active = flatModes[mode];
      active.set({ u: { mouse: [smooth[0], smooth[1]], time: t, aspect } });
      frame.pass(view, active);
      return;
    }

    // Echo: accumulate into the ping-pong pair, then present.
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
  });
}

boot().catch((err) => {
  hint.textContent = "webgpu unavailable — use chrome, edge or safari 18+";
  ui.classList.remove("hidden");
  console.error(err);
});
