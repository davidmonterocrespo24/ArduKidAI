from fastapi import APIRouter

from ..schemas import ExampleHit
from ..services.examples import search_similar

router = APIRouter()


@router.get("/search", response_model=list[ExampleHit])
async def search_examples(q: str = "", limit: int = 5) -> list[ExampleHit]:
    return await search_similar(q, limit)
