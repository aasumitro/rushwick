"""python -m rushwick_autonomy.calibrate --config board.json --channel steering --pulses 1500 1600 --i-have-a-kill-switch

Bench calibration (docs/hil.md section 5). Holds one PCA9685 channel at each pulse width in
turn, `--period` seconds each, while the watchdog heartbeat runs. With `--led-pin` an LED
toggles at every change, so one 240 fps video shows the command and the servo or wheel
reaction (actuation delay). Ctrl+C or `--seconds` ends it with both channels at neutral."""

from __future__ import annotations

import argparse
import itertools
import time
from collections.abc import Callable, Sequence

from .actuation import Actuation, open_actuation
from .config import HeartbeatConfig
from .config_file import load_config
from .events import EventLog
from .heartbeat import PERIOD, FakeHeartbeat, Heartbeat, open_heartbeat

#: Standard RC pulse range with a margin; anything outside it is a typo, not a calibration value (µs).
PULSE_RANGE = (800.0, 2200.0)


def cycle_pulses(
    act: Actuation,
    channel: int,
    pulses: Sequence[float],
    period: float,
    heartbeat: Heartbeat,
    led: Heartbeat,
    events: EventLog,
    seconds: float = float("inf"),
    clock: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
) -> None:
    end = clock() + seconds
    for pulse in itertools.cycle(pulses):
        act.pwm.set_pulse_us(channel, pulse)
        led.beat()
        events.write("pulse", channel=channel, pulse_us=pulse)
        until = min(clock() + period, end)
        while clock() < until:
            heartbeat.beat()
            sleep(PERIOD)
        if clock() >= end:
            return


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="python -m rushwick_autonomy.calibrate")
    p.add_argument("--config", required=True, help="board config, autonomy/configs/<board>.json")
    p.add_argument("--channel", choices=["steering", "throttle"], required=True)
    p.add_argument("--pulses", type=float, nargs="+", required=True, help="pulse widths to cycle through (µs); list the rest position first")
    p.add_argument("--period", type=float, default=1.0, help="seconds at each pulse (default 1)")
    p.add_argument("--seconds", type=float, default=float("inf"), help="stop after this many seconds (default: at Ctrl+C)")
    p.add_argument("--led-pin", type=int, help="LED toggled at every change; same numbering as the heartbeat pin")
    p.add_argument("--log", help="JSON lines, one per change")
    p.add_argument("--i-have-a-kill-switch", action="store_true", help="confirm the bench checklist in autonomy/docs/hil.md")
    args = p.parse_args(argv)
    if not args.i_have_a_kill_switch:
        p.error("this drives real motors: run the bench checklist in autonomy/docs/hil.md first, then add --i-have-a-kill-switch")
    if any(not PULSE_RANGE[0] <= u <= PULSE_RANGE[1] for u in args.pulses):
        p.error(f"pulses must be within {PULSE_RANGE[0]:.0f}-{PULSE_RANGE[1]:.0f} µs")
    cfg = load_config(args.config)
    act = open_actuation(cfg)
    act.neutral()
    heartbeat = open_heartbeat(cfg.heartbeat)
    led = FakeHeartbeat() if args.led_pin is None else open_heartbeat(HeartbeatConfig(cfg.heartbeat.backend, args.led_pin))
    channel = cfg.steering.channel if args.channel == "steering" else cfg.throttle.channel
    events = EventLog(args.log)
    try:
        cycle_pulses(act, channel, args.pulses, args.period, heartbeat, led, events, args.seconds)
    except KeyboardInterrupt:
        pass
    finally:
        # Neutral first; then the heartbeat stops and the hardware watchdog switches the outputs off.
        act.neutral()
        heartbeat.close()
        led.close()
        events.close()


if __name__ == "__main__":
    main()
