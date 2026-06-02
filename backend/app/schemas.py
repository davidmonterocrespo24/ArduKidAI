from typing import Any, Literal

from pydantic import BaseModel, Field

ComponentType = Literal[
    "uno",
    "led",
    "resistor",
    "pushbutton",
    "buzzer",
    "servo",
    "potentiometer",
    "lcd1602",
    "ssd1306",
    "seg7",
]


class ComponentInstance(BaseModel):
    id: str
    type: ComponentType
    x: float = 0.0
    y: float = 0.0
    props: dict[str, Any] = Field(default_factory=dict)


class Wire(BaseModel):
    from_pin: str = Field(..., description="`componentId.pinName`, e.g. `L1.anode`")
    to_pin: str = Field(..., description="`componentId.pinName`, e.g. `UNO.7`")


class CircuitState(BaseModel):
    components: list[ComponentInstance] = Field(default_factory=list)
    wires: list[Wire] = Field(default_factory=list)
    blockly_xml: str = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>'
    cpp_code: str = ""


class ChatAttachment(BaseModel):
    """An image or document attached to a chat message (base64 payload)."""

    mime_type: str = Field(..., description="e.g. image/png, image/jpeg, application/pdf")
    data: str = Field(..., description="base64-encoded bytes, without a data: URL prefix")
    name: str | None = None


class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Chat session id (one per conversation).")
    message: str
    circuit_state: CircuitState | None = None
    attachments: list[ChatAttachment] | None = None
    board: str = "uno"
    client_id: str | None = Field(
        default=None, description="Stable per-browser id used to scope anonymous chat history."
    )


class CompileSource(BaseModel):
    source: str
    source_kind: Literal["cpp", "blockly_xml"] = "cpp"
    board: str = "uno"


class CompileResponse(BaseModel):
    ok: bool
    hex: str | None = None
    stderr: str | None = None
    error: str | None = None


class ProjectSummary(BaseModel):
    id: str
    name: str
    created_at: str


class ProjectDetail(ProjectSummary):
    circuit: CircuitState


class SaveProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    circuit: CircuitState


class ExampleHit(BaseModel):
    id: str
    title: str
    intent: str
    score: float = 0.0


class AuthRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=8, max_length=200)


class UserPublic(BaseModel):
    id: str
    email: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic
