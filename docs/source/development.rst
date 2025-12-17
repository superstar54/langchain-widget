===========
Development
===========

This project is a Python package (``anywidget``) with a bundled React front-end.

Setup
=====

Using ``uv`` (recommended)
--------------------------

``uv`` automatically manages virtual environments and dependencies.

.. code-block:: console

   uv run jupyter lab example.ipynb

Using ``venv``
--------------

.. code-block:: console

   python -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   jupyter lab example.ipynb

Front-end development
=====================

After setting up Python, install the JavaScript dependencies:

.. code-block:: console

   npm install

In a separate terminal, start the dev build watcher:

.. code-block:: console

   npm run dev

Open ``example.ipynb`` in JupyterLab, VS Code, or your favorite editor. Changes in ``js/`` should be reflected in the notebook.

Tests
=====

.. code-block:: console

   pytest

Offline / no API key
====================

For unit tests and demos you can use the built-in scripted model (no network, no API keys):

.. code-block:: python

   from langchain_core.messages import AIMessage
   from langchain_widget import TestChatModel, tool_call

   chat_model = TestChatModel(
       [
           AIMessage(
               content="Calling add...",
               tool_calls=[tool_call(id="c1", name="add", args={"a": 2, "b": 3})],
           ),
           AIMessage(content="2 + 3 = 5."),
       ]
   )

To inject context from other widgets/apps:

.. code-block:: python

   w.add_context(title="Weas selection", content="Selected atoms: [0, 3, 7]")
