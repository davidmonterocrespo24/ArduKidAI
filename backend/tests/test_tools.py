import pytest

from app.agent.session import SessionState
from app.agent.tools import TOOLS, dispatch


@pytest.fixture
def session():
    return SessionState(session_id="test")


async def test_list_components_returns_catalog(session):
    result = await dispatch("list_available_components", session, {})
    assert result["ok"] is True
    assert len(result["components"]) == 30
    types = {c["type"] for c in result["components"]}
    assert {"uno", "led", "pushbutton", "buzzer", "servo", "ssd1306",
            "dht22", "hcSr04", "rgbLed", "pirMotion", "lcd2004"}.issubset(types)


async def test_add_component_assigns_sequential_ids(session):
    a = await dispatch("add_component", session, {"type": "led"})
    b = await dispatch("add_component", session, {"type": "led"})
    assert a["ok"] and b["ok"]
    assert a["component"]["id"] == "L1"
    assert b["component"]["id"] == "L2"
    assert a["component"]["props"]["color"] == "red"  # default


async def test_add_component_ssd1306_oled(session):
    r = await dispatch("add_component", session, {"type": "ssd1306"})
    assert r["ok"] is True
    assert r["component"]["id"] == "OLED1"
    assert r["component"]["type"] == "ssd1306"


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


async def test_add_components_batch_assigns_non_overlapping_positions(session):
    res = await dispatch(
        "add_components",
        session,
        {"components": [{"type": "led"}, {"type": "resistor"}, {"type": "led"}]},
    )
    assert res["ok"] is True
    comps = res["components"]
    assert [c["id"] for c in comps] == ["L1", "R1", "L2"]
    positions = {(c["x"], c["y"]) for c in comps}
    assert len(positions) == 3  # no two parts share a spot


async def test_add_components_partial_failure_has_top_level_message(session):
    # The exact case that surfaced as "unknown error" in chat: a bad type id
    # among good ones must still yield a readable top-level `error`.
    res = await dispatch(
        "add_components",
        session,
        {"components": [{"type": "led"}, {"type": "resistor"}, {"type": "seven-segment"}]},
    )
    assert res["ok"] is False
    assert len(res["components"]) == 2  # the two valid parts were added
    assert res.get("error")  # not blank -> frontend no longer shows "unknown error"
    assert "seven-segment" in res["error"]
    assert "#2" in res["error"]  # names the offending index


async def test_wire_many_partial_failure_has_top_level_message(session):
    await dispatch("add_component", session, {"type": "led"})
    res = await dispatch(
        "wire_many",
        session,
        {"wires": [{"from_pin": "L1.anode", "to_pin": "UNO.D13"}, {"from_pin": "L9.anode", "to_pin": "UNO.GND"}]},
    )
    assert res["ok"] is False
    assert len(res["wires"]) == 1
    assert res.get("error") and "L9.anode" in res["error"]


async def test_add_components_reports_uno_per_item(session):
    res = await dispatch(
        "add_components", session, {"components": [{"type": "uno"}, {"type": "led"}]}
    )
    assert res["ok"] is False
    assert any("UNO" in e["error"] for e in res["errors"])
    assert len(res["components"]) == 1  # the led was still added


async def test_wire_many_validates_each(session):
    await dispatch("add_components", session, {"components": [{"type": "led"}, {"type": "resistor"}]})
    res = await dispatch(
        "wire_many",
        session,
        {
            "wires": [
                {"from_pin": "UNO.D13", "to_pin": "R1.a"},
                {"from_pin": "R1.b", "to_pin": "L1.anode"},
                {"from_pin": "L1.cathode", "to_pin": "UNO.GND"},
                {"from_pin": "L9.anode", "to_pin": "UNO.GND"},
            ]
        },
    )
    assert len(res["wires"]) == 3
    assert len(res["errors"]) == 1
    assert res["ok"] is False
    assert len(session.wires) == 3


async def test_wire_normalizes_bare_uno_digital_pin(session):
    await dispatch("add_component", session, {"type": "led"})
    res = await dispatch("wire", session, {"from_pin": "L1.anode", "to_pin": "UNO.13"})
    assert res["ok"] is True
    assert res["wire"]["to_pin"] == "UNO.D13"


async def test_validate_circuit_flags_loose_led(session):
    await dispatch("add_component", session, {"type": "led"})
    res = await dispatch("validate_circuit", session, {})
    assert res["ok"] is True
    assert res["is_valid"] is False
    assert any("L1" in issue for issue in res["issues"])


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


