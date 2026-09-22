# Exa AI — full parameter reference

Exa exposes a much richer surface than what the MCP server (`mcp__exa__web_search_exa`) shows. MCP only forwards `query` and `numResults`. Everything below requires a direct HTTP call:

```bash
set -a; source .env.local; set +a
curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{ "query": "...", ... }'
```

Or via the Python SDK:

```python
from exa_py import Exa
import os
exa = Exa(os.environ["EXA_API_KEY"])
exa.search("...", type="deep", num_results=20, contents={"text": True})
```

## Search depth (`type`)

| `type`            | Latency       | Use for                                                            |
|-------------------|---------------|---------------------------------------------------------------------|
| `instant`         | <180ms        | Single facts, "what is X right now", autocomplete-style answers     |
| `fast`            | low           | Bulk lookups where speed matters more than depth                    |
| `auto` (default)  | medium        | General queries — Exa picks neural vs. keyword automatically        |
| `neural`          | medium        | Pure semantic / embeddings-based, useful for vague phrasings        |
| `deep-lite`       | higher        | Light agentic search with synthesized output                        |
| `deep`            | higher        | Multi-query agentic search; main "deep research" tier               |
| `deep-reasoning`  | highest       | Strongest reasoning over multiple queries; best for hard comparisons |

Combine with `additionalQueries: [...]` to feed deep tiers explicit query variations.

## Coverage and filtering

- `numResults` (1–100, default 10) — how many URLs to return.
- `category` — `company`, `people`, `research paper`, `news`, `financial report`, `personal site`. Sharply improves relevance in its domain. Note: `company` and `people` do NOT support `startPublishedDate`, `endPublishedDate`, `startCrawlDate`, `endCrawlDate`, `excludeDomains`. For `people`, `includeDomains` only accepts LinkedIn.
- `includeDomains` / `excludeDomains` — up to 1200 domains each.
- `startPublishedDate` / `endPublishedDate` — ISO 8601, filter by publication date.
- `startCrawlDate` / `endCrawlDate` — ISO 8601, filter by when Exa discovered the link.
- `userLocation` — two-letter ISO country code (e.g. `RU`, `US`) to bias results.
- `moderation` (default false) — enable safety filtering.

## Freshness (`maxAgeHours`)

Replaces the deprecated `livecrawl`. Controls when Exa re-fetches a page instead of using cache:

- positive integer (e.g. `24`) — use cache if younger than N hours, else live-crawl.
- `0` — always live-crawl, never use cache.
- `-1` — never live-crawl, always cache only.
- omit — live-crawl only when no cache exists (default).

## Content extraction (`contents`)

This is where most "depth of search" hides. Combine fields freely.

```json
{
  "contents": {
    "text": { "verbosity": "full", "includeSections": ["body"] },
    "highlights": { "query": "key advancements" },
    "summary":    { "query": "Main developments" },
    "subpages": 2,
    "subpageTarget": "sources",
    "extras": { "links": 1, "imageLinks": 1 }
  }
}
```

- `text: true` — full page text. Or pass an object with:
  - `maxCharacters` — cap response size.
  - `includeHtmlTags` — keep HTML structure.
  - `verbosity` — `compact` (default) / `standard` / `full`. Requires `livecrawl: "always"` (or `maxAgeHours: 0`) to take effect.
  - `includeSections` / `excludeSections` — semantic page parts: `header`, `navigation`, `banner`, `body`, `sidebar`, `footer`, `metadata`. Same livecrawl requirement.
- `highlights: true` — most relevant snippets. Or `{ query: "..." }` to steer extraction with a custom query.
- `summary: { query, schema }` — LLM-generated summary, optionally as JSON-schema-shaped output.
- `subpages: N` — also crawl up to N internal subpages of each result.
- `subpageTarget` — string or array of terms used to pick subpages (e.g. `"sources"`, `"pricing"`, `["faq", "support"]`).
- `extras: { links: N, imageLinks: N }` — also return N outbound URLs and N image URLs per result.

## Synthesized output

Deep tiers can return a single synthesized answer instead of a list of results.

