import json
from pathlib import Path

import pytest

from rushwick_autonomy.actuation import open_actuation
from rushwick_autonomy.calibrate import cycle_pulses, main
from rushwick_autonomy.config_file import load_config
from rushwick_autonomy.events import EventLog
from rushwick_autonomy.heartbeat import FakeHeartbeat
from rushwick_autonomy.pca9685 import LED0_ON_L

LAPTOP = Path(__file__).parent.parent / "configs" / "laptop.json"


def test_cycles_pulses_while_the_heartbeat_runs_and_toggles_the_led_per_change():
    act = open_actuation(load_config(LAPTOP))
    heartbeat, led, now = FakeHeartbeat(), FakeHeartbeat(), [0.0]

    def sleep(s):
        now[0] += s

    cycle_pulses(act, 0, [1500, 1600], 0.5, heartbeat, led, EventLog(None), seconds=1.6, clock=lambda: now[0], sleep=sleep)
    ticks = [data[2] | data[3] << 8 for reg, data in act.pwm.bus.writes if reg == LED0_ON_L]
    assert ticks == [round(us * 1e-6 * act.pwm.frequency_hz * 4096) for us in (1500, 1600, 1500, 1600)]
    assert led.beats == 4 and heartbeat.beats >= 30


def test_refuses_without_the_kill_switch_flag_and_rejects_typos():
    base = ["--config", str(LAPTOP), "--channel", "steering"]
    with pytest.raises(SystemExit):
        main(base + ["--pulses", "1500"])
    with pytest.raises(SystemExit):
        main(base + ["--pulses", "15000", "--i-have-a-kill-switch"])


def test_logs_each_change(tmp_path):
    log = tmp_path / "pulses.jsonl"
    main(["--config", str(LAPTOP), "--channel", "throttle", "--pulses", "1560", "--seconds", "0", "--log", str(log), "--i-have-a-kill-switch"])
    assert [json.loads(line)["pulse_us"] for line in log.read_text().splitlines()] == [1560]
