#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/verify-release.sh --quick
  bash scripts/verify-release.sh --start-guard
  bash scripts/verify-release.sh --contract-consumer --artifact-root <dir>
  bash scripts/verify-release.sh --image-smoke --artifact-root <dir>
  bash scripts/verify-release.sh --image-task-execution-smoke --artifact-root <dir>
  bash scripts/verify-release.sh --locked-image-task-execution-smoke --artifact-root <dir> --image <digest-pinned-ghcr-image-ref>
  bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
  bash scripts/verify-release.sh --ga-handoff --manifest <manifest-path> --output-dir <dir>
  bash scripts/verify-release.sh --ga-handoff-report --report <runner-ga-handoff-report.json>
  bash scripts/verify-release.sh

Current bootstrap status:
  --quick validates governance skeleton and boundary guardrails only.
  --start-guard validates quick governance plus source-boundary, contract-consumer, and release-manifest startup checks.
    It intentionally excludes runtime fast checks until CI has explicit contract artifact acquisition.
  --contract-consumer validates an explicit runner contract artifact root only.
  --image-smoke builds a local no-push runner image from an explicit runner contract artifact root and checks runtime prerequisites plus missing-env Usage.
  --image-task-execution-smoke builds a local no-push runner image from an explicit runner contract artifact root and runs one fake-Codex task process over a local WebSocket harness.
  --locked-image-task-execution-smoke runs the same fake-Codex task process against an explicit digest-pinned GHCR runner image ref; it skips local build and remains focused/manual only.
  --release-manifest validates an explicit runner release manifest skeleton only.
  --ga-handoff validates an explicit runner release manifest and writes runner-side GA handoff evidence only.
  --ga-handoff-report validates an explicit runner GA handoff report artifact only.
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
  node --check "$repo_root/scripts/check-runner-source-boundary.mjs"
  node "$repo_root/scripts/check-runner-source-boundary.mjs" --self-test
  node "$repo_root/scripts/check-runner-source-boundary.mjs"
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
  bash -n "$repo_root/scripts/test-runner-runtime-fast.sh"
  bash -n "$repo_root/scripts/test-runner-contract-consumer.sh"
  bash -n "$repo_root/scripts/test-runner-image-smoke.sh"
  bash -n "$repo_root/scripts/test-runner-image-task-execution-smoke.sh"
  bash -n "$repo_root/scripts/test-runner-runtime-image-prereq-smoke.sh"
  bash -n "$repo_root/scripts/test-runner-release-manifest.sh"
  bash -n "$repo_root/scripts/test-runner-ga-handoff-report.sh"

  echo "start guard: running quick governance guard"
  bash "$repo_root/scripts/verify-release.sh" --quick

  echo "start guard: checking clean dependency shape syntax"
  node --check "$repo_root/scripts/check-start-guard-clean-deps.mjs"

  echo "start guard: checking clean dependency shape"
  node "$repo_root/scripts/check-start-guard-clean-deps.mjs"

  echo "start guard: checking runner source boundary syntax"
  node --check "$repo_root/scripts/check-runner-source-boundary.mjs"

  echo "start guard: running runner source boundary self-test"
  node "$repo_root/scripts/check-runner-source-boundary.mjs" --self-test

  echo "start guard: checking runner source boundary"
  node "$repo_root/scripts/check-runner-source-boundary.mjs"

  echo "start guard: checking contract consumer syntax"
  node --check "$repo_root/scripts/check-runner-contract-consumer.mjs"

  echo "start guard: checking release manifest syntax"
  node --check "$repo_root/scripts/check-runner-release-manifest.mjs"

  echo "start guard: checking release manifest generator syntax"
  node --check "$repo_root/scripts/write-runner-release-manifest.mjs"

  echo "start guard: checking runner GA handoff report writer syntax"
  node --check "$repo_root/scripts/write-runner-ga-handoff-report.mjs"

  echo "start guard: checking runner GA handoff report checker syntax"
  node --check "$repo_root/scripts/check-runner-ga-handoff-report.mjs"

  echo "start guard: checking image task-execution smoke harness syntax"
  node --check "$repo_root/scripts/runner-task-execution-smoke.mjs"

  echo "start guard: running contract consumer self-test"
  bash "$repo_root/scripts/test-runner-contract-consumer.sh"

  echo "start guard: running release manifest self-test"
  bash "$repo_root/scripts/test-runner-release-manifest.sh"

  echo "start guard: running runner GA handoff report self-test"
  bash "$repo_root/scripts/test-runner-ga-handoff-report.sh"

  echo "runner start guard passed"
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