- `outputSchema` — JSON schema; the response includes `output.content` matching the schema.
- `systemPrompt` — instructions for synthesis and (in deep tiers) for search planning. Use it for source preferences ("prefer official sources, avoid duplicates"), novelty constraints, language constraints.
- `stream: true` — server-sent events stream of OpenAI-compatible chat completion chunks.

## Recipes

### 1. Deep research with structured output

```bash
set -a; source .env.local; set +a
curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Who is the current CEO of OpenAI?",
    "type": "deep",
    "systemPrompt": "Prefer official sources, avoid duplicates",
    "outputSchema": {
      "type": "object",
      "properties": {
        "leader":      { "type": "string" },
        "title":       { "type": "string" },
        "sourceCount": { "type": "number" }
      },
      "required": ["leader", "title"]
    },
    "contents": { "text": true }
  }'
```

### 2. Fresh news within a date window

```json
{
  "query": "GPT-5 launch coverage",
  "type": "auto",
  "category": "news",
  "startPublishedDate": "2026-04-01T00:00:00.000Z",
  "endPublishedDate":   "2026-05-08T00:00:00.000Z",
  "numResults": 30,
  "contents": { "highlights": true }
}
```

### 3. Market map (companies)

```json
{
  "query": "AI design-to-code generation startups",
  "type": "auto",
  "category": "company",
  "numResults": 50,
  "contents": {
    "summary": { "query": "What this company does and who funds it" },
    "extras":  { "links": 1 }
  }
}
```

### 4. Find primary sources of a research paper

```json
{
  "query": "...paper title or topic...",
  "type": "auto",
  "category": "research paper",
  "numResults": 10,
  "contents": {
    "text": true,
    "subpages": 1,
    "subpageTarget": "references"
  }
}
```

### 5. Instant lookup (lowest latency)

```json
{
  "query": "What is the capital of France?",
  "type": "instant",
  "numResults": 5,
  "contents": { "highlights": true }
}
```

## What MCP does NOT support today

If any of these is needed, drop down to `curl` or `exa.sh`:

- `type`, `category`, `additionalQueries`
- `includeDomains`, `excludeDomains`
- `startPublishedDate`, `endPublishedDate`, `startCrawlDate`, `endCrawlDate`
- `maxAgeHours`
- All `contents.*` (text verbosity, highlights query, summary schema, subpages, extras)
- `outputSchema`, `systemPrompt`, `stream`, `userLocation`, `moderation`

## JS-rendering caveat

Both Exa endpoints return the **static HTML** of a page. Neither runs JavaScript to render SPA / client-side content.

- `mcp__exa__web_fetch_exa` and `/contents` may return a fallback notice (e.g. *"This page displays a fallback because interactive scripts did not run"*) on JS-heavy pages.
- To force fresh extraction with up-to-date content: pair `livecrawl: "always"` (or `maxAgeHours: 0`) with `contents.text.verbosity: "full"` — this triggers a fresh crawl, but still **does not execute JS**.
- For genuinely JS-rendered pages (SPAs, dashboards behind auth, content injected by `fetch()` after page load) → switch to **Tabstack `/extract/markdown` with `effort: "max"`**. Tabstack runs an actual browser, JS included.

## Heuristics: which knob first

| Goal                                        | First parameter to reach for                                  |
|---------------------------------------------|---------------------------------------------------------------|
| More results, same quality                  | `numResults` 20–50                                            |
| Better matching for vague queries           | `type: "neural"`                                              |
| Need to compare sources / build a report    | `type: "deep"` + `additionalQueries`                          |
| Need a structured answer                    | `outputSchema` + `systemPrompt`                               |
| Restrict to a topic vertical                | `category`                                                    |
| Restrict to/from specific sites             | `includeDomains` / `excludeDomains`                           |
| Time-bounded news                           | `startPublishedDate` + `endPublishedDate` + `category: news`  |
| Need full body, not snippets                | `contents.text: { verbosity: "full" }` + `maxAgeHours: 0`     |
| Need to drill into subpages                 | `contents.subpages` + `subpageTarget`                         |
| Lowest possible latency                     | `type: "instant"`                                             |
