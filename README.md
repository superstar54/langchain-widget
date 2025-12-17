# LangChain Widget
[![PyPI version](https://badge.fury.io/py/langchain-widget.svg)](https://badge.fury.io/py/langchain-widget)
[![Unit test](https://github.com/superstar54/langchain-widget/actions/workflows/ci.yml/badge.svg)](https://github.com/superstar54/langchain-widget/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/superstar54/langchain-widget/branch/main/graph/badge.svg)](https://codecov.io/gh/superstar54/langchain-widget)
[![Docs status](https://readthedocs.org/projects/langchain-widget/badge)](http://langchain-widget.readthedocs.io/)

Run a `LangChain` agent in Jupyter notebooks.

An `anywidget` + React chat UI for LangChain tool-calling chat models, built for notebooks and designed to compose with other Jupyter widgets.


- Works in JupyterLab / Notebook (and VS Code notebooks)
- Tool calling out of the box (your tools, your model)
- Easy to embed alongside plots, tables, and domain widgets

## Installation

```sh
pip install langchain-widget
```

## Quick start

In a notebook, create a `LangChainWidget` with your chat model and tools:

```python
from langchain_widget import LangChainWidget
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

chat_model = ChatOpenAI(model="gpt-4o-mini")

@tool
def add(a: int, b: int) -> int:
    "Add two integers."
    return a + b

w = LangChainWidget(
    chat_model=chat_model,
    tools=[add],
    system_prompt="You are a helpful scientific assistant.",
)
w
```

Here is how it looks in a Jupyter notebook:

<img src="docs/source/_static/images/langchain-widget.png" width="100%"/>


## Documentation

Full documentation at: https://langchain-widget.readthedocs.io/


## Development

See `langchain-widget/docs/source/development.rst`.

## Contact

* Xing Wang  <xingwang1991@gmail.com>

## License

[MIT](http://opensource.org/licenses/MIT)
