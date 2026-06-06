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

from ..boards import board_ids, get_board
from ..schemas import ComponentInstance, Wire
from ..services import catalog, projects_store
from ..services.blockly_build import (
    BlocklyBuildError,
    apply_program_edits,
    program_to_blockly_xml,
)
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


async def _create_component(
    session: SessionState, component_type: str, props: dict[str, Any] | None
) -> tuple[ComponentInstance | None, str | None]:
    if component_type in board_ids():
        board = get_board(session.board)
        return None, (
            f"The {board.label} is already on the canvas with id '{board.canvas_id}'. "
            f"Do not add another board; just wire parts to {board.canvas_id}."
        )
    component = await catalog.get_component(component_type)
    if component is None:
        return None, (
            f"unknown component type '{component_type}'. Use the exact type id from the "
            "component's skill or from list_available_components (e.g. led, resistor, buzzer, "
            "servo, seg7, lcd1602, ssd1306, rgbLed) - not a free-text name."
        )
    cid = session.next_component_id(component_type)
    px, py = _layout_position(_peripheral_count(session))
    merged_props = {**component.get("default_props", {}), **(props or {})}
    instance = ComponentInstance(id=cid, type=component_type, x=px, y=py, props=merged_props)
    session.components[cid] = instance
    return instance, None


async def add_component_handler(
    session: SessionState,
    type: str,
    props: dict[str, Any] | None = None,
) -> dict[str, Any]:
    instance, err = await _create_component(session, type, props)
    if instance is None:
        return {"ok": False, "error": err or "could not add component"}
    return {"ok": True, "component": instance.model_dump()}


def _summarize_item_errors(errors: list[dict[str, Any]], total: int, noun: str) -> str:
    """A one-line summary of a batch tool's per-item failures, so a partial
    failure never surfaces as a blank/`ok:false`-with-no-message to the agent or
    the chat. Names the offending index plus its type / endpoints."""
    parts: list[str] = []
    for e in errors:
        label = f"#{e['index']}"
        if e.get("type"):
            label += f" ({e['type']})"
        elif e.get("from_pin") or e.get("to_pin"):
            label += f" ({e.get('from_pin')} -> {e.get('to_pin')})"
        parts.append(f"{label}: {e.get('error')}")
    plural = "" if total == 1 else "s"
    return f"{len(errors)} of {total} {noun}{plural} could not be added: " + "; ".join(parts)


async def add_components_handler(
    session: SessionState, components: list[dict[str, Any]]
) -> dict[str, Any]:
    """Add several components in one call. Each item is {type, props?}; the backend
    assigns non-overlapping positions. Invalid items are reported per-index."""
    created: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for idx, spec in enumerate(components or []):
        ctype = spec.get("type") if isinstance(spec, dict) else None
        if not ctype:
            errors.append({"index": idx, "error": "each item must be {type, props?}"})
            continue
        spec_props = spec.get("props") if isinstance(spec, dict) else None
        instance, err = await _create_component(session, str(ctype), spec_props)
        if instance is None:
            errors.append({"index": idx, "type": ctype, "error": err})
            continue
        created.append(instance.model_dump())
    result: dict[str, Any] = {"ok": len(errors) == 0, "components": created, "errors": errors}
    if errors:
        result["error"] = _summarize_item_errors(errors, len(components or []), "part")
    return result


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
    board = get_board(session.board)
    if component_id == board.canvas_id:
        return board.id
    inst = session.components.get(component_id)
    return inst.type if inst else None


def _normalize_pin(session: SessionState, component_id: str, pin_name: str) -> str:
    # A bare board digital pin ("13") renders but does not drive the simulator;
    # the sim's pin tracer needs the "D" prefix. Normalize so the part lights up.
    if component_id == get_board(session.board).canvas_id and pin_name.isdigit():
        return f"D{pin_name}"
    return pin_name


def _resolve_pin(session: SessionState, pin: str) -> tuple[str | None, str | None]:
    """Validate + normalize a `componentId.pinName` reference. Returns
    (normalized_pin, None) or (None, error_message)."""
    if "." not in pin:
        return None, f"pin must be `componentId.pinName`, got '{pin}'"
    component_id, pin_name = pin.split(".", 1)
    component_type = _component_type(session, component_id)
    if component_type is None:
        return None, (
            f"unknown component id '{component_id}'. The board is "
            f"'{get_board(session.board).canvas_id}'; add other parts with "
            "add_component(s) before wiring them."
        )
    pin_name = _normalize_pin(session, component_id, pin_name)
    valid = valid_pins_for(component_type)
    if valid and pin_name not in valid:
        return None, (
            f"'{component_id}.{pin_name}' is not a real pin of {component_type}. "
            f"Valid {component_type} pins: {sorted(valid)}. "
            "Load the matching component skill for the correct pin names."
        )
    return f"{component_id}.{pin_name}", None


