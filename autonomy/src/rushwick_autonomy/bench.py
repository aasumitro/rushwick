"""python -m rushwick_autonomy.bench --model detector.onnx [--config board.json] [--rate 10] [--seconds 60]

Times a perception model the way the car will run it: at the camera rate, on the board's
providers, next to the HIL loop. Image content barely changes the time (the input size does),
so it feeds random tensors of the model's input shape unless --frames gives saved .npy frames.
The p50 goes into `computeDelay` together with the policy time; the spread into `delayJitter`."""

from __future__ import annotations

import argparse
import time
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

import numpy as np

from .config_file import load_config
from .events import EventLog
from .onnx_session import open_session
from .report import percentiles

DTYPES = {"tensor(float)": np.float32, "tensor(float16)": np.float16, "tensor(uint8)": np.uint8}


def input_shape(shape: Sequence[Any], size: int) -> list[int]:
    """Fill dynamic dimensions: batch 1, channels 3, height and width `size` (NCHW)."""
    fill = [1, 3, size, size]
    return [d if isinstance(d, int) and d > 0 else fill[min(i, 3)] for i, d in enumerate(shape)]


def make_inputs(spec: Any, size: int, frames: str | None, count: int = 8) -> list[np.ndarray]:
    dtype = DTYPES.get(spec.type, np.float32)
    if frames:
        return [np.load(p).astype(dtype) for p in sorted(Path(frames).glob("*.npy"))]
    rng = np.random.default_rng(0)
    shape = input_shape(spec.shape, size)
    return [(rng.random(shape) * (255 if dtype == np.uint8 else 1)).astype(dtype) for _ in range(count)]


def run_bench(session: Any, inputs: list[np.ndarray], rate: float, seconds: float, clock: Callable[[], float] = time.perf_counter, sleep: Callable[[float], None] = time.sleep) -> list[float]:
    """Latencies (ms) of one inference per period of `rate` Hz (back to back when rate is 0)."""
    name = session.get_inputs()[0].name
    latencies: list[float] = []
    start = clock()
    while clock() - start < seconds:
        t0 = clock()
        session.run(None, {name: inputs[len(latencies) % len(inputs)]})
        latencies.append((clock() - t0) * 1000)
        if rate > 0:
            sleep(max(0.0, 1 / rate - (clock() - t0)))
    return latencies


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="python -m rushwick_autonomy.bench")
    p.add_argument("--model", required=True, help="ONNX detector")
    p.add_argument("--config", help="board config: its onnx_providers are used")
    p.add_argument("--rate", type=float, default=10.0, help="inferences per second, 0 for back to back (default 10, the objects channel rate)")
    p.add_argument("--seconds", type=float, default=60.0)
    p.add_argument("--size", type=int, default=320, help="height and width for dynamic input dimensions")
    p.add_argument("--frames", help="directory of .npy frames already in the model's input shape")
    p.add_argument("--log", help="JSON lines, one per inference")
    args = p.parse_args(argv)
    session, chosen = open_session(args.model, load_config(args.config).onnx_providers if args.config else None)
    inputs = make_inputs(session.get_inputs()[0], args.size, args.frames)
    latencies = run_bench(session, inputs, args.rate, args.seconds)
    events = EventLog(args.log)
    for ms in latencies:
        events.write("bench", ms=ms)
    events.close()
    print(f"providers: {', '.join(chosen)}; input {list(inputs[0].shape)} {inputs[0].dtype}")
    print(f"inference: {percentiles(latencies)}; std {np.std(latencies):.2f} ms; {len(latencies) / args.seconds:.1f} per second")


if __name__ == "__main__":
    main()
