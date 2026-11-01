import { describe, expect, it } from 'vitest';
import { obbCorners } from '../../core/obb';
import { clearLine, inView, isVisible, type SightScene } from './occlusion';

// Ego at the origin. A building spans x 10..20, y -5..5; a truck at x 30 blocks the road behind it.
const truck = { id: 1, obb: { x: 30, y: 20, heading: 0, halfLength: 5, halfWidth: 1.5 } };
const scene: SightScene = {
  origin: { x: 0, y: 0 },
  buildings: [{ minX: 10, minY: -5, maxX: 20, maxY: 5 }],
  vehicles: [truck],
};

describe('occlusion', () => {
  it('blocks sight lines through buildings but not lines that pass beside them', () => {
    expect(clearLine(scene, { x: 30, y: 0 }, -1)).toBe(false);
    expect(clearLine(scene, { x: 8, y: 0 }, -1)).toBe(true);
    expect(clearLine(scene, { x: 30, y: -20 }, -1)).toBe(true);
  });

  it('lets nearer vehicles hide what is behind them, but never the vehicle itself', () => {
    expect(clearLine(scene, { x: 45, y: 30 }, -1)).toBe(false);
    expect(clearLine(scene, { x: 30, y: 20 }, truck.id)).toBe(true);
  });

  it('sees a vehicle when any corner is visible', () => {
    // Center hidden behind the building's top-left corner (slope < 0.5), rear-left corner clear of it.
    const car = { x: 24, y: 11, heading: 0, halfLength: 2.3, halfWidth: 1 };
    expect(clearLine(scene, car, 2)).toBe(false);
    expect(isVisible(scene, [car, ...obbCorners(car)], 2)).toBe(true);
    expect(isVisible(scene, [{ x: 30, y: 0 }], -1)).toBe(false);
  });

  it('limits detection to range and field of view', () => {
    const cfg = { range: 30, fovDeg: 100 };
    expect(inView(20, 0, cfg)).toBe(true);
    expect(inView(31, 0, cfg)).toBe(false);
    expect(inView(10, 10, cfg)).toBe(true); // 45 degrees
    expect(inView(10, 13, cfg)).toBe(false); // 52 degrees
    expect(inView(-10, 0, cfg)).toBe(false);
    expect(inView(-10, 0, { range: 30, fovDeg: 360 })).toBe(true);
  });
});
