#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
consumer="$repo_root/scripts/check-runner-contract-consumer.mjs"
tmp_root="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_root"
}
trap cleanup EXIT

package_filename="mbos-agent-runner-contract-0.1.0.tgz"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

write_descriptor() {
  local artifact_root="$1"
  local filename="$2"
  local run_id="$3"
  local mode="${4:-positive}"

  node - "$artifact_root" "$filename" "$run_id" "$mode" <<'NODE'
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const [artifactRoot, filename, runId, mode] = process.argv.slice(2);
const packageName = '@mbos/agent-runner-contract';
const packageVersion = '0.1.0';
const artifactUri = `gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/${runId}/${filename}`;
const tgz = readFileSync(join(artifactRoot, filename));
const sha256 = `sha256:${createHash('sha256').update(tgz).digest('hex')}`;
const integrity = `sha512-${createHash('sha512').update(tgz).digest('base64')}`;
const entrypoints =
  mode === 'non-canonical-entrypoints'
    ? {
        fixtures: './dist/index.js',
        schema: './dist/index.js',
        types: './dist/index.d.ts',
        version: './dist/artifact.js',
      }
    : {
        fixtures: './dist/contract-schema.js',
        schema: './dist/contract-schema.js',
        types: './dist/index.d.ts',
        version: './dist/artifact.js',
      };

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

const descriptor = {
  artifact: {
    filename,
    integrity,
    sha256,
    uri: artifactUri,
  },
  artifact_provenance: {
    artifact_sha256: sha256,
    artifact_uri: artifactUri,
    attestation: 'none',
    commit_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    generated_at: '2026-05-26T00:00:00.000Z',
    generator_command: 'npx tsx scripts/governance/runner-contract-artifact.ts',
    generator_version: 'p4-runner-contract-artifact',
    job: 'produce-runner-contract-artifact',
    normalized_remote: 'github.com/agentsmith-project/agentsmith',
    producer_repo: 'github.com/agentsmith-project/agentsmith',
    provenance_kind: 'ci_artifact',
    run_attempt: '1',
    run_id: runId,
    schema_version: 'agentsmith.artifact-provenance/v1',
    subject_name: 'runner-contract-artifact',
    subject_sha256: '',
    subject_uri: 'runner-contract-artifact.json',
    workflow_name: 'Runner Contract Artifact',
  },
  entrypoints: {
    fixtures: entrypoints.fixtures,
    schema: entrypoints.schema,
    types: entrypoints.types,
    version: entrypoints.version,
  },
  package: {
    name: packageName,
    version: packageVersion,
  },
  schema_version: 'agentsmith.runner-contract-artifact/v1',
};

const { artifact_provenance: ignored, ...subject } = descriptor;
void ignored;
descriptor.artifact_provenance.subject_sha256 = `sha256:${createHash('sha256')
  .update(canonicalStringify(subject))
  .digest('hex')}`;

writeFileSync(join(artifactRoot, 'runner-contract-artifact.json'), `${JSON.stringify(descriptor, null, 2)}\n`);
NODE
}

write_package_fixture() {
  local package_dir="$1"
  local mode="$2"
  local filename="$3"
  local run_id="$4"

  node - "$package_dir" "$mode" "$filename" "$run_id" <<'NODE'
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const [packageDir, mode, filename, runId] = process.argv.slice(2);
const packageName = '@mbos/agent-runner-contract';
const packageVersion = '0.1.0';
const artifactUri = `gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/${runId}/${filename}`;
const entrypoints =
  mode === 'non-canonical-entrypoints'
    ? {
        fixtures: './dist/index.js',
        schema: './dist/index.js',
        types: './dist/index.d.ts',
        version: './dist/artifact.js',
      }
    : {
        fixtures: './dist/contract-schema.js',
        schema: './dist/contract-schema.js',
        types: './dist/index.d.ts',
        version: './dist/artifact.js',
      };
let surface = {
  entrypoints,
  metadata_kind: 'runner_contract_package_manifest',
  package: {
    name: packageName,
    version: packageVersion,
  },
  release_provenance: {
    descriptor_name: 'runner-contract-artifact.json',
    kind: 'external_descriptor',
  },
  schema_version: 'agentsmith.runner-contract-package-manifest/v1',
};
const packageJson = {
  name: packageName,
  version: packageVersion,
  type: 'module',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js',
    },
    './artifact': {
      types: './dist/artifact.d.ts',
      import: './dist/artifact.js',
      default: './dist/artifact.js',
    },
    './contract-artifact.json': './contract-artifact.json',
    './package.json': './package.json',
  },
  files: ['dist', 'contract-artifact.json'],
};

if (mode === 'lifecycle') {
  packageJson.scripts = {
    preinstall: 'node dist/index.js',
  };
}

if (mode === 'local-pack-manifest') {
  surface = {
    artifact_kind: 'local_pack_manifest',
    entrypoints,
    package: {
      name: packageName,
      version: packageVersion,
    },
    schema_version: 'agentsmith.runner-contract-artifact/v1',
  };
}

