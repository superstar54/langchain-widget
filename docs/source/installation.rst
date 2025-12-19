============
Installation
============


The recommended method of installation is to use the Python package manager |pip|_:

.. code-block:: console

    $ pip install langchain-widget

This will install the latest stable version that was released to PyPI.

Optional extras are available for common providers:

.. code-block:: console

    $ pip install "langchain-widget[openai]"
    $ pip install "langchain-widget[anthropic]"

You can use any LangChain chat model; install the provider package you need and pass the model into ``LangChainWidget``.

To install the package from source, first clone the repository and then install using |pip|_:

.. code-block:: console

    $ git clone https://github.com/superstar54/langchain-widget
    $ pip install -e langchain-widget

The ``-e`` flag will install the package in editable mode, meaning that changes to the source code will be automatically picked up.



.. |pip| replace:: ``pip``
.. _pip: https://pip.pypa.io/en/stable/
