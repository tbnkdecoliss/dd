# Zeta Manifold Lab

Zeta Manifold Lab is a Next.js + PixiJS simulation sandbox with a Rust/WASM acceleration path for the harmonic zeta-signature solver.

The runtime HUD exposes the active solver backend:

- `Solver: WASM` means the Rust/WebAssembly path loaded successfully.
- `Solver: JS Fallback` means the application is running on the JavaScript implementation instead.

## Project Structure

- `app/`, `components/`, `lib/`
  Application source.
- `lib/zeta-sim/engine.ts`
  Core simulation engine and orchestration logic.
- `lib/zeta-sim/presets.ts`
  Preset definitions and default control values.
- `components/zeta-lab.tsx`
  HUD, controls, and top-level page composition.
- `components/zeta-viewport.tsx`
  PixiJS renderer, layered visuals, and runtime WASM loading.
- `wasm/zeta-solver/src/lib.rs`
  Rust source for the harmonic zeta-signature computation.
- `lib/wasm/zeta-solver/`
  Generated browser-ready WASM package consumed by the app.
- `.github/workflows/deploy.yml`
  GitHub Pages build and deployment workflow.

## Ubuntu 24.04 Setup

These instructions assume Ubuntu 24.04.

### System packages

```bash
sudo apt update
sudo apt install -y curl git build-essential pkg-config libssl-dev
```

### Node.js 20 via `nvm`

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Restart the shell, then:

```bash
nvm install 20
nvm use 20
node --version
npm --version
```

### Rust via `rustup`

```bash
curl https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

### WASM toolchain

Only required if you plan to modify `wasm/zeta-solver/src/lib.rs`.

```bash
cargo install wasm-pack wasm-bindgen-cli
rustup target add wasm32-unknown-unknown
```

## Local Development

Install JavaScript dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build Commands

Start the app:

```bash
npm run dev
```

Type-check the project:

```bash
npm run typecheck
```

Build the Next.js site:

```bash
npm run build
```

Rebuild the Rust/WASM package:

```bash
npm run build:wasm
```

Rebuild WASM and then build the full site:

```bash
npm run build:all
```

The generated WASM package is written to:

```text
lib/wasm/zeta-solver/
```

## Recommended Workflow

If you changed TypeScript or React code:

```bash
npm run typecheck
npm run build
```

If you changed the Rust solver:

```bash
npm run build:wasm
npm run typecheck
npm run build
```

## Git Rules

Commit these:

- `app/`
- `components/`
- `lib/`
- `wasm/zeta-solver/src/lib.rs`
- `wasm/zeta-solver/Cargo.toml`
- `wasm/zeta-solver/Cargo.lock`
- `lib/wasm/zeta-solver/`

Do not commit these:

- `node_modules/`
- `.next/`
- `out/`
- `wasm/zeta-solver/target/`
- `idea.txt`

The generated package under `lib/wasm/zeta-solver/` is intentionally checked in. GitHub Pages consumes that generated output directly, so deployment does not depend on compiling Rust in CI.

## GitHub Pages

This repository is already configured for GitHub Pages through GitHub Actions.

In the GitHub repository settings:

1. Open `Settings`.
2. Open `Pages`.
3. Set `Source` to `GitHub Actions`.

After that, a normal push to `main` will trigger deployment.

## Pre-Push Checklist

If you changed only TypeScript/React:

```bash
npm run typecheck
npm run build
```

If you changed Rust:

```bash
npm run build:wasm
npm run typecheck
npm run build
```

Then commit the generated files in `lib/wasm/zeta-solver/` if they changed.

## Troubleshooting

### `nvm: command not found`

Restart the shell. If necessary:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

### `cargo: command not found`

```bash
source "$HOME/.cargo/env"
```

### Runtime shows `Solver: JS Fallback`

The application is still functional, but the WASM asset did not load. Typical fixes:

1. Rebuild the package with `npm run build:wasm`.
2. Rebuild the site with `npm run build`.
3. Ensure `lib/wasm/zeta-solver/` is committed before deployment.

### Rust changes do not show up in the app

You likely need to regenerate the browser package:

```bash
npm run build:wasm
```

## Minimal Command Sequence

For routine work:

1. `npm ci`
2. `npm run dev`
3. make changes
4. if Rust changed, run `npm run build:wasm`
5. run `npm run typecheck`
6. run `npm run build`
7. `git add .`
8. `git commit -m "update simulation"`
9. `git push`
