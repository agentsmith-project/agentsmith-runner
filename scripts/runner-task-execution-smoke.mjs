#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TASK_HOME = '/home/task_1';
const WORKSPACE_PATH = `${TASK_HOME}/workspace`;
const ARTIFACTS_PATH = `${WORKSPACE_PATH}/.artifacts`;
const REQUEST_ID = 'req_image_task_execution_smoke';
const FINAL_ANSWER = 'Image task execution smoke complete.';
const ARTIFACT_FILENAME = 'task-execution-smoke.txt';
const forbiddenDoneUsageField = ['usage', 'tokens'].join('_');
const MAX_SENTINEL_SCAN_FILE_BYTES = 10 * 1024 * 1024;
const DENIED_CREDENTIAL_PATHS = Object.freeze([
  '.aws/credentials',
  '.config/gcloud/application_default_credentials.json',
]);
const DENIED_CREDENTIAL_BASENAMES = Object.freeze([
  '.netrc',
  'credentials.json',
]);

function usage() {
  console.error('Usage: node scripts/runner-task-execution-smoke.mjs --image <image-tag> --artifact-root <dir>');
  console.error('Self-test: node scripts/runner-task-execution-smoke.mjs --self-test');
  console.error('Requires Linux/local Docker networking because the harness uses docker run --network host.');
}

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function parseArgs(argv) {
  if (argv.length !== 4) {
    usage();
    fail('expected exactly --image <image-tag> --artifact-root <dir>', 2);
  }
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    args.set(argv[index], argv[index + 1]);
  }
  const image = args.get('--image');
  const artifactRoot = args.get('--artifact-root');
  if (typeof image !== 'string' || image.trim() === '') {
    usage();
    fail('image tag must be non-empty', 2);
  }
  if (typeof artifactRoot !== 'string' || artifactRoot.trim() === '') {
    usage();
    fail('artifact-root must be non-empty', 2);
  }
  return {
    image: image.trim(),
    artifactRoot: resolve(artifactRoot),
  };
}

function docker(args, options = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    ...options,
  });
}

