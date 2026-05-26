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
const LOCAL_DEPENDENCY_PROTOCOL = /^(?:file|link|workspace):/;
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
        addError(`package.json ${field}.${name} must not use file:, link:, or workspace:`);
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

checkRequiredPaths();
checkPackageDependencies();
checkSourcePatterns();

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log('runner source boundary check passed');
