#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_SCHEMA = 'agentsmith.runner-release-manifest/v1';
const EXPECTED_RUNNER = 'agentsmith-runner';
const EXPECTED_PROTOCOL_VERSIONS = Object.freeze(['1.0']);
const EXPECTED_IMAGE_ID = 'agentsmith-runner';
const EXPECTED_PROVENANCE_SCHEMA = 'agentsmith.artifact-provenance/v1';
const EXPECTED_PROVENANCE_KIND = 'ci_artifact';
const EXPECTED_PRODUCER_REPO = 'github.com/agentsmith-project/agentsmith-runner';
const EXPECTED_SUBJECT_NAME = 'runner-release-manifest';
const EXPECTED_SUBJECT_URI = 'runner-release-manifest.json';
const EXPECTED_ATTESTATION = 'none';
const MANIFEST_FIELDS = new Set([
  'schema_version',
  'runner',
  'release_id',
  'git_sha',
  'runner_contract_version',
  'supported_protocol_versions',
  'image',
  'contract_artifact',
  'artifact_provenance',
  'adoption_policy',
]);
const IMAGE_FIELDS = new Set(['id', 'image', 'digest']);
const CONTRACT_ARTIFACT_FIELDS = new Set([
  'package_uri',
  'package_sha256',
  'package_integrity',
  'descriptor_subject_sha256',
]);
const ADOPTION_POLICY_FIELDS = new Set([
  'fail_fast',
  'lock_update_required',
  'release_contract_adoption_required',
]);
const PROVENANCE_FIELDS = new Set([
  'schema_version',
  'provenance_kind',
  'producer_repo',
  'normalized_remote',
  'workflow_name',
  'job',
  'run_id',
  'run_attempt',
  'commit_sha',
  'generated_at',
  'artifact_uri',
  'artifact_sha256',
  'subject_name',
  'subject_uri',
  'subject_sha256',
  'generator_command',
  'generator_version',
  'attestation',
]);
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)[.](0|[1-9]\d*)[.](0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?(?:[+][0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const IMAGE_REF_PATTERN =
  /^ghcr[.]io\/agentsmith-project\/agentsmith-runner:([A-Za-z0-9_][A-Za-z0-9._-]{0,127})@sha256:([a-f0-9]{64})$/;
const CONTRACT_PACKAGE_URI_PATTERN =
  /^gh-artifact:\/\/agentsmith-project\/agentsmith\/runner-contract-artifact\/([1-9][0-9]*)\/([A-Za-z0-9][A-Za-z0-9._-]*[.]tgz)$/;
const PACKAGE_INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const NUMERIC_ID_PATTERN = /^[1-9][0-9]*$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.]\d{3})?Z$/;
const FORBIDDEN_STRING_PATTERNS = Object.freeze([
  { label: 'file protocol', pattern: /(?:^|[^\w.+-])file:/ },
  { label: 'link protocol', pattern: /(?:^|[^\w.+-])link:/ },
  { label: 'workspace protocol', pattern: /(?:^|[^\w.+-])workspace:/ },
  { label: '/home path', pattern: /\/home\// },
  { label: '/Users path', pattern: /\/Users\// },
  { label: '~/ path', pattern: /(?:^|[^\w])~\// },
  { label: '../ traversal', pattern: /\.\.\// },
  { label: 'Windows local path', pattern: /[A-Za-z]:\\/ },
  { label: 'localhost', pattern: /(?:^|[/:])localhost(?:[/:]|$)/i },
  { label: 'loopback address', pattern: /(?:^|[/:])127[.]0[.]0[.]1(?:[/:]|$)/ },
  { label: 'credential-like value', pattern: /(?:password|token|secret)[=:][^\s]+/i },
  { label: 'private key block', pattern: /BEGIN (?:RSA |OPENSSH |EC |)PRIVATE KEY/ },
  { label: 'AWS access key', pattern: /AKIA[0-9A-Z]{16}/ },
  { label: 'OpenAI-style API key', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
]);

const errors = [];

function usage() {
  console.error('Usage: node scripts/check-runner-release-manifest.mjs --manifest <manifest-path>');
}

function addError(message) {
  errors.push(message);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireObject(value, fieldPath) {
  if (!isPlainObject(value)) {
    addError(`${fieldPath} must be an object`);
    return null;
  }
  return value;
}

function requireString(value, fieldPath) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(`${fieldPath} must be a non-empty string`);
    return null;
  }
  return value;
}

function assertOnlyFields(value, allowedFields, fieldPath) {
  if (!isPlainObject(value)) {
    return;
  }

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      addError(`${fieldPath}.${field} is not allowed`);
    }
  }
}

function assertExactString(value, expected, fieldPath) {
  const actual = requireString(value, fieldPath);
  if (actual !== null && actual !== expected) {
    addError(`${fieldPath} must equal ${expected}`);
  }
}

function assertPattern(value, pattern, fieldPath, message) {
  const actual = requireString(value, fieldPath);
  if (actual !== null && !pattern.test(actual)) {
    addError(message ?? `${fieldPath} has an invalid format`);
  }
  return actual;
}

function assertTrue(value, fieldPath) {
  if (value !== true) {
    addError(`${fieldPath} must be true`);
  }
}

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new Error('cannot canonicalize undefined values');
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

function validateForbiddenStrings(value, fieldPath = 'manifest') {
  if (typeof value === 'string') {
    for (const { label, pattern } of FORBIDDEN_STRING_PATTERNS) {
      if (pattern.test(value)) {
        addError(`forbidden content: ${label} at ${fieldPath}`);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateForbiddenStrings(item, `${fieldPath}[${index}]`));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      validateForbiddenStrings(item, `${fieldPath}.${key}`);
    }
  }
}

function parseArgs(argv) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    usage();
    process.exit(0);
  }

  if (argv.length !== 2 || argv[0] !== '--manifest') {
    usage();
    addError('expected exactly --manifest <manifest-path>');
    return null;
  }

  return resolve(argv[1]);
}

function readJsonFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    addError(`failed to read manifest: ${error.message}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(`failed to parse manifest as JSON: ${error.message}`);
    return null;
  }
}

function validateSupportedProtocolVersions(value) {
  if (
    !Array.isArray(value) ||
    value.length !== EXPECTED_PROTOCOL_VERSIONS.length ||
    value.some((item, index) => item !== EXPECTED_PROTOCOL_VERSIONS[index])
  ) {
    addError('supported_protocol_versions must equal ["1.0"]');
  }
}

function validateImage(value) {
  const image = requireObject(value, 'image');
  if (image === null) {
    return;
  }

  assertOnlyFields(image, IMAGE_FIELDS, 'image');
  assertExactString(image.id, EXPECTED_IMAGE_ID, 'image.id');

  const imageRef = requireString(image.image, 'image.image');
  const digest = assertPattern(
    image.digest,
    SHA256_PATTERN,
    'image.digest',
    'image.digest must be sha256:<64 lowercase hex>',
  );

  if (imageRef !== null) {
    const match = IMAGE_REF_PATTERN.exec(imageRef);
    if (!match) {
      addError('image.image must be a digest-pinned GHCR ref; tag-only image refs are not allowed');
    } else if (digest !== null && digest !== `sha256:${match[2]}`) {
      addError('image.digest must match the digest embedded in image.image');
    }
  }
}

function validateContractArtifact(value) {
  const contractArtifact = requireObject(value, 'contract_artifact');
  if (contractArtifact === null) {
    return;
  }

  assertOnlyFields(contractArtifact, CONTRACT_ARTIFACT_FIELDS, 'contract_artifact');
  assertPattern(
    contractArtifact.package_uri,
    CONTRACT_PACKAGE_URI_PATTERN,
    'contract_artifact.package_uri',
    'contract_artifact.package_uri must be a P5.2 canonical remote CI artifact URI with positive run id and .tgz filename',
  );
  assertPattern(
    contractArtifact.package_sha256,
    SHA256_PATTERN,
    'contract_artifact.package_sha256',
    'contract_artifact.package_sha256 must be sha256:<64 lowercase hex>',
  );
  assertPattern(
    contractArtifact.package_integrity,
    PACKAGE_INTEGRITY_PATTERN,
    'contract_artifact.package_integrity',
    'contract_artifact.package_integrity must be npm sha512 SRI',
  );
  assertPattern(
    contractArtifact.descriptor_subject_sha256,
    SHA256_PATTERN,
    'contract_artifact.descriptor_subject_sha256',
    'contract_artifact.descriptor_subject_sha256 must be sha256:<64 lowercase hex>',
  );
}

function validateAdoptionPolicy(value) {
  const adoptionPolicy = requireObject(value, 'adoption_policy');
  if (adoptionPolicy === null) {
    return;
  }

  assertOnlyFields(adoptionPolicy, ADOPTION_POLICY_FIELDS, 'adoption_policy');
  assertTrue(adoptionPolicy.fail_fast, 'adoption_policy.fail_fast');
  assertTrue(adoptionPolicy.lock_update_required, 'adoption_policy.lock_update_required');
  assertTrue(
    adoptionPolicy.release_contract_adoption_required,
    'adoption_policy.release_contract_adoption_required',
  );
}

function validateGeneratedAt(value) {
  const generatedAt = requireString(value, 'artifact_provenance.generated_at');
  if (generatedAt === null) {
    return;
  }

  if (!ISO_UTC_PATTERN.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    addError('artifact_provenance.generated_at must be an ISO UTC timestamp');
  }
}

function validateProvenance(value, manifest) {
  const provenance = requireObject(value, 'artifact_provenance');
  if (provenance === null) {
    return;
  }

  assertOnlyFields(provenance, PROVENANCE_FIELDS, 'artifact_provenance');
  assertExactString(provenance.schema_version, EXPECTED_PROVENANCE_SCHEMA, 'artifact_provenance.schema_version');
  assertExactString(provenance.provenance_kind, EXPECTED_PROVENANCE_KIND, 'artifact_provenance.provenance_kind');
  assertExactString(provenance.producer_repo, EXPECTED_PRODUCER_REPO, 'artifact_provenance.producer_repo');
  assertExactString(provenance.normalized_remote, EXPECTED_PRODUCER_REPO, 'artifact_provenance.normalized_remote');
  requireString(provenance.workflow_name, 'artifact_provenance.workflow_name');
  requireString(provenance.job, 'artifact_provenance.job');
  assertPattern(
    provenance.run_id,
    NUMERIC_ID_PATTERN,
    'artifact_provenance.run_id',
    'artifact_provenance.run_id must be a positive numeric string',
  );
  assertPattern(
    provenance.run_attempt,
    NUMERIC_ID_PATTERN,
    'artifact_provenance.run_attempt',
    'artifact_provenance.run_attempt must be a positive numeric string',
  );
  const commitSha = assertPattern(
    provenance.commit_sha,
    GIT_SHA_PATTERN,
    'artifact_provenance.commit_sha',
    'artifact_provenance.commit_sha must be 40 lowercase hex',
  );
  const gitSha = typeof manifest.git_sha === 'string' ? manifest.git_sha : null;
  if (commitSha !== null && gitSha !== null && commitSha !== gitSha) {
    addError('artifact_provenance.commit_sha must match git_sha');
  }
  validateGeneratedAt(provenance.generated_at);

  const artifactUri = requireString(provenance.artifact_uri, 'artifact_provenance.artifact_uri');
  if (artifactUri !== null) {
    const runId = typeof provenance.run_id === 'string' ? provenance.run_id : '<run_id>';
    const expectedArtifactUri = `gh-artifact://agentsmith-project/agentsmith-runner/runner-release-manifest/${runId}/runner-release-manifest.json`;
    if (artifactUri !== expectedArtifactUri) {
      addError(`artifact_provenance.artifact_uri must equal ${expectedArtifactUri}`);
    }
  }

  const artifactSha = assertPattern(
    provenance.artifact_sha256,
    SHA256_PATTERN,
    'artifact_provenance.artifact_sha256',
    'artifact_provenance.artifact_sha256 must be sha256:<64 lowercase hex>',
  );
  assertExactString(provenance.subject_name, EXPECTED_SUBJECT_NAME, 'artifact_provenance.subject_name');
  assertExactString(provenance.subject_uri, EXPECTED_SUBJECT_URI, 'artifact_provenance.subject_uri');
  const actualSubjectSha = assertPattern(
    provenance.subject_sha256,
    SHA256_PATTERN,
    'artifact_provenance.subject_sha256',
    'artifact_provenance.subject_sha256 must be sha256:<64 lowercase hex>',
  );
  if (actualSubjectSha !== null) {
    let expectedSubjectSha;
    try {
      expectedSubjectSha = subjectSha256(manifest);
    } catch (error) {
      addError(`artifact_provenance.subject_sha256 could not be computed: ${error.message}`);
    }
    if (expectedSubjectSha !== undefined && actualSubjectSha !== expectedSubjectSha) {
      addError(
        `artifact_provenance.subject_sha256 must equal ${expectedSubjectSha} when artifact_provenance is excluded`,
      );
    }
  }
  if (artifactSha !== null && actualSubjectSha !== null && artifactSha !== actualSubjectSha) {
    addError('artifact_provenance.artifact_sha256 must equal artifact_provenance.subject_sha256 in skeleton mode');
  }
  requireString(provenance.generator_command, 'artifact_provenance.generator_command');
  requireString(provenance.generator_version, 'artifact_provenance.generator_version');
  assertExactString(provenance.attestation, EXPECTED_ATTESTATION, 'artifact_provenance.attestation');
}

