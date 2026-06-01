def _parse_sse(body: str) -> list[tuple[str, str]]:
    """Tiny SSE parser sufficient for our event format."""
    events: list[tuple[str, str]] = []
    current_event: str | None = None
    for raw in body.splitlines():
        line = raw.rstrip()
        if not line:
            current_event = None
            continue
        if line.startswith(":"):
            continue
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:") and current_event:
            events.append((current_event, line[len("data:"):].strip()))
    return events


def test_chat_mock_traffic_light_emits_tool_calls(client):
    response = client.post(
        "/api/agent/chat",
        json={"session_id": "s1", "message": "I want a traffic light"},
    )
    assert response.status_code == 200
    events = _parse_sse(response.text)
    event_types = [e[0] for e in events]

    assert event_types[0] == "agent_start"
    assert event_types[-1] == "done"
    assert "agent_text" in event_types
    # Three LEDs + three resistors + nine wires (anode -> resistor, resistor -> pin, cathode -> gnd)
    add_calls = [e for e in events if e[0] == "tool_call" and '"add_component"' in e[1]]
    wire_calls = [e for e in events if e[0] == "tool_call" and '"wire"' in e[1]]
    assert len(add_calls) == 6
    assert len(wire_calls) == 9


def test_chat_mock_default_response_when_no_keyword(client):
    response = client.post(
        "/api/agent/chat",
        json={"session_id": "s2", "message": "hola"},
    )
    assert response.status_code == 200
    events = _parse_sse(response.text)
    texts = [e[1] for e in events if e[0] == "agent_text"]
    assert any("[mock]" in t for t in texts)


def test_chat_persists_session_state_across_turns(client):
    client.post(
        "/api/agent/chat",
        json={"session_id": "s3", "message": "led"},
    )
    response = client.post(
        "/api/agent/chat",
        json={"session_id": "s3", "message": "led"},
    )
    # Second call should bump the LED counter to L2 instead of starting fresh.
    assert response.status_code == 200
    assert '"id": "L2"' in response.text or '"id":"L2"' in response.text
