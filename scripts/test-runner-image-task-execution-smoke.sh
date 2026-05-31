#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  bash scripts/test-runner-image-task-execution-smoke.sh --artifact-root <dir>
  bash scripts/test-runner-image-task-execution-smoke.sh --artifact-root <dir> --image <digest-pinned-ghcr-image-ref>
  bash scripts/test-runner-image-task-execution-smoke.sh --self-test

Requires Linux/local Docker because the task harness uses docker run --network host.
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
locked_image_ref_pattern='^ghcr[.]io/agentsmith-project/agentsmith-runner:([A-Za-z0-9_][A-Za-z0-9._-]{0,127})@sha256:([a-f0-9]{64})$'

locked_image_ref_error() {
  local image="$1"
  if [[ ! "$image" =~ $locked_image_ref_pattern ]]; then
    printf '%s\n' "locked image must be ghcr.io/agentsmith-project/agentsmith-runner:<safe-tag>@sha256:<64 lowercase hex>"
    return 0
  fi
  local tag="${BASH_REMATCH[1]}"
  local tag_lower
  tag_lower="$(printf '%s' "$tag" | tr '[:upper:]' '[:lower:]')"
  if [[ "$tag_lower" == "latest" ]]; then
    printf '%s\n' "locked image must not use latest"
    return 0
  fi
  return 1
}

validate_locked_image_ref() {
  local image="$1"
  local error
  if error="$(locked_image_ref_error "$image")"; then
    fail "$error"
  fi
}

run_self_test() {
  local digest
  digest="$(printf 'a%.0s' {1..64})"
  local valid="ghcr.io/agentsmith-project/agentsmith-runner:release-p5-smoke@sha256:$digest"
  local latest_tag="lat""est"
  local error

  if error="$(locked_image_ref_error "$valid")"; then
    fail "self-test expected valid locked image ref to pass: $error"
  fi

  local invalid_refs=(
    "ghcr.io/agentsmith-project/agentsmith-runner:release-p5-smoke"
    "ghcr.io/agentsmith-project/agentsmith-runner:$latest_tag@sha256:$digest"
    "ghcr.io/agentsmith-project/old-runner:release-p5-smoke@sha256:$digest"
    "agentsmith-runner:release-p5-smoke@sha256:$digest"
    "ghcr.io/agentsmith-project/agentsmith-runner:release-p5-smoke@sha256:$(printf 'A%.0s' {1..64})"
  )
  for image in "${invalid_refs[@]}"; do
    if ! error="$(locked_image_ref_error "$image")"; then
      fail "self-test expected locked image ref rejection: $image"
    fi
    if [[ -z "$error" ]]; then
      fail "self-test rejection message must be non-empty for: $image"
    fi
  done

  node "$repo_root/scripts/runner-task-execution-smoke.mjs" --self-test

  echo "image task-execution smoke script self-test passed"
}

if [[ "${1:-}" == "--self-test" ]]; then
  if [[ $# -ne 1 ]]; then
    usage
    fail "--self-test does not accept extra arguments"
  fi
  run_self_test
  exit 0
fi

mode="local-build"
artifact_root_arg=""
image_ref=""
if [[ $# -eq 2 && "${1:-}" == "--artifact-root" ]]; then
  artifact_root_arg="$2"
elif [[ $# -eq 4 && "${1:-}" == "--artifact-root" && "${3:-}" == "--image" ]]; then
  mode="locked-image"
  artifact_root_arg="$2"
  image_ref="$4"
  validate_locked_image_ref "$image_ref"
else
  usage
  fail "image task-execution smoke requires --artifact-root <dir> or --artifact-root <dir> --image <digest-pinned-ghcr-image-ref>"
fi

artifact_root="$(cd "$artifact_root_arg" 2>/dev/null && pwd -P)" || fail "artifact-root must be an existing directory"

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is required for runner image task-execution smoke"
fi

if ! (
  cd "$repo_root"
  node --input-type=module -e "await import('ws')"
) >/dev/null 2>&1; then
  fail "node dependency 'ws' is required; install runner dependencies before running this focused smoke"
fi

bash "$repo_root/scripts/verify-release.sh" --contract-consumer --artifact-root "$artifact_root"

if [[ "$mode" == "locked-image" ]]; then
  node "$repo_root/scripts/runner-task-execution-smoke.mjs" \
    --image "$image_ref" \
    --artifact-root "$artifact_root"

  echo "locked image task-execution smoke passed"
  echo "Locked image task-execution smoke is focused/manual only; it is not backend-real, real LLM, GHCR publish, AgentSmith adoption, or release readiness."
  exit 0
fi

descriptor_values="$(
  node - "$artifact_root" <<'NODE'
const { readFileSync } = require('node:fs');
const { basename, join } = require('node:path');

const artifactRoot = process.argv[2];
const descriptor = JSON.parse(readFileSync(join(artifactRoot, 'runner-contract-artifact.json'), 'utf8'));
const filename = descriptor?.artifact?.filename;
if (typeof filename !== 'string' || filename.length === 0 || filename !== basename(filename)) {
  throw new Error('runner-contract-artifact.json artifact.filename must be a tgz basename');
}
console.log(filename);
console.log(join(artifactRoot, filename));
NODE
)"
artifact_filename="$(printf '%s\n' "$descriptor_values" | sed -n '1p')"
artifact_tgz="$(printf '%s\n' "$descriptor_values" | sed -n '2p')"

if [[ ! -f "$artifact_tgz" ]]; then
  fail "artifact tgz is missing under artifact-root: $artifact_filename"
fi

tmp_root="$(mktemp -d)"
build_context="$tmp_root/context"
mkdir -p "$build_context/contract-artifact"

image_tag="agentsmith-runner-image-task-execution-smoke:smoke-$(date +%s)-$$"

cleanup() {
  docker image rm "$image_tag" >/dev/null 2>&1 || true
  rm -rf "$tmp_root"
}
trap cleanup EXIT

cp "$repo_root/Dockerfile" "$build_context/Dockerfile"
cp "$repo_root/package.json" "$build_context/package.json"
cp "$repo_root/tsconfig.json" "$build_context/tsconfig.json"
cp -R "$repo_root/src" "$build_context/src"
mkdir -p "$build_context/builtin-skills"
cp "$repo_root/builtin-skills/README.md" "$build_context/builtin-skills/README.md"
cp -R "$repo_root/builtin-skills/mbos-context" "$build_context/builtin-skills/mbos-context"
cp -R "$repo_root/builtin-skills/.mbos-runtime" "$build_context/builtin-skills/.mbos-runtime"
cp "$artifact_tgz" "$build_context/contract-artifact/$artifact_filename"

contract_build_arg="contract-artifact/$artifact_filename"

if docker buildx version >/dev/null 2>&1; then
  docker buildx build \
    --load \
    --tag "$image_tag" \
    --build-arg "CONTRACT_TGZ=$contract_build_arg" \
    "$build_context"
else
  docker build \
    --tag "$image_tag" \
    --build-arg "CONTRACT_TGZ=$contract_build_arg" \
    "$build_context"
fi

node "$repo_root/scripts/runner-task-execution-smoke.mjs" \
  --image "$image_tag" \
  --artifact-root "$artifact_root"

echo "image task-execution smoke passed"
echo "Image task-execution smoke is not backend-real, release readiness, GHCR publish, or AgentSmith adoption."
