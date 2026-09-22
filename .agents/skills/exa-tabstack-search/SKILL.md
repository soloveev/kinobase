---
name: exa-tabstack-search
description: Default procedure for ANY web research, search, lookup, page reading, scraping, news monitoring, pricing/feature extraction, comparison, market mapping, data enrichment, entity-list building, or browser-automation task. Three layers — Exa AI (semantic search — finds relevant URLs), Tabstack (web execution layer — reads URLs as clean markdown, scrapes via JSON schema, automates clicks/forms/pagination), and Parallel (deepens/enriches — structured enrichment with auditable per-field source citations «добор», deep research, verified company/people lists, web monitoring). Use solo or together. Triggers — RU "найди в интернете", "поищи", "проверь сайт", "собери источники", "обогати/добери источники", "собери датасет/таблицу", "прочитай страницу", "прочитай ссылку", "сделай research/ресёрч", "глубокое исследование", "сравни X и Y", "вытащи цены/список", "новости по теме", "свежие новости", "мониторь", "крауль", "обзор/карта рынка", "карта конкурентов"; EN "search the web", "look up", "read URL", "fetch page", "extract from URL", "scrape", "crawl", "browse to", "compare X and Y", "pricing extraction", "enrich", "build a dataset", "deep research", "monitor news". Replaces built-in WebSearch and WebFetch as the default for online work.
---

# Exa + Tabstack + Parallel Search

## Overview

Three services, one search workflow. Each owns a different question:

- **Exa AI** — *"which URLs are relevant?"* — fast semantic search with highlights, structured output, deep-search variants. The default entry point.
- **Tabstack** — *"what is on this URL as clean text?"* and *"how do I navigate, click, paginate?"* — web execution layer (extract / generate / automate / research).
- **Parallel** — *"deepen / enrich / monitor — with auditable sources"* — structured enrichment that returns **per-field source citations** («добор»), genuine multi-hop deep research, verified company/people lists (FindAll/Entity Search), and scheduled web monitoring.

Mental model: **Exa finds · Tabstack executes · Parallel deepens & enriches.** API keys live in the project's `.env.local` (which of the three the owner has is recorded in `research/SEARCH-PROFILE.md`). Exa may also be exposed as MCP (`mcp__exa__*`) if the agent has it configured; Tabstack's MCP is "Code Mode" (`search_docs` + `execute`) over `https://api.tabstack.ai/v1`; Parallel runs over `https://api.parallel.ai` (with a free Search MCP at `https://search.parallel.ai/mcp`).

## API keys

All keys live in the project's `.env.local` (`EXA_API_KEY`, `TABSTACK_API_KEY`, `PARALLEL_API_KEY`; the file is git-ignored):

```bash
set -a; source .env.local; set +a   # exports EXA_API_KEY, TABSTACK_API_KEY, PARALLEL_API_KEY
```

When to source:
- **Exa MCP (`mcp__exa__*`)** / **Tabstack MCP (`mcp__tabstack__*`)** — only if the agent has these MCP servers configured; otherwise use the HTTP APIs below.
- **Direct HTTP** to `api.exa.ai` / `api.tabstack.ai` / **`api.parallel.ai`** — source the file first.
- **Python/Node SDKs** (`exa-py`, `@tabstack/sdk`, `parallel-web`) — source the file (they read env).
- **Parallel auth header is `x-api-key`** (not Bearer). The bundled `scripts/parallel.py` auto-loads `.env.local`. Parallel also offers a free Search-only MCP (no key): `https://search.parallel.ai/mcp`.

## Decision tree

```
Need information from the web
│
├─ Find URLs by topic / question              → Exa search (MCP)
├─ Quick fact "right now"                      → Exa type=instant; or Parallel Search (parity)
├─ Read a known URL as clean markdown          → Tabstack /extract/markdown (or Parallel /extract for a focused slice)
├─ Extract structured data from a URL          → Tabstack /extract/json with json_schema
├─ Transform extracted data with AI            → Tabstack /generate/json
├─ Click, fill form, paginate, multi-step      → Tabstack /automate (SSE)
├─ Compare / overview / market map             → Exa search + Tabstack extract (pair)
│
│   ── Parallel layer (deepen / enrich / monitor) ──
├─ Enrich many entities + need source URLs     → Parallel Task enrichment («добор»)  ← cheap, high-value, NO gate
│   (e.g. "for each city/company give 4-8 cited sources / fields")  basis = per-field citations
├─ Build a verified list of companies / people → Parallel FindAll / Entity Search
├─ Continuously monitor a topic (webhook)      → Parallel Monitor
└─ Genuine multi-hop deep research / world-wide → Parallel Deep Research (pro/ultra)  ← GATE it (see below)
```

