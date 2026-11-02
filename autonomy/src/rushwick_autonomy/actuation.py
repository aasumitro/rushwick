"""From safe commands to servo and ESC pulses through the PCA9685."""

from __future__ import annotations

from .config import BoardConfig
from .pca9685 import FakeI2c, I2cBus, Pca9685
from .safety import FULL_BRAKE, Command


def open_i2c(cfg: BoardConfig) -> I2cBus:
    if cfg.i2c.backend == "fake":
        return FakeI2c()
    from smbus2 import SMBus  # only on the boards: pip install -e "autonomy[pi]" or "[jetson]"

    return SMBus(cfg.i2c.bus)


class Actuation:
    """Steering follows the command. On the bench the throttle mirrors the simulated speed:
    the wheels are off the ground and there is no wheel encoder yet, so the simulation owns
    the vehicle state. A full-brake command (safety or watchdog) sets the throttle to neutral."""

    def __init__(self, pwm: Pca9685, cfg: BoardConfig) -> None:
        self.pwm, self.cfg = pwm, cfg

    def steering_us(self, steering: float) -> float:
        c = self.cfg.steering
        s = max(-1.0, min(1.0, steering))
        return c.center_us + s * (c.left_us - c.center_us) if s >= 0 else c.center_us - s * (c.right_us - c.center_us)

    def throttle_us(self, speed: float, full_brake: bool) -> float:
        t = self.cfg.throttle
        if full_brake or speed <= 0:
            return t.neutral_us
        return t.start_us + (t.full_us - t.start_us) * min(speed / t.max_speed, 1.0)

    def apply(self, cmd: Command, speed: float) -> None:
        """`speed` is the simulated speed from the frame's odometry (m/s, real units)."""
        self.pwm.set_pulse_us(self.cfg.steering.channel, self.steering_us(cmd.steering))
        self.pwm.set_pulse_us(self.cfg.throttle.channel, self.throttle_us(speed, cmd.acceleration <= FULL_BRAKE))

    def neutral(self) -> None:
        self.pwm.set_pulse_us(self.cfg.steering.channel, self.cfg.steering.center_us)
        self.pwm.set_pulse_us(self.cfg.throttle.channel, self.cfg.throttle.neutral_us)


def open_actuation(cfg: BoardConfig) -> Actuation:
    pwm = Pca9685(open_i2c(cfg), cfg.i2c.address, cfg.pwm.frequency_hz, cfg.pwm.oscillator_hz)
    return Actuation(pwm, cfg)
