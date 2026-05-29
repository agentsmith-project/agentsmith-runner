#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  bash scripts/test-runner-image-task-execution-smoke.sh --artifact-root <dir>

Requires Linux/local Docker because the task harness uses docker run --network host.
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -ne 2 || "${1:-}" != "--artifact-root" ]]; then
  usage
  fail "image task-execution smoke requires exactly --artifact-root <dir>"
fi

artifact_root="$(cd "$2" 2>/dev/null && pwd -P)" || fail "artifact-root must be an existing directory"

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
cp -R "$repo_root/builtin-skills" "$build_context/builtin-skills"
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
