import numpy as np

from app.services.embeddings import EMBEDDING_DIMS, _fake_embedding, cosine, embed_text


def test_fake_embedding_length_and_norm():
    vec = _fake_embedding("hello world")
    assert len(vec) == EMBEDDING_DIMS
    norm = float(np.linalg.norm(np.asarray(vec)))
    assert abs(norm - 1.0) < 1e-5


def test_fake_embedding_is_deterministic():
    a = _fake_embedding("traffic light with three LEDs")
    b = _fake_embedding("traffic light with three LEDs")
    assert a == b


def test_fake_embedding_separates_unrelated_phrases():
    a = _fake_embedding("traffic light with three LEDs")
    b = _fake_embedding("a buzzer that plays a melody on Tuesday afternoon hike")
    sim = cosine(a, b)
    assert sim < 0.6


def test_fake_embedding_relates_similar_phrases():
    a = _fake_embedding("blink an LED on pin 13")
    b = _fake_embedding("blink LED pin 13 once per second")
    sim = cosine(a, b)
    assert sim > 0.5


async def test_embed_text_uses_fallback_without_creds():
    vec = await embed_text("anything")
    assert len(vec) == EMBEDDING_DIMS
