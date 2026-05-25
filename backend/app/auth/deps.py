"""FastAPI dependencies for auth. Optional by default - missing or invalid
tokens fall back to None so anonymous play keeps working."""

from __future__ import annotations

from fastapi import Header

from .tokens import decode_token
from .users import UserRecord, get_by_id


async def current_user_optional(
    authorization: str | None = Header(default=None),
) -> UserRecord | None:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        return None
    return await get_by_id(user_id)
