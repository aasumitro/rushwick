"""SimpleLaneKeeper: a smoke-test policy, not a driver."""

from __future__ import annotations

import math
from typing import Any, Dict, List

from .safety import Command

Frame = Dict[str, Any]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _lookahead_point(waypoints: List[Dict[str, float]], distance: float) -> Dict[str, float]:
    """The first waypoint at least `distance` away (ego frame), or the last one."""
    for w in waypoints:
        if math.hypot(w["x"], w["y"]) >= distance:
            return w
    return waypoints[-1]


class SimpleLaneKeeper:
    """Pure-pursuit steering on the route waypoints and proportional speed control at a
    fraction of the posted limit. Stops for red, yellow and unknown lights and for road
    users in its lane ahead. Every length is relative to the vehicle, so it works at any scale."""

    def __init__(self, speed_factor: float = 0.6, speed_gain: float = 1.0) -> None:
        self.speed_factor = speed_factor
        self.speed_gain = speed_gain

    def reset(self) -> None:
        pass

    def act(self, frame: Frame) -> Command:
        obs = frame["observation"]
        ego, route = obs["ego"], obs["route"]
        return Command(self._acceleration(obs), self._steering(ego, route["waypoints"]))

    def _steering(self, ego: Dict[str, float], waypoints: List[Dict[str, float]]) -> float:
        wb = ego["wheelBase"]
        p = _lookahead_point(waypoints, _clamp(0.8 * ego["speed"], 2 * wb, 6 * wb))
        kappa = 2 * p["y"] / max(p["x"] ** 2 + p["y"] ** 2, 1e-6)
        # Front-wheel angle for curvature kappa on a center-referenced kinematic bicycle.
        beta = math.asin(_clamp(kappa * wb / 2, -0.99, 0.99))
        return _clamp(math.atan(2 * math.tan(beta)) / ego["maxSteer"], -1, 1)

    def _acceleration(self, obs: Dict[str, Any]) -> float:
        ego, route = obs["ego"], obs["route"]
        v, length = ego["speed"], ego["length"]
        limit = min([route["speedLimit"]] + [w["speedLimit"] for w in route["waypoints"][:8]])
        accel = self.speed_gain * (self.speed_factor * limit - v)
        stops = []
        stop = route["nextStop"]
        if stop is not None and stop["light"] in ("red", "yellow", "unknown"):
            stops.append(stop["distance"] - 0.2 * length)
        for a in obs["vehicles"] + obs["pedestrians"]:
            if a["x"] > 0 and abs(a["y"]) < ego["width"]:
                stops.append(a["x"] - length / 2 - a["length"] / 2 - 0.5 * length)
        for d in stops:
            if d < v * v / 2 + 2 * length:  # within a comfortable braking distance
                accel = min(accel, -v * v / (2 * max(d, 0.05 * length)))
        return accel
