"""The car program's main loop: bridge messages in, one safe command out per frame."""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional

from .driver import Driver
from .encoder import FEATURE_VERSION
from .hardware import Hardware
from .policy import Policy

PROTOCOL_VERSION = 1

PolicyFactory = Callable[[Dict[str, Any]], Policy]


async def run(hw: Hardware, make_policy: PolicyFactory, driver: Driver, log: Callable[[str], None] = print, max_messages: Optional[int] = None) -> None:
    """Serve forever (or `max_messages`, for tests). In lockstep the frame `stamp` is the only
    clock; in realtime a wall-clock watchdog brakes when frames stop arriving."""
    hello: Optional[Dict[str, Any]] = None
    last_seq = -1
    handled = 0
    braking = False
    while max_messages is None or handled < max_messages:
        realtime = hello is not None and hello["mode"] == "realtime"
        started = time.monotonic()
        msg = await hw.read_frame(driver.safety.cfg.stale_after if realtime else None)
        handled += 1
        if msg is None:
            brake = driver.watchdog(last_seq)
            if last_seq >= 0:
                await hw.write_command(last_seq, brake)
            if not braking:
                log(f"no frame for {time.monotonic() - started:.3f} s: braking until frames return")
            braking = True
            continue
        braking = False
        kind = msg.get("type")
        if kind == "hello":
            if msg["protocol"] != PROTOCOL_VERSION:
                raise RuntimeError(f"Rushwick speaks bridge protocol {msg['protocol']}, this program speaks {PROTOCOL_VERSION}")
            if msg["featureVersion"] != FEATURE_VERSION:
                log(f"warning: feature version {msg['featureVersion']} (encoder: {FEATURE_VERSION})")
            hello, last_seq = msg, -1
            driver.start(make_policy(msg))
            driver.events.write("hello", profile=msg["profile"], mode=msg["mode"], controlHz=msg["controlHz"])
            log(f"hello: profile {msg['profile']} (scale {msg['scale']}), {msg['mode']}, {msg['controlHz']:g} Hz control")
        elif kind == "episode" and hello is not None:
            if msg["event"] == "start":
                driver.new_episode()
            else:
                log(f"episode {msg['index']}: {msg['outcome']}")
        elif kind == "frame" and hello is not None:
            command = driver.frame(msg)
            last_seq = msg["seq"]
            await hw.write_command(last_seq, command)
        elif kind == "disconnected":
            hello, last_seq = None, -1
            driver.start(None)
            log(f"Rushwick disconnected; safety interventions so far: {dict(driver.safety.interventions)}")