Default for "найди в интернете" → start with **Exa**. Escalate to **Tabstack** when highlights are insufficient or the task needs page interaction. Reach for **Parallel** when you need *structured enrichment with auditable sources* («добор»), a *verified entity list*, *monitoring*, or *deep research* — see Tool 3.

### Deep Research — when to run (gating)

Parallel is much more than Deep Research; its other modes (Search, **enrichment/«добор»**, FindAll, Monitor) cover most needs without it. Deep Research (`pro`/`ultra`) is the slow/expensive mode — decide first whether it's truly warranted, then:

1. **User explicitly asked** for deep / thorough research → run it (just say "запускаю Deep Research, это ~минуты").
2. **User didn't ask, but the task genuinely benefits** from it (broad multi-region/source synthesis a single pass can't do) → **ask first via a dialog (AskUserQuestion)** and run only on approval.
3. **User didn't ask and the task doesn't need it** → **don't ask, don't even mention it** — just answer with the normal tools (Exa / Tabstack / Parallel Search + «добор»).

«Добор» (enrichment) is *not* gated — it's the cheap, high-value default whenever you need structured, sourced data over one or many entities.

## Tool 1: Exa AI

### MCP entry points (default for search)

- **`mcp__exa__web_search_exa(query, numResults=10)`** — semantic search returning URLs + highlights. Maximum `numResults` is 100. Formulate query as "describe the ideal page", not keywords (e.g. "blog post comparing React and Vue performance" instead of "React vs Vue"). You can prepend `category:company` or `category:people` directly inside the query string.
- **`mcp__exa__web_fetch_exa(urls, maxCharacters=3000)`** — fetch full page content as clean markdown for known URLs. Batch multiple URLs in one call.

### When MCP is enough

- Single-shot lookups, factual questions, finding articles, blog posts, code, docs.
- Quick coverage scan: bump `numResults` to 20–50 when the top 10 are noisy.

### When to bypass MCP and call Exa API directly

The MCP tool exposes only `query` and `numResults`. To use **search depth, type, category, date filters, domain include/exclude, structured output, subpage crawling, source preferences** — call the HTTP API.

See **[references/exa.md](references/exa.md)** for the full parameter list, depth tiers (instant / fast / auto / neural / deep-lite / deep / deep-reasoning), and ready-to-use curl recipes. The bundled helper `scripts/exa.sh` wraps the API for common deep-search patterns.

## Tool 2: Tabstack

### HTTP API (the real workhorse)

Base URL `https://api.tabstack.ai/v1`. Auth header `Authorization: Bearer $TABSTACK_API_KEY`. Four endpoints:

| Endpoint              | Purpose                                                                | Streaming |
|-----------------------|------------------------------------------------------------------------|-----------|
| `POST /extract/markdown` | URL → clean markdown (better than `WebFetch`).                       | No        |
| `POST /extract/json`     | URL → structured JSON via your `json_schema`.                        | No        |
| `POST /generate/json`    | URL → AI-transformed JSON via `json_schema` + `instructions`.        | No        |
| `POST /automate`         | Natural-language browser tasks (click, scroll, form, paginate).      | SSE       |
| `POST /research`         | Autonomous research; modes `fast` (default) / `balanced`. With cited sources. | SSE       |

Quick example:

```bash
set -a; source .env.local; set +a
curl -s -X POST 'https://api.tabstack.ai/v1/extract/markdown' \
  -H "Authorization: Bearer $TABSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

See **[references/tabstack.md](references/tabstack.md)** for full request shapes, schema-design tips, SSE consumption, the SDKs, and the MCP "Code Mode" pattern.

### Tabstack MCP (`mcp__tabstack__*`) — what it actually is

The official Tabstack MCP exposes **only two tools**:

- **`search_docs`** — semantic search over the Tabstack SDK docs (TS / Python / Go / Ruby).
- **`execute`** — runs a small TypeScript `run(client)` function in a pre-authenticated sandbox and returns whatever it returns/logs. 30s per HTTP, ~5min total, no filesystem, no network outside Tabstack.

It is a **prototyping/discovery tool**, not a production interface. Use it when:
- You need to figure out the right method or schema interactively.
- You want to test an extraction shape against a real URL before scripting it.

For routine work (one-shot extract, automate, research), prefer direct `curl` against `api.tabstack.ai` — fewer hops, no sandbox limits.

### When to use each Tabstack endpoint

- "Прочитай эту страницу", "extract data from URL" → `/extract/markdown`.
- "Вытащи список товаров со страницы по схеме" → `/extract/json` with `json_schema`.
- "Сделай sales-pitch / резюме / письмо из контента страницы" → `/generate/json` with `instructions`.
- "Пройди пагинацию", "заполни форму", "залогинься и собери", "пройди по всем вкладкам продукта" → `/automate`.
- "Сделай мне ресёрч на тему X с источниками" → first try Exa `type=deep` (cheaper, structured), escalate to `/research` only if Exa is insufficient.

## Tool 3: Parallel

Base `https://api.parallel.ai`, header `x-api-key: $PARALLEL_API_KEY`. Parallel's edge is **auditable output**: tasks return `output.basis` — per-field citations (source URLs) — so sourcing is native, not an afterthought.

