#!/usr/bin/env python3
"""Tabstack helper — thin wrapper around the four HTTP endpoints.

Why this exists: Tabstack's /extract/markdown returns non-standard JSON
(unescaped \\n and broken \\escape inside the content field), which makes
`curl | jq` and strict `json.loads()` fail. `requests.json()` is lenient
enough to parse it, so this helper is the safest path from bash/python.

Reads TABSTACK_API_KEY from env. If not set, attempts to source
.env.local via subprocess.

Usage from CLI (smoke tests):
    ./tabstack.py extract-md  https://example.com
    ./tabstack.py extract-json https://en.wikipedia.org/wiki/Lisbon  schema.json
    ./tabstack.py research    "What is the EU AI Act enforcement status?"  fast

Usage as a library:
    from tabstack import extract_markdown, extract_json, research, automate
    md   = extract_markdown(url, geo_target="RU")
    data = extract_json(url, schema=...)
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Iterator

try:
    import requests
except ImportError:
    print("requests not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

BASE = "https://api.tabstack.ai/v1"
SECRETS = Path.cwd() / ".env.local"


def _load_key() -> str:
    key = os.environ.get("TABSTACK_API_KEY")
    if key:
        return key
    if SECRETS.exists():
        for line in SECRETS.read_text().splitlines():
            if line.strip().lstrip("export ").startswith("TABSTACK_API_KEY="):
                # parse: export TABSTACK_API_KEY="..."
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                os.environ["TABSTACK_API_KEY"] = value
                return value
    raise RuntimeError(
        f"TABSTACK_API_KEY not set and {SECRETS} missing or unreadable"
    )


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_load_key()}",
        "Content-Type": "application/json",
    }


def extract_markdown(
    url: str,
    *,
    metadata: bool = True,
    effort: str = "standard",
    nocache: bool = False,
    geo_target: str | None = None,
    timeout: int = 60,
) -> dict:
    """POST /extract/markdown. Returns {url, content, metadata?}."""
    body: dict[str, Any] = {"url": url, "metadata": metadata, "effort": effort}
    if nocache:
        body["nocache"] = True
    if geo_target:
        body["geoTarget"] = {"country": geo_target}
    r = requests.post(f"{BASE}/extract/markdown", headers=_headers(), json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()


def extract_json(
    url: str,
    schema: dict,
    *,
    effort: str = "standard",
    nocache: bool = False,
    geo_target: str | None = None,
    timeout: int = 90,
) -> dict:
    """POST /extract/json. Returns the schema-shaped object directly."""
    body: dict[str, Any] = {"url": url, "json_schema": schema, "effort": effort}
    if nocache:
        body["nocache"] = True
    if geo_target:
        body["geoTarget"] = {"country": geo_target}
    r = requests.post(f"{BASE}/extract/json", headers=_headers(), json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()


def generate_json(
    url: str,
    schema: dict,
    instructions: str,
    *,
    nocache: bool = False,
    geo_target: str | None = None,
    timeout: int = 120,
) -> dict:
    """POST /generate/json — extract + transform with AI instructions."""
    body: dict[str, Any] = {
        "url": url,
        "json_schema": schema,
        "instructions": instructions,
    }
    if nocache:
        body["nocache"] = True
    if geo_target:
        body["geoTarget"] = {"country": geo_target}
    r = requests.post(f"{BASE}/generate/json", headers=_headers(), json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()


def _stream_sse(endpoint: str, body: dict, timeout: int) -> Iterator[tuple[str, dict]]:
    """Generic SSE consumer. Yields (event_name, data_dict) tuples."""
    with requests.post(
        f"{BASE}/{endpoint}",
        headers=_headers(),
        json=body,
        stream=True,
        timeout=timeout,
    ) as r:
        r.raise_for_status()
        event = None
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                event = None
                continue
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: ") and event:
                payload_raw = line[6:]
                try:
                    payload = json.loads(payload_raw)
                except Exception:
                    payload = {"_raw": payload_raw}
                yield event, payload


def automate(
    task: str,
    *,
    url: str | None = None,
    data: dict | None = None,
    geo_target: str | None = None,
    guardrails: str | None = None,
    max_iterations: int = 30,
    timeout: int = 300,
) -> Iterator[tuple[str, dict]]:
    """POST /automate. Yields SSE events. Caller should look for 'complete'."""
    body: dict[str, Any] = {"task": task, "maxIterations": max_iterations}
    if url:
        body["url"] = url
    if data:
        body["data"] = data
    if geo_target:
        body["geoTarget"] = {"country": geo_target}
    if guardrails:
        body["guardrails"] = guardrails
    yield from _stream_sse("automate", body, timeout)


def research(
    query: str,
    *,
    mode: str = "fast",
    nocache: bool = False,
    fetch_timeout: int | None = None,
    timeout: int = 300,
) -> Iterator[tuple[str, dict]]:
    """POST /research. Yields SSE events. mode: 'fast' or 'balanced'."""
    body: dict[str, Any] = {"query": query, "mode": mode}
    if nocache:
        body["nocache"] = True
    if fetch_timeout:
        body["fetch_timeout"] = fetch_timeout
    yield from _stream_sse("research", body, timeout)


# --- CLI -----------------------------------------------------------------

def _cli() -> None:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(64)
    cmd = sys.argv[1]
    args = sys.argv[2:]
    if cmd == "extract-md":
        url = args[0]
        geo = args[1] if len(args) > 1 else None
        result = extract_markdown(url, geo_target=geo)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif cmd == "extract-json":
        url, schema_path = args[0], args[1]
        schema = json.loads(Path(schema_path).read_text())
        result = extract_json(url, schema)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif cmd == "research":
        query = args[0]
        mode = args[1] if len(args) > 1 else "fast"
        for event, data in research(query, mode=mode):
            print(f"[{event}] {json.dumps(data, ensure_ascii=False)[:400]}")
            if event in ("complete", "done", "error"):
                break
    else:
        print(f"unknown cmd: {cmd}", file=sys.stderr)
        sys.exit(64)


if __name__ == "__main__":
    _cli()
