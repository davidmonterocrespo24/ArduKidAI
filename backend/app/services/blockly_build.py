"""Deterministic builder: a flat list of program steps -> Blockly workspace XML.

`set_blocks(blockly_xml)` makes the model hand-write the whole workspace,
including the deeply nested `<next><block>...</block></next>` chain that links
consecutive statements. For a long linear program - a traffic light plus a
7-segment countdown is 30 to 50 statements - that is 30 to 50 levels of
perfectly balanced closing tags, which language models routinely miscount.
The result is `xml.etree`'s "mismatched tag" error and a retry loop the child
watches in real time.

`set_program(setup, loop)` instead lets the model pass a flat list of simple
`{"op": ...}` steps. This module assembles the nesting deterministically, so
the program is always well-formed and loads on the first try. The XML it emits
is exactly the shape the frontend Blockly editor and its C++ generator already
consume (verified field names against frontend/src/blockly/cppGenerator.ts).

Supported statement ops:
  pin_mode, digital_write, analog_write, delay, tone, no_tone,
  servo_attach, servo_write, serial_begin, serial_print, serial_println,
  repeat (count loop), if, while  - the last three nest a `body` list.
Supported expression ops (for `value`/`cond` slots):
  digital_read, analog_read, compare, logic (and/or), number, millis.
Anything outside this set is still expressible through raw `set_blocks`.
"""

from __future__ import annotations

from typing import Any
from xml.sax.saxutils import escape

NAMESPACE = "https://developers.google.com/blockly/xml"

_PIN_MODES = {"OUTPUT", "INPUT", "INPUT_PULLUP"}
_DIGITAL_LEVELS = {"HIGH", "LOW"}
_COMPARE_OPS = {"EQ", "NEQ", "LT", "LTE", "GT", "GTE"}
_WHILE_MODES = {"WHILE", "UNTIL"}

_STATEMENT_OPS = (
    "pin_mode, digital_write, analog_write, delay, tone, no_tone, "
    "servo_attach, servo_write, serial_begin, serial_print, serial_println, "
    "repeat, if, while"
)


class BlocklyBuildError(ValueError):
    """A step the builder cannot turn into a valid block. The message names the
    offending path (e.g. loop[3]) so the agent can fix exactly that step."""


_EDIT_ACTIONS = ("replace", "insert_before", "insert_after", "delete", "append", "prepend")


def apply_program_edits(
    setup: list[Any], loop: list[Any], edits: Any
) -> tuple[list[Any], list[Any]]:
    """Apply a list of targeted edits to the program's step lists and return the
    new (setup, loop). Inspired by an anchored old/new-string file editor: an
    edit locates a contiguous run of steps by content (the `anchor`) that must
    occur EXACTLY ONCE, then replaces / inserts around / deletes it - so the
    agent changes one part of the program without re-sending the whole thing.

    Each edit is a dict:
      {"list": "setup"|"loop", "action": <action>, "anchor": [<step>, ...], "steps": [<step>, ...]}
    action: replace | insert_before | insert_after | delete | append | prepend.
    `anchor` (a short run of partial step dicts) is required for the first four
    and identifies WHERE; `steps` is the new content for everything but delete.
    append/prepend need no anchor. Raises BlocklyBuildError on a missing/
    ambiguous anchor or a malformed edit, naming the edit index.
    """
    lists = {"setup": list(setup), "loop": list(loop)}
    if not isinstance(edits, list) or not edits:
        raise BlocklyBuildError("edits must be a non-empty list of edit objects")

    for i, edit in enumerate(edits):
        path = f"edits[{i}]"
        if not isinstance(edit, dict):
            raise BlocklyBuildError(f"{path}: each edit must be an object")
        which = edit.get("list")
        if which not in lists:
            raise BlocklyBuildError(f"{path}: 'list' must be 'setup' or 'loop', got {which!r}")
        action = edit.get("action")
        if action not in _EDIT_ACTIONS:
            raise BlocklyBuildError(f"{path}: 'action' must be one of {list(_EDIT_ACTIONS)}, got {action!r}")
        target = lists[which]
        new_steps = _edit_steps(edit, path) if action != "delete" else []

        if action == "append":
            target.extend(new_steps)
            continue
        if action == "prepend":
            target[:0] = new_steps
            continue

        start, length = _locate_anchor(edit.get("anchor"), target, path)
        if action == "replace":
            target[start : start + length] = new_steps
        elif action == "insert_before":
            target[start:start] = new_steps
        elif action == "insert_after":
            target[start + length : start + length] = new_steps
        elif action == "delete":
            del target[start : start + length]

    return lists["setup"], lists["loop"]


