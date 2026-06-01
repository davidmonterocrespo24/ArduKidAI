"""Real Vertex AI Gemini client used when ARDUKID_AGENT_MODE=real.

The function-calling primitives below are the same ones that Google Cloud
Agent Builder exposes; once this loop is stable we can lift the agent to a
managed Agent Builder Reasoning Engine in phase 5 with no contract change."""

from __future__ import annotations

from collections.abc import AsyncIterator

from ..config import get_settings
from .runner import SSEEvent
from .session import SessionState
from .system_prompt import SYSTEM_PROMPT
from .tools import TOOLS, dispatch


class GeminiAgentClient:
    """Thin wrapper around google-genai with our seven tools wired in."""

    def __init__(self) -> None:
        # Imports are local so the mock path does not have to install google-genai.
        from google import genai
        from google.genai import types

        settings = get_settings()
        if not settings.google_cloud_project:
            raise RuntimeError(
                "GOOGLE_CLOUD_PROJECT is required when ARDUKID_AGENT_MODE=real."
            )

        self._client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.ardukid_gemini_location,
        )
        self._model = settings.ardukid_gemini_model
        self._tool = types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name=spec.name,
                    description=spec.description,
                    parameters_json_schema=spec.parameters_schema,
                )
                for spec in TOOLS.values()
            ]
        )
        self._types = types
        # One Chat object per session_id, kept on the client so history persists
        # for the lifetime of the process.
        self._chats: dict[str, object] = {}

    def _ensure_chat(self, session_id: str) -> object:
        if session_id not in self._chats:
            self._chats[session_id] = self._client.aio.chats.create(
                model=self._model,
                config=self._types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    tools=[self._tool],
                ),
            )
        return self._chats[session_id]

    async def chat(
        self,
        *,
        session: SessionState,
        user_message: str,
    ) -> AsyncIterator[SSEEvent]:
        types = self._types
        chat = self._ensure_chat(session.session_id)

        # send_message is async on the aio client.
        response = await chat.send_message(user_message)  # type: ignore[attr-defined]
        guard = 0
        while True:
            guard += 1
            if guard > 40:
                yield SSEEvent(type="error", data={"message": "tool loop exceeded 40 iterations"})
                return

            text_chunks: list[str] = []
            function_calls = []
            for candidate in getattr(response, "candidates", []) or []:
                for part in candidate.content.parts or []:
                    if getattr(part, "text", None):
                        text_chunks.append(part.text)
                    fc = getattr(part, "function_call", None)
                    if fc and getattr(fc, "name", None):
                        function_calls.append(fc)

            if text_chunks:
                yield SSEEvent(type="agent_text", data={"content": "".join(text_chunks)})

            if not function_calls:
                return

            response_parts = []
            for fc in function_calls:
                args = dict(getattr(fc, "args", {}) or {})
                yield SSEEvent(
                    type="tool_call",
                    data={"name": fc.name, "args": args},
                )
                result = await dispatch(fc.name, session, args)
                yield SSEEvent(
                    type="tool_result",
                    data={"name": fc.name, "result": result},
                )
                response_parts.append(
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=fc.name,
                            response=result,
                        )
                    )
                )

            # Feed the results back. genai accepts a list of Parts as a turn.
            response = await chat.send_message(response_parts)  # type: ignore[attr-defined]
