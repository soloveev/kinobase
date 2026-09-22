# Recipes — end-to-end pipelines

Seven concrete patterns that combine Exa + Tabstack (or use one of them solo). Copy a recipe, swap in the actual query/schema, run. For **Parallel** patterns — structured enrichment with cited sources («добор»), deep research (gated), entity discovery — see **[parallel.md](parallel.md)**.

> ⚠ **Tabstack `/extract/markdown` returns non-standard JSON** (raw `\n` and broken `\escape` inside the `content` field). `curl … | jq` and `python json.loads()` (strict) **will fail** on real pages. Always parse via `python -c "import requests; r.json()"` (lenient) or use the bundled `scripts/tabstack.py` helper. The recipes below already use the safe pattern.

Each recipe assumes:

```bash
set -a; source .env.local; set +a
```

---

## 1. Source-grounded answer (the default)

When the user asks a substantive question and wants an answer with citations.

**Pipeline**: Exa search → triage by highlights → Tabstack extract on the winners → synthesize.

```bash
# Step 1: find candidate URLs (use MCP)
# mcp__exa__web_search_exa(query, numResults=15)
```

```python
# Step 2: full-text the best 3-5 URLs in parallel via python+requests.
import os, concurrent.futures, requests

KEY = os.environ["TABSTACK_API_KEY"]
URLS = [
    "https://a.example/article",
    "https://b.example/post",
    "https://c.example/paper",
]

def extract(u):
    r = requests.post("https://api.tabstack.ai/v1/extract/markdown",
                      headers={"Authorization": f"Bearer {KEY}"},
                      json={"url": u},
                      timeout=60)
    return u, r.json()["content"]   # requests.json() handles Tabstack's loose JSON

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(extract, URLS))
# Step 3: feed the markdown blobs to the LLM as context.
```

When to skip Tabstack: if Exa highlights are clearly enough (single-fact questions). When to bump to Tabstack `/research`: if cross-source synthesis is the entire point and Exa `type=deep` did not produce a satisfactory answer.

---

## 2. Fresh news monitor (date-windowed)

When the user wants "what happened this week / month with X".

```bash
# Direct Exa API - MCP cannot pass dates or category
curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Latest GPT-5 launch coverage",
    "type": "auto",
    "category": "news",
    "startPublishedDate": "2026-04-01T00:00:00.000Z",
    "endPublishedDate":   "2026-05-08T00:00:00.000Z",
    "numResults": 30,
    "contents": { "highlights": true }
  }' | jq '.results[] | {title, url, publishedDate, highlights}'
```

Bump `numResults` to 50–100 if you need exhaustive coverage. Combine with `includeDomains` if the user trusts a specific set of outlets.

---

## 3. Market / competitor map

When the user wants a list of companies in a niche.

```bash
# Direct Exa API - need category + summary schema
curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "AI design-to-code generation startups",
    "type": "auto",
    "category": "company",
    "numResults": 50,
    "contents": {
      "summary": {
        "query": "What this company does, target users, funding stage",
        "schema": {
          "type": "object",
          "properties": {
            "what":      { "type": "string" },
            "audience":  { "type": "string" },
            "funding":   { "type": "string" }
          },
          "required": ["what"]
        }
      },
      "extras": { "links": 1 }
    }
  }'
```

Result: 50 companies × structured summary, ready to dedupe and rank. If you need pricing or specific feature comparisons across them, follow up with Tabstack `/extract/json` on each company's pricing page.

---

## 4. Deep research with structured output (Exa-deep)

When the user wants a single synthesised answer backed by sources, **and** wants it as JSON.

Try this first before reaching for Tabstack `/research`.

```bash
curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Compare top 3 vector databases by P95 query latency at 100M vectors, May 2026",
    "type": "deep",
    "additionalQueries": [
      "vector database benchmarks 2026",
      "Pinecone vs Weaviate vs Qdrant latency",
      "100M vector ANN search benchmarks"
    ],
    "systemPrompt": "Prefer official benchmarks and primary sources; avoid duplicates and marketing pages.",
    "outputSchema": {
      "type": "object",
      "properties": {
        "winner":    { "type": "string" },
        "rankings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name":        { "type": "string" },
              "p95_ms":      { "type": "number" },
              "source_url":  { "type": "string" }
            },
            "required": ["name", "p95_ms", "source_url"]
          }
        }
      },
      "required": ["winner", "rankings"]
    },
    "contents": { "text": true }
  }'
```

