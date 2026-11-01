import * as THREE from 'three';

/** Facade styles: base wall colour, window glass colour, share of lit windows. */
export const FACADE_STYLES = [
  { wall: '#c9c3b6', glass: '#3e4c5a', lit: 0.18 },
  { wall: '#7d8b99', glass: '#2b3d52', lit: 0.12 },
  { wall: '#a8664a', glass: '#33302d', lit: 0.2 },
  { wall: '#e3dccb', glass: '#4a5866', lit: 0.15 },
  { wall: '#4a5563', glass: '#1d2a38', lit: 0.25 },
] as const;

/** Metres covered by one texture tile (4 bays x 4 floors). */
export const FACADE_TILE = { width: 12, height: 12.8 };

/** Procedural window-grid texture; deterministic per style index. */
export function createFacadeTexture(style: number): THREE.Texture {
  const s = FACADE_STYLES[style % FACADE_STYLES.length] as (typeof FACADE_STYLES)[number];
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = s.wall;
  ctx.fillRect(0, 0, size, size);
  let seed = 1234 + style * 97;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cell = size / 4;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const lit = rand() < s.lit;
      ctx.fillStyle = lit ? '#f4d58a' : s.glass;
      ctx.fillRect(i * cell + cell * 0.18, j * cell + cell * 0.22, cell * 0.64, cell * 0.52);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(i * cell + cell * 0.18, j * cell + cell * 0.22, cell * 0.64, cell * 0.08);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
