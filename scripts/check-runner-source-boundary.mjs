#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/scripts\/?$/, '');
const errors = [];

const REQUIRED_PATHS = [
  'package.json',
  'tsconfig.json',
  'src/index.ts',
  'builtin-skills/README.md',
];
const REQUIRED_PACKAGE_FILES = [
  'dist',
  'builtin-skills/mbos-context',
  'builtin-skills/.mbos-runtime',
  'builtin-skills/README.md',
  'README.md',
  'DEVELOPMENT.md',
  'docs',
  'scripts',
];
const FORBIDDEN_DISTRIBUTION_PATH_PREFIXES = [
  'builtin-skills/.system',
  'package/builtin-skills/.system',
];
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const LOCAL_DEPENDENCY_PROTOCOL = /^(?:file|link|portal|workspace):/;
const mbosScope = '@m' + 'bos/';
const FORBIDDEN_DEPENDENCY_NAMES = new Set([
  `${mbosScope}agent-task-runner`,
  `${mbosScope}agent-runner`,
]);
const ALLOWED_MBOS_DEPENDENCY_NAMES = new Set([
  `${mbosScope}agent-runner-contract`,
]);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.artifacts',
]);
const DOCKER_CONTEXT_SCRIPTS = [
  'scripts/test-runner-image-smoke.sh',
  'scripts/test-runner-image-task-execution-smoke.sh',
];
const TEXT_FILE_PATTERN = /\.(?:cjs|cts|js|json|md|mjs|mts|py|sh|ts|txt|yaml|yml)$/;
const FORBIDDEN_SOURCE_PATTERNS = [
  {
    label: '../agentsmith sibling source path',
    pattern: /(^|[^A-Za-z0-9_-])\.\.\/agentsmith(?:\/|$)/,
  },
  {
    label: 'absolute AgentSmith sibling source path',
    pattern: /\/home\/[A-Za-z0-9._-]+\/works\/mbos-v1\/agentsmith(?:\/|$)/,
  },
  {
    label: 'old agent-task-runner source path',
    pattern: /packages\/agent-task-runner\/src\//,
  },
  {
    label: 'old agent-runner source path',
    pattern: /packages\/agent-runner\/src\//,
  },
  {
    label: 'old @mbos runner package import',
    pattern: new RegExp(`['"]${mbosScope}(?:agent-task-runner|agent-runner)['"]`),
  },
  {
    label: 'non-contract @mbos package import',
    pattern: new RegExp(`['"]${mbosScope}(?!agent-runner-contract(?:['"/]))[^'"]+['"]`),
  },
];
function literalPattern(input) {
  return new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

const FORBIDDEN_PROVIDER_BOUND_PATTERNS = [
  ['Fei', 'shu'],
  ['J', 'ira'],
  ['La', 'rk'],
  ['Atlas', 'sian'],
  ['fei', 'shu-managed-user'],
  ['jir', 'a-auth'],
  ['mcp.', 'fei', 'shu'],
  ['MBOS_AGENT_PROJECTED_DEPENDENCY_', 'J', 'IRA_AUTH'],
].map((parts) => {
  const term = parts.join('');
  return {
    label: `provider-bound term "${term}"`,
    pattern: literalPattern(term),
  };
});
const RUNNER_SMOKE_FIXTURE_SCAN_PATHS = new Set([
  'scripts/runner-task-execution-smoke.mjs',
]);
const FORBIDDEN_RUNNER_SMOKE_FIXTURE_PATTERNS = [
  {
    label: 'provider-bound smoke projection name "smoke-oauth"',
    pattern: /smoke-oauth/,
  },
  {
    label: 'provider-bound smoke projection field "access_token"',
    pattern: /\baccess_token\b/,
  },
  {
    label: 'provider-bound smoke sentinel "SMOKE_OAUTH_TOKEN_"',
    pattern: /SMOKE_OAUTH_TOKEN_/,
  },
  {
    label: 'provider-bound smoke prose "OAuth token"',
    pattern: /OAuth token/i,
  },
  {
    label: 'provider-bound ambient smoke env "GITHUB_TOKEN"',
    pattern: /\bGITHUB_TOKEN\b/,
  },
  {
    label: 'provider-bound ambient smoke sentinel "SMOKE_GITHUB_TOKEN_"',
    pattern: /SMOKE_GITHUB_TOKEN_/,
  },
];
const PRODUCT_SEMANTIC_SCAN_ROOTS = [
  'src',
  'builtin-skills',
];
const contextEndpoint = '/con' + 'text';
const managedCredentialKeyPrefix = 'managed_' + 'credentials.';
const managedCredentialEndpoint = `${contextEndpoint}/managed-credentials/`;
const FORBIDDEN_RUNNER_PRODUCT_SEMANTIC_PATTERNS = [
  {
    label: 'Context Store product scope schema',
    pattern: /project_member/,
  },
  {
    label: 'Context Store writable scope schema',
    pattern: /writable_scopes/,
  },
  {
    label: 'Context Store provider capability schema',
    pattern: /["']context_store["']/,
  },
  {
    label: 'managed credential refresh capability schema',
    pattern: /managed_credential_refresh/,
  },
  {
    label: 'managed credential dependency schema',
    pattern: /managed_credential/,
  },
  {
    label: 'Context Store scope parser',
    pattern: /SkillContextScope|readScopeArray|--scope/,
  },
  {
    label: 'Context Store query construction',
    pattern: /ContextStoreClient|build_query|scope=/,
  },
  {
    label: 'direct Context Store endpoint',
    pattern: new RegExp(`["']${contextEndpoint}(?:/list)?["']`),
  },
  {
    label: 'managed credential refresh endpoint',
    pattern: new RegExp(managedCredentialEndpoint),
  },
  {
    label: 'managed credential key semantics',
    pattern: new RegExp(managedCredentialKeyPrefix.replace('.', '[.]')),
  },
  {
    label: 'managed credential refresh helper',
    pattern: /refresh_managed_credential|refresh-managed-credential/,
  },
  {
    label: 'workspace access product endpoint',
    pattern: /workspace-access(?:\/release)?/,
  },
  {
    label: 'task HOME binding product payload schema',
    pattern: /\btask_home_binding\b/,
  },
  {
    label: 'AFSCP provider binding schema',
    pattern: /\bafscp\b/i,
  },
  {
    label: 'raw workspace storage payload field',
    pattern: /\b(?:metadata_url|storage_bucket_url|recommended_mount_path|recommended_mount_commands|filesystem_name|workspace_dir_name|mount_command|mount_commands)\b/,
  },
  {
    label: 'usage_tokens payload field',
    pattern: /(?:(?:\busage_tokens\b|["']usage_tokens["']|\[\s*["']usage_tokens["']\s*\])\s*:|\bpayload\s*(?:\.\s*usage_tokens|\[\s*["']usage_tokens["']\s*\])\s*=(?!=))/,
  },
  {
    label: 'Files/file-library reserved namespace policy',
    pattern: /\.(?:minio\.sys|trash)\b|file[- ]library reserved namespace/i,
  },
  {
    label: 'workspace access release fence payload field',
    pattern: /\b(?:holder_id|binding_generation|lease_epoch)\b/,
  },
];

function addError(message) {
  errors.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    addError(`${relative(repoRoot, path)} must be readable JSON: ${error.message}`);
    return null;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkRequiredPaths() {
  for (const requiredPath of REQUIRED_PATHS) {
    const absolutePath = join(repoRoot, requiredPath);
    try {
      statSync(absolutePath);
    } catch {
      addError(`missing required runner runtime path: ${requiredPath}`);
    }
  }
}

function checkPackageDependencies() {
  const packageJson = readJson(join(repoRoot, 'package.json'));
  if (!packageJson) {
    return;
  }

  const dependencies = isPlainObject(packageJson.dependencies)
    ? packageJson.dependencies
    : {};

  if (!Object.prototype.hasOwnProperty.call(dependencies, `${mbosScope}agent-runner-contract`)) {
    addError('package.json dependencies must include @mbos/agent-runner-contract');
  }

  for (const field of DEPENDENCY_FIELDS) {
    const dependencyObject = packageJson[field];
    if (dependencyObject === undefined) {
      continue;
    }
    if (!isPlainObject(dependencyObject)) {
      addError(`package.json ${field} must be an object when present`);
      continue;
    }

    for (const [name, specifier] of Object.entries(dependencyObject)) {
      if (FORBIDDEN_DEPENDENCY_NAMES.has(name)) {
        addError(`package.json ${field}.${name} must not depend on an old runner package`);
      }
      if (name.startsWith(mbosScope) && !ALLOWED_MBOS_DEPENDENCY_NAMES.has(name)) {
        addError(`package.json ${field}.${name} is not an allowed @mbos dependency`);
      }
      if (typeof specifier !== 'string' || specifier.trim() === '') {
        addError(`package.json ${field}.${name} must use a non-empty string specifier`);
        continue;
      }
      if (LOCAL_DEPENDENCY_PROTOCOL.test(specifier.trim())) {
        addError(`package.json ${field}.${name} must not use file:, link:, portal:, or workspace:`);
      }
    }
  }
}

function normalizePackageFileEntry(entry) {
  return entry.replace(/\/+$/, '');
}

function checkPackageFilesAllowlist() {
  const packageJson = readJson(join(repoRoot, 'package.json'));
  if (!packageJson) {
    return;
  }
  if (!Array.isArray(packageJson.files)) {
    addError('package.json files must be an explicit runner source distribution allowlist');
    return;
  }

  const actual = packageJson.files.map((entry) => {
    if (typeof entry !== 'string') {
      addError('package.json files entries must be strings');
      return '';
    }
    return normalizePackageFileEntry(entry);
  });
  const actualSet = new Set(actual.filter((entry) => entry.length > 0));
  const requiredSet = new Set(REQUIRED_PACKAGE_FILES);

  for (const requiredFile of REQUIRED_PACKAGE_FILES) {
    if (!actualSet.has(requiredFile)) {
      addError(`package.json files must include explicit distribution path: ${requiredFile}`);
    }
  }
  for (const entry of actualSet) {
    if (!requiredSet.has(entry)) {
      addError(`package.json files contains non-allowlisted distribution path: ${entry}`);
    }
    for (const forbiddenPrefix of FORBIDDEN_DISTRIBUTION_PATH_PREFIXES) {
      if (entry === forbiddenPrefix || entry.startsWith(`${forbiddenPrefix}/`)) {
        addError(`package.json files must not include forbidden distribution path: ${entry}`);
      }
    }
  }
}

function parseNpmPackDryRun() {
  const result = spawnSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_loglevel: 'silent',
      },
    },
  );
  if (result.error) {
    addError(`npm pack dry-run failed to start: ${result.error.message}`);
    return [];
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    addError(`npm pack dry-run failed with exit code ${result.status}${detail ? `: ${detail}` : ''}`);
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed) || parsed.length !== 1 || !Array.isArray(parsed[0]?.files)) {
      addError('npm pack dry-run output must contain exactly one package with a files array');
      return [];
    }
    return parsed[0].files
      .map((entry) => entry?.path)
      .filter((entry) => typeof entry === 'string');
  } catch (error) {
    addError(`npm pack dry-run output must be JSON: ${error.message}`);
    return [];
  }
}

