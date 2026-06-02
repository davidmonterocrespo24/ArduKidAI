"""Per-session circuit state.

The frontend owns the visible canvas but the backend needs enough state to
assign stable component IDs across multiple tool calls within a turn, and to
validate that wires reference real components. Sessions are held in memory;
phase 4 may persist them alongside saved projects."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import ClassVar

from ..boards import DEFAULT_BOARD
from ..schemas import CircuitState, ComponentInstance, Wire

_ID_RE = re.compile(r"^([A-Za-z]+)(\d+)$")

_PREFIX: dict[str, str] = {
    "uno": "UNO",
    "led": "L",
    "resistor": "R",
    "pushbutton": "B",
    "buzzer": "BZ",
    "servo": "S",
    "potentiometer": "P",
    "lcd1602": "LCD",
    "ssd1306": "OLED",
    "seg7": "SEG",
    "pushbutton6mm": "B",
    "slidePotentiometer": "SP",
    "slideSwitch": "SW",
    "lcd2004": "LCD",
    "dipSwitch8": "DIP",
    "analogJoystick": "JOY",
    "soundSensor": "SND",
    "smallSoundSensor": "SND",
    "flameSensor": "FLM",
    "gasSensor": "GAS",
    "heartBeatSensor": "HBR",
    "rotaryEncoder": "ENC",
    "dht22": "DHT",
    "hcSr04": "US",
    "photoresistor": "LDR",
    "ntcTemperature": "NTC",
    "tiltSwitch": "TILT",
    "pirMotion": "PIR",
    "rgbLed": "RGB",
    "ledBarGraph": "BAR",
}


@dataclass
class SessionState:
    session_id: str
    board: str = DEFAULT_BOARD
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
        # Reset counters so we do not reuse IDs already in the frontend. We
        # require IDs to match the canonical "PREFIX + NUMBER" form (e.g. L1,
        # BZ3) so an exotic id like "LED12V2" cannot poison the counter.
        self._counters = defaultdict(int)
        for cid in self.components:
            match = _ID_RE.match(cid)
            if match is None:
                continue
            prefix, number = match.group(1), int(match.group(2))
            self._counters[prefix] = max(self._counters[prefix], number)

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
