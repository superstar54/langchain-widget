Widget Settings
==============

``LangChainWidget`` accepts the following initialization settings:

- ``chat_model``: Required. A LangChain chat model that supports tool calling (for example, ``ChatOpenAI``).
- ``tools``: Optional. An iterable of ``BaseTool`` instances or an object with a ``.tools`` attribute.
- ``system_prompt``: Optional. A system prompt string to steer the agent.
- ``max_steps``: Optional. Maximum number of tool-calling steps per user message.
- ``title``: Optional. Title shown in the chat UI.
- ``history_path``: Optional. Filesystem path for storing chat history. When omitted, history stays in memory only.
- ``sidebar_open``: Optional. Whether the left sidebar menu is open on initial render.
