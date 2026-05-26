#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/verify-release.sh --quick
  bash scripts/verify-release.sh --start-guard
  bash scripts/verify-release.sh --contract-consumer --artifact-root <dir>
  bash scripts/verify-release.sh

Current bootstrap status:
  --quick validates governance skeleton and boundary guardrails only.
  --start-guard validates quick governance plus local contract-consumer startup checks.
  --contract-consumer validates an explicit runner contract artifact root only.
  Full release mode is intentionally not implemented during bootstrap.
USAGE
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--quick" ]]; then
  if [[ $# -ne 1 ]]; then
    echo "error: --quick does not accept extra arguments" >&2
    usage >&2
    exit 2
  fi

  bash -n "$repo_root/scripts/check-governance-guard.sh"
  bash "$repo_root/scripts/check-governance-guard.sh"
  echo "quick governance check passed"
  echo "quick mode is not release readiness"
  exit 0
fi

if [[ "${1:-}" == "--start-guard" ]]; then
  if [[ $# -ne 1 ]]; then
    echo "error: --start-guard does not accept extra arguments" >&2
    usage >&2
    exit 2
  fi

  echo "start guard: running shell syntax checks"
  bash -n "$repo_root/scripts/verify-release.sh"
  bash -n "$repo_root/scripts/check-governance-guard.sh"
  bash -n "$repo_root/scripts/test-runner-contract-consumer.sh"

  echo "start guard: running quick governance guard"
  bash "$repo_root/scripts/verify-release.sh" --quick

  echo "start guard: checking contract consumer syntax"
  node --check "$repo_root/scripts/check-runner-contract-consumer.mjs"

  echo "start guard: running contract consumer self-test"
  bash "$repo_root/scripts/test-runner-contract-consumer.sh"

  echo "contract consumer start guard passed"
  echo "Start guard is not release readiness"
  exit 0
fi

if [[ "${1:-}" == "--contract-consumer" ]]; then
  if [[ $# -ne 3 || "${2:-}" != "--artifact-root" ]]; then
    echo "error: --contract-consumer requires exactly --artifact-root <dir>" >&2
    usage >&2
    exit 2
  fi

  node "$repo_root/scripts/check-runner-contract-consumer.mjs" --artifact-root "$3"
  exit 0
fi

if [[ $# -ne 0 ]]; then
  echo "error: unsupported argument: $1" >&2
  usage >&2
  exit 2
fi

cat >&2 <<'MESSAGE'
error: full release gate is not implemented in bootstrap.

This repo currently supports only:
  bash scripts/verify-release.sh --quick
  bash scripts/verify-release.sh --start-guard
  bash scripts/verify-release.sh --contract-consumer --artifact-root <dir>

Quick mode is not release readiness.
Start guard is not release readiness.
Contract consumer mode is not release readiness.
MESSAGE
exit 2
