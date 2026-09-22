#!/usr/bin/env bash
# Thin wrapper around the Exa /search HTTP API for parameters the MCP tool
# (mcp__exa__web_search_exa) does not expose.
#
# Usage:
#   ./exa.sh "<query>" [type] [numResults]
#
#   type        one of: instant | fast | auto | neural | deep-lite | deep | deep-reasoning
#               default: auto
#   numResults  1-100, default 10
#
# Examples:
#   ./exa.sh "Latest LLM benchmarks April 2026" deep 30
#   ./exa.sh "vector database P95 latency comparison" deep-reasoning 20
#   ./exa.sh "What is the capital of France?" instant 5
#
# For category, dates, includeDomains, outputSchema and other advanced fields,
# build the JSON body yourself — this script is intentionally minimal.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 \"<query>\" [type] [numResults]" >&2
  exit 64
fi

QUERY="$1"
TYPE="${2:-auto}"
NUM="${3:-10}"

# Source the API key file if EXA_API_KEY is not already in env.
if [[ -z "${EXA_API_KEY:-}" ]]; then
  KEYS_FILE=".env.local"
  if [[ -f "$KEYS_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$KEYS_FILE"
  fi
fi

if [[ -z "${EXA_API_KEY:-}" ]]; then
  echo "EXA_API_KEY is not set and .env.local is missing." >&2
  exit 1
fi

BODY=$(jq -n \
  --arg q "$QUERY" \
  --arg t "$TYPE" \
  --argjson n "$NUM" \
  '{
    query: $q,
    type: $t,
    numResults: $n,
    contents: { text: true, highlights: true }
  }')

curl -sS -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
