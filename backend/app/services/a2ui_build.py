"""Deterministic builder for A2UI tutor panels.

A2UI (github.com/a2ui-project/a2ui) is an open standard that lets an agent
"speak UI": it sends a declarative JSON description of a panel and the client
renders it with its OWN trusted component catalog. We follow the v0.9 wire
format - a `createSurface` message followed by an `updateComponents` message
that lists a flat set of components referenced by id.

Just like `blockly_build`, we build this JSON deterministically from a small,
flat description the agent passes (a list of typed "cards") rather than asking
the model to emit raw, deeply nested A2UI by hand. That keeps every panel
well-formed on the first try and confines the agent to the components our
frontend catalog actually implements:

  - basic catalog: Card, Column, Text (Markdown), Image, ...
  - ArduKid custom: CircuitBoard (a lit-up UNO), QuizCard (graded MCQ)

The catalog id and component names here must match `frontend/src/a2ui/catalog.tsx`.
"""

from __future__ import annotations

import contextlib
from typing import Any

# Must match TUTOR_CATALOG_ID in frontend/src/a2ui/catalog.tsx.
TUTOR_CATALOG_ID = "https://ardukid.app/catalogs/tutor/v1"
A2UI_VERSION = "v0.9"
SURFACE_ID = "tutor"

VALID_CARD_KINDS = ("lesson", "steps", "diagram", "parts", "quiz", "tryit")


class A2uiBuildError(ValueError):
    """Raised when a tutor card description is malformed."""


class _ComponentBuilder:
    """Accumulates A2UI components, handing out unique ids."""

    def __init__(self) -> None:
        self._components: list[dict[str, Any]] = []
        self._counter = 0

    def add(self, component: str, **props: Any) -> str:
        cid = f"c{self._counter}"
        self._counter += 1
        return self.add_with_id(cid, component, **props)

    def add_with_id(self, cid: str, component: str, **props: Any) -> str:
        self._components.append({"id": cid, "component": component, **props})
        return cid

    def text(self, markdown: str) -> str:
        return self.add("Text", text=markdown)

    def card(self, child_id: str) -> str:
        return self.add("Card", child=child_id)

    def column(self, child_ids: list[str]) -> str:
        return self.add("Column", children=child_ids)

    def row(self, child_ids: list[str]) -> str:
        return self.add("Row", children=child_ids)

    @property
    def components(self) -> list[dict[str, Any]]:
        return self._components


def _require_str(card: dict[str, Any], key: str, kind: str) -> str:
    value = card.get(key)
    if not isinstance(value, str) or not value.strip():
        raise A2uiBuildError(f"{kind} card needs a non-empty '{key}' string")
    return value


def _num(value: float) -> float | int:
    """Keep whole numbers as ints so a readout shows "500", not "500.0"."""
    f = float(value)
    return int(f) if f.is_integer() else f


def _lesson_card(b: _ComponentBuilder, card: dict[str, Any], data: dict[str, Any], idx: int) -> str:
    del data, idx
    body = _require_str(card, "body", "lesson")
    title = card.get("title")
    children: list[str] = []
    if isinstance(title, str) and title.strip():
        children.append(b.text(f"### {title.strip()}"))
    children.append(b.text(body))
    return b.card(b.column(children))


def _steps_card(b: _ComponentBuilder, card: dict[str, Any], data: dict[str, Any], idx: int) -> str:
    del data, idx
    steps = card.get("steps")
    if not isinstance(steps, list) or not steps:
        raise A2uiBuildError("steps card needs a non-empty 'steps' list of strings")
    lines = [str(s).strip() for s in steps if str(s).strip()]
    if not lines:
        raise A2uiBuildError("steps card needs at least one non-empty step")
    children: list[str] = []
    title = card.get("title")
    if isinstance(title, str) and title.strip():
        children.append(b.text(f"### {title.strip()}"))
    numbered = "\n".join(f"{i}. {line}" for i, line in enumerate(lines, start=1))
    children.append(b.text(numbered))
    return b.card(b.column(children))


def _diagram_card(b: _ComponentBuilder, card: dict[str, Any], data: dict[str, Any], idx: int) -> str:
    del data, idx
    pins = card.get("highlight_pins", [])
    if pins is None:
        pins = []
    if not isinstance(pins, list):
        raise A2uiBuildError("diagram card 'highlight_pins' must be a list of pin names")
    highlight = [str(p) for p in pins if str(p).strip()]
    props: dict[str, Any] = {"highlightPins": highlight}
    caption = card.get("caption")
    if isinstance(caption, str) and caption.strip():
        props["caption"] = caption.strip()
    board = card.get("board")
    if isinstance(board, str) and board.strip():
        props["board"] = board.strip()
    inner = b.add("CircuitBoard", **props)
    return b.card(inner)


def _parts_card(b: _ComponentBuilder, card: dict[str, Any], data: dict[str, Any], idx: int) -> str:
    """A gallery of real components, each drawn with its genuine wokwi SVG."""
    del data, idx
    parts = card.get("parts")
    if not isinstance(parts, list) or not parts:
        raise A2uiBuildError("parts card needs a non-empty 'parts' list")
    children: list[str] = []
    title = card.get("title")
    if isinstance(title, str) and title.strip():
        children.append(b.text(f"### {title.strip()}"))
    for i, part in enumerate(parts):
        if not isinstance(part, dict) or not part.get("type"):
            raise A2uiBuildError(f"parts card item #{i} needs a 'type' (e.g. 'led', 'resistor')")
        part_props: dict[str, Any] = {"part": str(part["type"])}
        for key in ("label", "caption", "color", "text"):
            val = part.get(key)
            if isinstance(val, str) and val.strip():
                part_props[key] = val.strip()
        children.append(b.card(b.add("CircuitPart", **part_props)))
    return b.column(children)


