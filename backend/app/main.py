from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import agent, compile_route, examples, health, projects


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="ArduKid backend",
        version="0.1.0",
        description="Agent service for the ArduKid mini-IDE.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    app.include_router(health.router)
    app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
    app.include_router(compile_route.router, prefix="/api", tags=["compile"])
    app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
    app.include_router(examples.router, prefix="/api/examples", tags=["examples"])

    return app


app = create_app()
