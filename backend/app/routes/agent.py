import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from ..agent.runner import run_chat
from ..agent.session import get_or_create_session
from ..schemas import ChatRequest

router = APIRouter()


@router.post("/chat")
async def chat(request: Request, payload: ChatRequest) -> EventSourceResponse:
    session = get_or_create_session(payload.session_id)
    if payload.circuit_state is not None:
        session.replace_circuit(payload.circuit_state)

    async def event_stream():
        async for event in run_chat(session=session, user_message=payload.message):
            if await request.is_disconnected():
                return
            yield {"event": event.type, "data": json.dumps(event.data, ensure_ascii=False)}

    return EventSourceResponse(event_stream())