# --- Component placement: the backend lays parts out in non-overlapping columns
# to the left of the pinned UNO so the agent never has to pick coordinates and
# parts never stack on top of each other. ---
_LAYOUT_ORIGIN_X = 20
_LAYOUT_ORIGIN_Y = 20
# Parts stack in a tall column on the far left (8 before a second column starts)
# with generous spacing, so a typical circuit's wide parts (LCD/OLED ~300 px)
# stay clear of the pinned board on the right (see UNO_LEFT in CanvasPanel).
_LAYOUT_STEP_X = 200
_LAYOUT_STEP_Y = 130
_LAYOUT_ROWS = 8


def _peripheral_count(session: SessionState) -> int:
    return sum(1 for c in session.components.values() if c.type not in board_ids())


def _layout_position(index: int) -> tuple[float, float]:
    col = index // _LAYOUT_ROWS
    row = index % _LAYOUT_ROWS
    return (
        float(_LAYOUT_ORIGIN_X + col * _LAYOUT_STEP_X),
        float(_LAYOUT_ORIGIN_Y + row * _LAYOUT_STEP_Y),
    )


async def wire_handler(session: SessionState, from_pin: str, to_pin: str) -> dict[str, Any]:
    resolved_from, err = _resolve_pin(session, from_pin)
    if err:
        return {"ok": False, "error": err}
    resolved_to, err = _resolve_pin(session, to_pin)
    if err:
        return {"ok": False, "error": err}
    wire = Wire(from_pin=resolved_from or from_pin, to_pin=resolved_to or to_pin)
    session.wires.append(wire)
    return {"ok": True, "wire": wire.model_dump()}


async def wire_many_handler(
    session: SessionState, wires: list[dict[str, Any]]
) -> dict[str, Any]:
    """Create several wires in one call. Each item is {from_pin, to_pin}; invalid
    ones are reported per-index so the agent can fix just those."""
    created: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for idx, spec in enumerate(wires or []):
        if not isinstance(spec, dict):
            errors.append({"index": idx, "error": "each wire must be {from_pin, to_pin}"})
            continue
        resolved_from, err = _resolve_pin(session, str(spec.get("from_pin", "")))
        if err:
            errors.append({"index": idx, "from_pin": spec.get("from_pin"), "error": err})
            continue
        resolved_to, err = _resolve_pin(session, str(spec.get("to_pin", "")))
        if err:
            errors.append({"index": idx, "to_pin": spec.get("to_pin"), "error": err})
            continue
        wire = Wire(from_pin=resolved_from or "", to_pin=resolved_to or "")
        session.wires.append(wire)
        created.append(wire.model_dump())
    result: dict[str, Any] = {"ok": len(errors) == 0, "wires": created, "errors": errors}
    if errors:
        result["error"] = _summarize_item_errors(errors, len(wires or []), "wire")
    return result


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
    # Raw XML has no structured step list, so edit_program cannot patch it.
    session.program = None
    return {"ok": True, "length": len(blockly_xml)}


def _store_program(
    session: SessionState, setup: list[Any], loop: list[Any]
) -> dict[str, Any]:
    """Build + validate the XML for a structured program, persist both, and shape
    the tool result. Shared by set_program and edit_program."""
    try:
        blockly_xml = program_to_blockly_xml(setup, loop)
    except BlocklyBuildError as exc:
        return {"ok": False, "error": str(exc)}
    # The builder is trusted, but validate anyway so any future op bug surfaces
    # as an actionable error rather than an empty editor.
    error = _validate_blockly_xml(blockly_xml)
    if error:
        return {"ok": False, "error": error}
    session.blockly_xml = blockly_xml
    session.program = {"setup": setup, "loop": loop}
    return {
        "ok": True,
        "length": len(blockly_xml),
        "blockly_xml": blockly_xml,
        "program": session.program,
    }


async def set_program_handler(
    session: SessionState,
    setup: list[Any] | None = None,
    loop: list[Any] | None = None,
) -> dict[str, Any]:
    """Build the Blockly program from a flat list of steps instead of raw XML.

    The deterministic builder always emits well-formed, perfectly nested XML, so
    the agent never has to balance `<next>`/`</block>` tags by hand. The built
    XML is returned in `blockly_xml` so the frontend can load it into the editor
    (set_program has no XML in its call args, unlike set_blocks)."""
    return _store_program(session, list(setup or []), list(loop or []))


