"""Command line: rushwick-autonomy --hardware sim --listen 0.0.0.0:8765 --policy simple"""

from __future__ import annotations

import argparse
import asyncio
from typing import List, Optional

from .app import main

KILL_SWITCH_HINT = (
    "--actuate drives real motors. Run the bench checklist in autonomy/docs/hil.md first (wheels off the ground, "
    "RC kill switch and hardware watchdog tested), then add --i-have-a-kill-switch"
)


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="rushwick-autonomy", description="Rushwick Autonomy: the driving stack that runs on the vehicle.")
    p.add_argument("--hardware", choices=["sim", "real"], default="sim", help="sim: Rushwick connects over WebSocket; real: the car (track stage)")
    p.add_argument("--listen", default="0.0.0.0:8765", help="host:port to listen on with --hardware sim")
    p.add_argument("--policy", default="simple", help="echo | simple | onnx:<path> (default simple)")
    p.add_argument("--max-speed", type=float, default=None, help="speed cap in m/s (default: 1.2 x the posted limit)")
    p.add_argument(
        "--lidar-stop",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="brake for lidar returns just ahead (default: on with real hardware, off in SIL, where the 2D lidar sees curbs as walls)",
    )
    p.add_argument("--config", help="board config, autonomy/configs/<board>.json (needed for --actuate)")
    p.add_argument("--actuate", action="store_true", help="also drive the servo and ESC through the PCA9685 (bench, wheels off the ground)")
    p.add_argument("--i-have-a-kill-switch", action="store_true", help="confirm the bench checklist; required with --actuate")
    args = p.parse_args(argv)
    if args.actuate and not args.config:
        p.error("--actuate needs --config autonomy/configs/<board>.json")
    if args.actuate and not args.i_have_a_kill_switch:
        p.error(KILL_SWITCH_HINT)
    return args


def run_cli() -> None:
    """Entry point of the `rushwick-autonomy` console script and of `python -m rushwick_autonomy`."""
    try:
        asyncio.run(main(parse_args()))
    except KeyboardInterrupt:
        pass