if [[ "${1:-}" == "--image-smoke" ]]; then
  if [[ $# -ne 3 || "${2:-}" != "--artifact-root" ]]; then
    echo "error: --image-smoke requires exactly --artifact-root <dir>" >&2
    usage >&2
    exit 2
  fi

  bash "$repo_root/scripts/test-runner-image-smoke.sh" --artifact-root "$3"
  exit 0
fi

if [[ "${1:-}" == "--image-task-execution-smoke" ]]; then
  if [[ $# -ne 3 || "${2:-}" != "--artifact-root" ]]; then
    echo "error: --image-task-execution-smoke requires exactly --artifact-root <dir>" >&2
    usage >&2
    exit 2
  fi

  bash "$repo_root/scripts/test-runner-image-task-execution-smoke.sh" --artifact-root "$3"
  exit 0
fi

if [[ "${1:-}" == "--locked-image-task-execution-smoke" ]]; then
  if [[ $# -ne 5 || "${2:-}" != "--artifact-root" || "${4:-}" != "--image" ]]; then
    echo "error: --locked-image-task-execution-smoke requires exactly --artifact-root <dir> --image <digest-pinned-ghcr-image-ref>" >&2
    usage >&2
    exit 2
  fi

  bash "$repo_root/scripts/test-runner-image-task-execution-smoke.sh" --artifact-root "$3" --image "$5"
  exit 0
fi

if [[ "${1:-}" == "--release-manifest" ]]; then
  if [[ $# -ne 3 || "${2:-}" != "--manifest" ]]; then
    echo "error: --release-manifest requires exactly --manifest <manifest-path>" >&2
    usage >&2
    exit 2
  fi

  node "$repo_root/scripts/check-runner-release-manifest.mjs" --manifest "$3"
  echo "Release manifest skeleton check is not release readiness"
  exit 0
fi

if [[ "${1:-}" == "--ga-handoff" ]]; then
  if [[ $# -ne 5 || "${2:-}" != "--manifest" || "${4:-}" != "--output-dir" ]]; then
    echo "error: --ga-handoff requires exactly --manifest <manifest-path> --output-dir <dir>" >&2
    usage >&2
    exit 2
  fi

  node "$repo_root/scripts/check-runner-release-manifest.mjs" --manifest "$3"
  node "$repo_root/scripts/write-runner-ga-handoff-report.mjs" --manifest "$3" --output-dir "$5"
  node "$repo_root/scripts/check-runner-ga-handoff-report.mjs" --report "$5/runner-ga-handoff-report.json"
  echo "Runner GA handoff is not a formal verdict and does not update AgentSmith locks"
  exit 0
fi

if [[ "${1:-}" == "--ga-handoff-report" ]]; then
  if [[ $# -ne 3 || "${2:-}" != "--report" ]]; then
    echo "error: --ga-handoff-report requires exactly --report <runner-ga-handoff-report.json>" >&2
    usage >&2
    exit 2
  fi

  node "$repo_root/scripts/check-runner-ga-handoff-report.mjs" --report "$3"
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
  bash scripts/verify-release.sh --image-smoke --artifact-root <dir>
  bash scripts/verify-release.sh --image-task-execution-smoke --artifact-root <dir>
  bash scripts/verify-release.sh --locked-image-task-execution-smoke --artifact-root <dir> --image <digest-pinned-ghcr-image-ref>
  bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
  bash scripts/verify-release.sh --ga-handoff --manifest <manifest-path> --output-dir <dir>
  bash scripts/verify-release.sh --ga-handoff-report --report <runner-ga-handoff-report.json>

Quick mode is not release readiness.
Start guard is not release readiness.
Runtime fast checks are separate until clean CI has explicit contract artifact acquisition.
Contract consumer mode is not release readiness.
Image smoke is not release readiness.
Image task-execution smoke is not release readiness.
Locked image task-execution smoke is not release readiness.
Release manifest skeleton mode is not release readiness.
Runner GA handoff is not a formal verdict.
Runner GA handoff report check is not a formal verdict.
MESSAGE
exit 2
