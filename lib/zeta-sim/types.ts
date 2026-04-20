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
  bandCount: number;
  syncVelocity: number;
  mutationThreshold: number;
  polePressure: number;
  turbulence: number;
  timeScale: number;
  zoom: number;
  zetaDepth: number;
  enableMutation: boolean;
  enableBonds: boolean;
  enableForces: boolean;
  enableSync: boolean;
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
  config: Omit<
    SimulationControls,
    "showLinks" | "showField" | "enableMutation" | "enableBonds" | "enableForces" | "enableSync"
  >;
  biases: PresetBiases;
};

export type SimulationMetrics = {
  totalCount: number;
  visibleAtoms: number;
  activeBands: number;
  bondCount: number;
  mutationEvents: number;
  meanEnergy: number;
  frameTime: number;
  presetLabel: string;
  zetaDepth: number;
};