function checkNpmPackDistributionBoundary() {
  const packedFiles = parseNpmPackDryRun();
  for (const packedFile of packedFiles) {
    for (const forbiddenPrefix of FORBIDDEN_DISTRIBUTION_PATH_PREFIXES) {
      if (packedFile === forbiddenPrefix || packedFile.startsWith(`${forbiddenPrefix}/`)) {
        addError(`npm pack dry-run must not include ${forbiddenPrefix}: ${packedFile}`);
      }
    }
  }
}

function readTextFile(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function dockerignoreIncludesSystemSkillExclusion(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .some((line) => line === 'builtin-skills/.system' || line === 'builtin-skills/.system/**');
}

function checkDockerContextBoundary() {
  const dockerignoreText = readTextFile('.dockerignore');
  if (!dockerignoreIncludesSystemSkillExclusion(dockerignoreText)) {
    addError('.dockerignore must explicitly exclude builtin-skills/.system from Docker build contexts');
  }

  for (const relativePath of DOCKER_CONTEXT_SCRIPTS) {
    const text = readTextFile(relativePath);
    if (text.includes('cp -R "$repo_root/builtin-skills" "$build_context/builtin-skills"')) {
      addError(`${relativePath} must not copy the entire builtin-skills tree into Docker build context`);
    }
    if (text.includes('tar -C "$repo_root"') && !text.includes("--exclude='./builtin-skills/.system'")) {
      addError(`${relativePath} Docker build context tar must exclude builtin-skills/.system`);
    }
  }
}

function listTextFiles(dir, output = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      listTextFiles(absolutePath, output);
      continue;
    }
    if (entry.isFile() && TEXT_FILE_PATTERN.test(entry.name)) {
      output.push(absolutePath);
    }
  }
  return output;
}

