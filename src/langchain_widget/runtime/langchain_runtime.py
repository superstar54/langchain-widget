from __future__ import annotations

import asyncio
import json
from typing import Any, Awaitable, Callable, Dict, List, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool

from .base import ToolCall


EventCallback = Callable[[Dict[str, Any]], Awaitable[None]]


def _json_dumps(value: Any) -> str:
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False, indent=2, default=str)
    except Exception:
        return str(value)


def _lc_messages_from_transcript(
    transcript: List[Dict[str, Any]], system_prompt: Optional[str]
) -> List[Any]:
    messages: List[Any] = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))

    pending_tool_call_ids: set[str] = set()
    for m in transcript:
        role = m.get("role")
        content = m.get("content", "") or ""
        if role == "user":
            pending_tool_call_ids.clear()
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            tool_calls = m.get("tool_calls") or []
            pending_tool_call_ids = {
                (tc.get("id") or "") for tc in tool_calls if isinstance(tc, dict)
            }
            messages.append(AIMessage(content=content, tool_calls=tool_calls))
        elif role == "tool":
            tool_call_id = m.get("tool_call_id") or ""
            if tool_call_id and tool_call_id not in pending_tool_call_ids:
                continue
            if tool_call_id:
                pending_tool_call_ids.discard(tool_call_id)
            messages.append(
                ToolMessage(
                    content=content,
                    tool_call_id=tool_call_id,
                )
            )

    return messages


class LangChainToolCallingRuntime:
    def __init__(
        self,
        *,
        chat_model: Any,
        tools: Optional[List[BaseTool]] = None,
        system_prompt: Optional[str] = None,
        max_steps: int = 8,
    ) -> None:
        self._chat_model = chat_model
        self._tools = tools or []
        self._system_prompt = system_prompt
        self._max_steps = max_steps

    def _bind_tools(self) -> Any:
        if not self._tools:
            return self._chat_model
        binder = getattr(self._chat_model, "bind_tools", None)
        if binder is None:
            raise TypeError(
                "chat_model does not support tool calling (missing bind_tools)."
            )
        return binder(self._tools)

    def _tool_map(self) -> Dict[str, BaseTool]:
        return {t.name: t for t in self._tools}

    async def _run_tool(self, tool: BaseTool, args: Dict[str, Any]) -> Any:
        ainvoke = getattr(tool, "ainvoke", None)
        if callable(ainvoke):
            return await tool.ainvoke(args)
        invoke = getattr(tool, "invoke", None)
        if callable(invoke):
            return await asyncio.to_thread(tool.invoke, args)
        arun = getattr(tool, "arun", None)
        if callable(arun):
            return await tool.arun(**args)
        run = getattr(tool, "run", None)
        if callable(run):
            return await asyncio.to_thread(tool.run, **args)
        raise TypeError(f"Tool {tool.name!r} is not invokable.")

    async def run(
        self,
        *,
        messages: List[Dict[str, Any]],
        context_items: List[Dict[str, Any]],
        settings: Dict[str, Any],
        on_event: EventCallback,
    ) -> None:
        system_prompt = (
            (settings.get("system_prompt") if isinstance(settings, dict) else None)
            or self._system_prompt
            or ""
        ).strip()

        if context_items:
            context_blob = "\n\n".join(
                f"[{c.get('title') or c.get('id') or 'context'}]\n{c.get('content','')}"
                for c in context_items
            )
            system_prompt = (system_prompt + "\n\n" + context_blob).strip()

        lc_messages = _lc_messages_from_transcript(messages, system_prompt or None)
        model = self._bind_tools()
        tool_map = self._tool_map()

        await on_event({"type": "status", "status": "thinking"})

        for step in range(self._max_steps):
            ai: AIMessage = await model.ainvoke(lc_messages)
            tool_calls = list(ai.tool_calls or [])

            await on_event(
                {
                    "type": "assistant_message",
                    "content": ai.content or "",
                    "tool_calls": tool_calls,
                }
            )

            lc_messages.append(ai)

            if not tool_calls:
                await on_event({"type": "status", "status": "idle"})
                return

            for tc in tool_calls:
                call = ToolCall(
                    id=tc.get("id") or "",
                    name=tc.get("name") or "",
                    args=tc.get("args") or {},
                )
                await on_event(
                    {
                        "type": "tool_start",
                        "tool_call_id": call.id,
                        "name": call.name,
                        "args": call.args,
                    }
                )

                tool = tool_map.get(call.name)
                if tool is None:
                    result = f"Unknown tool: {call.name}"
                else:
                    try:
                        result = await self._run_tool(tool, call.args)
                    except Exception as e:
                        result = f"Tool error: {type(e).__name__}: {e}"

                tool_content = _json_dumps(result)
                lc_messages.append(
                    ToolMessage(content=tool_content, tool_call_id=call.id)
                )
                await on_event(
                    {
                        "type": "tool_end",
                        "tool_call_id": call.id,
                        "name": call.name,
                        "content": tool_content,
                    }
                )

        await on_event(
            {
                "type": "error",
                "message": f"Max tool steps exceeded ({self._max_steps}).",
            }
        )
        await on_event({"type": "status", "status": "idle"})
