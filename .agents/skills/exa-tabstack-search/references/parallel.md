# Parallel web API — reference

Third layer of this skill. **Exa finds, Tabstack executes, Parallel deepens/enriches/monitors** — and
returns *auditable per-field citations*. Use Parallel when you need: structured enrichment over many
entities with source URLs (**«добор»**), genuine multi-hop deep research, a verified list of
companies/people, or continuous monitoring.

- Base URL: `https://api.parallel.ai`
- Auth header: **`x-api-key: $PARALLEL_API_KEY`** (NOT Bearer)
- Key: `PARALLEL_API_KEY` in the project's `.env.local` → `set -a; source .env.local; set +a`, or the bundled `scripts/parallel.py` auto-loads it.
- Free Search MCP (no key): `https://search.parallel.ai/mcp` — `claude mcp add --transport http parallel-search https://search.parallel.ai/mcp`
- OpenAPI (authoritative schemas): `https://docs.parallel.ai/public-openapi.json` · docs index `https://docs.parallel.ai/llms.txt`

## Endpoints (verified against OpenAPI)

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/search` | POST | One round-trip semantic search → cited excerpts. **No `max_results`** (HTTP 422 if sent). |
| `/v1/extract` | POST | URL(s) → clean excerpts; optional `objective` focuses them. Up to 20 URLs. |
| `/v1/tasks/runs` | POST | Create a task run (enrichment OR deep research). |
| `/v1/tasks/runs/{id}` | GET | Run status. |
| `/v1/tasks/runs/{id}/result` | GET | Run result: `output.content` + `output.basis` (citations). |
| `/v1/tasks/groups` (+`/runs`) | POST | Batch many task runs under one handle. |
| `/v1beta/findall/runs` (+`/result`) | POST/GET | Discover a verified list of entities (async). |
| `/v1beta/findall/entity-search` | POST | Fast synchronous people/company lookup. |
| `/v1/monitors` (+`/events`) | POST/GET | Scheduled query + webhook on change. |

## Processors (for `/v1/tasks/runs`)

`lite` (~2 fields) · `base` (~5) · `core` (~10) · `core2x` · `pro` (~20, exploratory deep search) ·
`ultra` / `ultra2x` / `ultra4x` / `ultra8x` (deep research). Append `-fast` for lower latency (e.g.
`core-fast`, `pro-fast`).

- **Enrichment / «добор»** → `base` / `core`. Cheap, minutes-or-less, **no gating needed**.
- **Deep research** → `pro` (≈ minutes, blocking OK) or `ultra*` (up to ~2h → **use a webhook**, don't block).
  Deep research is the slow/expensive mode → **GATE it** (see SKILL.md "Deep Research — when to run").

## The killer pattern: structured enrichment with citations («добор»)

Give a JSON `output_schema`; Parallel fills it AND returns a per-field citation list in `output.basis`.
The sourcing is the native output — exactly what you want for analyst-facing datasets.

```bash
set -a; source .env.local; set +a
curl -s -X POST https://api.parallel.ai/v1/tasks/runs \
  -H "x-api-key: $PARALLEL_API_KEY" -H "Content-Type: application/json" -d '{
    "processor":"core",
    "input":{"entity":"Bilbao city brand","instruction":"Find 4-8 varied source URLs."},
    "task_spec":{"output_schema":{"type":"json","json_schema":{
      "type":"object","additionalProperties":false,"required":["sources"],
      "properties":{"sources":{"type":"array","description":"4-8 real sources; >=1 official/agency, plus interviews/analysis/context",
        "items":{"type":"object","additionalProperties":false,
          "required":["url","title","type","lang","date","note"],
          "properties":{
            "url":{"type":"string"},"title":{"type":"string"},
            "type":{"type":"string","description":"official|agency|interview|analysis|context|paper"},
            "lang":{"type":"string"},"date":{"type":"string"},"note":{"type":"string"}}}}}}}}}'
