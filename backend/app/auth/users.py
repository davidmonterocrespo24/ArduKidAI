"""User accounts. MongoDB-backed when MONGODB_URI is set; in-memory dict
otherwise. Email is the unique key."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from ..db.client import COLLECTION_USERS, get_db
from .passwords import hash_password, verify_password


@dataclass
class UserRecord:
    id: str
    email: str
    created_at: str
    password_hash: str | None = None  # None for federated identities


_MEMORY: dict[str, dict] = {}  # email -> doc


def _new_id() -> str:
    return uuid.uuid4().hex[:16]


def _now() -> str:
    return datetime.now(UTC).isoformat()


async def _find_doc(email: str) -> dict | None:
    db = get_db()
    if db is None:
        return _MEMORY.get(email.lower())
    return await db[COLLECTION_USERS].find_one({"email": email.lower()})


def _doc_to_record(doc: dict) -> UserRecord:
    return UserRecord(
        id=str(doc["_id"]),
        email=doc["email"],
        created_at=doc.get("created_at", ""),
        password_hash=doc.get("password_hash"),
    )


async def create_user(*, email: str, password: str) -> UserRecord:
    email_lc = email.lower().strip()
    if not email_lc or "@" not in email_lc:
        raise ValueError("invalid email")
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    if await _find_doc(email_lc) is not None:
        raise ValueError("email already registered")

    record_id = _new_id()
    doc = {
        "_id": record_id,
        "email": email_lc,
        "password_hash": hash_password(password),
        "created_at": _now(),
    }
    db = get_db()
    if db is None:
        _MEMORY[email_lc] = doc
    else:
        await db[COLLECTION_USERS].insert_one(doc)
    return _doc_to_record(doc)


async def authenticate(*, email: str, password: str) -> UserRecord | None:
    doc = await _find_doc(email.lower().strip())
    if doc is None or not doc.get("password_hash"):
        return None
    if not verify_password(password, doc["password_hash"]):
        return None
    return _doc_to_record(doc)


async def get_by_id(user_id: str) -> UserRecord | None:
    db = get_db()
    if db is None:
        for doc in _MEMORY.values():
            if doc["_id"] == user_id:
                return _doc_to_record(doc)
        return None
    doc = await db[COLLECTION_USERS].find_one({"_id": user_id})
    if doc is None:
        return None
    return _doc_to_record(doc)


def reset() -> None:
    """Test helper."""
    _MEMORY.clear()
