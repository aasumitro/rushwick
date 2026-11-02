"""The safety layer. It always sits between the policy and the hardware, in SIL
too: the policy never commands the actuators directly.

Every check is written relative to the vehicle's own size and the posted speed
limit, so the same defaults work for a 1:10 RC car and a full-size car. With a
well-behaved policy the layer changes nothing.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from typing import Any

#: A braking request beyond any vehicle's limit (m/s²): the platform brakes as hard as it can.
FULL_BRAKE = -100.0


@dataclass(frozen=True)
class Command:
    """Acceleration in m/s² (real units, negative brakes) and normalized steering (left positive)."""

    acceleration: float
    steering: float


@dataclass
class SafetyConfig:
    #: Speed cap (m/s); None caps at `speed_limit_margin` times the posted limit.
    max_speed: float | None = None
    speed_limit_margin: float = 1.2
    #: Brake for lidar returns inside the clearance ahead. Off in SIL by default: the
    #: simulated 2D lidar sees curbs as walls (block outlines), which a corner turn crosses.
    lidar_stop: bool = True
    #: Free space kept in front of the bumper, as a fraction of the vehicle length.
    clearance: float = 0.1
    #: Lidar rays within this angle of the heading (rad) guard the space ahead.
    forward_half_angle: float = 0.2
    #: Without a new frame for this long (s), brake: the stale-frame watchdog.
    stale_after: float = 0.2


class Safety:
    def __init__(self, cfg: SafetyConfig) -> None:
        self.cfg = cfg
        #: How often each rule intervened.
        self.interventions: Counter = Counter()

    def check(self, cmd: Command, obs: dict[str, Any]) -> Command:
        """The command made safe for this observation (real units)."""
        acceleration, steering = cmd.acceleration, cmd.steering
        if not math.isfinite(acceleration) or not math.isfinite(steering):
            self.interventions["non-finite"] += 1
            return Command(FULL_BRAKE, 0.0)
        if abs(steering) > 1:
            self.interventions["steering"] += 1
            steering = max(-1.0, min(1.0, steering))
        if acceleration > 0 and obs["ego"]["speed"] >= self._speed_cap(obs):
            self.interventions["speed"] += 1
            acceleration = 0.0
        if self.cfg.lidar_stop and self._blocked_ahead(obs):
            self.interventions["obstacle"] += 1
            acceleration = FULL_BRAKE
        return Command(acceleration, steering)

    def watchdog(self) -> Command:
        """What to command when frames stop arriving."""
        self.interventions["watchdog"] += 1
        return Command(FULL_BRAKE, 0.0)

    def _speed_cap(self, obs: dict[str, Any]) -> float:
        if self.cfg.max_speed is not None:
            return self.cfg.max_speed
        return self.cfg.speed_limit_margin * obs["route"]["speedLimit"]

    def _blocked_ahead(self, obs: dict[str, Any]) -> bool:
        """A lidar return closer than the clearance in front of the bumper (rays start at the vehicle center)."""
        ego, rays = obs["ego"], obs["lidar"]
        limit = ego["length"] / 2 + self.cfg.clearance * ego["length"]
        for i, r in enumerate(rays):
            angle = math.remainder(2 * math.pi * i / len(rays), 2 * math.pi)
            if abs(angle) <= self.cfg.forward_half_angle and r < limit:
                return True
        return False
