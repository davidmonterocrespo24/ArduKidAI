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


async def test_list_sources_and_delete_source():
    n = await knowledge.index_plain_text(
        "The Arduino UNO has 14 digital pins and 6 analog inputs.", "Note A"
    )
    sources = await knowledge.list_sources()
    assert any(s["source"] == "Note A" and s["chunks"] == n for s in sources)

    deleted = await knowledge.delete_source("Note A")
    assert deleted == n
    assert await knowledge.list_sources() == []


async def test_index_url_uses_extractor(monkeypatch):
    async def fake_fetch(url: str, *, timeout: float = 30.0):
        return ("Blink Tutorial", "Connect an LED to pin 13 through a 220 ohm resistor.")

    monkeypatch.setattr(knowledge, "fetch_url_text", fake_fetch)

    n = await knowledge.index_url("https://example.com/blink", source="Blink")
    assert n >= 1
    sources = await knowledge.list_sources()
    assert any(
        "Blink" in s["source"] and "https://example.com/blink" in s["source"] for s in sources
    )


def test_knowledge_routes_text_list_delete(client):
    knowledge.memory_reset()

    r = client.post(
        "/api/knowledge/text",
        json={"text": "A servo signal goes to pin 9.", "source": "ServoNote"},
    )
    assert r.status_code == 200
    assert r.json()["chunks"] >= 1

    r = client.get("/api/knowledge")
    assert r.status_code == 200
    assert any(row["source"] == "ServoNote" for row in r.json())

    r = client.request("DELETE", "/api/knowledge/ServoNote")
    assert r.status_code == 200
    assert r.json()["ok"] is True
