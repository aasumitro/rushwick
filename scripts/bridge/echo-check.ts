/**
 * SIL echo check. The reference car program with `--policy echo` sends back the
 * privileged teacher's action from every frame, so a lockstep bridge run must
 * reproduce an in-process run of the same teacher bit for bit: same metrics,
 * same stateHash(). Use `ideal` (scale 1) so the unit round trip is exact.
 *   python -m rushwick_onboard --hardware sim --policy echo &
 *   npm run sim:echo-check -- --seed 3
 */
import { parseArgs } from 'node:util';
import { buildHello } from '../../src/bridge';
import { RuleBasedAgent, runEpisode, Simulation, type SimConfigInput } from '../../src/sim';
import { CarConnection } from './connection';
import { runLockstep } from './lockstep';
import { StepLog } from './stepLog';

/** The car program may still be starting: retry until `waitMs` has passed. */
async function connect(url: string, waitMs: number): Promise<CarConnection> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      return await CarConnection.open(url);
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', default: 'ws://localhost:8765' },
      profile: { type: 'string', default: 'ideal' },
      seed: { type: 'string', default: '3' },
      episodes: { type: 'string', default: '1' },
      'wait-ms': { type: 'string', default: '20000' },
    },
  });
  const episodes = Number(values.episodes);
  // The same config sim:bridge builds in lockstep mode.
  const config: SimConfigInput = { seed: Number(values.seed), profile: values.profile, city: { drivingSide: 'left' } };

  const bridged = new Simulation(config);
  const conn = await connect(values.url, Number(values['wait-ms']));
  conn.send(buildHello(bridged, 'lockstep'));
  const log = new StepLog(null);
  const viaBridge = await runLockstep(bridged, conn, log, { episodes, teacher: true, timeoutMs: 5000 });
  conn.close();

  const local = new Simulation(config);
  const inProcess = Array.from({ length: episodes }, () => runEpisode({}, new RuleBasedAgent(), { sim: local, privileged: true }));

  const same = JSON.stringify(viaBridge) === JSON.stringify(inProcess) && bridged.stateHash() === local.stateHash();
  const outcomes = (ms: typeof inProcess) => ms.map((m) => `${m.outcome} after ${m.time.toFixed(2)} s`).join(', ');
  console.log(`bridge:     ${outcomes(viaBridge)} · stateHash ${bridged.stateHash()} · ${log.summary()}`);
  console.log(`in-process: ${outcomes(inProcess)} · stateHash ${local.stateHash()}`);
  if (!same) throw new Error('SIL echo check failed: the bridge run differs from the in-process run');
  console.log('SIL echo check passed: identical metrics and stateHash');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
