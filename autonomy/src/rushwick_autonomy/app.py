"""Builds the car program from the command-line options and runs it."""

from __future__ import annotations

import argparse
import asyncio
import secrets
from typing import Any

from .actuation import open_actuation
from .config import BoardConfig
from .config_file import load_config
from .driver import Driver
from .events import EventLog, git_commit
from .hardware import RealHardware, SimHardware
from .heartbeat import keep_beating, open_heartbeat
from .lane_keeper import SimpleLaneKeeper
from .loop import PolicyFactory, run
from .outputs import ActuatedOutputs
from .policy import EchoPolicy, OnnxPolicy
from .safety import Safety, SafetyConfig
from .stats import record_stats
from .telemetry import TelemetryHub
from .teleop import Teleop, TeleopConfig
from .teleop_server import serve_teleop


def policy_factory(spec: str, cfg: BoardConfig | None = None) -> PolicyFactory:
    if spec == "echo":
        return lambda hello: EchoPolicy()
    if spec == "simple":
        return lambda hello: SimpleLaneKeeper()
    if spec.startswith("onnx:"):
        return lambda hello: OnnxPolicy.load(spec[len("onnx:"):], hello, cfg.onnx_providers if cfg else None)
    raise SystemExit(f"unknown policy '{spec}': use echo, simple or onnx:<path>")


def log(line: str) -> None:
    print(line, flush=True)


async def main(args: argparse.Namespace) -> None:
    cfg = load_config(args.config) if args.config else None
    host, port = args.listen.rsplit(":", 1)
    hw = SimHardware(host, int(port)) if args.hardware == "sim" else RealHardware()
    await hw.start()
    lidar_stop = args.hardware == "real" if args.lidar_stop is None else args.lidar_stop
    events = EventLog(args.log)
    commit = git_commit()
    events.write("start", commit=commit, board=cfg.board if cfg else None, policy=args.policy, actuate=args.actuate)
    driver = Driver(Safety(SafetyConfig(max_speed=args.max_speed, lidar_stop=lidar_stop)), events=events)
    tasks: list[Any] = []
    if cfg is not None and args.actuate:
        driver.sink = ActuatedOutputs(open_actuation(cfg))
        tasks.append(asyncio.create_task(keep_beating(open_heartbeat(cfg.heartbeat))))
        log(f"actuating on {cfg.board}: steering ch{cfg.steering.channel}, throttle ch{cfg.throttle.channel}")
    if args.teleop:
        token = args.teleop_token or secrets.token_urlsafe(8)
        driver.teleop, driver.hub = Teleop(TeleopConfig(max_speed=args.teleop_max_speed)), TelemetryHub()
        teleop_host, teleop_port = args.teleop.rsplit(":", 1)
        await serve_teleop(driver.teleop, driver.hub, teleop_host, int(teleop_port), token)
        tasks.append(asyncio.create_task(driver.hub.pump()))
        log(f"teleop: http://<this host>:{teleop_port}/?token={token}")
    if cfg is not None and args.log:
        tasks.append(asyncio.create_task(record_stats(cfg.stats, events, driver.hub)))
    log(f"rushwick-autonomy {commit or 'outside git'}: listening on ws://{host}:{port} with policy {args.policy} (lidar stop {'on' if lidar_stop else 'off'})")
    try:
        await run(hw, policy_factory(args.policy, cfg), driver, log=log)
    finally:
        # Neutral first; then the heartbeat stops and the hardware watchdog switches the outputs off.
        if driver.sink is not None:
            driver.sink.close()
        for task in tasks:
            task.cancel()
        events.close()
