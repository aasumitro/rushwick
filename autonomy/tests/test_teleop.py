import pytest

from rushwick_autonomy import Command, Safety, SafetyConfig
from rushwick_autonomy.driver import Driver
from rushwick_autonomy.safety import FULL_BRAKE
from rushwick_autonomy.telemetry import TelemetryHub
from rushwick_autonomy.teleop import Teleop, TeleopConfig, parse_teleop
from test_loop import CountingPolicy, frame

BRAKE = Command(FULL_BRAKE, 0.0)


def msg(seq, steering=0.0, throttle=0.0, deadman=True):
    return {"type": "teleop", "seq": seq, "steering": steering, "throttle": throttle, "deadman": deadman}


def driving():
    now = [0.0]
    t = Teleop(TeleopConfig(max_accel=1.0, max_brake=3.0, max_speed=1.0), clock=lambda: now[0])
    assert t.claim("phone") and t.request_mode("phone", "teleop") is None
    return t, now


@pytest.mark.parametrize("bad, reason", [({"seq": -1}, "seq"), ({"steering": 1.5}, "steering"), ({"throttle": "go"}, "throttle"), ({"deadman": 1}, "deadman")])
def test_rejects_malformed_messages(bad, reason):
    with pytest.raises(ValueError, match=reason):
        parse_teleop({**msg(0), **bad})


def test_maps_the_stick_to_acceleration_and_caps_the_speed():
    t, _ = driving()
    t.receive("phone", msg(1, steering=-0.5, throttle=0.6))
    assert t.command() == Command(0.6, -0.5)
    t.receive("phone", msg(2, throttle=-0.5))
    assert t.command() == Command(-1.5, 0.0)
    t.speed = 1.2
    t.receive("phone", msg(3, throttle=1.0))
    assert t.command() == Command(0.0, 0.0)


def test_brakes_without_deadman_after_250_ms_and_in_other_modes():
    t, now = driving()
    t.receive("phone", msg(1, throttle=1.0, deadman=False))
    assert t.command() == BRAKE
    t.receive("phone", msg(2, throttle=1.0))
    now[0] = 0.24
    assert t.command() == Command(1.0, 0.0)
    now[0] = 0.26
    assert t.command() == BRAKE
    t.request_mode("phone", "stopped")
    t.receive("phone", msg(3, throttle=1.0))
    assert t.command() == BRAKE


def test_one_controller_newest_message_wins_and_modes_change_only_at_standstill():
    t, _ = driving()
    assert not t.claim("other")
    t.receive("phone", msg(5, throttle=0.5))
    t.receive("phone", msg(4, throttle=1.0))  # late: dropped
    t.receive("other", msg(9, throttle=1.0))  # not the controller: dropped
    assert t.command() == Command(0.5, 0.0)
    assert t.request_mode("other", "autonomous") == "another phone has control"
    t.speed = 0.5
    assert t.request_mode("phone", "autonomous") == "stop the car before switching"
    assert t.request_mode("other", "stopped") is None and t.mode == "stopped"
    t.release("phone")
    assert t.controller is None and t.claim("other")


def test_driver_uses_the_phone_in_teleop_and_the_policy_otherwise():
    t, _ = driving()
    hub, policy = TelemetryHub(), CountingPolicy()
    d = Driver(Safety(SafetyConfig()), teleop=t, hub=hub)
    d.start(policy)
    t.receive("phone", msg(1, steering=0.2, throttle=0.3))
    assert d.frame(frame(0, True)) == Command(0.3, 0.2) and policy.calls == 0
    assert hub.latest["state"]["mode"] == "teleop" and hub.latest["state"]["phone"]
    # The frame reported 0.5 m/s, so the switch back waits for a standstill.
    assert t.request_mode("phone", "autonomous") == "stop the car before switching"
    t.speed = 0.0
    assert t.request_mode("phone", "autonomous") is None
    d.frame(frame(1, True))
    assert policy.calls == 1
    hub.subscribe("client", {"state"})
    assert set(hub.pending()["client"]) == {"state"} and hub.pending()["client"] == {}
