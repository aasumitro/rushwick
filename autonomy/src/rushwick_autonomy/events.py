"""HIL event log: one JSON line per event with a monotonic timestamp, joined with Rushwick's log by `seq`."""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Any, Optional


class EventLog:
    """Writes nothing without a path, so the loop can always call it. Lines are flushed as they are written."""

    def __init__(self, path: Optional[str]) -> None:
        self.out = None
        if path:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            self.out = open(path, "a", buffering=1)

    def write(self, kind: str, **fields: Any) -> None:
        if self.out is not None:
            self.out.write(json.dumps({"kind": kind, "t": time.monotonic(), **fields}) + "\n")

    def close(self) -> None:
        if self.out is not None:
            self.out.close()
            self.out = None


def git_commit() -> Optional[str]:
    """The checked-out commit, so every log says which code produced it (None outside a Git checkout)."""
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=Path(__file__).parent, timeout=5)
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None
