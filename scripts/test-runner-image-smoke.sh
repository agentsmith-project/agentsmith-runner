#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  bash scripts/test-runner-image-smoke.sh --artifact-root <dir>
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -ne 2 || "${1:-}" != "--artifact-root" ]]; then
  usage
  fail "image smoke requires exactly --artifact-root <dir>"
fi

artifact_root="$(cd "$2" 2>/dev/null && pwd -P)" || fail "artifact-root must be an existing directory"

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is required for runner image smoke"
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
run_stdout="$tmp_root/run.stdout"
run_stderr="$tmp_root/run.stderr"
mkdir -p "$build_context/contract-artifact"

image_tag="agentsmith-runner-image-smoke:smoke-$(date +%s)-$$"

cleanup() {
  docker image rm "$image_tag" >/dev/null 2>&1 || true
  rm -rf "$tmp_root"
}
trap cleanup EXIT

tar -C "$repo_root" \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./coverage' \
  --exclude='./.artifacts' \
  -cf - . | tar -C "$build_context" -xf -
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

set +e
docker run --rm --network=none "$image_tag" >"$run_stdout" 2>"$run_stderr"
run_status=$?
set -e

if [[ "$run_status" -ne 1 ]]; then
  cat "$run_stdout"
  cat "$run_stderr" >&2
  fail "docker run without MBOS_AGENT_WS_URL/MBOS_AGENT_KEY must exit 1, got $run_status"
fi

if ! grep -q "Usage:" "$run_stderr"; then
  cat "$run_stdout"
  cat "$run_stderr" >&2
  fail "docker run stderr must contain Usage when required env is missing"
fi

echo "image smoke passed"
echo "Image smoke is not release readiness; no GHCR publish, no release manifest, no AgentSmith adoption."
