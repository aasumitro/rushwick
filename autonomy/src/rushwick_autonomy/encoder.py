"""Port of encodeObservation() (src/sim/ego/observation/encoder.ts).

The layout and scaling must match the TypeScript encoder exactly;
tests/test_encoder_golden.py checks it against the golden vectors exported by
`npm run sim:golden`. Encode observations in sim units.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np

#: Version of the layout and scaling, as FEATURE_VERSION in encoder.ts.
FEATURE_VERSION = 1

EGO_F, WP_F, ROUTE_F, STOP_F, VEH_F, PED_F = 5, 3, 3, 6, 9, 5


def feature_size(cfg: Dict[str, Any]) -> int:
    return EGO_F + cfg["waypoints"] * WP_F + ROUTE_F + STOP_F + cfg["maxAgents"] * (VEH_F + PED_F) + cfg["lidarRays"]


def _finite(v: Any) -> bool:
    return isinstance(v, (int, float)) and math.isfinite(v)


def _at(items: List[Any], k: int) -> Optional[Any]:
    return items[k] if k < len(items) else None


def encode_observation(obs: Dict[str, Any], cfg: Dict[str, Any]) -> np.ndarray:
    """Fixed-length, roughly unit-scaled float32 features; `cfg` is the sensor config from `hello`."""
    ego, route = obs["ego"], obs["route"]
    f: List[float] = [ego["speed"] / 20, ego["accel"] / 5, ego["steer"] / ego["maxSteer"], ego["yawRate"], route["speedLimit"] / 20]
    for k in range(cfg["waypoints"]):
        wp = _at(route["waypoints"], k)
        f += [wp["x"] / 50, wp["y"] / 50, wp["speedLimit"] / 20] if wp else [0, 0, 0]
    f += [route["lateralError"] / 5, route["headingError"] / math.pi, min(route["remaining"], 1000) / 1000]
    st = route["nextStop"]
    light = st["light"] if st else None
    f += [
        1 if st else 0,
        min(st["distance"], 150) / 150 if st else 1,
        1 if light in ("green", "none") else 0,
        1 if light == "yellow" else 0,
        1 if light == "red" else 0,
        min(st["timeLeft"], 60) / 60 if st and _finite(st["timeLeft"]) else 1,
    ]
    for k in range(cfg["maxAgents"]):
        a = _at(obs["vehicles"], k)
        f += [1, a["x"] / 50, a["y"] / 50, math.cos(a["heading"]), math.sin(a["heading"]), a["vx"] / 20, a["vy"] / 20, a["length"] / 10, a["width"] / 3] if a else [0] * VEH_F
    for k in range(cfg["maxAgents"]):
        a = _at(obs["pedestrians"], k)
        f += [1, a["x"] / 30, a["y"] / 30, a["vx"] / 3, a["vy"] / 3] if a else [0] * PED_F
    lidar_range = cfg["lidarRange"]
    for k in range(cfg["lidarRays"]):
        r = _at(obs["lidar"], k)
        f.append((lidar_range if r is None else r) / lidar_range)
    return np.asarray(f, dtype=np.float32)
