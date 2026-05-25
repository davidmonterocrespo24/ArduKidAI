async def test_search_examples_returns_top_hit_for_traffic_light(client):
    response = client.get("/api/examples/search", params={"q": "semaforo 3 LEDs", "limit": 3})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    titles = [hit["title"] for hit in body]
    assert any("traffic" in t.lower() for t in titles)


async def test_search_examples_relevance_ordering(client):
    response = client.get(
        "/api/examples/search",
        params={"q": "potentiometer servo motor angle", "limit": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body, "expected at least one hit"
    # Scores must monotonically decrease.
    scores = [hit["score"] for hit in body]
    assert scores == sorted(scores, reverse=True)


async def test_search_examples_empty_query_returns_seed_gallery(client):
    # Empty query is the "open the modal" case - we now surface the seeded
    # examples sorted by difficulty so the modal has content immediately.
    response = client.get("/api/examples/search", params={"q": "", "limit": 6})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 6
    # Every hit must carry the standard fields the frontend ExamplesModal renders.
    for hit in body:
        assert hit["id"]
        assert hit["title"]
        assert hit["intent"]
