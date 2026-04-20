"use client";

import { useEffect, useRef } from "react";

import { ZetaFieldEngine } from "@/lib/zeta-sim/engine";
import { AMBIENT_ATOM_COUNT, ORBITAL_MOTE_COUNT } from "@/lib/zeta-sim/presets";
import { loadWasmSignatureSolver } from "@/lib/zeta-sim/wasm-solver";
import type {
  SimulationControls,
  SimulationMetrics,
  SimulationPreset
} from "@/lib/zeta-sim/types";

type ZetaViewportProps = {
  controls: SimulationControls;
  preset: SimulationPreset;
  runId: number;
  onMetrics: (metrics: SimulationMetrics) => void;
  onBackendChange?: (backend: "wasm" | "js") => void;
};

export function ZetaViewport({ controls, preset, runId, onMetrics, onBackendChange }: ZetaViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef(controls);
  const presetRef = useRef(preset);
  const onMetricsRef = useRef(onMetrics);
  const onBackendChangeRef = useRef(onBackendChange);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    onMetricsRef.current = onMetrics;
  }, [onMetrics]);

  useEffect(() => {
    onBackendChangeRef.current = onBackendChange;
  }, [onBackendChange]);

  useEffect(() => {
    let cancelled = false;
    let app: import("pixi.js").Application | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function createScene() {
      const host = hostRef.current;

      if (!host) {
        return;
      }

      const PIXI = await import("pixi.js");

      if (cancelled || !hostRef.current) {
        return;
      }

      app = new PIXI.Application({
        resizeTo: host,
        antialias: true,
        backgroundAlpha: 0,
        powerPreference: "high-performance"
      });

      host.appendChild(app.view as HTMLCanvasElement);

      const engine = new ZetaFieldEngine(controlsRef.current, presetRef.current);
      loadWasmSignatureSolver().then((solver) => {
        if (!cancelled) {
          engine.setWasmSolver(solver);
          onBackendChangeRef.current?.(solver ? "wasm" : "js");
        }
      });
      const starContainer = new PIXI.Container();
      const world = new PIXI.Container();
      const graphicsField = new PIXI.Graphics();
      const graphicsLinks = new PIXI.Graphics();
      const nodes = new PIXI.Container();
      const motes = new PIXI.Container();
      const spriteTexture = createNodeTexture(PIXI, app);
      const moteTexture = createMoteTexture(PIXI, app);
      const starTexture = createStarTexture(PIXI, app);
      const sprites = Array.from({ length: engine.count }, () => {
        const sprite = new PIXI.Sprite(spriteTexture);
        sprite.anchor.set(0.5);
        sprite.blendMode = PIXI.BLEND_MODES.ADD;
        nodes.addChild(sprite);
        return sprite;
      });
      const moteSeeds = createMoteSeeds(engine.count);
      const moteSprites = moteSeeds.map((seed) => {
        const sprite = new PIXI.Sprite(moteTexture);
        sprite.anchor.set(0.5);
        sprite.tint = seed.tint;
        sprite.blendMode = PIXI.BLEND_MODES.ADD;
        motes.addChild(sprite);
        return sprite;
      });
      const starSeeds = createStarSeeds();
      const starSprites = starSeeds.map((seed) => {
        const sprite = new PIXI.Sprite(starTexture);
        sprite.anchor.set(0.5);
        sprite.tint = seed.tint;
        starContainer.addChild(sprite);
        return sprite;
      });

      world.addChild(graphicsField);
      world.addChild(graphicsLinks);
      world.addChild(motes);
      world.addChild(nodes);

      app.stage.addChild(starContainer);
      app.stage.addChild(world);

      const handleResize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        engine.resize(width, height);
      };

      handleResize();
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(host);

      let metricFrame = 0;
      let elapsed = 0;
      let metricsElapsed = 0;

      app.ticker.add(() => {
        const deltaSeconds = Math.min(app!.ticker.deltaMS / 1000, 0.04);
        elapsed += deltaSeconds;
        metricsElapsed += deltaSeconds;
        engine.setControls(controlsRef.current, presetRef.current);
        engine.step(deltaSeconds);
        world.pivot.set(engine.centerX, engine.centerY);
        world.position.set(app!.screen.width / 2, app!.screen.height / 2);
        world.scale.set(controlsRef.current.zoom);

        drawField(graphicsField, engine, controlsRef.current.showField);
        drawLinks(graphicsLinks, engine, controlsRef.current.showLinks);
        drawStarfield(starSprites, starSeeds, app!.screen.width, app!.screen.height, elapsed, controlsRef.current.zoom);

        for (let index = 0; index < sprites.length; index += 1) {
          const sprite = sprites[index];
          const intensity = Math.min(1, 0.32 + engine.energy[index] * 1.1);
          const depthFactor = 0.6 + ((engine.depth[index] + 280) / 560) * 0.7;
          const projectedScale = Math.max(0.08, (engine.size[index] + engine.energy[index] * 0.12) * depthFactor);

          sprite.x = engine.x[index] + engine.depth[index] * 0.06;
          sprite.y = engine.y[index] + engine.depth[index] * 0.12;
          sprite.tint = engine.getTint(index);
          sprite.scale.set(projectedScale);
          sprite.alpha = Math.min(0.82, 0.18 + intensity * 0.34 + depthFactor * 0.1);
        }

        for (let index = 0; index < moteSprites.length; index += 1) {
          const sprite = moteSprites[index];
          const seed = moteSeeds[index];
          const host = seed.hostIndex;
          const hostDepth = engine.depth[host];
          const depthFactor = 0.55 + ((hostDepth + 280) / 560) * 0.5;
          const orbitRadius =
            seed.baseRadius *
            (1 + engine.energy[host] * 0.35 + Math.abs(engine.zetaWave[host]) * 0.55);
          const angle =
            engine.phase[host] * seed.speed +
            seed.offset +
            elapsed * 0.12 * controlsRef.current.timeScale +
            engine.zetaShear[host] * 0.8;

          sprite.x =
            engine.x[host] +
            engine.depth[host] * 0.045 +
            Math.cos(angle) * orbitRadius +
            engine.vx[host] * seed.drag;
          sprite.y =
            engine.y[host] +
            engine.depth[host] * 0.08 +
            Math.sin(angle) * orbitRadius * seed.lift +
            engine.vy[host] * seed.drag;
          sprite.scale.set(seed.scale * depthFactor);
          sprite.alpha = Math.min(0.48, seed.alpha + depthFactor * 0.08 + engine.energy[host] * 0.12);
        }

        metricFrame += 1;
        if (metricsElapsed >= 0.12) {
          metricsElapsed = 0;
          onMetricsRef.current(engine.getMetrics());
        }
      });
    }

    createScene();

    return () => {
      cancelled = true;
      onBackendChangeRef.current?.("js");
      resizeObserver?.disconnect();
      if (app) {
        app.destroy(true, true);
      }
    };
  }, [runId]);

  return (
    <div
      ref={hostRef}
      className="field-grid absolute inset-0 overflow-hidden rounded-none [mask-image:radial-gradient(circle_at_center,black_60%,transparent_100%)]"
    />
  );
}

