import json
from pathlib import Path

import pytest

from rushwick_autonomy.actuation import Actuation, open_actuation
from rushwick_autonomy.config_file import load_config
from rushwick_autonomy.pca9685 import LED0_ON_L
from rushwick_autonomy.safety import FULL_BRAKE, Command

CONFIGS = Path(__file__).parent.parent / "configs"


@pytest.mark.parametrize("name", ["pi", "jetson", "laptop"])
def test_every_board_config_loads(name):
    cfg = load_config(CONFIGS / f"{name}.json")
    assert (cfg.steering.channel, cfg.throttle.channel) == (0, 1)


def test_bad_configs_name_the_file_and_the_problem(tmp_path):
    raw = json.loads((CONFIGS / "laptop.json").read_text())
    raw["heartbeat"]["backend"] = "smoke-signals"
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(raw))
    with pytest.raises(ValueError, match="bad.json.*heartbeat.backend must be one of"):
        load_config(path)
    del raw["throttle"]
    path.write_text(json.dumps(raw))
    with pytest.raises(ValueError, match="bad.json"):
        load_config(path)


def actuation():
    act = open_actuation(load_config(CONFIGS / "laptop.json"))
    return act, act.pwm.bus


def test_maps_steering_to_the_calibrated_pulses():
    act, _ = actuation()
    assert [act.steering_us(s) for s in (1, 0, -1, 0.5, 3)] == [2000, 1500, 1000, 1750, 2000]


def test_throttle_mirrors_the_simulated_speed_and_full_brake_is_neutral():
    act, _ = actuation()
    assert act.throttle_us(0, False) == 1500
    assert act.throttle_us(3.0, False) == 2000
    assert act.throttle_us(1.5, False) == pytest.approx(1560 + 220)
    assert act.throttle_us(9.0, False) == 2000
    assert act.throttle_us(2.0, True) == 1500


def test_apply_and_neutral_write_both_channels():
    act, bus = actuation()
    act.apply(Command(FULL_BRAKE, -1.0), 2.0)
    assert [reg for reg, _ in bus.writes[-2:]] == [LED0_ON_L, LED0_ON_L + 4]
    assert isinstance(act, Actuation)
    act.neutral()
    tick = lambda us: round(us * 1e-6 * act.pwm.frequency_hz * 4096)
    assert bus.writes[-2][1][2:] == [tick(1500) & 0xFF, tick(1500) >> 8]
