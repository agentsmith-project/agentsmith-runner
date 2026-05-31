const SCRUBBED_CHILD_ENV_KEYS = new Set([
  'MBOS_AGENT_KEY',
  'MBOS_AGENT_WS_URL',
  'MBOS_AGENT_EXECUTION_TICKET',
  'MBOS_CODEX_PROXY_EXECUTION_TICKET',
  'MBOS_CODEX_PROXY_AUTH_HEADER',
  'MBOS_AGENT_PROJECTED_DEPENDENCIES',
  'MBOS_AGENT_TASK_RUNNER_MODE',
  'MBOS_AGENT_BUILTIN_SKILLS_DIR',
  'MBOS_AGENT_BUILTIN_SKILLS_REQUIRED',
  'MBOS_AGENT_BUILTIN_SKILLS',
  'MBOS_AGENT_CODEX_YOLO',
  'MBOS_AGENT_CANCEL_KILL_DELAY_MS',
  'MBOS_AGENT_RUNNER_DEBUG',
  'MBOS_AGENT_RUNNER_INSTANCE_ID',
  'MBOS_AGENT_RUNNER_SESSION_ID',
  'MBOS_AGENT_RECONNECT_BASE_MS',
  'MBOS_AGENT_RECONNECT_MAX_MS',
  'NOTEBOOK_TERMINAL_CLOSE_GRACE_MS',
  'CODEX_BIN',
]);

const OPTIONAL_REQUEST_SCOPED_ENV_KEYS = new Set([
  'MBOS_AGENT_EXECUTION_TICKET',
  'MBOS_CODEX_PROXY_EXECUTION_TICKET',
  'MBOS_AGENT_PROJECTED_DEPENDENCIES',
]);

const LEGACY_PROJECTED_DEPENDENCY_ENV_PREFIX = 'MBOS_AGENT_PROJECTED_DEPENDENCY_';

const KNOWN_SECRET_LIKE_PARENT_ENV_KEYS = new Set([
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_SHARED_CREDENTIALS_FILE',
  'AZURE_FEDERATED_TOKEN_FILE',
  'DOCKER_AUTH_CONFIG',
  'GCLOUD_SERVICE_KEY',
  'GITHUB_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CREDENTIALS',
  'KUBECONFIG',
  'NETRC',
  'NETRC_FILE',
  'NPM_CONFIG__AUTH',
  'SSH_AUTH_SOCK',
]);

const SECRET_LIKE_PARENT_ENV_KEY_PATTERN = /(?:^|_)(?:AUTH|AUTH_?TOKEN|TOKEN|SECRET|PASSWORD|KEY)$/i;
const PROXY_ENV_KEY_PATTERN = /^(?:ALL|FTP|HTTP|HTTPS)_PROXY$/i;

function normalizedEnvKey(key: string): string {
  return key.toUpperCase();
}

function shouldScrubEnvKey(key: string): boolean {
  const normalizedKey = normalizedEnvKey(key);
  return SCRUBBED_CHILD_ENV_KEYS.has(normalizedKey)
    || normalizedKey.startsWith(LEGACY_PROJECTED_DEPENDENCY_ENV_PREFIX);
}

function proxyEnvValueHasCredentials(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  const parseCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    const url = new URL(parseCandidate);
    return Boolean(url.username || url.password);
  } catch {
    const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const authority = withoutScheme.split(/[/?#]/, 1)[0] ?? '';
    return authority.includes('@');
  }
}

function shouldScrubParentEnvEntry(key: string, value: string | undefined): boolean {
  if (shouldScrubEnvKey(key)) return true;
  const normalizedKey = normalizedEnvKey(key);
  if (PROXY_ENV_KEY_PATTERN.test(normalizedKey)) {
    return proxyEnvValueHasCredentials(value);
  }
  return KNOWN_SECRET_LIKE_PARENT_ENV_KEYS.has(normalizedKey)
    || SECRET_LIKE_PARENT_ENV_KEY_PATTERN.test(normalizedKey);
}

function shouldInjectRequestEnvKey(key: string, value: string | undefined): value is string {
  if (normalizedEnvKey(key).startsWith(LEGACY_PROJECTED_DEPENDENCY_ENV_PREFIX)) return false;
  if (value === undefined) return false;
  if (OPTIONAL_REQUEST_SCOPED_ENV_KEYS.has(key) && value.trim() === '') return false;
  return true;
}

export function buildRequestScopedChildEnv(input: {
  parentEnv: NodeJS.ProcessEnv;
  requestEnv?: Record<string, string | undefined>;
}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(input.parentEnv)) {
    if (shouldScrubParentEnvEntry(key, value)) continue;
    env[key] = value;
  }
  for (const [key, value] of Object.entries(input.requestEnv ?? {})) {
    if (!shouldInjectRequestEnvKey(key, value)) {
      delete env[key];
      continue;
    }
    env[key] = value;
  }
  return env;
}
