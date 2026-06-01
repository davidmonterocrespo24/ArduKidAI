"""Real agent built on Google ADK (part of Vertex AI Agent Builder).

Replaces the hand-rolled google-genai function-calling loop. ADK runs as a
library inside our FastAPI app: an `LlmAgent` (Gemini 3 on Vertex) plus a
`Runner` that drives the multi-step tool loop internally. We translate ADK's
event stream into the SSE event contract the frontend already speaks
(`tool_call`, `tool_result`, `agent_text`).

Phase 5 keeps the canvas tools executing **server-side** here (parity with v1):
each ADK tool wrapper delegates to the existing `dispatch(name, session, args)`,
which mutates the per-request `SessionState`. The frontend mirrors the streamed
`tool_call`/`tool_result` events onto the canvas, exactly as before. True
browser-side execution (LongRunningFunctionTool + client post-back) is phase 10.

Each tool resolves its `SessionState` by id from `ToolContext` (the ADK session
id equals our browser session id), so one long-lived agent/runner serves many
concurrent sessions safely without context-variable juggling.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from typing import Any

from google.adk.tools.tool_context import ToolContext

from ..config import get_settings
from .runner import SSEEvent
from .session import SessionState, get_or_create_session
from .system_prompt import SYSTEM_PROMPT
from .tools import dispatch


async def _run(tool: str, tool_context: ToolContext, **kwargs: Any) -> dict[str, Any]:
    """Delegate an ADK tool call to the existing handler with the live session."""
    session = get_or_create_session(tool_context.session.id)
    return await dispatch(tool, session, kwargs)


# --- Tool wrappers. ADK builds each function declaration from the signature and
# docstring below (tool_context is injected, not shown to the model), so these
# mirror the schemas in tools.py. Keep them in sync. ---


async def list_available_components(tool_context: ToolContext) -> dict[str, Any]:
    """Return the catalog of components you may place on the canvas."""
    return await _run("list_available_components", tool_context)


async def add_component(
    type: str,
    x: float = 0.0,
    y: float = 0.0,
    props: dict[str, Any] | None = None,
    *,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Drop a component on the canvas. The backend assigns the id.

    Args:
        type: component type from the catalog (one of: uno, led, resistor,
            pushbutton, buzzer, servo, potentiometer, lcd1602, seg7).
        x: optional x position on the canvas.
        y: optional y position on the canvas.
        props: optional component-specific properties, e.g. {"color": "red"}.
    """
    return await _run("add_component", tool_context, type=type, x=x, y=y, props=props)


async def remove_component(id: str, *, tool_context: ToolContext) -> dict[str, Any]:
    """Remove a component by id. Wires connected to it are removed too.

    Args:
        id: the component id, e.g. "L1".
    """
    return await _run("remove_component", tool_context, id=id)


async def wire(from_pin: str, to_pin: str, *, tool_context: ToolContext) -> dict[str, Any]:
    """Connect two pins. Use `componentId.pinName`, e.g. `L1.anode` to `UNO.13`.

    Args:
        from_pin: source pin reference, e.g. "L1.anode".
        to_pin: destination pin reference, e.g. "UNO.13".
    """
    return await _run("wire", tool_context, from_pin=from_pin, to_pin=to_pin)


async def set_blocks(blockly_xml: str, *, tool_context: ToolContext) -> dict[str, Any]:
    """Replace the program in the Blockly editor with the given XML.

    Args:
        blockly_xml: the full Blockly workspace XML.
    """
    return await _run("set_blocks", tool_context, blockly_xml=blockly_xml)


async def compile_and_run(tool_context: ToolContext) -> dict[str, Any]:
    """Compile the current program to HEX and load it into the avr8js simulator."""
    return await _run("compile_and_run", tool_context)


async def save_project(name: str, *, tool_context: ToolContext) -> dict[str, Any]:
    """Persist the current circuit and program under the given name.

    Args:
        name: a short project name (1-80 characters).
    """
    return await _run("save_project", tool_context, name=name)


