"""System stats at 1 Hz: temperatures, clocks, throttling and power, from `vcgencmd` (Pi) or `tegrastats` (Jetson)."""

from __future__ import annotations

import asyncio
import re
from typing import Any

from .events import EventLog
from .telemetry import TelemetryHub


def parse_vcgencmd(temp: str, throttled: str, clock: str) -> dict[str, Any]:
    """Outputs of `measure_temp`, `get_throttled` and `measure_clock arm`. Throttle bits 0-3 mean now, 16-19 since boot."""
    bits = int(throttled.split("=")[1], 16)
    return {
        "temp_c": float(re.search(r"([\d.]+)", temp).group(1)),
        "throttled_now": bool(bits & 0xF),
        "throttled_since_boot": bool(bits & 0xF0000),
        "arm_mhz": int(clock.split("=")[1]) / 1e6,
    }


def parse_tegrastats(line: str) -> dict[str, Any]:
    """One `tegrastats` line: sensor temperatures, CPU and GPU clocks (MHz) and loads, board input power."""
    cpu = re.search(r"CPU \[([^\]]*)\]", line)
    cpus = [(int(load), int(mhz)) for load, mhz in re.findall(r"(\d+)%@(\d+)", cpu.group(1))] if cpu else []
    gpu = re.search(r"GR3D_FREQ (\d+)%(?:@\[?(\d+)\]?)?", line)
    power = re.search(r"VDD_IN (\d+)mW", line)
    out: dict[str, Any] = {"temps_c": {name: float(c) for name, c in re.findall(r"(\w+)@(-?[\d.]+)C", line)}}
    if cpus:
        out["cpu_load"] = max(load for load, _ in cpus)
        out["cpu_mhz"] = min(mhz for _, mhz in cpus)
    if gpu:
        out["gpu_load"] = int(gpu.group(1))
        if gpu.group(2):
            out["gpu_mhz"] = int(gpu.group(2))
    if power:
        out["power_mw"] = int(power.group(1))
    return out


async def _run(*cmd: str) -> str:
    proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE)
    out, _ = await proc.communicate()
    return out.decode().strip()


async def record_stats(backend: str, events: EventLog, hub: TelemetryHub | None = None, period: float = 1.0) -> None:
    """Run as a task next to the loop: one `stats` event (and `system` telemetry) per period. Backend `none` does nothing."""

    def record(sample: dict[str, Any]) -> None:
        events.write("stats", **sample)
        if hub is not None:
            hub.publish("system", sample)

    if backend == "vcgencmd":
        while True:
            sample = await asyncio.gather(_run("vcgencmd", "measure_temp"), _run("vcgencmd", "get_throttled"), _run("vcgencmd", "measure_clock", "arm"))
            record(parse_vcgencmd(*sample))
            await asyncio.sleep(period)
    elif backend == "tegrastats":
        proc = await asyncio.create_subprocess_exec("tegrastats", "--interval", str(int(period * 1000)), stdout=asyncio.subprocess.PIPE)
        try:
            async for line in proc.stdout:  # type: ignore[union-attr]
                record(parse_tegrastats(line.decode()))
        finally:
            proc.terminate()
