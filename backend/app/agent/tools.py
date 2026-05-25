"""The seven custom agent tools.

Each entry in `TOOLS` carries both the JSON-schema declaration that we pass to
Gemini's function-calling API and the async Python handler that executes the
side effect. The handler returns a JSON-serialisable dict that is sent back to
the model as the function response, and also surfaced to the frontend as a
`tool_result` SSE event."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from ..schemas import ComponentInstance, Wire
from ..services import catalog, projects_store
from ..services.compiler import compile_cpp
from .session import SessionState

ToolHandler = Callable[..., Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters_schema: dict[str, Any]
    handler: ToolHandler


# ---------- handlers ----------


async def list_available_components_handler(session: SessionState) -> dict[str, Any]:
    _ = session
    return {"ok": True, "components": catalog.list_components()}


async def add_component_handler(
    session: SessionState,
    type: str,
    x: float = 0.0,
    y: float = 0.0,
    props: dict[str, Any] | None = None,
) -> dict[str, Any]:
    component = catalog.get_component(type)
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
    session.wires = [w for w in session.wires if not (w.from_pin.startswith(f"{id}.") or w.to_pin.startswith(f"{id}."))]
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
            "error": "no C++ source on the session yet. The frontend should send `circuit_state.cpp_code` along with the chat request once Blockly codegen is wired (phase 3).",
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
    detail = projects_store.save(name=name, circuit=circuit)
    return {"ok": True, "project": detail.model_dump()}


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
                    "enum": [c["type"] for c in catalog.list_components()],
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