function requireDockerSuccess(result, label) {
  if (result.status === 0) return;
  const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  fail(`${label} failed with exit code ${String(result.status)}${details ? `\n${details}` : ''}`);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function assertNoRequestScopedSentinelsInArgv(argv, sentinels) {
  const values = Object.values(sentinels)
    .filter((value) => typeof value === 'string' && value.length > 0);
  for (let index = 0; index < argv.length; index += 1) {
    const text = String(argv[index] ?? '');
    for (const value of values) {
      if (text.includes(value)) {
        fail(`Codex argv contains request-scoped sentinel at argv[${String(index)}]`);
      }
    }
  }
}

async function writeFakeCodex(fakeDir) {
  await mkdir(fakeDir, { recursive: true });
  const fakeCodexPath = join(fakeDir, 'codex');
  await writeFile(fakeCodexPath, `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TASK_HOME = '/home/task_1';
const WORKSPACE_PATH = TASK_HOME + '/workspace';
const ARTIFACTS_PATH = WORKSPACE_PATH + '/.artifacts';
const FINAL_ANSWER = 'Image task execution smoke complete.';

function fail(message) {
  process.stderr.write('[fake-codex] ' + message + '\\n');
  process.exit(41);
}

function requireEqual(name, actual, expected) {
  if (actual !== expected) {
    fail(name + ' expected ' + expected + ' got ' + String(actual));
  }
}

function requireMissing(name) {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) {
    fail(name + ' must not be inherited by fake Codex');
  }
}

function assertNoRequestScopedSentinelsInArgv(argv, sentinels) {
  const values = Object.values(sentinels)
    .filter((value) => typeof value === 'string' && value.length > 0);
  for (let index = 0; index < argv.length; index += 1) {
    const text = String(argv[index] || '');
    for (const value of values) {
      if (text.includes(value)) {
        fail('Codex argv contains request-scoped sentinel at argv[' + String(index) + ']');
      }
    }
  }
}

requireEqual('cwd', process.cwd(), WORKSPACE_PATH);
requireEqual('HOME', process.env.HOME, TASK_HOME);
requireEqual('TASK_HOME', process.env.TASK_HOME, TASK_HOME);
requireEqual('WORKSPACE_PATH', process.env.WORKSPACE_PATH, WORKSPACE_PATH);
requireEqual('ARTIFACTS_PATH', process.env.ARTIFACTS_PATH, ARTIFACTS_PATH);
requireMissing('MBOS_AGENT_KEY');
requireMissing('MBOS_AGENT_WS_URL');
requireMissing('MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET');
requireMissing('MBOS_AGENT_TASK_RUNNER_MODE');
requireMissing('MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP');
requireMissing('MBOS_AGENT_ARTIFACT_SCAN_MAX_FILES');
requireMissing('MBOS_AGENT_ARTIFACT_SCAN_MAX_FILE_BYTES');
requireMissing('MBOS_AGENT_ARTIFACT_INLINE_IMAGE_MAX_BYTES');
requireMissing('MBOS_AGENT_ARTIFACT_TEXT_PREVIEW_MAX_BYTES');
requireMissing('MBOS_AGENT_WORKSPACE_FILE_SCAN_MAX_FILES');
requireMissing('MBOS_AGENT_WORKSPACE_FILE_CHANGE_LIST_MAX');
requireMissing('MBOS_AGENT_TASK_ASSET_IO_TIMEOUT_MS');
requireMissing('MBOS_AGENT_BUILTIN_SKILLS_DIR');
requireMissing('MBOS_AGENT_BUILTIN_SKILLS_REQUIRED');
requireMissing('MBOS_AGENT_BUILTIN_SKILLS');
requireMissing('MBOS_AGENT_CODEX_YOLO');
requireMissing('MBOS_AGENT_CANCEL_KILL_DELAY_MS');
requireMissing('MBOS_AGENT_RUNNER_DEBUG');
requireMissing('MBOS_AGENT_RUNNER_INSTANCE_ID');
requireMissing('MBOS_AGENT_RUNNER_SESSION_ID');
requireMissing('MBOS_AGENT_RECONNECT_BASE_MS');
requireMissing('MBOS_AGENT_RECONNECT_MAX_MS');
requireMissing('NOTEBOOK_TERMINAL_CLOSE_GRACE_MS');
requireMissing('CODEX_BIN');
requireMissing('OPENAI_API_KEY');
requireMissing('GITHUB_TOKEN');
requireMissing('HTTP_PROXY');

for (const [name, value] of Object.entries(process.env)) {
  const text = String(value || '');
  if (
    text.includes('SMOKE_RUNNER_KEY_')
    || text.includes('SMOKE_STALE_EXECUTION_TICKET_')
    || text.includes('SMOKE_STALE_PROXY_TICKET_')
    || text.includes('SMOKE_STALE_PROJECTED_SECRET_')
    || text.includes('SMOKE_OPENAI_API_KEY_')
    || text.includes('SMOKE_GITHUB_TOKEN_')
    || text.includes('SMOKE_HTTP_PROXY_PASSWORD_')
  ) {
    fail(name + ' contains a runner-control, stale request, or ambient secret sentinel');
  }
}

const ticket = process.env.MBOS_AGENT_EXECUTION_TICKET || '';
if (!ticket.startsWith('SMOKE_EXECUTION_TICKET_')) {
  fail('MBOS_AGENT_EXECUTION_TICKET missing smoke ticket');
}
requireEqual('MBOS_CODEX_PROXY_EXECUTION_TICKET', process.env.MBOS_CODEX_PROXY_EXECUTION_TICKET, ticket);

let projected;
try {
  projected = JSON.parse(process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES || '');
} catch {
  fail('MBOS_AGENT_PROJECTED_DEPENDENCIES must be JSON');
}
const dependencySecret = projected?.dependencies?.['smoke-secret']?.fields?.value;
const oauthToken = projected?.dependencies?.['smoke-oauth']?.fields?.access_token;
if (typeof dependencySecret !== 'string' || !dependencySecret.startsWith('SMOKE_DEPENDENCY_SECRET_')) {
  fail('projected dependency secret missing');
}
if (typeof oauthToken !== 'string' || !oauthToken.startsWith('SMOKE_OAUTH_TOKEN_')) {
  fail('projected OAuth token missing');
}
assertNoRequestScopedSentinelsInArgv(process.argv, {
  ticket,
  dependencySecret,
  oauthToken,
  runnerKeyPrefix: 'SMOKE_RUNNER_KEY_',
  staleExecutionTicketPrefix: 'SMOKE_STALE_EXECUTION_TICKET_',
  staleProxyTicketPrefix: 'SMOKE_STALE_PROXY_TICKET_',
  staleProjectionSecretPrefix: 'SMOKE_STALE_PROJECTED_SECRET_',
  openAiApiKeyPrefix: 'SMOKE_OPENAI_API_KEY_',
  githubTokenPrefix: 'SMOKE_GITHUB_TOKEN_',
  httpProxyPasswordPrefix: 'SMOKE_HTTP_PROXY_PASSWORD_',
});

const contextCli = join(TASK_HOME, '.agents', 'skills', 'mbos-context', 'scripts', 'context_cli.py');
const contextCliResult = spawnSync('python3', [
  contextCli,
  'get',
  '--dependency',
  'smoke-secret',
  '--field',
  'value',
], { encoding: 'utf8' });
if (contextCliResult.status !== 0) {
  fail('mbos-context projected dependency lookup failed: ' + String(contextCliResult.stderr || '').trim());
}
requireEqual('mbos-context projected dependency secret', contextCliResult.stdout.trim(), dependencySecret);

await mkdir(ARTIFACTS_PATH, { recursive: true });
await writeFile(
  join(ARTIFACTS_PATH, 'task-execution-smoke.txt'),
  'runner image task execution smoke artifact\\n',
  'utf8',
);
console.log(JSON.stringify({
  type: 'event_msg',
  payload: {
    type: 'agent_message',
    phase: 'final_answer',
    message: FINAL_ANSWER,
  },
}));
console.log(JSON.stringify({
  type: 'event_msg',
  payload: {
    type: 'task_complete',
    last_agent_message: FINAL_ANSWER,
  },
}));
`, 'utf8');
  await chmod(fakeCodexPath, 0o755);
  return fakeCodexPath;
}

async function extractContractPackage(artifactRoot, contractDir) {
  const descriptorPath = join(artifactRoot, 'runner-contract-artifact.json');
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  const filename = descriptor?.artifact?.filename;
  if (typeof filename !== 'string' || filename.length === 0 || filename !== basename(filename)) {
    fail('runner-contract-artifact.json artifact.filename must be a tgz basename');
  }
  const tgzPath = join(artifactRoot, filename);
  await mkdir(contractDir, { recursive: true });
  requireDockerSuccess(
    spawnSync('tar', ['-xzf', tgzPath, '-C', contractDir], { encoding: 'utf8' }),
    'extract runner contract artifact',
  );
  return join(contractDir, 'package', 'dist', 'index.js');
}

async function buildExecutionContextFromContract(artifactRoot, contractDir, sentinels) {
  const contractEntry = await extractContractPackage(artifactRoot, contractDir);
  const contractModule = await import(pathToFileURL(contractEntry).href);
  if (typeof contractModule.getTaskExecutionContextFixture !== 'function') {
    fail('runner contract package must export getTaskExecutionContextFixture');
  }
  if (typeof contractModule.assertTaskExecutionContext !== 'function') {
    fail('runner contract package must export assertTaskExecutionContext');
  }
  const base = contractModule.getTaskExecutionContextFixture('managedTaskRun');
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    fail('managedTaskRun fixture must be an object');
  }
  const executionContext = {
    ...base,
    api_base: 'http://127.0.0.1:20000/api/v1',
    workspace_id: 'ws_image_smoke',
    project_id: 'proj_image_smoke',
    task_id: 'task_1',
    run_id: 'run_image_task_execution_smoke',
    runner_id: 'runner_image_task_execution_smoke',
    execution_ticket: sentinels.ticket,
    endpoint_id: 'ep_image_smoke',
    resource_proxy: {
      base_url: 'http://127.0.0.1:9/fake-openai',
    },
    username: 'image-smoke@example.test',
    workspace_file_library_id: 'flib_image_smoke',
    workspace_binding_mode: 'file_library',
    runtime_profile: 'managed',
    task_home_segment: 'task_1',
    task_home_path: TASK_HOME,
    workspace_path: WORKSPACE_PATH,
    artifacts_path: ARTIFACTS_PATH,
    library_root_path: '.',
    task_inputs: [],
    projected_dependencies: {
      dependencies: {
        'smoke-secret': {
          fields: {
            value: sentinels.dependencySecret,
          },
        },
        'smoke-oauth': {
          fields: {
            access_token: sentinels.oauthToken,
          },
        },
      },
    },
  };
  try {
    contractModule.assertTaskExecutionContext(executionContext);
  } catch (error) {
    fail(
      'managedTaskRun fixture plus image task-execution smoke projected_dependencies is invalid '
        + `for the supplied contract artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return executionContext;
}

function sendJson(socket, frame) {
  socket.send(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...frame,
  }));
}

function createDonePromise(state) {
  return new Promise((resolve, reject) => {
    state.resolveDone = resolve;
    state.rejectDone = reject;
  });
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}_timeout_after_${String(timeoutMs)}ms`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function watchContainerExit(containerName) {
  let timer;
  let stopped = false;
  let rejectWatch;

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
  }

  function rejectOnce(error) {
    if (stopped) return;
    stop();
    rejectWatch(error);
  }

  function inspectContainer() {
    if (stopped) return;
    const result = docker([
      'inspect',
      '--format',
      '{{.State.Running}} {{.State.ExitCode}}',
      containerName,
    ]);
    if (stopped) return;
    if (result.status !== 0) {
      const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      rejectOnce(new Error(`docker inspect runner container failed${details ? `\n${details}` : ''}`));
      return;
    }

    const [running, exitCode = 'unknown'] = result.stdout.trim().split(/\s+/);
    if (running === 'false') {
      rejectOnce(new Error(`runner container exited before agent.response.done with exit code ${exitCode}`));
      return;
    }
    timer = setTimeout(inspectContainer, 500);
  }

  const promise = new Promise((_resolve, reject) => {
    rejectWatch = reject;
    timer = setTimeout(inspectContainer, 0);
  });

  return { promise, stop };
}

function framePayload(frame) {
  return typeof frame.payload === 'object' && frame.payload !== null ? frame.payload : {};
}

async function startHarnessServer(args) {
  const { WebSocketServer } = await import('ws');
  const state = {
    frames: [],
    readySeen: false,
    startSent: false,
    deltaSeen: false,
    artifactSeen: false,
    doneSeen: false,
    resolveDone: null,
    rejectDone: null,
  };
  const donePromise = createDonePromise(state);
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });

  wss.on('connection', (socket, request) => {
    const authorization = request.headers.authorization ?? '';
    if (authorization !== `Bearer ${args.runnerKey}`) {
      state.rejectDone?.(new Error('runner websocket Authorization header mismatch'));
      socket.close();
      return;
    }

    sendJson(socket, {
      type: 'server.hello',
      payload: {
        protocol_version: '1.0',
        heartbeat_interval_sec: 30,
      },
    });

    socket.on('message', (data) => {
      let frame;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        state.rejectDone?.(new Error('runner sent non-JSON websocket frame'));
        return;
      }
      state.frames.push(frame);

      if (frame.type === 'agent.ready') {
        state.readySeen = true;
        if (!state.startSent) {
          state.startSent = true;
          sendJson(socket, {
            type: 'server.request.start',
            request_id: REQUEST_ID,
            payload: {
              model: 'gpt-5-codex',
              messages: [
                {
                  role: 'user',
                  content: 'Run the image task-execution smoke and write one artifact.',
                },
              ],
              execution_context: args.executionContext,
            },
          });
        }
        return;
      }

      if (frame.request_id !== REQUEST_ID) {
        return;
      }

      if (frame.type === 'agent.response.delta') {
        const payload = framePayload(frame);
        if (typeof payload.delta === 'string' && payload.delta.includes(FINAL_ANSWER)) {
          state.deltaSeen = true;
        }
      }

      if (frame.type === 'agent.response.artifact') {
        const payload = framePayload(frame);
        if (payload.filename === ARTIFACT_FILENAME) {
          state.artifactSeen = true;
        }
      }

      if (frame.type === 'agent.response.error') {
        const payload = framePayload(frame);
        state.rejectDone?.(new Error(`runner emitted agent.response.error: ${JSON.stringify(payload)}`));
        return;
      }

      if (frame.type === 'agent.response.done') {
        state.doneSeen = true;
        const payload = framePayload(frame);
        if (Object.prototype.hasOwnProperty.call(payload, forbiddenDoneUsageField)) {
          state.rejectDone?.(new Error(`agent.response.done must not contain ${forbiddenDoneUsageField}`));
          return;
        }
        state.resolveDone?.();
      }
    });
  });

  return { wss, state, donePromise };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (typeof address !== 'object' || address === null || typeof address.port !== 'number') {
    fail('failed to resolve harness websocket port');
  }
  return address.port;
}

