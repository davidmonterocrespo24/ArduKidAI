"""Tests for the flat-steps -> Blockly XML builder behind set_program.

These also pin down WHY set_program exists: a long linear program is fine as a
flat list but, as raw XML, needs deeply nested perfectly-balanced tags that the
model kept getting wrong (the retry loop the child saw). See
test_handwritten_nested_xml_breaks_on_one_dropped_tag.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

import pytest

from app.agent.tools import _validate_blockly_xml
from app.services.blockly_build import (
    BlocklyBuildError,
    apply_program_edits,
    program_to_blockly_xml,
)

NS = "{https://developers.google.com/blockly/xml}"


def _types(xml: str) -> list[str]:
    root = ET.fromstring(xml)
    return [el.get("type") or "" for el in root.iter() if el.tag in (f"{NS}block", f"{NS}shadow")]


def _top_types(xml: str) -> list[str]:
    return [b.get("type") or "" for b in ET.fromstring(xml)]


def test_blink_program_is_valid_and_well_formed():
    xml = program_to_blockly_xml(
        [{"op": "pin_mode", "pin": "13", "mode": "OUTPUT"}],
        [
            {"op": "digital_write", "pin": "13", "value": "HIGH"},
            {"op": "delay", "ms": 500},
            {"op": "digital_write", "pin": "13", "value": "LOW"},
            {"op": "delay", "ms": 500},
        ],
    )
    # Parses, and passes the same validator set_blocks uses.
    ET.fromstring(xml)
    assert _validate_blockly_xml(xml) is None
    assert _top_types(xml) == ["ardukid_setup", "ardukid_loop"]
    assert "ardukid_digital_write" in _types(xml)


def test_traffic_light_with_7segment_countdown_builds_first_try():
    """The exact shape that looped as hand-written XML: ~25 linear statements."""
    setup = [{"op": "pin_mode", "pin": str(p), "mode": "OUTPUT"} for p in (13, 12, 11, 2, 3, 4, 5, 6, 7, 8)]
    loop: list[dict] = []
    for light in (13, 12, 11):
        loop.append({"op": "digital_write", "pin": str(light), "value": "HIGH"})
        for seg in (2, 3, 4, 5, 6, 7, 8):
            loop.append({"op": "digital_write", "pin": str(seg), "value": "HIGH"})
        loop.append({"op": "delay", "ms": 1000})
        loop.append({"op": "digital_write", "pin": str(light), "value": "LOW"})

    xml = program_to_blockly_xml(setup, loop)
    assert _validate_blockly_xml(xml) is None  # would have been the failure point
    # Every digital_write made it in (10 setup pin_modes + the loop writes).
    assert _types(xml).count("ardukid_digital_write") == 3 + 3 * 7 + 3


def test_statements_chain_via_next_in_order():
    xml = program_to_blockly_xml(
        [],
        [
            {"op": "digital_write", "pin": "2", "value": "HIGH"},
            {"op": "delay", "ms": 100},
            {"op": "digital_write", "pin": "2", "value": "LOW"},
        ],
    )
    root = ET.fromstring(xml)
    loop = next(b for b in root if b.get("type") == "ardukid_loop")
    first = loop.find(f"{NS}statement[@name='DO']/{NS}block")
    assert first.get("type") == "ardukid_digital_write"
    # second statement is nested inside the first block's <next>, not a sibling
    second = first.find(f"{NS}next/{NS}block")
    assert second.get("type") == "ardukid_delay"
    third = second.find(f"{NS}next/{NS}block")
    assert third.get("type") == "ardukid_digital_write"


def test_numeric_value_becomes_math_number_shadow():
    xml = program_to_blockly_xml([], [{"op": "delay", "ms": 750}])
    root = ET.fromstring(xml)
    num = root.find(f".//{NS}value[@name='MS']/{NS}shadow[@type='math_number']/{NS}field[@name='NUM']")
    assert num is not None and num.text == "750"


def test_analog_write_value_is_a_value_not_a_field():
    xml = program_to_blockly_xml([], [{"op": "analog_write", "pin": "9", "value": 128}])
    root = ET.fromstring(xml)
    assert root.find(f".//{NS}block[@type='ardukid_analog_write']/{NS}value[@name='VALUE']") is not None


def test_digital_write_value_is_a_field():
    xml = program_to_blockly_xml([], [{"op": "digital_write", "pin": "9", "value": "LOW"}])
    root = ET.fromstring(xml)
    field = root.find(f".//{NS}block[@type='ardukid_digital_write']/{NS}field[@name='VALUE']")
    assert field is not None and field.text == "LOW"


def test_repeat_nests_body_in_DO():
    xml = program_to_blockly_xml(
        [],
        [{"op": "repeat", "times": 3, "body": [{"op": "digital_write", "pin": "13", "value": "HIGH"}]}],
    )
    root = ET.fromstring(xml)
    repeat = root.find(f".//{NS}block[@type='controls_repeat_ext']")
    assert repeat is not None
    assert repeat.find(f"{NS}value[@name='TIMES']") is not None
    assert repeat.find(f"{NS}statement[@name='DO']/{NS}block[@type='ardukid_digital_write']") is not None


def test_if_with_digital_read_condition():
    xml = program_to_blockly_xml(
        [],
        [{"op": "if", "cond": {"op": "digital_read", "pin": "2"}, "body": [{"op": "delay", "ms": 10}]}],
    )
    assert _validate_blockly_xml(xml) is None
    root = ET.fromstring(xml)
    cond = root.find(f".//{NS}block[@type='controls_if']/{NS}value[@name='IF0']/{NS}block")
    assert cond.get("type") == "ardukid_digital_read"


def test_while_with_compare_condition():
    xml = program_to_blockly_xml(
        [],
        [
            {
                "op": "while",
                "mode": "WHILE",
                "cond": {"op": "compare", "cmp": "LT", "a": {"op": "analog_read", "pin": "A0"}, "b": 500},
                "body": [{"op": "delay", "ms": 5}],
            }
        ],
    )
    assert _validate_blockly_xml(xml) is None
    root = ET.fromstring(xml)
    cmp_block = root.find(f".//{NS}block[@type='logic_compare']")
    assert cmp_block.find(f"{NS}field[@name='OP']").text == "LT"
    assert cmp_block.find(f"{NS}value[@name='A']/{NS}block[@type='ardukid_analog_read']") is not None


def test_modulo_expression_builds_math_modulo():
    # The clock case that failed before: seconds = millis()/1000 % 60.
    xml = program_to_blockly_xml(
        [{"op": "serial_begin", "baud": 9600}],
        [
            {
                "op": "serial_println",
                "value": {
                    "op": "modulo",
                    "a": {"op": "divide", "a": {"op": "millis"}, "b": 1000},
                    "b": 60,
                },
            }
        ],
    )
    assert _validate_blockly_xml(xml) is None  # math_modulo is now a valid type
    root = ET.fromstring(xml)
    mod = root.find(f".//{NS}block[@type='math_modulo']")
    assert mod is not None
    assert mod.find(f"{NS}value[@name='DIVIDEND']") is not None
    assert mod.find(f"{NS}value[@name='DIVISOR']") is not None
    assert root.find(f".//{NS}block[@type='math_arithmetic']") is not None  # the divide


def test_serial_println_text_is_escaped():
    xml = program_to_blockly_xml([], [{"op": "serial_println", "text": "a < b & c"}])
    # Escaped entities keep it well-formed.
    root = ET.fromstring(xml)
    field = root.find(f".//{NS}block[@type='ardukid_serial_println']//{NS}field[@name='TEXT']")
    assert field.text == "a < b & c"


def test_pin_accepts_int_and_strips_leading_d():
    xml = program_to_blockly_xml([], [{"op": "digital_write", "pin": "D13", "value": "HIGH"}])
    root = ET.fromstring(xml)
    pin = root.find(f".//{NS}block[@type='ardukid_digital_write']/{NS}field[@name='PIN']")
    assert pin.text == "13"  # leading D dropped so digitalWrite(13) compiles


def test_unknown_op_raises_with_path():
    with pytest.raises(BlocklyBuildError) as exc:
        program_to_blockly_xml([], [{"op": "do_magic"}])
    assert "loop[0]" in str(exc.value)
    assert "do_magic" in str(exc.value)


def test_missing_required_field_raises():
    with pytest.raises(BlocklyBuildError):
        program_to_blockly_xml([], [{"op": "digital_write", "value": "HIGH"}])  # no pin
    with pytest.raises(BlocklyBuildError):
        program_to_blockly_xml([], [{"op": "delay"}])  # no ms


def test_bad_enum_value_raises():
    with pytest.raises(BlocklyBuildError) as exc:
        program_to_blockly_xml([], [{"op": "digital_write", "pin": "13", "value": "ON"}])
    assert "HIGH" in str(exc.value)


def _sample_loop():
    return [
        {"op": "digital_write", "pin": "13", "value": "HIGH"},
        {"op": "delay", "ms": 3000},
        {"op": "digital_write", "pin": "13", "value": "LOW"},
        {"op": "delay", "ms": 1000},
    ]


def test_edit_replace_changes_only_the_anchored_run():
    _, loop = apply_program_edits(
        [],
        _sample_loop(),
        [
            {
                "list": "loop",
                "action": "replace",
                "anchor": [{"op": "digital_write", "pin": "13", "value": "HIGH"}, {"op": "delay"}],
                "steps": [{"op": "digital_write", "pin": "13", "value": "HIGH"}, {"op": "delay", "ms": 5000}],
            }
        ],
    )
    assert loop[1] == {"op": "delay", "ms": 5000}
    assert loop[3] == {"op": "delay", "ms": 1000}  # the other delay is untouched


def test_edit_insert_after_and_before():
    _, loop = apply_program_edits(
        [],
        _sample_loop(),
        [
            {
                "list": "loop",
                "action": "insert_after",
                "anchor": [{"op": "digital_write", "pin": "13", "value": "LOW"}],
                "steps": [{"op": "tone", "pin": "8", "freq": 440}],
            }
        ],
    )
    low_idx = next(i for i, s in enumerate(loop) if s.get("value") == "LOW")
    assert loop[low_idx + 1]["op"] == "tone"


def test_edit_delete_and_prepend():
    setup, loop = apply_program_edits(
        [{"op": "pin_mode", "pin": "13", "mode": "OUTPUT"}],
        _sample_loop(),
        [
            {"list": "setup", "action": "prepend", "steps": [{"op": "serial_begin", "baud": 9600}]},
            {
                "list": "loop",
                "action": "delete",
                "anchor": [{"op": "digital_write", "pin": "13", "value": "LOW"}, {"op": "delay", "ms": 1000}],
            },
        ],
    )
    assert setup[0]["op"] == "serial_begin"
    assert all(not (s["op"] == "delay" and s.get("ms") == 1000) for s in loop)


def test_edit_ambiguous_anchor_raises():
    with pytest.raises(BlocklyBuildError) as exc:
        apply_program_edits([], _sample_loop(), [{"list": "loop", "action": "delete", "anchor": [{"op": "delay"}]}])
    assert "unique" in str(exc.value)


def test_edit_missing_anchor_raises():
    with pytest.raises(BlocklyBuildError):
        apply_program_edits(
            [], _sample_loop(), [{"list": "loop", "action": "delete", "anchor": [{"op": "servo_write"}]}]
        )


def test_edit_anchor_matches_across_int_and_string_pins():
    # stored as ints, anchor as strings -> still matches (scalar string compare)
    _, loop = apply_program_edits(
        [],
        [{"op": "digital_write", "pin": 7, "value": "HIGH"}, {"op": "delay", "ms": 500}],
        [
            {
                "list": "loop",
                "action": "delete",
                "anchor": [{"op": "digital_write", "pin": "7", "value": "HIGH"}],
            }
        ],
    )
    assert loop == [{"op": "delay", "ms": 500}]


def test_handwritten_nested_xml_breaks_on_one_dropped_tag():
    """Documents the failure set_program removes: drop ONE </next> from a valid
    nested program and the same validator the agent hit rejects it."""
    good = program_to_blockly_xml(
        [],
        [
            {"op": "digital_write", "pin": "2", "value": "HIGH"},
            {"op": "delay", "ms": 100},
            {"op": "digital_write", "pin": "2", "value": "LOW"},
        ],
    )
    assert _validate_blockly_xml(good) is None
    broken = good.replace("</next>", "", 1)  # the kind of off-by-one a model makes
    err = _validate_blockly_xml(broken)
    assert err is not None
    assert "not well-formed XML" in err
