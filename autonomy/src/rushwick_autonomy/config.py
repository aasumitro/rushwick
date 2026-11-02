"""Per-board configuration types; `config_file.py` loads and checks `autonomy/configs/<board>.json`."""

from __future__ import annotations

from dataclasses import dataclass

@dataclass(frozen=True)
class I2cConfig:
    backend: str
    bus: int
    address: int


@dataclass(frozen=True)
class PwmConfig:
    frequency_hz: float
    #: The PCA9685's real oscillator (nominally 25 MHz): the calibration knob for exact pulse widths.
    oscillator_hz: float


@dataclass(frozen=True)
class SteeringConfig:
    channel: int
    center_us: float
    #: Pulse at full left (normalized steering +1) and full right (-1).
    left_us: float
    right_us: float


@dataclass(frozen=True)
class ThrottleConfig:
    channel: int
    neutral_us: float
    #: Smallest pulse that turns the wheels, and the pulse at `max_speed` (m/s, real units).
    start_us: float
    full_us: float
    max_speed: float


@dataclass(frozen=True)
class HeartbeatConfig:
    backend: str
    pin: int


@dataclass(frozen=True)
class BoardConfig:
    board: str
    i2c: I2cConfig
    pwm: PwmConfig
    steering: SteeringConfig
    throttle: ThrottleConfig
    heartbeat: HeartbeatConfig
    stats: str
    onnx_providers: list[str]
