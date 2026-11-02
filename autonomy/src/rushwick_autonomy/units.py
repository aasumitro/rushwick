"""Real <-> sim units, mirroring src/bridge/units.ts (design decision D1).

Lengths, speeds and accelerations are multiplied by `scale` on the way into
the simulator's units and divided on the way out. Angles, yaw rates, times,
light states and normalized steering never change.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

Observation = dict[str, Any]
Convert = Callable[[float], float]

_EGO = ("x", "y", "speed", "accel", "length", "width", "wheelBase")
_ROUTE = ("lateralError", "progress", "remaining", "speedLimit")
_WAYPOINT = ("x", "y", "speedLimit")
_AGENT = ("x", "y", "speed", "vx", "vy", "length", "width")


def _scaled(d: dict[str, Any], keys: Iterable[str], f: Convert) -> dict[str, Any]:
    out = dict(d)
    for k in keys:
        out[k] = f(d[k])
    return out


def _map(obs: Observation, f: Convert) -> Observation:
    route = obs["route"]
    stop = route["nextStop"]
    return {
        **obs,
        "ego": _scaled(obs["ego"], _EGO, f),
        "route": {
            **_scaled(route, _ROUTE, f),
            "waypoints": [_scaled(w, _WAYPOINT, f) for w in route["waypoints"]],
            "nextStop": None if stop is None else _scaled(stop, ("distance",), f),
        },
        "vehicles": [_scaled(a, _AGENT, f) for a in obs["vehicles"]],
        "pedestrians": [_scaled(a, _AGENT, f) for a in obs["pedestrians"]],
        "lidar": [f(r) for r in obs["lidar"]],
    }


def observation_to_sim(obs: Observation, scale: float) -> Observation:
    """Wire (real) units to sim units: what a model trained in Rushwick expects."""
    return _map(obs, lambda v: v * scale)


def observation_to_real(obs: Observation, scale: float) -> Observation:
    """Sim units to wire (real) units, the inverse of observation_to_sim."""
    return _map(obs, lambda v: v / scale)
