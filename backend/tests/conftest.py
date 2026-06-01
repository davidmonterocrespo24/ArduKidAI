import os

import pytest

os.environ.setdefault("ARDUKID_AGENT_MODE", "mock")
os.environ.setdefault("ARDUKID_CORS_ORIGINS", "http://localhost:5173")
# Keep the suite hermetic regardless of a developer's local backend/.env:
# no cloud project (-> deterministic fake embeddings), no Atlas (-> in-memory
# stores), no MCP sidecar. setdefault still lets CI opt into real services.
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "")
os.environ.setdefault("MONGODB_URI", "")
os.environ.setdefault("MCP_ENABLED", "false")


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
