#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/scripts\/?$/, '');
const errors = [];

function addError(message) {
  errors.push(message);
}

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

const verifyRelease = read('scripts/verify-release.sh');
const ciWorkflow = read('.github/workflows/ci.yml');
const agentSmithProducerRepo = 'agent' + 'smith-project/agent' + 'smith';
const docs = [
  ['README.md', read('README.md')],
  ['DEVELOPMENT.md', read('DEVELOPMENT.md')],
  ['docs/RELEASE_GATES.md', read('docs/RELEASE_GATES.md')],
  ['docs/READINESS_EVIDENCE.md', read('docs/READINESS_EVIDENCE.md')],
  ['docs/runbooks/README.md', read('docs/runbooks/README.md')],
];

const startGuardStart = verifyRelease.indexOf('if [[ "${1:-}" == "--start-guard" ]]; then');
const startGuardEnd = startGuardStart >= 0
  ? verifyRelease.indexOf('if [[ "${1:-}" == "--contract-consumer" ]]; then', startGuardStart)
  : -1;

if (startGuardStart < 0 || startGuardEnd < 0) {
  addError('verify-release.sh must define a --start-guard block');
} else if (/bash "\$repo_root\/scripts\/test-runner-runtime-fast[.]sh"/.test(verifyRelease.slice(startGuardStart, startGuardEnd))) {
  addError('--start-guard must not execute runtime fast checks before contract package publication/install is available in clean CI');
} else {
  const startGuardBlock = verifyRelease.slice(startGuardStart, startGuardEnd);
  if (/--image-smoke\b/.test(startGuardBlock)) {
    addError('--start-guard must not execute image smoke');
  }
  if (/bash "\$repo_root\/scripts\/test-runner-image-smoke[.]sh"/.test(startGuardBlock)) {
    addError('--start-guard must not execute image smoke script');
  }
  if (!/write-runner-release-manifest[.]mjs/.test(startGuardBlock)) {
    addError('--start-guard must check release manifest generator syntax');
  }
}

if (!/bash scripts\/verify-release[.]sh --start-guard/.test(ciWorkflow)) {
  addError('CI must keep running --start-guard');
}

if (/test-runner-runtime-fast[.]sh/.test(ciWorkflow)) {
  addError('CI must not run runtime fast without an explicit contract artifact acquisition step');
}

if (!/runner-image-smoke:/.test(ciWorkflow)) {
  addError('CI must define a focused runner-image-smoke job');
}

if (!new RegExp(`repository:\\s*${agentSmithProducerRepo.replace('/', '\\/')}`).test(ciWorkflow)) {
  addError('CI image smoke job must explicitly checkout AgentSmith as the contract artifact producer');
}

if (!/npm ci/.test(ciWorkflow)) {
  addError('CI image smoke job must install AgentSmith producer dependencies with npm ci');
}

if (!/npm run build -w @mbos\/agent-runner-contract/.test(ciWorkflow)) {
  addError('CI image smoke job must build @mbos/agent-runner-contract before artifact generation');
}

if (!/npx tsx scripts\/governance\/runner-contract-artifact[.]ts/.test(ciWorkflow)) {
  addError('CI image smoke job must generate an explicit runner contract artifact root');
}

if (!/bash scripts\/verify-release[.]sh --image-smoke --artifact-root/.test(ciWorkflow)) {
  addError('CI image smoke job must run verify-release.sh --image-smoke with the generated artifact root');
}

if (/docker (?:push|login)\b|ghcr[.]io/i.test(ciWorkflow)) {
  addError('CI image smoke job must not publish, login to a registry, or target GHCR');
}

for (const [path, text] of docs) {
  if (
    /Start guard runs[^\n]*runtime fast/i.test(text)
    || /Start guard[^\n]*test-runner-runtime-fast[.]sh/i.test(text)
  ) {
    addError(`${path} must not describe start guard as running runtime fast`);
  }
  if (!/runtime fast gate is not release readiness|Runtime fast gate is not release readiness/i.test(text)) {
    addError(`${path} must state that runtime fast gate is not release readiness`);
  }
  if (!/image smoke is not release readiness|Image smoke is not release readiness/i.test(text)) {
    addError(`${path} must state that image smoke is not release readiness`);
  }
  if (/image smoke is release readiness|image smoke proves release readiness|image smoke replaces release readiness/i.test(text)) {
    addError(`${path} must not describe image smoke as release readiness`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log('start guard clean dependency shape check passed');
