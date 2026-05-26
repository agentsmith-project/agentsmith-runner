#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const EXPECTED_DESCRIPTOR_SCHEMA = 'agentsmith.runner-contract-artifact/v1';
const EXPECTED_PACKAGE_MANIFEST_SCHEMA = 'agentsmith.runner-contract-package-manifest/v1';
const EXPECTED_PACKAGE_MANIFEST_KIND = 'runner_contract_package_manifest';
const EXPECTED_PROVENANCE_SCHEMA = 'agentsmith.artifact-provenance/v1';
const EXPECTED_PACKAGE_NAME = '@mbos/agent-runner-contract';
const EXPECTED_PRODUCER_REPO = 'github.com/agentsmith-project/agentsmith';
const EXPECTED_WORKFLOW_NAME = 'Runner Contract Artifact';
const EXPECTED_PROVENANCE_JOB = 'produce-runner-contract-artifact';
const EXPECTED_SUBJECT_NAME = 'runner-contract-artifact';
const EXPECTED_SUBJECT_URI = 'runner-contract-artifact.json';
const EXPECTED_RELEASE_PROVENANCE_KIND = 'external_descriptor';
const EXPECTED_RELEASE_PROVENANCE_DESCRIPTOR = 'runner-contract-artifact.json';
const EXPECTED_URI_PREFIX = 'gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact';
const EXPECTED_GENERATOR_COMMAND = 'npx tsx scripts/governance/runner-contract-artifact.ts';
const EXPECTED_GENERATOR_VERSION = 'p4-runner-contract-artifact';
const EXPECTED_ATTESTATION = 'none';
const CANONICAL_ENTRYPOINTS = Object.freeze({
  version: './dist/artifact.js',
  schema: './dist/contract-schema.js',
  types: './dist/index.d.ts',
  fixtures: './dist/contract-schema.js',
});
const CANONICAL_ENTRYPOINT_FIELDS = new Set(Object.keys(CANONICAL_ENTRYPOINTS));
const DESCRIPTOR_FIELDS = new Set([
  'schema_version',
  'package',
  'artifact',
  'entrypoints',
  'artifact_provenance',
]);
const DESCRIPTOR_PACKAGE_FIELDS = new Set(['name', 'version']);
const DESCRIPTOR_ARTIFACT_FIELDS = new Set(['filename', 'integrity', 'sha256', 'uri']);
const DESCRIPTOR_PROVENANCE_FIELDS = new Set([
  'artifact_sha256',
  'artifact_uri',
  'attestation',
  'commit_sha',
  'generated_at',
  'generator_command',
  'generator_version',
  'job',
  'normalized_remote',
  'producer_repo',
  'provenance_kind',
  'run_attempt',
  'run_id',
  'schema_version',
  'subject_name',
  'subject_sha256',
  'subject_uri',
  'workflow_name',
]);
const DEPENDENCY_OBJECT_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const BUNDLED_DEPENDENCY_FIELDS = ['bundledDependencies', 'bundleDependencies'];
const FORBIDDEN_LIFECYCLE_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepack',
  'postpack',
];
const LOCAL_DEPENDENCY_PROTOCOL = /(?:^|[^\w.+-])(file|link|workspace):/;
const ALLOWED_TARBALL_DIRECTORIES = new Set(['package/', 'package/dist/']);
const ALLOWED_DIST_FILE = /^dist\/[^/]+(?:\.js|\.d\.ts)$/;
const PACKAGE_MANIFEST_FIELDS = new Set([
  'schema_version',
  'metadata_kind',
  'package',
  'entrypoints',
  'release_provenance',
]);
const PACKAGE_RELEASE_PROVENANCE_FIELDS = new Set(['kind', 'descriptor_name']);
const FORBIDDEN_CONTENT_PATTERNS = [
  { label: '/Users path', pattern: /\/Users\// },
  { label: '~/ path', pattern: /(?:^|[^\w])~\// },
  { label: '../ traversal', pattern: /\.\.\// },
  { label: 'workspace: protocol', pattern: /(?:^|[^\w.+-])workspace:/ },
  { label: 'file: protocol', pattern: /(?:^|[^\w.+-])file:/ },
  { label: 'link: protocol', pattern: /(?:^|[^\w.+-])link:/ },
  { label: 'non-contract @mbos runner package', pattern: /@mbos\/agent-runner(?!-contract(?:\b|\/))/ },
  { label: 'buildAgentRuntimeEnv implementation symbol', pattern: /buildAgentRuntimeEnv/ },
  { label: 'agentsmith-runner repo reference', pattern: /agentsmith-runner/ },
];
const HOME_PATH_PATTERN = /\/home\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._~:@%+=,-]+)*/g;
const ALLOWED_RUNNER_HOME_PATTERN =
  /^\/home\/task_[A-Za-z0-9_-]+(?:\/workspace(?:\/\.artifacts(?:\/[A-Za-z0-9._~:@%+=,-]+)*)?)?$/;

function usage() {
  console.error('Usage: node scripts/check-runner-contract-consumer.mjs --artifact-root <dir>');
}

function fail(message, code = 1) {
  console.error(`error: ${message}`);
  process.exit(code);
}

function requireString(value, fieldPath) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${fieldPath} must be a non-empty string`);
  }
  return value;
}

function requireObject(value, fieldPath) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${fieldPath} must be an object`);
  }
  return value;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--artifact-root') {
    usage();
    fail('expected exactly --artifact-root <dir>', 2);
  }

  return resolve(argv[1]);
}

