"""Deterministic scripted client used when ARDUKID_AGENT_MODE=mock.

This is what runs by default for local dev and CI. It looks at keywords in the
user message and emits a plausible sequence of tool calls so the frontend can
be exercised end-to-end without GCP credentials. The real client lives in
gemini_client.py."""

from __future__ import annotations

from collections.abc import AsyncIterator

from .runner import SSEEvent
from .session import SessionState
from .tools import dispatch


def _normalize(text: str) -> str:
    return text.lower().strip()


class MockAgentClient:
    async def chat(
        self,
        *,
        session: SessionState,
        user_message: str,
    ) -> AsyncIterator[SSEEvent]:
        msg = _normalize(user_message)

        if any(word in msg for word in ("semaforo", "semáforo", "traffic light")):
            async for event in self._traffic_light(session):
                yield event
            return

        if any(word in msg for word in ("led", "luz", "light", "lampara")):
            async for event in self._single_led(session):
                yield event
            return

        if any(word in msg for word in ("boton", "botón", "button")):
            async for event in self._button_and_led(session):
                yield event
            return

        if any(word in msg for word in ("componente", "components", "que puedo")):
            yield SSEEvent(
                type="agent_text",
                data={"content": "Te muestro la lista de partes que tengo."},
            )
            async for event in self._call_tool("list_available_components", {}, session):
                yield event
            return

        yield SSEEvent(
            type="agent_text",
            data={
                "content": (
                    "[mock] Decime que querés armar: prueba con 'quiero un LED', "
                    "'un botón que encienda una luz', o 'un semáforo'."
                ),
            },
        )

    async def _single_led(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        yield SSEEvent(
            type="agent_text",
            data={"content": "Voy a poner un LED rojo y conectarlo al pin 13 con un resistor."},
        )
        async for event in self._call_tool(
            "add_component", {"type": "led", "props": {"color": "red"}}, session
        ):
            yield event
        async for event in self._call_tool(
            "add_component", {"type": "resistor", "props": {"value": "220"}}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "L1.anode", "to_pin": "R1.a"}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "R1.b", "to_pin": "UNO.D13"}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "L1.cathode", "to_pin": "UNO.GND"}, session
        ):
            yield event

    async def _button_and_led(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        yield SSEEvent(
            type="agent_text",
            data={
                "content": "Voy a agregar un botón en el pin 2 y un LED en el pin 13.",
            },
        )
        async for event in self._call_tool("add_component", {"type": "pushbutton"}, session):
            yield event
        async for event in self._call_tool(
            "add_component", {"type": "led", "props": {"color": "green"}}, session
        ):
            yield event
        async for event in self._call_tool(
            "add_component", {"type": "resistor", "props": {"value": "220"}}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "B1.1a", "to_pin": "UNO.D2"}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "B1.2a", "to_pin": "UNO.GND"}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "L1.anode", "to_pin": "R1.a"}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "R1.b", "to_pin": "UNO.D13"}, session
        ):
            yield event
        async for event in self._call_tool(
            "wire", {"from_pin": "L1.cathode", "to_pin": "UNO.GND"}, session
        ):
            yield event

    async def _traffic_light(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        yield SSEEvent(
            type="agent_text",
            data={"content": "Voy a armar un semáforo con tres LEDs (rojo, amarillo, verde)."},
        )
        colors = ("red", "yellow", "green")
        pins = ("UNO.D13", "UNO.D12", "UNO.D11")
        for color in colors:
            async for event in self._call_tool(
                "add_component", {"type": "led", "props": {"color": color}}, session
            ):
                yield event
            async for event in self._call_tool(
                "add_component", {"type": "resistor", "props": {"value": "220"}}, session
            ):
                yield event
        for index, pin in enumerate(pins, start=1):
            async for event in self._call_tool(
                "wire", {"from_pin": f"L{index}.anode", "to_pin": f"R{index}.a"}, session
            ):
                yield event
            async for event in self._call_tool(
                "wire", {"from_pin": f"R{index}.b", "to_pin": pin}, session
            ):
                yield event
            async for event in self._call_tool(
                "wire", {"from_pin": f"L{index}.cathode", "to_pin": "UNO.GND"}, session
            ):
                yield event

    async def _call_tool(
        self,
        name: str,
        args: dict,
        session: SessionState,
    ) -> AsyncIterator[SSEEvent]:
        yield SSEEvent(type="tool_call", data={"name": name, "args": args})
        result = await dispatch(name, session, args)
        yield SSEEvent(type="tool_result", data={"name": name, "result": result})
