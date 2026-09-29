#!/usr/bin/env bash
set -u

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root" || exit 1

if [[ $# -gt 1 || ( $# -eq 1 && $1 != --dry-run ) ]]; then
  echo "usage: $0 [--dry-run]" >&2
  exit 2
fi

model=cursor-grok-4.5-high
key_file="$HOME/.config/bouncer-benchmark/cursor-api-key"
pair_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"

args=(--model "$model")
if [[ ${1:-} == --dry-run ]]; then
  args+=(--dry-run true)
else
  args+=(--key-file "$key_file")
fi

node benchmarks/run-cursor.cjs \
  --condition vanilla \
  --run-id "$pair_id-vanilla" \
  "${args[@]}"
vanilla_status=$?

node benchmarks/run-cursor.cjs \
  --condition bouncer-full \
  --run-id "$pair_id-bouncer-full" \
  "${args[@]}"
bouncer_status=$?

if [[ $vanilla_status -ne 0 || $bouncer_status -ne 0 ]]; then
  echo "vanilla exit: $vanilla_status; bouncer-full exit: $bouncer_status" >&2
  exit 1
fi
