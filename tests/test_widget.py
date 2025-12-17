import asyncio

from langchain_core.messages import AIMessage
from langchain_core.tools import tool

from langchain_widget import LangChainWidget, TestChatModel, tool_call


@tool
def add(a: int, b: int) -> int:
    "Add two integers."
    return a + b


def test_widget_initialization(tmp_path):
    widget = LangChainWidget(
        chat_model=TestChatModel([AIMessage(content="hi")]),
        tools=[add],
        history_path=str(tmp_path / "history.sqlite"),
    )
    assert widget.title == "Agent Chat"
    assert widget.settings["max_steps"] == 8
    assert [t["name"] for t in widget.tools] == ["add"]


def test_context_crud(tmp_path):
    widget = LangChainWidget(
        chat_model=TestChatModel([AIMessage(content="hi")]),
        history_path=str(tmp_path / "history.sqlite"),
    )
    cid = widget.add_context(title="t", content="c", id="fixed")
    assert cid == "fixed"
    assert widget.context_items == [{"id": "fixed", "title": "t", "content": "c"}]

    widget.upsert_context(id="fixed", title="t2", content="c2")
    assert widget.context_items == [{"id": "fixed", "title": "t2", "content": "c2"}]

    widget.remove_context("fixed")
    assert widget.context_items == []

    widget.add_context(title="t", content="c")
    widget.clear_context()
    assert widget.context_items == []


def test_agent_run_tool_calling_appends_messages(tmp_path):
    model = TestChatModel(
        [
            AIMessage(
                content="I'll call the tool.",
                tool_calls=[tool_call(id="call_1", name="add", args={"a": 2, "b": 3})],
            ),
            AIMessage(content="Result is 5."),
        ]
    )
    widget = LangChainWidget(
        chat_model=model,
        tools=[add],
        history_path=str(tmp_path / "history.sqlite"),
    )

    emitted = []
    widget.send = lambda event: emitted.append(event)  # type: ignore[assignment]

    widget._append_message(
        {"id": "u1", "role": "user", "content": "2+3?", "created_at": "t"}
    )
    asyncio.run(widget._run_agent())

    roles = [m.get("role") for m in widget.messages]
    assert roles == ["user", "assistant", "tool", "assistant"]
    assert widget.messages[-1]["content"] == "Result is 5."
    assert any(e.get("type") == "tool_start" for e in emitted)
    assert widget.status == "idle"


def test_history_save_and_load(tmp_path):
    widget = LangChainWidget(
        chat_model=TestChatModel([AIMessage(content="hi")]),
        history_path=str(tmp_path / "history.sqlite"),
    )
    widget._append_message(
        {"id": "u1", "role": "user", "content": "hello", "created_at": "t"}
    )
    widget._append_message(
        {"id": "a1", "role": "assistant", "content": "hi", "created_at": "t"}
    )

    widget._on_frontend_msg(widget, {"type": "history_save"}, None)
    assert len(widget.history_index) == 1
    convo_id = widget.history_index[0]["id"]

    widget.clear()
    widget._on_frontend_msg(widget, {"type": "history_load", "id": convo_id}, None)
    assert [m["role"] for m in widget.messages] == ["user", "assistant"]