function createNodeTexture(
  PIXI: Awaited<typeof import("pixi.js")>,
  app: import("pixi.js").Application
) {
  const circle = new PIXI.Graphics();
  circle.beginFill(0xffffff, 1);
  circle.drawCircle(6, 6, 3);
  circle.endFill();
  circle.beginFill(0xffffff, 0.12);
  circle.drawCircle(6, 6, 8);
  circle.endFill();

  return app.renderer.generateTexture(circle);
}

function createMoteTexture(
  PIXI: Awaited<typeof import("pixi.js")>,
  app: import("pixi.js").Application
) {
  const circle = new PIXI.Graphics();
  circle.beginFill(0xffffff, 1);
  circle.drawCircle(4, 4, 1.3);
  circle.endFill();
  circle.beginFill(0xffffff, 0.16);
  circle.drawCircle(4, 4, 3.5);
  circle.endFill();

  return app.renderer.generateTexture(circle);
}

function createStarTexture(
  PIXI: Awaited<typeof import("pixi.js")>,
  app: import("pixi.js").Application
) {
  const circle = new PIXI.Graphics();
  circle.beginFill(0xffffff, 1);
  circle.drawCircle(3, 3, 1.1);
  circle.endFill();
  circle.beginFill(0xffffff, 0.08);
  circle.drawCircle(3, 3, 3);
  circle.endFill();

  return app.renderer.generateTexture(circle);
}

