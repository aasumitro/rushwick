import * as THREE from 'three';
import { PALETTE } from './palette';

/** Renderer, scene, sky/fog and lighting. The sun's shadow box follows the camera focus. */
export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
}

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 250, 1300);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a5348, 1.1));

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -140;
  cam.right = cam.top = 140;
  cam.near = 10;
  cam.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  return { renderer, scene, sun };
}

/** Keep the shadow frustum centred on what the camera is looking at. */
export function followSun(sun: THREE.DirectionalLight, focus: THREE.Vector3): void {
  sun.position.set(focus.x + 160, 260, focus.z + 90);
  sun.target.position.copy(focus);
}