| Mode | Endpoint | Use for |
|---|---|---|
| Search | `POST /v1/search` | Point facts / grounding (parity with Exa). **No `max_results`.** |
| Extract | `POST /v1/extract` | Focused excerpts from known URLs (parity with Tabstack extract). |
| **Task enrichment («добор»)** | `POST /v1/tasks/runs` + `task_spec.output_schema` | **Fill a JSON schema over one or many entities, with `basis` citations.** The standout use. |
| Group (batch) | `POST /v1/tasks/groups` | Same enrichment over many records at once. |
| Deep Research | `POST /v1/tasks/runs` `processor:"pro"|"ultra"` | Multi-hop research report with citations. **Gated** (above). |
| FindAll / Entity Search | `POST /v1beta/findall/runs` · `/entity-search` | Verified list of **companies / people** (entity_type only). |
| Monitor | `POST /v1/monitors` | Scheduled query + webhook on change. |

**Processors:** `base`/`core` = enrichment («добор»), cheap & fast, no gating. `pro` ≈ minutes (blocking OK). `ultra*` up to ~2h → use a **webhook**, don't block. Append `-fast` for lower latency.

**The «добор» pattern (the one that earns its keep):** give an `output_schema` (e.g. a `sources[]` array with `url/title/type/lang/date/note`); Parallel fills it AND returns the citing URLs in `output.basis`. Loop it (or Group API) across an entity list to build an analyst-ready, sourced dataset.

```bash
scripts/parallel.py task-src "Bilbao city brand" core      # → structured 4-8 cited sources
scripts/parallel.py search "Official Bilbao brand slogan, year, agency" "Bilbao Bizkaia Be Basque agency"
```

See **[references/parallel.md](references/parallel.md)** for endpoints, schemas, the enrichment recipe, gotchas (`/v1/search` rejects `max_results`; FindAll is companies/people only), and a Parallel-vs-Exa-vs-Tabstack table.

## Combinations (the pair pattern)

Most non-trivial research tasks go through a two-step pipeline:

```
1. Exa search                  → list of relevant URLs (with highlights, scored)
2. Tabstack /extract/markdown  → full clean content of the best URLs
3. Synthesize                  → answer / report / table
```

Use Exa highlights to *triage* (which URLs are worth reading), then Tabstack extract to *deep-read* the winners. This consistently beats either tool alone on:

- Cross-source comparisons (specs, prices, features).
- Market maps and competitor lists.
- Long-form synthesis from multiple sources.
- Anything where the LLM needs full body, not snippet.

**Hybrid with Parallel (the default for big, sourced jobs):** start fast with **Exa** to discover, then **Parallel «добор»** to turn the findings into a structured, *cited* dataset (one row per entity, `basis` URLs attached), and only escalate to **Parallel Deep Research** when the task truly calls for breadth a single pass can't give (gated). Real example: a 74-entity source dataset (≈670 cited URLs) was built by Parallel Task enrichment per entity, with Exa used to backfill the few thin ones — far cleaner than scraping URLs by hand.

For ready-made pipelines (news monitor, market map, source-grounded answer, deep research with structured output, browser automation) see **[references/recipes.md](references/recipes.md)**; for Parallel endpoints/recipes see **[references/parallel.md](references/parallel.md)**.

## Cost discipline

- Exa is the default entry point — cheapest per query.
- Tabstack `/extract/markdown` ≈ $1/1k URLs; `/extract/json` ≈ $5/1k.
- Tabstack `/generate/json` ≈ $5.7/1k.
- Tabstack `/automate` ≈ $7.5/1k actions. Avoid loops without a break condition; cap with `maxIterations` (default 50, max 100).
- Tabstack `/research` ≈ $7.5–15/1k. Only on explicit request, or when Exa `type=deep` is insufficient.
- Tabstack free tier: 50k credits/month. Treat it as a budget, not unlimited.
- **Parallel Search / Extract** — cheap, ~seconds; fine to use freely.
- **Parallel Task enrichment («добор»)** — `base`/`core`, cheap-ish per record and batchable; the high-value default for sourced datasets. No gating.
- **Parallel Deep Research** (`pro`/`ultra`) — the expensive/slow mode. **Gate it** (see the gating rules): run only on explicit request or after a dialog confirmation. `ultra*` → webhook, never block.

