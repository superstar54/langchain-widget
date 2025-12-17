from __future__ import annotations

from typing import Any, Dict, Optional

from langchain_core.tools import BaseTool


def tool_manifest(tool: BaseTool) -> Dict[str, Any]:
    schema: Optional[Dict[str, Any]] = None
    args_schema = getattr(tool, "args_schema", None)
    if args_schema is not None:
        try:
            schema = args_schema.model_json_schema()  # pydantic v2
        except Exception:
            try:
                schema = args_schema.schema()  # pydantic v1
            except Exception:
                schema = None

    return {
        "name": tool.name,
        "description": getattr(tool, "description", "") or "",
        "schema": schema,
    }
