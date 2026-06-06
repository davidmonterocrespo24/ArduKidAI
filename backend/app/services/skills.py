"""Skill loading + validation vocabulary for the agent.

The agent's domain knowledge lives in filesystem skills under `backend/skills/`
(SKILL.md per component, loaded by ADK's SkillToolset for dynamic activation).
This module:

- `load_adk_skills()` loads those SKILL.md directories into ADK `Skill` objects.
- `VALID_PINS` / `VALID_BLOCK_TYPES` are the machine-readable allow-lists used by
  the agent tools to VALIDATE wires and blocks and return actionable errors.

Pin/block facts verified against the frontend (WireOverlay alias map, cppGenerator,
arduinoBlocks) on 2026-05-31.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# backend/app/services/skills.py -> parents[2] == backend/
SKILLS_DIR = Path(__file__).resolve().parents[2] / "skills"


def load_adk_skills() -> list[Any]:
    """Load every SKILL.md directory under SKILLS_DIR into ADK Skill objects.

    Returns an empty list (and logs) if the ADK skills API or the directory is
    unavailable, so the agent still starts without skills.
    """
    try:
        from google.adk.skills import load_skill_from_dir
    except Exception as exc:  # pragma: no cover - ADK always present in real mode
        logger.warning("ADK skills API unavailable: %s", exc)
        return []
    if not SKILLS_DIR.is_dir():
        logger.warning("skills dir not found: %s", SKILLS_DIR)
        return []
    skills: list[Any] = []
    for child in sorted(SKILLS_DIR.iterdir()):
        if not child.is_dir() or not (child / "SKILL.md").exists():
            continue
        try:
            skills.append(load_skill_from_dir(child))
        except Exception as exc:
            logger.warning("skipping invalid skill '%s': %s", child.name, exc)
    return skills


# --- Pin allow-list (suffix after the component id) for wire() validation ---

_UNO_PINS = (
    {f"D{n}" for n in range(14)}
    | {str(n) for n in range(14)}  # raw digital forms also render
    | {f"A{n}" for n in range(6)}
    | {"GND", "5V", "3V3", "VIN", "AREF", "IOREF", "RESET"}
    | {"GND.1", "GND.2", "GND.3", "3.3V"}
)

VALID_PINS: dict[str, set[str]] = {
    "uno": _UNO_PINS,
    "led": {"anode", "cathode", "A", "C"},
    "resistor": {"a", "b", "1", "2"},
    "pushbutton": {"1a", "1b", "2a", "2b", "1.l", "1.r", "2.l", "2.r"},
    "buzzer": {"1", "2"},
    "servo": {"PWM", "VCC", "GND", "V+"},
    "potentiometer": {"GND", "SIG", "VCC"},
    "lcd1602": {"GND", "VCC", "SDA", "SCL"},
    "seg7": {"A", "B", "C", "D", "E", "F", "G", "DP", "COM", "DIG1", "DIG2", "DIG3", "DIG4", "CLN"},
}


def valid_pins_for(component_type: str) -> set[str]:
    # Board ids (uno / nano / mega) resolve to their full pin set from the
    # board registry, so each board validates against its own pin count.
    from ..boards import board_ids, valid_board_pins

    if component_type in board_ids():
        return valid_board_pins(component_type)
    return VALID_PINS.get(component_type, set())


# --- Block-type allow-list for set_blocks() validation ---

VALID_BLOCK_TYPES: set[str] = {
    # containers
    "ardukid_setup",
    "ardukid_loop",
    # digital / analog
    "ardukid_pin_mode",
    "ardukid_digital_write",
    "ardukid_analog_write",
    "ardukid_digital_read",
    "ardukid_analog_read",
    # timing
    "ardukid_delay",
    "ardukid_millis",
    # sound
    "ardukid_tone",
    "ardukid_no_tone",
    # lcd
    "ardukid_lcd_begin",
    "ardukid_lcd_clear",
    "ardukid_lcd_set_cursor",
    "ardukid_lcd_print",
    # oled
    "ardukid_oled_begin",
    "ardukid_oled_clear",
    "ardukid_oled_text_size",
    "ardukid_oled_set_cursor",
    "ardukid_oled_print",
    "ardukid_oled_println",
    "ardukid_oled_show",
    # servo
    "ardukid_servo_attach",
    "ardukid_servo_write",
    # serial
    "ardukid_serial_begin",
    "ardukid_serial_print",
    "ardukid_serial_println",
    # sensors
    "ardukid_dht_temperature",
    "ardukid_dht_humidity",
    "ardukid_ultrasonic_cm",
    # math helpers
    "ardukid_map",
    "ardukid_random",
    # standard blockly
    "controls_if",
    "controls_repeat_ext",
    "controls_whileUntil",
    "logic_compare",
    "logic_operation",
    "logic_boolean",
    "math_number",
    "math_arithmetic",
    "math_modulo",
    "math_change",
    "variables_set",
    "variables_get",
    "text",
}
