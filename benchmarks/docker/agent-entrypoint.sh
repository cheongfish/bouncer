#!/bin/sh
set -eu

if [ ! -s /run/secrets/cursor_api_key ]; then
  echo 'Cursor API key secret is missing or empty' >&2
  exit 2
fi

export CURSOR_API_KEY="$(cat /run/secrets/cursor_api_key)"
export CURSOR_CONFIG_DIR="$HOME/.cursor"

# One print-mode turn inside a long-lived stage container (docker exec). The prompt arrives on stdin, extra
# arguments such as --resume <chat-id> pass through, and the caller's working directory is kept.
if [ "${1:-}" = "--turn" ] && [ "$#" -ge 2 ]; then
  model="$2"
  shift 2
  prompt="$(cat)"
  set -- -p --force --trust --output-format stream-json --model "$model" "$@" "$prompt"
  if [ -n "${BOUNCER_HOME:-}" ]; then
    set -- --plugin-dir "$BOUNCER_HOME" "$@"
  fi
  exec cursor-agent "$@"
fi

cd /workspace

if [ "${1:-}" = "--acp" ] && [ "$#" -eq 2 ]; then
  if [ -n "${BOUNCER_HOME:-}" ]; then
    exec cursor-agent --plugin-dir "$BOUNCER_HOME" --model "$2" acp
  fi
  exec cursor-agent --model "$2" acp
fi

if [ "$#" -ne 2 ]; then
  echo 'usage: benchmark-agent <model> <prompt-file> | --acp <model>' >&2
  exit 2
fi
if [ ! -s "$2" ]; then
  echo 'prompt file is missing or empty' >&2
  exit 2
fi

set -- -p --force --trust --output-format stream-json --model "$1" "$(cat "$2")"
if [ -n "${BOUNCER_HOME:-}" ]; then
  set -- --plugin-dir "$BOUNCER_HOME" "$@"
fi
exec cursor-agent "$@"
