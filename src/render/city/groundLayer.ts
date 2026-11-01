import * as THREE from 'three';
import type { City } from '../../sim';
import { PALETTE } from '../core/palette';

/** Outskirts plane plus the asphalt carriageway under the whole city footprint. */
export function createGround(city: City): THREE.Group {
  const group = new THREE.Group();
  const { minX, minY, maxX, maxY } = city.bounds;
  const w = maxX - minX;
  const h = maxY - minY;

  const outskirts = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 8, h * 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.outskirts, roughness: 1 }),
  );
  outskirts.rotation.x = -Math.PI / 2;
  outskirts.position.set((minX + maxX) / 2, -0.05, -(minY + maxY) / 2);
  outskirts.receiveShadow = true;
  group.add(outskirts);

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.92 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set((minX + maxX) / 2, 0, -(minY + maxY) / 2);
  asphalt.receiveShadow = true;
  group.add(asphalt);
  return group;
}
