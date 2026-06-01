import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from ..agent.runner import run_chat
from ..agent.session import get_or_create_session
from ..rate_limit import CHAT_LIMIT, limiter
from ..schemas import ChatRequest

router = APIRouter()


@router.post("/chat")
@limiter.limit(CHAT_LIMIT)
async def chat(request: Request, payload: ChatRequest) -> EventSourceResponse:
    session = get_or_create_session(payload.session_id)
    if payload.circuit_state is not None:
        session.replace_circuit(payload.circuit_state)

    attachments = [a.model_dump() for a in payload.attachments] if payload.attachments else None

    async def event_stream():
        async for event in run_chat(
            session=session, user_message=payload.message, attachments=attachments
        ):
            if await request.is_disconnected():
                return
            yield {"event": event.type, "data": json.dumps(event.data, ensure_ascii=False)}

    return EventSourceResponse(event_stream())
