#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
checker="$repo_root/scripts/check-runner-ga-handoff-report.mjs"
manifest_generator="$repo_root/scripts/write-runner-release-manifest.mjs"
verify_release="$repo_root/scripts/verify-release.sh"
tmp_root="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_root"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

write_contract_descriptor() {
  local artifact_root="$1"

  mkdir -p "$artifact_root"
  node - "$artifact_root" <<'NODE'
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const artifactRoot = process.argv[2];
const packageSha = `sha256:${'c'.repeat(64)}`;
const descriptorSubjectSha = `sha256:${'d'.repeat(64)}`;

const descriptor = {
  artifact: {
    filename: 'mbos-agent-runner-contract-0.1.0.tgz',
    integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
    sha256: packageSha,
    uri: 'gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/501/mbos-agent-runner-contract-0.1.0.tgz',
  },
  artifact_provenance: {
    artifact_sha256: packageSha,
    artifact_uri:
      'gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/501/mbos-agent-runner-contract-0.1.0.tgz',
    attestation: 'none',
    commit_sha: 'a'.repeat(40),
    generated_at: '2026-05-26T00:00:00.000Z',
    generator_command: 'npx tsx scripts/governance/runner-contract-artifact.ts',
    generator_version: 'p4-runner-contract-artifact',
    job: 'produce-runner-contract-artifact',
    normalized_remote: 'github.com/agentsmith-project/agentsmith',
    producer_repo: 'github.com/agentsmith-project/agentsmith',
    provenance_kind: 'ci_artifact',
    run_attempt: '1',
    run_id: '501',
    schema_version: 'agentsmith.artifact-provenance/v1',
    subject_name: 'runner-contract-artifact',
    subject_sha256: descriptorSubjectSha,
    subject_uri: 'runner-contract-artifact.json',
    workflow_name: 'Runner Contract Artifact',
  },
  entrypoints: {
    fixtures: './dist/contract-schema.js',
    schema: './dist/contract-schema.js',
    types: './dist/index.d.ts',
    version: './dist/artifact.js',
  },
  package: {
    name: '@mbos/agent-runner-contract',
    version: '0.1.0',
  },
  schema_version: 'agentsmith.runner-contract-artifact/v1',
};

writeFileSync(join(artifactRoot, 'runner-contract-artifact.json'), `${JSON.stringify(descriptor, null, 2)}\n`);
NODE
}

mutate_report() {
  local source_report="$1"
  local target_report="$2"
  local mutation="$3"

  node - "$source_report" "$target_report" "$mutation" <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs');

const [sourceReport, targetReport, mutation] = process.argv.slice(2);
const report = JSON.parse(readFileSync(sourceReport, 'utf8'));

if (mutation === 'formal-verdict') {
  report.formal_verdict = 'issued';
} else if (mutation === 'tag-only-image') {
  report.image.image = 'ghcr.io/agentsmith-project/agentsmith-runner:release-runner-777';
} else if (mutation === 'manifest-uri-run-id-drift') {
  report.manifest.artifact_uri =
    'gh-artifact://agentsmith-project/agentsmith-runner/runner-release-manifest/778/runner-release-manifest.json';
} else if (mutation === 'wrong-producer') {
  report.provenance.producer_repo = 'github.com/agentsmith-project/agentsmith';
} else if (mutation === 'missing-manifest-input') {
  delete report.manifest.input_sha256;
} else if (mutation === 'manifest-input-sha-drift') {
  report.manifest.input_sha256 = `sha256:${'0'.repeat(64)}`;
} else if (mutation === 'local-contract-uri') {
  report.contract_artifact.package_uri = 'file:///tmp/mbos-agent-runner-contract-0.1.0.tgz';
} else if (mutation === 'checks-drift') {
  report.checks[1].status = 'failed';
} else {
  throw new Error(`unknown mutation: ${mutation}`);
}

writeFileSync(targetReport, `${JSON.stringify(report, null, 2)}\n`);
NODE
}

