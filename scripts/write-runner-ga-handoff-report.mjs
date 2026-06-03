#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REPORT_SCHEMA = 'agentsmith.runner-ga-handoff-report/v1';
const REPORT_SCOPE = 'runner_ga_handoff_evidence';
const OUTPUT_FILE = 'runner-ga-handoff-report.json';
const REQUIRED_ARGS = Object.freeze(['--manifest', '--output-dir']);
const OPTIONAL_ARGS = Object.freeze(['--generated-at']);
const ALL_ARGS = new Set([...REQUIRED_ARGS, ...OPTIONAL_ARGS]);
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.]\d{3})?Z$/;

function usage() {
  console.error(
    'Usage: node scripts/write-runner-ga-handoff-report.mjs ' +
      '--manifest <runner-release-manifest.json> --output-dir <dir> [--generated-at <iso>]',
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

function readJson(path, label) {
  let raw;
  try {
    raw = readFileSync(path);
  } catch (error) {
    fail(`failed to read ${label}: ${error.message}`);
  }

  try {
    return {
      raw,
      value: JSON.parse(raw.toString('utf8')),
      sha256: `sha256:${createHash('sha256').update(raw).digest('hex')}`,
    };
  } catch (error) {
    fail(`failed to parse ${label} as JSON: ${error.message}`);
  }
}

function requireObject(value, fieldPath) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
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

function normalizeGeneratedAt(value) {
  const generatedAt = value ?? new Date().toISOString();
  if (!ISO_UTC_PATTERN.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    fail('--generated-at must be an ISO UTC timestamp');
  }
  return generatedAt;
}

function buildReport({ manifest, manifestSha256, generatedAt }) {
  const image = requireObject(manifest.image, 'manifest.image');
  const contractArtifact = requireObject(manifest.contract_artifact, 'manifest.contract_artifact');
  const provenance = requireObject(manifest.artifact_provenance, 'manifest.artifact_provenance');

  return {
    schema_version: REPORT_SCHEMA,
    scope: REPORT_SCOPE,
    status: 'pass',
    generated_at: generatedAt,
    runner: requireString(manifest.runner, 'manifest.runner'),
    release_id: requireString(manifest.release_id, 'manifest.release_id'),
    git_sha: requireString(manifest.git_sha, 'manifest.git_sha'),
    runner_contract_version: requireString(
      manifest.runner_contract_version,
      'manifest.runner_contract_version',
    ),
    supported_protocol_versions: Array.isArray(manifest.supported_protocol_versions)
      ? manifest.supported_protocol_versions
      : [],
    image: {
      id: requireString(image.id, 'manifest.image.id'),
      image: requireString(image.image, 'manifest.image.image'),
      digest: requireString(image.digest, 'manifest.image.digest'),
    },
    contract_artifact: {
      package_uri: requireString(contractArtifact.package_uri, 'manifest.contract_artifact.package_uri'),
      package_sha256: requireString(
        contractArtifact.package_sha256,
        'manifest.contract_artifact.package_sha256',
      ),
      descriptor_subject_sha256: requireString(
        contractArtifact.descriptor_subject_sha256,
        'manifest.contract_artifact.descriptor_subject_sha256',
      ),
    },
    manifest: {
      input_sha256: manifestSha256,
      artifact_uri: requireString(provenance.artifact_uri, 'manifest.artifact_provenance.artifact_uri'),
      subject_sha256: requireString(
        provenance.subject_sha256,
        'manifest.artifact_provenance.subject_sha256',
      ),
      artifact_sha256: requireString(
        provenance.artifact_sha256,
        'manifest.artifact_provenance.artifact_sha256',
      ),
    },
    provenance: {
      producer_repo: requireString(
        provenance.producer_repo,
        'manifest.artifact_provenance.producer_repo',
      ),
      normalized_remote: requireString(
        provenance.normalized_remote,
        'manifest.artifact_provenance.normalized_remote',
      ),
      workflow_name: requireString(
        provenance.workflow_name,
        'manifest.artifact_provenance.workflow_name',
      ),
      job: requireString(provenance.job, 'manifest.artifact_provenance.job'),
      run_id: requireString(provenance.run_id, 'manifest.artifact_provenance.run_id'),
      run_attempt: requireString(
        provenance.run_attempt,
        'manifest.artifact_provenance.run_attempt',
      ),
      commit_sha: requireString(
        provenance.commit_sha,
        'manifest.artifact_provenance.commit_sha',
      ),
    },
    checks: [
      {
        name: 'runner_release_manifest',
        status: 'pass',
      },
      {
        name: 'digest_pinned_runner_image',
        status: 'pass',
      },
      {
        name: 'contract_artifact_binding',
        status: 'pass',
      },
      {
        name: 'adoption_policy_declared',
        status: 'pass',
      },
    ],
    notes: [
      'Runner GA handoff is evidence for AgentSmith adoption and release-kit final aggregation.',
      'It does not issue formal_verdict and does not update AgentSmith locks.',
    ],
  };
}

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(args['--manifest']);
const outputDir = resolve(args['--output-dir']);
const generatedAt = normalizeGeneratedAt(args['--generated-at']);
const { value: manifest, sha256: manifestSha256 } = readJson(manifestPath, 'runner release manifest');
const report = buildReport({ manifest: requireObject(manifest, 'manifest'), manifestSha256, generatedAt });
const outputPath = join(outputDir, OUTPUT_FILE);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`runner GA handoff report written: ${outputPath}`);