function checkSourcePatterns() {
  for (const file of listTextFiles(repoRoot)) {
    const relativePath = relative(repoRoot, file);
    const text = readFileSync(file, 'utf8');
    for (const { label, pattern } of FORBIDDEN_SOURCE_PATTERNS) {
      if (pattern.test(text)) {
        addError(`${relativePath} contains forbidden ${label}`);
      }
    }
  }
}

function checkProviderBoundPatterns() {
  for (const file of listTextFiles(repoRoot)) {
    const relativePath = relative(repoRoot, file);
    const text = readFileSync(file, 'utf8');
    for (const { label, pattern } of FORBIDDEN_PROVIDER_BOUND_PATTERNS) {
      if (pattern.test(relativePath) || pattern.test(text)) {
        addError(`${relativePath} contains forbidden ${label}`);
      }
    }
  }
}

function checkRunnerSmokeFixturePatterns() {
  for (const relativePath of RUNNER_SMOKE_FIXTURE_SCAN_PATHS) {
    const text = readFileSync(join(repoRoot, relativePath), 'utf8');
    for (const { label, pattern } of FORBIDDEN_RUNNER_SMOKE_FIXTURE_PATTERNS) {
      if (pattern.test(text)) {
        addError(`${relativePath} contains forbidden ${label}`);
      }
    }
  }
}

