from fastapi import APIRouter

from ..schemas import ExampleHit

router = APIRouter()


@router.get("/search", response_model=list[ExampleHit])
async def search_examples(q: str = "", limit: int = 5) -> list[ExampleHit]:
    """Stub endpoint. Phase 4 replaces this with a MongoDB Atlas Vector Search
    proxy that embeds `q` via Gemini and runs a cosine similarity lookup."""
    _ = (q, limit)
    return []
