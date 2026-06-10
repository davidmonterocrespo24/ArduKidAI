from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

AgentMode = Literal["real", "mock"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # The .env documents this as ARDUKID_AGENT_MODE; accept the bare AGENT_MODE too.
    agent_mode: AgentMode = Field(
        default="mock",
        validation_alias=AliasChoices("ARDUKID_AGENT_MODE", "AGENT_MODE"),
    )

    google_cloud_project: str = ""
    # Embeddings (text-embedding-005) live in a regional endpoint.
    google_cloud_location: str = "us-central1"
    # Gemini 3 chat models are served from the "global" endpoint, not us-central1.
    ardukid_gemini_location: str = "global"
    ardukid_gemini_model: str = "gemini-3-flash-preview"

    ardukid_fqbn: str = "arduino:avr:uno"
    ardukid_arduino_cli: str = "arduino-cli"

    # Vite picks the next free port (5173, 5174, ...) when one is taken, so allow
    # a small range in dev to avoid a confusing "Failed to fetch" (CORS) when the
    # frontend lands on a different port. Production serves the SPA same-origin,
    # where CORS does not apply.
    ardukid_cors_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
        "http://localhost:5176,http://127.0.0.1:5173,http://127.0.0.1:5174,"
        "http://127.0.0.1:5175,http://127.0.0.1:5176"
    )

    mongodb_uri: str = ""
    mongodb_db: str = "ardukid"

    mcp_enabled: bool = False
    mcp_server_url: str = "http://localhost:3030"

    # Auth. JWT secret must be set in production; the default below is fine
    # for local development with the in-memory user store.
    jwt_secret: str = "ardukid-local-dev-only-change-me"
    jwt_ttl_hours: int = 24 * 14  # 14 days

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ardukid_cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
