export type PresetId =
  | "baseline"
  | "critical-line"
  | "pole-pressure"
  | "residue-bloom"
  | "harmonic-cascade"
  | "proxy-storm";

export type SimulationControls = {
  force: number;
  radius: number;
  syncVelocity: number;
  mutationThreshold: number;
  polePressure: number;
  turbulence: number;
  showLinks: boolean;
  showField: boolean;
};

export type PresetBiases = {
  attraction: number;
  repulsion: number;
  swirl: number;
  drift: number;
  harmonic: number;
  pole: number;
  mutation: number;
};

export type SimulationPreset = {
  id: PresetId;
  label: string;
  description: string;
  narrative: string;
  accent: string;
  config: Omit<SimulationControls, "showLinks" | "showField">;
  biases: PresetBiases;
};

export type SimulationMetrics = {
  totalCount: number;
  activeBands: number;
  bondCount: number;
  mutationEvents: number;
  meanEnergy: number;
  frameTime: number;
  presetLabel: string;
};

export type LinkSegment = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  strength: number;
};