function readTextFile(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    fail(`failed to read ${label}: ${error.message}`);
  }

  return raw;
}

function parseJsonText(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`failed to parse ${label} as JSON: ${error.message}`);
  }
}

function readJsonFile(path, label) {
  return parseJsonText(readTextFile(path, label), label);
}

function readTarballEntry(tgzPath, entryName) {
  const result = spawnSync('tar', ['-xOf', tgzPath, entryName], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    fail(`failed to inspect ${entryName} in ${tgzPath}`);
  }

  return result.stdout;
}

function readJsonFromTarball(tgzPath, entryName) {
  const raw = readTarballEntry(tgzPath, entryName);

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`failed to parse ${entryName} from ${tgzPath}: ${error.message}`);
  }
}

function assertEquals(actual, expected, fieldPath) {
  if (actual !== expected) {
    fail(`${fieldPath} must equal ${expected}`);
  }
}

function assertJsonEquivalent(actual, expected, fieldPath) {
  if (canonicalStringify(actual) !== canonicalStringify(expected)) {
    fail(`${fieldPath} must match the external descriptor`);
  }
}

function assertOnlyFields(value, allowedFields, fieldPath) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      fail(`${fieldPath}.${field} is not allowed`);
    }
  }
}

function assertStringEntrypointObject(value, fieldPath) {
  const entrypoints = requireObject(value, fieldPath);
  const entries = Object.entries(entrypoints);
  if (entries.length === 0) {
    fail(`${fieldPath} must not be empty`);
  }

  for (const [name, target] of entries) {
    requireString(target, `${fieldPath}.${name}`);
  }

  return entrypoints;
}

function assertCanonicalEntrypoints(value, fieldPath) {
  const entrypoints = assertStringEntrypointObject(value, fieldPath);
  assertOnlyFields(entrypoints, CANONICAL_ENTRYPOINT_FIELDS, fieldPath);

  for (const [name, target] of Object.entries(CANONICAL_ENTRYPOINTS)) {
    assertEquals(entrypoints[name], target, `${fieldPath}.${name}`);
  }

  return entrypoints;
}

function assertSafeArtifactFilename(filename) {
  if (filename !== basename(filename) || filename.includes('/') || filename.includes('\\')) {
    fail('artifact.filename must be a basename, not a path');
  }
  if (!filename.endsWith('.tgz')) {
    fail('artifact.filename must point to an npm tgz artifact');
  }
}

