# Google Cloud Rapid Agent Hackathon - Resources

Source: https://rapid-agent.devpost.com/resources
Captured: 2026-05-25

## Phase 1 - Core frameworks and environment

The first step is choosing a build environment. Managed or local.

### Managed setup

- **Gemini Enterprise Agent Platform API setup** - mission control for all Google Cloud agent projects.
  - https://console.cloud.google.com/
- **The low-code path: Agent Builder Guide** - rapid development using managed orchestration, grounding, and enterprise data stores.
  - https://cloud.google.com/products/agent-builder
- **Developer SDK: Gemini Enterprise Agent Platform SDK for Python** - client library for writing custom agent logic and handling tool calls.
  - https://cloud.google.com/python/docs/reference/aiplatform/latest
- **Agent Starter Pack** - reference templates.
  - https://github.com/GoogleCloudPlatform/agent-starter-pack

### Google Cloud credits

Two access paths:

1. **No-cost trial:** https://cloud.google.com/free
2. **$100 in Google Cloud credits** - request via form. **Deadline: June 4, 2026.** Approved within 1-5 business days, while supplies last.
   - Form: https://forms.gle/xfv9vQzfRfNCCVbG7

> **May 21st update:** Due to high demand, all remaining additional credits are now limited and will be distributed on a first-come, first-served basis.

> Provision of credits is not guaranteed and at Google's discretion. Entrant is responsible for any fees that exceed the $100 credit.

## Phase 2 - Action mechanisms and data connectivity

Agents need to "do" things and "know" things.

### Core action mechanisms (tool use)

- **Agent Builder Extensions** - use pre-built Google extensions or connect the managed agent to any external API.
  - https://cloud.google.com/vertex-ai/docs/generative-ai/extensions/overview

### Knowledge and grounding

- **Agent Builder Data Stores** - index PDFs, websites, or BigQuery tables and give the managed agent a "source of truth".
  - https://cloud.google.com/vertex-ai/docs/generative-ai/agent-builder/overview

## Phase 3 - Partner integration and infrastructure

Each partner has dedicated resources. We use MongoDB. See [`mongodb-resources.md`](./mongodb-resources.md) for the deep dive.

- Arize: https://rapid-agent.devpost.com/details/arize-resources
- Elastic: https://rapid-agent.devpost.com/details/elastic-resources
- Fivetran: https://rapid-agent.devpost.com/details/fivetran-resources
- GitLab: https://rapid-agent.devpost.com/details/gitlab-resources
- **MongoDB:** https://rapid-agent.devpost.com/details/mongodb-resources
- Dynatrace: https://rapid-agent.devpost.com/details/dynatrace-resources

## Phase 4 - Reasoning, state, and logic hosting

Complex missions need memory and a place for code to live.

- **Managed orchestration: Agent Runtime** - runtime for deploying Python-based agents (LangChain / LlamaIndex) built with Agent Builder or the SDK.
  - https://cloud.google.com/vertex-ai/docs/generative-ai/reasoning-engine/overview
- **State and secrets: Secret Manager** - securely store and retrieve API keys for partner integrations.
  - https://cloud.google.com/secret-manager

## Phase 5 - Deployment and safety

- **Agent deployment: Agent Builder Deployment** - make the managed agent accessible via web interface or API.
- **Custom backend hosting: Cloud Run quickstart** - host your own agent backends or custom tool servers.
  - https://cloud.google.com/run/docs/quickstarts
- **Safety and guardrails: Gemini Enterprise Agent Platform Safety Settings** - configure filters so the agent remains helpful and follows defined constraints.
  - https://cloud.google.com/vertex-ai/docs/generative-ai/learn/responsible-ai

## Upcoming events (informational)

| Date | Time | Topic | Where |
| --- | --- | --- | --- |
| May 26, 2026 | 1:00 PM EDT / 10:00 AM PDT | Secure AI Agent Deployment with GitLab and Gemini | Discord build session |
| May 27, 2026 | 12:00 PM EDT / 9:00 AM PDT | Power Your AI Agent with Data - Q&A with Fivetran & Google Cloud | Webinar |
| May 28, 2026 | 1:00 PM EDT / 10:00 AM PDT | Getting from Zero to a Traced Agent in 5 minutes with Phoenix MCP | Discord build session |

Direct relevance for us: **none mandatory**, but the Phoenix MCP session may inform tracing patterns we could borrow conceptually.

## Support and community

- **FAQ:** https://rapid-agent.devpost.com/details/faq
- **Discussion forum:** https://rapid-agent.devpost.com/forum_topics
- **Discord server:** https://discord.gg/7Dqk5ebCD4

## Project-specific action items

- [ ] Submit $100 credit request before **June 4, 2026**.
- [ ] Provision GCP project, enable Vertex AI / Agent Builder APIs.
- [ ] Create MongoDB Atlas M0 cluster, configure Atlas Vector Search index.
- [ ] Configure Secret Manager for the MongoDB connection string.
- [ ] Read Agent Builder Extensions docs before defining our 7 custom tools.
- [ ] Read MongoDB MCP server "Get started" before integration phase.