async def edit_program_handler(
    session: SessionState, edits: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    """Change PART of the current program instead of rewriting all of it.

    Targets the structured step list from the last set_program. Each edit finds a
    unique run of steps (its `anchor`) and replaces / inserts around / deletes it.
    Rebuilds and returns the XML the same way set_program does."""
    if session.program is None:
        return {
            "ok": False,
            "error": (
                "no editable program yet. Write it once with set_program first; "
                "edit_program can only patch a program made with set_program."
            ),
        }
    try:
        new_setup, new_loop = apply_program_edits(
            session.program.get("setup", []), session.program.get("loop", []), edits
        )
    except BlocklyBuildError as exc:
        return {"ok": False, "error": str(exc)}
    return _store_program(session, new_setup, new_loop)


async def compile_and_run_handler(session: SessionState) -> dict[str, Any]:
    if not session.cpp_code.strip():
        return {
            "ok": False,
            "error": "no C++ source on the session yet. The frontend should send `circuit_state.cpp_code` along with the chat request.",
        }
    result = await compile_cpp(session.cpp_code, fqbn=get_board(session.board).fqbn)
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
        description="Drop one component on the canvas. The backend assigns the id and "
        "a non-overlapping position. Prefer add_components when adding several.",
        parameters_schema={
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Component type from the catalog.",
                    "enum": catalog.CATALOG_TYPES,
                },
                "props": {
                    "type": "object",
                    "description": "Optional component-specific properties (e.g. {\"color\":\"red\"}).",
                },
            },
            "required": ["type"],
        },
        handler=add_component_handler,
    ),
    "add_components": ToolSpec(
        name="add_components",
        description="Add several components in one call (fewer round-trips). The backend "
        "assigns ids and non-overlapping positions. Returns the created components and any "
        "per-item errors.",
        parameters_schema={
            "type": "object",
            "properties": {
                "components": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "enum": catalog.CATALOG_TYPES},
                            "props": {"type": "object"},
                        },
                        "required": ["type"],
                    },
                },
            },
            "required": ["components"],
        },
        handler=add_components_handler,
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
        description="Connect two pins. Use `componentId.pinName`, e.g. `L1.anode` to `UNO.D13`. "
        "Prefer wire_many when making several connections.",
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
    "wire_many": ToolSpec(
        name="wire_many",
        description="Create several wires in one call (fewer round-trips). Each item is "
        "{from_pin, to_pin} using `componentId.pinName`. Returns created wires and per-item errors.",
        parameters_schema={
            "type": "object",
            "properties": {
                "wires": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "from_pin": {"type": "string"},
                            "to_pin": {"type": "string"},
                        },
                        "required": ["from_pin", "to_pin"],
                    },
                },
            },
            "required": ["wires"],
        },
        handler=wire_many_handler,
    ),
    "set_program": ToolSpec(
        name="set_program",
        description=(
            "Write the kid's program from a flat list of simple steps. PREFER THIS over "
            "set_blocks - the backend builds the Blockly XML for you, so the program always "
            "loads on the first try (no hand-written nested XML to get wrong). Pass `setup` "
            "(steps that run once) and `loop` (steps that repeat). Each step is an object "
            "with an `op`, e.g. {\"op\":\"digital_write\",\"pin\":\"13\",\"value\":\"HIGH\"} "
            "or {\"op\":\"delay\",\"ms\":1000}. Control steps (repeat/if/while) carry a "
            "nested `body` list."
        ),
        parameters_schema={
            "type": "object",
            "properties": {
                "setup": {
                    "type": "array",
                    "description": "Steps that run once at start (e.g. pin_mode for each pin).",
                    "items": {"type": "object"},
                },
                "loop": {
                    "type": "array",
                    "description": "Steps that repeat forever.",
                    "items": {"type": "object"},
                },
            },
            "required": ["setup", "loop"],
        },
        handler=set_program_handler,
    ),
    "edit_program": ToolSpec(
        name="edit_program",
        description=(
            "Change PART of the existing program instead of rewriting it with set_program. "
            "Use this for a small tweak the child asks for (a different delay, one more step, "
            "removing a step). Pass `edits`: a list where each edit has `list` (\"setup\" or "
            "\"loop\"), `action` (replace | insert_before | insert_after | delete | append | "
            "prepend), an `anchor` (a short run of steps that occurs exactly once, identifying "
            "WHERE to edit - add more steps to it if it is not unique), and `steps` (the new "
            "steps, for every action except delete). append/prepend need no anchor. Steps use "
            "the same op format as set_program."
        ),
        parameters_schema={
            "type": "object",
            "properties": {
                "edits": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "list": {"type": "string", "enum": ["setup", "loop"]},
                            "action": {
                                "type": "string",
                                "enum": [
                                    "replace",
                                    "insert_before",
                                    "insert_after",
                                    "delete",
                                    "append",
                                    "prepend",
                                ],
                            },
                            "anchor": {"type": "array", "items": {"type": "object"}},
                            "steps": {"type": "array", "items": {"type": "object"}},
                        },
                        "required": ["list", "action"],
                    },
                },
            },
            "required": ["edits"],
        },
        handler=edit_program_handler,
    ),
    "set_blocks": ToolSpec(
        name="set_blocks",
        description=(
            "Replace the program with raw Blockly XML. Use set_program instead for normal "
            "programs; reach for set_blocks only when you need a block set_program does not "
            "support."
        ),
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
