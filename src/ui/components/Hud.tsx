import type { HudSnapshot } from '../controller/snapshot';

const LIGHT_CLASS: Record<string, string> = { red: 'light-red', yellow: 'light-yellow', green: 'light-green' };

/** Live ego and city readouts (top-left overlay). */
export function Hud({ s }: { s: HudSnapshot }) {
  return (
    <div className="hud">
      <div className="hud-speed">
        {s.egoSpeedKmh.toFixed(0)}
        <small> km/h</small>
      </div>
      <div className="hud-grid">
        <span>Steer</span>
        <b>{s.steerDeg.toFixed(1)}°</b>
        <span>Platform</span>
        <b>{s.platform}</b>
        <span>Command delay</span>
        <b>{s.commandDelayMs === null ? 'none' : `${s.commandDelayMs.toFixed(0)} ms`}</b>
        {s.remote && (
          <>
            <span>Remote</span>
            <b className={s.remote.state === 'connected' && !s.remote.braking ? 'light-green' : 'light-red'}>
              {s.remote.state}
              {s.remote.rttMs !== null && ` · ${s.remote.rttMs.toFixed(1)} ms`}
              {s.remote.braking && ' · watchdog brake'}
            </b>
            {s.remote.error && <span className="hud-error">{s.remote.error}</span>}
          </>
        )}
        <span>Next signal</span>
        <b className={LIGHT_CLASS[s.nextLight] ?? ''}>
          {s.nextLight}
          {s.nextLightDistance !== null && ` · ${Math.max(0, s.nextLightDistance).toFixed(0)} m`}
        </b>
        <span>Route</span>
        <b>{(s.progress * 100).toFixed(0)}%</b>
        <span>Perceived</span>
        <b>
          {s.nearbyVehicles} veh · {s.nearbyPedestrians} ped
        </b>
        <span>City</span>
        <b>
          {s.vehicles} veh · {s.pedestrians} ped · avg {s.meanTrafficSpeed.toFixed(0)} km/h
        </b>
        <span>Sim time</span>
        <b>
          {s.time.toFixed(0)} s · {s.fps.toFixed(0)} fps
        </b>
      </div>
    </div>
  );
}