function digestFile(path, algorithm) {
  const data = readFileSync(path);
  return createHash(algorithm).update(data).digest();
}

function assertSha256String(expected, fieldPath) {
  const normalized = requireString(expected, fieldPath);
  if (!normalized.startsWith('sha256:')) {
    fail(`${fieldPath} must use sha256:<hex> format`);
  }

  const expectedHex = normalized.slice('sha256:'.length);
  if (!/^[a-f0-9]{64}$/.test(expectedHex)) {
    fail(`${fieldPath} must contain a lowercase sha256 hex digest`);
  }

  return expectedHex;
}

function assertSha256(tgzPath, expected) {
  const expectedHex = assertSha256String(expected, 'artifact.sha256');
  const actualHex = digestFile(tgzPath, 'sha256').toString('hex');
  if (actualHex !== expectedHex) {
    fail('artifact.sha256 does not match tgz content');
  }
}

function assertIntegrity(tgzPath, integrity) {
  const tokens = requireString(integrity, 'artifact.integrity').trim().split(/\s+/);
  if (tokens.length === 0) {
    fail('artifact.integrity must contain at least one SRI token');
  }

  const supportedAlgorithms = new Set(['sha256', 'sha384', 'sha512']);
  let matched = false;

  for (const token of tokens) {
    const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/.exec(token);
    if (!match) {
      fail(`artifact.integrity contains invalid SRI token: ${token}`);
    }

    const [, algorithm, expectedBase64] = match;
    if (!supportedAlgorithms.has(algorithm)) {
      continue;
    }

    const actualBase64 = digestFile(tgzPath, algorithm).toString('base64');
    if (actualBase64 === expectedBase64) {
      matched = true;
    }
  }

  if (!matched) {
    fail('artifact.integrity does not match tgz content');
  }
}

function assertPositiveInteger(value, fieldPath) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      fail(`${fieldPath} must be a positive integer`);
    }
    return String(value);
  }

  if (typeof value === 'string' && /^[1-9][0-9]*$/.test(value)) {
    return value;
  }

  fail(`${fieldPath} must be a positive integer`);
}

function assertIsoishTimestamp(value, fieldPath) {
  const timestamp = requireString(value, fieldPath);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) {
    fail(`${fieldPath} must be an ISO timestamp`);
  }
  if (Number.isNaN(Date.parse(timestamp))) {
    fail(`${fieldPath} must be parseable as a date`);
  }
}

function dependencyEntries(packageJson, field) {
  const value = packageJson[field];
  if (value === undefined) {
    return [];
  }
  if (!isPlainObject(value)) {
    fail(`package.json ${field} must be absent or an empty object`);
  }
  return Object.entries(value);
}

function assertNoLocalDependencyProtocols(packageJson) {
  for (const field of DEPENDENCY_OBJECT_FIELDS) {
    for (const [name, spec] of dependencyEntries(packageJson, field)) {
      if (typeof spec !== 'string') {
        fail(`package.json ${field}.${name} must be a string dependency spec`);
      }
      if (LOCAL_DEPENDENCY_PROTOCOL.test(spec)) {
        fail(`package.json ${field}.${name} must not use a local dependency protocol`);
      }
    }
  }
}

function assertEmptyDependencyObjects(packageJson) {
  for (const field of DEPENDENCY_OBJECT_FIELDS) {
    const entries = dependencyEntries(packageJson, field);
    if (entries.length > 0) {
      fail(`package.json ${field} must be absent or empty`);
    }
  }
}

function assertEmptyBundledDependencies(packageJson) {
  for (const field of BUNDLED_DEPENDENCY_FIELDS) {
    const value = packageJson[field];
    if (value === undefined || value === false) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        fail(`package.json ${field} must be absent or empty`);
      }
      continue;
    }
    if (isPlainObject(value)) {
      if (Object.keys(value).length > 0) {
        fail(`package.json ${field} must be absent or empty`);
      }
      continue;
    }
    fail(`package.json ${field} must be absent or empty`);
  }
}

