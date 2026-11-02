import numpy as np
import pytest

from rushwick_autonomy import Command
from rushwick_autonomy.lane_keeper import SimpleLaneKeeper
from rushwick_autonomy.policy import EchoPolicy, OnnxPolicy


def wire_case(golden):
    case = next(c for c in golden["cases"] if c["scale"] != 1 and c["observation"]["route"]["nextStop"] is not None)
    hello = {"featureVersion": golden["featureVersion"], "scale": case["scale"], "sensors": case["sensors"]}
    return case, hello, {"type": "frame", "seq": 0, "stamp": 0, "controlTick": True, "observation": case["real"]}


def test_echo_returns_the_teacher_action():
    assert EchoPolicy().act({"teacher": {"acceleration": 0.4, "steering": -0.02}}) == Command(0.4, -0.02)
    with pytest.raises(RuntimeError, match="--teacher"):
        EchoPolicy().act({})


def test_onnx_policy_feeds_features_and_converts_the_action_to_real_units(golden):
    case, hello, frame = wire_case(golden)

    class FakeSession:
        def get_inputs(self):
            return [type("Input", (), {"name": "features"})()]

        def run(self, outputs, feeds):
            self.x = feeds["features"]
            return [np.array([[5.0, -0.3]], dtype=np.float32)]

    session = FakeSession()
    cmd = OnnxPolicy(session, hello).act(frame)
    assert session.x.shape == (1, 258) and session.x.dtype == np.float32
    np.testing.assert_allclose(session.x[0], case["features"], atol=1e-6)
    assert cmd.acceleration == pytest.approx(0.5) and cmd.steering == pytest.approx(-0.3)
    with pytest.raises(RuntimeError, match="feature version"):
        OnnxPolicy(session, dict(hello, featureVersion=99))


def test_lane_keeper_steers_toward_the_route_and_holds_a_fraction_of_the_limit(golden):
    _, _, frame = wire_case(golden)
    obs = frame["observation"]
    cmd = SimpleLaneKeeper().act(frame)
    assert -1 <= cmd.steering <= 1
    still = dict(obs, ego=dict(obs["ego"], speed=0.0), vehicles=[], pedestrians=[], route=dict(obs["route"], nextStop=None))
    assert SimpleLaneKeeper().act(dict(frame, observation=still)).acceleration > 0
    fast = dict(still, ego=dict(still["ego"], speed=10 * obs["route"]["speedLimit"]))
    assert SimpleLaneKeeper().act(dict(frame, observation=fast)).acceleration < 0