def _quiz_card(b: _ComponentBuilder, card: dict[str, Any], data: dict[str, Any], idx: int) -> str:
    del data, idx
    question = _require_str(card, "question", "quiz")
    options = card.get("options")
    if not isinstance(options, list) or len(options) < 2:
        raise A2uiBuildError("quiz card needs an 'options' list with at least 2 choices")
    opts = [str(o) for o in options]
    answer_index = card.get("answer_index")
    if not isinstance(answer_index, int) or isinstance(answer_index, bool):
        raise A2uiBuildError("quiz card needs an integer 'answer_index'")
    if not 0 <= answer_index < len(opts):
        raise A2uiBuildError(
            f"quiz 'answer_index' {answer_index} is out of range for {len(opts)} options"
        )
    props: dict[str, Any] = {
        "question": question,
        "options": opts,
        "answerIndex": answer_index,
    }
    explanation = card.get("explanation")
    if isinstance(explanation, str) and explanation.strip():
        props["explanation"] = explanation.strip()
    return b.add("QuizCard", **props)


def _tryit_card(b: _ComponentBuilder, card: dict[str, Any], data: dict[str, Any], idx: int) -> str:
    """A live 'what if I change this?' slider. The readout updates instantly via
    A2UI two-way data binding - no round-trip to the agent."""
    label = card.get("label")
    if not isinstance(label, str) or not label.strip():
        label = "Value"
    try:
        mn = float(card.get("min", 0))
        mx = float(card.get("max", 100))
    except (TypeError, ValueError) as exc:
        raise A2uiBuildError("tryit card needs numeric 'min' and 'max'") from exc
    if mx <= mn:
        raise A2uiBuildError("tryit 'max' must be greater than 'min'")
    try:
        start = float(card.get("start", mn))
    except (TypeError, ValueError):
        start = mn
    start = max(mn, min(mx, start))

    path_key = f"tryit{idx}"
    data[path_key] = _num(start)

    children: list[str] = []
    prompt = card.get("prompt") or card.get("title")
    if isinstance(prompt, str) and prompt.strip():
        children.append(b.text(prompt.strip()))

    slider_props: dict[str, Any] = {
        "label": label.strip(),
        "min": _num(mn),
        "max": _num(mx),
        "value": {"path": f"/{path_key}"},
    }
    step = card.get("step")
    if step is not None:
        with contextlib.suppress(TypeError, ValueError):
            slider_props["step"] = _num(float(step))
    children.append(b.add("Slider", **slider_props))

    readout = [b.text(f"{label.strip()}: "), b.add("Text", text={"path": f"/{path_key}"})]
    unit = card.get("unit")
    if isinstance(unit, str) and unit.strip():
        readout.append(b.text(f" {unit.strip()}"))
    children.append(b.row(readout))

    return b.card(b.column(children))


_CARD_BUILDERS = {
    "lesson": _lesson_card,
    "steps": _steps_card,
    "diagram": _diagram_card,
    "parts": _parts_card,
    "quiz": _quiz_card,
    "tryit": _tryit_card,
}


def build_tutor_panel(title: str | None, cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return the A2UI v0.9 messages for a tutor panel.

    `cards` is a flat list; each item has a `kind` in VALID_CARD_KINDS plus the
    fields that kind needs. Raises A2uiBuildError on malformed input so the agent
    gets an actionable message and can retry.
    """
    if not isinstance(cards, list) or not cards:
        raise A2uiBuildError("a tutor panel needs at least one card")

    b = _ComponentBuilder()
    data: dict[str, Any] = {}
    root_children: list[str] = []
    if isinstance(title, str) and title.strip():
        root_children.append(b.text(f"## {title.strip()}"))

    for idx, card in enumerate(cards):
        if not isinstance(card, dict):
            raise A2uiBuildError(f"card #{idx} must be an object with a 'kind'")
        kind = card.get("kind")
        builder = _CARD_BUILDERS.get(str(kind))
        if builder is None:
            raise A2uiBuildError(
                f"card #{idx} has unknown kind '{kind}'. Use one of {VALID_CARD_KINDS}."
            )
        root_children.append(builder(b, card, data, idx))

    # The React renderer mounts the component whose id is exactly "root", so the
    # top-level container must use that id (other components resolve by id and
    # may appear in any order).
    b.add_with_id("root", "Column", children=root_children)
    components = b.components

    messages: list[dict[str, Any]] = [
        {
            "version": A2UI_VERSION,
            "createSurface": {"surfaceId": SURFACE_ID, "catalogId": TUTOR_CATALOG_ID},
        },
        {
            "version": A2UI_VERSION,
            "updateComponents": {"surfaceId": SURFACE_ID, "components": components},
        },
    ]
    # Seed the data model for any interactive cards (e.g. tryit sliders), so their
    # bound readouts show a value immediately.
    if data:
        messages.append(
            {
                "version": A2UI_VERSION,
                "updateDataModel": {"surfaceId": SURFACE_ID, "path": "/", "value": data},
            }
        )
    return messages
