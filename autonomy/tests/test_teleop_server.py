import asyncio
import json

import pytest
from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

from rushwick_autonomy.telemetry import TelemetryHub
from rushwick_autonomy.teleop import Teleop
from rushwick_autonomy.teleop_server import serve_teleop


async def http_get(port, path):
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    writer.write(f"GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n".encode())
    data = await reader.read()
    writer.close()
    return data.decode()


def test_serves_the_page_guards_the_socket_and_relays_commands():
    async def scenario():
        teleop, hub = Teleop(), TelemetryHub()
        server = await serve_teleop(teleop, hub, "127.0.0.1", 0, "secret")
        port = server.sockets[0].getsockname()[1]
        page = await http_get(port, "/?token=secret")
        assert page.startswith("HTTP/1.1 200") and "<title>Rushwick teleop</title>" in page
        assert (await http_get(port, "/missing")).startswith("HTTP/1.1 404")
        with pytest.raises(InvalidStatus):
            async with connect(f"ws://127.0.0.1:{port}/ws?token=wrong"):
                pass
        async with connect(f"ws://127.0.0.1:{port}/ws?token=secret") as phone, connect(f"ws://127.0.0.1:{port}/ws?token=secret") as other:
            assert json.loads(await phone.recv())["controller"] is True
            assert json.loads(await other.recv())["controller"] is False
            await phone.send(json.dumps({"type": "mode", "mode": "teleop"}))
            assert json.loads(await phone.recv()) == {"type": "mode", "mode": "teleop", "refused": None}
            await phone.send(json.dumps({"type": "teleop", "seq": 1, "sentAt": 5.0, "steering": 0.1, "throttle": 0.2, "deadman": True}))
            assert json.loads(await phone.recv())["type"] == "teleop-ack"
            assert teleop.command().acceleration == pytest.approx(0.2)
            await phone.send(json.dumps({"type": "teleop", "seq": 2, "steering": 3, "throttle": 0, "deadman": True}))
            await asyncio.sleep(0.05)
        assert teleop.controller is None  # control released with the connection
        server.close()

    asyncio.run(scenario())