if (mode === 'release-provenance-extra') {
  surface.release_provenance.note = 'debug';
}

mkdirSync(join(packageDir, 'dist'), { recursive: true });
writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
writeFileSync(join(packageDir, 'contract-artifact.json'), `${JSON.stringify(surface, null, 2)}\n`);
writeFileSync(
  join(packageDir, 'dist', 'artifact.js'),
  `export const RUNNER_CONTRACT_VERSION = '${packageVersion}';\n` +
    `export const RUNNER_CONTRACT_ARTIFACT = ${JSON.stringify(surface, null, 2)};\n`,
);
writeFileSync(
  join(packageDir, 'dist', 'index.js'),
  `export { RUNNER_CONTRACT_ARTIFACT, RUNNER_CONTRACT_VERSION } from './artifact.js';\n` +
    `export { AGENT_TASK_RUNNER_SPEC, getTaskExecutionContextFixture, isAgentTaskRunnerSpec, isTaskExecutionContext } from './contract-schema.js';\n`,
);
writeFileSync(
  join(packageDir, 'dist', 'contract-schema.js'),
    `export const AGENT_TASK_RUNNER_SPEC = Object.freeze({ protocol_version: '1.0' });\n` +
    `export function isAgentTaskRunnerSpec(value) {\n` +
    `  return Boolean(value && value.protocol_version === '1.0' && !Object.prototype.hasOwnProperty.call(value, 'interaction_kind'));\n` +
    `}\n` +
    `export function getTaskExecutionContextFixture(name) {\n` +
    `  if (name !== 'managedTaskRun') throw new Error('unknown fixture');\n` +
    `  return { task_id: 'task-1', workspace_id: 'workspace-1', project_id: 'project-1' };\n` +
    `}\n` +
    `export function isTaskExecutionContext(value) {\n` +
    `  return Boolean(value && value.task_id === 'task-1' && !Object.prototype.hasOwnProperty.call(value, 'external_agent_id'));\n` +
    `}\n`,
);
writeFileSync(join(packageDir, 'dist', 'artifact.d.ts'), `export declare const RUNNER_CONTRACT_VERSION: string;\nexport declare const RUNNER_CONTRACT_ARTIFACT: unknown;\n`);
writeFileSync(join(packageDir, 'dist', 'index.d.ts'), `export declare const RUNNER_CONTRACT_VERSION: string;\n`);

if (mode === 'source-leak') {
  const leakedPath = '/home/percy/works/mbos-v1/' + 'agentsmith/src/contracts/runner';
  writeFileSync(join(packageDir, 'dist', 'leak.js'), `export const leakedPath = "${leakedPath}";\n`);
}

if (mode === 'runner-home') {
  writeFileSync(
    join(packageDir, 'dist', 'runner-home.js'),
    `export const taskHome = "/home/task_1";\n` +
      `export const taskWorkspace = "/home/task_1/workspace";\n` +
      `export const taskArtifacts = "/home/task_1/workspace/.artifacts";\n`,
  );
}
NODE
}

build_npm_fixture() {
  local artifact_root="$1"
  local mode="$2"
  local run_id="$3"
  local package_dir="$tmp_root/package-$mode-$run_id"

  mkdir -p "$artifact_root"
  write_package_fixture "$package_dir" "$mode" "$package_filename" "$run_id"
  npm pack "$package_dir" --pack-destination "$artifact_root" --ignore-scripts --silent >/dev/null

  if [[ ! -f "$artifact_root/$package_filename" ]]; then
    fail "npm pack did not produce $package_filename"
  fi

  write_descriptor "$artifact_root" "$package_filename" "$run_id" "$mode"
}

recompute_descriptor_subject_hash() {
  local descriptor_path="$1"

  node - "$descriptor_path" <<'NODE'
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');

const [descriptorPath] = process.argv.slice(2);
const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'));

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

const { artifact_provenance: ignored, ...subject } = descriptor;
void ignored;
descriptor.artifact_provenance.subject_sha256 = `sha256:${createHash('sha256')
  .update(canonicalStringify(subject))
  .digest('hex')}`;
writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
NODE
}

build_path_fixture() {
  local artifact_root="$1"
  local filename="path-traversal.tgz"
  local input_dir="$tmp_root/path-input"

  mkdir -p "$artifact_root" "$input_dir"
  printf 'x\n' >"$input_dir/evil.js"
  tar -czf "$artifact_root/$filename" --transform='s#^evil.js$#package/../evil.js#' -C "$input_dir" evil.js >/dev/null 2>&1
  write_descriptor "$artifact_root" "$filename" "401"
}

build_symlink_fixture() {
  local artifact_root="$1"
  local filename="symlink.tgz"
  local input_dir="$tmp_root/symlink-input"

  mkdir -p "$artifact_root" "$input_dir/package/dist"
  printf '{}\n' >"$input_dir/package/package.json"
  printf '{}\n' >"$input_dir/package/contract-artifact.json"
  ln -s index.js "$input_dir/package/dist/link.js"
  tar -czf "$artifact_root/$filename" -C "$input_dir" package
  write_descriptor "$artifact_root" "$filename" "402"
}

