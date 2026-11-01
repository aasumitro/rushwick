import { parseArgs } from 'node:util';

export interface RunArgs {
  episodes: number;
  seed: number;
  side: 'left' | 'right';
  vehicles: number;
  pedestrians: number;
  record: string | null;
  recordHz: number;
}

const USAGE = `Usage: npm run sim:headless -- [options]
  --episodes N      episodes to run (default 5)
  --seed N          city/traffic seed (default 1)
  --side left|right driving side (default left)
  --vehicles N      background vehicles (default 260)
  --pedestrians N   pedestrians (default 520)
  --record FILE     write (observation features, action) pairs as JSON lines
  --record-hz N     recording rate in Hz (default 10)`;

export function readArgs(argv: string[]): RunArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      episodes: { type: 'string', default: '5' },
      seed: { type: 'string', default: '1' },
      side: { type: 'string', default: 'left' },
      vehicles: { type: 'string', default: '260' },
      pedestrians: { type: 'string', default: '520' },
      record: { type: 'string' },
      'record-hz': { type: 'string', default: '10' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const side = values.side === 'right' ? 'right' : 'left';
  return {
    episodes: Number(values.episodes),
    seed: Number(values.seed),
    side,
    vehicles: Number(values.vehicles),
    pedestrians: Number(values.pedestrians),
    record: values.record ?? null,
    recordHz: Number(values['record-hz']),
  };
}
