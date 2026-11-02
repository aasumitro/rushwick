import math

from rushwick_autonomy import Command, Safety, SafetyConfig
from rushwick_autonomy.safety import FULL_BRAKE


def observation(speed=1.0, limit=1.4, rays=None):
    """An rc-pi-sized observation in real units: 0.45 m long, 32 lidar rays."""
    return {
        "ego": {"speed": speed, "length": 0.45},
        "route": {"speedLimit": limit},
        "lidar": rays if rays is not None else [12.0] * 32,
    }


def test_passes_a_clean_command_through_unchanged():
    safety = Safety(SafetyConfig())
    cmd = Command(0.37, -0.42)
    assert safety.check(cmd, observation()) == cmd
    assert not safety.interventions


def test_clamps_steering_and_rejects_non_finite_commands():
    safety = Safety(SafetyConfig())
    assert safety.check(Command(0.1, 1.7), observation()) == Command(0.1, 1.0)
    assert safety.check(Command(math.nan, 0.0), observation()) == Command(FULL_BRAKE, 0.0)


def test_caps_speed_at_the_posted_limit_margin_or_an_explicit_cap():
    assert Safety(SafetyConfig()).check(Command(0.5, 0.0), observation(speed=1.7)).acceleration == 0.0
    assert Safety(SafetyConfig()).check(Command(-0.5, 0.0), observation(speed=1.7)).acceleration == -0.5
    assert Safety(SafetyConfig(max_speed=0.5)).check(Command(0.5, 0.0), observation(speed=0.6)).acceleration == 0.0


def test_brakes_for_an_obstacle_inside_the_clearance_ahead_only():
    ahead = [12.0] * 32
    ahead[0] = 0.25  # 2.5 cm in front of the bumper (half length 0.225 m)
    assert Safety(SafetyConfig()).check(Command(0.5, 0.0), observation(rays=ahead)).acceleration == FULL_BRAKE
    beside = [12.0] * 32
    beside[8] = 0.1  # 90 degrees to the left
    assert Safety(SafetyConfig()).check(Command(0.5, 0.0), observation(rays=beside)).acceleration == 0.5
    behind_limit = [12.0] * 32
    behind_limit[31] = 0.3  # just outside the 0.27 m limit, 11 degrees to the right
    assert Safety(SafetyConfig()).check(Command(0.5, 0.0), observation(rays=behind_limit)).acceleration == 0.5
    assert Safety(SafetyConfig(lidar_stop=False)).check(Command(0.5, 0.0), observation(rays=ahead)).acceleration == 0.5


def test_watchdog_brakes_fully():
    safety = Safety(SafetyConfig())
    assert safety.watchdog() == Command(FULL_BRAKE, 0.0)
    assert safety.interventions["watchdog"] == 1
