"""ONNX Runtime sessions with explicit execution providers. GPU builds of onnxruntime (the Jetson's)
refuse to create a session without them; the order says which provider runs a node first."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import Any


def import_onnxruntime() -> Any:
    try:
        import onnxruntime
    except ImportError as e:
        raise RuntimeError("ONNX models need onnxruntime: pip install -e 'autonomy[onnx]' (on a Jetson: onnxruntime-gpu for your JetPack)") from e
    return onnxruntime


def choose_providers(wanted: Sequence[str] | None, available: Sequence[str]) -> list[str]:
    """The wanted providers this build has, in the wanted order; every available one when nothing is wanted."""
    if not wanted:
        return list(available)
    return [p for p in wanted if p in available] or ["CPUExecutionProvider"]


def open_session(path: str, providers: Sequence[str] | None = None) -> tuple[Any, list[str]]:
    """A session on the best configured providers. TensorRT engines are cached next to the model, so only the first start compiles."""
    ort = import_onnxruntime()
    chosen = choose_providers(providers, ort.get_available_providers())
    options: list[Any] = []
    for p in chosen:
        if p == "TensorrtExecutionProvider":
            cache = Path(f"{path}.trt-cache")
            cache.mkdir(exist_ok=True)
            options.append((p, {"trt_engine_cache_enable": True, "trt_engine_cache_path": str(cache)}))
        else:
            options.append(p)
    return ort.InferenceSession(path, providers=options), chosen
