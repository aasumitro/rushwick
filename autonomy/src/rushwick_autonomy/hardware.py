"""Hardware backends. The loop only talks to `Hardware`, so the car program is
the same in SIL and on the real car; only the backend changes."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional, Protocol

from websockets.asyncio.server import ServerConnection, serve

from .safety import Command

Message = Dict[str, Any]


class Hardware(Protocol):
    async def start(self) -> None: ...

    async def read_frame(self, timeout: Optional[float]) -> Optional[Message]:
        """The next frame or bridge event (hello, episode, disconnected); None after `timeout` seconds without one."""
        ...

    async def write_command(self, seq: int, cmd: Command) -> None: ...


class SimHardware:
    """Rushwick as the vehicle: a WebSocket server (bridge protocol v1) that Rushwick connects to."""

    def __init__(self, host: str, port: int) -> None:
        self.host, self.port = host, port
        self._inbox: "asyncio.Queue[Message]" = asyncio.Queue()
        self._ws: Optional[ServerConnection] = None

    async def start(self) -> None:
        self._server = await serve(self._handle, self.host, self.port, max_size=None)

    async def read_frame(self, timeout: Optional[float]) -> Optional[Message]:
        try:
            return await asyncio.wait_for(self._inbox.get(), timeout)
        except asyncio.TimeoutError:
            return None

    async def write_command(self, seq: int, cmd: Command) -> None:
        if self._ws is not None:
            await self._ws.send(json.dumps({"type": "command", "seq": seq, "acceleration": cmd.acceleration, "steering": cmd.steering}))

    async def _handle(self, ws: ServerConnection) -> None:
        if self._ws is not None:
            await ws.close(1013, "another Rushwick instance is connected")
            return
        self._ws = ws
        try:
            async for raw in ws:
                await self._inbox.put(json.loads(raw))
        finally:
            self._ws = None
            await self._inbox.put({"type": "disconnected"})


class RealHardware:
    """Placeholder for the real car (Phase C): PCA9685 servo and ESC, lidar, IMU, wheel encoder, localization."""

    def __init__(self) -> None:
        raise NotImplementedError("RealHardware arrives with Phase C (bench actuation and HIL); use --hardware sim")
