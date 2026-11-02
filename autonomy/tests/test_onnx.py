import sys
import types

import numpy as np
import pytest

from rushwick_autonomy.bench import input_shape, make_inputs, run_bench
from rushwick_autonomy.onnx_session import choose_providers, open_session
from rushwick_autonomy.policy import OnnxPolicy

GPU = ["TensorrtExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider"]


class FakeSession:
    def __init__(self, path, providers):
        self.path, self.providers = path, providers

    def get_inputs(self):
        return [types.SimpleNamespace(name="x", shape=["batch", 3, "h", "w"], type="tensor(float)")]

    def run(self, outputs, feeds):
        return [np.zeros((1, 2), dtype=np.float32)]


@pytest.fixture
def fake_ort(monkeypatch):
    module = types.SimpleNamespace(get_available_providers=lambda: GPU, InferenceSession=FakeSession)
    monkeypatch.setitem(sys.modules, "onnxruntime", module)
    return module


def test_chooses_the_wanted_providers_that_this_build_has():
    assert choose_providers(GPU, ["CUDAExecutionProvider", "CPUExecutionProvider"]) == GPU[1:]
    assert choose_providers(None, GPU) == GPU
    assert choose_providers(["TensorrtExecutionProvider"], ["CPUExecutionProvider"]) == ["CPUExecutionProvider"]


def test_sessions_get_explicit_providers_and_a_tensorrt_cache(fake_ort, tmp_path):
    model = tmp_path / "policy.onnx"
    session, chosen = open_session(str(model), GPU)
    assert chosen == GPU
    trt, cuda, cpu = session.providers
    assert trt == ("TensorrtExecutionProvider", {"trt_engine_cache_enable": True, "trt_engine_cache_path": f"{model}.trt-cache"})
    assert (cuda, cpu) == ("CUDAExecutionProvider", "CPUExecutionProvider")
    assert (tmp_path / "policy.onnx.trt-cache").is_dir()
    hello = {"featureVersion": 1, "scale": 10, "sensors": {}}
    assert OnnxPolicy.load(str(model), hello, ["CPUExecutionProvider"]).session.providers == ["CPUExecutionProvider"]


def test_benchmark_inputs_fill_dynamic_dimensions():
    assert input_shape(["batch", 3, "h", "w"], 320) == [1, 3, 320, 320]
    assert input_shape([1, 3, 640, 640], 320) == [1, 3, 640, 640]
    spec = types.SimpleNamespace(shape=[None, None, 224, 224], type="tensor(uint8)")
    inputs = make_inputs(spec, 320, None, count=2)
    assert len(inputs) == 2 and inputs[0].shape == (1, 3, 224, 224) and inputs[0].dtype == np.uint8


def test_benchmark_keeps_the_rate_when_sleeps_overshoot():
    now = [0.0]

    def clock():
        return now[0]

    def sleep(s):
        now[0] += s + 0.005  # a loaded board wakes up late

    class Timed(FakeSession):
        def run(self, outputs, feeds):
            now[0] += 0.02  # 20 ms per inference
            return super().run(outputs, feeds)

    latencies = run_bench(Timed("m", []), [np.zeros(1)], rate=10, seconds=2.95, clock=clock, sleep=sleep)
    assert len(latencies) == 30 and all(abs(ms - 20) < 1e-6 for ms in latencies)
