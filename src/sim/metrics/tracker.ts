import { drivingScore } from './score';
import type { EpisodeMetrics, EpisodeOutcome } from './types';

/** Accumulates per-episode driving statistics for the ego vehicle. */
export class MetricsTracker {
  outcome: EpisodeOutcome = 'running';
  time = 0;
  distance = 0;
  progress = 0;
  collisionsVehicle = 0;
  collisionsPedestrian = 0;
  offRoadEvents = 0;
  offRoadTime = 0;
  redLightViolations = 0;
  pedestrianNearMisses = 0;
  maxAbsJerk = 0;
  private jerkSq = 0;
  private jerkN = 0;
  maxLateralAccel = 0;
  minTimeToCollision = Infinity;
  stoppedTime = 0;
  private lastAccel: number | null = null;

  constructor(readonly routeLength: number) {}

  sample(dt: number, speed: number, accel: number, yawRate: number): void {
    this.time += dt;
    this.distance += speed * dt;
    if (this.lastAccel !== null) {
      const j = (accel - this.lastAccel) / dt;
      this.maxAbsJerk = Math.max(this.maxAbsJerk, Math.abs(j));
      this.jerkSq += j * j;
      this.jerkN++;
    }
    this.lastAccel = accel;
    this.maxLateralAccel = Math.max(this.maxLateralAccel, Math.abs(speed * yawRate));
    if (speed < 0.1) this.stoppedTime += dt;
  }

  result(): EpisodeMetrics {
    const completion = this.routeLength > 0 ? Math.min(1, this.progress / this.routeLength) : 0;
    const score = drivingScore(completion, this);
    return {
      outcome: this.outcome,
      time: this.time,
      distance: this.distance,
      routeLength: this.routeLength,
      routeProgress: this.progress,
      completion,
      collisionsVehicle: this.collisionsVehicle,
      collisionsPedestrian: this.collisionsPedestrian,
      offRoadEvents: this.offRoadEvents,
      offRoadTime: this.offRoadTime,
      redLightViolations: this.redLightViolations,
      pedestrianNearMisses: this.pedestrianNearMisses,
      meanSpeed: this.time > 0 ? this.distance / this.time : 0,
      maxAbsJerk: this.maxAbsJerk,
      rmsJerk: this.jerkN > 0 ? Math.sqrt(this.jerkSq / this.jerkN) : 0,
      maxLateralAccel: this.maxLateralAccel,
      minTimeToCollision: this.minTimeToCollision,
      stoppedTime: this.stoppedTime,
      score,
    };
  }
}
