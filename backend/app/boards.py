"""Board registry (backend mirror of frontend/src/sim/boards.ts).

The agent, pin validation, and the arduino-cli FQBN were originally hard-coded
to the Arduino UNO. This registry parameterizes "which board" so the same tool
surface serves the UNO, Nano (both ATmega328P), and the Mega (ATmega2560)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Board:
    id: str
    label: str
    canvas_id: str  # DOM id + the prefix the agent wires to (e.g. "UNO")
    fqbn: str  # arduino-cli fully-qualified board name
    num_digital: int  # D0 .. D(num_digital-1)
    num_analog: int  # A0 .. A(num_analog-1)


BOARDS: dict[str, Board] = {
    "uno": Board("uno", "Arduino UNO", "UNO", "arduino:avr:uno", 14, 6),
    "nano": Board("nano", "Arduino Nano", "NANO", "arduino:avr:nano:cpu=atmega328", 14, 8),
    "mega": Board("mega", "Arduino Mega 2560", "MEGA", "arduino:avr:mega:cpu=atmega2560", 54, 16),
}

DEFAULT_BOARD = "uno"

_POWER_PINS = {
    "GND", "5V", "3V3", "3.3V", "VIN", "AREF", "IOREF", "RESET",
    "GND.1", "GND.2", "GND.3",
}


def get_board(board_id: str | None) -> Board:
    return BOARDS.get(board_id or DEFAULT_BOARD, BOARDS[DEFAULT_BOARD])


def board_ids() -> set[str]:
    return set(BOARDS)


def canvas_id_to_board(canvas_id: str) -> str | None:
    for b in BOARDS.values():
        if b.canvas_id == canvas_id:
            return b.id
    return None


def valid_board_pins(board_id: str) -> set[str]:
    """Acceptable pin tokens after the board id, e.g. {"D13", "13", "A0", "GND"}."""
    b = get_board(board_id)
    return (
        {f"D{n}" for n in range(b.num_digital)}
        | {str(n) for n in range(b.num_digital)}
        | {f"A{n}" for n in range(b.num_analog)}
        | set(_POWER_PINS)
    )
