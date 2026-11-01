import type { EpisodeMetrics } from '../../sim';

/** Benchmark metrics for the running episode. */
export function MetricsPanel({ m, episode }: { m: EpisodeMetrics | null; episode: number }) {
  if (!m) return null;
  const rows: [string, string][] = [
    ['Outcome', m.outcome],
    ['Score', m.score.toFixed(2)],
    ['Completion', `${(m.completion * 100).toFixed(0)}%`],
    ['Collisions (veh / ped)', `${m.collisionsVehicle} / ${m.collisionsPedestrian}`],
    ['Red lights run', String(m.redLightViolations)],
    ['Curb strikes', String(m.offRoadEvents)],
    ['Pedestrian near-misses', String(m.pedestrianNearMisses)],
    ['Mean speed', `${(m.meanSpeed * 3.6).toFixed(1)} km/h`],
    ['Min TTC', Number.isFinite(m.minTimeToCollision) ? `${m.minTimeToCollision.toFixed(1)} s` : '—'],
    ['RMS jerk', `${m.rmsJerk.toFixed(2)} m/s³`],
  ];
  return (
    <section className="panel-section">
      <h3>Episode {episode}</h3>
      <dl className="metrics">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
