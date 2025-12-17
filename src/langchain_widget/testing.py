from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, List, Optional

from langchain_core.messages import AIMessage


@dataclass(frozen=True)
class ToolCallSpec:
    id: str
    name: str
    args: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "args": dict(self.args)}


def tool_call(*, id: str, name: str, args: dict[str, Any]) -> dict[str, Any]:
    return ToolCallSpec(id=id, name=name, args=args).to_dict()


class TestChatModel:
    """
    Minimal async chat model for tests/examples (no API keys, no network).

    This is intentionally tiny: it only implements the subset used by
    `LangChainToolCallingRuntime` (`bind_tools` + `ainvoke` returning `AIMessage`).
    """

    def __init__(self, script: Iterable[AIMessage]) -> None:
        self._script: List[AIMessage] = list(script)
        self._index = 0
        self._tools: Optional[Any] = None

    def bind_tools(self, tools: Any) -> "TestChatModel":
        self._tools = tools
        return self

    async def ainvoke(self, _messages: Any) -> AIMessage:
        if not self._script:
            return AIMessage(content="")

        if self._index >= len(self._script):
            return self._script[-1]

        msg = self._script[self._index]
        self._index += 1
        return msg
