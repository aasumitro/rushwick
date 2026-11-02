"""The phone's door into the car program: the teleop page and its WebSocket on one port (8080)."""

from __future__ import annotations

import json
from http import HTTPStatus
from importlib import resources
from typing import Any
from urllib.parse import parse_qs, urlsplit

from websockets.asyncio.server import Server, ServerConnection, serve
from websockets.datastructures import Headers
from websockets.http11 import Request, Response

from .telemetry import TelemetryHub
from .teleop import Teleop


def page() -> bytes:
    return resources.files("rushwick_autonomy").joinpath("teleop_page.html").read_bytes()


class TeleopServer:
    def __init__(self, teleop: Teleop, hub: TelemetryHub, token: str) -> None:
        self.teleop, self.hub, self.token = teleop, hub, token

    def process_request(self, connection: ServerConnection, request: Request) -> Response | None:
        """GET / serves the page; /ws needs the token printed at start; anything else is 404."""
        url = urlsplit(request.path)
        if url.path == "/ws":
            if parse_qs(url.query).get("token", [""])[0] != self.token:
                return connection.respond(HTTPStatus.FORBIDDEN, "wrong or missing token\n")
            return None
        if url.path == "/":
            return Response(200, "OK", Headers([("Content-Type", "text/html; charset=utf-8"), ("Cache-Control", "no-store")]), page())
        return connection.respond(HTTPStatus.NOT_FOUND, "not found\n")

    async def handle(self, ws: ServerConnection) -> None:
        client = str(id(ws))
        controls = self.teleop.claim(client)
        self.hub.subscribe(ws, {"state", "system"})
        await ws.send(json.dumps({"type": "welcome", "controller": controls, "mode": self.teleop.mode}))
        try:
            async for raw in ws:
                await self.on_message(ws, client, json.loads(raw))
        except (ValueError, KeyError) as e:  # an invalid message ends the session; the car then brakes
            await ws.close(1008, str(e)[:120])
        finally:
            self.teleop.release(client)
            self.hub.unsubscribe(ws)

    async def on_message(self, ws: ServerConnection, client: str, msg: dict[str, Any]) -> None:
        kind = msg.get("type")
        if kind == "teleop":
            self.teleop.receive(client, msg)
            await ws.send(json.dumps({"type": "teleop-ack", "seq": msg["seq"], "sentAt": msg.get("sentAt"), "mode": self.teleop.mode}))
        elif kind == "mode":
            refused = self.teleop.request_mode(client, msg.get("mode", ""))
            await ws.send(json.dumps({"type": "mode", "mode": self.teleop.mode, "refused": refused}))
        elif kind == "subscribe":
            self.hub.subscribe(ws, set(msg.get("topics", [])))
        else:
            raise ValueError(f"unknown message type {kind!r}")


async def serve_teleop(teleop: Teleop, hub: TelemetryHub, host: str, port: int, token: str) -> Server:
    server = TeleopServer(teleop, hub, token)
    return await serve(server.handle, host, port, process_request=server.process_request)
