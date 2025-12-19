from __future__ import annotations

import asyncio
import datetime as _dt
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import anywidget
import traitlets

from langchain_core.tools import BaseTool

from .history import HistoryStore
from .runtime.langchain_runtime import LangChainToolCallingRuntime
from .tools import tool_manifest


def _now_iso() -> str:
    return _dt.datetime.now(tz=_dt.timezone.utc).isoformat()


class LangChainWidget(anywidget.AnyWidget):
    _esm = Path(__file__).parent / "static" / "widget.js"
    _css = Path(__file__).parent / "static" / "widget.css"

    title = traitlets.Unicode("Agent Chat").tag(sync=True)
    status = traitlets.Unicode("idle").tag(sync=True)
    settings = traitlets.Dict().tag(sync=True)
    messages = traitlets.List(traitlets.Dict()).tag(sync=True)
    tools = traitlets.List(traitlets.Dict()).tag(sync=True)
    context_items = traitlets.List(traitlets.Dict()).tag(sync=True)
    history_index = traitlets.List(traitlets.Dict()).tag(sync=True)
    sidebar_open = traitlets.Bool(True).tag(sync=True)

    def _settings_default(self) -> Dict[str, Any]:
        return {"system_prompt": "", "max_steps": 8}

    def _messages_default(self) -> List[Dict[str, Any]]:
        return []

    def _tools_default(self) -> List[Dict[str, Any]]:
        return []

    def _context_items_default(self) -> List[Dict[str, Any]]:
        return []

    def _history_index_default(self) -> List[Dict[str, Any]]:
        return []

    def __init__(
        self,
        *,
        chat_model: Any,
        tools: Any = None,
        system_prompt: str = "",
        max_steps: int = 8,
        title: str = "Agent Chat",
        history_path: Optional[str] = None,
        sidebar_open: bool = True,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._chat_model = chat_model
        self.title = title
        self.sidebar_open = sidebar_open
        if tools is None:
            tools_list: List[BaseTool] = []
        elif hasattr(tools, "tools"):
            tools_list = list(getattr(tools, "tools"))
        else:
            tools_list = list(tools)

        self._registered_tools = tools_list
        self.settings = {"system_prompt": system_prompt, "max_steps": max_steps}
        self.tools = [tool_manifest(t) for t in self._registered_tools]

        self._history = HistoryStore(Path(history_path) if history_path else None)
        self._refresh_history_index()
        self._active_conversation_id: Optional[str] = None
        self._history_dirty: bool = False

        self._task: Optional[asyncio.Task[None]] = None
        self.on_msg(self._on_frontend_msg)

    def _refresh_history_index(self) -> None:
        self.history_index = [h.to_dict() for h in self._history.list(limit=50)]

    def add_context(self, *, title: str, content: str, id: Optional[str] = None) -> str:
        context_id = id or str(uuid.uuid4())
        items = list(self.context_items)
        items.append({"id": context_id, "title": title, "content": content})
        self.context_items = items
        return context_id

    def upsert_context(self, *, id: str, title: str, content: str) -> str:
        items = list(self.context_items)
        for i, item in enumerate(items):
            if item.get("id") == id:
                items[i] = {"id": id, "title": title, "content": content}
                self.context_items = items
                return id
        items.append({"id": id, "title": title, "content": content})
        self.context_items = items
        return id

    def remove_context(self, id: str) -> None:
        self.context_items = [c for c in self.context_items if c.get("id") != id]

    def clear_context(self) -> None:
        self.context_items = []

    def register_tool(self, tool: BaseTool) -> None:
        self._registered_tools.append(tool)
        self.tools = [tool_manifest(t) for t in self._registered_tools]

    def clear(self) -> None:
        self.messages = []
        self._active_conversation_id = None
        self._history_dirty = False

    def _append_message(self, message: Dict[str, Any]) -> None:
        msgs = list(self.messages)
        msgs.append(message)
        self.messages = msgs
        self._history_dirty = True

    def _on_frontend_msg(
        self, _widget: Any, content: Dict[str, Any], _buffers: Any
    ) -> None:
        msg_type = content.get("type")
        if msg_type == "history_refresh":
            self._refresh_history_index()
            return
        if msg_type == "history_clear":
            self._history.clear()
            self._refresh_history_index()
            return
        if msg_type == "history_delete":
            convo_id = str(content.get("id") or "")
            if convo_id:
                self._history.delete(id=convo_id)
            self._refresh_history_index()
            return
        if msg_type == "history_load":
            convo_id = str(content.get("id") or "")
            if not convo_id:
                return
            self.messages = self._history.load_messages(id=convo_id)
            self._active_conversation_id = convo_id
            self._history_dirty = False
            self.send({"type": "scroll_to_bottom"})
            return
        if msg_type == "history_save":
            self._save_current_conversation(convo_id=self._active_conversation_id)
            self._history_dirty = False
            self._refresh_history_index()
            return
        if msg_type == "history_new_chat":
            if self._history_dirty:
                self._save_current_conversation(convo_id=self._active_conversation_id)
            self.clear()
            self._refresh_history_index()
            return

        if msg_type == "reset":
            self.clear()
            return
        if msg_type == "cancel":
            if self._task and not self._task.done():
                self._task.cancel()
            self.status = "idle"
            return
        if msg_type != "user_message":
            return

        text = (content.get("content") or "").strip()
        if not text:
            return

        self._append_message(
            {
                "id": str(uuid.uuid4()),
                "role": "user",
                "content": text,
                "created_at": _now_iso(),
            }
        )
        self._start_run()

    def _save_current_conversation(self, convo_id: Any = None) -> None:
        messages = list(self.messages)
        if not messages:
            return
        convo_id = str(convo_id or self._active_conversation_id or uuid.uuid4())
        updated_at = _now_iso()
        created_at = updated_at
        first_user = next((m for m in messages if m.get("role") == "user"), None)
        title = (
            first_user.get("content") if isinstance(first_user, dict) else None
        ) or "Conversation"
        title = str(title).strip().replace("\n", " ")[:80] or "Conversation"
        self._history.upsert(
            id=convo_id,
            title=title,
            created_at=created_at,
            updated_at=updated_at,
            messages=messages,
        )
        self._active_conversation_id = convo_id

    def _start_run(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        self._task = loop.create_task(self._run_agent())

    async def _emit(self, event: Dict[str, Any]) -> None:
        self.send(event)

    async def _run_agent(self) -> None:
        try:
            max_steps = int((self.settings or {}).get("max_steps", 8))
            runtime = LangChainToolCallingRuntime(
                chat_model=self._chat_model,
                tools=self._registered_tools,
                system_prompt=(self.settings or {}).get("system_prompt", ""),
                max_steps=max_steps,
            )

            async def on_event(event: Dict[str, Any]) -> None:
                et = event.get("type")
                if et == "status":
                    self.status = event.get("status", "idle")
                    return

                if et == "assistant_message":
                    tool_calls = event.get("tool_calls") or []
                    content = event.get("content") or ""
                    self._append_message(
                        {
                            "id": str(uuid.uuid4()),
                            "role": "assistant",
                            "content": content,
                            "tool_calls": tool_calls,
                            "created_at": _now_iso(),
                        }
                    )
                    await self._emit({"type": "scroll_to_bottom"})
                    return

                if et == "tool_start":
                    await self._emit(event)
                    return

                if et == "tool_end":
                    self._append_message(
                        {
                            "id": str(uuid.uuid4()),
                            "role": "tool",
                            "name": event.get("name") or "",
                            "tool_call_id": event.get("tool_call_id") or "",
                            "content": event.get("content") or "",
                            "created_at": _now_iso(),
                        }
                    )
                    await self._emit({"type": "scroll_to_bottom"})
                    return

                if et == "error":
                    self._append_message(
                        {
                            "id": str(uuid.uuid4()),
                            "role": "assistant",
                            "content": f"Error: {event.get('message','Unknown error')}",
                            "created_at": _now_iso(),
                        }
                    )
                    await self._emit({"type": "scroll_to_bottom"})
                    return

            await runtime.run(
                messages=list(self.messages),
                context_items=list(self.context_items),
                settings=dict(self.settings or {}),
                on_event=on_event,
            )
        except asyncio.CancelledError:
            await self._emit({"type": "status", "status": "idle"})
            raise
        except Exception as e:
            self.status = "idle"
            self._append_message(
                {
                    "id": str(uuid.uuid4()),
                    "role": "assistant",
                    "content": f"Error: {type(e).__name__}: {e}",
                    "created_at": _now_iso(),
                }
            )
            await self._emit({"type": "scroll_to_bottom"})
