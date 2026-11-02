import asyncio
import json

from rushwick_autonomy import Safety, SafetyConfig
from rushwick_autonomy.driver import Driver
from rushwick_autonomy.events import EventLog
from rushwick_autonomy.loop import run
from rushwick_autonomy.report import board_summary, bridge_summary, percentiles
from rushwick_autonomy.stats import parse_tegrastats, parse_vcgencmd
from test_loop import HELLO, CountingPolicy, FakeHardware, frame

TEGRASTATS = (
    "11-02-2026 12:00:00 RAM 2300/7620MB (lfb 2x4MB) SWAP 0/3810MB (cached 0MB) "
    "CPU [12%@1728,10%@1728,off,9%@1510,7%@1728,8%@1728] EMC_FREQ 0% GR3D_FREQ 35%@[1020] "
    "cpu@47.5C soc2@46.2C gpu@46.4C tj@51.2C VDD_IN 7900mW/7800mW VDD_CPU_GPU_CV 1600mW/1500mW"
)


def test_parses_vcgencmd():
    s = parse_vcgencmd("temp=61.2'C", "throttled=0x50000", "frequency(0)=2400000000")
    assert s == {"temp_c": 61.2, "throttled_now": False, "throttled_since_boot": True, "arm_mhz": 2400.0}
    assert parse_vcgencmd("temp=80.0'C", "throttled=0x4", "frequency(0)=1500000000")["throttled_now"]


def test_parses_tegrastats():
    s = parse_tegrastats(TEGRASTATS)
    assert s["temps_c"]["tj"] == 51.2 and s["temps_c"]["gpu"] == 46.4
    assert (s["cpu_load"], s["cpu_mhz"], s["gpu_load"], s["gpu_mhz"], s["power_mw"]) == (12, 1510, 35, 1020, 7900)
    assert parse_tegrastats("RAM 1/2MB GR3D_FREQ 0%")["gpu_load"] == 0


def test_the_loop_logs_frames_with_policy_and_handling_times(tmp_path):
    path = tmp_path / "board.jsonl"
    events = EventLog(str(path))
    hw = FakeHardware([HELLO, frame(0, True), frame(1, False)])
    asyncio.run(run(hw, lambda hello: CountingPolicy(), Driver(Safety(SafetyConfig()), events=events), log=lambda s: None, max_messages=3))
    events.close()
    lines = [json.loads(line) for line in path.read_text().splitlines()]
    assert [e["kind"] for e in lines] == ["hello", "frame", "frame"]
    assert lines[1]["policy_ms"] >= 0 and lines[2]["policy_ms"] is None
    assert all(e["handle_ms"] >= 0 for e in lines[1:]) and lines[2]["t"] >= lines[1]["t"]


def test_reports_percentiles_misses_and_thermals():
    assert percentiles([]) == "n/a"
    assert percentiles([float(i) for i in range(1, 101)]).startswith("p50 50.00 · p95 95.00 · p99 99.00")
    board = [{"kind": "frame", "policy_ms": 4.0, "handle_ms": 5.0}, {"kind": "watchdog"}, {"kind": "stats", "temp_c": 70.5, "throttled_now": True, "arm_mhz": 1800.0}]
    summary = board_summary(board)
    assert "watchdog brakes: 1" in summary
    assert any("70.5" in line for line in summary) and any("throttled samples: 1" in line for line in summary)
    steps = [{"rttMs": 1.0, "controlTick": True, "deadlineMiss": False}, {"rttMs": None, "controlTick": True, "deadlineMiss": True}, {"rttMs": 2.0, "controlTick": False, "deadlineMiss": False}]
    assert "1 of 2 control ticks (50.00 %)" in bridge_summary(steps)[1]