def _edit_steps(edit: dict[str, Any], path: str) -> list[Any]:
    steps = edit.get("steps")
    if not isinstance(steps, list) or not steps:
        raise BlocklyBuildError(f"{path}: '{edit.get('action')}' needs a non-empty 'steps' list")
    return steps


def _locate_anchor(anchor: Any, target: list[Any], path: str) -> tuple[int, int]:
    """Return (start_index, length) of the one place `anchor` matches as a
    contiguous run in `target`. Errors if the anchor is empty, never matches, or
    matches more than once (the agent must add context to make it unique)."""
    if not isinstance(anchor, list) or not anchor:
        raise BlocklyBuildError(f"{path}: 'anchor' must be a non-empty list of steps to match")
    matches = [
        s
        for s in range(len(target) - len(anchor) + 1)
        if all(_step_matches(anchor[j], target[s + j]) for j in range(len(anchor)))
    ]
    if not matches:
        raise BlocklyBuildError(f"{path}: anchor matched no steps; check it against the current program")
    if len(matches) > 1:
        raise BlocklyBuildError(
            f"{path}: anchor matched {len(matches)} places; add more steps to the anchor to make it unique"
        )
    return matches[0], len(anchor)


def _step_matches(anchor_step: Any, prog_step: Any) -> bool:
    """A program step matches an anchor step when every key the anchor names is
    present and equal. Scalars compare by string so "13" and 13 are the same."""
    if not isinstance(anchor_step, dict) or not isinstance(prog_step, dict):
        return False
    for key, value in anchor_step.items():
        other = prog_step.get(key)
        if isinstance(value, (str, int, float)) and isinstance(other, (str, int, float)):
            if str(value) != str(other):
                return False
        elif other != value:
            return False
    return True


def program_to_blockly_xml(setup: Any, loop: Any) -> str:
    """Build a full Blockly workspace from a setup list and a loop list.

    Each element is a statement dict like {"op": "digital_write", "pin": "13",
    "value": "HIGH"}. Raises BlocklyBuildError on an unknown op or a bad field.
    """
    setup = setup or []
    loop = loop or []
    if not isinstance(setup, list) or not isinstance(loop, list):
        raise BlocklyBuildError("setup and loop must each be a list of steps")
    setup_inner = _chain(setup, "setup")
    loop_inner = _chain(loop, "loop")
    return (
        f'<xml xmlns="{NAMESPACE}">'
        f'<block type="ardukid_setup" x="20" y="20">{_do("DO", setup_inner)}</block>'
        f'<block type="ardukid_loop" x="20" y="320">{_do("DO", loop_inner)}</block>'
        "</xml>"
    )


# --- statement chaining -------------------------------------------------------


def _chain(steps: list[Any], path: str) -> str:
    """Link a flat list of statements into the nested <next> chain Blockly wants.

    Recursion (not string surgery) guarantees every <block>/<next> tag is closed
    in the right order regardless of how long the list is."""

    def render(i: int) -> str:
        if i >= len(steps):
            return ""
        block_type, inner = _statement(steps[i], f"{path}[{i}]")
        rest = render(i + 1)
        next_xml = f"<next>{rest}</next>" if rest else ""
        return f'<block type="{block_type}">{inner}{next_xml}</block>'

    return render(0)


def _do(name: str, inner: str) -> str:
    """A <statement> slot, omitted entirely when empty (an empty container is
    valid but pointless)."""
    return f'<statement name="{name}">{inner}</statement>' if inner else ""


# --- one statement ------------------------------------------------------------