async def find_similar_example(
    query: str, limit: int = 3, *, tool_context: ToolContext
) -> dict[str, Any]:
    """Semantic search over the seeded example circuits (MongoDB Atlas Vector
    Search). Use it for inspiration or a reference for an unfamiliar project.

    Args:
        query: natural-language description of what the kid wants.
        limit: how many examples to return (1-10).
    """
    return await _run("find_similar_example", tool_context, query=query, limit=limit)


async def list_saved_projects(tool_context: ToolContext) -> dict[str, Any]:
    """List the projects the kid has saved before (backed by MongoDB)."""
    return await _run("list_saved_projects", tool_context)


async def load_project(project_id: str, *, tool_context: ToolContext) -> dict[str, Any]:
    """Recall a saved project by id and load its circuit into the session.

    Args:
        project_id: the id of a previously saved project.
    """
    return await _run("load_project", tool_context, project_id=project_id)


async def search_docs(query: str, limit: int = 4, *, tool_context: ToolContext) -> dict[str, Any]:
    """Retrieval-augmented search over indexed docs (Arduino references,
    tutorials). Cite the source name and page in your reply.

    Args:
        query: the technical question to look up.
        limit: how many chunks to return (1-8).
    """
    return await _run("search_docs", tool_context, query=query, limit=limit)


_TOOLS = [
    list_available_components,
    add_component,
    remove_component,
    wire,
    set_blocks,
    compile_and_run,
    save_project,
    find_similar_example,
    list_saved_projects,
    load_project,
    search_docs,
]


class AdkAgentClient:
    """Long-lived ADK agent + runner. One instance serves all sessions; each tool
    resolves its own circuit by session id from the ToolContext."""

    _APP = "ardukid"

    def __init__(self) -> None:
        from google.adk.agents import LlmAgent
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService

        settings = get_settings()
        if not settings.google_cloud_project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required when ARDUKID_AGENT_MODE=real.")

        # Point ADK/google-genai at Vertex. The chat model lives on the "global"
        # endpoint; embeddings keep their own explicit regional client.
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE"
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.google_cloud_project
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.ardukid_gemini_location

        self._agent = LlmAgent(
            model=settings.ardukid_gemini_model,
            name="ardukid_agent",
            instruction=SYSTEM_PROMPT,
            tools=_TOOLS,
        )
        self._session_service = InMemorySessionService()
        self._runner = Runner(
            app_name=self._APP,
            agent=self._agent,
            session_service=self._session_service,
        )
        self._known: set[str] = set()

    async def _ensure_adk_session(self, session_id: str) -> None:
        if session_id in self._known:
            return
        existing = await self._session_service.get_session(
            app_name=self._APP, user_id=session_id, session_id=session_id
        )
        if existing is None:
            await self._session_service.create_session(
                app_name=self._APP, user_id=session_id, session_id=session_id
            )
        self._known.add(session_id)

    async def chat(
        self, *, session: SessionState, user_message: str
    ) -> AsyncIterator[SSEEvent]:
        from google.genai import types

        await self._ensure_adk_session(session.session_id)
        message = types.Content(role="user", parts=[types.Part(text=user_message)])
        async for event in self._runner.run_async(
            user_id=session.session_id,
            session_id=session.session_id,
            new_message=message,
        ):
            for call in event.get_function_calls():
                yield SSEEvent(
                    type="tool_call",
                    data={"name": call.name, "args": dict(call.args or {})},
                )
            for response in event.get_function_responses():
                yield SSEEvent(
                    type="tool_result",
                    data={"name": response.name, "result": response.response},
                )
            if event.content and event.content.parts:
                text_parts = [p.text for p in event.content.parts if p.text]
                if text_parts:
                    yield SSEEvent(type="agent_text", data={"content": "".join(text_parts)})


_singleton: AdkAgentClient | None = None


def get_adk_client() -> AdkAgentClient:
    """Lazily build and reuse one ADK client so conversation history persists."""
    global _singleton
    if _singleton is None:
        _singleton = AdkAgentClient()
    return _singleton
