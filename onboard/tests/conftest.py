import json
from pathlib import Path

import pytest

from rushwick_onboard import FEATURE_VERSION

GOLDEN = Path(__file__).parent / "golden" / f"encoder-v{FEATURE_VERSION}.json"


@pytest.fixture(scope="session")
def golden():
    """Golden vectors exported by `npm run sim:golden` (sim units, plus the wire form where scale != 1)."""
    return json.loads(GOLDEN.read_text())
