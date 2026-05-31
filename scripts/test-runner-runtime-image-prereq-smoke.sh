#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  bash scripts/test-runner-runtime-image-prereq-smoke.sh --image <image-tag>
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -ne 2 || "${1:-}" != "--image" ]]; then
  usage
  fail "runtime image prerequisite smoke requires exactly --image <image-tag>"
fi

image_tag="$2"
if [[ -z "$image_tag" ]]; then
  fail "image tag must be non-empty"
fi

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is required for runtime image prerequisite smoke"
fi

tmp_root="$(mktemp -d)"
run_stdout="$tmp_root/run.stdout"
run_stderr="$tmp_root/run.stderr"

cleanup() {
  rm -rf "$tmp_root"
}
trap cleanup EXIT

run_bash_check() {
  local label="$1"
  local command="$2"

  : >"$run_stdout"
  : >"$run_stderr"
  set +e
  docker run --rm --network=none --entrypoint /bin/bash "$image_tag" -lc "$command" >"$run_stdout" 2>"$run_stderr"
  local run_status=$?
  set -e

  if [[ "$run_status" -ne 0 ]]; then
    cat "$run_stdout"
    cat "$run_stderr" >&2
    fail "$label failed with exit code $run_status"
  fi
}

run_bash_check "codex CLI version check" "codex --version"
codex_version_output="$(cat "$run_stdout" "$run_stderr")"
if ! grep -Eq "0[.]134[.]0" <<<"$codex_version_output"; then
  cat "$run_stdout"
  cat "$run_stderr" >&2
  fail "codex --version must report pinned @openai/codex 0.134.0"
fi

run_bash_check "python3 version check" "python3 --version"
run_bash_check \
  "mbos-context packaged skill check" \
  "test -f /etc/codex/skills/mbos-context/scripts/context_cli.py"
run_bash_check \
  "packaged skills top-level allowlist check" \
  "set -euo pipefail; find /etc/codex/skills -mindepth 1 -maxdepth 1 -printf '%f\n' | sort | diff -u <(printf '%s\n' .mbos-runtime mbos-context) -"
run_bash_check \
  "system skill directory exclusion check" \
  "test ! -e /etc/codex/skills/.system"
run_bash_check \
  "provider installer capability exclusion check" \
  "set -euo pipefail; ! find /etc/codex/skills -type f -print0 | xargs -0 grep -IEn 'GITHUB_TOKEN|GH_TOKEN|OAuth|skill-installer|github_utils'"

expected_value="smoke-value"
projection='{"dependencies":{"sample-dependency":{"fields":{"value":"smoke-value"}}}}'

: >"$run_stdout"
: >"$run_stderr"
set +e
docker run --rm --network=none \
  -e "MBOS_AGENT_PROJECTED_DEPENDENCIES=$projection" \
  --entrypoint /bin/bash \
  "$image_tag" \
  -lc "python3 /etc/codex/skills/mbos-context/scripts/context_cli.py get --dependency sample-dependency --field value" \
  >"$run_stdout" 2>"$run_stderr"
run_status=$?
set -e

if [[ "$run_status" -ne 0 ]]; then
  cat "$run_stdout"
  cat "$run_stderr" >&2
  fail "mbos-context projection read failed with exit code $run_status"
fi

actual_value="$(cat "$run_stdout")"
if [[ "$actual_value" != "$expected_value" ]]; then
  cat "$run_stdout"
  cat "$run_stderr" >&2
  fail "mbos-context projection read returned unexpected value"
fi

echo "runtime image prerequisite smoke passed"
