"""python -m rushwick_autonomy.report runs/board.jsonl [--bridge runs/hil.jsonl]

Summarizes a HIL run: the car program's event log (policy and frame handling times,
watchdog, system stats) and, optionally, the `sim:bridge --log` of the same run
(round trips, deadline misses, watchdog trips)."""

from __future__ import annotations

import argparse
import json
import math
from typing import Any, Dict, List, Optional


def percentiles(values: List[float]) -> str:
    if not values:
        return "n/a"
    s = sorted(values)
    pick = lambda p: s[max(0, math.ceil(p * len(s)) - 1)]
    return f"p50 {pick(0.5):.2f} · p95 {pick(0.95):.2f} · p99 {pick(0.99):.2f} ms (n={len(s)})"


def read(path: str) -> List[Dict[str, Any]]:
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def board_summary(events: List[Dict[str, Any]]) -> List[str]:
    frames = [e for e in events if e["kind"] == "frame"]
    stats = [e for e in events if e["kind"] == "stats"]
    lines = [
        f"policy time:   {percentiles([e['policy_ms'] for e in frames if e.get('policy_ms') is not None])}",
        f"frame handling: {percentiles([e['handle_ms'] for e in frames])}",
        f"watchdog brakes: {sum(1 for e in events if e['kind'] == 'watchdog')}",
    ]
    if stats:
        temps = [e.get("temp_c") or max(e.get("temps_c", {}).values(), default=0.0) for e in stats]
        lines.append(f"max temperature: {max(temps):.1f} °C over {len(stats)} samples")
        throttled = sum(1 for e in stats if e.get("throttled_now"))
        clocks = [e["cpu_mhz"] for e in stats if "cpu_mhz" in e] or [e["arm_mhz"] for e in stats if "arm_mhz" in e]
        lines.append(f"throttled samples: {throttled}; CPU clock min {min(clocks, default=0):.0f} / max {max(clocks, default=0):.0f} MHz")
    return lines


def bridge_summary(steps: List[Dict[str, Any]]) -> List[str]:
    ticks = [s for s in steps if s.get("controlTick")]
    misses = sum(1 for s in ticks if s.get("deadlineMiss"))
    return [
        f"round trip:    {percentiles([s['rttMs'] for s in steps if s.get('rttMs') is not None])}",
        f"deadline misses: {misses} of {len(ticks)} control ticks ({100 * misses / max(1, len(ticks)):.2f} %)",
        f"watchdog steps (Rushwick side): {sum(1 for s in steps if s.get('watchdog'))}",
    ]


def main(argv: Optional[List[str]] = None) -> None:
    p = argparse.ArgumentParser(prog="python -m rushwick_autonomy.report")
    p.add_argument("board_log")
    p.add_argument("--bridge", help="the sim:bridge --log of the same run")
    args = p.parse_args(argv)
    for line in board_summary(read(args.board_log)) + (bridge_summary(read(args.bridge)) if args.bridge else []):
        print(line)


if __name__ == "__main__":
    main()
