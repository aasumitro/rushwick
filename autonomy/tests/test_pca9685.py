from rushwick_autonomy.pca9685 import AUTO_INCREMENT, FULL_OFF, LED0_ON_L, MODE1, PRESCALE, RESTART, SLEEP, FakeI2c, Pca9685


def make(oscillator_hz=25e6):
    bus = FakeI2c()
    return Pca9685(bus, frequency_hz=50, oscillator_hz=oscillator_hz, sleep=lambda s: None), bus


def test_sets_the_prescaler_while_asleep_then_restarts():
    pwm, bus = make()
    assert pwm.prescale == 121  # round(25 MHz / (4096 * 50 Hz)) - 1
    assert abs(pwm.frequency_hz - 50.03) < 0.01
    mode = 0x11 & ~(RESTART | SLEEP) & 0xFF
    assert bus.writes == [
        (MODE1, [mode | SLEEP]),
        (PRESCALE, [121]),
        (MODE1, [mode | AUTO_INCREMENT]),
        (MODE1, [mode | AUTO_INCREMENT | RESTART]),
    ]


def test_writes_pulse_widths_as_ticks_per_channel():
    pwm, bus = make()
    pwm.set_pulse_us(0, 1500)
    pwm.set_pulse_us(1, 2000)
    # 1500 µs at 50.03 Hz: 1500e-6 * 50.03 * 4096 = 307.4 -> 307 = 0x133
    assert bus.writes[-2] == (LED0_ON_L, [0, 0, 0x33, 0x01])
    assert bus.writes[-1] == (LED0_ON_L + 4, [0, 0, 410 & 0xFF, 410 >> 8])


def test_clamps_and_switches_channels_off():
    pwm, bus = make()
    pwm.set_pulse_us(2, 1e9)
    assert bus.writes[-1] == (LED0_ON_L + 8, [0, 0, 0xFF, 0x0F])
    pwm.off(3)
    assert bus.writes[-1] == (LED0_ON_L + 12, [0, 0, 0, FULL_OFF])


def test_the_oscillator_value_is_the_calibration_knob():
    # A board whose oscillator really runs at 26 MHz (4% fast).
    nominal, _ = make()
    ticks = round(1500e-6 * nominal.frequency_hz * 4096)
    real_frequency = 26e6 / (4096 * (nominal.prescale + 1))
    # Assuming 25 MHz, a commanded 1500 µs comes out about 4% short ...
    assert abs(ticks / (real_frequency * 4096) - 1440e-6) < 5e-6
    # ... while the measured 26 MHz in the config keeps it within 3 µs.
    calibrated, _ = make(26e6)
    assert calibrated.prescale == 126
    ticks = round(1500e-6 * calibrated.frequency_hz * 4096)
    assert abs(ticks / (calibrated.frequency_hz * 4096) - 1500e-6) < 3e-6