function assertNoForbiddenLifecycleScripts(packageJson) {
  const scripts = packageJson.scripts;
  if (scripts === undefined) {
    return;
  }
  if (!isPlainObject(scripts)) {
    fail('package.json scripts must be an object when present');
  }

  for (const scriptName of FORBIDDEN_LIFECYCLE_SCRIPTS) {
    if (hasOwn(scripts, scriptName)) {
      fail(`package.json scripts.${scriptName} is forbidden in runner contract artifacts`);
    }
  }
}

function listTarball(tgzPath, args, label) {
  const result = spawnSync('tar', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    fail(`failed to ${label} ${tgzPath}`);
  }

  return result.stdout.split(/\r?\n/).filter((line) => line.length > 0);
}

function assertSafeTarballEntryName(entryName) {
  if (entryName.length === 0) {
    fail('tarball entry name must be non-empty');
  }
  if (entryName.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entryName)) {
    fail(`tarball entry must not be absolute: ${entryName}`);
  }
  if (entryName.includes('\\')) {
    fail(`tarball entry must not contain backslashes: ${entryName}`);
  }
  if (!entryName.startsWith('package/')) {
    fail(`tarball entry must stay under package/: ${entryName}`);
  }

  const withoutTrailingSlash = entryName.endsWith('/') ? entryName.slice(0, -1) : entryName;
  const segments = withoutTrailingSlash.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(`tarball entry must not contain empty, current, or parent directory segments: ${entryName}`);
  }
}

function assertAllowedTarballFile(entryName) {
  const relativeName = entryName.slice('package/'.length);
  const lowerRelativeName = relativeName.toLowerCase();
  const fileBasename = basename(lowerRelativeName);
  if (
    lowerRelativeName.startsWith('src/') ||
    lowerRelativeName.startsWith('source/') ||
    lowerRelativeName.startsWith('test/') ||
    lowerRelativeName.startsWith('tests/') ||
    /(^|[._-])tests?([._-]|$)/.test(fileBasename) ||
    /(^|[._-])sources?([._-]|$)/.test(fileBasename)
  ) {
    fail(`tarball entry must not include source or test files: ${entryName}`);
  }

  if (relativeName === 'package.json' || relativeName === 'contract-artifact.json') {
    return;
  }
  if (ALLOWED_DIST_FILE.test(relativeName)) {
    return;
  }

  fail(`tarball entry is not in the fixed runner contract allowlist: ${entryName}`);
}

function assertAllowedTarballDirectory(entryName) {
  if (!ALLOWED_TARBALL_DIRECTORIES.has(entryName)) {
    fail(`tarball directory is not in the fixed runner contract allowlist: ${entryName}`);
  }
}

function scanContentForForbiddenPatterns(content, contentLabel, options = {}) {
  const allowRunnerHomePaths = options.allowRunnerHomePaths === true;

  for (const { label: patternLabel, pattern } of FORBIDDEN_CONTENT_PATTERNS) {
    if (pattern.test(content)) {
      fail(`${contentLabel} contains forbidden content: ${patternLabel}`);
    }
  }

  for (const match of content.matchAll(HOME_PATH_PATTERN)) {
    const homePath = match[0];
    if (allowRunnerHomePaths && ALLOWED_RUNNER_HOME_PATTERN.test(homePath)) {
      continue;
    }

    const reason = allowRunnerHomePaths ? `non-task /home path (${homePath})` : `/home path (${homePath})`;
    fail(`${contentLabel} contains forbidden content: ${reason}`);
  }
}

function scanJsonValueContent(value, fieldPath) {
  if (typeof value === 'string') {
    scanContentForForbiddenPatterns(value, fieldPath);
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      scanJsonValueContent(value[index], `${fieldPath}[${index}]`);
    }
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      scanContentForForbiddenPatterns(key, `${fieldPath}.${key} key`);
      scanJsonValueContent(child, `${fieldPath}.${key}`);
    }
  }
}