function checkProductSemanticPatterns() {
  for (const scanRoot of PRODUCT_SEMANTIC_SCAN_ROOTS) {
    const absoluteRoot = join(repoRoot, scanRoot);
    let stat;
    try {
      stat = statSync(absoluteRoot);
    } catch {
      continue;
    }
    const files = stat.isDirectory()
      ? listTextFiles(absoluteRoot)
      : [absoluteRoot];
    for (const file of files) {
      const relativePath = relative(repoRoot, file);
      const text = readFileSync(file, 'utf8');
      for (const { label, pattern } of FORBIDDEN_RUNNER_PRODUCT_SEMANTIC_PATTERNS) {
        if (pattern.test(text)) {
          addError(`${relativePath} defines forbidden ${label}`);
        }
      }
    }
  }
}

function collectProviderBoundPatternErrors(relativePath, text) {
  const violations = [];
  for (const { label, pattern } of FORBIDDEN_PROVIDER_BOUND_PATTERNS) {
    if (pattern.test(relativePath) || pattern.test(text)) {
      violations.push(`${relativePath} contains forbidden ${label}`);
    }
  }
  return violations;
}

function collectRunnerSmokeFixturePatternErrors(relativePath, text) {
  const violations = [];
  if (!RUNNER_SMOKE_FIXTURE_SCAN_PATHS.has(relativePath)) {
    return violations;
  }
  for (const { label, pattern } of FORBIDDEN_RUNNER_SMOKE_FIXTURE_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`${relativePath} contains forbidden ${label}`);
    }
  }
  return violations;
}

function collectProductSemanticPatternErrors(relativePath, text) {
  const violations = [];
  for (const { label, pattern } of FORBIDDEN_RUNNER_PRODUCT_SEMANTIC_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`${relativePath} defines forbidden ${label}`);
    }
  }
  return violations;
}

