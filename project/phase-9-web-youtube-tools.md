# Phase 9 - Web + YouTube tools (Google-native)

Priority: P2 (high-value stretch). Status: pending.
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) section 6.

## Goal

Give the agent the ability to search the web, read a specific page, and
understand a YouTube video - all with Google-native AI so it stays within the rules
(no Bing/OpenAI, no third-party ASR).

## Tasks

- [ ] `search_agent` sub-agent: `tools=[google_search, url_context]` (they co-exist);
      expose to the root agent via `AgentTool` (built-in tools can't sit beside function tools).
- [ ] `fetch_url` root FunctionTool: plain `httpx.get` of a public page (no AI); deterministic fallback.
- [ ] `youtube_agent` sub-agent: `generate_content` with `Part.from_uri(youtube_url, "video/mp4")`
      to transcribe/summarize; expose via `AgentTool`. Handle the Vertex preview limit (public, 1/req).
- [ ] System prompt: when to search vs read a given URL vs watch a video; always cite sources kid-safe.
- [ ] Verify `url_context` is live on Vertex `global` for our model; if not, rely on `fetch_url`.
- [ ] Compliance check: confirm no non-Google AI service is touched by any web path.

## Exit criteria

- Agent can answer "search the web for X", "read this page <url>", and "summarize this YouTube video
  <url>", citing sources, with all AI calls going to Google/Gemini.
- Commit `feat(phase-9): google-native web search, url reading, and youtube tools`.
