# AGENTS.md

Guidance for AI coding agents and human contributors. Read it before you change code. `CLAUDE.md` imports this file, so this is the single source of truth for project rules.

## Project

Rushwick is a browser-based 3D dense-city driving simulator for developing and testing self-driving decision models. A procedural city with signalized intersections, background traffic and pedestrians runs as a headless, deterministic simulation. One ego vehicle is driven by a pluggable `DrivingAgent`.

The same simulation runs in three places:

- the browser: React UI and Three.js renderer (`npm run dev`),
- Vitest (`npm test`),
- Node batch runs that evaluate agents and record imitation-learning datasets (`npm run sim:headless`).

Stack: TypeScript 7 (strict), React 19, Three.js, Vite 8, Vitest 5, tsx. The only runtime dependencies are `react`, `react-dom` and `three`. `src/sim` has none. The reference car program in `onboard/` is Python 3.9+ with `websockets` and `numpy` (`onnxruntime` optional) and `pytest` for tests.

User-facing documentation lives in `README.md`.

## Commands

```bash
npm install
npm run dev                  # Vite dev server on http://localhost:3000
npm run typecheck            # tsc --noEmit
npm test                     # full Vitest suite, about 1.5 minutes (the closed-loop expert tests take 30–40 s each)
npx vitest run src/sim/core  # one folder or file
npm run build                # typecheck + production bundle in dist/
npm run sim:headless -- --episodes 3 --seed 1   # headless smoke run with the rule-based agent
npm run sim:bridge -- --mode lockstep --teacher # let a running car program drive over the bridge (ws://localhost:8765)
npm run sim:golden           # regenerate onboard/tests/golden/encoder-v<FEATURE_VERSION>.json
pip install -e "onboard[test]" && pytest onboard/tests   # reference car program (use a virtualenv)
python -m rushwick_onboard --hardware sim --policy simple # car program for sim:bridge to connect to
```

Node.js 22.12 or newer is required (Vitest engines). Development and CI use Node 26.

## Layout

```
src/sim/        headless simulation core; its public API is src/sim/index.ts
  core/         math and data structures: vec2, OBB, rays, polylines, seeded Rng, SpatialGrid, MinHeap
  world/        city types, procedural generator (one stage per file), spatial queries
  traffic/      signal controller and background vehicles (IDM, lane changes, junction reservations)
  pedestrians/  sidewalk navigation, crossing rules, jaywalking
  ego/          ego dynamics, route planning, observation building and feature encoding
  platform/     platform profiles in real units (ideal, ...), their conversion to sim units, actuator and sensor models
  agents/       DrivingAgent interface and built-in agents (rule-based, manual, idle)
  simulation/   CityWorld (background world), Simulation (adds the ego episode), config, diagnostics
  metrics/      episode metrics and the composite score
  runner/       runEpisode(), the closed-loop episode runner
src/render/     read-only Three.js view of a Simulation
src/ui/         React app, fixed-step frame loop, keyboard input, settings panels
src/bridge/     bridge protocol v1 to a car program: messages, validators, real ↔ sim units, frame builder (pure TS)
scripts/        headless runner (tsx), JSONL dataset recorder, bridge runner (scripts/bridge/), golden export
onboard/        reference car program (Python package rushwick_onboard): hardware backends, loop, policies, safety layer,
                encoder and unit ports, pytest suite with the encoder golden vectors
```

Inside `src/sim`, imports only point down this stack (skipping layers is fine):

```
runner → agents, simulation → platform → ego → pedestrians → traffic → world → core
```

`platform` imports only `ego`, `world` (types) and `core`.

`metrics` imports nothing. Tests are the only files allowed to import upward.

## Hard rules

These rules protect properties the whole project depends on. Do not break them, and never weaken a test to get past them. Fix the cause instead.

1. **`src/sim` stays headless, pure TypeScript.** No `three`, React, DOM or Node APIs, no `console`, and no runtime dependencies.
2. **Determinism.** The same `(config, seed)` must always produce the same episode. `stateHash()` and `simulation.test.ts` check this.
   - Draw every random number from an `Rng` instance. Never use `Math.random()`, `Date.now()`, `performance.now()` or any other wall-clock source in `src/sim`.
   - Give new stochastic behavior its own stream with `rng.fork('<unique label>')`. Forking does not advance the parent, so existing seeds still generate the same city and traffic. Drawing extra numbers from an existing stream changes the outcome of every seed. Do that only on purpose, and say so in the commit.
   - Time advances only through `Simulation.step()` with the fixed `config.dt` (1/30 s). Nothing in the simulation may depend on frame rate or playback speed.
   - Platform sensor models sample once per physics step inside `Simulation.step()`. `observe()` and `observeIdeal()` are pure reads, so the number of calls (HUD, driver, recorder) never changes an RNG stream. `sensedEpisode.test.ts` checks this.