function runSelfTest() {
  const negativeCases = [
    {
      label: 'workspace access endpoint',
      text: 'await fetch(`/tasks/${taskId}/workspace-access/release`);',
      expected: 'workspace access product endpoint',
    },
    {
      label: 'task HOME binding payload',
      text: 'return { task_home_binding: binding };',
      expected: 'task HOME binding product payload schema',
    },
    {
      label: 'AFSCP provider binding',
      text: "const binding = { provider: 'afscp' };",
      expected: 'AFSCP provider binding schema',
    },
    {
      label: 'raw storage payload',
      text: "const payload = { metadata_url: 'postgres://example' };",
      expected: 'raw workspace storage payload field',
    },
    {
      label: 'usage token payload field',
      text: 'sendFrame("agent.response.done", id, { usage_tokens: Math.max(1, userPrompt.length) });',
      expected: 'usage_tokens payload field',
    },
    {
      label: 'indirect usage token payload field',
      text: 'sendFrame("agent.response.done", id, { usage_tokens: estimatedUsageTokens });',
      expected: 'usage_tokens payload field',
    },
    {
      label: 'computed usage token payload field',
      text: "const payload = { ['usage_tokens']: estimatedUsageTokens };",
      expected: 'usage_tokens payload field',
    },
    {
      label: 'quoted usage token payload field',
      text: 'const payload = { "usage_tokens": estimatedUsageTokens };',
      expected: 'usage_tokens payload field',
    },
    {
      label: 'direct usage token payload assignment',
      text: 'payload.usage_tokens = estimatedUsageTokens;',
      expected: 'usage_tokens payload field',
    },
    {
      label: 'indexed usage token payload assignment',
      text: "payload['usage_tokens'] = estimatedUsageTokens;",
      expected: 'usage_tokens payload field',
    },
    {
      label: 'storage backend reserved path constant',
      text: "const reservedNamespace = '.minio.sys';",
      expected: 'Files/file-library reserved namespace policy',
    },
    {
      label: 'file library trash reserved path constant',
      text: "const reservedNamespace = '.trash';",
      expected: 'Files/file-library reserved namespace policy',
    },
    {
      label: 'hyphenated file-library reserved namespace prose',
      text: 'Skip file-library reserved namespace roots before reporting workspace diffs.',
      expected: 'Files/file-library reserved namespace policy',
    },
    {
      label: 'spaced file library reserved namespace prose',
      text: 'Skip file library reserved namespace roots before reporting workspace diffs.',
      expected: 'Files/file-library reserved namespace policy',
    },
    {
      label: 'workspace access release fence payload',
      text: [
        'await releaseTaskWorkspaceAccess(context, {',
        "  holder_id: 'holder_1',",
        "  binding_generation: '1',",
        "  lease_epoch: 'lease_1',",
        '});',
      ].join('\n'),
      expected: 'workspace access release fence payload field',
    },
  ];
  const providerNegativeCases = [
    {
      label: 'removed docs provider',
      text: ['Fei', 'shu'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed issue provider',
      text: ['J', 'ira'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed docs alias',
      text: ['La', 'rk'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed platform vendor',
      text: ['Atlas', 'sian'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed managed projection name',
      text: ['fei', 'shu-managed-user'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed auth projection name',
      text: ['jir', 'a-auth'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed mcp endpoint family',
      text: ['mcp.', 'fei', 'shu'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed legacy env name',
      text: ['MBOS_AGENT_PROJECTED_DEPENDENCY_', 'J', 'IRA_AUTH'].join(''),
      expected: 'provider-bound term',
    },
    {
      label: 'removed skill directory path',
      relativePath: ['builtin-skills/', 'jir', 'a-ops', '/SKILL.md'].join(''),
      text: 'neutral skill guidance',
      expected: 'provider-bound term',
    },
  ];
  const smokeFixtureNegativeCases = [
    {
      label: 'provider-bound smoke projection name',
      text: "projected.dependencies['smoke-oauth']",
      expected: 'provider-bound smoke projection name',
    },
    {
      label: 'provider-bound smoke projection field',
      text: "fields: { access_token: sentinel }",
      expected: 'provider-bound smoke projection field',
    },
    {
      label: 'provider-bound smoke oauth sentinel',
      text: "const token = 'SMOKE_OAUTH_TOKEN_123';",
      expected: 'provider-bound smoke sentinel',
    },
    {
      label: 'provider-bound smoke oauth prose',
      text: "fail('projected OAuth token missing');",
      expected: 'provider-bound smoke prose',
    },
    {
      label: 'provider-bound ambient GitHub env',
      text: "requireMissing('GITHUB_TOKEN');",
      expected: 'provider-bound ambient smoke env',
    },
    {
      label: 'provider-bound ambient GitHub sentinel',
      text: "const githubToken = 'SMOKE_GITHUB_TOKEN_123';",
      expected: 'provider-bound ambient smoke sentinel',
    },
  ];
  const positiveCases = [
    {
      label: 'formal workspace path fields',
      text: [
        "const context = {",
        "  workspace_binding_mode: 'file_library',",
        "  workspace_file_library_id: 'flib_1',",
        "  task_home_path: '/home/task_1',",
        "  workspace_path: '/home/task_1/workspace',",
        "  artifacts_path: '/home/task_1/workspace/.artifacts',",
        "  library_root_path: '.',",
        '};',
      ].join('\n'),
    },
    {
      label: 'GitHub Actions infrastructure token',
      relativePath: '.github/workflows/runner-image-publish.yml',
      text: 'password: ${{ secrets.GITHUB_TOKEN }}',
    },
    {
      label: 'request env sanitizer known secret',
      relativePath: 'src/request-env.ts',
      text: "const keys = new Set(['GITHUB_TOKEN']);",
    },
  ];
  const selfTestErrors = [];
  for (const testCase of negativeCases) {
    const violations = collectProductSemanticPatternErrors(`self-test/${testCase.label}.ts`, testCase.text);
    if (!violations.some((violation) => violation.includes(testCase.expected))) {
      selfTestErrors.push(`self-test failed to reject ${testCase.label}`);
    }
  }
  for (const testCase of providerNegativeCases) {
    const relativePath = testCase.relativePath ?? `self-test/${testCase.label}.ts`;
    const violations = collectProviderBoundPatternErrors(relativePath, testCase.text);
    if (!violations.some((violation) => violation.includes(testCase.expected))) {
      selfTestErrors.push(`self-test failed to reject ${testCase.label}`);
    }
  }
  for (const testCase of smokeFixtureNegativeCases) {
    const violations = collectRunnerSmokeFixturePatternErrors(
      'scripts/runner-task-execution-smoke.mjs',
      testCase.text,
    );
    if (!violations.some((violation) => violation.includes(testCase.expected))) {
      selfTestErrors.push(`self-test failed to reject ${testCase.label}`);
    }
  }
  for (const testCase of positiveCases) {
    const relativePath = testCase.relativePath ?? `self-test/${testCase.label}.ts`;
    const violations = [
      ...collectProductSemanticPatternErrors(relativePath, testCase.text),
      ...collectProviderBoundPatternErrors(relativePath, testCase.text),
      ...collectRunnerSmokeFixturePatternErrors(relativePath, testCase.text),
    ];
    if (violations.length > 0) {
      selfTestErrors.push(`self-test false positive for ${testCase.label}: ${violations.join('; ')}`);
    }
  }
  if (selfTestErrors.length > 0) {
    for (const error of selfTestErrors) {
      console.error(`error: ${error}`);
    }
    process.exit(1);
  }
  console.log('runner source boundary self-test passed');
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
  process.exit(0);
}

checkRequiredPaths();
checkPackageDependencies();
checkPackageFilesAllowlist();
checkNpmPackDistributionBoundary();
checkDockerContextBoundary();
checkSourcePatterns();
checkProviderBoundPatterns();
checkRunnerSmokeFixturePatterns();
checkProductSemanticPatterns();

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log('runner source boundary check passed');