def _statement(stmt: Any, path: str) -> tuple[str, str]:
    """Return (block_type, inner_xml) for one step. inner_xml holds the block's
    fields, then values, then nested statements, in the order Blockly expects;
    the caller appends any <next>."""
    if not isinstance(stmt, dict):
        raise BlocklyBuildError(
            f"{path}: each step must be an object with an 'op', got {type(stmt).__name__}"
        )
    op = stmt.get("op")
    if not op:
        raise BlocklyBuildError(f"{path}: step is missing 'op'")

    if op == "pin_mode":
        pin = _pin(stmt, path)
        mode = _enum(stmt, "mode", _PIN_MODES, "OUTPUT", path)
        return "ardukid_pin_mode", _field("PIN", pin) + _field("MODE", mode)

    if op == "digital_write":
        pin = _pin(stmt, path)
        level = _enum(stmt, "value", _DIGITAL_LEVELS, "HIGH", path)
        return "ardukid_digital_write", _field("PIN", pin) + _field("VALUE", level)

    if op == "analog_write":
        pin = _pin(stmt, path)
        return "ardukid_analog_write", _field("PIN", pin) + _value("VALUE", stmt.get("value"), path, 0)

    if op == "delay":
        if stmt.get("ms") is None:
            raise BlocklyBuildError(f"{path}: 'delay' needs 'ms'")
        return "ardukid_delay", _value("MS", stmt.get("ms"), path)

    if op == "tone":
        pin = _pin(stmt, path)
        inner = _field("PIN", pin) + _value("FREQ", stmt.get("freq"), path, 440)
        if stmt.get("duration") is not None:
            inner += _value("DURATION", stmt.get("duration"), path)
        return "ardukid_tone", inner

    if op == "no_tone":
        return "ardukid_no_tone", _field("PIN", _pin(stmt, path))

    if op == "servo_attach":
        return "ardukid_servo_attach", _field("PIN", _pin(stmt, path))

    if op == "servo_write":
        pin = _pin(stmt, path)
        return "ardukid_servo_write", _field("PIN", pin) + _value("ANGLE", stmt.get("angle"), path, 90)

    if op == "serial_begin":
        baud = stmt.get("baud", 9600)
        return "ardukid_serial_begin", _field("BAUD", str(baud))

    if op in ("serial_print", "serial_println"):
        block = "ardukid_serial_print" if op == "serial_print" else "ardukid_serial_println"
        return block, _print_value(stmt, path)

    if op == "repeat":
        if stmt.get("times") is None:
            raise BlocklyBuildError(f"{path}: 'repeat' needs 'times'")
        body = _chain(_body(stmt, path), f"{path}.body")
        return "controls_repeat_ext", _value("TIMES", stmt.get("times"), path) + _do("DO", body)

    if op == "if":
        if stmt.get("cond") is None:
            raise BlocklyBuildError(f"{path}: 'if' needs 'cond'")
        body = _chain(_body(stmt, path), f"{path}.body")
        return "controls_if", _value("IF0", stmt.get("cond"), f"{path}.cond") + _do("DO0", body)

    if op == "while":
        if stmt.get("cond") is None:
            raise BlocklyBuildError(f"{path}: 'while' needs 'cond'")
        mode = _enum(stmt, "mode", _WHILE_MODES, "WHILE", path)
        body = _chain(_body(stmt, path), f"{path}.body")
        inner = _field("MODE", mode) + _value("BOOL", stmt.get("cond"), f"{path}.cond") + _do("DO", body)
        return "controls_whileUntil", inner

    raise BlocklyBuildError(f"{path}: unknown op '{op}'. Valid statement ops: {_STATEMENT_OPS}")


def _body(stmt: dict[str, Any], path: str) -> list[Any]:
    body = stmt.get("body") or []
    if not isinstance(body, list):
        raise BlocklyBuildError(f"{path}: 'body' must be a list of steps")
    return body


# --- expressions (value / condition slots) ------------------------------------


