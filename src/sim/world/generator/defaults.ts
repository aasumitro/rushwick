import type { CityConfig } from '../types';

export const DEFAULT_CITY_CONFIG: CityConfig = {
  seed: 1,
  gridX: 7,
  gridY: 7,
  minSpacing: 78,
  maxSpacing: 108,
  arterialEvery: 3,
  // Indonesia drives on the left. Use 'right' for US/EU/China-style traffic.
  drivingSide: 'left',
  laneWidth: 3.5,
  sidewalkWidth: 3.5,
  stopGap: 1.0,
  arterialLanes: 2,
  localLanes: 1,
  arterialSpeed: 13.9, // 50 km/h
  localSpeed: 8.4, // 30 km/h
  outerDepth: 45,
  parkProbability: 0.1,
  downtownHeight: 120,
  signalMode: 'mixed',
  arterialGreen: 22,
  localGreen: 14,
  farTurnGreen: 7,
  yellowTime: 3,
  allRedTime: 2,
};
