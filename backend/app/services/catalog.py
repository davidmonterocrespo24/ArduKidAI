"""Static component catalog. Phase 4 moves this into MongoDB so the agent
calls it through the MongoDB MCP server, but the schema stays identical."""

from typing import Any

CATALOG: list[dict[str, Any]] = [
    {
        "type": "uno",
        "label": "Arduino UNO",
        "always_present": True,
        "pins": [
            *(f"D{i}" for i in range(2, 14)),
            "A0", "A1", "A2", "A3", "A4", "A5",
            "5V", "3V3", "GND",
        ],
        "default_props": {},
    },
    {
        "type": "led",
        "label": "LED",
        "pins": ["anode", "cathode"],
        "props_schema": {"color": ["red", "green", "blue", "yellow"]},
        "default_props": {"color": "red"},
        "auto_companions": ["resistor"],
        "wiring_hint": "anode goes through a 220 ohm resistor to a digital pin; cathode to GND.",
    },
    {
        "type": "resistor",
        "label": "Resistor",
        "pins": ["a", "b"],
        "props_schema": {"value": ["220", "330", "1k", "10k"]},
        "default_props": {"value": "220"},
    },
    {
        "type": "pushbutton",
        "label": "Pushbutton",
        "pins": ["1a", "1b", "2a", "2b"],
        "props_schema": {"color": ["red", "green", "blue", "yellow", "black"]},
        "default_props": {"color": "blue"},
        "wiring_hint": "use INPUT_PULLUP and read LOW when pressed.",
    },
    {
        "type": "buzzer",
        "label": "Passive buzzer",
        "pins": ["1", "2"],
        "default_props": {},
        "wiring_hint": "drive with tone() on a digital pin; other leg to GND.",
    },
    {
        "type": "servo",
        "label": "Servo SG90",
        "pins": ["PWM", "VCC", "GND"],
        "default_props": {"angle": 0},
        "wiring_hint": "PWM on any digital pin; VCC to 5V, GND to GND.",
    },
    {
        "type": "potentiometer",
        "label": "Potentiometer",
        "pins": ["GND", "SIG", "VCC"],
        "default_props": {"value": 0},
        "wiring_hint": "SIG to an analog pin (default A0).",
    },
    {
        "type": "lcd1602",
        "label": "LCD 16x2 (I2C)",
        "pins": ["GND", "VCC", "SDA", "SCL"],
        "default_props": {},
        "wiring_hint": "SDA -> A4, SCL -> A5 on Arduino UNO.",
    },
    {
        "type": "seg7",
        "label": "7-segment display",
        "pins": ["A", "B", "C", "D", "E", "F", "G", "DP", "COM"],
        "default_props": {"color": "red"},
    },
]


def list_components() -> list[dict[str, Any]]:
    return list(CATALOG)


def get_component(component_type: str) -> dict[str, Any] | None:
    return next((c for c in CATALOG if c["type"] == component_type), None)
