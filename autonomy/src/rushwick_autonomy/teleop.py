"""Manual driving from a phone: the newest valid message wins, and anything missing brakes.

The car moves only while a finger is on the joystick (deadman) and messages keep coming;
250 ms without one, or a lifted finger, gives a full brake. One phone controls at a time,
and switching between the policy and the phone happens only while the car stands still."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from .safety import FULL_BRAKE, Command

MODES = ("autonomous", "teleop", "stopped")
STANDSTILL = 0.05  # m/s


@dataclass(frozen=True)
class TeleopConfig:
    #: Acceleration at full throttle and braking at full reverse stick (m/s², real units).
    max_accel: float = 1.0
    max_brake: float = 3.0
    #: No more forward acceleration above this speed (m/s, real units).
    max_speed: float = 1.0
    timeout: float = 0.25


def parse_teleop(msg: Dict[str, Any]) -> Dict[str, Any]:
    """Check one teleop message; raises ValueError with the reason."""
    seq = msg.get("seq")
    if not isinstance(seq, int) or seq < 0:
        raise ValueError(f"teleop 'seq' must be a non-negative integer, got {seq!r}")
    for key in ("steering", "throttle"):
        v = msg.get(key)
        if not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 1:
            raise ValueError(f"teleop '{key}' must be a number in [-1, 1], got {v!r}")
    if not isinstance(msg.get("deadman"), bool):
        raise ValueError("teleop 'deadman' must be true or false")
    return msg


class Teleop:
    def __init__(self, cfg: TeleopConfig = TeleopConfig(), clock: Callable[[], float] = time.monotonic) -> None:
        self.cfg, self.clock = cfg, clock
        self.mode = "autonomous"
        self.controller: Optional[str] = None
        #: Latest speed from the frames (m/s, real units), for the standstill rule and the speed cap.
        self.speed = 0.0
        self._latest: Optional[Dict[str, Any]] = None
        self._at = 0.0

    def claim(self, client: str) -> bool:
        if self.controller in (None, client):
            self.controller = client
            return True
        return False

    def release(self, client: str) -> None:
        if self.controller == client:
            self.controller, self._latest = None, None

    def receive(self, client: str, msg: Dict[str, Any]) -> None:
        """Keep the newest message of the controlling phone; older or foreign messages are dropped."""
        parse_teleop(msg)
        if client == self.controller and (self._latest is None or msg["seq"] > self._latest["seq"]):
            self._latest, self._at = msg, self.clock()

    def request_mode(self, client: str, mode: str) -> Optional[str]:
        """Switch modes; returns the reason when refused. Stopping is always allowed, from any phone."""
        if mode not in MODES:
            return f"unknown mode {mode!r}"
        if mode != "stopped" and client != self.controller:
            return "another phone has control"
        if mode != "stopped" and self.speed > STANDSTILL:
            return "stop the car before switching"
        self.mode = mode
        return None

    def command(self) -> Command:
        """The command for the current control tick, in real units."""
        m = self._latest
        if self.mode != "teleop" or m is None or not m["deadman"] or self.clock() - self._at > self.cfg.timeout:
            return Command(FULL_BRAKE, 0.0)
        accel = m["throttle"] * (self.cfg.max_accel if m["throttle"] >= 0 else self.cfg.max_brake)
        if accel > 0 and self.speed >= self.cfg.max_speed:
            accel = 0.0
        return Command(accel, m["steering"])
