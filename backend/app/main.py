from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import get_settings
from .rate_limit import limiter
from .routes import agent, auth, compile_route, examples, health, knowledge, libraries, projects


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="ArduKid backend",
        version="0.1.0",
        description="Agent service for the ArduKid mini-IDE.",
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    app.include_router(health.router)
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
    app.include_router(compile_route.router, prefix="/api", tags=["compile"])
    app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
    app.include_router(examples.router, prefix="/api/examples", tags=["examples"])
    app.include_router(libraries.router, prefix="/api/libraries", tags=["libraries"])
    app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])

    return app


app = create_app()