expect_success() {
  local label="$1"
  local artifact_root="$2"
  local output

  if ! output="$(node "$consumer" --artifact-root "$artifact_root" 2>&1)"; then
    echo "$output"
    fail "$label should have passed"
  fi

  if ! grep -q 'contract consumer skeleton passed' <<<"$output"; then
    echo "$output"
    fail "$label did not print the success marker"
  fi

  pass "$label"
}

expect_failure() {
  local label="$1"
  local pattern="$2"
  local artifact_root="$3"
  local output
  local status

  set +e
  output="$(node "$consumer" --artifact-root "$artifact_root" 2>&1)"
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

positive_root="$tmp_root/positive"
build_npm_fixture "$positive_root" "positive" "301"
expect_success "positive package manifest v1 fixture" "$positive_root"

descriptor_extra_root="$tmp_root/descriptor-extra-debug-path"
build_npm_fixture "$descriptor_extra_root" "positive" "307"
node - "$descriptor_extra_root/runner-contract-artifact.json" <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs');

const [path] = process.argv.slice(2);
const descriptor = JSON.parse(readFileSync(path, 'utf8'));
descriptor.debug_path = [
  '',
  'home',
  'percy',
  'works',
  'mbos-v1',
  'agentsmith',
  'packages',
  'agent-runner-contract',
].join('/');
writeFileSync(path, `${JSON.stringify(descriptor, null, 2)}\n`);
NODE
recompute_descriptor_subject_hash "$descriptor_extra_root/runner-contract-artifact.json"
expect_failure "descriptor debug path rejection" 'debug_path|forbidden content|/home/percy' "$descriptor_extra_root"

descriptor_unknown_root="$tmp_root/descriptor-extra-field"
build_npm_fixture "$descriptor_unknown_root" "positive" "309"
node - "$descriptor_unknown_root/runner-contract-artifact.json" <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs');

const [path] = process.argv.slice(2);
const descriptor = JSON.parse(readFileSync(path, 'utf8'));
descriptor.debug_enabled = true;
writeFileSync(path, `${JSON.stringify(descriptor, null, 2)}\n`);
NODE
recompute_descriptor_subject_hash "$descriptor_unknown_root/runner-contract-artifact.json"
expect_failure "descriptor unknown field rejection" 'debug_enabled is not allowed' "$descriptor_unknown_root"

noncanonical_entrypoints_root="$tmp_root/non-canonical-entrypoints"
build_npm_fixture "$noncanonical_entrypoints_root" "non-canonical-entrypoints" "308"
expect_failure "non-canonical entrypoints rejection" 'entrypoints' "$noncanonical_entrypoints_root"

release_provenance_extra_root="$tmp_root/release-provenance-extra"
build_npm_fixture "$release_provenance_extra_root" "release-provenance-extra" "310"
expect_failure "release_provenance extra field rejection" 'release_provenance[.]note is not allowed' "$release_provenance_extra_root"

legacy_manifest_root="$tmp_root/local-pack-manifest"
build_npm_fixture "$legacy_manifest_root" "local-pack-manifest" "305"
expect_failure "local_pack_manifest rejection" 'local_pack_manifest' "$legacy_manifest_root"

lifecycle_root="$tmp_root/lifecycle"
build_npm_fixture "$lifecycle_root" "lifecycle" "302"
expect_failure "lifecycle script rejection" 'scripts[.]preinstall is forbidden' "$lifecycle_root"

drift_root="$tmp_root/provenance-drift"
build_npm_fixture "$drift_root" "positive" "303"
node - "$drift_root/runner-contract-artifact.json" <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs');
const [path] = process.argv.slice(2);
const descriptor = JSON.parse(readFileSync(path, 'utf8'));
descriptor.artifact_provenance.subject_sha256 = `sha256:${'0'.repeat(64)}`;
writeFileSync(path, `${JSON.stringify(descriptor, null, 2)}\n`);
NODE
expect_failure "provenance subject drift rejection" 'subject_sha256' "$drift_root"

source_leak_root="$tmp_root/source-leak"
build_npm_fixture "$source_leak_root" "source-leak" "304"
expect_failure "source leak rejection" 'forbidden content: non-task /home path' "$source_leak_root"

runner_home_root="$tmp_root/runner-home"
build_npm_fixture "$runner_home_root" "runner-home" "306"
expect_success "runner home path allowance" "$runner_home_root"

path_root="$tmp_root/path"
build_path_fixture "$path_root"
expect_failure "path traversal rejection" 'parent directory segments' "$path_root"

symlink_root="$tmp_root/symlink"
build_symlink_fixture "$symlink_root"
expect_failure "symlink rejection" 'must not be a symlink' "$symlink_root"

echo "runner contract consumer self-test passed"
