/**
 * Encoder golden vectors for car programs in other languages:
 *   npm run sim:golden
 * Writes onboard/tests/golden/encoder-v<FEATURE_VERSION>.json with sensed
 * observations (sim units, plus real units where the scale is not 1) and the
 * features encodeObservation() makes of them. Deterministic: rerunning it
 * reproduces the file byte for byte.
 */
import { writeFileSync } from 'node:fs';
import { observationToReal, PROTOCOL_VERSION } from '../src/bridge';
import { encodeObservation, FEATURE_VERSION, RuleBasedAgent, Simulation, type Observation } from '../src/sim';

const RUNS = [
  { profile: 'ideal', seed: 1 },
  { profile: 'passenger-car', seed: 1 },
  { profile: 'rc-pi', seed: 1 },
];
const MAX_STEPS = 2400;

/** The first observation of each kind per run, so every encoder branch shows up. */
const KINDS: Record<string, (o: Observation) => boolean> = {
  start: (o) => o.time === 0,
  'light-green': (o) => o.route.nextStop?.light === 'green',
  'light-yellow': (o) => o.route.nextStop?.light === 'yellow',
  'light-red': (o) => o.route.nextStop?.light === 'red',
  'light-unknown': (o) => o.route.nextStop?.light === 'unknown',
  'light-none': (o) => o.route.nextStop?.light === 'none',
  'no-stop': (o) => o.route.nextStop === null,
  crowded: (o) => o.vehicles.length >= 5 && o.pedestrians.length >= 3,
};

const cases: object[] = [];
for (const { profile, seed } of RUNS) {
  const sim = new Simulation({ seed, profile });
  if (!sim.spawnEgo()) throw new Error(`Could not place the ego vehicle (${profile}, seed ${seed})`);
  const agent = new RuleBasedAgent();
  const todo = new Set(Object.keys(KINDS));
  for (let step = 0; step < MAX_STEPS && todo.size > 0 && !sim.episodeDone; step++) {
    const obs = sim.observe();
    for (const kind of [...todo].filter((k) => KINDS[k]!(obs))) {
      todo.delete(kind);
      const scale = sim.platform.scale;
      const features = Array.from(encodeObservation(obs, sim.config.sensors));
      const real = scale === 1 ? undefined : observationToReal(obs, scale);
      cases.push({ name: `${profile}/seed${seed}/${kind}`, profile, scale, sensors: sim.config.sensors, observation: obs, real, features });
    }
    sim.step(agent.act(sim.observeIdeal()));
  }
}

const path = new URL(`../onboard/tests/golden/encoder-v${FEATURE_VERSION}.json`, import.meta.url);
const header = { featureVersion: FEATURE_VERSION, protocol: PROTOCOL_VERSION, generator: 'npm run sim:golden', units: 'observation: sim units; real: wire units (observation divided by scale)' };
const body = `${JSON.stringify(header).slice(0, -1)},"cases":[\n${cases.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`;
writeFileSync(path, body);
console.log(`wrote ${cases.length} cases to ${path.pathname}`);
