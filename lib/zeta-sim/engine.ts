import {
  BAND_COUNT,
  PARTICLE_COUNT,
  PELLETIER_FACTOR,
  VISIBLE_ATOM_COUNT
} from "@/lib/zeta-sim/presets";
import type {
  SimulationControls,
  SimulationMetrics,
  SimulationPreset
} from "@/lib/zeta-sim/types";
import type { WasmSignatureSolver } from "@/lib/zeta-sim/wasm-solver";

const WARM_PALETTE = [0xff8a3d, 0xffaa47, 0xffd166, 0xff785a, 0xffb86c, 0xff9157, 0xffcc8f];
const COOL_PALETTE = [0x00d2ff, 0x3ee8ff, 0x6de6b0, 0x56c7ff, 0x32ffd2, 0x6fd8ff, 0x91f6ff];
const MAX_LINKS = 180;
const NEIGHBOR_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 0],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
] as const;
const ZETA_VALUES = [
  0,
  2.8,
  1.6449340668482264,
  1.2020569031595942,
  1.0823232337111381,
  1.03692775514337,
  1.0173430619844492,
  1.0083492773819228,
  1.0040773561979444,
  1.0020083928260821,
  1.000994575127818,
  1.0004941886041194,
  1.000246086553308,
  1.0001227133475785,
  1.0000612481350587,
  1.000030588236307,
  1.0000152822594087
];

export class ZetaFieldEngine {
  readonly count = PARTICLE_COUNT;
  readonly x = new Float32Array(PARTICLE_COUNT);
  readonly y = new Float32Array(PARTICLE_COUNT);
  readonly vx = new Float32Array(PARTICLE_COUNT);
  readonly vy = new Float32Array(PARTICLE_COUNT);
  readonly phase = new Float32Array(PARTICLE_COUNT);
  readonly energy = new Float32Array(PARTICLE_COUNT);
  readonly charge = new Int8Array(PARTICLE_COUNT);
  readonly band = new Uint8Array(PARTICLE_COUNT);
  readonly size = new Float32Array(PARTICLE_COUNT);
  readonly depth = new Float32Array(PARTICLE_COUNT);
  readonly zetaWave = new Float32Array(PARTICLE_COUNT);
  readonly zetaShear = new Float32Array(PARTICLE_COUNT);
  readonly zetaDrift = new Float32Array(PARTICLE_COUNT);
  readonly linkPositions = new Float32Array(MAX_LINKS * 4);
  readonly linkStrengths = new Float32Array(MAX_LINKS);
  readonly nextIndex = new Int16Array(PARTICLE_COUNT);
  readonly spatialHeads = new Map<number, number>();

  width = 1280;
  height = 720;
  centerX = this.width / 2;
  centerY = this.height / 2;
  poleX = this.width * 0.68;
  bandCount = BAND_COUNT;

  config: SimulationControls;
  preset: SimulationPreset;
  bondCount = 0;
  linkCount = 0;
  mutationEvents = 0;
  meanEnergy = 0;
  lastFrameTime = 0;
  wasmSolver: WasmSignatureSolver | null = null;
  readonly wasmOutput = new Float32Array(PARTICLE_COUNT * 3);

  constructor(config: SimulationControls, preset: SimulationPreset) {
    this.config = config;
    this.preset = preset;
    this.bandCount = config.bandCount;
    this.seed();
  }

  setControls(config: SimulationControls, preset: SimulationPreset) {
    const nextBandCount = clampBandCount(config.bandCount);
    const bandCountChanged = nextBandCount !== this.bandCount;
    this.config = {
      ...config,
      bandCount: nextBandCount
    };
    this.preset = preset;
    if (bandCountChanged) {
      this.bandCount = nextBandCount;
      this.seed();
    }
  }

  setWasmSolver(solver: WasmSignatureSolver | null) {
    this.wasmSolver = solver;
  }

  resize(width: number, height: number) {
    this.width = Math.max(width, 320);
    this.height = Math.max(height, 320);
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.poleX = this.width * 0.68;
  }

