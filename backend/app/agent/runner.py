"""Agent loop. Yields SSE-friendly events that the route turns into wire format.

The choice between the real Gemini client and the mock is made via settings,
so curl tests work locally without GCP credentials."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from ..config import get_settings
from .session import SessionState


@dataclass
class SSEEvent:
    type: str
    data: dict[str, Any]


async def run_chat(
    *,
    session: SessionState,
    user_message: str,
    attachments: list[dict[str, Any]] | None = None,
) -> AsyncIterator[SSEEvent]:
    settings = get_settings()
    yield SSEEvent(type="agent_start", data={"session_id": session.session_id})

    try:
        if settings.agent_mode == "real":
            from .adk_client import get_adk_client

            client = get_adk_client()
        else:
            from .mock_client import MockAgentClient

            client = MockAgentClient()

        async for event in client.chat(
            session=session, user_message=user_message, attachments=attachments
        ):
            yield event
    except Exception as exc:
        yield SSEEvent(type="error", data={"message": f"{type(exc).__name__}: {exc}"})
    finally:
        yield SSEEvent(type="done", data={})
