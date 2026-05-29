const SCRUBBED_CHILD_ENV_KEYS = new Set([
  'MBOS_AGENT_KEY',
  'MBOS_AGENT_WS_URL',
  'MBOS_AGENT_EXECUTION_TICKET',
  'MBOS_CODEX_PROXY_EXECUTION_TICKET',
  'MBOS_CODEX_PROXY_AUTH_HEADER',
  'MBOS_AGENT_PROJECTED_DEPENDENCIES',
]);

const OPTIONAL_REQUEST_SCOPED_ENV_KEYS = new Set([
  'MBOS_AGENT_EXECUTION_TICKET',
  'MBOS_CODEX_PROXY_EXECUTION_TICKET',
  'MBOS_AGENT_PROJECTED_DEPENDENCIES',
]);

const LEGACY_PROJECTED_DEPENDENCY_ENV_PREFIX = 'MBOS_AGENT_PROJECTED_DEPENDENCY_';

function shouldScrubEnvKey(key: string): boolean {
  return SCRUBBED_CHILD_ENV_KEYS.has(key) || key.startsWith(LEGACY_PROJECTED_DEPENDENCY_ENV_PREFIX);
}

function shouldInjectRequestEnvKey(key: string, value: string | undefined): value is string {
  if (key.startsWith(LEGACY_PROJECTED_DEPENDENCY_ENV_PREFIX)) return false;
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
    if (shouldScrubEnvKey(key)) continue;
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
