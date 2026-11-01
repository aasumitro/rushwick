/**
 * Batch evaluation (and optional dataset recording) without a browser:
 *   npm run sim:headless -- --episodes 10 --seed 3 --record runs/expert.jsonl
 *   npm run sim:headless -- --profile rc-pi --teacher ideal --record runs/rc-pi.jsonl
 */
import { RuleBasedAgent, runEpisode, Simulation, type EpisodeMetrics, type SimConfigInput } from '../src/sim';
import { readArgs } from './headless/args';
import { Recorder } from './headless/recorder';
import { printReport } from './headless/report';

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const input: SimConfigInput = { seed: args.seed, profile: args.profile, city: { drivingSide: args.side } };
  // Left out unless given, so the profile's world (an empty track for rc-pi) applies.
  if (args.vehicles !== undefined) input.vehicleCount = args.vehicles;
  if (args.pedestrians !== undefined) input.pedestrianCount = args.pedestrians;
  const sim = new Simulation(input);
  const recorder = args.record ? new Recorder(args.record, args.recordHz, sim.config.dt, args.profile, sim.config.sensors) : null;
  const privileged = args.teacher === 'ideal';
  const results: EpisodeMetrics[] = [];
  for (let ep = 0; ep < args.episodes; ep++) {
    const t0 = performance.now();
    const m = runEpisode({}, new RuleBasedAgent(), { sim, privileged, onStep: (obs, action) => recorder?.record(ep, obs, action) });
    results.push(m);
    console.log(`episode ${ep}: ${m.outcome} in ${m.time.toFixed(0)} s sim (${((performance.now() - t0) / 1000).toFixed(1)} s wall)`);
  }
  printReport(results, `profile ${args.profile} · expert acts on ${privileged ? 'exact (privileged)' : 'sensed'} observations`);
  if (recorder) {
    await recorder.close();
    console.log(`recorded ${recorder.rows} rows -> ${args.record}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
