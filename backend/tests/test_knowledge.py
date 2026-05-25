import pytest

from app.services import knowledge
from app.services.pdf_chunker import chunk_plain_text


@pytest.fixture(autouse=True)
def _clean_memory_store():
    knowledge.memory_reset()
    yield
    knowledge.memory_reset()


def test_chunk_plain_text_respects_size_and_overlap():
    long_text = "word " * 600  # 600 words
    chunks = chunk_plain_text(long_text, chunk_words=200, overlap_words=20, page=2)
    assert len(chunks) >= 3
    for ch in chunks:
        assert ch.page == 2
        assert len(ch.text.split()) <= 200


async def test_index_and_search_round_trip():
    await knowledge.index_plain_text(
        "An Arduino servo is wired to a digital pin. Use the Servo library and call servo.attach.",
        source="servo-guide",
    )
    await knowledge.index_plain_text(
        "Buzzer projects use tone(pin, frequency) to play a note for a duration.",
        source="buzzer-guide",
    )
    hits = await knowledge.search_docs("how do I attach a servo", limit=3)
    assert hits, "expected at least one hit"
    assert any("servo" in h.text.lower() for h in hits)
    assert hits[0].source in {"servo-guide", "buzzer-guide"}


async def test_search_with_empty_query_returns_empty():
    await knowledge.index_plain_text("anything", source="x")
    hits = await knowledge.search_docs("", limit=3)
    assert hits == []


async def test_search_docs_agent_tool_via_dispatch():
    from app.agent.session import SessionState
    from app.agent.tools import TOOLS, dispatch

    assert "search_docs" in TOOLS
    await knowledge.index_plain_text(
        "Resistors come in many values; for an LED on 5V use a 220 ohm resistor.",
        source="resistor-faq",
    )
    session = SessionState(session_id="t")
    result = await dispatch("search_docs", session, {"query": "resistor for LED", "limit": 2})
    assert result["ok"] is True
    assert len(result["hits"]) <= 2
    assert any("resistor" in hit["text"].lower() for hit in result["hits"])
