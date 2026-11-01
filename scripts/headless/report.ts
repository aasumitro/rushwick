import type { EpisodeMetrics } from '../../src/sim';

/** Per-episode table plus an aggregate summary, printed to stdout. */
export function printReport(results: EpisodeMetrics[], profile: string, teacher: string): void {
  console.log(`profile ${profile} · expert acts on ${teacher === 'ideal' ? 'exact (privileged)' : 'sensed'} observations`);
  console.table(
    results.map((m, i) => ({
      ep: i,
      outcome: m.outcome,
      score: m.score.toFixed(2),
      completion: `${(m.completion * 100).toFixed(0)}%`,
      collisions: m.collisionsVehicle + m.collisionsPedestrian,
      redLights: m.redLightViolations,
      curb: m.offRoadEvents,
      nearMiss: m.pedestrianNearMisses,
      kmh: (m.meanSpeed * 3.6).toFixed(1),
      seconds: m.time.toFixed(0),
    })),
  );
  const n = results.length || 1;
  const mean = (f: (m: EpisodeMetrics) => number) => results.reduce((a, m) => a + f(m), 0) / n;
  console.log(
    `success ${(mean((m) => (m.outcome === 'success' ? 1 : 0)) * 100).toFixed(0)}% · ` +
      `mean score ${mean((m) => m.score).toFixed(3)} · ` +
      `collisions/ep ${mean((m) => m.collisionsVehicle + m.collisionsPedestrian).toFixed(2)} · ` +
      `red lights/ep ${mean((m) => m.redLightViolations).toFixed(2)}`,
  );
}
