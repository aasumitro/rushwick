import * as THREE from 'three';
import type { City } from '../../sim';
import { GeometryBuilder } from '../core/geometryBuilder';
import { PALETTE } from '../core/palette';
import { createFacadeTexture, FACADE_STYLES, FACADE_TILE } from './facadeTexture';

const SLAB = 0.15;

/** All buildings, merged into one wall mesh per facade style and one roof mesh. */
export function createBuildings(city: City): THREE.Group {
  const group = new THREE.Group();
  const walls = FACADE_STYLES.map(() => new GeometryBuilder());
  const roofs = new GeometryBuilder();
  const uv: [number, number] = [1 / FACADE_TILE.width, 1 / FACADE_TILE.height];
  for (const block of city.blocks) {
    for (const b of block.buildings) {
      const builder = walls[b.style % walls.length] as GeometryBuilder;
      builder.box(b.x, SLAB + b.height / 2, -b.y, b.width, b.height, b.depth, 0xffffff, 0, uv);
      // Roof cap with a small parapet so roofs read as a separate surface.
      roofs.box(b.x, SLAB + b.height + 0.25, -b.y, b.width - 0.4, 0.5, b.depth - 0.4, PALETTE.roof);
    }
  }
  walls.forEach((builder, style) => {
    if (builder.isEmpty) return;
    const mat = new THREE.MeshStandardMaterial({ map: createFacadeTexture(style), roughness: 0.85, metalness: 0.05 });
    const mesh = new THREE.Mesh(builder.build(), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  });
  const roofMesh = new THREE.Mesh(roofs.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  roofMesh.castShadow = roofMesh.receiveShadow = true;
  group.add(roofMesh);
  return group;
}
