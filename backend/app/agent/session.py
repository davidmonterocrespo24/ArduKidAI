"""Per-session circuit state.

The frontend owns the visible canvas but the backend needs enough state to
assign stable component IDs across multiple tool calls within a turn, and to
validate that wires reference real components. Sessions are held in memory;
phase 4 may persist them alongside saved projects."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import ClassVar

from ..schemas import CircuitState, ComponentInstance, Wire

_PREFIX: dict[str, str] = {
    "uno": "UNO",
    "led": "L",
    "resistor": "R",
    "pushbutton": "B",
    "buzzer": "BZ",
    "servo": "S",
    "potentiometer": "P",
    "lcd1602": "LCD",
    "seg7": "SEG",
}


@dataclass
class SessionState:
    session_id: str
    components: dict[str, ComponentInstance] = field(default_factory=dict)
    wires: list[Wire] = field(default_factory=list)
    blockly_xml: str = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>'
    cpp_code: str = ""
    _counters: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    _PREFIX: ClassVar[dict[str, str]] = _PREFIX

    def next_component_id(self, component_type: str) -> str:
        prefix = self._PREFIX.get(component_type, component_type.upper()[:3])
        self._counters[prefix] += 1
        return f"{prefix}{self._counters[prefix]}"

    def replace_circuit(self, state: CircuitState) -> None:
        self.components = {c.id: c for c in state.components}
        self.wires = list(state.wires)
        self.blockly_xml = state.blockly_xml
        self.cpp_code = state.cpp_code
        # Reset counters so we do not reuse IDs already in the frontend.
        self._counters = defaultdict(int)
        for cid in self.components:
            prefix = "".join(ch for ch in cid if ch.isalpha())
            number = "".join(ch for ch in cid if ch.isdigit())
            if prefix and number.isdigit():
                self._counters[prefix] = max(self._counters[prefix], int(number))

    def to_circuit(self) -> CircuitState:
        return CircuitState(
            components=list(self.components.values()),
            wires=list(self.wires),
            blockly_xml=self.blockly_xml,
            cpp_code=self.cpp_code,
        )


_SESSIONS: dict[str, SessionState] = {}


def get_or_create_session(session_id: str) -> SessionState:
    if session_id not in _SESSIONS:
        _SESSIONS[session_id] = SessionState(session_id=session_id)
    return _SESSIONS[session_id]


def drop_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)


def reset_all() -> None:
    """Test helper."""
    _SESSIONS.clear()
