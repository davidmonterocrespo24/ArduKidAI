import pytest

from app.services.a2ui_build import (
    SURFACE_ID,
    TUTOR_CATALOG_ID,
    A2uiBuildError,
    build_tutor_panel,
)


def _components(messages):
    update = next(m for m in messages if "updateComponents" in m)
    return update["updateComponents"]["components"]


def _by_id(components):
    return {c["id"]: c for c in components}


def test_build_panel_emits_create_then_update_with_root():
    messages = build_tutor_panel(
        "Traffic Light",
        [{"kind": "lesson", "title": "How it blinks", "body": "A **LED** turns on and off."}],
    )
    assert messages[0]["version"] == "v0.9"
    create = messages[0]["createSurface"]
    assert create["surfaceId"] == SURFACE_ID
    assert create["catalogId"] == TUTOR_CATALOG_ID

    components = _components(messages)
    by_id = _by_id(components)
    # The React renderer mounts the component with id "root".
    assert "root" in by_id
    assert by_id["root"]["component"] == "Column"
    # Every child referenced by the root resolves to a real component.
    for child in by_id["root"]["children"]:
        assert child in by_id


def test_quiz_card_maps_to_quizcard_component():
    messages = build_tutor_panel(
        None,
        [
            {
                "kind": "quiz",
                "question": "Which pin lights the LED?",
                "options": ["D13", "GND", "5V"],
                "answer_index": 0,
                "explanation": "We wired the LED to D13.",
            }
        ],
    )
    components = _components(messages)
    quiz = next(c for c in components if c["component"] == "QuizCard")
    assert quiz["question"] == "Which pin lights the LED?"
    assert quiz["options"] == ["D13", "GND", "5V"]
    assert quiz["answerIndex"] == 0
    assert quiz["explanation"] == "We wired the LED to D13."


def test_diagram_card_carries_highlight_pins():
    messages = build_tutor_panel(
        None,
        [{"kind": "diagram", "caption": "The LED pin", "highlight_pins": ["13", "gnd"]}],
    )
    components = _components(messages)
    board = next(c for c in components if c["component"] == "CircuitBoard")
    # Pins are passed through verbatim; the frontend normalises "13" -> "D13".
    assert board["highlightPins"] == ["13", "gnd"]
    assert board["caption"] == "The LED pin"


def test_parts_card_renders_each_component_as_circuitpart():
    messages = build_tutor_panel(
        None,
        [
            {
                "kind": "parts",
                "title": "Meet your parts",
                "parts": [
                    {"type": "led", "label": "LED", "color": "red"},
                    {"type": "resistor", "label": "Resistor"},
                ],
            }
        ],
    )
    components = _components(messages)
    parts = [c for c in components if c["component"] == "CircuitPart"]
    assert {p["part"] for p in parts} == {"led", "resistor"}
    led = next(p for p in parts if p["part"] == "led")
    assert led["label"] == "LED" and led["color"] == "red"


def test_tryit_card_emits_slider_bound_to_seeded_data_model():
    messages = build_tutor_panel(
        None,
        [{"kind": "tryit", "label": "Delay", "min": 100, "max": 2000, "step": 100, "start": 500, "unit": "ms"}],
    )
    components = _components(messages)
    slider = next(c for c in components if c["component"] == "Slider")
    assert slider["min"] == 100 and slider["max"] == 2000 and slider["step"] == 100
    # The slider value is a path binding, and the data model seeds that path.
    path = slider["value"]["path"]
    data_msg = next(m for m in messages if "updateDataModel" in m)
    seeded = data_msg["updateDataModel"]["value"]
    assert seeded[path.lstrip("/")] == 500


def test_checklist_card_builds_wiring_checklist_with_items():
    messages = build_tutor_panel(
        None,
        [{"kind": "checklist", "title": "Wire it", "items": ["pin 13 to resistor", "LED to GND"]}],
    )
    components = _components(messages)
    cl = next(c for c in components if c["component"] == "WiringChecklist")
    assert cl["items"] == ["pin 13 to resistor", "LED to GND"]
    assert cl["title"] == "Wire it"


def test_checklist_rejects_empty_items():
    with pytest.raises(A2uiBuildError):
        build_tutor_panel(None, [{"kind": "checklist", "items": []}])


def test_tryit_rejects_bad_range():
    with pytest.raises(A2uiBuildError):
        build_tutor_panel(None, [{"kind": "tryit", "label": "x", "min": 10, "max": 5}])


def test_steps_card_builds_a_numbered_markdown_list():
    messages = build_tutor_panel(None, [{"kind": "steps", "steps": ["Wire it", "Run it"]}])
    components = _components(messages)
    texts = [c["text"] for c in components if c["component"] == "Text"]
    assert any("1. Wire it" in t and "2. Run it" in t for t in texts)


@pytest.mark.parametrize(
    "cards",
    [
        [],
        [{"kind": "mystery"}],
        [{"kind": "quiz", "question": "q", "options": ["only one"], "answer_index": 0}],
        [{"kind": "quiz", "question": "q", "options": ["a", "b"], "answer_index": 5}],
        [{"kind": "lesson"}],
    ],
)
def test_malformed_cards_raise(cards):
    with pytest.raises(A2uiBuildError):
        build_tutor_panel(None, cards)


async def test_show_tutor_panel_tool_via_dispatch():
    from app.agent.session import SessionState
    from app.agent.tools import TOOLS, dispatch

    assert "show_tutor_panel" in TOOLS
    session = SessionState(session_id="t")
    result = await dispatch(
        "show_tutor_panel",
        session,
        {
            "title": "LEDs",
            "cards": [
                {"kind": "lesson", "body": "An LED needs a resistor."},
                {"kind": "diagram", "highlight_pins": ["D13", "GND"]},
            ],
        },
    )
    assert result["ok"] is True
    assert result["surface_id"] == SURFACE_ID
    assert isinstance(result["a2ui"], list) and len(result["a2ui"]) == 2


async def test_show_tutor_panel_tool_reports_bad_card():
    from app.agent.session import SessionState
    from app.agent.tools import dispatch

    session = SessionState(session_id="t")
    result = await dispatch("show_tutor_panel", session, {"cards": [{"kind": "nope"}]})
    assert result["ok"] is False
    assert "unknown kind" in result["error"]