def _expr(node: dict[str, Any], path: str) -> str:
    """Return a full <block> for an expression op, used inside a <value> slot."""
    op = node.get("op")
    if op == "digital_read":
        return f'<block type="ardukid_digital_read">{_field("PIN", _pin(node, path))}</block>'
    if op == "analog_read":
        return f'<block type="ardukid_analog_read">{_field("PIN", _pin(node, path, default="A0"))}</block>'
    if op == "millis":
        return '<block type="ardukid_millis"></block>'
    if op == "number":
        return f'<block type="math_number">{_field("NUM", _num_text(node.get("value", 0)))}</block>'
    if op == "compare":
        cmp = _enum(node, "cmp", _COMPARE_OPS, "EQ", path)
        a = _value("A", node.get("a"), f"{path}.a", 0)
        b = _value("B", node.get("b"), f"{path}.b", 0)
        return f'<block type="logic_compare">{_field("OP", cmp)}{a}{b}</block>'
    if op in ("add", "subtract", "multiply", "divide"):
        ops = {"add": "ADD", "subtract": "MINUS", "multiply": "MULTIPLY", "divide": "DIVIDE"}
        a = _value("A", node.get("a"), f"{path}.a", 0)
        b = _value("B", node.get("b"), f"{path}.b", 0)
        return f'<block type="math_arithmetic">{_field("OP", ops[op])}{a}{b}</block>'
    if op == "modulo":
        a = _value("DIVIDEND", node.get("a"), f"{path}.a", 0)
        b = _value("DIVISOR", node.get("b"), f"{path}.b", 1)
        return f'<block type="math_modulo">{a}{b}</block>'
    if op in ("and", "or"):
        a = _value("A", node.get("a"), f"{path}.a", node.get("a"))
        b = _value("B", node.get("b"), f"{path}.b", node.get("b"))
        return f'<block type="logic_operation">{_field("OP", op.upper())}{a}{b}</block>'
    raise BlocklyBuildError(
        f"{path}: unknown expression op '{op}'. Valid: digital_read, analog_read, compare, "
        "and, or, number, millis, add, subtract, multiply, divide, modulo"
    )


# --- field / value helpers ----------------------------------------------------


def _field(name: str, value: str) -> str:
    return f'<field name="{name}">{escape(str(value))}</field>'


def _value(name: str, node: Any, path: str, default: Any = 0) -> str:
    """A <value> slot. Numbers (or numeric strings) become a math_number shadow,
    plain strings a text shadow, and a nested {"op": ...} an expression block."""
    if node is None:
        node = default
    if isinstance(node, dict):
        return f'<value name="{name}">{_expr(node, path)}</value>'
    if isinstance(node, bool):
        raise BlocklyBuildError(f"{path}: '{name}' must be a number, text, or expression, not a boolean")
    if isinstance(node, (int, float)) or _is_number(node):
        return f'<value name="{name}"><shadow type="math_number">{_field("NUM", _num_text(node))}</shadow></value>'
    return f'<value name="{name}"><shadow type="text">{_field("TEXT", str(node))}</shadow></value>'


def _print_value(stmt: dict[str, Any], path: str) -> str:
    """serial_print/println: 'text' forces a string literal; 'value' takes a
    number or expression."""
    if "text" in stmt:
        return f'<value name="VALUE"><shadow type="text">{_field("TEXT", str(stmt["text"]))}</shadow></value>'
    return _value("VALUE", stmt.get("value"), path, "")


def _pin(stmt: dict[str, Any], path: str, key: str = "pin", default: Any = None) -> str:
    raw = stmt.get(key, default)
    if raw is None:
        raise BlocklyBuildError(f"{path}: '{key}' is required")
    pin = str(raw).strip()
    # Forgive a leading D on a digital pin (D13 -> 13); the blocks use bare
    # numbers. Analog pins (A0) keep their letter.
    if len(pin) > 1 and pin[0] in "Dd" and pin[1:].isdigit():
        pin = pin[1:]
    return pin


def _enum(stmt: dict[str, Any], key: str, allowed: set[str], default: str, path: str) -> str:
    raw = stmt.get(key, default)
    value = str(raw).upper()
    if value not in allowed:
        raise BlocklyBuildError(f"{path}: '{key}' must be one of {sorted(allowed)}, got '{raw}'")
    return value


def _is_number(value: Any) -> bool:
    if isinstance(value, (int, float)):
        return True
    try:
        float(str(value))
        return True
    except (TypeError, ValueError):
        return False


def _num_text(value: Any) -> str:
    """Render a number without a trailing .0 for whole values."""
    num = float(value)
    return str(int(num)) if num.is_integer() else str(num)
