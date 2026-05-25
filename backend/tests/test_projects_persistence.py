from app.schemas import CircuitState, ComponentInstance


async def test_save_and_list_round_trip(client):
    circuit = CircuitState(
        components=[ComponentInstance(id="L1", type="led", x=0, y=0, props={"color": "red"})],
        wires=[],
        blockly_xml="<xml/>",
        cpp_code="void setup(){} void loop(){}",
    )
    save_res = client.post(
        "/api/projects",
        json={"name": "my-blink", "circuit": circuit.model_dump()},
    )
    assert save_res.status_code == 200
    saved = save_res.json()
    assert saved["name"] == "my-blink"
    assert saved["id"]

    list_res = client.get("/api/projects")
    assert list_res.status_code == 200
    summaries = list_res.json()
    assert any(item["id"] == saved["id"] and item["name"] == "my-blink" for item in summaries)

    detail_res = client.get(f"/api/projects/{saved['id']}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["circuit"]["components"][0]["id"] == "L1"


def test_get_nonexistent_project_returns_404(client):
    res = client.get("/api/projects/does-not-exist")
    assert res.status_code == 404


async def test_load_project_tool_replaces_session_circuit(client):
    """The agent's load_project tool round-trips a saved circuit back into the session."""
    from app.agent.session import SessionState
    from app.agent.tools import dispatch

    save_session = SessionState(session_id="seed")
    await dispatch("add_component", save_session, {"type": "led"})
    await dispatch("add_component", save_session, {"type": "buzzer"})
    saved = await dispatch("save_project", save_session, {"name": "led-and-buzzer"})
    assert saved["ok"]
    project_id = saved["project"]["id"]

    fresh = SessionState(session_id="other")
    load_result = await dispatch("load_project", fresh, {"project_id": project_id})
    assert load_result["ok"]
    assert "L1" in fresh.components
    assert "BZ1" in fresh.components
