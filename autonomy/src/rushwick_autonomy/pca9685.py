"""Minimal PCA9685 driver: 16 channels of servo-rate PWM over I2C."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Protocol

MODE1, PRESCALE, LED0_ON_L = 0x00, 0xFE, 0x06
RESTART, AUTO_INCREMENT, SLEEP = 0x80, 0x20, 0x10
#: Bit 4 of LEDn_OFF_H switches a channel fully off.
FULL_OFF = 0x10


class I2cBus(Protocol):
    def read_byte_data(self, address: int, register: int) -> int: ...

    def write_byte_data(self, address: int, register: int, value: int) -> None: ...

    def write_i2c_block_data(self, address: int, register: int, data: list[int]) -> None: ...


class FakeI2c:
    """Records writes instead of touching hardware (tests and laptop dry runs)."""

    def __init__(self) -> None:
        self.registers = {MODE1: 0x11}
        self.writes: list[tuple[int, list[int]]] = []

    def read_byte_data(self, address: int, register: int) -> int:
        return self.registers.get(register, 0)

    def write_byte_data(self, address: int, register: int, value: int) -> None:
        self.registers[register] = value
        self.writes.append((register, [value]))

    def write_i2c_block_data(self, address: int, register: int, data: list[int]) -> None:
        self.writes.append((register, list(data)))


class Pca9685:
    def __init__(self, bus: I2cBus, address: int = 0x40, frequency_hz: float = 50.0, oscillator_hz: float = 25e6, sleep: Callable[[float], None] = time.sleep) -> None:
        self.bus, self.address = bus, address
        self.prescale = max(3, min(255, round(oscillator_hz / (4096 * frequency_hz)) - 1))
        #: The frequency actually produced after rounding the prescaler (Hz).
        self.frequency_hz = oscillator_hz / (4096 * (self.prescale + 1))
        mode = bus.read_byte_data(address, MODE1) & ~(RESTART | SLEEP) & 0xFF
        # The prescaler can only change while the oscillator sleeps.
        bus.write_byte_data(address, MODE1, mode | SLEEP)
        bus.write_byte_data(address, PRESCALE, self.prescale)
        bus.write_byte_data(address, MODE1, mode | AUTO_INCREMENT)
        sleep(0.0005)  # oscillator start-up time
        bus.write_byte_data(address, MODE1, mode | AUTO_INCREMENT | RESTART)

    def set_pulse_us(self, channel: int, pulse_us: float) -> None:
        ticks = max(0, min(4095, round(pulse_us * 1e-6 * self.frequency_hz * 4096)))
        self.bus.write_i2c_block_data(self.address, LED0_ON_L + 4 * channel, [0, 0, ticks & 0xFF, ticks >> 8])

    def off(self, channel: int) -> None:
        self.bus.write_i2c_block_data(self.address, LED0_ON_L + 4 * channel, [0, 0, 0, FULL_OFF])
