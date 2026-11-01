import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Aabb, City } from '../../sim';
import { PALETTE } from '../core/palette';

const CURB_HEIGHT = 0.15;

function roundedRect(b: Aabb, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(b.minX + r, b.minY);
  s.lineTo(b.maxX - r, b.minY);
  if (r > 0) s.absarc(b.maxX - r, b.minY + r, r, -Math.PI / 2, 0, false);
  s.lineTo(b.maxX, b.maxY - r);
  if (r > 0) s.absarc(b.maxX - r, b.maxY - r, r, 0, Math.PI / 2, false);
  s.lineTo(b.minX + r, b.maxY);
  if (r > 0) s.absarc(b.minX + r, b.maxY - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(b.minX, b.minY + r);
  if (r > 0) s.absarc(b.minX + r, b.minY + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Shape (sim XY) extruded upwards; rotation maps sim (x, y) to three (x, h, -y). */
function slab(b: Aabb, r: number, height: number, y0 = 0): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(roundedRect(b, r), { depth: height, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

/** Raised sidewalk slabs for every block, plus lawns for parks. */
export function createBlocks(city: City): THREE.Group {
  const group = new THREE.Group();
  const walks: THREE.BufferGeometry[] = [];
  const lawns: THREE.BufferGeometry[] = [];
  const sw = city.config.sidewalkWidth;
  for (const block of city.blocks) {
    walks.push(slab(block.bounds, block.cornerRadius, CURB_HEIGHT));
    if (block.kind === 'park') {
      const b = block.bounds;
      const inner = { minX: b.minX + sw, minY: b.minY + sw, maxX: b.maxX - sw, maxY: b.maxY - sw };
      lawns.push(slab(inner, 2, 0.02, CURB_HEIGHT));
    }
  }
  const add = (geoms: THREE.BufferGeometry[], color: number) => {
    if (geoms.length === 0) return;
    const merged = mergeGeometries(geoms);
    geoms.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(walks, PALETTE.sidewalk);
  add(lawns, PALETTE.parkGrass);
  return group;
}
