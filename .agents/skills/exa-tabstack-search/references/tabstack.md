# Tabstack — full reference

Tabstack is a "web execution layer for AI": four HTTP endpoints that turn URLs into clean text, structured JSON, AI-transformed output, browser actions, or autonomous research.

## Connection details

- **HTTP API base**: `https://api.tabstack.ai/v1`
- **Auth header**: `Authorization: Bearer $TABSTACK_API_KEY`
- **MCP base**: `https://tabstack.stlmcp.com` (Code Mode — `search_docs` + `execute` only; not the right path for routine work)

```bash
set -a; source .env.local; set +a
# now $TABSTACK_API_KEY is exported
```

The Python SDK reads `TABSTACK_API_KEY` from env automatically. TS SDK ditto via `process.env.TABSTACK_API_KEY`.

## Endpoint map

| Endpoint                | Streaming | Cost (per 1k) | Use for                                                  |
|-------------------------|-----------|---------------|-----------------------------------------------------------|
| `POST /extract/markdown` | No        | ~$1           | URL → clean markdown                                      |
| `POST /extract/json`     | No        | ~$5           | URL → structured JSON via your `json_schema`              |
| `POST /generate/json`    | No        | ~$5.7         | URL → AI-transformed JSON with `instructions`             |
| `POST /automate`         | SSE       | ~$7.5         | Browser actions in natural language                       |
| `POST /research`         | SSE       | ~$7.5–15      | Autonomous research with cited sources                    |

Free tier: 50k credits/month.

---

## ⚠ Edge cases you must handle

Real-world behaviour observed on `api.tabstack.ai/v1` — keep in mind for every recipe:

