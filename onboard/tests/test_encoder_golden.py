import numpy as np
import pytest

from rushwick_onboard import FEATURE_VERSION, encode_observation, feature_size


def test_golden_file_matches_this_encoder_version(golden):
    assert golden["featureVersion"] == FEATURE_VERSION
    assert len(golden["cases"]) > 10


def test_default_layout_has_258_features(golden):
    assert feature_size(golden["cases"][0]["sensors"]) == 258


def test_every_golden_case_encodes_like_the_typescript_encoder(golden):
    for case in golden["cases"]:
        features = encode_observation(case["observation"], case["sensors"])
        assert features.dtype == np.float32
        np.testing.assert_allclose(features, np.asarray(case["features"], dtype=np.float32), rtol=0, atol=1e-6, err_msg=case["name"])


@pytest.mark.parametrize("light, flags", [("green", [1, 0, 0]), ("none", [1, 0, 0]), ("yellow", [0, 1, 0]), ("red", [0, 0, 1]), ("unknown", [0, 0, 0])])
def test_light_flags_and_unknown_time_left(golden, light, flags):
    case = golden["cases"][0]
    obs = dict(case["observation"], route=dict(case["observation"]["route"], nextStop={"distance": 37.5, "light": light, "timeLeft": None}))
    stop = 5 + 3 * case["sensors"]["waypoints"] + 3
    assert encode_observation(obs, case["sensors"])[stop : stop + 6].tolist() == [1, 0.25] + flags + [1]
