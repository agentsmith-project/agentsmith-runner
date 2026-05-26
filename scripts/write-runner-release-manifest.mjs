#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const EXPECTED_DESCRIPTOR_SCHEMA = 'agentsmith.runner-contract-artifact/v1';
const EXPECTED_CONTRACT_PACKAGE = '@mbos/agent-runner-contract';
const EXPECTED_RUNNER = 'agentsmith-runner';
const EXPECTED_IMAGE_REPO = 'ghcr.io/agentsmith-project/agentsmith-runner';
const EXPECTED_PRODUCER_REPO = 'github.com/agentsmith-project/agentsmith-runner';
const GENERATOR_COMMAND = 'node scripts/write-runner-release-manifest.mjs';
const GENERATOR_VERSION = 'v1';

const REQUIRED_ARGS = Object.freeze([
  '--artifact-root',
  '--image-ref',
  '--image-digest',
  '--release-id',
  '--git-sha',
  '--workflow-name',
  '--job',
  '--run-id',
  '--run-attempt',
  '--output',
]);
const OPTIONAL_ARGS = Object.freeze(['--generated-at']);
const ALL_ARGS = new Set([...REQUIRED_ARGS, ...OPTIONAL_ARGS]);

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;
const IMAGE_REF_PATTERN =
  /^ghcr[.]io\/agentsmith-project\/agentsmith-runner:([A-Za-z0-9][A-Za-z0-9._-]{0,95})$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)[.](0|[1-9]\d*)[.](0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?(?:[+][0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?$/;
const CONTRACT_PACKAGE_URI_PATTERN =
  /^gh-artifact:\/\/agentsmith-project\/agentsmith\/runner-contract-artifact\/([1-9][0-9]*)\/([A-Za-z0-9][A-Za-z0-9._-]*[.]tgz)$/;
const PACKAGE_INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.]\d{3})?Z$/;

function usage() {
  console.error(
    'Usage: node scripts/write-runner-release-manifest.mjs ' +
      '--artifact-root <dir> --image-ref <ghcr tag ref without digest> ' +
      '--image-digest sha256:<64> --release-id <id> --git-sha <40> ' +
      '--workflow-name <name> --job <job> --run-id <positive> ' +
      '--run-attempt <positive> --output <path> [--generated-at <iso>]',
  );
}

function fail(message, code = 1) {
  console.error(`error: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    usage();
    process.exit(0);
  }

  if (argv.length % 2 !== 0) {
    usage();
    fail('expected flag/value pairs', 2);
  }

  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!ALL_ARGS.has(flag)) {
      usage();
      fail(`unknown argument: ${flag}`, 2);
    }
    if (args.has(flag)) {
      usage();
      fail(`duplicate argument: ${flag}`, 2);
    }
    if (typeof value !== 'string' || value.trim() === '') {
      usage();
      fail(`${flag} requires a non-empty value`, 2);
    }
    args.set(flag, value);
  }

  for (const flag of REQUIRED_ARGS) {
    if (!args.has(flag)) {
      usage();
      fail(`missing required argument: ${flag}`, 2);
    }
  }

  return Object.fromEntries(args.entries());
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value, fieldPath) {
  if (!isPlainObject(value)) {
    fail(`${fieldPath} must be an object`);
  }
  return value;
}

function requireString(value, fieldPath) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${fieldPath} must be a non-empty string`);
  }
  return value;
}

function assertPattern(value, pattern, fieldPath, message) {
  const actual = requireString(value, fieldPath);
  if (!pattern.test(actual)) {
    fail(message ?? `${fieldPath} has an invalid format`);
  }
  return actual;
}

function assertSafeText(value, fieldPath) {
  const actual = requireString(value, fieldPath);
  if (!/^[\x20-\x7E]+$/.test(actual)) {
    fail(`${fieldPath} must be printable ASCII without control characters`);
  }
  return actual;
}

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      fail('cannot canonicalize undefined values');
    }
    return encoded;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(',')}}`;
}

function subjectSha256(manifest) {
  const { artifact_provenance: ignored, ...subject } = manifest;
  void ignored;
  return `sha256:${createHash('sha256').update(canonicalStringify(subject)).digest('hex')}`;
}

function readJsonFile(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    fail(`failed to read ${label}: ${error.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`failed to parse ${label} as JSON: ${error.message}`);
  }
}

function assertDirectory(path, fieldPath) {
  let stats;
  try {
    stats = statSync(path);
  } catch (error) {
    fail(`${fieldPath} must be an existing directory: ${error.message}`);
  }
  if (!stats.isDirectory()) {
    fail(`${fieldPath} must be a directory`);
  }
}

