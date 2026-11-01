/**
 * Batch evaluation (and optional dataset recording) without a browser:
 *   npm run sim:headless -- --episodes 10 --seed 3 --record runs/expert.jsonl
 */
import { RuleBasedAgent, runEpisode, Simulation, type EpisodeMetrics } from '../src/sim';
import { readArgs } from './headless/args';
import { Recorder } from './headless/recorder';
import { printReport } from './headless/report';

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const sim = new Simulation({
    seed: args.seed,
    city: { drivingSide: args.side },
    vehicleCount: args.vehicles,
    pedestrianCount: args.pedestrians,
  });
  const recorder = args.record ? new Recorder(args.record, args.recordHz, sim.config.dt) : null;
  const results: EpisodeMetrics[] = [];
  for (let ep = 0; ep < args.episodes; ep++) {
    const t0 = performance.now();
    const m = runEpisode({}, new RuleBasedAgent(), { sim, onStep: (obs, action) => recorder?.record(ep, obs, action) });
    results.push(m);
    console.log(`episode ${ep}: ${m.outcome} in ${m.time.toFixed(0)} s sim (${((performance.now() - t0) / 1000).toFixed(1)} s wall)`);
  }
  printReport(results);
  if (recorder) {
    await recorder.close();
    console.log(`recorded ${recorder.rows} rows -> ${args.record}`);
  }
}

void main();
