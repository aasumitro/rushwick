# Rushwick

**A dense-city driving simulator that runs in your browser, built for testing self-driving decision models.**

Rushwick generates a busy procedural city with arterial roads, signalized intersections, buses, motorbikes and jaywalking pedestrians. It drops an ego vehicle into that city and hands your model a ready-made observation every step. You can watch the model drive in 3D, or run thousands of deterministic episodes headless in Node and record datasets for imitation learning.

React · TypeScript · Three.js · Vite · Vitest

---

## Highlights

- **Procedural city.** Grid of two-lane-per-direction arterials and local streets, sidewalks, crosswalks, parks, trees, and buildings that grow taller toward downtown.
- **Realistic signals.** Fixed-time, multi-stage traffic lights with permissive or protected turns, plus pedestrian walk signals.
- **Live traffic.** Cars, SUVs, taxis, motorbikes, buses and trucks. IDM car-following, lane changes, intersection reservations and don't-block-the-box logic.
- **Pedestrians.** They walk the sidewalk network, cross at crosswalks on the walk signal, and sometimes jaywalk.
- **Left- or right-hand traffic.** Drive on the left (Indonesia, Japan, UK) or on the right (US, EU, China).
- **Model-ready ego vehicle.** Kinematic bicycle model, structured observation, 258-float feature encoder, episode metrics and a composite score.
- **Deterministic and headless.** The same `(config, seed)` always produces the same episode, in the browser, in tests, and in Node.

## Quick start

Requires a recent Node.js (developed on Node 26).

```bash
npm install
npm run dev        # http://localhost:3000
```

The ego car starts on **autopilot** (the rule-based baseline agent). Use the side panels to change the seed, driving side, signal mode, traffic and pedestrian density, jaywalking rate, decision model, camera, and simulation speed (0.5× to 8×).

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrow keys | Drive (when the decision model is set to manual) |
| `Space` | Pause / resume |
| `N` | Start a new episode |
| `C` | Cycle camera: chase, orbit, top, driver |

## Plug in your decision model

A decision model is any object that implements `DrivingAgent`. It receives an `Observation` every control step and returns a `DrivingAction`.

```ts
import {
  encodeObservation, runEpisode,
  type DrivingAction, type DrivingAgent, type Observation,
} from './src/sim';

class MyModel implements DrivingAgent {
  readonly name = 'my-model';

  act(obs: Observation): DrivingAction {
    const x = encodeObservation(obs); // Float32Array(258), roughly unit-scaled
    // ...run your network on x...
    return { acceleration: 0, steering: 0 };
  }
}

const metrics = runEpisode({ seed: 7 }, new MyModel());
console.log(metrics.outcome, metrics.score);
```

**Action**

| Field | Unit | Range |
| --- | --- | --- |
| `acceleration` | m/s² (negative = brake) | clamped to `[-8, 3]` |
| `steering` | normalized front-wheel angle (positive = left) | `[-1, 1]` |

**Observation** (all positions in the ego frame: x forward, y left)

- Ego state: speed, acceleration, steering, yaw rate, vehicle dimensions.
- Route: 24 waypoints with speed limits (dense near the car for accurate curvature), lateral and heading error, remaining distance.
- Next stop line: distance, light state, and time until the light changes.
- The 10 nearest vehicles and the 10 nearest pedestrians: relative position, heading, velocity, size.
- 32-ray 2D lidar with 50 m range.

> [!NOTE]
> `route.nextStop.timeLeft` is privileged information that a real AV does not have. Remove it if you want a sim-to-real-honest model.

**Feature vector** from `encodeObservation()`. Missing agents are zero-padded with a presence flag of 0.

```
ego(5) | waypoints(24×3) | route(3) | stop(6) | vehicles(10×9) | pedestrians(10×5) | lidar(32)  = 258
```

## Headless runs and datasets

Run batch evaluation in Node with the rule-based agent. Add `--record` to write `(features, action)` pairs as JSON Lines for imitation learning.

```bash
npm run sim:headless -- --episodes 10 --seed 3 --record runs/expert.jsonl
```

