import { parseArgs } from 'node:util';

export type Teacher = 'ideal' | 'sensed';

export interface RunArgs {
  episodes: number;
  seed: number;
  side: 'left' | 'right';
  profile: string;
  teacher: Teacher;
  /** Undefined: the profile's value (260 / 520 for ideal). */
  vehicles: number | undefined;
  pedestrians: number | undefined;
  record: string | null;
  recordHz: number;
}

const USAGE = `Usage: npm run sim:headless -- [options]
  --episodes N            episodes to run (default 5)
  --seed N                city/traffic seed (default 1)
  --side left|right       driving side (default left)
  --profile NAME          platform profile: ideal, rc-pi, rc-jetson, passenger-car (default ideal)
  --teacher ideal|sensed  observation the rule-based expert acts on (default sensed);
                          'ideal' is a privileged teacher for recording datasets
  --vehicles N            background vehicles (default: the profile's, 260 for ideal)
  --pedestrians N         pedestrians (default: the profile's, 520 for ideal)
  --record FILE           write (sensed observation features, action) pairs as JSON lines
  --record-hz N           recording rate in Hz (default 10)`;

const optional = (v: string | undefined): number | undefined => (v === undefined ? undefined : Number(v));

export function readArgs(argv: string[]): RunArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      episodes: { type: 'string', default: '5' },
      seed: { type: 'string', default: '1' },
      side: { type: 'string', default: 'left' },
      profile: { type: 'string', default: 'ideal' },
      teacher: { type: 'string', default: 'sensed' },
      vehicles: { type: 'string' },
      pedestrians: { type: 'string' },
      record: { type: 'string' },
      'record-hz': { type: 'string', default: '10' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (values.teacher !== 'ideal' && values.teacher !== 'sensed') {
    console.error(`--teacher must be 'ideal' or 'sensed', got '${values.teacher}'\n\n${USAGE}`);
    process.exit(1);
  }
  const side = values.side === 'right' ? 'right' : 'left';
  return {
    episodes: Number(values.episodes),
    seed: Number(values.seed),
    side,
    profile: values.profile,
    teacher: values.teacher,
    vehicles: optional(values.vehicles),
    pedestrians: optional(values.pedestrians),
    record: values.record ?? null,
    recordHz: Number(values['record-hz']),
  };
}
