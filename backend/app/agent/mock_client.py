"""Deterministic scripted client used when ARDUKID_AGENT_MODE=mock.

This is what runs by default for local dev and CI. It looks at keywords in the
user message and emits a plausible sequence of tool calls so the frontend can
be exercised end-to-end without GCP credentials. The real client lives in
adk_client.py.

The keyword table is checked in order from most-specific to least, so
"potentiometer that dims an LED" routes to the pot + LED template instead
of the single-LED one."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from .runner import SSEEvent
from .session import SessionState
from .tools import dispatch


def _normalize(text: str) -> str:
    return text.lower().strip()


def _matches(msg: str, *words: str) -> bool:
    return any(w in msg for w in words)


class MockAgentClient:
    async def chat(
        self,
        *,
        session: SessionState,
        user_message: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[SSEEvent]:
        msg = _normalize(user_message)

        if _matches(msg, "traffic light", "christmas", "police", "knight rider", "binary counter"):
            async for ev in self._traffic_light(session):
                yield ev
            return

        if _matches(msg, "potentiometer", "pot ", "dimmer", "dim ", "knob", "thermometer"):
            async for ev in self._pot_and_led(session):
                yield ev
            return

        if _matches(msg, "servo", "motor", "angle", "sweep", "door lock"):
            async for ev in self._servo(session):
                yield ev
            return

        if _matches(msg, "lcd", "display", "screen", "hello world", "16x2"):
            async for ev in self._lcd(session):
                yield ev
            return

        if _matches(msg, "7-segment", "7 segment", "7segment", "seven segment", "segment display", "digit", "counter"):
            async for ev in self._seven_segment(session):
                yield ev
            return

        if _matches(msg, "buzzer", "tone", "melody", "song", "play a", "doorbell", "morse", "sos", "theremin", "piano", "greeting"):
            async for ev in self._buzzer(session):
                yield ev
            return

        if _matches(msg, "button", "reaction"):
            async for ev in self._button_and_led(session):
                yield ev
            return

        if _matches(msg, "components", "what can you", "list parts"):
            yield SSEEvent(
                type="agent_text",
                data={"content": "Here are the parts I have."},
            )
            async for ev in self._call_tool("list_available_components", {}, session):
                yield ev
            return

        if _matches(msg, "similar", "find me", "find a"):
            yield SSEEvent(
                type="agent_text",
                data={"content": "I will look for a similar example in the library."},
            )
            async for ev in self._call_tool(
                "find_similar_example", {"query": user_message, "limit": 3}, session
            ):
                yield ev
            return

        if _matches(msg, "saved projects", "my projects"):
            yield SSEEvent(
                type="agent_text",
                data={"content": "Here are your saved projects."},
            )
            async for ev in self._call_tool("list_saved_projects", {}, session):
                yield ev
            return

        if _matches(msg, "documentation", "manual", "docs", "doc:"):
            yield SSEEvent(
                type="agent_text",
                data={"content": "I will search the indexed docs."},
            )
            async for ev in self._call_tool(
                "search_docs", {"query": user_message, "limit": 4}, session
            ):
                yield ev
            return

        if _matches(msg, "led", "light", "lamp", "blink", "fade", "heartbeat"):
            async for ev in self._single_led(session):
                yield ev
            return

        # Fallback: at least drop a LED so the kid sees something happen
        # instead of getting only a help string.
        yield SSEEvent(
            type="agent_text",
            data={
                "content": (
                    "[mock] I did not recognize the exact request, so I will add an LED as a starting point."
                ),
            },
        )
        async for ev in self._single_led(session):
            yield ev

    # ---------- templates ----------

    async def _single_led(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        idx = self._next_led_index(session)
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will add a red LED and connect it to pin 13 through a resistor."},
        )
        async for ev in self._call_tool("add_component", {"type": "led", "props": {"color": "red"}}, session):
            yield ev
        async for ev in self._call_tool("add_component", {"type": "resistor", "props": {"value": "220"}}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"L{idx}.anode", "to_pin": f"R{idx}.a"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"R{idx}.b", "to_pin": "UNO.D13"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"L{idx}.cathode", "to_pin": "UNO.GND"}, session):
            yield ev

    async def _button_and_led(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        bidx = self._next_button_index(session)
        lidx = self._next_led_index(session)
        ridx = self._next_resistor_index(session)
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will add a button on pin 2 and an LED on pin 13."},
        )
        async for ev in self._call_tool("add_component", {"type": "pushbutton"}, session):
            yield ev
        async for ev in self._call_tool("add_component", {"type": "led", "props": {"color": "green"}}, session):
            yield ev
        async for ev in self._call_tool("add_component", {"type": "resistor", "props": {"value": "220"}}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"B{bidx}.1a", "to_pin": "UNO.D2"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"B{bidx}.2a", "to_pin": "UNO.GND"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"L{lidx}.anode", "to_pin": f"R{ridx}.a"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"R{ridx}.b", "to_pin": "UNO.D13"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"L{lidx}.cathode", "to_pin": "UNO.GND"}, session):
            yield ev

    async def _traffic_light(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will build a circuit with three LEDs (red, yellow, green) on pins 11, 12, and 13."},
        )
        start_led = self._next_led_index(session)
        start_res = self._next_resistor_index(session)
        for color in ("red", "yellow", "green"):
            async for ev in self._call_tool("add_component", {"type": "led", "props": {"color": color}}, session):
                yield ev
            async for ev in self._call_tool("add_component", {"type": "resistor", "props": {"value": "220"}}, session):
                yield ev
        pins = ("UNO.D13", "UNO.D12", "UNO.D11")
        for i, pin in enumerate(pins):
            li, ri = start_led + i, start_res + i
            async for ev in self._call_tool("wire", {"from_pin": f"L{li}.anode", "to_pin": f"R{ri}.a"}, session):
                yield ev
            async for ev in self._call_tool("wire", {"from_pin": f"R{ri}.b", "to_pin": pin}, session):
                yield ev
            async for ev in self._call_tool("wire", {"from_pin": f"L{li}.cathode", "to_pin": "UNO.GND"}, session):
                yield ev

    async def _buzzer(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        bzidx = self._next_buzzer_index(session)
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will add a buzzer on pin 8 to play tones."},
        )
        async for ev in self._call_tool("add_component", {"type": "buzzer"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"BZ{bzidx}.1", "to_pin": "UNO.D8"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"BZ{bzidx}.2", "to_pin": "UNO.GND"}, session):
            yield ev

    async def _servo(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        sidx = self._next_servo_index(session)
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will add a servo on pin 9 (PWM) and connect it to 5V."},
        )
        async for ev in self._call_tool("add_component", {"type": "servo"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"S{sidx}.PWM", "to_pin": "UNO.D9"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"S{sidx}.VCC", "to_pin": "UNO.5V"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"S{sidx}.GND", "to_pin": "UNO.GND"}, session):
            yield ev

    async def _pot_and_led(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        pidx = self._next_pot_index(session)
        lidx = self._next_led_index(session)
        ridx = self._next_resistor_index(session)
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will add a potentiometer on A0 and an LED on pin 9 (PWM) to control the brightness."},
        )
        async for ev in self._call_tool("add_component", {"type": "potentiometer"}, session):
            yield ev
        async for ev in self._call_tool("add_component", {"type": "led", "props": {"color": "blue"}}, session):
            yield ev
        async for ev in self._call_tool("add_component", {"type": "resistor", "props": {"value": "220"}}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"P{pidx}.GND", "to_pin": "UNO.GND"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"P{pidx}.VCC", "to_pin": "UNO.5V"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"P{pidx}.SIG", "to_pin": "UNO.A0"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"L{lidx}.anode", "to_pin": f"R{ridx}.a"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"R{ridx}.b", "to_pin": "UNO.D9"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"L{lidx}.cathode", "to_pin": "UNO.GND"}, session):
            yield ev

    async def _lcd(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        lcdidx = self._next_lcd_index(session)
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will connect a 16x2 LCD over I2C using A4 (SDA) and A5 (SCL)."},
        )
        async for ev in self._call_tool("add_component", {"type": "lcd1602"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"LCD{lcdidx}.GND", "to_pin": "UNO.GND"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"LCD{lcdidx}.VCC", "to_pin": "UNO.5V"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"LCD{lcdidx}.SDA", "to_pin": "UNO.A4"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"LCD{lcdidx}.SCL", "to_pin": "UNO.A5"}, session):
            yield ev

    async def _seven_segment(self, session: SessionState) -> AsyncIterator[SSEEvent]:
        sidx = self._next_seg_index(session)
        yield SSEEvent(
            type="agent_text",
            data={"content": "I will add a 7-segment display wired to pins 2 through 9."},
        )
        async for ev in self._call_tool("add_component", {"type": "seg7"}, session):
            yield ev
        # Standard wiring: segments A..G + DP on D2..D9, common to GND
        for seg, pin in zip("ABCDEFG", range(2, 9), strict=True):
            async for ev in self._call_tool(
                "wire", {"from_pin": f"SEG{sidx}.{seg}", "to_pin": f"UNO.D{pin}"}, session
            ):
                yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"SEG{sidx}.DP", "to_pin": "UNO.D9"}, session):
            yield ev
        async for ev in self._call_tool("wire", {"from_pin": f"SEG{sidx}.COM", "to_pin": "UNO.GND"}, session):
            yield ev

    # ---------- helpers ----------

    @staticmethod
    def _count(session: SessionState, prefix: str) -> int:
        return sum(1 for cid in session.components if cid.startswith(prefix))

    def _next_led_index(self, session: SessionState) -> int:
        return self._count(session, "L") + 1 - sum(
            1 for cid in session.components if cid.startswith("LCD")
        )

    def _next_resistor_index(self, session: SessionState) -> int:
        return self._count(session, "R") + 1

    def _next_button_index(self, session: SessionState) -> int:
        # Pushbuttons are prefixed with "B" but so are buzzers ("BZ"); subtract.
        return self._count(session, "B") + 1 - self._count(session, "BZ")

    def _next_buzzer_index(self, session: SessionState) -> int:
        return self._count(session, "BZ") + 1

    def _next_servo_index(self, session: SessionState) -> int:
        return sum(1 for cid in session.components if cid.startswith("S") and not cid.startswith("SEG")) + 1

    def _next_pot_index(self, session: SessionState) -> int:
        return self._count(session, "P") + 1 - self._count(session, "PUSH")

    def _next_lcd_index(self, session: SessionState) -> int:
        return self._count(session, "LCD") + 1

    def _next_seg_index(self, session: SessionState) -> int:
        return self._count(session, "SEG") + 1

    async def _call_tool(
        self,
        name: str,
        args: dict,
        session: SessionState,
    ) -> AsyncIterator[SSEEvent]:
        yield SSEEvent(type="tool_call", data={"name": name, "args": args})
        result = await dispatch(name, session, args)
        yield SSEEvent(type="tool_result", data={"name": name, "result": result})
