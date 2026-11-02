"""Command line: rushwick-autonomy --hardware sim --listen 0.0.0.0:8765 --policy simple"""

from __future__ import annotations

import argparse
import asyncio
from typing import List, Optional

from .hardware import RealHardware, SimHardware
from .lane_keeper import SimpleLaneKeeper
from .loop import PolicyFactory, run
from .policy import EchoPolicy, OnnxPolicy
from .safety import Safety, SafetyConfig


def policy_factory(spec: str) -> PolicyFactory:
    if spec == "echo":
        return lambda hello: EchoPolicy()
    if spec == "simple":
        return lambda hello: SimpleLaneKeeper()
    if spec.startswith("onnx:"):
        return lambda hello: OnnxPolicy.load(spec[len("onnx:"):], hello)
    raise SystemExit(f"unknown policy '{spec}': use echo, simple or onnx:<path>")


def parse_args(argv: Optional[List[str]]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="rushwick-autonomy", description="Rushwick Autonomy: the driving stack that runs on the vehicle.")
    p.add_argument("--hardware", choices=["sim", "real"], default="sim", help="sim: Rushwick connects over WebSocket; real: the car (Phase C)")
    p.add_argument("--listen", default="0.0.0.0:8765", help="host:port to listen on with --hardware sim")
    p.add_argument("--policy", default="simple", help="echo | simple | onnx:<path> (default simple)")
    p.add_argument("--max-speed", type=float, default=None, help="speed cap in m/s (default: 1.2 x the posted limit)")
    p.add_argument(
        "--lidar-stop",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="brake for lidar returns just ahead (default: on with real hardware, off in SIL, where the 2D lidar sees curbs as walls)",
    )
    return p.parse_args(argv)


async def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv)
    make_policy = policy_factory(args.policy)
    host, port = args.listen.rsplit(":", 1)
    hw = SimHardware(host, int(port)) if args.hardware == "sim" else RealHardware()
    await hw.start()
    lidar_stop = args.hardware == "real" if args.lidar_stop is None else args.lidar_stop
    safety = Safety(SafetyConfig(max_speed=args.max_speed, lidar_stop=lidar_stop))
    print(f"rushwick-autonomy: listening on ws://{host}:{port} with policy {args.policy} (lidar stop {'on' if lidar_stop else 'off'})", flush=True)
    await run(hw, make_policy, safety, log=lambda s: print(s, flush=True))


def run_cli() -> None:
    """Entry point of the `rushwick-autonomy` console script and of `python -m rushwick_autonomy`."""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
