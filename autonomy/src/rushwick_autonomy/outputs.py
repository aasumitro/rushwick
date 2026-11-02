"""Where safe commands go besides Rushwick: the real servo and ESC with --actuate."""

from __future__ import annotations

from typing import Any, Protocol

from .actuation import Actuation
from .safety import Command


class CommandSink(Protocol):
    def command(self, cmd: Command, frame: dict[str, Any] | None) -> None:
        """Called after every command sent; `frame` is None for a watchdog brake."""
        ...

    def close(self) -> None: ...


class ActuatedOutputs:
    """--actuate: mirrors every safe command to the PCA9685 while the simulation drives.
    Outputs start and end at neutral, and a watchdog brake (no frame) sets neutral too."""

    def __init__(self, actuation: Actuation) -> None:
        self.actuation = actuation
        actuation.neutral()

    def command(self, cmd: Command, frame: dict[str, Any] | None) -> None:
        if frame is None:
            self.actuation.neutral()
        else:
            self.actuation.apply(cmd, frame["odom"]["twist"]["linear"]["x"])

    def close(self) -> None:
        self.actuation.neutral()
