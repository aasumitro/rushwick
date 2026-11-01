import { describe, expect, it } from 'vitest';
import { obbOverlap, pointObbDistance } from './obb';
import { Polyline } from './polyline';
import { rayAabb, rayCircle } from './ray';
import { Rng } from './rng';
import { SpatialGrid } from './spatialGrid';

describe('Rng', () => {
  it('reproduces the same stream for the same seed', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('forks independent streams without advancing the parent', () => {
    const parent = new Rng(1);
    const before = new Rng(1).next();
    parent.fork('x').next();
    expect(parent.next()).toBe(before);
  });
});

describe('geometry', () => {
  const box = { x: 0, y: 0, heading: 0, halfLength: 2, halfWidth: 1 };

  it('detects OBB overlap and separation, including rotation', () => {
    expect(obbOverlap(box, { ...box, x: 3.9 })).toBe(true);
    expect(obbOverlap(box, { ...box, x: 4.1 })).toBe(false);
    expect(obbOverlap(box, { ...box, x: 3.5, y: 3.5, heading: Math.PI / 4 })).toBe(false);
    expect(obbOverlap(box, { ...box, x: 2.5, y: 2.5, heading: Math.PI / 4 })).toBe(true);
  });

  it('measures point-to-box distance', () => {
    expect(pointObbDistance(0, 0, box)).toBe(0);
    expect(pointObbDistance(5, 0, box)).toBeCloseTo(3);
  });

  it('casts rays against boxes and circles', () => {
    expect(rayAabb(-5, 0, 1, 0, -1, -1, 1, 1)).toBeCloseTo(4);
    expect(rayAabb(-5, 3, 1, 0, -1, -1, 1, 1)).toBe(Infinity);
    expect(rayCircle(0, 0, 1, 0, 10, 0, 1)).toBeCloseTo(9);
  });
});

describe('Polyline', () => {
  const line = new Polyline([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]);

  it('samples by arc length', () => {
    expect(line.length).toBe(20);
    expect(line.sample(15)).toMatchObject({ x: 10, y: 5 });
  });

  it('projects with a signed lateral offset (left positive)', () => {
    const p = line.project({ x: 5, y: 2 });
    expect(p.s).toBeCloseTo(5);
    expect(p.lateral).toBeCloseTo(2);
  });
});

describe('SpatialGrid', () => {
  it('finds inserted ids and forgets them after clear()', () => {
    const g = new SpatialGrid(0, 0, 100, 100, 10);
    g.insert(1, 15, 15);
    g.insert(2, 80, 80);
    const found: number[] = [];
    g.query(14, 14, 3, (id) => found.push(id));
    expect(found).toEqual([1]);
    g.clear();
    found.length = 0;
    g.query(14, 14, 3, (id) => found.push(id));
    expect(found).toEqual([]);
  });
});