async def test_set_program_builds_and_stores_xml(session):
    res = await dispatch(
        "set_program",
        session,
        {
            "setup": [{"op": "pin_mode", "pin": "13", "mode": "OUTPUT"}],
            "loop": [
                {"op": "digital_write", "pin": "13", "value": "HIGH"},
                {"op": "delay", "ms": 500},
                {"op": "digital_write", "pin": "13", "value": "LOW"},
                {"op": "delay", "ms": 500},
            ],
        },
    )
    assert res["ok"] is True
    # The built XML is returned so the frontend can load it, and persisted.
    assert res["blockly_xml"] == session.blockly_xml
    assert "ardukid_setup" in session.blockly_xml
    assert "ardukid_loop" in session.blockly_xml


async def test_set_program_reports_bad_step(session):
    res = await dispatch(
        "set_program",
        session,
        {"setup": [], "loop": [{"op": "digital_write", "value": "HIGH"}]},  # missing pin
    )
    assert res["ok"] is False
    assert "loop[0]" in res["error"]
    assert "pin" in res["error"]


async def _blink(session):
    return await dispatch(
        "set_program",
        session,
        {
            "setup": [{"op": "pin_mode", "pin": "13", "mode": "OUTPUT"}],
            "loop": [
                {"op": "digital_write", "pin": "13", "value": "HIGH"},
                {"op": "delay", "ms": 500},
                {"op": "digital_write", "pin": "13", "value": "LOW"},
                {"op": "delay", "ms": 500},
            ],
        },
    )


async def test_edit_program_patches_one_step(session):
    await _blink(session)
    res = await dispatch(
        "edit_program",
        session,
        {
            "edits": [
                {
                    "list": "loop",
                    "action": "replace",
                    "anchor": [
                        {"op": "digital_write", "pin": "13", "value": "HIGH"},
                        {"op": "delay"},
                    ],
                    "steps": [
                        {"op": "digital_write", "pin": "13", "value": "HIGH"},
                        {"op": "delay", "ms": 2000},
                    ],
                }
            ]
        },
    )
    assert res["ok"] is True
    # Only the first delay changed; the rest of the program is untouched.
    assert session.program["loop"][1] == {"op": "delay", "ms": 2000}
    assert session.program["loop"][3] == {"op": "delay", "ms": 500}
    assert res["blockly_xml"] == session.blockly_xml


async def test_edit_program_append_and_ambiguous_anchor(session):
    await _blink(session)
    appended = await dispatch(
        "edit_program",
        session,
        {"edits": [{"list": "loop", "action": "append", "steps": [{"op": "no_tone", "pin": "8"}]}]},
    )
    assert appended["ok"] is True
    assert session.program["loop"][-1] == {"op": "no_tone", "pin": "8"}

    # A bare delay anchor is ambiguous (two delays) -> actionable error, no change.
    ambiguous = await dispatch(
        "edit_program",
        session,
        {"edits": [{"list": "loop", "action": "delete", "anchor": [{"op": "delay"}]}]},
    )
    assert ambiguous["ok"] is False
    assert "unique" in ambiguous["error"]


async def test_edit_program_without_set_program_first(session):
    res = await dispatch(
        "edit_program",
        session,
        {"edits": [{"list": "loop", "action": "append", "steps": [{"op": "delay", "ms": 1}]}]},
    )
    assert res["ok"] is False
    assert "set_program" in res["error"]


async def test_set_blocks_clears_editable_program(session):
    await _blink(session)
    assert session.program is not None
    xml = '<xml xmlns="https://developers.google.com/blockly/xml">' \
          '<block type="ardukid_setup"></block><block type="ardukid_loop"></block></xml>'
    await dispatch("set_blocks", session, {"blockly_xml": xml})
    assert session.program is None


async def test_describe_circuit_snapshots_canvas(session):
    await dispatch("add_components", session, {"components": [{"type": "led"}, {"type": "resistor"}]})
    await dispatch("wire", session, {"from_pin": "L1.anode", "to_pin": "UNO.D13"})
    res = await dispatch("describe_circuit", session, {})
    assert res["ok"] is True
    assert res["board"] == "UNO"
    types = {c["type"] for c in res["components"]}
    assert {"led", "resistor"}.issubset(types)
    assert any(w["from_pin"] == "L1.anode" for w in res["wires"])
    assert res["has_program"] is False


async def test_unknown_tool_is_rejected(session):
    result = await dispatch("does_not_exist", session, {})
    assert result["ok"] is False
    assert result["error"].startswith("unknown tool")


def test_canvas_and_mcp_tools_registered():
    canvas_tools = {
        "list_available_components",
        "add_component",
        "add_components",
        "remove_component",
        "wire",
        "wire_many",
        "set_program",
        "edit_program",
        "set_blocks",
        "compile_and_run",
        "save_project",
        "validate_circuit",
        "describe_circuit",
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
