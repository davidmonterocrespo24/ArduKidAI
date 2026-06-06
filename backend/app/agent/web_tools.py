"""Google-native web tools for the agent (Phase 9).

All three are powered by Gemini / Google so the build stays within the
hackathon's "Gemini only" rule - no third-party search or scraping APIs.

- search_web: Gemini with Google Search grounding, called directly as a function
  tool. (It used to be an ADK AgentTool wrapping the built-in `google_search`,
  but with gemini-3 the sub-agent's tool registry came back empty and the model
  emitted a bare `google_search` call ADK could not resolve - aborting the turn.
  Calling grounding directly, like watch_youtube does, is robust and equivalent.)
- read_web_page: Gemini with the url_context tool, to fetch and read specific URLs.
- watch_youtube: Gemini video, so the model can answer from a video's content.

These return plain text answers; the frontend dispatcher ignores them (they do
not mutate the canvas), so they only show up as tool-call breadcrumbs in chat.
"""

from __future__ import annotations

import re
from typing import Any

from ..config import get_settings

_SEARCH_INSTRUCTION = """\
You are a web research helper for an Arduino tutor for children. Use Google Search
to find current, accurate information (tutorials, datasheets, part details, project
ideas, real-world values). Reply with a short, factual summary in English. Do not
invent facts. Do not use emojis.
"""

_URL_INSTRUCTION = """\
You read specific web pages for an Arduino tutor. Given one or more URLs and what to
extract, fetch them and answer in English with a concise, factual summary, quoting
wiring details, pins, or code when relevant. Do not use emojis.
"""

_YOUTUBE_PROMPT = """\
You are helping an Arduino tutor for children. Watch this video and answer the
question in English. Summarize the steps, list the components used, and transcribe
any wiring or code shown. Be factual and concise. If the video is unavailable,
say so.

Question: {question}
"""

# Strip emojis / pictographs so a quoted search result can never leak one into the
# app (the hackathon forbids emojis anywhere). Accented Latin text is well below
# these ranges, so it is preserved.
_EMOJI_RE = re.compile(
    "[\U0001f000-\U0001faff\U00002600-\U000027bf\U0001f1e6-\U0001f1ff\U00002190-\U000021ff\U00002300-\U000023ff]"
)


def _clean(text: str | None) -> str:
    return _EMOJI_RE.sub("", text or "").strip()


def _new_genai_client():
    from google import genai

    settings = get_settings()
    return genai.Client(
        vertexai=True,
        project=settings.google_cloud_project,
        location=settings.ardukid_gemini_location,
    )


def _sources(response: Any) -> list[dict[str, str]]:
    """Pull the grounded source titles/links out of the response metadata."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    try:
        for cand in response.candidates or []:
            md = getattr(cand, "grounding_metadata", None)
            for chunk in getattr(md, "grounding_chunks", None) or []:
                web = getattr(chunk, "web", None)
                uri = getattr(web, "uri", "") if web else ""
                if uri and uri not in seen:
                    seen.add(uri)
                    out.append({"title": getattr(web, "title", "") or "", "url": uri})
    except Exception:  # pragma: no cover - metadata shape is best-effort
        pass
    return out[:6]


async def search_web(query: str) -> dict[str, Any]:
    """Search the public web with Google for current Arduino information, tutorials,
    parts, project ideas, or real-world values (Gemini with Google Search grounding).

    Args:
        query: what to search for, e.g. "standard traffic light timing seconds".
    """
    q = (query or "").strip()
    if not q:
        return {"ok": False, "error": "provide a search query"}
    try:
        from google.genai import types

        settings = get_settings()
        client = _new_genai_client()
        config = types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            system_instruction=_SEARCH_INSTRUCTION,
        )
        response = await client.aio.models.generate_content(
            model=settings.ardukid_gemini_model, contents=q, config=config
        )
        return {"ok": True, "answer": _clean(response.text), "sources": _sources(response)}
    except Exception as exc:  # pragma: no cover - network/model dependent
        return {"ok": False, "error": f"web search failed: {exc}"}


async def read_web_page(url: str, what: str = "Summarize the page.") -> dict[str, Any]:
    """Read and summarize one or more web pages (Gemini with the url_context tool).

    Args:
        url: the page URL(s) to read.
        what: what to extract from them.
    """
    target = (url or "").strip()
    if not target:
        return {"ok": False, "error": "provide a URL to read"}
    try:
        from google.genai import types

        settings = get_settings()
        client = _new_genai_client()
        config = types.GenerateContentConfig(
            tools=[types.Tool(url_context=types.UrlContext())],
            system_instruction=_URL_INSTRUCTION,
        )
        prompt = f"{what.strip() or 'Summarize the page.'}\nRead these URLs: {target}"
        response = await client.aio.models.generate_content(
            model=settings.ardukid_gemini_model, contents=prompt, config=config
        )
        return {"ok": True, "answer": _clean(response.text), "source": target}
    except Exception as exc:  # pragma: no cover - network/model dependent
        return {"ok": False, "error": f"could not read page: {exc}"}


async def watch_youtube(youtube_url: str, question: str = "Summarize this video.") -> dict[str, Any]:
    """Watch a YouTube video and answer a question about it (Gemini video).

    Args:
        youtube_url: a public YouTube watch or share URL.
        question: what you want to know from the video.
    """
    url = (youtube_url or "").strip()
    if "youtu" not in url:
        return {"ok": False, "error": "provide a valid YouTube URL"}
    try:
        from google.genai import types

        settings = get_settings()
        client = _new_genai_client()
        part = types.Part.from_uri(file_uri=url, mime_type="video/*")
        prompt = _YOUTUBE_PROMPT.format(question=question.strip() or "Summarize this video.")
        response = await client.aio.models.generate_content(
            model=settings.ardukid_gemini_model,
            contents=[part, prompt],
        )
        return {"ok": True, "answer": _clean(response.text), "source": url}
    except Exception as exc:  # pragma: no cover - network/model dependent
        return {"ok": False, "error": f"could not watch video: {exc}"}


def build_web_tools(model: str) -> list[Any]:
    """The web tools the agent can call. `model` is accepted for signature
    compatibility; each tool reads the configured model from settings."""
    _ = model
    try:
        import google.genai  # noqa: F401 - ensure the SDK is importable
    except Exception:  # pragma: no cover - SDK guard
        return []
    return [search_web, read_web_page, watch_youtube]
