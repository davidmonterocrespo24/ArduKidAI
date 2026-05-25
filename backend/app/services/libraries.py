"""Thin wrapper around `arduino-cli lib` so the frontend can list,
search and install Arduino libraries the same way the IDE does.

The kid-facing UI exposes a handful of curated libraries plus a free
search box. Everything runs inside the backend container; libraries
live in `~/.arduino15/user/libraries/` (mountable as a Docker volume
if you want them to survive container restarts)."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

from ..config import get_settings


@dataclass
class LibrarySummary:
    name: str
    version: str | None
    sentence: str | None = None
    author: str | None = None


async def _run_arduino_cli(*args: str) -> tuple[int, str, str]:
    settings = get_settings()
    proc = await asyncio.create_subprocess_exec(
        settings.ardukid_arduino_cli,
        *args,
        "--json",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    return (
        proc.returncode or 0,
        out.decode("utf-8", errors="replace"),
        err.decode("utf-8", errors="replace"),
    )


def _coerce_summary(blob: dict) -> LibrarySummary:
    name = blob.get("name") or blob.get("Name") or ""
    version = blob.get("version") or blob.get("Version")
    sentence = (
        blob.get("sentence")
        or blob.get("paragraph")
        or blob.get("Sentence")
        or blob.get("Paragraph")
    )
    author = blob.get("author") or blob.get("Author")
    return LibrarySummary(name=name, version=version, sentence=sentence, author=author)


async def list_installed() -> list[LibrarySummary]:
    code, out, err = await _run_arduino_cli("lib", "list")
    if code != 0:
        raise RuntimeError(err or "arduino-cli lib list failed")
    if not out.strip():
        return []
    try:
        payload = json.loads(out)
    except json.JSONDecodeError:
        return []
    # arduino-cli wraps the list under either `installed_libraries` (new
    # JSON layout) or returns a bare list (older builds).
    raw = payload.get("installed_libraries") if isinstance(payload, dict) else payload
    if not isinstance(raw, list):
        return []
    out_list: list[LibrarySummary] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        # Newer layout nests metadata under `library`.
        meta = item.get("library") if isinstance(item.get("library"), dict) else item
        out_list.append(_coerce_summary(meta))
    return out_list


async def search(query: str) -> list[LibrarySummary]:
    query = query.strip()
    if not query:
        return []
    code, out, err = await _run_arduino_cli("lib", "search", query)
    if code != 0:
        raise RuntimeError(err or "arduino-cli lib search failed")
    try:
        payload = json.loads(out) if out else {}
    except json.JSONDecodeError:
        return []
    libs = payload.get("libraries") if isinstance(payload, dict) else payload
    if not isinstance(libs, list):
        return []
    out_list: list[LibrarySummary] = []
    for item in libs[:40]:
        if not isinstance(item, dict):
            continue
        # `lib search` returns name + latest under `latest`.
        latest = item.get("latest") if isinstance(item.get("latest"), dict) else {}
        out_list.append(
            LibrarySummary(
                name=item.get("name", ""),
                version=latest.get("version"),
                sentence=latest.get("sentence") or latest.get("paragraph"),
                author=latest.get("author"),
            )
        )
    return out_list


async def install(name: str) -> LibrarySummary:
    name = name.strip()
    if not name:
        raise ValueError("library name required")
    code, _out, err = await _run_arduino_cli("lib", "install", name)
    if code != 0:
        raise RuntimeError(err.strip() or "arduino-cli lib install failed")
    for lib in await list_installed():
        if lib.name.lower() == name.lower():
            return lib
    return LibrarySummary(name=name, version=None)


async def uninstall(name: str) -> None:
    name = name.strip()
    if not name:
        raise ValueError("library name required")
    code, _out, err = await _run_arduino_cli("lib", "uninstall", name)
    if code != 0:
        raise RuntimeError(err.strip() or "arduino-cli lib uninstall failed")
