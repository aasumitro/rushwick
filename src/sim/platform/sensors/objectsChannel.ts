import type { Rng } from '../../core/rng';
import type { AgentObservation } from '../../ego/observation';
import type { ObjectsReading } from './assemble';
import { inView } from './occlusion';
import type { SensorRecord } from './record';
import type { ObjectsChannelConfig } from './types';

const byDistance = (a: AgentObservation, b: AgentObservation) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y) || a.id - b.id;

/**
 * Object detection: an agent is reported only when it is inside the field of
 * view and range, has a clear line of sight (`visible`, absent when occlusion
 * is off) and is not
 * missed (`missRate + missRatePerMeter · d`). Detections get position noise
 * growing with distance and velocity noise, are re-sorted by the measured
 * distance and cut to `maxAgents`.
 */
export class ObjectsChannel {
  constructor(
    private readonly cfg: ObjectsChannelConfig,
    private readonly maxAgents: number,
    private readonly rng: Rng,
  ) {}

  read(rec: SensorRecord): ObjectsReading {
    const { ideal, visible } = rec;
    return {
      vehicles: this.detect(ideal.vehicles, visible?.vehicles ?? null),
      pedestrians: this.detect(ideal.pedestrians, visible?.pedestrians ?? null),
    };
  }

  private detect(agents: readonly AgentObservation[], visible: ReadonlySet<number> | null): AgentObservation[] {
    const { cfg, rng } = this;
    const out: AgentObservation[] = [];
    for (const a of agents) {
      if (!inView(a.x, a.y, cfg) || (visible && !visible.has(a.id))) continue;
      const d = Math.hypot(a.x, a.y);
      if (rng.next() < cfg.missRate + cfg.missRatePerMeter * d) continue;
      const pos = cfg.posStd + cfg.posStdPerMeter * d;
      out.push({
        ...a,
        x: a.x + rng.normal(0, pos),
        y: a.y + rng.normal(0, pos),
        speed: Math.max(0, a.speed + rng.normal(0, cfg.velStd)),
        vx: a.vx + rng.normal(0, cfg.velStd),
        vy: a.vy + rng.normal(0, cfg.velStd),
      });
    }
    return out.sort(byDistance).slice(0, this.maxAgents);
  }
}
