import pytest

from app.services import knowledge, knowledge_files
from app.services.pdf_chunker import chunk_plain_text


@pytest.fixture(autouse=True)
def _clean_memory_store():
    knowledge.memory_reset()
    knowledge_files.memory_reset()
    yield
    knowledge.memory_reset()
    knowledge_files.memory_reset()


async def test_store_serve_and_classify_original_file():
    # An uploaded image keeps its original bytes (for preview) and is classified.
    await knowledge.index_image(b"\x89PNG-not-real", mime_type="image/png", source="diagram.png")
    stored = await knowledge_files.get_file("diagram.png")
    assert stored is not None and stored[0] == "image/png"

    row = next(s for s in await knowledge.list_sources() if s["source"] == "diagram.png")
    assert row["kind"] == "image"
    assert row["content_type"] == "image/png"

    # Deleting the source removes the stored original too.
    await knowledge.delete_source("diagram.png")
    assert await knowledge_files.get_file("diagram.png") is None


async def test_get_source_text_reassembles_a_note():
    await knowledge.index_plain_text(
        "Pull-up resistors hold an input pin HIGH so a button reads cleanly.", source="Note: pull-ups"
    )
    text = await knowledge.get_source_text("Note: pull-ups")
    assert "Pull-up resistors" in text


def test_classify_marks_links_clickable():
    # A source whose label carries a URL (and has no stored file) is a clickable link.
    row = knowledge._classify("SparkFun: LEDs (https://learn.sparkfun.com/tutorials/leds/all)", {})
    assert row["kind"] == "link"
    assert row["url"] == "https://learn.sparkfun.com/tutorials/leds/all"


def test_classify_text_file_stays_text_not_document():
    row = knowledge._classify("My note", {"My note": "text/markdown"})
    assert row["kind"] == "text"


async def test_plain_text_preview_keeps_markdown_structure():
    md = "## Title\n\nA paragraph.\n\n- item one\n- item two"
    await knowledge.index_plain_text(md, source="Lesson X")
    # The preview returns the original (with newlines), not the normalised chunks.
    assert await knowledge.get_source_text("Lesson X") == md


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


def test_terms_drops_stopwords_keeps_pins_and_parts():
    terms = knowledge._terms("How do I wire the HC-SR04 to pin D13?")
    assert "d13" in terms  # token with a digit is kept even though short
    assert "sr04" in terms
    assert "wire" in terms
    assert "the" not in terms and "how" not in terms  # stopwords dropped


def test_rrf_fuse_prefers_docs_ranked_by_both_arms():
    a = knowledge.KnowledgeHit(id="a", source="", page=0, text="")
    b = knowledge.KnowledgeHit(id="b", source="", page=0, text="")
    c = knowledge.KnowledgeHit(id="c", source="", page=0, text="")
    fused = knowledge._rrf_fuse([a, b], [b, c], limit=3)
    assert fused[0].id == "b"  # appears in both lists -> highest fused score
    assert {h.id for h in fused} == {"a", "b", "c"}


async def test_hybrid_search_surfaces_exact_token_via_keyword_arm():
    await knowledge.index_plain_text(
        "The HC-SR04 ultrasonic sensor measures distance with echo pulses.", source="ultrasonic"
    )
    await knowledge.index_plain_text(
        "A potentiometer is a knob that changes resistance.", source="pot"
    )
    hits = await knowledge.search_docs("HC-SR04", limit=2)
    assert any(h.source == "ultrasonic" for h in hits)


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
