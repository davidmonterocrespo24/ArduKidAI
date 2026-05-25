from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ..auth.deps import current_user_optional
from ..auth.users import UserRecord
from ..schemas import ProjectDetail, ProjectSummary, SaveProjectRequest
from ..services import projects_store

router = APIRouter()

CurrentUser = Annotated[UserRecord | None, Depends(current_user_optional)]


def _user_id(user: UserRecord | None) -> str | None:
    return user.id if user is not None else None


@router.get("", response_model=list[ProjectSummary])
async def list_projects(user: CurrentUser) -> list[ProjectSummary]:
    return await projects_store.list_all(user_id=_user_id(user))


@router.post("", response_model=ProjectDetail)
async def save_project(
    payload: SaveProjectRequest,
    user: CurrentUser,
) -> ProjectDetail:
    return await projects_store.save(
        name=payload.name, circuit=payload.circuit, user_id=_user_id(user)
    )


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: str, user: CurrentUser) -> ProjectDetail:
    project = await projects_store.get(project_id, user_id=_user_id(user))
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return project