function readDescriptor(artifactRoot) {
  assertDirectory(artifactRoot, '--artifact-root');

  const descriptorPath = join(artifactRoot, 'runner-contract-artifact.json');
  const descriptor = requireObject(readJsonFile(descriptorPath, 'runner contract artifact descriptor'), 'descriptor');
  if (descriptor.schema_version !== EXPECTED_DESCRIPTOR_SCHEMA) {
    fail(`descriptor.schema_version must equal ${EXPECTED_DESCRIPTOR_SCHEMA}`);
  }

  const packageInfo = requireObject(descriptor.package, 'descriptor.package');
  const artifact = requireObject(descriptor.artifact, 'descriptor.artifact');
  const provenance = requireObject(descriptor.artifact_provenance, 'descriptor.artifact_provenance');

  if (packageInfo.name !== EXPECTED_CONTRACT_PACKAGE) {
    fail(`descriptor.package.name must equal ${EXPECTED_CONTRACT_PACKAGE}`);
  }

  const version = assertPattern(
    packageInfo.version,
    SEMVER_PATTERN,
    'descriptor.package.version',
    'descriptor.package.version must be semver',
  );
  const packageUri = assertPattern(
    artifact.uri,
    CONTRACT_PACKAGE_URI_PATTERN,
    'descriptor.artifact.uri',
    'descriptor.artifact.uri must be a canonical AgentSmith runner contract artifact URI',
  );
  const packageSha256 = assertPattern(
    artifact.sha256,
    SHA256_PATTERN,
    'descriptor.artifact.sha256',
    'descriptor.artifact.sha256 must be sha256:<64 lowercase hex>',
  );
  const packageIntegrity = assertPattern(
    artifact.integrity,
    PACKAGE_INTEGRITY_PATTERN,
    'descriptor.artifact.integrity',
    'descriptor.artifact.integrity must be npm sha512 SRI',
  );
  const descriptorSubjectSha256 = assertPattern(
    provenance.subject_sha256,
    SHA256_PATTERN,
    'descriptor.artifact_provenance.subject_sha256',
    'descriptor.artifact_provenance.subject_sha256 must be sha256:<64 lowercase hex>',
  );

  return {
    version,
    packageUri,
    packageSha256,
    packageIntegrity,
    descriptorSubjectSha256,
  };
}

function normalizeGeneratedAt(value) {
  const generatedAt = value ?? new Date().toISOString();
  if (!ISO_UTC_PATTERN.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    fail('--generated-at must be an ISO UTC timestamp');
  }
  return generatedAt;
}

function validateImageRef(imageRef) {
  if (imageRef.includes('@')) {
    fail('--image-ref must be a GHCR tag ref without digest');
  }

  const match = IMAGE_REF_PATTERN.exec(imageRef);
  if (!match) {
    fail(`--image-ref must match ${EXPECTED_IMAGE_REPO}:<safe-tag>`);
  }

  const [, tag] = match;
  if (tag.toLowerCase() === 'latest') {
    fail('--image-ref must not use latest');
  }

  return imageRef;
}

function buildManifest(args) {
  const artifactRoot = resolve(args['--artifact-root']);
  const descriptor = readDescriptor(artifactRoot);
  const imageRef = validateImageRef(args['--image-ref']);
  const imageDigest = assertPattern(
    args['--image-digest'],
    SHA256_PATTERN,
    '--image-digest',
    '--image-digest must be sha256:<64 lowercase hex>',
  );
  const releaseId = assertPattern(
    args['--release-id'],
    SAFE_ID_PATTERN,
    '--release-id',
    '--release-id must match [A-Za-z0-9][A-Za-z0-9._-]{0,95}',
  );
  if (releaseId.toLowerCase() === 'latest') {
    fail('--release-id must not be latest');
  }

  const gitSha = assertPattern(args['--git-sha'], GIT_SHA_PATTERN, '--git-sha', '--git-sha must be 40 lowercase hex');
  const workflowName = assertSafeText(args['--workflow-name'], '--workflow-name');
  const job = assertSafeText(args['--job'], '--job');
  const runId = assertPattern(args['--run-id'], POSITIVE_INTEGER_PATTERN, '--run-id', '--run-id must be positive');
  const runAttempt = assertPattern(
    args['--run-attempt'],
    POSITIVE_INTEGER_PATTERN,
    '--run-attempt',
    '--run-attempt must be positive',
  );
  const generatedAt = normalizeGeneratedAt(args['--generated-at']);

  const manifest = {
    schema_version: 'agentsmith.runner-release-manifest/v1',
    runner: EXPECTED_RUNNER,
    release_id: releaseId,
    git_sha: gitSha,
    runner_contract_version: descriptor.version,
    supported_protocol_versions: ['1.0'],
    image: {
      id: EXPECTED_RUNNER,
      image: `${imageRef}@${imageDigest}`,
      digest: imageDigest,
    },
    contract_artifact: {
      package_uri: descriptor.packageUri,
      package_sha256: descriptor.packageSha256,
      package_integrity: descriptor.packageIntegrity,
      descriptor_subject_sha256: descriptor.descriptorSubjectSha256,
    },
    artifact_provenance: {
      schema_version: 'agentsmith.artifact-provenance/v1',
      provenance_kind: 'ci_artifact',
      producer_repo: EXPECTED_PRODUCER_REPO,
      normalized_remote: EXPECTED_PRODUCER_REPO,
      workflow_name: workflowName,
      job,
      run_id: runId,
      run_attempt: runAttempt,
      commit_sha: gitSha,
      generated_at: generatedAt,
      artifact_uri: `gh-artifact://agentsmith-project/agentsmith-runner/runner-release-manifest/${runId}/runner-release-manifest.json`,
      artifact_sha256: '',
      subject_name: 'runner-release-manifest',
      subject_uri: 'runner-release-manifest.json',
      subject_sha256: '',
      generator_command: GENERATOR_COMMAND,
      generator_version: GENERATOR_VERSION,
      attestation: 'none',
    },
    adoption_policy: {
      fail_fast: true,
      lock_update_required: true,
      release_contract_adoption_required: true,
    },
  };

  const subjectSha = subjectSha256(manifest);
  manifest.artifact_provenance.subject_sha256 = subjectSha;
  manifest.artifact_provenance.artifact_sha256 = subjectSha;

  return manifest;
}

const args = parseArgs(process.argv.slice(2));
const outputPath = resolve(args['--output']);
const manifest = buildManifest(args);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`runner release manifest written: ${outputPath}`);
