import type { Block, City } from './types';

/** True when (x, y) lies on the raised sidewalk/building slab of the block (rounded corners respected). */
export function pointInBlock(b: Block, x: number, y: number): boolean {
  const { minX, minY, maxX, maxY } = b.bounds;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;
  const r = b.cornerRadius;
  if (r <= 0) return true;
  const cx = x < minX + r ? minX + r : x > maxX - r ? maxX - r : x;
  const cy = y < minY + r ? minY + r : y > maxY - r ? maxY - r : y;
  if (cx === x || cy === y) return true;
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}

/** Index of the block containing the point, or -1 when on the carriageway / outside the city. */
export function blockAt(city: City, x: number, y: number): number {
  for (let i = 0; i < city.blocks.length; i++) {
    if (pointInBlock(city.blocks[i] as Block, x, y)) return i;
  }
  return -1;
}

export function isInsideCity(city: City, x: number, y: number): boolean {
  const b = city.bounds;
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

/** Drivable = inside the city footprint and not on any block. */
export function isDrivable(city: City, x: number, y: number): boolean {
  return isInsideCity(city, x, y) && blockAt(city, x, y) < 0;
}