3. **One-way API boundary.** Code outside `src/sim` (render, UI, bridge, scripts) imports only from `src/sim/index.ts`, never from deep paths. If something is missing, export it from the index. The same holds for `src/bridge/index.ts`.
4. **The renderer is read-only.** `src/render` reads simulation state and never mutates it. Only `runEpisode()` and the UI's `EpisodeDriver` call `Simulation.step()`.
5. **Background traffic is collision-free by construction.** A vehicle must hold a reservation on its next connector before it crosses the stop line, and conflicting connectors can never be reserved at the same time. `simulation.test.ts` asserts zero vehicle-vehicle and pedestrian-vehicle overlaps. Only the ego vehicle can collide, so every collision in the metrics belongs to the agent under test.
6. **The rule-based agent drives cleanly.** It is the baseline and the imitation-learning teacher. `ruleBasedAgent.test.ts` requires zero collisions, red-light violations and curb strikes.
7. **Small files, one responsibility each.** Every source file stays under 100 lines. When a file gets close to the limit, split it by responsibility. Do not compress code to fit.
8. **No new dependencies without asking.** Prefer the standard library and code that already exists in the repo.

## Contracts

Recorded datasets, trained models and benchmark results depend on the items below. Change them only on purpose. When you do, update the tests and `README.md`, and mark the commit as breaking (`feat!:` or a `BREAKING CHANGE:` footer).

- The `encodeObservation()` layout and `featureSize()` (258 floats with the default sensors).
- `Observation` and `DrivingAction` fields, units, frames and sign conventions.
- `drivingScore()` and `PENALTY` in `src/sim/metrics/score.ts`.
- `DEFAULT_SIM_CONFIG`, `DEFAULT_CITY_CONFIG`, `DEFAULT_EGO_PARAMS`, `DEFAULT_SENSOR_CONFIG`, and anything else that changes what a given seed generates.
- The built-in platform profile values in `src/sim/platform/profiles/`. `SimConfig.profile` defaults to `'ideal'`, which must stay bit-identical to the behavior from before platform profiles existed (`idealProfile.test.ts` pins it).
- `FEATURE_VERSION` in `encoder.ts`. Bump it whenever the `encodeObservation()` layout or scaling changes; it is written into JSONL rows, the encoder golden file and the bridge `hello` message.
- Bridge protocol v1 (`src/bridge/messages.ts`): message types and fields, real units on the wire, `null` for non-finite numbers. Bump `PROTOCOL_VERSION` for a breaking change and update every car program with it. The `sim:bridge` CLI flags and its per-step log format belong to it.
- The `sim:headless` CLI flags (including `--profile` and `--teacher`) and the JSONL row format (`episode`, `t`, `profile`, `featureVersion`, `features`, `action`).

`Observation.route.nextStop.timeLeft` is privileged information that a real AV does not have. If you add another privileged field, document it the same way. Realistic platform profiles hide it (`NaN`) and may report `nextStop.light` as `'unknown'`; the encoder maps both to values it already produced (time-left feature 1, all-zero light flags), so the layout does not change. Both are part of the observation contract.

## Conventions

### Units and frames

- `src/sim` uses SI units everywhere: meters, seconds, m/s, m/s², radians. Convert to km/h or degrees only for display in the UI.
- World frame: x = east, y = north, heading counter-clockwise from +x.
- Ego frame (used in observations): x forward, y left.
- Three.js is Y-up, so sim `(x, y)` maps to `(x, height, -y)`. Only `src/render/core/coords.ts` does this conversion.
- Add a JSDoc comment with the unit or frame to every exported field where it is not obvious.

### TypeScript

- `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` and `verbatimModuleSyntax` are enabled.
- Use `import type` for type-only imports.
- Indexed access returns `T | undefined`. Use `!` or `as T` only where an invariant guarantees the value. Otherwise, handle `undefined`.

### Style

No formatter or linter is configured, so match the surrounding code.

- 2-space indent, single quotes, semicolons, trailing commas in multi-line literals.
- File names are `camelCase.ts`. React components use `PascalCase.tsx`.
- Classes, interfaces and types use `PascalCase`. Constants use `UPPER_SNAKE_CASE`.
- Module folders with an `index.ts` (for example `agents/`, `pedestrians/`, `traffic/vehicles/`, `ego/observation/`) expose their public surface there. Import through that index when you cross a module boundary.
- Put tunable numbers in the existing config and tuning objects (`DEFAULT_*`, `TUNING`, `PENALTY`), not in scattered literals.
- Comments explain why, not what. Write code, comments, docs and commit messages in English.

### Python (`onboard/`)