| Option | Default | Description |
| --- | --- | --- |
| `--episodes N` | `5` | Number of episodes to run |
| `--seed N` | `1` | City and traffic seed |
| `--side left\|right` | `left` | Driving side |
| `--vehicles N` | `260` | Background vehicles |
| `--pedestrians N` | `520` | Pedestrians |
| `--record FILE` | none | Output JSONL file |
| `--record-hz N` | `10` | Recording rate in Hz |

Each recorded line looks like this:

```json
{"episode":0,"t":1.2,"features":[0.41,0.02,...],"action":{"acceleration":1.5,"steering":-0.03}}
```

## Metrics

Each episode ends with one outcome: `success`, `collision`, `offroad`, `off_route`, `timeout` or `stuck`.

`EpisodeMetrics` also reports route completion, vehicle and pedestrian collisions, red-light violations, off-road events and time, pedestrian near-misses, mean speed, jerk (max and RMS), max lateral acceleration, minimum time-to-collision and stopped time.

`score` is a composite in `[0, 1]`: completion multiplied by infraction penalties. It is inspired by the CARLA driving score but is **not** the same formula. Keep it fixed across experiments so that results stay comparable.

## Baseline

The built-in rule-based agent uses curvature feed-forward with a Stanley controller for steering, IDM for speed, and explicit amber-light logic. On 18 episodes (6 seeds, left- and right-hand traffic) it scored:

**14 success, 3 timeout, 1 stuck, 0 infractions** (no collisions, no red-light violations, no off-road events).

Every failure came from driving too passively, never from driving unsafely. That makes it a useful safe teacher for imitation learning, and a clear target for learned models to beat.

## Architecture

```
src/
  sim/                 simulation core: headless, deterministic, no three.js or DOM
    core/              vectors, OBB, rays, polylines, seeded RNG, spatial grid, heap
    world/types/       city data types (road network, intersections, sidewalks, blocks)
    world/generator/   city generator, one stage per file:
                       layout → roads → connectors → conflicts → crosswalks → signals → sidewalks → buildings
    traffic/signals/   signal controller (state is a pure function of time)
    traffic/vehicles/  background traffic: reservations, leaders, obstacles, IDM, lane change, motion, pose
    pedestrians/       navigation, crossing rules, jaywalking, locomotion
    ego/               ego dynamics, routing (Dijkstra + path assembly), observation and feature encoder
    agents/            DrivingAgent interface, rule-based baseline/teacher, manual, idle
    simulation/        CityWorld (background) → Simulation (+ ego episode), evaluation, diagnostics
    metrics/           episode metrics and score
    runner/            runEpisode() for batch evaluation
    index.ts           public API: renderer, UI and scripts import only from here
  render/              read-only Three.js view (instanced meshes, city layers, camera, overlays)
  ui/                  React app: fixed-step loop, input, hooks, panels
scripts/               headless runner and JSONL dataset recorder
```

Design principles:

- **Simulation is separate from rendering.** The same simulation runs in the browser, in Vitest, and in Node for thousands of episodes.
- **Deterministic by design.** `(config, seed)` always reproduces the same episode, verified with `stateHash`. Reproducible benchmarks and datasets depend on this.
- **Collision-free background traffic by construction.** A vehicle must hold a connector reservation before it crosses the stop line, and conflicting connectors can never be reserved at the same time. IDM braking is kinematically bounded so trucks and buses never creep past the line. Only the ego vehicle can collide, so every collision in the metrics belongs to your model.
- **Small, focused modules.** Every source file is under 100 lines and has one responsibility.

## Development

```bash
npm run dev          # dev server with hot reload
npm test             # Vitest suite
npm run test:watch   # Vitest in watch mode
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build to dist/
npm run preview      # serve the production build
```

## Known limitations

- The city is a procedural grid, not a real map. OpenStreetMap import is not available yet.
- Motorbikes stay in their lane. There is no lane filtering as seen in cities like Real City.
- Signals are fixed-time with random offsets. There are no green waves and no adaptive control.
- Background drivers are rule-based and polite. There are no aggressive drivers or adversarial scenarios yet.
- Pedestrians do not avoid each other. If a car blocks them for too long they slip past it (visual overlap only), but they never pass through the ego vehicle.
- A model trained only in Rushwick learns the rules of Rushwick. Measure the sim-to-real gap separately.
