import os

import pytest

os.environ.setdefault("ARDUKID_AGENT_MODE", "mock")
os.environ.setdefault("ARDUKID_CORS_ORIGINS", "http://localhost:5173")


@pytest.fixture(autouse=True)
def _reset_state():
    """Clear per-process stores so tests do not bleed into each other."""
    from app.agent import session as session_mod
    from app.services import projects_store

    session_mod.reset_all()
    projects_store.clear()
    yield
    session_mod.reset_all()
    projects_store.clear()


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
