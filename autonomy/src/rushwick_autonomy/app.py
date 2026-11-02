"""Builds the car program from the command-line options and runs it."""

from __future__ import annotations

import argparse
import asyncio

from .actuation import open_actuation
from .config_file import load_config
from .events import EventLog, git_commit
from .hardware import RealHardware, SimHardware
from .heartbeat import keep_beating, open_heartbeat
from .lane_keeper import SimpleLaneKeeper
from .loop import PolicyFactory, run
from .outputs import ActuatedOutputs
from .policy import EchoPolicy, OnnxPolicy
from .safety import Safety, SafetyConfig
from .stats import record_stats


def policy_factory(spec: str) -> PolicyFactory:
    if spec == "echo":
        return lambda hello: EchoPolicy()
    if spec == "simple":
        return lambda hello: SimpleLaneKeeper()
    if spec.startswith("onnx:"):
        return lambda hello: OnnxPolicy.load(spec[len("onnx:"):], hello)
    raise SystemExit(f"unknown policy '{spec}': use echo, simple or onnx:<path>")


def log(line: str) -> None:
    print(line, flush=True)


async def main(args: argparse.Namespace) -> None:
    make_policy = policy_factory(args.policy)
    host, port = args.listen.rsplit(":", 1)
    hw = SimHardware(host, int(port)) if args.hardware == "sim" else RealHardware()
    await hw.start()
    lidar_stop = args.hardware == "real" if args.lidar_stop is None else args.lidar_stop
    safety = Safety(SafetyConfig(max_speed=args.max_speed, lidar_stop=lidar_stop))
    cfg = load_config(args.config) if args.config else None
    events = EventLog(args.log)
    commit = git_commit()
    events.write("start", commit=commit, board=cfg.board if cfg else None, policy=args.policy, actuate=args.actuate)
    sink, tasks = None, []
    if cfg is not None and args.actuate:
        sink = ActuatedOutputs(open_actuation(cfg))
        tasks.append(asyncio.ensure_future(keep_beating(open_heartbeat(cfg.heartbeat))))
        log(f"actuating on {cfg.board}: steering ch{cfg.steering.channel}, throttle ch{cfg.throttle.channel}")
    if cfg is not None and args.log:
        tasks.append(asyncio.ensure_future(record_stats(cfg.stats, events)))
    log(f"rushwick-autonomy {commit or 'outside git'}: listening on ws://{host}:{port} with policy {args.policy} (lidar stop {'on' if lidar_stop else 'off'})")
    try:
        await run(hw, make_policy, safety, log=log, sink=sink, events=events)
    finally:
        # Neutral first; then the heartbeat stops and the hardware watchdog switches the outputs off.
        if sink is not None:
            sink.close()
        for task in tasks:
            task.cancel()
        events.close()
