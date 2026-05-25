# MongoDB Track - Resources

Source: https://rapid-agent.devpost.com/details/mongodb-resources
Captured: 2026-05-25

## Why MongoDB is our partner

We selected MongoDB as our hackathon partner because the project benefits from two specific MongoDB capabilities:

1. **MongoDB MCP server** - First-class Model Context Protocol integration, lets the agent query the database directly through tool calls.
2. **Atlas Vector Search** - Semantic search over project intent embeddings, so the agent can answer "find me something similar" or seed inspiration without re-prompting Gemini.

## Official MongoDB resources

### Core tools

- **MongoDB MCP server (get started):** https://www.mongodb.com/docs/mcp-server/get-started/
  - Connect a MongoDB database to an LLM via Model Context Protocol.
  - We will run this as a sidecar to the backend container.
- **Atlas Vector Search:** https://www.mongodb.com/products/platform/atlas-vector-search
  - Semantic search using vector embeddings.
- **Atlas Search documentation:** https://www.mongodb.com/docs/atlas/atlas-search/
- **Database Tools:** https://www.mongodb.com/try/download/database-tools

### Modelling and querying

- **Data Modelling guide:** https://www.mongodb.com/docs/manual/data-modeling/
- **Aggregations:** https://www.mongodb.com/docs/manual/aggregation/

### Sample data and learning

- **Mflix sample dataset** - pre-loaded with vector embeddings (good reference for index setup).
- **AI Learning Hub:** https://www.mongodb.com/resources/use-cases/artificial-intelligence

### Third-party (allowed)

- **Voyage AI** - Embedding generation provider. NOT to be confused with Gemini embeddings. For this project we will use Gemini embeddings only (to keep within the "Gemini-only LLM" rule).

## Atlas tier

- **M0** (free tier) is sufficient for the demo. Sign up at https://www.mongodb.com/cloud/atlas/register.

## Collections we will create

| Collection | Purpose |
| --- | --- |
| `examples` | Pre-seeded reference projects with intent embeddings for vector search. |
| `projects` | User-saved projects (anonymous via fingerprint or Google Sign-In). |
| `components_catalog` | Specification of the 9 supported Arduino components (pins, properties, defaults). |

## Vector search index

```json
{
  "fields": [{
    "type": "vector",
    "path": "intent_embedding",
    "numDimensions": 768,
    "similarity": "cosine"
  }]
}
```

768 dimensions matches the output of Gemini's text embedding model.

## How the agent uses MongoDB

Through the MongoDB MCP server, the agent has access to:

- `find` queries on `examples` and `components_catalog`
- `vector_search` on `examples.intent_embedding`
- `find` and `insert` on `projects`

The agent uses these alongside its own custom tools (add_component, wire, set_blocks, etc.) to deliver a complete experience.

## Demonstrating MongoDB integration to judges

The MongoDB judges care about meaningful use of the MCP server. Our video will explicitly show:

1. The kid asking "find me something with a motor".
2. The agent issuing a vector search call (visible in the chat trace).
3. The MCP server returning matches from the `examples` collection.
4. The agent assembling one of the matches into the canvas.
