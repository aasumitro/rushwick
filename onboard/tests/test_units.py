import math

import pytest

from rushwick_onboard import encode_observation
from rushwick_onboard.units import observation_to_real, observation_to_sim


def scaled_cases(golden):
    cases = [c for c in golden["cases"] if c["scale"] != 1]
    assert cases, "the golden file should contain an rc-pi case"
    return cases


def test_to_real_matches_the_typescript_wire_form(golden):
    for case in scaled_cases(golden):
        assert observation_to_real(case["observation"], case["scale"]) == case["real"], case["name"]


def test_wire_form_converts_back_to_the_same_features(golden):
    for case in scaled_cases(golden):
        sim = observation_to_sim(case["real"], case["scale"])
        assert sim["ego"]["length"] == pytest.approx(case["observation"]["ego"]["length"], rel=1e-12)
        back = encode_observation(sim, case["sensors"])
        assert back.tolist() == pytest.approx(case["features"], abs=1e-6), case["name"]


def test_scales_lengths_speeds_and_accelerations_but_not_angles(golden):
    case = scaled_cases(golden)[0]
    real, sim = case["real"], case["observation"]
    assert real["ego"]["length"] == pytest.approx(0.45)
    assert real["ego"]["heading"] == sim["ego"]["heading"]
    assert real["ego"]["yawRate"] == sim["ego"]["yawRate"]
    assert real["route"]["headingError"] == sim["route"]["headingError"]
    assert max(real["lidar"]) <= 12 + 1e-9
    assert all(math.isclose(r * case["scale"], s) for r, s in zip(real["lidar"], sim["lidar"]))