  getMetrics(): SimulationMetrics {
    return {
      totalCount: this.count,
      visibleAtoms: VISIBLE_ATOM_COUNT,
      activeBands: this.bandCount,
      bondCount: this.bondCount,
      mutationEvents: this.mutationEvents,
      meanEnergy: this.meanEnergy,
      frameTime: this.lastFrameTime,
      presetLabel: this.preset.label,
      zetaDepth: this.config.zetaDepth
    };
  }

  getTint(index: number) {
    return this.charge[index] > 0
      ? WARM_PALETTE[this.band[index] % WARM_PALETTE.length]
      : COOL_PALETTE[this.band[index] % COOL_PALETTE.length];
  }

  private seed() {
    for (let index = 0; index < this.count; index += 1) {
      const band = index % this.bandCount;
      const angle = (index / this.count) * Math.PI * 2 + band * 0.38;
      const radius = 120 + band * 34 + ((index * 17) % 19) * 2.2;
      const jitter = ((index * 13) % 11) - 5;

      this.band[index] = band;
      this.phase[index] = angle;
      this.charge[index] = index % 2 === 0 ? 1 : -1;
      this.size[index] = 0.26 + band * 0.025;
      this.energy[index] = 0.2 + band * 0.04;
      this.x[index] = this.centerX + Math.cos(angle) * radius + jitter * 6;
      this.y[index] = this.centerY + Math.sin(angle) * radius + jitter * 3;
      this.vx[index] = Math.cos(angle * 1.7) * 0.3;
      this.vy[index] = Math.sin(angle * 1.3) * 0.3;
      this.depth[index] = Math.sin(angle * 2.3) * (90 + band * 26);
    }
  }