async function assertNoSentinelsPersisted(root, sentinels) {
  const values = Object.values(sentinels).filter((value) => typeof value === 'string' && value.length > 0);
  const findings = [];

  function displayPath(path) {
    const relativePath = relative(root, path);
    return relativePath.length > 0 ? relativePath : '.';
  }

  function deniedCredentialPathLabel(path) {
    const normalizedPath = path.split('\\').join('/');
    for (const basename of DENIED_CREDENTIAL_BASENAMES) {
      if (normalizedPath === basename || normalizedPath.endsWith(`/${basename}`)) {
        return basename;
      }
    }
    for (const deniedPath of DENIED_CREDENTIAL_PATHS) {
      if (normalizedPath === deniedPath || normalizedPath.endsWith(`/${deniedPath}`)) {
        return deniedPath;
      }
    }
    return null;
  }

  function recordCredentialPathHit(path) {
    const shown = displayPath(path);
    const deniedLabel = deniedCredentialPathLabel(shown);
    if (deniedLabel) {
      findings.push(`credential path denied (${deniedLabel}): ${shown}`);
    }
  }

  function recordPathHit(path) {
    const shown = displayPath(path);
    for (const value of values) {
      if (shown.includes(value)) {
        findings.push(`sentinel in path: ${shown}`);
        return;
      }
    }
  }

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      findings.push(`unreadable directory: ${displayPath(dir)} (${errorMessage(error)})`);
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      recordCredentialPathHit(path);
      recordPathHit(path);

      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (entry.isSymbolicLink()) {
        let target;
        try {
          target = await readlink(path);
        } catch (error) {
          findings.push(`unreadable symlink: ${displayPath(path)} (${errorMessage(error)})`);
          continue;
        }
        for (const value of values) {
          if (target.includes(value)) {
            findings.push(`sentinel in symlink target: ${displayPath(path)}`);
            break;
          }
        }
        continue;
      }
      if (!entry.isFile()) continue;
      let fileStat;
      try {
        fileStat = await stat(path);
      } catch (error) {
        findings.push(`unreadable file metadata: ${displayPath(path)} (${errorMessage(error)})`);
        continue;
      }
      if (fileStat.size > MAX_SENTINEL_SCAN_FILE_BYTES) {
        findings.push(`oversize file blocks sentinel scan: ${displayPath(path)} (${String(fileStat.size)} bytes)`);
        continue;
      }
      let text;
      try {
        text = await readFile(path, 'utf8');
      } catch (error) {
        findings.push(`unreadable file: ${displayPath(path)} (${errorMessage(error)})`);
        continue;
      }
      for (const value of values) {
        if (text.includes(value)) {
          findings.push(`sentinel in file contents: ${displayPath(path)}`);
          break;
        }
      }
    }
  }
  await walk(root);
  if (findings.length > 0) {
    fail(`request-scoped sentinel scan failed under task HOME:\n${findings.join('\n')}`);
  }
}

