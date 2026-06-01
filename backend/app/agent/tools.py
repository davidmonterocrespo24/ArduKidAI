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

import xml.etree.ElementTree as ET
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from ..schemas import ComponentInstance, Wire
from ..services import catalog, projects_store
from ..services.compiler import compile_cpp
from ..services.examples import search_similar
from ..services.knowledge import search_docs
from ..services.skills import VALID_BLOCK_TYPES, valid_pins_for
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
    if type == "uno":
        return {
            "ok": False,
            "error": "The Arduino UNO is already on the canvas with id 'UNO'. "
            "Do not add another one; just wire parts to UNO.",
        }
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


def _component_type(session: SessionState, component_id: str) -> str | None:
    if component_id == "UNO":
        return "uno"
    inst = session.components.get(component_id)
    return inst.type if inst else None


def _normalize_pin(component_id: str, pin_name: str) -> str:
    # A bare UNO digital pin ("13") renders but does not drive the simulator;
    # the sim's pin tracer needs the "D" prefix. Normalize so the part lights up.
    if component_id == "UNO" and pin_name.isdigit():
        return f"D{pin_name}"
    return pin_name


async def wire_handler(session: SessionState, from_pin: str, to_pin: str) -> dict[str, Any]:
    def _resolve(pin: str) -> tuple[str | None, str | None]:
        if "." not in pin:
            return None, f"pin must be `componentId.pinName`, got '{pin}'"
        component_id, pin_name = pin.split(".", 1)
        component_type = _component_type(session, component_id)
        if component_type is None:
            return None, (
                f"unknown component id '{component_id}'. The board is 'UNO'; "
                "add other parts with add_component before wiring them."
            )
        pin_name = _normalize_pin(component_id, pin_name)
        valid = valid_pins_for(component_type)
        if valid and pin_name not in valid:
            return None, (
                f"'{component_id}.{pin_name}' is not a real pin of {component_type}. "
                f"Valid {component_type} pins: {sorted(valid)}. "
                "Load the matching component skill for the correct pin names."
            )
        return f"{component_id}.{pin_name}", None

    resolved_from, err = _resolve(from_pin)
    if err:
        return {"ok": False, "error": err}
    resolved_to, err = _resolve(to_pin)
    if err:
        return {"ok": False, "error": err}
    wire = Wire(from_pin=resolved_from or from_pin, to_pin=resolved_to or to_pin)
    session.wires.append(wire)
    return {"ok": True, "wire": wire.model_dump()}


def _validate_blockly_xml(xml: str) -> str | None:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        return (
            f"blockly_xml is not well-formed XML ({exc}). "
            "Load the 'blockly-programming' skill for the exact format."
        )
    types: set[str] = set()
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1]  # strip namespace
        if tag in ("block", "shadow"):
            block_type = element.get("type")
            if block_type:
                types.add(block_type)
    unknown = sorted(types - VALID_BLOCK_TYPES)
    if unknown:
        return (
            f"unknown block types {unknown} would make the workspace render empty. "
            "Use only valid block types; load the 'blockly-programming' skill for the list."
        )
    if "ardukid_setup" not in types or "ardukid_loop" not in types:
        return (
            "the program must include an 'ardukid_setup' and an 'ardukid_loop' top block. "
            "Load the 'blockly-programming' skill for a complete example."
        )
    return None


async def set_blocks_handler(session: SessionState, blockly_xml: str) -> dict[str, Any]:
    error = _validate_blockly_xml(blockly_xml)
    if error:
        return {"ok": False, "error": error}
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


def _endpoint_parts(pin_ref: str) -> tuple[str, str]:
    cid, _, pname = pin_ref.partition(".")
    return cid, pname


def _is_gnd(pin_ref: str) -> bool:
    return pin_ref == "UNO.GND" or pin_ref.startswith("UNO.GND")


async def validate_circuit_handler(session: SessionState) -> dict[str, Any]:
    """Inspect the current circuit and report problems the agent should fix."""
    issues: list[str] = []
    components = session.components
    wires = session.wires

    def other_end(w: Wire, pin_ref: str) -> str:
        return w.to_pin if w.from_pin == pin_ref else w.from_pin

    # Loose components: nothing wired to them.
    for cid, inst in components.items():
        touching = [
            w
            for w in wires
            if _endpoint_parts(w.from_pin)[0] == cid or _endpoint_parts(w.to_pin)[0] == cid
        ]
        if not touching:
            issues.append(f"{inst.type} '{cid}' is not connected to anything.")

    # LED checks: anode through a resistor, cathode to ground.
    for cid, inst in components.items():
        if inst.type != "led":
            continue
        anode, cathode = f"{cid}.anode", f"{cid}.cathode"
        anode_wires = [w for w in wires if anode in (w.from_pin, w.to_pin)]
        if not anode_wires:
            issues.append(f"LED '{cid}' anode is not connected; it needs a resistor to a digital pin.")
        else:
            through_resistor = False
            for w in anode_wires:
                other_id = _endpoint_parts(other_end(w, anode))[0]
                if other_id in components and components[other_id].type == "resistor":
                    through_resistor = True
            if not through_resistor:
                issues.append(f"LED '{cid}' anode should connect to a resistor, or it will not light.")
        cathode_to_gnd = any(
            _is_gnd(other_end(w, cathode))
            for w in wires
            if cathode in (w.from_pin, w.to_pin)
        )
        if not cathode_to_gnd:
            issues.append(f"LED '{cid}' cathode is not connected to UNO.GND.")

    # Short circuits.
    for w in wires:
        pair = {w.from_pin, w.to_pin}
        if any(p.startswith("UNO.5V") for p in pair) and any(_is_gnd(p) for p in pair):
            issues.append("Short circuit: UNO.5V is wired directly to UNO.GND.")
        digital = [
            p
            for p in pair
            if _endpoint_parts(p)[0] == "UNO"
            and (_endpoint_parts(p)[1].startswith("D") or _endpoint_parts(p)[1].isdigit())
        ]
        if digital and any(_is_gnd(p) for p in pair):
            issues.append(
                f"Short circuit: digital pin {digital[0]} is wired straight to UNO.GND "
                "with no component between them."
            )

    issues = list(dict.fromkeys(issues))  # de-duplicate, keep order
    return {"ok": True, "is_valid": len(issues) == 0, "issues": issues}


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
    "validate_circuit": ToolSpec(
        name="validate_circuit",
        description=(
            "Check the current circuit for problems: loose components, an LED without a "
            "resistor, a missing connection to ground, or short circuits. Returns a list of "
            "issues. Call this after building or changing a circuit and fix anything it reports "
            "before telling the child it is ready."
        ),
        parameters_schema={"type": "object", "properties": {}},
        handler=validate_circuit_handler,
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
