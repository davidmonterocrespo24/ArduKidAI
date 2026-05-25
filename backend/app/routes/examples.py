from fastapi import APIRouter

from ..db.seed_data import EXAMPLES_SEED
from ..schemas import ExampleHit
from ..services.examples import search_similar

router = APIRouter()


@router.get("/search", response_model=list[ExampleHit])
async def search_examples(q: str = "", limit: int = 5) -> list[ExampleHit]:
    if q.strip():
        return await search_similar(q, limit)
    # Empty query: surface the seeded examples so the frontend can render a
    # full gallery without first guessing a query. Order by difficulty so the
    # first row is welcoming for newcomers.
    seeds = sorted(EXAMPLES_SEED, key=lambda item: (item["difficulty"], item["title"]))
    return [
        ExampleHit(
            id=item["id"],
            title=item["title"],
            intent=item["intent_en"],
            score=0.0,
        )
        for item in seeds[:limit]
    ]
