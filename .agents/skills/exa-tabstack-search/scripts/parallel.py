#!/usr/bin/env python3
"""Parallel web API helper (stdlib only — no pip installs needed).

Loads PARALLEL_API_KEY from the environment or the project's .env.local.
Auth header is `x-api-key`. Base: https://api.parallel.ai

Importable:
    from parallel import search, extract, task, group
CLI:
    parallel.py search   "<objective>" "<q1>" "<q2>"
    parallel.py extract  "<url>" ["<objective>"]
    parallel.py task     "<input text>" [processor]            # auto schema, prints content+basis
    parallel.py task-src "<entity>" [processor]                # enrichment 'добор': 4-8 source URLs

Notes / gotchas:
  - /v1/search does NOT accept `max_results` (HTTP 422). Use mode/processor to tune.
  - FindAll / Entity Search only support entity_type companies|people — for topics/places use `task`.
  - Deep Research = `task(..., processor="pro"|"ultra")`. GATE it (see SKILL.md): only run a deep
    processor when the user asked for deep research, or after explicit confirmation. `core`/`base`
    enrichment ('добор') needs no gate — it is the cheap, high-value default for structured sources.
"""
import os, sys, json, time, urllib.request, urllib.error

BASE = "https://api.parallel.ai"


def _key():
    k = os.environ.get("PARALLEL_API_KEY")
    if k:
        return k
    env = os.path.join(os.getcwd(), ".env.local")
    if os.path.exists(env):
        for line in open(env):
            line = line.strip()
            if line.lstrip("export ").startswith("PARALLEL_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("PARALLEL_API_KEY not set and not found in .env.local")


def _req(method, path, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"x-api-key": _key(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} {path}: {e.read()[:400].decode(errors='ignore')}")


# ---------- Search (one round-trip, cited excerpts) ----------
def search(objective, queries):
    """objective = full-sentence goal; queries = 2-3 short keyword queries (NO max_results)."""
    return _req("POST", "/v1/search", {"objective": objective, "search_queries": list(queries)})


# ---------- Extract (URL -> clean excerpts, optionally focused) ----------
def extract(urls, objective=None):
    body = {"urls": urls if isinstance(urls, list) else [urls]}
    if objective:
        body["objective"] = objective
    return _req("POST", "/v1/extract", body)


# ---------- Task (enrichment / deep research) ----------
def task(input_value, schema=None, processor="core", poll=10, timeout=3600):
    """Create a task run, poll to completion, return {content, basis_urls, raw}.

    processor: lite|base|core|core2x|pro|ultra|ultra2x|ultra4x|ultra8x (+ '-fast').
      core/base = enrichment 'добор' (cheap, fast).  pro/ultra = deep research (GATE it).
    schema: optional JSON Schema dict -> forces structured output_schema.
    """
    body = {"processor": processor, "input": input_value}
    if schema is not None:
        body["task_spec"] = {"output_schema": {"type": "json", "json_schema": schema}}
    run = _req("POST", "/v1/tasks/runs", body)
    rid = run["run_id"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        st = _req("GET", f"/v1/tasks/runs/{rid}")
        if st.get("status") in ("completed", "failed", "cancelled"):
            break
        time.sleep(poll)
    res = _req("GET", f"/v1/tasks/runs/{rid}/result")
    out = res.get("output", {})
    basis_urls = []
    for f in (out.get("basis") or []):
        for c in (f.get("citations") or []):
            if c.get("url"):
                basis_urls.append(c["url"])
    return {"content": out.get("content"), "basis_urls": sorted(set(basis_urls)),
            "run_id": rid, "status": st.get("status")}


# ---------- Group API (batch enrichment over many records) ----------
def group(items, schema, processor="core", poll=10, timeout=3600):
    """items: list of dicts (each becomes a task input). Returns list of {content, basis_urls}.

    Simple, robust implementation: fan out individual task runs and collect. For very large
    batches the native /v1/tasks/groups endpoint exists; this stdlib helper loops task().
    """
    out = []
    for it in items:
        out.append(task(it, schema=schema, processor=processor, poll=poll, timeout=timeout))
    return out


# Reusable schema: 'добор' — 4-8 varied source URLs about an entity (with per-field citations in basis)
SOURCES_SCHEMA = {
    "type": "object",
    "properties": {
        "sources": {
            "type": "array",
            "description": ("4 to 8 real, working web sources about this entity AND its broader themes. "
                            "Include at least one primary source (official site / agency case). Prefer also "
                            "interviews, analytical articles, and context pieces so an analyst can read primary material."),
            "items": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Full working https URL"},
                    "title": {"type": "string", "description": "Real page/article title"},
                    "type": {"type": "string", "description": "official|agency|interview|analysis|context|paper"},
                    "lang": {"type": "string", "description": "ru|en|..."},
                    "date": {"type": "string", "description": "year if known else empty"},
                    "note": {"type": "string", "description": "one short phrase: what's inside / why useful"},
                },
                "required": ["url", "title", "type", "lang", "date", "note"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["sources"],
    "additionalProperties": False,
}


def _main(argv):
    if not argv:
        print(__doc__)
        return
    cmd = argv[0]
    if cmd == "search":
        obj = argv[1]
        qs = argv[2:] or [obj]
        r = search(obj, qs)
        for x in r.get("results", [])[:8]:
            print("•", x.get("title"), "—", x.get("url"))
            for e in (x.get("excerpts") or [])[:1]:
                print("   ", e[:240].replace("\n", " "))
    elif cmd == "extract":
        r = extract(argv[1], argv[2] if len(argv) > 2 else None)
        for x in r.get("results", []):
            print("•", x.get("title"), "—", x.get("url"))
            for e in (x.get("excerpts") or [])[:2]:
                print("   ", e[:240].replace("\n", " "))
    elif cmd == "task":
        proc = argv[2] if len(argv) > 2 else "core"
        r = task(argv[1], processor=proc)
        print("status:", r["status"])
        print(json.dumps(r["content"], ensure_ascii=False, indent=1)[:3000])
        print("basis URLs:", len(r["basis_urls"]))
        for u in r["basis_urls"][:20]:
            print("  -", u)
    elif cmd == "task-src":
        proc = argv[2] if len(argv) > 2 else "core"
        r = task({"entity": argv[1],
                  "instruction": "Find 4-8 varied source URLs (official, agency, interview, analysis, context)."},
                 schema=SOURCES_SCHEMA, processor=proc)
        print(json.dumps(r["content"], ensure_ascii=False, indent=1))
    else:
        print(__doc__)


if __name__ == "__main__":
    _main(sys.argv[1:])
