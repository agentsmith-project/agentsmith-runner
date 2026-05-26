#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "runtime fast: checking source boundary"
node "$repo_root/scripts/check-runner-source-boundary.mjs"

missing=()
if [[ ! -x "$repo_root/node_modules/.bin/tsc" ]]; then
  missing+=("typescript")
fi
if [[ ! -x "$repo_root/node_modules/.bin/vitest" ]]; then
  missing+=("vitest")
fi
if [[ ! -f "$repo_root/node_modules/@mbos/agent-runner-contract/package.json" ]]; then
  missing+=("@mbos/agent-runner-contract")
fi

if [[ "${#missing[@]}" -ne 0 ]]; then
  {
    echo "error: runtime fast dependencies are not installed: ${missing[*]}"
    echo "error: pre-GA @mbos/agent-runner-contract is not published to npm, so npm install alone is not enough."
    echo "error: install dependencies from an explicit runner contract artifact before running this gate."
    echo "hint: npm install --no-save --package-lock=false <mbos-agent-runner-contract.tgz> typescript@5.9.3 vitest@4.0.18 tsx@4.21.0 esbuild@0.25.12 @types/node@24.10.1 @types/ws@8.18.1 node-pty@1.1.0 ws@8.18.3"
  } >&2
  exit 2
fi

echo "runtime fast: checking TypeScript"
npm --prefix "$repo_root" run typecheck

echo "runtime fast: running runner unit tests"
npm --prefix "$repo_root" run test:fast

echo "runtime fast: running builtin skill unit tests"
python3 "$repo_root/builtin-skills/mbos-context/scripts/context_cli_test.py"
python3 "$repo_root/builtin-skills/jira-ops/scripts/jira_ops_test.py"
python3 "$repo_root/builtin-skills/feishu-docs/scripts/feishu_mcp_test.py"

echo "runner runtime fast checks passed"
