#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/verify-release.sh --quick
  bash scripts/verify-release.sh

Current bootstrap status:
  --quick validates governance skeleton and boundary guardrails only.
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

if [[ $# -ne 0 ]]; then
  echo "error: unsupported argument: $1" >&2
  usage >&2
  exit 2
fi

cat >&2 <<'MESSAGE'
error: full release gate is not implemented in bootstrap.

This repo currently supports only:
  bash scripts/verify-release.sh --quick

Quick mode is not release readiness.
MESSAGE
exit 2