function scanTarballEntryContent(tgzPath, entryName) {
  const content = readTarballEntry(tgzPath, entryName);
  scanContentForForbiddenPatterns(content, `tarball entry ${entryName}`, {
    allowRunnerHomePaths: true,
  });
}

function validatePackageTarballBoundary(tgzPath) {
  const names = listTarball(tgzPath, ['-tzf', tgzPath], 'list tarball entries for');
  const verboseLines = listTarball(tgzPath, ['-tvzf', tgzPath], 'list tarball entry types for');
  if (names.length === 0) {
    fail('runner contract tarball must not be empty');
  }
  if (names.length !== verboseLines.length) {
    fail('runner contract tarball entry listing and type listing disagree');
  }

  const seen = new Set();
  let hasPackageJson = false;
  let hasContractArtifactJson = false;

  for (let index = 0; index < names.length; index += 1) {
    const entryName = names[index];
    const type = verboseLines[index][0];

    if (seen.has(entryName)) {
      fail(`tarball entry must not be duplicated: ${entryName}`);
    }
    seen.add(entryName);

    assertSafeTarballEntryName(entryName);

    if (type === 'l') {
      fail(`tarball entry must not be a symlink: ${entryName}`);
    }
    if (type === 'h') {
      fail(`tarball entry must not be a hardlink: ${entryName}`);
    }
    if (type === 'd') {
      assertAllowedTarballDirectory(entryName);
      continue;
    }
    if (type !== '-') {
      fail(`tarball entry has unsupported type ${type}: ${entryName}`);
    }

    assertAllowedTarballFile(entryName);
    if (entryName === 'package/package.json') {
      hasPackageJson = true;
    }
    if (entryName === 'package/contract-artifact.json') {
      hasContractArtifactJson = true;
    }
    scanTarballEntryContent(tgzPath, entryName);
  }

  if (!hasPackageJson) {
    fail('runner contract tarball must contain package/package.json');
  }
  if (!hasContractArtifactJson) {
    fail('runner contract tarball must contain package/contract-artifact.json');
  }
}

function assertPackageManifestSurfaceMatches(manifest, externalDescriptor, label) {
  const manifestObject = requireObject(manifest, label);
  if (manifestObject.artifact_kind === 'local_pack_manifest') {
    fail(
      `${label} must use the formal runner contract descriptor, not local_pack_manifest. ` +
        'AgentSmith producer must upgrade the package artifact surface or this consumer must rely only on the external descriptor.',
    );
  }

  assertOnlyFields(manifestObject, PACKAGE_MANIFEST_FIELDS, label);
  assertEquals(manifestObject.schema_version, EXPECTED_PACKAGE_MANIFEST_SCHEMA, `${label}.schema_version`);
  assertEquals(manifestObject.metadata_kind, EXPECTED_PACKAGE_MANIFEST_KIND, `${label}.metadata_kind`);
  assertJsonEquivalent(manifestObject.package, externalDescriptor.package, `${label}.package`);

  const entrypoints = assertCanonicalEntrypoints(manifestObject.entrypoints, `${label}.entrypoints`);
  assertJsonEquivalent(entrypoints, externalDescriptor.entrypoints, `${label}.entrypoints`);

  const releaseProvenance = requireObject(manifestObject.release_provenance, `${label}.release_provenance`);
  assertOnlyFields(releaseProvenance, PACKAGE_RELEASE_PROVENANCE_FIELDS, `${label}.release_provenance`);
  assertEquals(releaseProvenance.kind, EXPECTED_RELEASE_PROVENANCE_KIND, `${label}.release_provenance.kind`);
  assertEquals(
    releaseProvenance.descriptor_name,
    EXPECTED_RELEASE_PROVENANCE_DESCRIPTOR,
    `${label}.release_provenance.descriptor_name`,
  );
}

