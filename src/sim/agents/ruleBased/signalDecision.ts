import type { StopObservation } from '../../ego/observation';

/** Above this required deceleration the agent runs a yellow instead of stopping. */
const YELLOW_STOP_DECEL = 3.2;

/**
 * Stop/go decision at signals with yellow-light hysteresis: once the agent
 * commits to going through a yellow it does not change its mind.
 */
export class SignalDecision {
  private yellowGo = false;
  private lastDistance = Infinity;

  reset(): void {
    this.yellowGo = false;
    this.lastDistance = Infinity;
  }

  /** Distance (m, front bumper) at which to stop, or null to proceed. */
  stopDistance(stop: StopObservation | null, speed: number): number | null {
    if (!stop) return null;
    if (stop.distance > this.lastDistance + 5) this.yellowGo = false; // a new stop line
    this.lastDistance = stop.distance;
    if (stop.light === 'green' || stop.light === 'none') this.yellowGo = false;
    let mustStop = stop.light === 'red';
    if (stop.light === 'yellow' && !this.yellowGo) {
      const need = (speed * speed) / (2 * Math.max(stop.distance, 0.1));
      if (need < YELLOW_STOP_DECEL) mustStop = true;
      else this.yellowGo = true;
    }
    // Already past the line: committed, keep clearing the junction.
    return mustStop && stop.distance > -0.5 ? stop.distance : null;
  }
}