Order of preference: Exa first (cheapest discovery) → Tabstack for reading/scraping/clicking → Parallel «добор» for sourced structure → Deep Research last, gated. If a single Exa `type=deep` call answers it, prefer that over any `/research` or Parallel Deep Research.

## Output discipline

- **Synthesize, don't dump.** Search and extraction results are *raw material* — read the highlights and markdown, then write a coherent answer. Never paste tool output verbatim ("here are 5 URLs and their highlights").
- **Answer language ≠ search language.** The *answer* defaults to the user's language. The *search query* should be in whichever language gives the best sources — usually English, even when the user writes in Russian. Search in Russian only when the topic is inherently regional (Russian products, RU news, RU regulations) or the user explicitly asks for Russian sources. URLs and source titles always stay in their original language.
- Always cite source URLs in the answer.
- For structured outputs, prefer Exa `outputSchema` or Tabstack `/extract/json` over post-hoc parsing.
- Keep `json_schema` field descriptions explicit ("instructions, not documentation") — see schema-design tips in `references/tabstack.md`.

## Source archiving (search history)

Whenever a research / scraping / reading task surfaces **important sources** — pages you actually relied on for the answer, key references, anything worth re-reading fully later — **persist them into the project**, don't let them evaporate with the conversation.

Procedure:

1. **Create a materials folder in the current project** (not in `~/.claude`). Default name `research/` (or `sources/`, `materials/` — match the project's existing convention). If a subtopic, use `research/<topic-slug>/`.
2. **Save the full content of each important source** as markdown — fetch it with Tabstack `/extract/markdown` (or `mcp__exa__web_fetch_exa`) and write one file per source: `research/<topic-slug>/<source-slug>.md`. Prepend each file with the source URL, title, and the date fetched, so it stays traceable.
3. **Keep a search-history index** at `research/<topic-slug>/SOURCES.md` (or `_index.md`): the queries you ran, every URL studied (even the ones you didn't save in full), and a one-line note on what each contributed. This is the breadcrumb trail — it lets you (or the user) re-run, expand, or audit the research later.
4. **Save the queries themselves** — the exact Exa/Tabstack search strings used — so the research is reproducible.

When to do this: any multi-source research, market map, competitor analysis, or any task the user is likely to build on. For a one-off quick fact, skip it — but if in doubt, save. Mention in your answer where the materials were saved (`research/<topic-slug>/`).

Goal: every non-trivial research leaves behind a durable, fully-readable local archive of its sources and its search history — so future work can lean on it instead of re-searching from scratch.

## Reference files

- **[references/exa.md](references/exa.md)** — Exa API parameters, depth tiers, curl recipes.
- **[references/tabstack.md](references/tabstack.md)** — Tabstack endpoints, request bodies, SSE consumption, SDKs, MCP Code Mode.
- **[references/parallel.md](references/parallel.md)** — Parallel endpoints, processors, the enrichment («добор») + `basis`-citation pattern, deep-research gating, gotchas, and a Parallel-vs-Exa-vs-Tabstack table.
- **[references/recipes.md](references/recipes.md)** — concrete end-to-end pipelines (news, market map, deep research, browser automation, source-grounded answer).

## Bundled scripts

- **`scripts/exa.sh "<query>" [type] [numResults]`** — thin wrapper around the Exa HTTP API for cases where MCP cannot pass the parameter. Example: `./scripts/exa.sh "Latest LLM benchmarks April 2026" deep 30`.
- **`scripts/tabstack.py`** — Python helper around all four Tabstack endpoints. Parses the lenient JSON correctly (where `curl | jq` would fail). Importable: `from tabstack import extract_markdown, extract_json, research, automate`. CLI: `./scripts/tabstack.py extract-md <url> [country]`, `./scripts/tabstack.py extract-json <url> <schema.json>`, `./scripts/tabstack.py research "<query>" [fast|balanced]`.
- **`scripts/parallel.py`** — stdlib-only Parallel helper (auto-loads `parallel.env`). Importable: `from parallel import search, extract, task, group` (task returns `content`+`basis_urls`). CLI: `./scripts/parallel.py search "<objective>" "<q1>" "<q2>"`, `./scripts/parallel.py task-src "<entity>" [core]` (enrichment «добор» → cited sources), `./scripts/parallel.py task "<input>" [processor]`.
