import asyncio
import sys
import types
from pathlib import Path

import pytest

from rushwick_autonomy.actuation import open_actuation
from rushwick_autonomy.cli import parse_args
from rushwick_autonomy.config import HeartbeatConfig
from rushwick_autonomy.config_file import load_config
from rushwick_autonomy.heartbeat import FakeHeartbeat, keep_beating, open_heartbeat
from rushwick_autonomy.outputs import ActuatedOutputs
from rushwick_autonomy.pca9685 import LED0_ON_L
from rushwick_autonomy.safety import Command

LAPTOP = Path(__file__).parent.parent / "configs" / "laptop.json"


def frame(speed):
    return {"odom": {"twist": {"linear": {"x": speed}}}}


def test_mirrors_commands_and_falls_back_to_neutral():
    act = open_actuation(load_config(LAPTOP))
    out = ActuatedOutputs(act)
    pulse = lambda: {reg: data for reg, data in act.pwm.bus.writes}
    ticks = lambda us: round(us * 1e-6 * act.pwm.frequency_hz * 4096)
    neutral = [0, 0, ticks(1500) & 0xFF, ticks(1500) >> 8]
    assert pulse()[LED0_ON_L] == neutral and pulse()[LED0_ON_L + 4] == neutral
    out.command(Command(0.5, 1.0), frame(3.0))
    assert pulse()[LED0_ON_L] == [0, 0, ticks(2000) & 0xFF, ticks(2000) >> 8]
    assert pulse()[LED0_ON_L + 4] == [0, 0, ticks(2000) & 0xFF, ticks(2000) >> 8]
    out.command(Command(-100.0, 0.0), None)
    assert pulse()[LED0_ON_L + 4] == neutral
    out.command(Command(0.5, 0.0), frame(1.0))
    out.close()
    assert pulse()[LED0_ON_L + 4] == neutral


def test_heartbeat_beats_at_20_hz_and_closes_when_cancelled():
    hb = FakeHeartbeat()

    async def scenario():
        task = asyncio.ensure_future(keep_beating(hb, period=0.01))
        await asyncio.sleep(0.055)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    asyncio.run(scenario())
    assert 4 <= hb.beats <= 8 and hb.closed


def test_gpio_backends_toggle_their_pin(monkeypatch):
    calls = []

    class Device:
        def __init__(self, pin):
            calls.append(("open", pin))

        def toggle(self):
            calls.append("toggle")

        def off(self):
            calls.append("off")

        def close(self):
            calls.append("close")

    monkeypatch.setitem(sys.modules, "gpiozero", types.SimpleNamespace(DigitalOutputDevice=Device))
    hb = open_heartbeat(HeartbeatConfig("gpiozero", 17))
    hb.beat()
    hb.close()
    assert calls == [("open", 17), "toggle", "off", "close"]
    assert isinstance(open_heartbeat(HeartbeatConfig("fake", 0)), FakeHeartbeat)


def test_actuate_needs_a_config_and_the_kill_switch_acknowledgement(capsys):
    with pytest.raises(SystemExit):
        parse_args(["--actuate", "--i-have-a-kill-switch"])
    with pytest.raises(SystemExit):
        parse_args(["--actuate", "--config", str(LAPTOP)])
    assert "bench checklist" in capsys.readouterr().err
    assert parse_args(["--actuate", "--config", str(LAPTOP), "--i-have-a-kill-switch"]).actuate
