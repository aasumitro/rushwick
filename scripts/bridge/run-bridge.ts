/**
 * Let a car program drive Rushwick over the bridge (software-in-the-loop):
 *   npm run sim:bridge -- --url ws://localhost:8765 --mode lockstep --profile rc-pi --episodes 3
 */
import { buildHello } from '../../src/bridge';
import { Simulation } from '../../src/sim';
import { printReport } from '../headless/report';
import { readArgs } from './args';
import { CarConnection } from './connection';
import { runLockstep } from './lockstep';
import { runRealtime } from './realtime';
import { StepLog } from './stepLog';

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  // In realtime the car program's compute delay happens for real, so the sim must not add it again.
  const latency = args.mode === 'realtime' ? 'measured' : 'modeled';
  const sim = new Simulation({ seed: args.seed, profile: args.profile, city: { drivingSide: args.side }, latency });
  const conn = await CarConnection.open(args.url);
  const log = new StepLog(args.log);
  conn.send(buildHello(sim, args.mode));
  const run = args.mode === 'realtime' ? runRealtime : runLockstep;
  try {
    const results = await run(sim, conn, log, args);
    printReport(results, `profile ${args.profile} · driven by the car program at ${args.url} (${args.mode})`);
    console.log(log.summary());
    console.log(`stateHash ${sim.stateHash()}`);
  } finally {
    conn.close();
    await log.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
