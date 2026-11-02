"""The car program's main loop: frames in, policy on control ticks, safety, commands out."""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional

from .encoder import FEATURE_VERSION
from .hardware import Hardware
from .policy import Policy
from .safety import Command, Safety

PROTOCOL_VERSION = 1

PolicyFactory = Callable[[Dict[str, Any]], Policy]


async def run(hw: Hardware, make_policy: PolicyFactory, safety: Safety, log: Callable[[str], None] = print, max_messages: Optional[int] = None) -> None:
    """Serve forever (or `max_messages`, for tests). In lockstep the frame `stamp` is the
    only clock; in realtime a wall-clock watchdog brakes when frames stop arriving."""
    hello: Optional[Dict[str, Any]] = None
    policy: Optional[Policy] = None
    last = Command(0.0, 0.0)
    last_seq = -1
    handled = 0
    braking = False
    while max_messages is None or handled < max_messages:
        realtime = hello is not None and hello["mode"] == "realtime"
        started = time.monotonic()
        msg = await hw.read_frame(safety.cfg.stale_after if realtime else None)
        handled += 1
        if msg is None:
            if last_seq >= 0:
                await hw.write_command(last_seq, safety.watchdog())
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
            hello, policy, last_seq = msg, make_policy(msg), -1
            log(f"hello: profile {msg['profile']} (scale {msg['scale']}), {msg['mode']}, {msg['controlHz']:g} Hz control")
        elif kind == "episode" and policy is not None:
            if msg["event"] == "start":
                policy.reset()
                last = Command(0.0, 0.0)
            else:
                log(f"episode {msg['index']}: {msg['outcome']}")
        elif kind == "frame" and policy is not None:
            if msg["controlTick"]:
                last = safety.check(policy.act(msg), msg["observation"])
            last_seq = msg["seq"]
            await hw.write_command(last_seq, last)
        elif kind == "disconnected":
            hello, policy, last_seq = None, None, -1
            log(f"Rushwick disconnected; safety interventions so far: {dict(safety.interventions)}")