expect_success() {
  local label="$1"
  local report_path="$2"
  local output

  if ! output="$(node "$checker" --report "$report_path" 2>&1)"; then
    echo "$output"
    fail "$label should have passed"
  fi

  if ! grep -q 'runner GA handoff report check passed' <<<"$output"; then
    echo "$output"
    fail "$label did not print the report check success marker"
  fi

  if ! grep -q 'not a formal verdict' <<<"$output"; then
    echo "$output"
    fail "$label did not print the non-verdict marker"
  fi

  pass "$label"
}

expect_failure() {
  local label="$1"
  local pattern="$2"
  local report_path="$3"
  local output
  local status

  set +e
  output="$(node "$checker" --report "$report_path" 2>&1)"
  status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    echo "$output"
    fail "$label should have failed"
  fi

  if ! grep -Eq "$pattern" <<<"$output"; then
    echo "$output"
    fail "$label failed with an unexpected message"
  fi

  pass "$label"
}

expect_failure_with_manifest() {
  local label="$1"
  local pattern="$2"
  local report_path="$3"
  local manifest_path="$4"
  local output
  local status

  set +e
  output="$(node "$checker" --report "$report_path" --manifest "$manifest_path" 2>&1)"
  status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    echo "$output"
    fail "$label should have failed"
  fi

  if ! grep -Eq "$pattern" <<<"$output"; then
    echo "$output"
    fail "$label failed with an unexpected message"
  fi

  pass "$label"
}

contract_artifact_root="$tmp_root/contract-artifact"
manifest_path="$tmp_root/runner-release-manifest.json"
handoff_dir="$tmp_root/ga-handoff"
handoff_report="$handoff_dir/runner-ga-handoff-report.json"
image_digest="sha256:$(printf 'b%.0s' {1..64})"
git_sha="$(printf 'a%.0s' {1..40})"

node --check "$checker"
write_contract_descriptor "$contract_artifact_root"
node "$manifest_generator" \
  --artifact-root "$contract_artifact_root" \
  --image-ref "ghcr.io/agentsmith-project/agentsmith-runner:release-runner-777" \
  --image-digest "$image_digest" \
  --release-id "runner-777" \
  --git-sha "$git_sha" \
  --workflow-name "runner image publish fixture" \
  --job "publish" \
  --run-id "777" \
  --run-attempt "1" \
  --generated-at "2026-05-26T00:00:00.000Z" \
  --output "$manifest_path" >/dev/null

bash "$verify_release" --ga-handoff --manifest "$manifest_path" --output-dir "$handoff_dir" >/dev/null
expect_success "generated runner GA handoff report" "$handoff_report"
bash "$verify_release" --ga-handoff-report --report "$handoff_report" --manifest "$manifest_path" >/dev/null
pass "generated runner GA handoff report cross-checks supplied manifest"

for mutation_and_pattern in \
  "formal-verdict|formal_verdict is not allowed|forbidden content: formal verdict" \
  "tag-only-image|image[.]image.*digest-pinned|tag-only" \
  "manifest-uri-run-id-drift|manifest[.]artifact_uri run id must match" \
  "wrong-producer|provenance[.]producer_repo.*agentsmith-project/agentsmith-runner" \
  "missing-manifest-input|manifest[.]input_sha256 must be a non-empty string" \
  "local-contract-uri|package_uri.*canonical AgentSmith runner contract artifact|forbidden content: file protocol" \
  "checks-drift|checks\\[1\\][.]status must equal pass"; do
  mutation="${mutation_and_pattern%%|*}"
  pattern="${mutation_and_pattern#*|}"
  target="$tmp_root/${mutation}.json"
  mutate_report "$handoff_report" "$target" "$mutation"
  expect_failure "$mutation rejection" "$pattern" "$target"
done

target="$tmp_root/manifest-input-sha-drift.json"
mutate_report "$handoff_report" "$target" "manifest-input-sha-drift"
expect_failure_with_manifest \
  "manifest input sha drift rejection" \
  "manifest[.]input_sha256 must match the supplied runner release manifest" \
  "$target" \
  "$manifest_path"

echo "runner GA handoff report self-test passed"
