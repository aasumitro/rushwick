"""Turns each frame into one safe command: the policy or the phone proposes, the safety layer
decides, and the outputs, the event log and the telemetry record what happened."""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from .events import EventLog
from .outputs import CommandSink
from .policy import Policy
from .safety import Command, Safety
from .telemetry import TelemetryHub
from .teleop import Teleop


class Driver:
    def __init__(
        self,
        safety: Safety,
        sink: Optional[CommandSink] = None,
        events: Optional[EventLog] = None,
        teleop: Optional[Teleop] = None,
        hub: Optional[TelemetryHub] = None,
    ) -> None:
        self.safety, self.sink, self.teleop, self.hub = safety, sink, teleop, hub
        self.events = events or EventLog(None)
        self.policy: Optional[Policy] = None
        self.last = Command(0.0, 0.0)

    def start(self, policy: Optional[Policy]) -> None:
        """A new session (hello), or none (disconnected): idle command."""
        self.policy = policy
        self.last = Command(0.0, 0.0)

    def new_episode(self) -> None:
        """Fresh policy state and an idle command."""
        self.last = Command(0.0, 0.0)
        if self.policy is not None:
            self.policy.reset()

    def frame(self, msg: Dict[str, Any]) -> Command:
        """The command for this frame. Policies run only on control ticks; other frames repeat the last command."""
        received, policy_ms = time.perf_counter(), None
        speed = msg["odom"]["twist"]["linear"]["x"]
        if self.teleop is not None:
            self.teleop.speed = speed
        if msg["controlTick"] and self.policy is not None:
            if self.teleop is not None and self.teleop.mode != "autonomous":
                proposed = self.teleop.command()
            else:
                proposed = self.policy.act(msg)
                policy_ms = (time.perf_counter() - received) * 1000
            self.last = self.safety.check(proposed, msg["observation"])
        if self.sink is not None:
            self.sink.command(self.last, msg)
        self.events.write("frame", seq=msg["seq"], policy_ms=policy_ms, handle_ms=(time.perf_counter() - received) * 1000)
        self._publish(speed, braking=False)
        return self.last

    def watchdog(self, seq: int) -> Command:
        """No frame in time: full brake, also on the real outputs."""
        brake = self.safety.watchdog()
        if self.sink is not None:
            self.sink.command(brake, None)
        self.events.write("watchdog", seq=seq)
        self.last = brake
        self._publish(None, braking=True)
        return brake

    def _publish(self, speed: Optional[float], braking: bool) -> None:
        if self.hub is not None:
            mode = self.teleop.mode if self.teleop is not None else "autonomous"
            self.hub.publish("state", {
                "mode": mode, "speed": speed, "acceleration": self.last.acceleration, "steering": self.last.steering,
                "watchdog": braking, "phone": self.teleop is not None and self.teleop.controller is not None,
                "interventions": dict(self.safety.interventions),
            })
