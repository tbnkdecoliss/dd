export type WasmSignatureSolver = {
  compute(phases: Float32Array, bands: Uint8Array, depth: number): Float32Array;
};

let solverPromise: Promise<WasmSignatureSolver | null> | null = null;

export function loadWasmSignatureSolver() {
  if (!solverPromise) {
    solverPromise = import("@/lib/wasm/zeta-solver/zeta_solver")
      .then(async (module) => {
        await module.default();

        return {
          compute(phases: Float32Array, bands: Uint8Array, depth: number) {
            return module.compute_zeta_signatures(phases, bands, depth);
          }
        };
      })
      .catch(() => null);
  }

  return solverPromise;
}
