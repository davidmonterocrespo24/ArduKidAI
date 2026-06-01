import json
import re
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from ..agent.mongo_session_service import get_session_service
from ..agent.runner import run_chat
from ..agent.session import get_or_create_session
from ..auth.deps import current_user_optional
from ..auth.users import UserRecord
from ..rate_limit import CHAT_LIMIT, limiter
from ..schemas import ChatRequest

router = APIRouter()

APP_NAME = "ardukid"

CurrentUser = Annotated[UserRecord | None, Depends(current_user_optional)]

_BOARD_NOTE_RE = re.compile(r"^\[Canvas board:.*?\]\n\n", re.DOTALL)


def _json_default(o: Any) -> Any:
    """Make SSE payloads encodable even when a built-in tool (e.g. load_memory)
    returns nested pydantic objects."""
    if hasattr(o, "model_dump"):
        return o.model_dump(mode="json")
    return str(o)


def resolve_user_id(user: UserRecord | None, client_id: str | None, session_id: str) -> str:
    """The ADK user_id: the signed-in user, or a stable per-browser guest id."""
    if user is not None:
        return user.id
    return f"guest:{client_id or session_id}"


@router.post("/chat")
@limiter.limit(CHAT_LIMIT)
async def chat(request: Request, payload: ChatRequest, user: CurrentUser) -> EventSourceResponse:
    session = get_or_create_session(payload.session_id)
    session.board = payload.board
    if payload.circuit_state is not None:
        session.replace_circuit(payload.circuit_state)
    attachments = [a.model_dump() for a in payload.attachments] if payload.attachments else None
    user_id = resolve_user_id(user, payload.client_id, payload.session_id)

    async def event_stream():
        async for event in run_chat(
            session=session,
            user_message=payload.message,
            attachments=attachments,
            user_id=user_id,
        ):
            if await request.is_disconnected():
                return
            yield {
                "event": event.type,
                "data": json.dumps(event.data, ensure_ascii=False, default=_json_default),
            }

    return EventSourceResponse(event_stream())


def _events_to_messages(events: list[Any]) -> list[dict[str, Any]]:
    """Reconstruct a chat transcript from ADK events (text only; tool-call and
    tool-result events are skipped)."""
    out: list[dict[str, Any]] = []
    for e in events:
        content = getattr(e, "content", None)
        if not content or not content.parts:
            continue
        text = "".join(p.text or "" for p in content.parts).strip()
        if not text:
            continue
        role = "user" if getattr(e, "author", "") == "user" else "agent"
        if role == "user":
            text = _BOARD_NOTE_RE.sub("", text)  # hide the internal board-context note
        out.append({"id": getattr(e, "id", None) or uuid.uuid4().hex, "role": role, "text": text})
    return out


@router.get("/sessions")
async def list_chat_sessions(user: CurrentUser, client_id: str | None = None) -> list[dict[str, Any]]:
    uid = resolve_user_id(user, client_id, client_id or "anon")
    resp = await get_session_service().list_sessions(app_name=APP_NAME, user_id=uid)
    return [
        {
            "id": s.id,
            "title": (s.state or {}).get("title") or "Untitled chat",
            "updated_at": s.last_update_time,
        }
        for s in resp.sessions
    ]


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str, user: CurrentUser, client_id: str | None = None
) -> dict[str, Any]:
    uid = resolve_user_id(user, client_id, session_id)
    sess = await get_session_service().get_session(
        app_name=APP_NAME, user_id=uid, session_id=session_id
    )
    if sess is None:
        return {"id": session_id, "messages": []}
    return {
        "id": session_id,
        "title": (sess.state or {}).get("title") or "Untitled chat",
        "messages": _events_to_messages(sess.events),
    }


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str, user: CurrentUser, client_id: str | None = None
) -> dict[str, Any]:
    uid = resolve_user_id(user, client_id, session_id)
    await get_session_service().delete_session(app_name=APP_NAME, user_id=uid, session_id=session_id)
    return {"ok": True}
