export interface CodexShader {
  wgsl: string;
  name: string;
  seed: number;
  archetype: "smoke" | "lattice" | "weave";
  folds: number;
}

export function mulberry32(seed: number): () => number;
export function buildCodex(seed: number): CodexShader;
