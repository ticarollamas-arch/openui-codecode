#!/usr/bin/env bash
set -euo pipefail
# Run this on the persistent executor host, not in a Vercel serverless function.
if ! command -v opencode >/dev/null 2>&1; then
  echo "Install the official OpenCode runtime from https://opencode.ai/docs/ first." >&2
  exit 1
fi
mkdir -p .agents
if [ ! -d .agents/skills/.git ]; then
  rm -rf .agents/skills
  git clone --depth 1 https://github.com/ticarollamas-arch/skills-main.git .agents/skills
fi
mkdir -p ~/.config/opencode
printf '%s\n' 'OpenCode executor initialized. DCP is declared in opencode.json.'
