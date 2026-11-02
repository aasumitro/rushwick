"""Live telemetry, publish/subscribe: each subscriber gets the newest sample of its topics, never a queue."""

from __future__ import annotations

import asyncio
import json
from typing import Any


class TelemetryHub:
    def __init__(self) -> None:
        self.latest: dict[str, Any] = {}
        self.subscribers: dict[Any, set[str]] = {}
        self._fresh: set[str] = set()

    def publish(self, topic: str, data: Any) -> None:
        self.latest[topic] = data
        self._fresh.add(topic)

    def subscribe(self, client: Any, topics: set[str]) -> None:
        self.subscribers[client] = set(topics)

    def unsubscribe(self, client: Any) -> None:
        self.subscribers.pop(client, None)

    def pending(self) -> dict[Any, dict[str, Any]]:
        """For every subscriber, the topics published since the last call and their newest data."""
        fresh, self._fresh = self._fresh, set()
        return {c: {t: self.latest[t] for t in topics & fresh} for c, topics in self.subscribers.items()}

    async def pump(self, period: float = 0.1, send_timeout: float = 0.05) -> None:
        """Send the newest samples every `period`; a slow client skips a sample instead of stalling the others."""
        while True:
            for client, items in self.pending().items():
                for topic, data in items.items():
                    try:
                        await asyncio.wait_for(client.send(json.dumps({"type": "telemetry", "topic": topic, "data": data})), send_timeout)
                    except Exception:  # timeout or closed connection: this sample is simply skipped
                        pass
            await asyncio.sleep(period)
