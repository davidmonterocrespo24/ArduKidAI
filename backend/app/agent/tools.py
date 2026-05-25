"""The agent's tool catalog.

Two groups of tools are exposed to Gemini via FunctionDeclarations:

1. **Canvas / sketch tools** (the "seven" from the original spec):
   list_available_components, add_component, remove_component, wire,
   set_blocks, compile_and_run, save_project.
2. **MongoDB-MCP-shaped tools** that the agent uses to ground its plan in
   pre-seeded inspiration and recall the kid's own saved work:
   find_similar_example, list_saved_projects, load_project.

The MongoDB-MCP-shaped tools have the same call contract as the operations
the official MongoDB MCP server exposes (find / vectorSearch / insert). When
`MCP_ENABLED=true` they route through `mcp_client` (sidecar process); off,
they call our local Motor service layer directly, which talks to the same
Atlas database. Either way the tool surface the agent sees is identical."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from ..schemas import ComponentInstance, Wire
from ..services import catalog, projects_store
from ..services.compiler import compile_cpp
from ..services.examples import search_similar
from ..services.knowledge import search_docs
from .session import SessionState

ToolHandler = Callable[..., Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters_schema: dict[str, Any]
    handler: ToolHandler


# ---------- canvas / sketch tool handlers ----------


async def list_available_components_handler(session: SessionState) -> dict[str, Any]:
    _ = session
    components = await catalog.list_components()
    return {"ok": True, "components": components}


async def add_component_handler(
    session: SessionState,
    type: str,
    x: float = 0.0,
    y: float = 0.0,
    props: dict[str, Any] | None = None,
) -> dict[str, Any]:
    component = await catalog.get_component(type)
    if component is None:
        return {"ok": False, "error": f"unknown component type: {type}"}
    cid = session.next_component_id(type)
    merged_props = {**component.get("default_props", {}), **(props or {})}
    instance = ComponentInstance(id=cid, type=type, x=x, y=y, props=merged_props)
    session.components[cid] = instance
    return {"ok": True, "component": instance.model_dump()}


async def remove_component_handler(session: SessionState, id: str) -> dict[str, Any]:
    if id not in session.components:
        return {"ok": False, "error": f"no component with id {id}"}
    del session.components[id]
    session.wires = [
        w for w in session.wires
        if not (w.from_pin.startswith(f"{id}.") or w.to_pin.startswith(f"{id}."))
    ]
    return {"ok": True, "removed_id": id}


async def wire_handler(session: SessionState, from_pin: str, to_pin: str) -> dict[str, Any]:
    def _validate(pin: str) -> str | None:
        if "." not in pin:
            return f"pin reference must be `componentId.pinName`, got {pin}"
        component_id = pin.split(".", 1)[0]
        if component_id not in session.components and component_id != "UNO":
            return f"unknown component id {component_id}"
        return None

    for pin in (from_pin, to_pin):
        err = _validate(pin)
        if err:
            return {"ok": False, "error": err}
    wire = Wire(from_pin=from_pin, to_pin=to_pin)
    session.wires.append(wire)
    return {"ok": True, "wire": wire.model_dump()}


async def set_blocks_handler(session: SessionState, blockly_xml: str) -> dict[str, Any]:
    session.blockly_xml = blockly_xml
    return {"ok": True, "length": len(blockly_xml)}


async def compile_and_run_handler(session: SessionState) -> dict[str, Any]:
    if not session.cpp_code.strip():
        return {
            "ok": False,
            "error": "no C++ source on the session yet. The frontend should send `circuit_state.cpp_code` along with the chat request.",
        }
    result = await compile_cpp(session.cpp_code)
    return {
        "ok": result.ok,
        "hex": result.hex_text,
        "stderr": result.stderr,
        "error": result.error,
    }


async def save_project_handler(session: SessionState, name: str) -> dict[str, Any]:
    circuit = session.to_circuit()
    detail = await projects_store.save(name=name, circuit=circuit)
    return {"ok": True, "project": detail.model_dump()}


# ---------- MongoDB-MCP-shaped tool handlers ----------


async def find_similar_example_handler(
    session: SessionState,
    query: str,
    limit: int = 3,
) -> dict[str, Any]:
    _ = session
    hits = await search_similar(query, limit)
    return {
        "ok": True,
        "query": query,
        "hits": [h.model_dump() for h in hits],
    }


async def list_saved_projects_handler(session: SessionState) -> dict[str, Any]:
    _ = session
    projects = await projects_store.list_all()
    return {"ok": True, "projects": [p.model_dump() for p in projects]}


async def load_project_handler(session: SessionState, project_id: str) -> dict[str, Any]:
    project = await projects_store.get(project_id)
    if project is None:
        return {"ok": False, "error": f"no saved project with id {project_id}"}
    session.replace_circuit(project.circuit)
    return {"ok": True, "project": project.model_dump()}


async def search_docs_handler(
    session: SessionState,
    query: str,
    limit: int = 4,
) -> dict[str, Any]:
    _ = session
    hits = await search_docs(query, limit)
    return {
        "ok": True,
        "query": query,
        "hits": [
            {
                "id": h.id,
                "source": h.source,
                "page": h.page,
                "text": h.text,
                "score": h.score,
            }
            for h in hits
        ],
    }


# ---------- declarations ----------


TOOLS: dict[str, ToolSpec] = {
    "list_available_components": ToolSpec(
        name="list_available_components",
        description="Return the catalog of components the agent is allowed to drop on the canvas.",
        parameters_schema={"type": "object", "properties": {}},
        handler=list_available_components_handler,
    ),
    "add_component": ToolSpec(
        name="add_component",
        description="Drop a component on the canvas. The backend assigns the id.",
        parameters_schema={
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Component type from the catalog.",
                    "enum": catalog.CATALOG_TYPES,
                },
                "x": {"type": "number", "default": 0},
                "y": {"type": "number", "default": 0},
                "props": {
                    "type": "object",
                    "description": "Optional component-specific properties (e.g. {\"color\":\"red\"}).",
                },
            },
            "required": ["type"],
        },
        handler=add_component_handler,
    ),
    "remove_component": ToolSpec(
        name="remove_component",
        description="Remove a component by id. Wires connected to it are removed too.",
        parameters_schema={
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
        handler=remove_component_handler,
    ),
    "wire": ToolSpec(
        name="wire",
        description="Connect two pins. Use `componentId.pinName`, e.g. `L1.anode` to `UNO.D7`.",
        parameters_schema={
            "type": "object",
            "properties": {
                "from_pin": {"type": "string"},
                "to_pin": {"type": "string"},
            },
            "required": ["from_pin", "to_pin"],
        },
        handler=wire_handler,
    ),
    "set_blocks": ToolSpec(
        name="set_blocks",
        description="Replace the program in the Blockly editor with the given XML.",
        parameters_schema={
            "type": "object",
            "properties": {"blockly_xml": {"type": "string"}},
            "required": ["blockly_xml"],
        },
        handler=set_blocks_handler,
    ),
    "compile_and_run": ToolSpec(
        name="compile_and_run",
        description="Compile the current C++ to HEX and ask the frontend to load it into the avr8js simulator.",
        parameters_schema={"type": "object", "properties": {}},
        handler=compile_and_run_handler,
    ),
    "save_project": ToolSpec(
        name="save_project",
        description="Persist the current circuit and program under the given name.",
        parameters_schema={
            "type": "object",
            "properties": {"name": {"type": "string", "minLength": 1, "maxLength": 80}},
            "required": ["name"],
        },
        handler=save_project_handler,
    ),
    "find_similar_example": ToolSpec(
        name="find_similar_example",
        description=(
            "Semantic search over the seeded example circuits. Use this when the kid asks "
            "for inspiration ('find me something with a motor') or when you need a "
            "reference for an unfamiliar project. Backed by MongoDB Atlas Vector Search "
            "through the MongoDB MCP server."
        ),
        parameters_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural-language description of what the kid wants."},
                "limit": {"type": "integer", "minimum": 1, "maximum": 10, "default": 3},
            },
            "required": ["query"],
        },
        handler=find_similar_example_handler,
    ),
    "list_saved_projects": ToolSpec(
        name="list_saved_projects",
        description="List the projects the kid has saved before. Backed by MongoDB through the MCP server.",
        parameters_schema={"type": "object", "properties": {}},
        handler=list_saved_projects_handler,
    ),
    "load_project": ToolSpec(
        name="load_project",
        description="Recall a previously saved project by id and load its circuit and program into the session.",
        parameters_schema={
            "type": "object",
            "properties": {"project_id": {"type": "string"}},
            "required": ["project_id"],
        },
        handler=load_project_handler,
    ),
    "search_docs": ToolSpec(
        name="search_docs",
        description=(
            "Retrieval-augmented search over indexed PDFs (Arduino references, "
            "tutorials, datasheets). Use this when the kid asks a technical "
            "question whose answer is documented but not in your common knowledge. "
            "Returns chunks with the source name and page number; quote them "
            "verbatim and cite the source briefly. Backed by MongoDB Atlas Vector "
            "Search on the knowledge_chunks collection."
        ),
        parameters_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 8, "default": 4},
            },
            "required": ["query"],
        },
        handler=search_docs_handler,
    ),
}


async def dispatch(name: str, session: SessionState, args: dict[str, Any]) -> dict[str, Any]:
    """Run a tool by name. Used by both the real Gemini runner and the mock."""

    spec = TOOLS.get(name)
    if spec is None:
        return {"ok": False, "error": f"unknown tool: {name}"}
    try:
        return await spec.handler(session, **(args or {}))
    except TypeError as exc:
        return {"ok": False, "error": f"bad args for {name}: {exc}"}
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
