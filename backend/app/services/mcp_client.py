"""Client for the official MongoDB MCP server - the partner-track integration.

When `MCP_ENABLED=true`, the data services route their MongoDB access through the
`mongodb-mcp-server` sidecar instead of calling Motor directly. The agent still
produces query vectors with Gemini; the MCP server runs the `$vectorSearch` via
its `aggregate` tool, so the partner's MCP server genuinely sits in the data path.

Design notes (verified against mongodb-mcp-server 1.x over streamable HTTP):
- tools: `aggregate` (database, collection, pipeline), `find` (… filter,
  projection, sort, limit), `insert-many` (… documents). There is no insert-one.
- query results come wrapped in `<untrusted-user-data-…>` tags (a prompt-injection
  guard); we strip them here to recover the JSON.
- sessions are opened per call (simple and robust for the demo). The streamable
  client logs a benign BrokenResourceError on teardown, which we silence.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from ..config import get_settings

# The streamable-http client logs a harmless BrokenResourceError while tearing
# the SSE stream down after a successful call. Keep it out of our logs.
logging.getLogger("mcp.client.streamable_http").setLevel(logging.CRITICAL)

_UNTRUSTED_RE = re.compile(
    r"<untrusted-user-data-[0-9a-fA-F-]+>(.*?)</untrusted-user-data-[0-9a-fA-F-]+>",
    re.DOTALL,
)


def mcp_enabled() -> bool:
    settings = get_settings()
    return settings.mcp_enabled and bool(settings.mcp_server_url)


def _endpoint() -> str:
    url = get_settings().mcp_server_url.rstrip("/")
    return url if url.endswith("/mcp") else f"{url}/mcp"


def _db() -> str:
    return get_settings().mongodb_db


async def _call(tool: str, arguments: dict[str, Any]):
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    async with (
        streamable_http_client(_endpoint()) as (read, write, _),
        ClientSession(read, write) as session,
    ):
        await session.initialize()
        return await session.call_tool(tool, arguments)


def _texts(result: Any) -> list[str]:
    out: list[str] = []
    for chunk in getattr(result, "content", None) or []:
        text = getattr(chunk, "text", None)
        if text:
            out.append(text)
    return out


def _extract_documents(result: Any) -> list[dict[str, Any]]:
    if getattr(result, "isError", False):
        raise RuntimeError(f"MCP tool returned an error: {_texts(result)}")
    # The server repeats the <untrusted-user-data-UUID> tag names inside its
    # warning preamble, so there are several matches; the real payload is the
    # one whose contents parse as a JSON array/object.
    for text in _texts(result):
        for payload in _UNTRUSTED_RE.findall(text) or [text]:
            payload = payload.strip()
            if not (payload.startswith("[") or payload.startswith("{")):
                continue
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return [data]
    return []


async def aggregate(collection: str, pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = await _call(
        "aggregate", {"database": _db(), "collection": collection, "pipeline": pipeline}
    )
    return _extract_documents(result)


async def find(
    collection: str,
    filter: dict[str, Any] | None = None,
    *,
    projection: dict[str, Any] | None = None,
    sort: dict[str, Any] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    args: dict[str, Any] = {"database": _db(), "collection": collection, "filter": filter or {}}
    if projection is not None:
        args["projection"] = projection
    if sort is not None:
        args["sort"] = sort
    if limit is not None:
        args["limit"] = limit
    return _extract_documents(await _call("find", args))


async def insert_one(collection: str, document: dict[str, Any]) -> None:
    result = await _call(
        "insert-many", {"database": _db(), "collection": collection, "documents": [document]}
    )
    if getattr(result, "isError", False):
        raise RuntimeError(f"MCP insert failed: {_texts(result)}")
