#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_SCHEMA = 'agentsmith.runner-ga-handoff-report/v1';
const EXPECTED_SCOPE = 'runner_ga_handoff_evidence';
const EXPECTED_RUNNER = 'agentsmith-runner';
const EXPECTED_STATUS = 'pass';
const EXPECTED_IMAGE_ID = 'agentsmith-runner';
const EXPECTED_PRODUCER_REPO = 'github.com/agentsmith-project/agentsmith-runner';
const EXPECTED_PROTOCOL_VERSIONS = Object.freeze(['1.0']);
const EXPECTED_CHECKS = Object.freeze([
  'runner_release_manifest',
  'digest_pinned_runner_image',
  'contract_artifact_binding',
  'adoption_policy_declared',
]);

const REPORT_FIELDS = new Set([
  'schema_version',
  'scope',
  'status',
  'generated_at',
  'runner',
  'release_id',
  'git_sha',
  'runner_contract_version',
  'supported_protocol_versions',
  'image',
  'contract_artifact',
  'manifest',
  'provenance',
  'checks',
  'notes',
]);
const IMAGE_FIELDS = new Set(['id', 'image', 'digest']);
const CONTRACT_ARTIFACT_FIELDS = new Set([
  'package_uri',
  'package_sha256',
  'descriptor_subject_sha256',
]);
const MANIFEST_FIELDS = new Set([
  'input_sha256',
  'artifact_uri',
  'subject_sha256',
  'artifact_sha256',
]);
const PROVENANCE_FIELDS = new Set([
  'producer_repo',
  'normalized_remote',
  'workflow_name',
  'job',
  'run_id',
  'run_attempt',
  'commit_sha',
]);
const CHECK_FIELDS = new Set(['name', 'status']);

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)[.](0|[1-9]\d*)[.](0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?(?:[+][0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const NUMERIC_ID_PATTERN = /^[1-9][0-9]*$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.]\d{3})?Z$/;
const IMAGE_REF_PATTERN =
  /^ghcr[.]io\/agentsmith-project\/agentsmith-runner:([A-Za-z0-9_][A-Za-z0-9._-]{0,127})@sha256:([a-f0-9]{64})$/;
const CONTRACT_PACKAGE_URI_PATTERN =
  /^gh-artifact:\/\/agentsmith-project\/agentsmith\/runner-contract-artifact\/([1-9][0-9]*)\/([A-Za-z0-9][A-Za-z0-9._-]*[.]tgz)$/;
const RUNNER_MANIFEST_URI_PATTERN =
  /^gh-artifact:\/\/agentsmith-project\/agentsmith-runner\/runner-release-manifest\/([1-9][0-9]*)\/runner-release-manifest[.]json$/;
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
  console.error('Usage: node scripts/check-runner-ga-handoff-report.mjs --report <runner-ga-handoff-report.json>');
}

function addError(message) {
  errors.push(message);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  return actual;
}

function assertPattern(value, pattern, fieldPath, message) {
  const actual = requireString(value, fieldPath);
  if (actual !== null && !pattern.test(actual)) {
    addError(message ?? `${fieldPath} has an invalid format`);
  }
  return actual;
}

function validateForbiddenStrings(value, fieldPath = 'report') {
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

  if (argv.length !== 2 || argv[0] !== '--report') {
    usage();
    addError('expected exactly --report <runner-ga-handoff-report.json>');
    return null;
  }

  return resolve(argv[1]);
}

function readJsonFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    addError(`failed to read runner GA handoff report: ${error.message}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(`failed to parse runner GA handoff report as JSON: ${error.message}`);
    return null;
  }
}

function validateGeneratedAt(value) {
  const generatedAt = requireString(value, 'generated_at');
  if (generatedAt === null) {
    return;
  }

  if (!ISO_UTC_PATTERN.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    addError('generated_at must be an ISO UTC timestamp');
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
    } else if (match[1] === 'latest') {
      addError('image.image must not use the latest tag, even when digest-pinned');
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
    'contract_artifact.package_uri must be a canonical AgentSmith runner contract artifact tgz URI',
  );
  assertPattern(
    contractArtifact.package_sha256,
    SHA256_PATTERN,
    'contract_artifact.package_sha256',
    'contract_artifact.package_sha256 must be sha256:<64 lowercase hex>',
  );
  assertPattern(
    contractArtifact.descriptor_subject_sha256,
    SHA256_PATTERN,
    'contract_artifact.descriptor_subject_sha256',
    'contract_artifact.descriptor_subject_sha256 must be sha256:<64 lowercase hex>',
  );
}

function validateManifestProjection(value, provenance) {
  const manifest = requireObject(value, 'manifest');
  if (manifest === null) {
    return;
  }

  assertOnlyFields(manifest, MANIFEST_FIELDS, 'manifest');
  assertPattern(
    manifest.input_sha256,
    SHA256_PATTERN,
    'manifest.input_sha256',
    'manifest.input_sha256 must be sha256:<64 lowercase hex>',
  );
  const artifactUri = assertPattern(
    manifest.artifact_uri,
    RUNNER_MANIFEST_URI_PATTERN,
    'manifest.artifact_uri',
    'manifest.artifact_uri must be the canonical runner release manifest artifact URI',
  );
  assertPattern(
    manifest.subject_sha256,
    SHA256_PATTERN,
    'manifest.subject_sha256',
    'manifest.subject_sha256 must be sha256:<64 lowercase hex>',
  );
  assertPattern(
    manifest.artifact_sha256,
    SHA256_PATTERN,
    'manifest.artifact_sha256',
    'manifest.artifact_sha256 must be sha256:<64 lowercase hex>',
  );

  if (artifactUri !== null && isPlainObject(provenance) && typeof provenance.run_id === 'string') {
    const match = RUNNER_MANIFEST_URI_PATTERN.exec(artifactUri);
    if (match?.[1] !== provenance.run_id) {
      addError('manifest.artifact_uri run id must match provenance.run_id');
    }
  }
}

function validateProvenance(value, report) {
  const provenance = requireObject(value, 'provenance');
  if (provenance === null) {
    return null;
  }

  assertOnlyFields(provenance, PROVENANCE_FIELDS, 'provenance');
  assertExactString(provenance.producer_repo, EXPECTED_PRODUCER_REPO, 'provenance.producer_repo');
  assertExactString(provenance.normalized_remote, EXPECTED_PRODUCER_REPO, 'provenance.normalized_remote');
  requireString(provenance.workflow_name, 'provenance.workflow_name');
  requireString(provenance.job, 'provenance.job');
  assertPattern(
    provenance.run_id,
    NUMERIC_ID_PATTERN,
    'provenance.run_id',
    'provenance.run_id must be a positive numeric string',
  );
  assertPattern(
    provenance.run_attempt,
    NUMERIC_ID_PATTERN,
    'provenance.run_attempt',
    'provenance.run_attempt must be a positive numeric string',
  );
  const commitSha = assertPattern(
    provenance.commit_sha,
    GIT_SHA_PATTERN,
    'provenance.commit_sha',
    'provenance.commit_sha must be 40 lowercase hex',
  );
  if (commitSha !== null && typeof report.git_sha === 'string' && commitSha !== report.git_sha) {
    addError('provenance.commit_sha must match git_sha');
  }
  return provenance;
}

function validateChecks(value) {
  if (!Array.isArray(value)) {
    addError('checks must be an array');
    return;
  }

  if (value.length !== EXPECTED_CHECKS.length) {
    addError(`checks must contain exactly ${EXPECTED_CHECKS.join(', ')}`);
    return;
  }

  value.forEach((item, index) => {
    const check = requireObject(item, `checks[${index}]`);
    if (check === null) {
      return;
    }
    assertOnlyFields(check, CHECK_FIELDS, `checks[${index}]`);
    const expectedName = EXPECTED_CHECKS[index];
    assertExactString(check.name, expectedName, `checks[${index}].name`);
    assertExactString(check.status, 'pass', `checks[${index}].status`);
  });
}

function validateNotes(value) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    addError('notes must be a non-empty string array');
  }
}

function validateReport(report) {
  const root = requireObject(report, 'report');
  if (root === null) {
    return;
  }

  assertOnlyFields(root, REPORT_FIELDS, 'report');
  validateForbiddenStrings(root);
  assertExactString(root.schema_version, EXPECTED_SCHEMA, 'schema_version');
  assertExactString(root.scope, EXPECTED_SCOPE, 'scope');
  assertExactString(root.status, EXPECTED_STATUS, 'status');
  validateGeneratedAt(root.generated_at);
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
  const provenance = validateProvenance(root.provenance, root);
  validateManifestProjection(root.manifest, provenance);
  validateChecks(root.checks);
  validateNotes(root.notes);
}

const reportPath = parseArgs(process.argv.slice(2));
if (reportPath === null) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(2);
}

const report = readJsonFile(reportPath);
if (report !== null) {
  validateReport(report);
}

if (errors.length > 0) {
  console.error('runner GA handoff report check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('runner GA handoff report check passed');
console.log('Runner GA handoff report check is not a formal verdict');
