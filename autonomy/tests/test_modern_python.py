"""Keeps the package off deprecated APIs (AGENTS.md, Python rules). Python 3.9 has no
warning for most of them, so a runtime -W error check would not catch them."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
#: Not deprecated. Everything else in `typing` has a builtin or collections.abc replacement.
TYPING_OK = {"Any", "Protocol", "TYPE_CHECKING", "cast", "TypeVar", "Generic", "Literal", "NamedTuple", "TypedDict", "Optional", "Union", "ClassVar", "Final", "overload"}
BANNED = ("asyncio.TimeoutError", "ensure_future", "get_event_loop", "pkg_resources", "utcnow(")


def sources() -> list[Path]:
    return [p for p in sorted(ROOT.glob("src/**/*.py")) + sorted(ROOT.glob("tests/*.py")) if p.name != Path(__file__).name]


def test_no_deprecated_typing_aliases():
    bad = []
    for path in sources():
        for names in re.findall(r"^from typing import (.+)$", path.read_text(), re.M):
            bad += [f"{path.name}: {n}" for n in (n.strip() for n in names.split(",")) if n not in TYPING_OK]
    assert bad == []


def test_no_deprecated_calls():
    bad = [f"{p.name}: {b}" for p in sources() for b in BANNED if b in p.read_text()]
    assert bad == []


def test_union_annotations_are_postponed():
    """3.9 cannot evaluate `X | None`, so a module that writes it must postpone annotations."""
    texts = {p.name: p.read_text() for p in sources()}
    bad = [n for n, t in texts.items() if "| None" in t and "from __future__ import annotations" not in t]
    assert bad == []