function inspectPackageTarball(tgzPath, expectedVersion, descriptor) {
  validatePackageTarballBoundary(tgzPath);

  const packageJson = readJsonFromTarball(tgzPath, 'package/package.json');
  assertEquals(packageJson.name, EXPECTED_PACKAGE_NAME, 'package.json name');
  assertEquals(packageJson.version, expectedVersion, 'package.json version');
  assertNoLocalDependencyProtocols(packageJson);
  assertEmptyDependencyObjects(packageJson);
  assertEmptyBundledDependencies(packageJson);
  assertNoForbiddenLifecycleScripts(packageJson);

  const packageDescriptor = readJsonFromTarball(tgzPath, 'package/contract-artifact.json');
  assertPackageManifestSurfaceMatches(packageDescriptor, descriptor, 'package/contract-artifact.json');
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    fail(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }

  return result;
}

function validateDescriptor(descriptor, artifactRoot) {
  const descriptorObject = requireObject(descriptor, 'runner-contract-artifact.json');
  if (descriptor.artifact_kind === 'local_pack_manifest') {
    fail('runner-contract-artifact.json must not use legacy local_pack_manifest');
  }

  assertOnlyFields(descriptorObject, DESCRIPTOR_FIELDS, 'runner-contract-artifact.json');
  assertEquals(descriptor.schema_version, EXPECTED_DESCRIPTOR_SCHEMA, 'schema_version');

  const packageInfo = requireObject(descriptor.package, 'package');
  assertOnlyFields(packageInfo, DESCRIPTOR_PACKAGE_FIELDS, 'package');
  assertEquals(packageInfo.name, EXPECTED_PACKAGE_NAME, 'package.name');
  const packageVersion = requireString(packageInfo.version, 'package.version');

  assertCanonicalEntrypoints(descriptor.entrypoints, 'entrypoints');

  const artifact = requireObject(descriptor.artifact, 'artifact');
  assertOnlyFields(artifact, DESCRIPTOR_ARTIFACT_FIELDS, 'artifact');
  const filename = requireString(artifact.filename, 'artifact.filename');
  assertSafeArtifactFilename(filename);
  const artifactSha256 = requireString(artifact.sha256, 'artifact.sha256');
  const artifactIntegrity = requireString(artifact.integrity, 'artifact.integrity');
  const artifactUri = requireString(artifact.uri, 'artifact.uri');

  const provenance = requireObject(descriptor.artifact_provenance, 'artifact_provenance');
  assertOnlyFields(provenance, DESCRIPTOR_PROVENANCE_FIELDS, 'artifact_provenance');
  assertEquals(provenance.schema_version, EXPECTED_PROVENANCE_SCHEMA, 'artifact_provenance.schema_version');
  assertEquals(provenance.provenance_kind, 'ci_artifact', 'artifact_provenance.provenance_kind');
  assertEquals(provenance.producer_repo, EXPECTED_PRODUCER_REPO, 'artifact_provenance.producer_repo');
  assertEquals(provenance.normalized_remote, EXPECTED_PRODUCER_REPO, 'artifact_provenance.normalized_remote');
  assertEquals(provenance.workflow_name, EXPECTED_WORKFLOW_NAME, 'artifact_provenance.workflow_name');
  assertEquals(provenance.subject_name, EXPECTED_SUBJECT_NAME, 'artifact_provenance.subject_name');
  assertEquals(provenance.subject_uri, EXPECTED_SUBJECT_URI, 'artifact_provenance.subject_uri');
  assertEquals(provenance.job, EXPECTED_PROVENANCE_JOB, 'artifact_provenance.job');
  assertEquals(provenance.generator_command, EXPECTED_GENERATOR_COMMAND, 'artifact_provenance.generator_command');
  assertEquals(provenance.generator_version, EXPECTED_GENERATOR_VERSION, 'artifact_provenance.generator_version');
  assertEquals(provenance.attestation, EXPECTED_ATTESTATION, 'artifact_provenance.attestation');

  const commitSha = requireString(provenance.commit_sha, 'artifact_provenance.commit_sha');
  if (!/^[a-f0-9]{40}$/.test(commitSha)) {
    fail('artifact_provenance.commit_sha must be a 40 character lowercase hex commit sha');
  }

  const runId = assertPositiveInteger(provenance.run_id, 'artifact_provenance.run_id');
  assertPositiveInteger(provenance.run_attempt, 'artifact_provenance.run_attempt');
  assertIsoishTimestamp(provenance.generated_at, 'artifact_provenance.generated_at');

  assertEquals(provenance.artifact_sha256, artifactSha256, 'artifact_provenance.artifact_sha256');
  assertEquals(provenance.artifact_uri, artifactUri, 'artifact_provenance.artifact_uri');
  assertSha256String(provenance.subject_sha256, 'artifact_provenance.subject_sha256');

  const { artifact_provenance: ignoredProvenance, ...descriptorSubject } = descriptor;
  void ignoredProvenance;
  const subjectHash = createHash('sha256').update(canonicalStringify(descriptorSubject)).digest('hex');
  assertEquals(provenance.subject_sha256, `sha256:${subjectHash}`, 'artifact_provenance.subject_sha256');

  const expectedUri = `${EXPECTED_URI_PREFIX}/${runId}/${filename}`;
  assertEquals(artifactUri, expectedUri, 'artifact.uri');

  const tgzPath = join(artifactRoot, filename);
  try {
    const stats = statSync(tgzPath);
    if (!stats.isFile()) {
      fail('artifact filename must resolve to a file under artifact-root');
    }
  } catch (error) {
    fail(`artifact file is missing under artifact-root: ${error.message}`);
  }

  assertSha256(tgzPath, artifactSha256);
  assertIntegrity(tgzPath, artifactIntegrity);
  inspectPackageTarball(tgzPath, packageVersion, descriptor);

  return {
    packageVersion,
    tgzPath,
  };
}

