import { parseArgs } from 'node:util';
import type { ClockMode } from '../../src/bridge';

export interface BridgeArgs {
  url: string;
  mode: ClockMode;
  profile: string;
  episodes: number;
  /** Keep starting episodes until this many minutes of wall time have passed (replaces `episodes`). */
  minutes: number | null;
  seed: number;
  side: 'left' | 'right';
  teacher: boolean;
  log: string | null;
  timeoutMs: number;
}

const USAGE = `Usage: npm run sim:bridge -- [options]
  --url URL                 car program WebSocket (default ws://localhost:8765)
  --mode lockstep|realtime  lockstep waits for every command and is deterministic;
                            realtime steps at wall-clock pace and measures latency (default lockstep)
  --profile NAME            platform profile: ideal, rc-pi, passenger-car (default ideal)
  --episodes N              episodes to run (default 1)
  --minutes N               instead of --episodes: keep starting episodes for N minutes (long HIL runs)
  --seed N                  city/traffic seed (default 1)
  --side left|right         driving side (default left)
  --teacher                 send the privileged rule-based teacher's action with every frame
  --log FILE                write one JSON line per step (seq, stamp, round trip, command, misses)
  --timeout-ms N            lockstep: abort when a command takes longer than this (default 5000)`;

export function readArgs(argv: string[]): BridgeArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: 'string', default: 'ws://localhost:8765' },
      mode: { type: 'string', default: 'lockstep' },
      profile: { type: 'string', default: 'ideal' },
      episodes: { type: 'string', default: '1' },
      minutes: { type: 'string' },
      seed: { type: 'string', default: '1' },
      side: { type: 'string', default: 'left' },
      teacher: { type: 'boolean', default: false },
      log: { type: 'string' },
      'timeout-ms': { type: 'string', default: '5000' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (values.mode !== 'lockstep' && values.mode !== 'realtime') {
    console.error(`--mode must be 'lockstep' or 'realtime', got '${values.mode}'\n\n${USAGE}`);
    process.exit(1);
  }
  return {
    url: values.url,
    mode: values.mode,
    profile: values.profile,
    episodes: Number(values.episodes),
    minutes: values.minutes === undefined ? null : Number(values.minutes),
    seed: Number(values.seed),
    side: values.side === 'right' ? 'right' : 'left',
    teacher: values.teacher,
    log: values.log ?? null,
    timeoutMs: Number(values['timeout-ms']),
  };
}