function assertRequiredFrames(state) {
  if (!state.readySeen) fail('expected agent.ready');
  if (!state.deltaSeen) fail('expected agent.response.delta containing final answer');
  if (!state.artifactSeen) fail(`expected agent.response.artifact for ${ARTIFACT_FILENAME}`);
  if (!state.doneSeen) fail('expected agent.response.done');
}

function printDockerLogs(containerName) {
  const logs = docker(['logs', containerName]);
  const output = [logs.stdout, logs.stderr].filter(Boolean).join('\n').trim();
  if (output) {
    console.error(output);
  }
}

function restoreTaskHomeOwnership(image, taskHomeHost, options = {}) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const gid = typeof process.getgid === 'function' ? process.getgid() : null;
  if (uid === null || gid === null) {
    if (options.required) fail('restore task HOME ownership requires POSIX uid/gid');
    return;
  }
  const restoreCommand = [
    `chown -R ${String(uid)}:${String(gid)} ${TASK_HOME}`,
    options.ensureWritable ? `chmod -R u+rwX ${TASK_HOME}` : '',
  ].filter(Boolean).join(' && ');
  const result = docker([
    'run',
    '--rm',
    '--network',
    'none',
    '-v',
    `${taskHomeHost}:${TASK_HOME}`,
    '--entrypoint',
    '/bin/sh',
    image,
    '-c',
    restoreCommand,
  ], { stdio: options.required ? 'pipe' : 'ignore' });
  if (options.required) {
    requireDockerSuccess(result, 'restore task HOME ownership before sentinel scan');
  }
}