If Exa-deep cannot answer (e.g. needs to actually scroll a page mid-research), escalate to Tabstack `/research`.

---

## 5. Browser automation (Tabstack /automate)

When the answer requires interacting with a page Exa cannot reach (filters, login walls, paginated lists, multi-step flows).

```bash
curl -N -s -X POST 'https://api.tabstack.ai/v1/automate' \
  -H "Authorization: Bearer $TABSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "task": "Log in is not required. Filter search results by '\''Past 24 hours'\''. Paginate through all result pages. Collect every title, URL, and published date.",
    "url": "https://search.example.com/?q=ai+regulation",
    "maxIterations": 40,
    "guardrails": "Never click ads. Never click '\''Sign up'\''."
  }' \
| awk '
    /^event: complete$/ { reading=1; next }
    reading && /^data: / { sub(/^data: /, ""); print; exit }
'
```

Always cap `maxIterations`. Always set `guardrails`. For complex stateful flows prefer the SDK so you can read the typed event stream.

---

## 6. Schema-shaped scrape (Tabstack /extract/json)

When you have one or more URLs and want a structured table out of them.

```python
import os, requests

KEY = os.environ["TABSTACK_API_KEY"]
URL = "https://competitor.com/pricing"
SCHEMA = {
    "type": "object",
    "description": "A SaaS pricing page. Extract every plan visible on the page.",
    "properties": {
        "plans": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name":      {"type": "string", "description": "Plan name as shown"},
                    "price_usd": {"type": ["number", "null"], "description": "Monthly USD; null if custom or contact-sales"},
                    "billing":   {"type": "string", "enum": ["monthly", "annual", "one-time", "custom"]},
                    "features":  {"type": "array", "items": {"type": "string"}}
                },
                "required": ["name"]
            }
        }
    },
    "required": ["plans"]
}

r = requests.post("https://api.tabstack.ai/v1/extract/json",
                  headers={"Authorization": f"Bearer {KEY}"},
                  json={"url": URL, "json_schema": SCHEMA, "effort": "standard"},
                  timeout=90)
data = r.json()  # /extract/json returns clean JSON, no parsing surprises
```

Quality knobs in order of impact:

1. Sharper `description` on every field.
2. `effort: "max"` for heavy JS pages.
3. Drop fields you do not need.
4. `nocache: true` if results look stale.

Run in batch: parallelise via `concurrent.futures.ThreadPoolExecutor`.

---

## 7. Russian / regional sources (geoTarget)

When the URL is on a site that aggressively blocks data-center IPs (yandex.ru, vk.com, mail.ru, sberbank.ru and similar Russian corporate sites — and equivalents in other regions).

```python
import os, requests

KEY = os.environ["TABSTACK_API_KEY"]

# Without geoTarget you typically get a captcha page (~400 chars,
# "обратной связи" text, no real content).
r = requests.post("https://api.tabstack.ai/v1/extract/markdown",
                  headers={"Authorization": f"Bearer {KEY}"},
                  json={
                      "url": "https://yandex.ru/company/news/01-15-04-2025",
                      "geoTarget": {"country": "RU"}
                  },
                  timeout=90)
content = r.json()["content"]
```

Heuristic: independent Russian blogs (`itzine.ru`, `habr.com`) usually work without `geoTarget`; large RU corporates require it. The same pattern applies to large CN sites (try `geoTarget: { country: "CN" }`) and any other strict regional CDN.

If Tabstack still returns a captcha or block page even with `geoTarget`:
1. Try `effort: "max"`.
2. Try `nocache: true` (the cached result may be the captcha from a previous attempt).
3. Fall back to Exa highlights (Exa has its own crawl infrastructure with different IP reputation) and reconstruct from there.

---

## Heuristics: which recipe for what request

| User says...                                    | Recipe                          |
|-------------------------------------------------|---------------------------------|
| "найди в интернете и расскажи..."               | 1 (source-grounded answer)      |
| "что нового по теме X за последний месяц"       | 2 (news monitor)                |
| "карта рынка / список компаний по теме"         | 3 (market map)                  |
| "сделай ресёрч на тему X"                       | 4 first; escalate to /research  |
| "пройди по сайту, собери список / зайди в...    | 5 (automate)                    |
| "вытащи цены / характеристики / список со страницы" | 6 (schema-shaped scrape)    |
| URL на yandex.ru / vk.com / sberbank.ru и т.п.  | 7 (geoTarget RU) перед любым из 1–6 |
