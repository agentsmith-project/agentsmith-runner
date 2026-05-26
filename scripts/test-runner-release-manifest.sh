#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
checker="$repo_root/scripts/check-runner-release-manifest.mjs"
generator="$repo_root/scripts/write-runner-release-manifest.mjs"
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

write_manifest() {
  local manifest_path="$1"
  local mode="$2"

  node - "$manifest_path" "$mode" <<'NODE'
const { createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');

const [manifestPath, mode] = process.argv.slice(2);
const imageDigest = `sha256:${'b'.repeat(64)}`;
const packageSha = `sha256:${'c'.repeat(64)}`;
const descriptorSubjectSha = `sha256:${'d'.repeat(64)}`;
const gitSha = 'a'.repeat(40);

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(',')}}`;
}

function refreshSubjectSha(manifest) {
  const { artifact_provenance: ignored, ...subject } = manifest;
  void ignored;
  const sha = `sha256:${createHash('sha256').update(canonicalStringify(subject)).digest('hex')}`;
  manifest.artifact_provenance.subject_sha256 = sha;
  manifest.artifact_provenance.artifact_sha256 = sha;
}

const manifest = {
  schema_version: 'agentsmith.runner-release-manifest/v1',
  runner: 'agentsmith-runner',
  release_id: 'runner-release-p5-3a.1',
  git_sha: gitSha,
  runner_contract_version: '0.1.0',
  supported_protocol_versions: ['1.0'],
  image: {
    id: 'agentsmith-runner',
    image: `ghcr.io/agentsmith-project/agentsmith-runner:p5-3a@${imageDigest}`,
    digest: imageDigest,
  },
  contract_artifact: {
    package_uri:
      'gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/501/mbos-agent-runner-contract-0.1.0.tgz',
    package_sha256: packageSha,
    package_integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
    descriptor_subject_sha256: descriptorSubjectSha,
  },
  artifact_provenance: {
    schema_version: 'agentsmith.artifact-provenance/v1',
    provenance_kind: 'ci_artifact',
    producer_repo: 'github.com/agentsmith-project/agentsmith-runner',
    normalized_remote: 'github.com/agentsmith-project/agentsmith-runner',
    workflow_name: 'runner release manifest fixture',
    job: 'manifest-fixture',
    run_id: '501',
    run_attempt: '1',
    commit_sha: gitSha,
    generated_at: '2026-05-26T00:00:00.000Z',
    artifact_uri:
      'gh-artifact://agentsmith-project/agentsmith-runner/runner-release-manifest/501/runner-release-manifest.json',
    artifact_sha256: '',
    subject_name: 'runner-release-manifest',
    subject_uri: 'runner-release-manifest.json',
    subject_sha256: '',
    generator_command: 'node scripts/check-runner-release-manifest.mjs --manifest runner-release-manifest.json',
    generator_version: 'p5.3a-runner-release-manifest-skeleton',
    attestation: 'none',
  },
  adoption_policy: {
    fail_fast: true,
    lock_update_required: true,
    release_contract_adoption_required: true,
  },
};

if (mode === 'tag-only-image') {
  manifest.image.image = 'ghcr.io/agentsmith-project/agentsmith-runner:p5-3a';
}

if (mode === 'image-digest-mismatch') {
  manifest.image.digest = `sha256:${'0'.repeat(64)}`;
}

if (mode === 'wrong-producer-repo') {
  manifest.artifact_provenance.producer_repo = 'github.com/agentsmith-project/agentsmith';
}

if (mode === 'commit-sha-drift') {
  manifest.artifact_provenance.commit_sha = '1'.repeat(40);
}

if (mode === 'artifact-uri-run-id-drift') {
  manifest.artifact_provenance.artifact_uri =
    'gh-artifact://agentsmith-project/agentsmith-runner/runner-release-manifest/502/runner-release-manifest.json';
}

if (mode === 'missing-contract-artifact') {
  delete manifest.contract_artifact;
}

if (mode === 'local-package-uri') {
  manifest.contract_artifact.package_uri = 'file:///tmp/mbos-agent-runner-contract-0.1.0.tgz';
}

if (mode === 'package-uri-non-numeric-run-id') {
  manifest.contract_artifact.package_uri =
    'gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/not-a-run/mbos-agent-runner-contract-0.1.0.tgz';
}

if (mode === 'package-digest-format-invalid') {
  manifest.contract_artifact.package_sha256 = `sha256:${'g'.repeat(64)}`;
  manifest.contract_artifact.package_integrity = 'sha512-!!!';
}

if (mode === 'protocol-drift') {
  manifest.supported_protocol_versions = ['1.0', '1.1'];
}

if (mode === 'semver-invalid') {
  manifest.runner_contract_version = 'v0.1';
}

if (mode === 'secret-local-path-leak') {
  manifest.artifact_provenance.generator_version = [
    '/Users',
    'percy',
    '.config',
    'runner',
    ['tok', 'en=ci-runner-demo'].join(''),
  ].join('/');
}

if (mode === 'empty-provenance-strings') {
  manifest.artifact_provenance.workflow_name = '';
  manifest.artifact_provenance.job = ' ';
  manifest.artifact_provenance.generator_command = '';
  manifest.artifact_provenance.generator_version = ' ';
}

if (mode === 'adoption-policy-false-missing') {
  manifest.adoption_policy.fail_fast = false;
  delete manifest.adoption_policy.lock_update_required;
}

if (mode === 'legacy-unknown-field') {
  manifest.legacy_manifest_path = 'runner-release.json';
}

refreshSubjectSha(manifest);

if (mode === 'subject-sha-drift') {
  manifest.artifact_provenance.subject_sha256 = `sha256:${'0'.repeat(64)}`;
}

if (mode === 'artifact-sha-drift') {
  manifest.artifact_provenance.artifact_sha256 = `sha256:${'0'.repeat(64)}`;
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE
}

expect_success() {
  local label="$1"
  local manifest_path="$2"
  local output

  if ! output="$(node "$checker" --manifest "$manifest_path" 2>&1)"; then
    echo "$output"
    fail "$label should have passed"
  fi

  if ! grep -q 'runner release manifest skeleton check passed' <<<"$output"; then
    echo "$output"
    fail "$label did not print the success marker"
  fi

  pass "$label"
}

expect_failure() {
  local label="$1"
  local pattern="$2"
  local manifest_path="$3"
  local output
  local status

  set +e
  output="$(node "$checker" --manifest "$manifest_path" 2>&1)"
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

expect_verify_success() {
  local label="$1"
  local manifest_path="$2"
  local output

  if ! output="$(bash "$verify_release" --release-manifest --manifest "$manifest_path" 2>&1)"; then
    echo "$output"
    fail "$label should have passed"
  fi

  if ! grep -q 'runner release manifest skeleton check passed' <<<"$output"; then
    echo "$output"
    fail "$label did not print the checker success marker"
  fi

  if ! grep -q 'not release readiness' <<<"$output"; then
    echo "$output"
    fail "$label did not print the non-readiness marker"
  fi

  pass "$label"
}

expect_generator_failure() {
  local label="$1"
  local pattern="$2"
  shift 2

  local output
  local status

  set +e
  output="$(node "$generator" "$@" 2>&1)"
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
write_contract_descriptor "$contract_artifact_root"

generated_manifest="$tmp_root/generated/runner-release-manifest.json"
image_digest="sha256:$(printf 'b%.0s' {1..64})"
git_sha="$(printf 'a%.0s' {1..40})"
node "$generator" \
  --artifact-root "$contract_artifact_root" \
  --image-ref "ghcr.io/agentsmith-project/agentsmith-runner:release-p5-3c" \
  --image-digest "$image_digest" \
  --release-id "runner-release-p5-3c.1" \
  --git-sha "$git_sha" \
  --workflow-name "runner image publish fixture" \
  --job "publish" \
  --run-id "777" \
  --run-attempt "1" \
  --generated-at "2026-05-26T00:00:00.000Z" \
  --output "$generated_manifest" >/dev/null
expect_success "generated runner release manifest fixture" "$generated_manifest"
expect_verify_success "verify-release generated manifest fixture" "$generated_manifest"

expect_generator_failure \
  "generator rejects image-ref with digest" \
  'image-ref.*without digest' \
  --artifact-root "$contract_artifact_root" \
  --image-ref "ghcr.io/agentsmith-project/agentsmith-runner:release-p5-3c@$image_digest" \
  --image-digest "$image_digest" \
  --release-id "runner-release-p5-3c.1" \
  --git-sha "$git_sha" \
  --workflow-name "runner image publish fixture" \
  --job "publish" \
  --run-id "777" \
  --run-attempt "1" \
  --output "$tmp_root/negative-digest.json"

expect_generator_failure \
  "generator rejects wrong GHCR repo" \
  'image-ref.*agentsmith-runner' \
  --artifact-root "$contract_artifact_root" \
  --image-ref "ghcr.io/agentsmith-project/other-runner:release-p5-3c" \
  --image-digest "$image_digest" \
  --release-id "runner-release-p5-3c.1" \
  --git-sha "$git_sha" \
  --workflow-name "runner image publish fixture" \
  --job "publish" \
  --run-id "777" \
  --run-attempt "1" \
  --output "$tmp_root/negative-repo.json"

expect_generator_failure \
  "generator rejects unsafe release id" \
  'release-id.*A-Za-z0-9' \
  --artifact-root "$contract_artifact_root" \
  --image-ref "ghcr.io/agentsmith-project/agentsmith-runner:release-p5-3c" \
  --image-digest "$image_digest" \
  --release-id "unsafe/release" \
  --git-sha "$git_sha" \
  --workflow-name "runner image publish fixture" \
  --job "publish" \
  --run-id "777" \
  --run-attempt "1" \
  --output "$tmp_root/negative-release-id.json"

positive_manifest="$tmp_root/positive.json"
write_manifest "$positive_manifest" "positive"
expect_success "positive runner release manifest fixture" "$positive_manifest"
expect_verify_success "verify-release manifest mode fixture" "$positive_manifest"

tag_only_manifest="$tmp_root/tag-only-image.json"
write_manifest "$tag_only_manifest" "tag-only-image"
expect_failure "tag-only image rejection" 'image[.]image.*digest-pinned|tag-only' "$tag_only_manifest"

image_digest_mismatch_manifest="$tmp_root/image-digest-mismatch.json"
write_manifest "$image_digest_mismatch_manifest" "image-digest-mismatch"
expect_failure "image digest mismatch rejection" 'image[.]digest must match' "$image_digest_mismatch_manifest"

wrong_producer_manifest="$tmp_root/wrong-producer-repo.json"
write_manifest "$wrong_producer_manifest" "wrong-producer-repo"
expect_failure "wrong producer repo rejection" 'producer_repo.*agentsmith-project/agentsmith-runner' "$wrong_producer_manifest"

commit_sha_drift_manifest="$tmp_root/commit-sha-drift.json"
write_manifest "$commit_sha_drift_manifest" "commit-sha-drift"
expect_failure "commit sha drift rejection" 'commit_sha must match git_sha' "$commit_sha_drift_manifest"

artifact_uri_drift_manifest="$tmp_root/artifact-uri-run-id-drift.json"
write_manifest "$artifact_uri_drift_manifest" "artifact-uri-run-id-drift"
expect_failure "artifact uri run id drift rejection" 'artifact_uri must equal.*501' "$artifact_uri_drift_manifest"

missing_contract_manifest="$tmp_root/missing-contract-artifact.json"
write_manifest "$missing_contract_manifest" "missing-contract-artifact"
expect_failure "missing contract_artifact rejection" 'contract_artifact must be an object' "$missing_contract_manifest"

local_package_manifest="$tmp_root/local-package-uri.json"
write_manifest "$local_package_manifest" "local-package-uri"
expect_failure "local package uri rejection" 'package_uri.*P5[.]2 canonical remote CI artifact URI|forbidden content: file protocol' "$local_package_manifest"

package_uri_non_numeric_manifest="$tmp_root/package-uri-non-numeric-run-id.json"
write_manifest "$package_uri_non_numeric_manifest" "package-uri-non-numeric-run-id"
expect_failure "package uri non-numeric run id rejection" 'package_uri.*positive run id' "$package_uri_non_numeric_manifest"

package_digest_invalid_manifest="$tmp_root/package-digest-format-invalid.json"
write_manifest "$package_digest_invalid_manifest" "package-digest-format-invalid"
expect_failure "package digest format rejection" 'package_sha256.*64 lowercase hex|package_integrity.*sha512 SRI' "$package_digest_invalid_manifest"

protocol_drift_manifest="$tmp_root/protocol-drift.json"
write_manifest "$protocol_drift_manifest" "protocol-drift"
expect_failure "protocol drift rejection" 'supported_protocol_versions must equal \["1.0"\]' "$protocol_drift_manifest"

semver_invalid_manifest="$tmp_root/semver-invalid.json"
write_manifest "$semver_invalid_manifest" "semver-invalid"
expect_failure "semver rejection" 'runner_contract_version must be semver' "$semver_invalid_manifest"

subject_drift_manifest="$tmp_root/subject-sha-drift.json"
write_manifest "$subject_drift_manifest" "subject-sha-drift"
expect_failure "subject sha drift rejection" 'subject_sha256' "$subject_drift_manifest"

artifact_sha_drift_manifest="$tmp_root/artifact-sha-drift.json"
write_manifest "$artifact_sha_drift_manifest" "artifact-sha-drift"
expect_failure "artifact sha drift rejection" 'artifact_sha256.*subject_sha256' "$artifact_sha_drift_manifest"

secret_local_manifest="$tmp_root/secret-local-path-leak.json"
write_manifest "$secret_local_manifest" "secret-local-path-leak"
expect_failure "secret or local path leak rejection" 'forbidden content' "$secret_local_manifest"

empty_provenance_manifest="$tmp_root/empty-provenance-strings.json"
write_manifest "$empty_provenance_manifest" "empty-provenance-strings"
expect_failure "empty provenance strings rejection" 'workflow_name.*non-empty string|job.*non-empty string|generator_command.*non-empty string|generator_version.*non-empty string' "$empty_provenance_manifest"

adoption_policy_manifest="$tmp_root/adoption-policy-false-missing.json"
write_manifest "$adoption_policy_manifest" "adoption-policy-false-missing"
expect_failure "adoption policy false or missing rejection" 'adoption_policy[.].*must be true' "$adoption_policy_manifest"

legacy_unknown_manifest="$tmp_root/legacy-unknown-field.json"
write_manifest "$legacy_unknown_manifest" "legacy-unknown-field"
expect_failure "legacy or unknown field rejection" 'legacy_manifest_path is not allowed' "$legacy_unknown_manifest"

echo "runner release manifest self-test passed"
