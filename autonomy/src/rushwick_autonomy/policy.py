"""Decision policies. Each gets a frame (real units) and returns a Command in real units."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol

import numpy as np

from .encoder import FEATURE_VERSION, encode_observation
from .onnx_session import open_session
from .safety import Command
from .units import observation_to_sim

Frame = dict[str, Any]


class Policy(Protocol):
    def reset(self) -> None: ...

    def act(self, frame: Frame) -> Command: ...


class EchoPolicy:
    """Returns the privileged teacher's action sent with the frame (sim:bridge --teacher). Used by the SIL echo check."""

    def reset(self) -> None:
        pass

    def act(self, frame: Frame) -> Command:
        teacher = frame.get("teacher")
        if teacher is None:
            raise RuntimeError("EchoPolicy needs frames with a teacher action: run sim:bridge with --teacher")
        return Command(teacher["acceleration"], teacher["steering"])


class OnnxPolicy:
    """A trained model: features from encode_observation() (sim units) in, [acceleration (sim units), steering] out."""

    def __init__(self, session: Any, hello: dict[str, Any]) -> None:
        if hello["featureVersion"] != FEATURE_VERSION:
            raise RuntimeError(f"Rushwick sends feature version {hello['featureVersion']}, this encoder is version {FEATURE_VERSION}")
        self.session = session
        self.input = session.get_inputs()[0].name
        self.scale = hello["scale"]
        self.sensors = hello["sensors"]

    @classmethod
    def load(cls, path: str, hello: dict[str, Any], providers: Sequence[str] | None = None) -> "OnnxPolicy":
        """`providers` comes from the board config (TensorRT, CUDA, CPU on the Jetson; CPU on the Pi)."""
        session, _ = open_session(path, providers)
        return cls(session, hello)

    def reset(self) -> None:
        pass

    def act(self, frame: Frame) -> Command:
        features = encode_observation(observation_to_sim(frame["observation"], self.scale), self.sensors)
        out = np.asarray(self.session.run(None, {self.input: features[None, :]})[0], dtype=np.float64).reshape(-1)
        # Models learn from recorded actions, which are in sim units.
        return Command(float(out[0]) / self.scale, float(out[1]))
