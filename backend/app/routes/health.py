from fastapi import APIRouter

from ..config import get_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "agent_mode": settings.agent_mode,
        "model": settings.ardukid_gemini_model,
    }
