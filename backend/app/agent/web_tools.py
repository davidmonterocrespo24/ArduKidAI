"""Google-native web tools for the agent (Phase 9).

All three are powered by Gemini / Google so the build stays within the
hackathon's "Gemini only" rule - no third-party search or scraping APIs.

- search_web: a sub-agent whose only tool is ADK's built-in `google_search`
  (grounding). Wrapped as an AgentTool because a built-in tool cannot be mixed
  with regular function tools in the same agent.
- read_web_page: a sub-agent whose only tool is ADK's built-in `url_context`,
  so it can fetch and read specific URLs.
- watch_youtube: a function tool that feeds a YouTube URL to Gemini as video,
  so the model can answer from the video's content (a transcript-like summary).

These return plain text/answers; the frontend dispatcher ignores them (they do
not mutate the canvas), so they only show up as tool-call breadcrumbs in chat.
"""

from __future__ import annotations

from typing import Any

from ..config import get_settings

_SEARCH_INSTRUCTION = """\
You are a web research helper for an Arduino tutor for children. Given a query,
use google_search to find current, accurate information (tutorials, datasheets,
part details, project ideas). Reply with a short, factual summary in English and
list the source titles and links you used. Do not invent facts.
"""

_URL_INSTRUCTION = """\
You read specific web pages for an Arduino tutor. Given one or more URLs and what
to extract, use url_context to fetch them and answer in English with a concise,
factual summary, quoting wiring details, pins, or code when relevant.
"""

_YOUTUBE_PROMPT = """\
You are helping an Arduino tutor for children. Watch this video and answer the
question in English. Summarize the steps, list the components used, and transcribe
any wiring or code shown. Be factual and concise. If the video is unavailable,
say so.

Question: {question}
"""


def _new_genai_client():
    from google import genai

    settings = get_settings()
    return genai.Client(
        vertexai=True,
        project=settings.google_cloud_project,
        location=settings.ardukid_gemini_location,
    )


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
        return {"ok": True, "answer": (response.text or "").strip(), "source": url}
    except Exception as exc:  # pragma: no cover - network/model dependent
        return {"ok": False, "error": f"could not watch video: {exc}"}


def build_web_tools(model: str) -> list[Any]:
    """Build the web tools list. Returns [] if ADK built-ins are unavailable."""
    try:
        from google.adk.agents import LlmAgent
        from google.adk.tools.agent_tool import AgentTool
        from google.adk.tools.google_search_tool import google_search
        from google.adk.tools.url_context_tool import url_context
    except Exception:  # pragma: no cover - ADK version guard
        return []

    search_agent = LlmAgent(
        model=model,
        name="search_web",
        description=(
            "Search the public web with Google for current Arduino information, "
            "tutorials, parts, or project ideas. Input: a search query string."
        ),
        instruction=_SEARCH_INSTRUCTION,
        tools=[google_search],
    )
    url_agent = LlmAgent(
        model=model,
        name="read_web_page",
        description=(
            "Read and summarize one or more web page URLs. Input: the URL(s) and "
            "what to extract from them."
        ),
        instruction=_URL_INSTRUCTION,
        tools=[url_context],
    )
    return [AgentTool(agent=search_agent), AgentTool(agent=url_agent), watch_youtube]
