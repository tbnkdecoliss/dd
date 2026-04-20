import {
  BAND_COUNT,
  PARTICLE_COUNT,
  PELLETIER_FACTOR
} from "@/lib/zeta-sim/presets";
import type {
  LinkSegment,
  SimulationControls,
  SimulationMetrics,
  SimulationPreset
} from "@/lib/zeta-sim/types";

const WARM_PALETTE = [0xff8a3d, 0xffaa47, 0xffd166, 0xff785a, 0xffb86c, 0xff9157, 0xffcc8f];
const COOL_PALETTE = [0x00d2ff, 0x3ee8ff, 0x6de6b0, 0x56c7ff, 0x32ffd2, 0x6fd8ff, 0x91f6ff];

export class ZetaFieldEngine {
  readonly count = PARTICLE_COUNT;
  readonly bandCount = BAND_COUNT;
  readonly x = new Float32Array(PARTICLE_COUNT);
  readonly y = new Float32Array(PARTICLE_COUNT);
  readonly vx = new Float32Array(PARTICLE_COUNT);
  readonly vy = new Float32Array(PARTICLE_COUNT);
  readonly phase = new Float32Array(PARTICLE_COUNT);
  readonly energy = new Float32Array(PARTICLE_COUNT);
  readonly charge = new Int8Array(PARTICLE_COUNT);
  readonly band = new Uint8Array(PARTICLE_COUNT);
  readonly size = new Float32Array(PARTICLE_COUNT);
  readonly links: LinkSegment[] = [];

  width = 1280;
  height = 720;
  centerX = this.width / 2;
  centerY = this.height / 2;
  poleX = this.width * 0.68;

  config: SimulationControls;
  preset: SimulationPreset;
  bondCount = 0;
  mutationEvents = 0;
  meanEnergy = 0;
  lastFrameTime = 0;

  constructor(config: SimulationControls, preset: SimulationPreset) {
    this.config = config;
    this.preset = preset;
    this.seed();
  }

  setControls(config: SimulationControls, preset: SimulationPreset) {
    this.config = config;
    this.preset = preset;
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
      activeBands: this.bandCount,
      bondCount: this.bondCount,
      mutationEvents: this.mutationEvents,
      meanEnergy: this.meanEnergy,
      frameTime: this.lastFrameTime,
      presetLabel: this.preset.label
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
      this.size[index] = 0.7 + band * 0.08;
      this.energy[index] = 0.2 + band * 0.04;
      this.x[index] = this.centerX + Math.cos(angle) * radius + jitter * 6;
      this.y[index] = this.centerY + Math.sin(angle) * radius + jitter * 3;
      this.vx[index] = Math.cos(angle * 1.7) * 0.3;
      this.vy[index] = Math.sin(angle * 1.3) * 0.3;
    }
  }

  step(deltaSeconds: number) {
    const start = performance.now();
    const radius = Math.max(this.config.radius, 80);
    const radiusSquared = radius * radius;
    const padding = 32;
    const preset = this.preset;
    const config = this.config;

    this.links.length = 0;
    this.bondCount = 0;

    for (let index = 0; index < this.count; index += 1) {
      const orbitRadius = 116 + this.band[index] * 36;
      const orbitalAngle = this.phase[index];
      const targetX = this.centerX + Math.cos(orbitalAngle) * orbitRadius;
      const targetY = this.centerY + Math.sin(orbitalAngle) * orbitRadius;
      const driftStrength = (0.0018 + config.turbulence * 0.0012) * preset.biases.drift;

      this.vx[index] += (targetX - this.x[index]) * driftStrength;
      this.vy[index] += (targetY - this.y[index]) * driftStrength;
      this.phase[index] +=
        config.syncVelocity *
        (0.38 + this.band[index] * 0.05) *
        preset.biases.harmonic *
        deltaSeconds *
        60;

      const poleOffset = this.poleX - this.x[index];
      const poleDistance = Math.max(18, Math.abs(poleOffset));
      const poleForce =
        (config.polePressure * preset.biases.pole * 24 * PELLETIER_FACTOR) / poleDistance;
      this.vx[index] += Math.sign(poleOffset) * poleForce * deltaSeconds * 60;
      this.vy[index] += Math.sin(this.phase[index] * 0.9) * poleForce * 0.45 * deltaSeconds * 60;
    }

    for (let left = 0; left < this.count; left += 1) {
      for (let right = left + 1; right < this.count; right += 1) {
        const dx = this.x[right] - this.x[left];
        const dy = this.y[right] - this.y[left];
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared <= 0.0001 || distanceSquared > radiusSquared) {
          continue;
        }

        const distance = Math.sqrt(distanceSquared);
        const falloff = 1 - distance / radius;
        const bandDistance = Math.abs(this.band[left] - this.band[right]);
        const resonance = 1 - Math.min(1, bandDistance / this.bandCount);
        const harmonic = 0.65 + Math.cos(this.phase[left] - this.phase[right]) * 0.35;
        const oppositeCharge = this.charge[left] !== this.charge[right];
        const attraction =
          falloff *
          resonance *
          config.force *
          preset.biases.attraction *
          harmonic *
          PELLETIER_FACTOR;
        const repulsion =
          falloff * preset.biases.repulsion * (oppositeCharge ? 0.22 : 1.05) * (0.8 + config.turbulence);
        const coupling = attraction * (oppositeCharge ? 1.12 : 0.42) - repulsion;
        const swirl = Math.sin(this.phase[right] - this.phase[left]) * preset.biases.swirl * falloff;
        const unitX = dx / distance;
        const unitY = dy / distance;
        const forceX = unitX * coupling * deltaSeconds * 60;
        const forceY = unitY * coupling * deltaSeconds * 60;

        this.vx[left] -= forceX;
        this.vy[left] -= forceY;
        this.vx[right] += forceX;
        this.vy[right] += forceY;

        this.vx[left] += -unitY * swirl * 0.34;
        this.vy[left] += unitX * swirl * 0.34;
        this.vx[right] -= -unitY * swirl * 0.34;
        this.vy[right] -= unitX * swirl * 0.34;

        const energyGain = Math.abs(coupling) * 0.0055;
        this.energy[left] += energyGain;
        this.energy[right] += energyGain;

        const relativeVelocity =
          Math.abs(this.vx[left] - this.vx[right]) + Math.abs(this.vy[left] - this.vy[right]);

        if (
          distance < 54 &&
          resonance > 0.52 &&
          relativeVelocity < 14 &&
          this.links.length < 180
        ) {
          this.links.push({
            fromX: this.x[left],
            fromY: this.y[left],
            toX: this.x[right],
            toY: this.y[right],
            strength: falloff
          });
          this.bondCount += 1;
        }
      }
    }

    let energyAccumulator = 0;

    for (let index = 0; index < this.count; index += 1) {
      const turbulenceX = Math.sin(this.phase[index] * 1.7 + index) * config.turbulence * 0.08;
      const turbulenceY = Math.cos(this.phase[index] * 1.3 - index) * config.turbulence * 0.08;
      const damping = 0.973 - config.turbulence * 0.018;

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
      if (this.energy[index] > threshold) {
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
}