1. **`/extract/markdown` returns non-standard JSON.** The `content` field is a JSON string with **raw line breaks** (`\n` as literal `0x0A`, not as `\\n`) and occasionally invalid `\escape` sequences. As a result:
   - ❌ `curl … | jq` fails with *"control characters from U+0000 through U+001F must be escaped"*.
   - ❌ `python json.loads(raw)` and even `json.loads(raw, strict=False)` fail.
   - ✅ `requests.json()` works (it's lenient).
   - ✅ The bundled helper `scripts/tabstack.py` works (uses `requests`).
   - The other endpoints (`/extract/json`, `/generate/json`, `/research`, `/automate`) return clean JSON.

2. **404 pages come back as HTTP 200.** Tabstack does not detect upstream 404s — it returns the markdown of whatever the server rendered (often a "Page not found" page). Always sanity-check the content for "404", "page not found", "we couldn't find" markers before feeding to the LLM.

3. **Russian corporate sites need `geoTarget: { country: "RU" }`.** `yandex.ru`, `vk.com`, `mail.ru`, `sberbank.ru` and similar large RU sites aggressively block data-center IPs and return a captcha page (~400 chars, mentions "обратной связи") when scraped without geo. Independent RU blogs (`itzine.ru`, `habr.com`) usually work without it. Same pattern likely for large CN sites — try `geoTarget: { country: "CN" }`.

4. **JS-rendered SPAs need `effort: "max"`.** The default `effort: "standard"` does not always execute client-side JavaScript. For React/Vue/SPA pages whose content is injected after load, bump to `effort: "max"`.

## /extract/markdown

```bash
curl -s -X POST 'https://api.tabstack.ai/v1/extract/markdown' \
  -H "Authorization: Bearer $TABSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com/article",
    "metadata": true
  }'
```

Response shape:

```json
{
  "url": "https://example.com/article",
  "content": "---\ntitle: ...\n---\n\n# Heading\n..."
}
```

Higher-quality cleaning than `WebFetch` — no nav menus, ads, banners, popups.

## /extract/json

```bash
curl -s -X POST 'https://api.tabstack.ai/v1/extract/json' \
  -H "Authorization: Bearer $TABSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://stripe.com/pricing",
    "json_schema": {
      "type": "object",
      "properties": {
        "plans": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name":      { "type": "string" },
              "price_usd": { "type": ["number", "null"] },
              "features":  { "type": "array", "items": { "type": "string" } }
            },
            "required": ["name"]
          }
        }
      },
      "required": ["plans"]
    },
    "effort": "standard",
    "nocache": false
  }'
```

Useful body fields:

- `url` (required)
- `json_schema` — JSON schema describing the output (see schema-design tips below)
- `effort` — `min` / `standard` / `max`. Higher effort handles more JS-rendered content but costs more.
- `nocache: true` — bypass cache; use to verify a stale-cache hypothesis.
- `geoTarget: { country: "GB" }` — region-specific extraction.

## /generate/json

Like `/extract/json` but with an extra `instructions` field that tells the AI to *transform* the page content, not just reproduce it.

```json
{
  "url": "https://competitor.com/pricing",
  "json_schema": { ... },
  "instructions": "Categorise pricing as budget, mid-range, or premium and explain why."
}
```

Use this when the raw page does not contain the field you want, but it can be derived (e.g. "summarise", "categorise", "extract key insights").

## /automate (SSE)

Natural-language browser tasks.

```bash
curl -N -X POST 'https://api.tabstack.ai/v1/automate' \
  -H "Authorization: Bearer $TABSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "task": "Open the catalog, filter by category=Books, paginate through all pages, and collect every product name and price.",
    "url": "https://example-shop.com",
    "maxIterations": 30,
    "guardrails": "Never click ads. Never fill any form except search."
  }'
```

Body fields:

- `task` (required) — natural-language description.
- `url` — starting URL.
- `data` — context dict (e.g. form values).
- `geoTarget: { country: "US" }`.
- `guardrails` — natural-language safety constraints.
- `maxIterations` — default 50, range 1–100. **Always cap this.** Avoid runaway loops.
- `maxValidationAttempts` — default 3, range 1–10.

The response is an SSE stream. Read it with `curl -N` and parse `event:` / `data:` lines. Key event types:

- `task:started`, `task:completed`, `task:aborted`, `task:validated`, `task:validation_error`
- `agent:action`, `agent:reasoned`, `agent:extracted`, `agent:status`
- `browser:navigated`, `browser:action_started`, `browser:action_completed`, `browser:screenshot_captured`
- `complete` — terminal event with the final result
- `error`, `done`

For one-shot use from bash, capture the stream and grep the `complete` event:

```bash
curl -N -s -X POST 'https://api.tabstack.ai/v1/automate' \
  -H "Authorization: Bearer $TABSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "$BODY" \
| awk '
    /^event: complete$/ { in_complete = 1; next }
    in_complete && /^data: / { sub(/^data: /, ""); print; exit }
'
```

For non-trivial automate work, prefer the Python SDK so you can `async for event in client.agent.automate(...)`.

## /research (SSE)

Autonomous multi-source research.

```bash
curl -N -X POST 'https://api.tabstack.ai/v1/research' \
  -H "Authorization: Bearer $TABSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "What is the current state of EU AI Act enforcement, May 2026?",
    "mode": "balanced",
    "fetch_timeout": 30
  }'
```

Body fields:

- `query` (required) — research question.
- `mode` — `fast` (default) or `balanced` (paid plan; multiple iterations).
- `nocache: true` — bypass cache.
- `fetch_timeout` — seconds per page fetch.

The `complete` event payload includes `metadata.citedPages` (TS) / `metadata.cited_pages` (Python): each entry has `id`, `url`, `claims` (statements drawn from the page), `sourceQueries` / `source_queries`. Use these to render citations.

**Decision rule**: try Exa `type=deep` *first* (cheaper, accepts `outputSchema`). Only escalate to Tabstack `/research` when:
- The user explicitly asks for autonomous multi-step research with cited claims.
- Exa deep is insufficient (rare).
- The task needs research with the agent navigating between pages mid-flight.

## Schema-design tips (for /extract/json and /generate/json)

The schema is the single biggest lever on extraction quality. From Tabstack's own guide:

1. **Descriptions are instructions.** Every property `description` tells the AI what to look for. Without one, only the property name is available, and names are ambiguous.
2. **Be explicit about null cases.** Use `"type": ["string", "null"]` and explain when null is correct.
3. **Match schema depth to page structure.** A two-level page (categories → products) needs a two-level schema; flattening loses hierarchy.
4. **Use `enum` for categorical fields.** Constrains output and dramatically improves consistency.
5. **Keep array item schemas tight.** Broad item schemas produce noisy results.
6. **Add a top-level `description`.** Scopes extraction to the right section of the page.

Debug ladder when output is noisy:

1. Add more specific descriptions.
2. Bump `effort: "max"`.
3. Simplify the schema; drop fields you don't need.
4. Set `nocache: true`.
5. Disable JS in your browser to see what the extractor sees at `min`/`standard`.

## SDKs (when bash is too thin)

```bash
pip install tabstack          # Python
npm install @tabstack/sdk     # TypeScript
```

Python:

```python
import os
from tabstack import Tabstack

with Tabstack(api_key=os.environ["TABSTACK_API_KEY"]) as client:
    md = client.extract.markdown(url="https://example.com").content
```

TypeScript:

```typescript
import Tabstack from "@tabstack/sdk";
const client = new Tabstack({ apiKey: process.env.TABSTACK_API_KEY });
const r = await client.extract.markdown({ url: "https://example.com" });
console.log(r.content);
```

Both SDKs surface the same five operations:

- `client.extract.markdown(...)`
- `client.extract.json(...)`
- `client.generate.json(...)`
- `client.agent.automate(...)` — async iterable of events
- `client.agent.research(...)` — async iterable of events

For automate / research, the SDK gives you a typed event stream — strongly preferred over hand-parsing SSE in bash.

## MCP "Code Mode" (`search_docs` + `execute`)

The official Tabstack MCP server is **not** a thin wrapper around the four endpoints. It exposes:

- **`search_docs(query, language?)`** — semantic search over the Tabstack SDK docs (TS/Python/Go/Ruby).
- **`execute(code)`** — runs a small `async function run(client) { ... }` against a pre-authenticated SDK client in an isolated sandbox; returns the function's return value or logs.

Sandbox limits: no filesystem, no external network outside Tabstack, 30s per HTTP, ~5min total, no state between calls.

Use it for:

- API discovery (e.g. "how do I extract a table with Tabstack?").
- Iterating on a `json_schema` against a real URL before committing it to a script.
- Sanity-checking what a `/research` or `/automate` event stream actually looks like.

Do not use it for:

- Production-shaped flows.
- Long-running automations (5min cap).
- Anything that needs filesystem or non-Tabstack network access.

For everything that fits a single endpoint call, prefer direct curl to `api.tabstack.ai`.

## Reference: typical request bodies cheat-sheet

```jsonc
// /extract/markdown
{ "url": "...", "metadata": true }

// /extract/json
{ "url": "...", "json_schema": { ... }, "effort": "standard", "nocache": false }

// /generate/json
{ "url": "...", "json_schema": { ... }, "instructions": "...", "geoTarget": { "country": "GB" } }

// /automate
{ "task": "...", "url": "...", "maxIterations": 30, "guardrails": "...", "geoTarget": { "country": "US" } }

// /research
{ "query": "...", "mode": "balanced", "nocache": false, "fetch_timeout": 30 }
```