# then GET /v1/tasks/runs/{run_id}/result → output.content.sources  +  output.basis[].citations[].url
```

Prefer the helper: `scripts/parallel.py task-src "Bilbao city brand" core` (creates → polls → prints the
structured sources). For many entities loop it (or `group()` in the helper). This is how a regional
sources dataset (74 cities, 668 URLs) was built — each city enriched with 4–8 typed, cited URLs.

## Deep research (gated)

```bash
curl -s -X POST https://api.parallel.ai/v1/tasks/runs -H "x-api-key: $PARALLEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"processor":"pro","input":"Research X across regions; give a table with citations."}'
# poll /result; output.content = report (or structured if you pass a schema), output.basis = citations
```

`pro` blocks fine (~minutes). For `ultra*` register a webhook at create time instead of polling.
**Do not auto-launch** — gate per SKILL.md. Often the *other* Parallel modes (Search, enrichment, FindAll)
already answer the need without deep research.

## Search & Extract (parity with Exa/Tabstack)

```bash
# Search: objective (full sentence) + 2-3 short keyword queries. NO max_results.
curl -s -X POST https://api.parallel.ai/v1/search -H "x-api-key: $PARALLEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"objective":"Official slogan, year, agency of the Bilbao place brand","search_queries":["Bilbao Bizkaia Be Basque agency","marca Bilbao Bizkaia concurso"]}'

# Extract: focused excerpts from a known URL
curl -s -X POST https://api.parallel.ai/v1/extract -H "x-api-key: $PARALLEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com"],"objective":"the brand slogan, year and author"}'
```

## FindAll / Entity Search (lists of companies or people)

```bash
curl -s -X POST https://api.parallel.ai/v1beta/findall/entity-search -H "x-api-key: $PARALLEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"entity_type":"companies","objective":"AI startups that raised Series A in 2024","match_limit":50}'
```
`entity_type` is **only** `companies` or `people`. For topics, cases, or places (e.g. "post-industrial
cities that rebranded") FindAll does NOT fit — use a `task` (deep research) instead.

## Gotchas

- `/v1/search` rejects `max_results` (422). Tune via `mode`/processor, not an explicit cap.
- Auth header is `x-api-key`, not `Authorization: Bearer`.
- FindAll/Entity Search: `entity_type` companies|people only.
- `ultra*` deep research can run up to ~2h → webhook, never block an HTTP connection.
- Date/randomness: nothing special, but deep runs are async — store the `run_id` and poll `/result`.

## When Parallel vs Exa vs Tabstack (measured on real tasks)

| Task type | Best tool | Why |
|---|---|---|
| Fast semantic discovery / fresh cases | **Exa** | seconds, freshest, "describe the ideal page" |
| Point fact (slogan/year/author) | **Exa ≈ Parallel Search** | parity; both hit primary sources |
| Read / scrape / click a known page | **Tabstack** (or Parallel Extract for focus) | Tabstack adds JSON-schema scrape + browser automation |
| **Structured enrichment over many entities, with source URLs («добор»)** | **Parallel Task/Group** | native `basis` citations; auditable; batchable |
| Verified list of companies / people | **Parallel FindAll / Entity Search** | entity-typed, verified |
| Broad multi-region overview / "give me a table of the world" | **Parallel Deep Research** (gated) | self-structures + citations, but slow/expensive |
| Continuous monitoring (webhook on change) | **Parallel Monitor** | scheduler + webhooks Exa/Tabstack lack |

Rule of thumb: **fast/fresh → Exa; read/scrape/click → Tabstack; enrich-with-sources or monitor → Parallel;
deep research → Parallel, but gated.** The hybrid default for big jobs: start fast with Exa, enrich/verify
with Parallel «добор», escalate to Deep Research only when the task truly calls for it.

## Helper

`scripts/parallel.py` (stdlib only): `search`, `extract`, `task` (create→poll→result, returns
`content`+`basis_urls`), `task-src` (enrichment «добор»), `group` (batch). Auto-loads the key.
