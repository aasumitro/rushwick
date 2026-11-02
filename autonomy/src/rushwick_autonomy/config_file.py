"""Load and check a board config: one JSON file per board, so the same program runs on every board."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Sequence, Union

from .config import BoardConfig, HeartbeatConfig, I2cConfig, PwmConfig, SteeringConfig, ThrottleConfig

I2C_BACKENDS = ("smbus2", "fake")
HEARTBEAT_BACKENDS = ("gpiozero", "jetson-gpio", "fake")
STATS_BACKENDS = ("vcgencmd", "tegrastats", "none")


def _one_of(value: str, allowed: Sequence[str], what: str) -> None:
    if value not in allowed:
        raise ValueError(f"{what} must be one of {', '.join(allowed)}, got {value!r}")


def _check(cfg: BoardConfig) -> None:
    _one_of(cfg.i2c.backend, I2C_BACKENDS, "i2c.backend")
    _one_of(cfg.heartbeat.backend, HEARTBEAT_BACKENDS, "heartbeat.backend")
    _one_of(cfg.stats, STATS_BACKENDS, "stats")
    for ch in (cfg.steering.channel, cfg.throttle.channel):
        if not 0 <= ch <= 15:
            raise ValueError(f"PCA9685 channel {ch} is outside 0-15")
    pulses = (cfg.steering.center_us, cfg.steering.left_us, cfg.steering.right_us, cfg.throttle.neutral_us, cfg.throttle.start_us, cfg.throttle.full_us)
    if any(not 500 <= p <= 2500 for p in pulses):
        raise ValueError("pulse widths must be within 500-2500 µs")


def parse_config(raw: Dict[str, Any]) -> BoardConfig:
    cfg = BoardConfig(
        board=raw["board"],
        i2c=I2cConfig(**raw["i2c"]),
        pwm=PwmConfig(**raw["pwm"]),
        steering=SteeringConfig(**raw["steering"]),
        throttle=ThrottleConfig(**raw["throttle"]),
        heartbeat=HeartbeatConfig(**raw["heartbeat"]),
        stats=raw["stats"],
        onnx_providers=list(raw["onnx_providers"]),
    )
    _check(cfg)
    return cfg


def load_config(path: Union[str, Path]) -> BoardConfig:
    """Load and check a board config; every problem names the file. A top-level "notes" key is ignored."""
    try:
        raw = json.loads(Path(path).read_text())
        return parse_config({k: v for k, v in raw.items() if k != "notes"})
    except (OSError, KeyError, TypeError, ValueError) as e:
        raise ValueError(f"Invalid board config {path}: {e}") from e