  step(deltaSeconds: number) {
    const start = performance.now();
    const simulationDelta = Math.max(0.0005, deltaSeconds * this.config.timeScale);
    const radius = Math.max(this.config.radius, 80);
    const radiusSquared = radius * radius;
    const padding = 32;
    const preset = this.preset;
    const config = this.config;

    this.bondCount = 0;
    this.linkCount = 0;
    this.refreshWasmSignatures(config.zetaDepth);

    for (let index = 0; index < this.count; index += 1) {
      const orbitRadius = 116 + this.band[index] * 36;
      const orbitalAngle = this.phase[index];
      const targetX = this.centerX + Math.cos(orbitalAngle) * orbitRadius;
      const targetY = this.centerY + Math.sin(orbitalAngle) * orbitRadius;
      const zetaSignature = this.getZetaSignature(index, config.zetaDepth);
      const driftStrength =
        (0.0018 + config.turbulence * 0.0012) *
        preset.biases.drift *
        (1 + zetaSignature.drift * 0.24);

      this.zetaWave[index] = zetaSignature.wave;
      this.zetaShear[index] = zetaSignature.shear;
      this.zetaDrift[index] = zetaSignature.drift;

      this.vx[index] += (targetX - this.x[index]) * driftStrength;
      this.vy[index] += (targetY - this.y[index]) * driftStrength;

      if (config.enableSync) {
        this.phase[index] +=
          config.syncVelocity *
          (0.38 + this.band[index] * 0.05) *
          preset.biases.harmonic *
          (1 + zetaSignature.wave * 0.18) *
          simulationDelta *
          60;
      }

      const poleOffset = this.poleX - this.x[index];
      const poleDistance = Math.max(18, Math.abs(poleOffset));
      const poleForce =
        (config.polePressure *
          preset.biases.pole *
          (24 + config.zetaDepth * 1.35) *
          PELLETIER_FACTOR *
          (1 + zetaSignature.wave * 0.22)) /
        poleDistance;
      if (config.enableForces) {
        this.vx[index] += Math.sign(poleOffset) * poleForce * simulationDelta * 60;
        this.vy[index] +=
          Math.sin(this.phase[index] * 0.9 + zetaSignature.shear) * poleForce * 0.45 * simulationDelta * 60;
      }
      this.depth[index] =
        Math.sin(this.phase[index] * (1.2 + zetaSignature.wave * 0.08) + index * 0.11) *
          (110 + this.band[index] * 24) +
        zetaSignature.drift * 180;
    }

    this.buildSpatialGrid(radius);

    for (let left = 0; left < this.count; left += 1) {
      const baseCellX = Math.floor(this.x[left] / radius);
      const baseCellY = Math.floor(this.y[left] / radius);

      for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
        const key = getCellKey(baseCellX + offsetX, baseCellY + offsetY);
        let right = this.spatialHeads.get(key) ?? -1;

        while (right !== -1) {
          if (right > left) {
            const dx = this.x[right] - this.x[left];
            const dy = this.y[right] - this.y[left];
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared > 0.0001 && distanceSquared <= radiusSquared) {
              const distance = Math.sqrt(distanceSquared);
              const falloff = 1 - distance / radius;
              const bandDistance = Math.abs(this.band[left] - this.band[right]);
              const resonance = 1 - Math.min(1, bandDistance / this.bandCount);
              const harmonic = 0.65 + Math.cos(this.phase[left] - this.phase[right]) * 0.35;
              const oppositeCharge = this.charge[left] !== this.charge[right];
              const isSynchronized =
                !config.enableSync || Math.abs(Math.sin(this.phase[left] - this.phase[right])) < 0.45;
              const zetaCoupling =
                1 +
                (this.zetaWave[left] + this.zetaWave[right]) * 0.14 +
                Math.abs(this.zetaDrift[left] - this.zetaDrift[right]) * 0.08;
              const attraction =
                falloff *
                resonance *
                config.force *
                preset.biases.attraction *
                harmonic *
                zetaCoupling *
                PELLETIER_FACTOR;
              const repulsion =
                falloff * preset.biases.repulsion * (oppositeCharge ? 0.22 : 1.05) * (0.8 + config.turbulence);
              const coupling = attraction * (oppositeCharge ? 1.12 : 0.42) - repulsion;
              const swirl =
                (Math.sin(this.phase[right] - this.phase[left]) +
                  (this.zetaShear[right] - this.zetaShear[left]) * 0.6) *
                preset.biases.swirl *
                falloff;
              const unitX = dx / distance;
              const unitY = dy / distance;
              const forceX = unitX * coupling * simulationDelta * 60;
              const forceY = unitY * coupling * simulationDelta * 60;

              if (config.enableForces) {
                this.vx[left] -= forceX;
                this.vy[left] -= forceY;
                this.vx[right] += forceX;
                this.vy[right] += forceY;

                this.vx[left] += -unitY * swirl * 0.34;
                this.vy[left] += unitX * swirl * 0.34;
                this.vx[right] -= -unitY * swirl * 0.34;
                this.vy[right] -= unitX * swirl * 0.34;
              }

              if (config.enableBonds || config.enableMutation) {
                const energyGain =
                  Math.abs(coupling) *
                  (0.0055 + Math.abs(this.zetaShear[left] - this.zetaShear[right]) * 0.0015);
                this.energy[left] += energyGain;
                this.energy[right] += energyGain;
              }

              const relativeVelocity =
                Math.abs(this.vx[left] - this.vx[right]) + Math.abs(this.vy[left] - this.vy[right]);

              if (
                config.enableBonds &&
                isSynchronized &&
                distance < 54 &&
                resonance > 0.52 &&
                relativeVelocity < 14 &&
                this.linkCount < MAX_LINKS
              ) {
                const linkOffset = this.linkCount * 4;
                this.linkPositions[linkOffset] = this.x[left];
                this.linkPositions[linkOffset + 1] = this.y[left];
                this.linkPositions[linkOffset + 2] = this.x[right];
                this.linkPositions[linkOffset + 3] = this.y[right];
                this.linkStrengths[this.linkCount] = falloff;
                this.linkCount += 1;
                this.bondCount += 1;
              }
            }
          }

          right = this.nextIndex[right];
        }
      }
    }

    let energyAccumulator = 0;

    for (let index = 0; index < this.count; index += 1) {
      const turbulenceX = Math.sin(this.phase[index] * 1.7 + index) * config.turbulence * 0.08;
      const turbulenceY = Math.cos(this.phase[index] * 1.3 - index) * config.turbulence * 0.08;
      const damping = 0.973 - config.turbulence * 0.018 - (1 - config.timeScale) * 0.006;

      this.vx[index] = (this.vx[index] + turbulenceX) * damping;
      this.vy[index] = (this.vy[index] + turbulenceY) * damping;
      this.x[index] += this.vx[index];
      this.y[index] += this.vy[index];

      if (this.x[index] < padding || this.x[index] > this.width - padding) {
        this.vx[index] *= -0.88;
        this.x[index] = Math.min(this.width - padding, Math.max(padding, this.x[index]));
      }

      if (this.y[index] < padding || this.y[index] > this.height - padding) {
        this.vy[index] *= -0.88;
        this.y[index] = Math.min(this.height - padding, Math.max(padding, this.y[index]));
      }

      const threshold = config.mutationThreshold * (1.55 / Math.max(0.25, preset.biases.mutation));
      if (config.enableMutation && this.energy[index] > threshold) {
        this.energy[index] = 0.34;
        this.charge[index] *= -1;
        this.band[index] = (this.band[index] + 1 + (index % 2)) % this.bandCount;
        this.mutationEvents += 1;
      }

      this.energy[index] *= 0.978;
      energyAccumulator += this.energy[index];
    }

    this.meanEnergy = energyAccumulator / this.count;
    this.lastFrameTime = performance.now() - start;
  }

  private buildSpatialGrid(cellSize: number) {
    this.spatialHeads.clear();

    for (let index = 0; index < this.count; index += 1) {
      const cellX = Math.floor(this.x[index] / cellSize);
      const cellY = Math.floor(this.y[index] / cellSize);
      const key = getCellKey(cellX, cellY);
      const previousHead = this.spatialHeads.get(key);

      this.nextIndex[index] = previousHead ?? -1;
      this.spatialHeads.set(key, index);
    }
  }

  private getZetaSignature(index: number, depth: number) {
    if (this.wasmSolver) {
      const base = index * 3;
      return {
        wave: this.wasmOutput[base],
        shear: this.wasmOutput[base + 1],
        drift: this.wasmOutput[base + 2]
      };
    }

    return getZetaSignature(this.phase[index], this.band[index], index, depth);
  }

  private refreshWasmSignatures(depth: number) {
    if (!this.wasmSolver) {
      return;
    }

    const output = this.wasmSolver.compute(this.phase, this.band, depth);
    this.wasmOutput.set(output);
  }
}

function clampBandCount(value: number) {
  return Math.max(4, Math.min(18, Math.round(value)));
}

function getCellKey(x: number, y: number) {
  return x * 65536 + y;
}

function getZetaSignature(phase: number, band: number, index: number, depth: number) {
  const maxDepth = Math.min(16, Math.max(1, Math.round(depth)));
  let wave = 0;
  let shear = 0;
  let drift = 0;
  let totalWeight = 0;

  for (let order = 1; order <= maxDepth; order += 1) {
    const rawValue = ZETA_VALUES[order];
    const normalized = order === 1 ? 1 : rawValue - 1;
    const weight = order === 1 ? 0.85 : 1 / Math.pow(order, 0.82);
    const orderPhase = phase * order + band * order * 0.18 + index * 0.003 * order;

    wave += Math.sin(orderPhase) * normalized * weight;
    shear += Math.cos(orderPhase * 0.7 - band * 0.16 * order) * normalized * weight;
    drift += Math.sin(orderPhase * 0.42 + index * 0.0023) * normalized * weight;
    totalWeight += weight;
  }

  const normalization = Math.max(totalWeight, 0.0001);

  return {
    wave: wave / normalization,
    shear: shear / normalization,
    drift: drift / normalization
  };
}
