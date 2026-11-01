import { toLocal, wrapAngle } from '../../core/vec2';
import type { Pedestrian } from '../../pedestrians';
import type { Vehicle } from '../../traffic/vehicles';
import type { SensorConfig } from './sensorConfig';
import type { AgentObservation } from './types';
import type { WorldView } from './worldView';

interface Mover {
  id: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
}

/** Nearest vehicles and pedestrians in the ego frame, with relative velocities. */
export function observeAgents(w: WorldView, cfg: SensorConfig): { vehicles: AgentObservation[]; pedestrians: AgentObservation[] } {
  const { ego } = w;
  const cosH = Math.cos(ego.heading);
  const sinH = Math.sin(ego.heading);
  const evx = ego.speed * cosH;
  const evy = ego.speed * sinH;
  const r2 = cfg.agentRadius * cfg.agentRadius;
  const view = (m: Mover, base: Omit<AgentObservation, 'x' | 'y' | 'heading' | 'speed' | 'vx' | 'vy' | 'id'>): AgentObservation | null => {
    const l = toLocal(m.x, m.y, ego.x, ego.y, ego.heading);
    if (l.x * l.x + l.y * l.y > r2) return null;
    const dx = m.speed * Math.cos(m.heading) - evx;
    const dy = m.speed * Math.sin(m.heading) - evy;
    return { id: m.id, ...base, x: l.x, y: l.y, heading: wrapAngle(m.heading - ego.heading), speed: m.speed, vx: dx * cosH + dy * sinH, vy: -dx * sinH + dy * cosH };
  };
  const vehicles: AgentObservation[] = [];
  w.vehicleGrid.query(ego.x, ego.y, cfg.agentRadius, (i) => {
    const v = w.vehicles[i] as Vehicle;
    const o = view(v, { type: 'vehicle', kind: v.kind, length: v.length, width: v.width });
    if (o) vehicles.push(o);
  });
  const pedestrians: AgentObservation[] = [];
  w.pedGrid.query(ego.x, ego.y, cfg.agentRadius, (i) => {
    const o = view(w.peds[i] as Pedestrian, { type: 'pedestrian', kind: 'pedestrian', length: 0.5, width: 0.5 });
    if (o) pedestrians.push(o);
  });
  const byDist = (a: AgentObservation, b: AgentObservation) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y) || a.id - b.id;
  return { vehicles: vehicles.sort(byDist).slice(0, cfg.maxAgents), pedestrians: pedestrians.sort(byDist).slice(0, cfg.maxAgents) };
}
