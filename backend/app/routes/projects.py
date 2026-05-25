from fastapi import APIRouter, HTTPException

from ..schemas import ProjectDetail, ProjectSummary, SaveProjectRequest
from ..services import projects_store

router = APIRouter()


@router.get("", response_model=list[ProjectSummary])
async def list_projects() -> list[ProjectSummary]:
    return projects_store.list_all()


@router.post("", response_model=ProjectDetail)
async def save_project(payload: SaveProjectRequest) -> ProjectDetail:
    return projects_store.save(name=payload.name, circuit=payload.circuit)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: str) -> ProjectDetail:
    project = projects_store.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return project
