import type { CameraMode } from '../render/camera/cameraRig';
import type { DrivingSide } from '../sim';

export type AgentKind = 'autopilot' | 'manual' | 'idle' | 'remote';

/** Settings that require regenerating the city when changed. */
export interface WorldSettings {
  seed: number;
  /** Platform profile name (PLATFORM_PROFILES); it can change the world, so it regenerates the city. */
  profile: string;
  drivingSide: DrivingSide;
  signalMode: 'mixed' | 'protected';
  vehicleCount: number;
  pedestrianCount: number;
  jaywalkProbability: number;
}

/** Settings that apply live. */
export interface LiveSettings {
  agent: AgentKind;
  /** Car program WebSocket for the 'remote' decision model. */
  remoteUrl: string;
  camera: CameraMode;
  speed: number;
  paused: boolean;
  showRoute: boolean;
  showLidar: boolean;
  /** Outline what the ego's sensors report next to the true road users. */
  showSensed: boolean;
  autoRestart: boolean;
}

export const DEFAULT_WORLD: WorldSettings = {
  seed: 42,
  profile: 'ideal',
  drivingSide: 'left',
  signalMode: 'mixed',
  vehicleCount: 260,
  pedestrianCount: 520,
  jaywalkProbability: 0.03,
};

export const DEFAULT_LIVE: LiveSettings = {
  agent: 'autopilot',
  remoteUrl: 'ws://localhost:8765',
  camera: 'chase',
  speed: 1,
  paused: false,
  showRoute: true,
  showLidar: false,
  showSensed: false,
  autoRestart: true,
};

export const CAMERA_MODES: readonly CameraMode[] = ['chase', 'orbit', 'top', 'driver'];
export const SPEEDS: readonly number[] = [0.5, 1, 2, 4, 8];
