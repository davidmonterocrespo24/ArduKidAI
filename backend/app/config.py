from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

AgentMode = Literal["real", "mock"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    agent_mode: AgentMode = "mock"

    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"
    ardukid_gemini_model: str = "gemini-3-pro"

    ardukid_fqbn: str = "arduino:avr:uno"
    ardukid_arduino_cli: str = "arduino-cli"

    ardukid_cors_origins: str = "http://localhost:5173"

    mongodb_uri: str = ""
    mongodb_db: str = "ardukid"

    mcp_enabled: bool = False
    mcp_server_url: str = "http://localhost:3030"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ardukid_cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
