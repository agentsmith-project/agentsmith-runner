#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/scripts\/?$/, '');
const errors = [];

const REQUIRED_PATHS = [
  'package.json',
  'tsconfig.json',
  'src/index.ts',
  'builtin-skills/README.md',
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

checkRequiredPaths();
checkPackageDependencies();
checkSourcePatterns();
checkProductSemanticPatterns();

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log('runner source boundary check passed');
