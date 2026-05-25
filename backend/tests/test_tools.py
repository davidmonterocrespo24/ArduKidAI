import pytest

from app.agent.session import SessionState
from app.agent.tools import TOOLS, dispatch


@pytest.fixture
def session():
    return SessionState(session_id="test")


async def test_list_components_returns_catalog(session):
    result = await dispatch("list_available_components", session, {})
    assert result["ok"] is True
    assert len(result["components"]) == 9
    types = {c["type"] for c in result["components"]}
    assert {"uno", "led", "pushbutton", "buzzer", "servo"}.issubset(types)


async def test_add_component_assigns_sequential_ids(session):
    a = await dispatch("add_component", session, {"type": "led"})
    b = await dispatch("add_component", session, {"type": "led"})
    assert a["ok"] and b["ok"]
    assert a["component"]["id"] == "L1"
    assert b["component"]["id"] == "L2"
    assert a["component"]["props"]["color"] == "red"  # default


async def test_add_component_rejects_unknown_type(session):
    result = await dispatch("add_component", session, {"type": "ufo"})
    assert result["ok"] is False
    assert "unknown component type" in result["error"]


async def test_wire_validates_component_ids(session):
    await dispatch("add_component", session, {"type": "led"})
    ok = await dispatch("wire", session, {"from_pin": "L1.anode", "to_pin": "UNO.D13"})
    assert ok["ok"] is True

    bad = await dispatch("wire", session, {"from_pin": "L9.anode", "to_pin": "UNO.D13"})
    assert bad["ok"] is False
    assert "unknown component" in bad["error"]

    malformed = await dispatch("wire", session, {"from_pin": "L1anode", "to_pin": "UNO.D13"})
    assert malformed["ok"] is False
    assert "must be" in malformed["error"]


async def test_remove_component_drops_wires(session):
    await dispatch("add_component", session, {"type": "led"})
    await dispatch("wire", session, {"from_pin": "L1.anode", "to_pin": "UNO.D13"})
    assert len(session.wires) == 1

    result = await dispatch("remove_component", session, {"id": "L1"})
    assert result["ok"] is True
    assert session.components == {}
    assert session.wires == []


async def test_save_project_persists_state(session):
    await dispatch("add_component", session, {"type": "led"})
    saved = await dispatch("save_project", session, {"name": "blink"})
    assert saved["ok"] is True
    assert saved["project"]["name"] == "blink"
    assert len(saved["project"]["circuit"]["components"]) == 1


async def test_unknown_tool_is_rejected(session):
    result = await dispatch("does_not_exist", session, {})
    assert result["ok"] is False
    assert result["error"].startswith("unknown tool")


def test_canvas_and_mcp_tools_registered():
    canvas_tools = {
        "list_available_components",
        "add_component",
        "remove_component",
        "wire",
        "set_blocks",
        "compile_and_run",
        "save_project",
    }
    mcp_shaped_tools = {
        "find_similar_example",
        "list_saved_projects",
        "load_project",
        "search_docs",
    }
    assert canvas_tools.issubset(TOOLS)
    assert mcp_shaped_tools.issubset(TOOLS)
    assert set(TOOLS) == canvas_tools | mcp_shaped_tools
