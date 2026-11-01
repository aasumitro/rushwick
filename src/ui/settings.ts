import type { CameraMode } from '../render/camera/cameraRig';
import type { DrivingSide } from '../sim';

export type AgentKind = 'autopilot' | 'manual' | 'idle';

/** Settings that require regenerating the city when changed. */
export interface WorldSettings {
  seed: number;
  drivingSide: DrivingSide;
  signalMode: 'mixed' | 'protected';
  vehicleCount: number;
  pedestrianCount: number;
  jaywalkProbability: number;
}

/** Settings that apply live. */
export interface LiveSettings {
  agent: AgentKind;
  camera: CameraMode;
  speed: number;
  paused: boolean;
  showRoute: boolean;
  showLidar: boolean;
  autoRestart: boolean;
}

export const DEFAULT_WORLD: WorldSettings = {
  seed: 42,
  drivingSide: 'left',
  signalMode: 'mixed',
  vehicleCount: 260,
  pedestrianCount: 520,
  jaywalkProbability: 0.03,
};

export const DEFAULT_LIVE: LiveSettings = {
  agent: 'autopilot',
  camera: 'chase',
  speed: 1,
  paused: false,
  showRoute: true,
  showLidar: false,
  autoRestart: true,
};

export const CAMERA_MODES: readonly CameraMode[] = ['chase', 'orbit', 'top', 'driver'];
export const SPEEDS: readonly number[] = [0.5, 1, 2, 4, 8];
