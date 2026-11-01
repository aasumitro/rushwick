import { describe, expect, it } from 'vitest';
import { encodeObservation, RuleBasedAgent, Simulation } from '../sim';
import { buildFrame, buildHello, commandToAction, episodeEnd } from './frame';
import { observationToReal, observationToSim } from './units';
import { parseCommand, ProtocolError } from './validate';

/** An rc-pi simulation a few seconds into an episode (scale 10). */
function rcPi(): Simulation {
  const sim = new Simulation({ seed: 2, profile: 'rc-pi' });
  sim.spawnEgo();
  const agent = new RuleBasedAgent();
  for (let i = 0; i < 60; i++) sim.step(agent.act(sim.observeIdeal()));
  return sim;
}

describe('bridge units', () => {
  it('converts lengths, speeds and accelerations by the scale and keeps angles', () => {
    const sim = rcPi();
    const obs = sim.observe();
    const real = observationToReal(obs, 10);
    expect(real.ego.length).toBeCloseTo(0.45, 9);
    expect(real.ego.speed).toBeCloseTo(obs.ego.speed / 10, 12);
    expect(real.ego.heading).toBe(obs.ego.heading);
    expect(real.route.headingError).toBe(obs.route.headingError);
    expect(Math.max(...real.lidar)).toBeLessThanOrEqual(12 + 1e-9);
    const back = observationToSim(real, 10);
    // Same features after the round trip a car program makes (float32 resolution).
    const a = encodeObservation(obs, sim.config.sensors);
    const b = encodeObservation(back, sim.config.sensors);
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 6));
  });

  it('is exact at scale 1', () => {
    const sim = new Simulation({ seed: 2, warmupTime: 5, vehicleCount: 60, pedestrianCount: 60 });
    sim.spawnEgo();
    const obs = sim.observe();
    expect(observationToSim(observationToReal(obs, 1), 1)).toEqual(obs);
  });
});

describe('bridge messages', () => {
  it('describes the run in hello and the step in frame, in real units', () => {
    const sim = rcPi();
    const hello = buildHello(sim, 'lockstep');
    expect(hello).toMatchObject({ type: 'hello', protocol: 1, featureVersion: 1, profile: 'rc-pi', scale: 10, controlHz: 20, mode: 'lockstep', latency: 'modeled', seed: 2 });
    expect(hello.sensors.lidarRange).toBeCloseTo(120);
    expect(buildHello(sim, 'realtime').latency).toBe('measured');
    const f = buildFrame(sim, { acceleration: 5, steering: 0.2 });
    expect(f).toMatchObject({ type: 'frame', seq: sim.steps, stamp: sim.time, controlTick: sim.controlDue, teacher: { acceleration: 0.5, steering: 0.2 } });
    expect(f.scan).toMatchObject({ angle_min: 0, range_max: 12, ranges: f.observation.lidar });
    expect(f.scan.range_min).toBeCloseTo(0.05, 12);
    expect(f.scan.angle_increment).toBeCloseTo((2 * Math.PI) / 32, 12);
    expect(f.imu.angular_velocity.z).toBe(f.observation.ego.yawRate);
    expect(f.odom.twist.linear.x).toBe(f.observation.ego.speed);
    expect(buildFrame(sim).teacher).toBeUndefined();
  });

  it('sends non-finite numbers as null', () => {
    const sim = rcPi();
    const wire = JSON.parse(JSON.stringify(episodeEnd(0, sim.episodeMetrics()!, 10)));
    expect(wire.metrics.minTimeToCollision).toBeNull();
    const frame = buildFrame(sim);
    frame.observation.route.nextStop = { distance: 1, light: 'unknown', timeLeft: Number.NaN };
    expect(JSON.parse(JSON.stringify(frame)).observation.route.nextStop.timeLeft).toBeNull();
  });
});

describe('parseCommand', () => {
  it('accepts a command and converts it to sim units', () => {
    const cmd = parseCommand('{"type":"command","seq":12,"acceleration":0.5,"steering":-0.1}');
    expect(cmd).toEqual({ type: 'command', seq: 12, acceleration: 0.5, steering: -0.1 });
    expect(commandToAction(cmd, 10)).toEqual({ acceleration: 5, steering: -0.1 });
  });

  it.each([
    ['{"type":"command"', /Malformed JSON/],
    ['[1,2]', /Expected a JSON object/],
    ['{"type":"cmd","seq":1,"acceleration":0,"steering":0}', /type 'command', got type "cmd"/],
    ['{"type":"command","seq":-1,"acceleration":0,"steering":0}', /'seq' must be a non-negative integer, got -1/],
    ['{"type":"command","seq":1.5,"acceleration":0,"steering":0}', /'seq'/],
    ['{"type":"command","seq":1,"steering":0}', /'acceleration' must be a finite number, got undefined/],
    ['{"type":"command","seq":1,"acceleration":"fast","steering":0}', /'acceleration' must be a finite number, got "fast"/],
    ['{"type":"command","seq":1,"acceleration":0,"steering":null}', /'steering' must be a finite number, got null/],
  ])('rejects %s', (raw, reason) => {
    expect(() => parseCommand(raw)).toThrow(ProtocolError);
    expect(() => parseCommand(raw)).toThrow(reason);
  });
});