function smokeSource(descriptor) {
  const expectedVersion = descriptor.package.version;
  const descriptorLiteral = JSON.stringify(descriptor, null, 2);
  return `
import assert from 'node:assert/strict';
import * as contract from '@mbos/agent-runner-contract';
import * as artifact from '@mbos/agent-runner-contract/artifact';
import contractArtifactJson from '@mbos/agent-runner-contract/contract-artifact.json' with { type: 'json' };

const externalDescriptor = ${descriptorLiteral};

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return \`[\${value.map((item) => canonicalStringify(item)).join(',')}]\`;
  }
  return \`{\${Object.keys(value)
    .sort()
    .map((key) => \`\${JSON.stringify(key)}:\${canonicalStringify(value[key])}\`)
    .join(',')}}\`;
}

function assertJsonEquivalent(actual, expected, label) {
  assert.equal(canonicalStringify(actual), canonicalStringify(expected), \`\${label} must match the external descriptor\`);
}

function assertPackageManifestSurfaceMatches(metadata, label) {
  assert.equal(typeof metadata, 'object', \`\${label} must be an object\`);
  assert.notEqual(metadata, null, \`\${label} must be an object\`);
  if (metadata.artifact_kind === 'local_pack_manifest') {
    assert.fail(
      label + ' must use the formal runner contract descriptor, not local_pack_manifest. ' +
        'AgentSmith producer must upgrade the package artifact surface or this consumer must rely only on the external descriptor.',
    );
  }

  const allowedFields = new Set(['schema_version', 'metadata_kind', 'package', 'entrypoints', 'release_provenance']);
  for (const field of Object.keys(metadata)) {
    assert.equal(allowedFields.has(field), true, \`\${label}.\${field} is not allowed\`);
  }

  assert.equal(metadata.schema_version, 'agentsmith.runner-contract-package-manifest/v1', \`\${label}.schema_version\`);
  assert.equal(metadata.metadata_kind, 'runner_contract_package_manifest', \`\${label}.metadata_kind\`);
  assertJsonEquivalent(metadata.package, externalDescriptor.package, \`\${label}.package\`);
  assert.equal(typeof metadata.entrypoints, 'object', \`\${label}.entrypoints must be an object\`);
  assert.notEqual(metadata.entrypoints, null, \`\${label}.entrypoints must be an object\`);
  assertJsonEquivalent(metadata.entrypoints, {
    version: './dist/artifact.js',
    schema: './dist/contract-schema.js',
    types: './dist/index.d.ts',
    fixtures: './dist/contract-schema.js',
  }, \`\${label}.entrypoints\`);
  assertJsonEquivalent(metadata.entrypoints, externalDescriptor.entrypoints, \`\${label}.entrypoints\`);
  const releaseProvenanceFields = new Set(['kind', 'descriptor_name']);
  for (const field of Object.keys(metadata.release_provenance)) {
    assert.equal(releaseProvenanceFields.has(field), true, \`\${label}.release_provenance.\${field} is not allowed\`);
  }
  assert.equal(metadata.release_provenance.kind, 'external_descriptor', \`\${label}.release_provenance.kind\`);
  assert.equal(
    metadata.release_provenance.descriptor_name,
    'runner-contract-artifact.json',
    \`\${label}.release_provenance.descriptor_name\`,
  );
}

assert.equal(contract.RUNNER_CONTRACT_VERSION, ${JSON.stringify(expectedVersion)});
assertPackageManifestSurfaceMatches(artifact.RUNNER_CONTRACT_ARTIFACT, 'artifact.RUNNER_CONTRACT_ARTIFACT');
assertPackageManifestSurfaceMatches(contractArtifactJson, 'contractArtifactJson');

assert.equal(contract.AGENT_TASK_RUNNER_SPEC.protocol_version, '1.0');
assert.equal(contract.isAgentTaskRunnerSpec(contract.AGENT_TASK_RUNNER_SPEC), true);

const fixture = contract.getTaskExecutionContextFixture('managedTaskRun');
assert.equal(contract.isTaskExecutionContext(fixture), true);

const unsupportedProtocol = {
  ...contract.AGENT_TASK_RUNNER_SPEC,
  protocol_version: '999.0',
};
assert.equal(contract.isAgentTaskRunnerSpec(unsupportedProtocol), false);

const legacySpec = {
  ...contract.AGENT_TASK_RUNNER_SPEC,
  interaction_kind: 'chat',
};
assert.equal(contract.isAgentTaskRunnerSpec(legacySpec), false);

const invalidContext = {
  ...fixture,
  external_agent_id: 'legacy-runner',
};
assert.equal(contract.isTaskExecutionContext(invalidContext), false);
`;
}

