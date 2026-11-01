import * as THREE from 'three';
import type { City, Vec2 } from '../../sim';
import { PALETTE } from '../core/palette';

const SLAB = 0.15;

/** Street and park trees as two instanced meshes (trunks + crowns). */
export function createTrees(city: City): THREE.Group {
  const positions: Vec2[] = [...city.streetTrees];
  for (const b of city.blocks) positions.push(...b.trees);
  const group = new THREE.Group();
  if (positions.length === 0) return group;

  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 2.6, 6);
  trunkGeo.translate(0, 1.3, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.7, 1);
  crownGeo.translate(0, 3.9, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: PALETTE.trunk }), positions.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), positions.length);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  positions.forEach((p, i) => {
    // Deterministic per-tree variation derived from its position.
    const h = Math.abs(Math.sin(p.x * 12.9898 + p.y * 78.233)) % 1;
    const s = 0.75 + h * 0.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h * Math.PI * 2);
    m.compose(new THREE.Vector3(p.x, SLAB, -p.y), q, new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, color.setHex(PALETTE.foliage[Math.floor(h * PALETTE.foliage.length)] as number));
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  group.add(trunks, crowns);
  return group;
}
