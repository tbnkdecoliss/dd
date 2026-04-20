"use client";

import { useEffect, useRef } from "react";

import { ZetaFieldEngine } from "@/lib/zeta-sim/engine";
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
};

export function ZetaViewport({ controls, preset, runId, onMetrics }: ZetaViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef(controls);
  const presetRef = useRef(preset);
  const onMetricsRef = useRef(onMetrics);

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
      const graphicsField = new PIXI.Graphics();
      const graphicsLinks = new PIXI.Graphics();
      const nodes = new PIXI.Container();
      const spriteTexture = createNodeTexture(PIXI, app);
      const sprites = Array.from({ length: engine.count }, () => {
        const sprite = new PIXI.Sprite(spriteTexture);
        sprite.anchor.set(0.5);
        nodes.addChild(sprite);
        return sprite;
      });

      app.stage.addChild(graphicsField);
      app.stage.addChild(graphicsLinks);
      app.stage.addChild(nodes);

      const handleResize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        engine.resize(width, height);
      };

      handleResize();
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(host);

      let metricFrame = 0;

      app.ticker.add(() => {
        engine.setControls(controlsRef.current, presetRef.current);
        engine.step(Math.min(app!.ticker.deltaMS / 1000, 0.04));

        drawField(graphicsField, engine, controlsRef.current.showField);
        drawLinks(graphicsLinks, engine, controlsRef.current.showLinks);

        for (let index = 0; index < sprites.length; index += 1) {
          const sprite = sprites[index];
          const intensity = Math.min(1, 0.36 + engine.energy[index] * 1.6);

          sprite.x = engine.x[index];
          sprite.y = engine.y[index];
          sprite.tint = engine.getTint(index);
          sprite.scale.set(engine.size[index] + engine.energy[index] * 0.7);
          sprite.alpha = 0.62 + intensity * 0.32;
        }

        metricFrame += 1;
        if (metricFrame % 4 === 0) {
          onMetricsRef.current(engine.getMetrics());
        }
      });
    }

    createScene();

    return () => {
      cancelled = true;
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
  circle.drawCircle(10, 10, 10);
  circle.endFill();
  circle.beginFill(0xffffff, 0.18);
  circle.drawCircle(10, 10, 18);
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

  graphics.lineStyle(1, 0x2ce4ff, 0.08);
  graphics.drawCircle(engine.centerX, engine.centerY, Math.min(engine.width, engine.height) * 0.18);
  graphics.drawCircle(engine.centerX, engine.centerY, Math.min(engine.width, engine.height) * 0.29);
  graphics.drawCircle(engine.centerX, engine.centerY, Math.min(engine.width, engine.height) * 0.41);
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

  for (const link of engine.links) {
    graphics.lineStyle(1, 0xaaf7ff, 0.08 + link.strength * 0.3);
    graphics.moveTo(link.fromX, link.fromY);
    graphics.lineTo(link.toX, link.toY);
  }
}