- Python 3.9+ (the Raspberry Pi runs 3.11): `from __future__ import annotations`, type hints, `typing` instead of `X | Y` at runtime.
- 4-space indent, double quotes, snake_case modules. Files stay under 100 lines, like the TypeScript code.
- Mirror the TypeScript contracts exactly: `encoder.py` follows `encoder.ts` (golden vectors), `units.py` follows `src/bridge/units.ts`, `loop.py` speaks bridge protocol v1.
- Policies never command the hardware directly; everything goes through `safety.py`.

### Performance

- The simulation steps hundreds of vehicles and pedestrians at 30 Hz, and batch runs execute thousands of episodes. Use `SpatialGrid` for neighbor queries instead of all-pairs scans, and do not allocate inside per-step hot loops.
- Render many similar objects with `InstancedMesh`. Release GPU resources with `disposeObject()` when you rebuild a layer.
- Rendered agents keep `prevX`, `prevY` and `prevHeading` so that the renderer can interpolate between fixed steps.

## Testing

- Vitest runs in the `node` environment on colocated `src/**/*.test.ts` files. `src/sim` and `src/bridge` have tests. Check render and UI changes in the browser with `npm run dev`.
- Tests assert behavior and invariants (determinism, zero background overlaps, clean expert driving), not implementation details.
- Add a test next to new simulation logic. Keep test worlds small (short `warmupTime`, fewer vehicles), as the existing tests do.
- The default test timeout is 60 s. Long closed-loop tests pass their own `{ timeout }`.

## Common changes

- **New decision model.** Implement `DrivingAgent` from `src/sim/agents/types.ts`.
  - A pure-TypeScript agent goes in `src/sim/agents/<name>/`. Export it from `src/sim/agents/index.ts` and `src/sim/index.ts`.
  - An agent that needs an ML runtime lives outside `src/sim` and imports the types from `src/sim`.
  - To make it selectable in the UI, extend `AgentKind` in `src/ui/settings.ts`, and `createAgent` and `AGENT_LABELS` in `src/ui/controller/agentFactory.ts`.
  - `scripts/run-headless.ts` currently always uses `RuleBasedAgent`.
- **New observation field.** Update `src/sim/ego/observation/types.ts`, the matching sensor file, `builder.ts`, `encoder.ts` and its size constants, `encoder.test.ts`, and the README observation section. If the features change, bump `FEATURE_VERSION`, regenerate the golden file with `npm run sim:golden` and port the change to every car program's encoder. This is a contract change.
- **New metric.** Update `src/sim/metrics/types.ts` and `tracker.ts`, and `score.ts` only if the metric is an infraction. Then show it in `src/ui/components/MetricsPanel.tsx` and `scripts/headless/report.ts`, and document it in the README.
- **New vehicle kind.** Add it to `src/sim/traffic/vehicles/specs.ts`, then add a 3D model to `MODELS` in `src/render/agents/vehicleLayer.ts`.
- **New platform profile.** Write it in real units (as measured on the bench) as one file in `src/sim/platform/profiles/`, register it in `PLATFORM_PROFILES`, and note the date and method next to every measured value. `resolveProfile()` converts it to sim units; never pre-scale values by hand. World defaults go in `profile.world` (sim units) and lose to explicit input.
- **New sensor channel.** Write its reader as one file in `src/sim/platform/sensors/` with its config in `sensors/types.ts` (real units, converted in `scale.ts`). Draw noise only in the reader, which `TimedChannel` calls on the channel's ticks inside `Simulation.step()`, from its own `rng.fork('sensors:<channel>')` stream. Keep the observation layout: hide data through values (absent agents, `range` for empty rays, `NaN` time left), not new fields. Add a unit test next to it.
- **New city generation stage.** Write it as one file in `src/sim/world/generator/` and call it in order from `generateCity()` in `index.ts`. If the stage is random, give it its own `rng.fork()` label.
- **New UI setting.** Add it to `src/ui/settings.ts`. `WorldSettings` regenerate the city (`WorldPanel`, `SimController.loadWorld`). `LiveSettings` apply immediately (`RuntimePanel`, `SimController.applyLive`).

## Before you finish

1. `npm run typecheck` and `npm test` pass. Also run `npm run build` when you changed `src/render`, `src/ui` or the Vite config, and `pytest onboard/tests` when you changed `onboard/`, the bridge protocol or the encoder.
2. For visual or UI changes, run `npm run dev` and check the result in the browser.
3. Update `README.md` when controls, CLI flags, observations, metrics, the baseline or the known limitations change.
4. Work on a branch and open a pull request into `main`. CI (`.github/workflows/ci.yml`) runs the typecheck, build and tests, and it must pass.
5. Write commit messages in English with Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `ci:`, `chore:`. Add `!` for breaking contract changes.
6. Never commit `dist/`, `node_modules/` or recorded datasets in `runs/`.
