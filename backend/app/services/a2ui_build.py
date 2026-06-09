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

from typing import Any

# Must match TUTOR_CATALOG_ID in frontend/src/a2ui/catalog.tsx.
TUTOR_CATALOG_ID = "https://ardukid.app/catalogs/tutor/v1"
A2UI_VERSION = "v0.9"
SURFACE_ID = "tutor"

VALID_CARD_KINDS = ("lesson", "steps", "diagram", "quiz")


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

    @property
    def components(self) -> list[dict[str, Any]]:
        return self._components


def _require_str(card: dict[str, Any], key: str, kind: str) -> str:
    value = card.get(key)
    if not isinstance(value, str) or not value.strip():
        raise A2uiBuildError(f"{kind} card needs a non-empty '{key}' string")
    return value


def _lesson_card(b: _ComponentBuilder, card: dict[str, Any]) -> str:
    body = _require_str(card, "body", "lesson")
    title = card.get("title")
    children: list[str] = []
    if isinstance(title, str) and title.strip():
        children.append(b.text(f"### {title.strip()}"))
    children.append(b.text(body))
    return b.card(b.column(children))


def _steps_card(b: _ComponentBuilder, card: dict[str, Any]) -> str:
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


def _diagram_card(b: _ComponentBuilder, card: dict[str, Any]) -> str:
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


def _quiz_card(b: _ComponentBuilder, card: dict[str, Any]) -> str:
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


_CARD_BUILDERS = {
    "lesson": _lesson_card,
    "steps": _steps_card,
    "diagram": _diagram_card,
    "quiz": _quiz_card,
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
        root_children.append(builder(b, card))

    # The React renderer mounts the component whose id is exactly "root", so the
    # top-level container must use that id (other components resolve by id and
    # may appear in any order).
    b.add_with_id("root", "Column", children=root_children)
    components = b.components

    return [
        {
            "version": A2UI_VERSION,
            "createSurface": {"surfaceId": SURFACE_ID, "catalogId": TUTOR_CATALOG_ID},
        },
        {
            "version": A2UI_VERSION,
            "updateComponents": {"surfaceId": SURFACE_ID, "components": components},
        },
    ]