function validateManifest(manifest) {
  const root = requireObject(manifest, 'manifest');
  if (root === null) {
    return;
  }

  assertOnlyFields(root, MANIFEST_FIELDS, 'manifest');
  validateForbiddenStrings(root);
  assertExactString(root.schema_version, EXPECTED_SCHEMA, 'schema_version');
  assertExactString(root.runner, EXPECTED_RUNNER, 'runner');
  assertPattern(
    root.release_id,
    /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/,
    'release_id',
    'release_id must be a non-empty stable identifier without path separators or whitespace',
  );
  assertPattern(root.git_sha, GIT_SHA_PATTERN, 'git_sha', 'git_sha must be 40 lowercase hex');
  assertPattern(
    root.runner_contract_version,
    SEMVER_PATTERN,
    'runner_contract_version',
    'runner_contract_version must be semver',
  );
  validateSupportedProtocolVersions(root.supported_protocol_versions);
  validateImage(root.image);
  validateContractArtifact(root.contract_artifact);
  validateAdoptionPolicy(root.adoption_policy);
  validateProvenance(root.artifact_provenance, root);
}

const manifestPath = parseArgs(process.argv.slice(2));
if (manifestPath === null) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(2);
}

const manifest = readJsonFile(manifestPath);
if (manifest !== null) {
  validateManifest(manifest);
}

if (errors.length > 0) {
  console.error('runner release manifest skeleton check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('runner release manifest skeleton check passed');
console.log('Manifest skeleton check is not release readiness');
