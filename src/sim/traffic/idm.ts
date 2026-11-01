/**
 * Intelligent Driver Model (Treiber, Hennecke & Helbing, 2000) for
 * longitudinal control. Shared by background traffic and the rule-based ego
 * agent so that both follow the same car-following physics.
 */
export interface IdmParams {
  /** Max acceleration (m/s^2). */
  aMax: number;
  /** Comfortable deceleration (m/s^2). */
  bComf: number;
  /** Desired time headway (s). */
  T: number;
  /** Standstill gap (m). */
  s0: number;
}

export function idmFree(p: IdmParams, v: number, v0: number): number {
  const vd = Math.max(v0, 0.1);
  if (v <= vd) {
    const r = v / vd;
    return p.aMax * (1 - r * r * r * r);
  }
  // Above desired speed: decelerate smoothly instead of the steep IDM free term.
  const r = vd / v;
  return -p.bComf * (1 - r * r);
}

/** Interaction term (always <= 0) for an obstacle at `gap` metres moving at `leadSpeed`. */
export function idmInteraction(p: IdmParams, v: number, gap: number, leadSpeed: number): number {
  const dv = v - leadSpeed;
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.aMax * p.bComf)));
  const g = Math.max(gap, 0.05);
  const r = sStar / g;
  return -p.aMax * r * r;
}

export function idmAccel(p: IdmParams, v: number, v0: number, gap: number, leadSpeed: number): number {
  return idmFree(p, v, v0) + idmInteraction(p, v, gap, leadSpeed);
}

/** Distance at which the IDM starts reacting noticeably to a stationary obstacle. */
export function idmReactionDistance(p: IdmParams, v: number): number {
  return p.s0 + v * p.T + (v * v) / (2 * Math.sqrt(p.aMax * p.bComf));
}

/** Highest speed at distance `d` from which a vehicle can still reach `vTarget` braking at `b`. */
export function brakingEnvelope(vTarget: number, d: number, b: number): number {
  return Math.sqrt(vTarget * vTarget + 2 * b * Math.max(d, 0));
}

/**
 * Kinematic safety bound: the deceleration needed to match `leadSpeed` within
 * `gap - margin` metres. IDM alone brakes too gently for low-aMax vehicles
 * (trucks, buses) and can creep over a stop line; take the min with this.
 * Returns +Infinity when there is no constraint.
 */
export function kinematicBrake(v: number, gap: number, leadSpeed: number, margin = 0.5): number {
  if (v <= leadSpeed) return Infinity; // not closing in: no constraint
  const room = gap - margin;
  if (room <= 0.05) return -Infinity;
  return -(v * v - leadSpeed * leadSpeed) / (2 * room);
}
