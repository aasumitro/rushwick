"""SimHardware's inbox: a read times out with None and never swallows a later message."""

from __future__ import annotations

import asyncio

from rushwick_autonomy.hardware import SimHardware


def test_read_frame_times_out_without_losing_messages():
    async def scenario():
        hw = SimHardware("127.0.0.1", 0)
        assert await hw.read_frame(0.01) is None
        # The getter of the timed-out read is cancelled, so it cannot take this message.
        hw._inbox.put_nowait({"type": "frame", "seq": 1})
        assert await hw.read_frame(0.01) == {"type": "frame", "seq": 1}
        hw._inbox.put_nowait({"type": "frame", "seq": 2})
        assert await hw.read_frame(None) == {"type": "frame", "seq": 2}

    asyncio.run(scenario())
