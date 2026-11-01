/**
 * Public API of the simulator. Everything outside src/sim (renderer, UI,
 * scripts, future model code) should import from here only.
 */
export { IdleAgent, ManualAgent, RuleBasedAgent, type DrivingAction, type DrivingAgent, type ManualInput, type RuleBasedOptions } from './agents';
export type { Aabb } from './core/segment';
export type { Vec2 } from './core/vec2';
export { DEFAULT_EGO_PARAMS, type EgoParams } from './ego/egoParams';
export { EgoVehicle } from './ego/egoVehicle';
export * from './ego/observation';
export { planRoute, Route, type RouteStop } from './ego/route';
export * from './metrics';
export type { Pedestrian, PedState } from './pedestrians';
export { runEpisode, type EpisodeOptions } from './runner/episodeRunner';
export * from './simulation';
export { SignalSystem, type LightState, type WalkState } from './traffic/signals';
export { VEHICLE_KINDS, VEHICLE_SPECS, type Vehicle, type VehicleKind } from './traffic/vehicles';
export { DEFAULT_CITY_CONFIG, generateCity } from './world/generator';
export { blockAt, isDrivable, pointInBlock } from './world/queries';
export * from './world/types';
