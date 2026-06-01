"""A MongoDB-backed ADK SessionService.

ADK ships InMemory / SQL / VertexAI session services but no MongoDB one, so the
agent's conversation history was ephemeral. This persists each session (its
events + state) in Atlas, keyed by (app_name, user_id, session_id), which gives
us three things at once:

- the agent remembers a conversation across requests and restarts,
- the user can list and reopen past chats (history) from the backend, and
- it is the substrate the MongoMemoryService reads to build long-term memory.

Falls back to an in-process dict when MONGODB_URI is unset so local dev / tests
still run."""

from __future__ import annotations

import re
import time
import uuid
from typing import Any

from google.adk.events.event import Event
from google.adk.sessions.base_session_service import (
    BaseSessionService,
    GetSessionConfig,
    ListSessionsResponse,
)
from google.adk.sessions.session import Session

from ..db.client import COLLECTION_CHAT_SESSIONS, get_db


def _key(app_name: str, user_id: str, session_id: str) -> str:
    return f"{app_name}::{user_id}::{session_id}"


# The agent prepends a "[Canvas board: ...]" context note to each user turn;
# strip it so it never leaks into the session title or memory.
_BOARD_NOTE_RE = re.compile(r"^\[Canvas board:.*?\]\n\n", re.DOTALL)


def _user_text(event: Event) -> str:
    if event.author != "user" or not event.content or not event.content.parts:
        return ""
    text = "".join(p.text or "" for p in event.content.parts).strip()
    return _BOARD_NOTE_RE.sub("", text).strip()


class MongoSessionService(BaseSessionService):
    def __init__(self) -> None:
        # In-process fallback when Atlas is not configured.
        self._mem: dict[str, dict[str, Any]] = {}

    def _coll(self):
        db = get_db()
        return db[COLLECTION_CHAT_SESSIONS] if db is not None else None

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> Session:
        sid = session_id or uuid.uuid4().hex
        now = time.time()
        doc = {
            "_id": _key(app_name, user_id, sid),
            "app_name": app_name,
            "user_id": user_id,
            "session_id": sid,
            "state": state or {},
            "events": [],
            "title": "",
            "created_at": now,
            "last_update_time": now,
        }
        coll = self._coll()
        if coll is not None:
            await coll.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        else:
            self._mem[doc["_id"]] = doc
        return Session(
            id=sid,
            app_name=app_name,
            user_id=user_id,
            state=dict(doc["state"]),
            events=[],
            last_update_time=now,
        )

    async def _load_doc(self, app_name: str, user_id: str, session_id: str):
        coll = self._coll()
        if coll is not None:
            return await coll.find_one({"_id": _key(app_name, user_id, session_id)})
        return self._mem.get(_key(app_name, user_id, session_id))

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: GetSessionConfig | None = None,
    ) -> Session | None:
        doc = await self._load_doc(app_name, user_id, session_id)
        if not doc:
            return None
        events_raw = list(doc.get("events", []))
        if config and config.num_recent_events is not None:
            n = config.num_recent_events
            events_raw = events_raw[-n:] if n > 0 else []
        events: list[Event] = []
        for raw in events_raw:
            try:
                events.append(Event.model_validate(raw))
            except Exception:
                continue
        return Session(
            id=doc["session_id"],
            app_name=app_name,
            user_id=user_id,
            state=dict(doc.get("state", {})),
            events=events,
            last_update_time=float(doc.get("last_update_time", 0.0)),
        )

    async def list_sessions(
        self, *, app_name: str, user_id: str | None = None
    ) -> ListSessionsResponse:
        out: list[Session] = []
        coll = self._coll()
        if coll is not None:
            query: dict[str, Any] = {"app_name": app_name}
            if user_id is not None:
                query["user_id"] = user_id
            cursor = coll.find(query, {"events": 0}).sort("last_update_time", -1)
            async for d in cursor:
                out.append(self._summary(d))
        else:
            docs = [
                d
                for d in self._mem.values()
                if d["app_name"] == app_name and (user_id is None or d["user_id"] == user_id)
            ]
            for d in sorted(docs, key=lambda x: x.get("last_update_time", 0.0), reverse=True):
                out.append(self._summary(d))
        return ListSessionsResponse(sessions=out)

    @staticmethod
    def _summary(d: dict[str, Any]) -> Session:
        # Stash the title in state so callers can show it without loading events.
        return Session(
            id=d["session_id"],
            app_name=d["app_name"],
            user_id=d["user_id"],
            state={"title": d.get("title", "")},
            events=[],
            last_update_time=float(d.get("last_update_time", 0.0)),
        )

    async def delete_session(self, *, app_name: str, user_id: str, session_id: str) -> None:
        coll = self._coll()
        if coll is not None:
            await coll.delete_one({"_id": _key(app_name, user_id, session_id)})
        else:
            self._mem.pop(_key(app_name, user_id, session_id), None)

    async def append_event(self, session: Session, event: Event) -> Event:
        event = await super().append_event(session, event)
        if event.partial:
            return event
        doc_id = _key(session.app_name, session.user_id, session.id)
        ev_json = event.model_dump(mode="json", exclude_none=True)
        coll = self._coll()
        if coll is not None:
            await coll.update_one(
                {"_id": doc_id},
                {
                    "$push": {"events": ev_json},
                    "$set": {
                        "state": session.state,
                        "last_update_time": session.last_update_time,
                        "app_name": session.app_name,
                        "user_id": session.user_id,
                        "session_id": session.id,
                    },
                },
                upsert=True,
            )
            title = _user_text(event)
            if title:
                await coll.update_one(
                    {"_id": doc_id, "$or": [{"title": {"$exists": False}}, {"title": ""}]},
                    {"$set": {"title": title[:80]}},
                )
        else:
            d = self._mem.setdefault(
                doc_id,
                {
                    "_id": doc_id,
                    "app_name": session.app_name,
                    "user_id": session.user_id,
                    "session_id": session.id,
                    "events": [],
                    "state": {},
                    "title": "",
                    "created_at": time.time(),
                    "last_update_time": 0.0,
                },
            )
            d["events"].append(ev_json)
            d["state"] = session.state
            d["last_update_time"] = session.last_update_time
            if not d.get("title"):
                t = _user_text(event)
                if t:
                    d["title"] = t[:80]
        return event


_SINGLETON: MongoSessionService | None = None


def get_session_service() -> MongoSessionService:
    """One shared instance so the agent and the history endpoints agree (and
    share the in-memory fallback when Atlas is not configured)."""
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = MongoSessionService()
    return _SINGLETON
