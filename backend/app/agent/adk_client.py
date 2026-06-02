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

from google.adk.agents.run_config import RunConfig
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
    type: str, props: dict[str, Any] | None = None, *, tool_context: ToolContext
) -> dict[str, Any]:
    """Drop ONE component on the canvas. The backend assigns the id and a
    non-overlapping position - do not pass coordinates. Prefer add_components when
    adding several parts at once.

    Args:
        type: component type from the catalog (led, resistor, pushbutton, buzzer,
            servo, potentiometer, lcd1602, ssd1306, seg7). ssd1306 is an I2C OLED
            graphics screen. The UNO is already on the canvas; do not add it.
        props: optional component-specific properties, e.g. {"color": "red"}.
    """
    return await _run("add_component", tool_context, type=type, props=props)


async def add_components(
    components: list[dict[str, Any]], *, tool_context: ToolContext
) -> dict[str, Any]:
    """Add SEVERAL components in one call (fewer steps than calling add_component
    repeatedly). The backend assigns ids and non-overlapping positions.

    Args:
        components: a list of items, each {"type": <component type>, "props": <optional dict>}.
    """
    return await _run("add_components", tool_context, components=components)


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


async def wire_many(
    wires: list[dict[str, str]], *, tool_context: ToolContext
) -> dict[str, Any]:
    """Create SEVERAL wires in one call (fewer steps than calling wire repeatedly).

    Args:
        wires: a list of items, each {"from_pin": "...", "to_pin": "..."} using
            `componentId.pinName` (e.g. {"from_pin": "UNO.D13", "to_pin": "R1.a"}).
    """
    return await _run("wire_many", tool_context, wires=wires)


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


async def validate_circuit(tool_context: ToolContext) -> dict[str, Any]:
    """Check the current circuit for problems (loose components, an LED without a
    resistor, a missing connection to ground, short circuits) and return a list of
    issues to fix. Call this after building or changing a circuit, then fix what it reports.
    """
    return await _run("validate_circuit", tool_context)


_TOOLS = [
    list_available_components,
    add_component,
    add_components,
    remove_component,
    wire,
    wire_many,
    set_blocks,
    compile_and_run,
    save_project,
    validate_circuit,
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

        from .mongo_memory_service import get_memory_service
        from .mongo_session_service import get_session_service

        settings = get_settings()
        if not settings.google_cloud_project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required when ARDUKID_AGENT_MODE=real.")

        # Point ADK/google-genai at Vertex. The chat model lives on the "global"
        # endpoint; embeddings keep their own explicit regional client.
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE"
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.google_cloud_project
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.ardukid_gemini_location

        # Filesystem skills (per-component know-how) loaded via ADK's SkillToolset,
        # so the agent dynamically activates the relevant skill for what it builds.
        tools: list[Any] = list(_TOOLS)
        try:
            from google.adk.tools.skill_toolset import SkillToolset

            from ..services.skills import load_adk_skills

            skills = load_adk_skills()
            if skills:
                tools.append(SkillToolset(skills=skills))
        except Exception:  # pragma: no cover - skills are best-effort
            pass

        # Google-native web tools (search, url reading, youtube). Best-effort:
        # if the ADK built-ins are unavailable the agent still works offline.
        try:
            from .web_tools import build_web_tools

            tools.extend(build_web_tools(settings.ardukid_gemini_model))
        except Exception:  # pragma: no cover - web tools are best-effort
            pass

        # Long-term memory: the load_memory tool lets the agent recall relevant
        # things from the child's earlier conversations (MongoMemoryService).
        try:
            from google.adk.tools.load_memory_tool import load_memory_tool

            tools.append(load_memory_tool)
        except Exception:  # pragma: no cover - memory tool is best-effort
            pass

        self._agent = LlmAgent(
            model=settings.ardukid_gemini_model,
            name="ardukid_agent",
            instruction=SYSTEM_PROMPT,
            tools=tools,
        )
        self._session_service = get_session_service()
        self._memory_service = get_memory_service()
        self._runner = Runner(
            app_name=self._APP,
            agent=self._agent,
            session_service=self._session_service,
            memory_service=self._memory_service,
        )
        self._known: set[str] = set()

    async def _ensure_adk_session(self, user_id: str, session_id: str) -> None:
        cache_key = f"{user_id}::{session_id}"
        if cache_key in self._known:
            return
        existing = await self._session_service.get_session(
            app_name=self._APP, user_id=user_id, session_id=session_id
        )
        if existing is None:
            await self._session_service.create_session(
                app_name=self._APP, user_id=user_id, session_id=session_id
            )
        self._known.add(cache_key)

    async def chat(
        self,
        *,
        session: SessionState,
        user_message: str,
        attachments: list[dict[str, Any]] | None = None,
        user_id: str = "guest",
    ) -> AsyncIterator[SSEEvent]:
        import base64

        from google.genai import types

        from ..boards import get_board

        await self._ensure_adk_session(user_id, session.session_id)
        board = get_board(session.board)
        board_note = (
            f"[Canvas board: {board.label}. Its id is {board.canvas_id}; wire parts to "
            f"{board.canvas_id}.<pin> (e.g. {board.canvas_id}.D13). Load the "
            f"arduino-{board.id} skill for its exact pin names before wiring.]"
        )
        parts: list[Any] = [types.Part(text=f"{board_note}\n\n{user_message}")]
        for att in attachments or []:
            data = att.get("data") or ""
            mime = att.get("mime_type") or "application/octet-stream"
            try:
                raw = base64.b64decode(data)
            except Exception:
                continue
            parts.append(types.Part.from_bytes(data=raw, mime_type=mime))
        message = types.Content(role="user", parts=parts)
        async for event in self._runner.run_async(
            user_id=user_id,
            session_id=session.session_id,
            new_message=message,
            run_config=RunConfig(max_llm_calls=200),
        ):
            for call in event.get_function_calls():
                yield SSEEvent(
                    type="tool_call",
                    data={"name": call.name, "args": dict(call.args or {})},
                )
            for response in event.get_function_responses():
                result = response.response
                # Built-in tools (e.g. load_memory) return pydantic objects that
                # are not JSON-serializable; coerce them so the SSE layer can
                # encode the event.
                if hasattr(result, "model_dump"):
                    result = result.model_dump(mode="json")
                yield SSEEvent(
                    type="tool_result",
                    data={"name": response.name, "result": result},
                )
            if event.content and event.content.parts:
                text_parts = [p.text for p in event.content.parts if p.text]
                if text_parts:
                    yield SSEEvent(type="agent_text", data={"content": "".join(text_parts)})

        # Memorialize the turn so future chats can recall it (best-effort).
        try:
            sess = await self._session_service.get_session(
                app_name=self._APP, user_id=user_id, session_id=session.session_id
            )
            if sess is not None:
                await self._memory_service.add_session_to_memory(sess)
        except Exception:  # pragma: no cover - memory write is best-effort
            pass


_singleton: AdkAgentClient | None = None


def get_adk_client() -> AdkAgentClient:
    """Lazily build and reuse one ADK client so conversation history persists."""
    global _singleton
    if _singleton is None:
        _singleton = AdkAgentClient()
    return _singleton
