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
const manualImageSmokeWorkflow = read('.github/workflows/runner-image-smoke.yml');
const dockerfile = read('Dockerfile');
const imageSmoke = read('scripts/test-runner-image-smoke.sh');
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

if (/runner-image-smoke:/.test(ciWorkflow)) {
  addError('default CI must not define a runner-image-smoke job');
}

if (new RegExp(`repository:\\s*${agentSmithProducerRepo.replace('/', '\\/')}`).test(ciWorkflow)) {
  addError('default CI must not checkout AgentSmith');
}

if (/npm run build -w @mbos\/agent-runner-contract/.test(ciWorkflow)) {
  addError('default CI must not build @mbos/agent-runner-contract from AgentSmith source');
}

if (/runner-contract-artifact[.]ts/.test(ciWorkflow)) {
  addError('default CI must not generate a runner contract artifact root from AgentSmith source');
}

if (/bash scripts\/verify-release[.]sh --image-smoke --artifact-root/.test(ciWorkflow)) {
  addError('default CI must not run image smoke');
}

if (!/workflow_dispatch:/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must use workflow_dispatch');
}

if (/^\s*(push|pull_request|schedule):/m.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must not have automatic triggers');
}

if (!/agentsmith_contract_run_id/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must require agentsmith_contract_run_id');
}

if (!/actions\/download-artifact@v8[.]0[.]1/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must use pinned actions/download-artifact@v8.0.1');
}

if (!/name:\s*agentsmith-runner-contract-artifact/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must download agentsmith-runner-contract-artifact');
}

if (!new RegExp(`repository:\\s*${agentSmithProducerRepo.replace('/', '\\/')}`).test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must download the artifact from AgentSmith');
}

if (!/run-id:.*agentsmith_contract_run_id/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must use the supplied AgentSmith run id');
}

if (!/path:\s*artifacts\/runner-contract/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must download to artifacts/runner-contract');
}

if (!/verify-release[.]sh --contract-consumer --artifact-root artifacts\/runner-contract/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must verify the downloaded contract artifact root');
}

if (!/verify-release[.]sh --image-smoke --artifact-root artifacts\/runner-contract/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must run image smoke against the downloaded artifact root');
}

if (/npm run build -w @mbos\/agent-runner-contract|runner-contract-artifact[.]ts/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must not build or generate the contract artifact from source');
}

if (/docker\/login-action|\s--push|ghcr[.]io\/agentsmith-project\/agentsmith-runner|write-runner-release-manifest|upload-artifact/.test(manualImageSmokeWorkflow)) {
  addError('manual image smoke workflow must not publish images or generate release manifests');
}

if (!/ENTRYPOINT\s+\["node",\s*"\/app\/dist\/index[.]js"\]/.test(dockerfile)) {
  addError('Dockerfile runner entrypoint must use absolute /app/dist/index.js');
}

if (!/run_missing_env_usage_check .*--workdir\s+\/tmp/.test(imageSmoke)) {
  addError('image smoke must verify missing-env Usage from a non-/app workdir');
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
