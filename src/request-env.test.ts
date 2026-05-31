import { describe, expect, it } from 'vitest';

import { buildRequestScopedChildEnv } from './request-env.js';

describe('request-env', () => {
  it('scrubs runner control and stale request-scoped env before injecting current request values', () => {
    const projectedDependencies = JSON.stringify({
      dependencies: {
        'smoke-secret': {
          fields: {
            value: 'current_projection_secret',
          },
        },
      },
    });

    const env = buildRequestScopedChildEnv({
      parentEnv: {
        PATH: '/usr/bin:/bin',
        MBOS_AGENT_KEY: 'runner_key',
        MBOS_AGENT_WS_URL: 'ws://runner-control.example/ws',
        MBOS_AGENT_EXECUTION_TICKET: 'stale_agent_ticket',
        MBOS_CODEX_PROXY_EXECUTION_TICKET: 'stale_proxy_ticket',
        MBOS_AGENT_PROJECTED_DEPENDENCIES: '{"dependencies":{"stale":"parent"}}',
        MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET: '{"fields":{"token":"stale"}}',
        MBOS_AGENT_TASK_RUNNER_MODE: 'managed_platform',
        MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP: '1',
        MBOS_AGENT_ARTIFACT_SCAN_MAX_FILES: '100',
        MBOS_AGENT_ARTIFACT_SCAN_MAX_FILE_BYTES: '1048576',
        MBOS_AGENT_ARTIFACT_INLINE_IMAGE_MAX_BYTES: '65536',
        MBOS_AGENT_ARTIFACT_TEXT_PREVIEW_MAX_BYTES: '4096',
        MBOS_AGENT_WORKSPACE_FILE_SCAN_MAX_FILES: '250',
        MBOS_AGENT_WORKSPACE_FILE_CHANGE_LIST_MAX: '25',
        MBOS_AGENT_TASK_ASSET_IO_TIMEOUT_MS: '30000',
        MBOS_AGENT_BUILTIN_SKILLS_DIR: '/etc/codex/skills',
        MBOS_AGENT_BUILTIN_SKILLS_REQUIRED: '1',
        MBOS_AGENT_BUILTIN_SKILLS: 'mbos-context',
        MBOS_AGENT_CODEX_YOLO: '0',
        MBOS_AGENT_CANCEL_KILL_DELAY_MS: '1000',
        MBOS_AGENT_RUNNER_DEBUG: '1',
        MBOS_AGENT_RUNNER_INSTANCE_ID: 'runner_instance',
        MBOS_AGENT_RUNNER_SESSION_ID: 'runner_session',
        MBOS_AGENT_RECONNECT_BASE_MS: '1000',
        MBOS_AGENT_RECONNECT_MAX_MS: '5000',
        NOTEBOOK_TERMINAL_CLOSE_GRACE_MS: '1000',
        CODEX_BIN: '/tmp/codex',
      },
      requestEnv: {
        MBOS_AGENT_EXECUTION_TICKET: 'current_agent_ticket',
        MBOS_CODEX_PROXY_EXECUTION_TICKET: 'current_proxy_ticket',
        MBOS_AGENT_PROJECTED_DEPENDENCIES: projectedDependencies,
      },
    });

    expect(env.PATH).toBe('/usr/bin:/bin');
    expect(env.MBOS_AGENT_KEY).toBeUndefined();
    expect(env.MBOS_AGENT_WS_URL).toBeUndefined();
    expect(env.MBOS_AGENT_EXECUTION_TICKET).toBe('current_agent_ticket');
    expect(env.MBOS_CODEX_PROXY_EXECUTION_TICKET).toBe('current_proxy_ticket');
    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCIES).toBe(projectedDependencies);
    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET).toBeUndefined();
    expect(env.MBOS_AGENT_TASK_RUNNER_MODE).toBeUndefined();
    expect(env.MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP).toBeUndefined();
    expect(env.MBOS_AGENT_ARTIFACT_SCAN_MAX_FILES).toBeUndefined();
    expect(env.MBOS_AGENT_ARTIFACT_SCAN_MAX_FILE_BYTES).toBeUndefined();
    expect(env.MBOS_AGENT_ARTIFACT_INLINE_IMAGE_MAX_BYTES).toBeUndefined();
    expect(env.MBOS_AGENT_ARTIFACT_TEXT_PREVIEW_MAX_BYTES).toBeUndefined();
    expect(env.MBOS_AGENT_WORKSPACE_FILE_SCAN_MAX_FILES).toBeUndefined();
    expect(env.MBOS_AGENT_WORKSPACE_FILE_CHANGE_LIST_MAX).toBeUndefined();
    expect(env.MBOS_AGENT_TASK_ASSET_IO_TIMEOUT_MS).toBeUndefined();
    expect(env.MBOS_AGENT_BUILTIN_SKILLS_DIR).toBeUndefined();
    expect(env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED).toBeUndefined();
    expect(env.MBOS_AGENT_BUILTIN_SKILLS).toBeUndefined();
    expect(env.MBOS_AGENT_CODEX_YOLO).toBeUndefined();
    expect(env.MBOS_AGENT_CANCEL_KILL_DELAY_MS).toBeUndefined();
    expect(env.MBOS_AGENT_RUNNER_DEBUG).toBeUndefined();
    expect(env.MBOS_AGENT_RUNNER_INSTANCE_ID).toBeUndefined();
    expect(env.MBOS_AGENT_RUNNER_SESSION_ID).toBeUndefined();
    expect(env.MBOS_AGENT_RECONNECT_BASE_MS).toBeUndefined();
    expect(env.MBOS_AGENT_RECONNECT_MAX_MS).toBeUndefined();
    expect(env.NOTEBOOK_TERMINAL_CLOSE_GRACE_MS).toBeUndefined();
    expect(env.CODEX_BIN).toBeUndefined();
  });

  it('omits absent request-scoped tickets and bulk projection instead of carrying stale parent values', () => {
    const env = buildRequestScopedChildEnv({
      parentEnv: {
        MBOS_AGENT_EXECUTION_TICKET: 'stale_agent_ticket',
        MBOS_CODEX_PROXY_EXECUTION_TICKET: 'stale_proxy_ticket',
        MBOS_AGENT_PROJECTED_DEPENDENCIES: '{"dependencies":{"stale":"parent"}}',
        MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET: '{"fields":{"token":"stale"}}',
      },
      requestEnv: {
        MBOS_AGENT_EXECUTION_TICKET: '',
        MBOS_CODEX_PROXY_EXECUTION_TICKET: '',
        MBOS_AGENT_PROJECTED_DEPENDENCIES: '',
        MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET: '{"fields":{"token":"current-but-legacy"}}',
      },
    });

    expect(env.MBOS_AGENT_EXECUTION_TICKET).toBeUndefined();
    expect(env.MBOS_CODEX_PROXY_EXECUTION_TICKET).toBeUndefined();
    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCIES).toBeUndefined();
    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET).toBeUndefined();
  });

  it('drops ambient secret-like parent env while preserving safe runtime env', () => {
    const env = buildRequestScopedChildEnv({
      parentEnv: {
        HOME: '/home/runner',
        PATH: '/usr/bin:/bin',
        SHELL: '/bin/zsh',
        TERM: 'xterm-256color',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        LC_CTYPE: 'en_US.UTF-8',
        TMPDIR: '/tmp/runner',
        NO_PROXY: 'localhost,127.0.0.1',
        HTTP_PROXY: 'http://u:p@proxy.example:8080',
        HTTPS_PROXY: 'https://u:p@proxy.example:8443',
        GITHUB_TOKEN: 'parent_value',
        AWS_ACCESS_KEY_ID: 'parent_value',
        AWS_SECRET_ACCESS_KEY: 'parent_value',
        OPENAI_API_KEY: 'parent_value',
        ANTHROPIC_API_KEY: 'parent_value',
        CUSTOM_TOKEN: 'parent_value',
        CUSTOM_SECRET: 'parent_value',
        CUSTOM_PASSWORD: 'parent_value',
        CUSTOM_KEY: 'parent_value',
        SAFE_RUNTIME_FLAG: 'enabled',
      },
    });

    expect(env).toMatchObject({
      HOME: '/home/runner',
      PATH: '/usr/bin:/bin',
      SHELL: '/bin/zsh',
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      LC_CTYPE: 'en_US.UTF-8',
      TMPDIR: '/tmp/runner',
      NO_PROXY: 'localhost,127.0.0.1',
      SAFE_RUNTIME_FLAG: 'enabled',
    });
    expect(env.HTTP_PROXY).toBeUndefined();
    expect(env.HTTPS_PROXY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CUSTOM_TOKEN).toBeUndefined();
    expect(env.CUSTOM_SECRET).toBeUndefined();
    expect(env.CUSTOM_PASSWORD).toBeUndefined();
    expect(env.CUSTOM_KEY).toBeUndefined();
  });

  it('keeps credential-free proxy parent env', () => {
    const env = buildRequestScopedChildEnv({
      parentEnv: {
        HTTP_PROXY: 'http://proxy.example:8080',
        HTTPS_PROXY: 'https://proxy.example:8443',
        http_proxy: 'http://proxy.example:8080',
      },
    });

    expect(env.HTTP_PROXY).toBe('http://proxy.example:8080');
    expect(env.HTTPS_PROXY).toBe('https://proxy.example:8443');
    expect(env.http_proxy).toBe('http://proxy.example:8080');
  });
});