async function closeServer(wss) {
  await new Promise((resolve) => {
    wss.close(() => resolve());
  });
}

async function expectSentinelScanFailure(root, expectedText, label) {
  try {
    await assertNoSentinelsPersisted(root, {});
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes(expectedText)) {
      return;
    }
    fail(`${label} failed with unexpected scan error: ${message}`);
  }
  fail(`${label} did not fail`);
}

function expectArgvSentinelFailure() {
  try {
    assertNoRequestScopedSentinelsInArgv(
      ['codex', 'exec', '-c', 'ticket=SMOKE_SELF_TEST_ARGV_SENTINEL'],
      { ticket: 'SMOKE_SELF_TEST_ARGV_SENTINEL' },
    );
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes('Codex argv contains request-scoped sentinel')) {
      return;
    }
    fail(`argv sentinel detector self-test failed with unexpected error: ${message}`);
  }
  fail('argv sentinel detector self-test did not fail');
}

function expectArgvSentinelPass() {
  assertNoRequestScopedSentinelsInArgv(
    ['codex', 'exec', '--model', 'gpt-5-codex', '-c', 'model_provider="proxy"'],
    { ticket: 'SMOKE_SELF_TEST_ARGV_SENTINEL' },
  );
}

async function runSelfTest() {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'agentsmith-runner-smoke-selfcheck-'));
  try {
    const safeRoot = join(tmpRoot, 'safe');
    await mkdir(join(safeRoot, 'notes'), { recursive: true });
    await writeFile(join(safeRoot, 'notes', 'credential-filename-note.txt'), 'safe note\n', 'utf8');
    await assertNoSentinelsPersisted(safeRoot, {});
    expectArgvSentinelPass();
    expectArgvSentinelFailure();

    const deniedPaths = [
      '.netrc',
      '.aws/credentials',
      '.config/gcloud/application_default_credentials.json',
      'credentials.json',
      'nested/credentials.json',
    ];
    for (let index = 0; index < deniedPaths.length; index += 1) {
      const caseRoot = join(tmpRoot, `denied-${String(index)}`);
      const deniedPath = join(caseRoot, deniedPaths[index]);
      await mkdir(resolve(deniedPath, '..'), { recursive: true });
      await writeFile(deniedPath, '{}\n', 'utf8');
      await expectSentinelScanFailure(caseRoot, 'credential path denied', `credential path denylist ${deniedPaths[index]}`);
    }

    const sentinelRoot = join(tmpRoot, 'sentinel');
    await mkdir(sentinelRoot, { recursive: true });
    await writeFile(join(sentinelRoot, 'note.txt'), 'SMOKE_SELF_TEST_SENTINEL\n', 'utf8');
    try {
      await assertNoSentinelsPersisted(sentinelRoot, { sentinel: 'SMOKE_SELF_TEST_SENTINEL' });
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes('sentinel in file contents')) {
        console.log('runner task-execution smoke self-test passed');
        return;
      }
      fail(`sentinel scan self-test failed with unexpected scan error: ${message}`);
    }
    fail('sentinel scan self-test did not fail');
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--self-test') {
    await runSelfTest();
    return;
  }

  const { image, artifactRoot } = parseArgs(process.argv.slice(2));
  const tmpRoot = await mkdtemp(join(tmpdir(), 'agentsmith-runner-task-exec-smoke-'));
  const fakeDir = join(tmpRoot, 'fake-codex');
  const taskHomeHost = join(tmpRoot, 'task_1');
  const contractDir = join(tmpRoot, 'contract');
  const containerName = `agentsmith-runner-task-exec-smoke-${process.pid}-${randomUUID().slice(0, 8)}`;
  const runnerKey = `SMOKE_RUNNER_KEY_${randomUUID()}`;
  const sentinels = {
    runnerKey,
    ticket: `SMOKE_EXECUTION_TICKET_${randomUUID()}`,
    dependencySecret: `SMOKE_DEPENDENCY_SECRET_${randomUUID()}`,
    oauthToken: `SMOKE_OAUTH_TOKEN_${randomUUID()}`,
    staleExecutionTicket: `SMOKE_STALE_EXECUTION_TICKET_${randomUUID()}`,
    staleProxyTicket: `SMOKE_STALE_PROXY_TICKET_${randomUUID()}`,
    staleProjectionSecret: `SMOKE_STALE_PROJECTED_SECRET_${randomUUID()}`,
    openAiApiKey: `SMOKE_OPENAI_API_KEY_${randomUUID()}`,
    githubToken: `SMOKE_GITHUB_TOKEN_${randomUUID()}`,
    httpProxyPassword: `SMOKE_HTTP_PROXY_PASSWORD_${randomUUID()}`,
  };
  let containerStarted = false;
  let server;

  try {
    await writeFakeCodex(fakeDir);
    await mkdir(taskHomeHost, { recursive: true });
    const executionContext = await buildExecutionContextFromContract(artifactRoot, contractDir, sentinels);
    const harness = await startHarnessServer({
      runnerKey,
      executionContext,
    });
    server = harness.wss;
    const port = await listen(server);

    const runResult = docker([
      'run',
      '-d',
      '--name',
      containerName,
      '--network',
      'host',
      '-e',
      `MBOS_AGENT_WS_URL=ws://127.0.0.1:${String(port)}`,
      '-e',
      `MBOS_AGENT_KEY=${runnerKey}`,
      '-e',
      `MBOS_AGENT_EXECUTION_TICKET=${sentinels.staleExecutionTicket}`,
      '-e',
      `MBOS_CODEX_PROXY_EXECUTION_TICKET=${sentinels.staleProxyTicket}`,
      '-e',
      `MBOS_AGENT_PROJECTED_DEPENDENCIES={"dependencies":{"smoke-secret":{"fields":{"value":"${sentinels.staleProjectionSecret}"}}}}`,
      '-e',
      `MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET={"fields":{"value":"${sentinels.staleProjectionSecret}"}}`,
      '-e',
      'MBOS_AGENT_BUILTIN_SKILLS_DIR=/etc/codex/skills',
      '-e',
      'MBOS_AGENT_BUILTIN_SKILLS_REQUIRED=1',
      '-e',
      'MBOS_AGENT_BUILTIN_SKILLS=mbos-context',
      '-e',
      'MBOS_AGENT_CODEX_YOLO=0',
      '-e',
      'MBOS_AGENT_CANCEL_KILL_DELAY_MS=1000',
      '-e',
      'CODEX_BIN=/tmp/fake-codex/codex',
      '-e',
      'MBOS_AGENT_TASK_RUNNER_MODE=managed_platform',
      '-e',
      'MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP=1',
      '-e',
      'MBOS_AGENT_ARTIFACT_SCAN_MAX_FILES=50',
      '-e',
      'MBOS_AGENT_ARTIFACT_SCAN_MAX_FILE_BYTES=10485760',
      '-e',
      'MBOS_AGENT_ARTIFACT_INLINE_IMAGE_MAX_BYTES=2097152',
      '-e',
      'MBOS_AGENT_ARTIFACT_TEXT_PREVIEW_MAX_BYTES=65536',
      '-e',
      'MBOS_AGENT_WORKSPACE_FILE_SCAN_MAX_FILES=500',
      '-e',
      'MBOS_AGENT_WORKSPACE_FILE_CHANGE_LIST_MAX=50',
      '-e',
      'MBOS_AGENT_TASK_ASSET_IO_TIMEOUT_MS=30000',
      '-e',
      'MBOS_AGENT_RUNNER_DEBUG=0',
      '-e',
      'MBOS_AGENT_RUNNER_INSTANCE_ID=runner_image_task_execution_smoke',
      '-e',
      'MBOS_AGENT_RUNNER_SESSION_ID=runner_session_image_task_execution_smoke',
      '-e',
      'MBOS_AGENT_RECONNECT_BASE_MS=1000',
      '-e',
      'MBOS_AGENT_RECONNECT_MAX_MS=1000',
      '-e',
      'NOTEBOOK_TERMINAL_CLOSE_GRACE_MS=1000',
      '-e',
      `OPENAI_API_KEY=${sentinels.openAiApiKey}`,
      '-e',
      `GITHUB_TOKEN=${sentinels.githubToken}`,
      '-e',
      `HTTP_PROXY=http://smoke:${sentinels.httpProxyPassword}@127.0.0.1:9`,
      '-v',
      `${fakeDir}:/tmp/fake-codex:ro`,
      '-v',
      `${taskHomeHost}:${TASK_HOME}`,
      image,
    ]);
    requireDockerSuccess(runResult, 'docker run image task-execution smoke');
    containerStarted = true;

    const containerExitWatch = watchContainerExit(containerName);
    try {
      await withTimeout(
        Promise.race([harness.donePromise, containerExitWatch.promise]),
        45_000,
        'image_task_execution_smoke',
      );
    } finally {
      containerExitWatch.stop();
    }
    docker(['stop', '--time', '5', containerName], { stdio: 'ignore' });
    assertRequiredFrames(harness.state);
    restoreTaskHomeOwnership(image, taskHomeHost, { required: true });
    await assertNoSentinelsPersisted(taskHomeHost, sentinels);
    console.log('runner image task-execution websocket harness passed');
  } catch (error) {
    if (containerStarted) {
      printDockerLogs(containerName);
    }
    throw error;
  } finally {
    if (containerStarted) {
      docker(['rm', '-f', containerName], { stdio: 'ignore' });
    }
    if (server) {
      await closeServer(server).catch(() => undefined);
    }
    restoreTaskHomeOwnership(image, taskHomeHost, { ensureWritable: true });
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(typeof error.exitCode === 'number' ? error.exitCode : 1);
});
