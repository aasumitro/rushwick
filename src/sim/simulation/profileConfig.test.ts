import { describe, expect, it } from 'vitest';
import { resolveConfig } from './config';
import { Simulation } from './simulation';

describe('profile config', () => {
  it("applies the profile's world below explicit input", () => {
    expect(resolveConfig({ profile: 'rc-pi' })).toMatchObject({ vehicleCount: 0, pedestrianCount: 0, ego: { minRouteDistance: 20 } });
    expect(resolveConfig({ profile: 'rc-pi', vehicleCount: 3, ego: { minRouteDistance: 25 } })).toMatchObject({ vehicleCount: 3, ego: { minRouteDistance: 25 } });
  });

  it('drops only the modeled compute delay when latency is measured', () => {
    const modeled = new Simulation({ profile: 'rc-pi' }).platform.actuators;
    const measured = new Simulation({ profile: 'rc-pi', latency: 'measured' }).platform.actuators;
    expect(modeled.computeDelay).toBeCloseTo(0.06);
    expect(measured).toEqual({ ...modeled, computeDelay: 0 });
  });
});
