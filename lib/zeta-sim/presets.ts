import type { PresetId, SimulationMetrics, SimulationPreset } from "@/lib/zeta-sim/types";

export const PARTICLE_COUNT = 130;
export const BAND_COUNT = 7;
export const PELLETIER_FACTOR = Math.PI ** 2 / 6 - 1 / 12;
export const ORBITAL_MOTE_COUNT = PARTICLE_COUNT * 6;
export const AMBIENT_ATOM_COUNT = 2600;
export const VISIBLE_ATOM_COUNT = PARTICLE_COUNT + ORBITAL_MOTE_COUNT + AMBIENT_ATOM_COUNT;

export const PRESETS: SimulationPreset[] = [
  {
    id: "baseline",
    label: "Baseline Resonance",
    description: "Balanced bond and repulsion values for a readable default field.",
    narrative: "The field sits in a stable rhythm with mild pole curvature and regular bond formation.",
    accent: "from-orange-400 via-amber-300 to-cyan-400",
    config: {
      force: 1,
      radius: 340,
      bandCount: 7,
      syncVelocity: 0.03,
      mutationThreshold: 1,
      polePressure: 0.7,
      turbulence: 0.35,
      timeScale: 0.72,
      zoom: 1,
      zetaDepth: 16
    },
    biases: {
      attraction: 0.85,
      repulsion: 0.78,
      swirl: 0.55,
      drift: 0.8,
      harmonic: 0.82,
      pole: 0.72,
      mutation: 0.65
    }
  },
  {
    id: "critical-line",
    label: "Critical Line Shear",
    description: "Faster sync and lateral drift across the manifold.",
    narrative: "The field leans into phase shear, exaggerating cross-band travel near the pole axis.",
    accent: "from-cyan-400 via-sky-300 to-emerald-300",
    config: {
      force: 1.15,
      radius: 300,
      bandCount: 8,
      syncVelocity: 0.05,
      mutationThreshold: 1.15,
      polePressure: 0.95,
      turbulence: 0.55,
      timeScale: 0.82,
      zoom: 1.08,
      zetaDepth: 16
    },
    biases: {
      attraction: 0.82,
      repulsion: 0.75,
      swirl: 0.92,
      drift: 1.15,
      harmonic: 1.05,
      pole: 0.94,
      mutation: 0.7
    }
  },
  {
    id: "pole-pressure",
    label: "Pole Pressure",
    description: "Strong zeta(1) singularity lens and higher mutation stress.",
    narrative: "The pole behaves like a dramatic attractor, forcing higher-energy crossings and unstable pairings.",
    accent: "from-rose-400 via-orange-300 to-amber-200",
    config: {
      force: 1.25,
      radius: 280,
      bandCount: 6,
      syncVelocity: 0.035,
      mutationThreshold: 0.8,
      polePressure: 1.4,
      turbulence: 0.65,
      timeScale: 0.68,
      zoom: 1.18,
      zetaDepth: 16
    },
    biases: {
      attraction: 0.88,
      repulsion: 0.9,
      swirl: 0.72,
      drift: 0.92,
      harmonic: 0.88,
      pole: 1.35,
      mutation: 1.15
    }
  },
  {
    id: "residue-bloom",
    label: "Residue Bloom",
    description: "Longer interaction radius and softer damping to reveal network structure.",
    narrative: "Links linger longer, revealing broader clusters and bonded arcs across the field.",
    accent: "from-emerald-300 via-cyan-300 to-slate-100",
    config: {
      force: 0.9,
      radius: 460,
      bandCount: 10,
      syncVelocity: 0.025,
      mutationThreshold: 1.45,
      polePressure: 0.6,
      turbulence: 0.25,
      timeScale: 0.58,
      zoom: 0.9,
      zetaDepth: 16
    },
    biases: {
      attraction: 0.9,
      repulsion: 0.68,
      swirl: 0.45,
      drift: 0.7,
      harmonic: 0.72,
      pole: 0.6,
      mutation: 0.45
    }
  },
  {
    id: "harmonic-cascade",
    label: "Harmonic Cascade",
    description: "Higher orbital pull and faster phase resonance.",
    narrative: "Bands lock into tight orbital cascades and produce dense, short-lived bond spirals.",
    accent: "from-amber-300 via-orange-300 to-teal-300",
    config: {
      force: 1.05,
      radius: 320,
      bandCount: 9,
      syncVelocity: 0.065,
      mutationThreshold: 0.95,
      polePressure: 0.75,
      turbulence: 0.4,
      timeScale: 0.85,
      zoom: 1.05,
      zetaDepth: 16
    },
    biases: {
      attraction: 0.92,
      repulsion: 0.74,
      swirl: 1.05,
      drift: 1.08,
      harmonic: 1.22,
      pole: 0.74,
      mutation: 0.78
    }
  },
  {
    id: "proxy-storm",
    label: "Proxy Storm",
    description: "High turbulence and frequent mutation chains for dramatic demos.",
    narrative: "The manifold becomes volatile and noisy, useful for showing the control surface under stress.",
    accent: "from-fuchsia-300 via-rose-300 to-cyan-300",
    config: {
      force: 1.45,
      radius: 380,
      bandCount: 12,
      syncVelocity: 0.055,
      mutationThreshold: 0.7,
      polePressure: 1.1,
      turbulence: 0.95,
      timeScale: 0.92,
      zoom: 1.12,
      zetaDepth: 16
    },
    biases: {
      attraction: 1.05,
      repulsion: 1,
      swirl: 1.15,
      drift: 1.2,
      harmonic: 1.08,
      pole: 1.05,
      mutation: 1.3
    }
  }
];

export const PRESET_MAP: Record<PresetId, SimulationPreset> = PRESETS.reduce(
  (accumulator, preset) => {
    accumulator[preset.id] = preset;
    return accumulator;
  },
  {} as Record<PresetId, SimulationPreset>
);

export const DEFAULT_METRICS = (presetLabel: string): SimulationMetrics => ({
  totalCount: PARTICLE_COUNT,
  visibleAtoms: VISIBLE_ATOM_COUNT,
  activeBands: BAND_COUNT,
  bondCount: 0,
  mutationEvents: 0,
  meanEnergy: 0,
  frameTime: 0,
  presetLabel,
  zetaDepth: 16
});
