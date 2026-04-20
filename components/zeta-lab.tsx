"use client";

import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import {
  Eye,
  EyeOff,
  Orbit,
  RotateCcw,
  Sparkles,
  Waves
} from "lucide-react";

import { ZetaViewport } from "@/components/zeta-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_METRICS, PRESETS, PRESET_MAP } from "@/lib/zeta-sim/presets";
import type { PresetId, SimulationControls, SimulationMetrics } from "@/lib/zeta-sim/types";
import { cn } from "@/lib/utils";

const INITIAL_PRESET = PRESET_MAP.baseline;
const INITIAL_CONTROLS: SimulationControls = {
  ...INITIAL_PRESET.config,
  showLinks: true,
  showField: true
};

export function ZetaLab() {
  const [presetId, setPresetId] = useState<PresetId>(INITIAL_PRESET.id);
  const [controls, setControls] = useState<SimulationControls>(INITIAL_CONTROLS);
  const [metrics, setMetrics] = useState<SimulationMetrics>(DEFAULT_METRICS(INITIAL_PRESET.label));
  const [runId, setRunId] = useState(0);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [log, setLog] = useState<string[]>([
    "Initialized 130 zeta centers across 7 active bands.",
    "Rendering strategy: PixiJS viewport + typed-array solver.",
    "zeta(1) is modeled as a clamped pole lens, not a finite constant."
  ]);
  const previousMutationCount = useRef(0);
  const [isPending, startTransition] = useTransition();
  const deferredMetrics = useDeferredValue(metrics);
  const preset = PRESET_MAP[presetId];

  useEffect(() => {
    setLog((current) =>
      [
        `Proxy event loaded: ${preset.label}.`,
        preset.narrative,
        ...current
      ].slice(0, 9)
    );
  }, [preset]);

  useEffect(() => {
    if (metrics.mutationEvents > previousMutationCount.current) {
      setLog((current) =>
        [
          `Mutation threshold breached. Total events: ${metrics.mutationEvents}.`,
          ...current
        ].slice(0, 9)
      );
      previousMutationCount.current = metrics.mutationEvents;
    }
  }, [metrics.mutationEvents]);

  const setNumericControl = <K extends keyof SimulationControls>(key: K, value: SimulationControls[K]) => {
    setControls((current) => ({
      ...current,
      [key]: value
    }));
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,140,66,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,224,255,0.12),transparent_30%)]" />
      <ZetaViewport controls={controls} preset={preset} runId={runId} onMetrics={setMetrics} />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute right-4 top-4 z-30 flex gap-3 md:right-6 md:top-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRunId((current) => current + 1);
              previousMutationCount.current = 0;
              setMetrics(DEFAULT_METRICS(preset.label));
              setLog((current) => ["Field reseeded from current preset.", ...current].slice(0, 9));
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset Field
          </Button>
          <Button variant="outline" size="sm" onClick={() => setControlsHidden((current) => !current)}>
            {controlsHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {controlsHidden ? "Show Controls" : "Hide Controls"}
          </Button>
        </div>

        <section className="absolute left-4 top-4 z-20 flex w-[min(30rem,calc(100vw-2rem))] max-w-full flex-col gap-4 md:left-6 md:top-6">
          <Card className="animate-drift overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="accent">Zeta Manifold Lab</Badge>
                <Badge variant="cyan">{deferredMetrics.presetLabel}</Badge>
                {isPending ? <Badge>Updating</Badge> : null}
              </div>
              <div className="space-y-3">
                <CardTitle className="max-w-xl text-3xl leading-tight text-white md:text-4xl">
                  A cinematic sandbox for a pole-at-1 zeta interpretation.
                </CardTitle>
                <CardDescription className="max-w-2xl text-[15px] text-white/72">
                  The scene treats <span className="font-mono text-white">zeta(1)</span> as a singular
                  field lens and uses <span className="font-mono text-white">zeta(2) + zeta(-1)</span> as a
                  stable normalization factor for the force system.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard label="Active Centers" value={String(deferredMetrics.totalCount)} icon={Orbit} />
            <MetricCard label="Active Bands" value={String(deferredMetrics.activeBands)} icon={Waves} />
            <MetricCard
              label="Bonded Pairs"
              value={String(deferredMetrics.bondCount)}
              icon={Sparkles}
            />
            <MetricCard label="Mutation Events" value={String(deferredMetrics.mutationEvents)} icon={Sparkles} />
            <MetricCard label="Mean Energy" value={deferredMetrics.meanEnergy.toFixed(3)} icon={Orbit} />
            <MetricCard label="Frame Time" value={`${deferredMetrics.frameTime.toFixed(2)} ms`} icon={Waves} />
          </div>

          <Card className="max-w-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm uppercase tracking-[0.24em] text-white/75">
                Session Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-xs leading-6 text-emerald-200/90">
                {log.map((entry, index) => (
                  <div key={`${entry}-${index}`} className="truncate">
                    {`> ${entry}`}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <aside
          className={cn(
            "pointer-events-auto absolute bottom-4 right-4 top-20 z-20 w-[min(25rem,calc(100vw-2rem))] transition duration-300 md:bottom-6 md:right-6 md:top-24",
            controlsHidden && "translate-x-[120%] opacity-0"
          )}
        >
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader className="gap-3 border-b border-white/8 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl text-white">Proxy Event Controls</CardTitle>
                  <CardDescription>{preset.description}</CardDescription>
                </div>
                <div
                  className={cn(
                    "rounded-full bg-gradient-to-r px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-950",
                    preset.accent
                  )}
                >
                  Live
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-6 overflow-y-auto pb-6 pt-6">
              <ControlBlock
                label="Proxy Event"
                value={preset.label}
                helper="Swap the entire force narrative without leaving the current page."
              >
                <Select
                  value={presetId}
                  onValueChange={(value) => {
                    const nextPreset = PRESET_MAP[value as PresetId];
                    startTransition(() => {
                      previousMutationCount.current = 0;
                      setPresetId(nextPreset.id);
                      setMetrics(DEFAULT_METRICS(nextPreset.label));
                      setControls((current) => ({
                        ...current,
                        ...nextPreset.config
                      }));
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ControlBlock>

              <ControlBlock
                label="Bond Strength"
                value={`${controls.force.toFixed(2)}x`}
                helper="Amplifies attraction and repulsion at the same time."
              >
                <Slider
                  min={0.3}
                  max={2}
                  step={0.05}
                  value={[controls.force]}
                  onValueChange={([value]) => setNumericControl("force", value)}
                />
              </ControlBlock>

              <ControlBlock
                label="Interaction Radius"
                value={`${Math.round(controls.radius)} px`}
                helper="Sets how far each center can feel nearby neighbors."
              >
                <Slider
                  min={140}
                  max={600}
                  step={10}
                  value={[controls.radius]}
                  onValueChange={([value]) => setNumericControl("radius", value)}
                />
              </ControlBlock>

              <ControlBlock
                label="Sync Velocity"
                value={controls.syncVelocity.toFixed(3)}
                helper="Controls how quickly orbital phases advance."
              >
                <Slider
                  min={0.005}
                  max={0.09}
                  step={0.005}
                  value={[controls.syncVelocity]}
                  onValueChange={([value]) => setNumericControl("syncVelocity", value)}
                />
              </ControlBlock>

              <ControlBlock
                label="Mutation Threshold"
                value={controls.mutationThreshold.toFixed(2)}
                helper="Lower values make charge and band shifts happen faster."
              >
                <Slider
                  min={0.5}
                  max={1.8}
                  step={0.05}
                  value={[controls.mutationThreshold]}
                  onValueChange={([value]) => setNumericControl("mutationThreshold", value)}
                />
              </ControlBlock>

              <ControlBlock
                label="Pole Pressure"
                value={controls.polePressure.toFixed(2)}
                helper="Strength of the clamped zeta(1) singular lens."
              >
                <Slider
                  min={0.2}
                  max={1.6}
                  step={0.05}
                  value={[controls.polePressure]}
                  onValueChange={([value]) => setNumericControl("polePressure", value)}
                />
              </ControlBlock>

              <ControlBlock
                label="Turbulence"
                value={controls.turbulence.toFixed(2)}
                helper="Injects local noise for more dramatic branching."
              >
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[controls.turbulence]}
                  onValueChange={([value]) => setNumericControl("turbulence", value)}
                />
              </ControlBlock>

              <div className="grid grid-cols-2 gap-3">
                <ToggleButton
                  active={controls.showLinks}
                  label="Bonds On"
                  offLabel="Bonds Off"
                  onClick={() => setNumericControl("showLinks", !controls.showLinks)}
                />
                <ToggleButton
                  active={controls.showField}
                  label="Guides On"
                  offLabel="Guides Off"
                  onClick={() => setNumericControl("showField", !controls.showField)}
                />
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                  Math Note
                </div>
                The viewport treats <span className="font-mono text-white">zeta(1)</span> as a pole and
                clamps its visual force so the system remains stable enough to explore interactively.
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof Orbit;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</div>
          <div className="mt-2 text-xl font-semibold text-white">{value}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 p-3 text-cyan-200">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function ControlBlock({
  label,
  value,
  helper,
  children
}: {
  label: string;
  value: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="font-mono text-xs text-cyan-200">{value}</div>
      </div>
      {children}
      <div className="text-xs leading-5 text-white/45">{helper}</div>
    </div>
  );
}

function ToggleButton({
  active,
  label,
  offLabel,
  onClick
}: {
  active: boolean;
  label: string;
  offLabel: string;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? "default" : "outline"} onClick={onClick}>
      {active ? label : offLabel}
    </Button>
  );
}
