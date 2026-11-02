"""Heartbeat for the hardware watchdog: a GPIO the program toggles at 20 Hz. When it stops
(the program hangs, crashes or blocks for more than 100 ms), the watchdog pulls the PCA9685
OE pin high and the ESC falls back to neutral."""

from __future__ import annotations

import asyncio
from typing import Protocol

from .config import HeartbeatConfig

PERIOD = 0.05


class Heartbeat(Protocol):
    def beat(self) -> None: ...

    def close(self) -> None: ...


class FakeHeartbeat:
    def __init__(self) -> None:
        self.beats = 0
        self.closed = False

    def beat(self) -> None:
        self.beats += 1

    def close(self) -> None:
        self.closed = True


class GpiozeroHeartbeat:
    """Raspberry Pi 5 (BCM pin numbers). RPi.GPIO does not support the Pi 5, gpiozero with lgpio does."""

    def __init__(self, pin: int) -> None:
        from gpiozero import DigitalOutputDevice

        self.pin = DigitalOutputDevice(pin)

    def beat(self) -> None:
        self.pin.toggle()

    def close(self) -> None:
        self.pin.off()
        self.pin.close()


class JetsonHeartbeat:
    """Jetson (BOARD pin numbers); set the pin up as GPIO with jetson-io first."""

    def __init__(self, pin: int) -> None:
        import Jetson.GPIO as GPIO

        self.gpio, self.pin, self.level = GPIO, pin, False
        GPIO.setmode(GPIO.BOARD)
        GPIO.setup(pin, GPIO.OUT, initial=GPIO.LOW)

    def beat(self) -> None:
        self.level = not self.level
        self.gpio.output(self.pin, self.gpio.HIGH if self.level else self.gpio.LOW)

    def close(self) -> None:
        self.gpio.output(self.pin, self.gpio.LOW)
        self.gpio.cleanup(self.pin)


def open_heartbeat(cfg: HeartbeatConfig) -> Heartbeat:
    if cfg.backend == "gpiozero":
        return GpiozeroHeartbeat(cfg.pin)
    if cfg.backend == "jetson-gpio":
        return JetsonHeartbeat(cfg.pin)
    return FakeHeartbeat()


async def keep_beating(hb: Heartbeat, period: float = PERIOD) -> None:
    """Run as a task next to the loop: it stops beating exactly when the event loop stops running."""
    try:
        while True:
            hb.beat()
            await asyncio.sleep(period)
    finally:
        hb.close()