function runConsumerSmoke(tgzPath, descriptor) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'agentsmith-runner-contract-consumer-'));

  try {
    run('npm', ['init', '-y'], tempRoot);
    run('npm', ['install', tgzPath, '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'], tempRoot);

    const smokePath = join(tempRoot, 'smoke.mjs');
    writeFileSync(smokePath, smokeSource(descriptor), 'utf8');
    run('node', [smokePath], tempRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const artifactRoot = parseArgs(process.argv.slice(2));
let artifactRootStats;
try {
  artifactRootStats = statSync(artifactRoot);
} catch (error) {
  fail(`artifact-root does not exist: ${error.message}`);
}

if (!artifactRootStats.isDirectory()) {
  fail('artifact-root must be a directory');
}

const descriptorPath = join(artifactRoot, 'runner-contract-artifact.json');
const descriptorRaw = readTextFile(descriptorPath, 'runner-contract-artifact.json');
scanContentForForbiddenPatterns(descriptorRaw, 'runner-contract-artifact.json');
const descriptor = parseJsonText(descriptorRaw, 'runner-contract-artifact.json');
scanJsonValueContent(descriptor, 'runner-contract-artifact.json');
const { tgzPath } = validateDescriptor(descriptor, artifactRoot);
runConsumerSmoke(tgzPath, descriptor);

console.log('contract consumer skeleton passed');
console.log('not release readiness');
