"""Fetch a web page and extract its readable text.

Used by the RAG ingester (`knowledge.index_url`) and by the web tools. We keep
it dependency-light: httpx to fetch, BeautifulSoup to strip boilerplate
(script/style/nav/header/footer) and collapse the visible text. This is good
enough to index article and project-list pages; it is not a full readability
engine."""

from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

_WS_RE = re.compile(r"[ \t\f\v]+")
_BLANKS_RE = re.compile(r"\n\s*\n\s*\n+")
_DROP_TAGS = ("script", "style", "noscript", "nav", "header", "footer", "form", "svg")
_USER_AGENT = "ArduKidBot/1.0 (+https://ardukidai.example) educational RAG indexer"


def extract_text(html: str) -> tuple[str, str]:
    """Return (title, readable_text) from an HTML string."""
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.string or "").strip() if soup.title else ""
    for tag in soup(_DROP_TAGS):
        tag.decompose()
    body = soup.body or soup
    text = body.get_text(separator="\n")
    lines = [_WS_RE.sub(" ", ln).strip() for ln in text.splitlines()]
    text = "\n".join(ln for ln in lines if ln)
    text = _BLANKS_RE.sub("\n\n", text).strip()
    return title, text


async def fetch_url_text(url: str, *, timeout: float = 30.0) -> tuple[str, str]:
    """Fetch `url` and return (title, readable_text).

    Raises httpx.HTTPError on network/HTTP failure so callers can report it."""
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        headers={"User-Agent": _USER_AGENT},
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return extract_text(resp.text)
