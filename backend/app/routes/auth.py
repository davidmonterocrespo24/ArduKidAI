from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from ..auth import users
from ..auth.deps import current_user_optional
from ..auth.tokens import issue_token
from ..auth.users import UserRecord
from ..rate_limit import limiter
from ..schemas import AuthRequest, AuthResponse, UserPublic

router = APIRouter()

CurrentUser = Annotated[UserRecord | None, Depends(current_user_optional)]


def _to_response(record: UserRecord) -> AuthResponse:
    token = issue_token(user_id=record.id, email=record.email)
    return AuthResponse(
        token=token,
        user=UserPublic(id=record.id, email=record.email, created_at=record.created_at),
    )


@router.post("/signup", response_model=AuthResponse)
@limiter.limit("10/minute")
async def signup(request: Request, payload: AuthRequest) -> AuthResponse:
    _ = request
    try:
        record = await users.create_user(email=payload.email, password=payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(record)


@router.post("/signin", response_model=AuthResponse)
@limiter.limit("20/minute")
async def signin(request: Request, payload: AuthRequest) -> AuthResponse:
    _ = request
    record = await users.authenticate(email=payload.email, password=payload.password)
    if record is None:
        raise HTTPException(status_code=401, detail="wrong email or password")
    return _to_response(record)


@router.get("/me", response_model=UserPublic | None)
async def me(user: CurrentUser) -> UserPublic | None:
    if user is None:
        return None
    return UserPublic(id=user.id, email=user.email, created_at=user.created_at)
