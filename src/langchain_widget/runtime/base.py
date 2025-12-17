from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Protocol


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    args: Dict[str, Any]


class AgentRuntime(Protocol):
    async def run(
        self,
        *,
        messages: List[Dict[str, Any]],
        context_items: List[Dict[str, Any]],
        settings: Dict[str, Any],
        on_event: Any,
    ) -> None:
        ...