function drawField(
  graphics: import("pixi.js").Graphics,
  engine: ZetaFieldEngine,
  showField: boolean
) {
  graphics.clear();

  if (!showField) {
    return;
  }

  graphics.lineStyle(1, 0xff8a3d, 0.18);
  graphics.moveTo(engine.poleX, 0);
  graphics.lineTo(engine.poleX, engine.height);

  graphics.lineStyle(1, 0x2ce4ff, 0.06);
  graphics.drawCircle(engine.centerX, engine.centerY, Math.min(engine.width, engine.height) * 0.16);
  graphics.drawCircle(engine.centerX, engine.centerY, Math.min(engine.width, engine.height) * 0.26);
  graphics.drawCircle(engine.centerX, engine.centerY, Math.min(engine.width, engine.height) * 0.36);
  graphics.drawCircle(engine.centerX, engine.centerY, Math.min(engine.width, engine.height) * 0.47);

  for (let order = 1; order <= engine.config.zetaDepth; order += 3) {
    graphics.lineStyle(1, order === 1 ? 0xff8a3d : 0x6fe6ff, order === 1 ? 0.08 : 0.035);
    graphics.drawCircle(engine.poleX, engine.centerY, order * 18);
  }
}

function drawLinks(
  graphics: import("pixi.js").Graphics,
  engine: ZetaFieldEngine,
  showLinks: boolean
) {
  graphics.clear();

  if (!showLinks) {
    return;
  }

  for (let index = 0; index < engine.linkCount; index += 1) {
    const offset = index * 4;
    graphics.lineStyle(1, 0xaaf7ff, 0.08 + engine.linkStrengths[index] * 0.3);
    graphics.moveTo(engine.linkPositions[offset], engine.linkPositions[offset + 1]);
    graphics.lineTo(engine.linkPositions[offset + 2], engine.linkPositions[offset + 3]);
  }
}

function createMoteSeeds(hostCount: number) {
  return Array.from({ length: ORBITAL_MOTE_COUNT }, (_, index) => {
    const hostIndex = index % hostCount;
    const orbit = Math.floor(index / hostCount);
    const seed = seeded(index * 17.13 + 9.1);

    return {
      hostIndex,
      offset: seed * Math.PI * 2,
      speed: 1.1 + orbit * 0.18 + seeded(index * 3.2) * 0.25,
      baseRadius: 8 + orbit * 4 + seeded(index * 7.4) * 12,
      scale: 0.12 + orbit * 0.015 + seeded(index * 6.8) * 0.04,
      alpha: 0.05 + seeded(index * 2.4) * 0.08,
      lift: 0.55 + seeded(index * 4.3) * 0.65,
      drag: 0.2 + seeded(index * 8.7) * 0.7,
      tint: orbit % 2 === 0 ? 0xffd788 : 0x7de9ff
    };
  });
}

function createStarSeeds() {
  return Array.from({ length: AMBIENT_ATOM_COUNT }, (_, index) => ({
    x: seeded(index * 9.17) * 1.2,
    y: seeded(index * 4.73 + 1.9) * 1.2,
    scale: 0.08 + seeded(index * 5.81) * 0.26,
    alpha: 0.03 + seeded(index * 7.39) * 0.12,
    driftX: (seeded(index * 11.11) - 0.5) * 5,
    driftY: (seeded(index * 6.23) - 0.5) * 4,
    twinkle: 0.5 + seeded(index * 3.17) * 2.1,
    offset: seeded(index * 13.07) * Math.PI * 2,
    tint: index % 9 === 0 ? 0xffcc88 : index % 7 === 0 ? 0x82eeff : 0xffffff
  }));
}

function drawStarfield(
  sprites: import("pixi.js").Sprite[],
  seeds: ReturnType<typeof createStarSeeds>,
  width: number,
  height: number,
  elapsed: number,
  zoom: number
) {
  for (let index = 0; index < sprites.length; index += 1) {
    const sprite = sprites[index];
    const seed = seeds[index];
    const twinkle = 0.65 + Math.sin(elapsed * seed.twinkle + seed.offset) * 0.35;
    const wrappedWidth = width + 48;
    const wrappedHeight = height + 48;

    sprite.x = wrap(seed.x * width + elapsed * seed.driftX * 3, wrappedWidth) - 24;
    sprite.y = wrap(seed.y * height + elapsed * seed.driftY * 3, wrappedHeight) - 24;
    sprite.scale.set(seed.scale * (1.15 - (zoom - 1) * 0.08) * twinkle);
    sprite.alpha = seed.alpha * (0.8 + twinkle * 0.7);
  }
}

function seeded(value: number) {
  return value - Math.floor(value);
}

function wrap(value: number, max: number) {
  return ((value % max) + max) % max;
}
