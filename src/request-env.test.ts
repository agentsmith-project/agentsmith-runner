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
        MBOS_AGENT_PROJECTED_DEPENDENCY_JIRA_AUTH: '{"fields":{"token":"stale"}}',
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
    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCY_JIRA_AUTH).toBeUndefined();
  });

  it('omits absent request-scoped tickets and bulk projection instead of carrying stale parent values', () => {
    const env = buildRequestScopedChildEnv({
      parentEnv: {
        MBOS_AGENT_EXECUTION_TICKET: 'stale_agent_ticket',
        MBOS_CODEX_PROXY_EXECUTION_TICKET: 'stale_proxy_ticket',
        MBOS_AGENT_PROJECTED_DEPENDENCIES: '{"dependencies":{"stale":"parent"}}',
        MBOS_AGENT_PROJECTED_DEPENDENCY_JIRA_AUTH: '{"fields":{"token":"stale"}}',
      },
      requestEnv: {
        MBOS_AGENT_EXECUTION_TICKET: '',
        MBOS_CODEX_PROXY_EXECUTION_TICKET: '',
        MBOS_AGENT_PROJECTED_DEPENDENCIES: '',
        MBOS_AGENT_PROJECTED_DEPENDENCY_JIRA_AUTH: '{"fields":{"token":"current-but-legacy"}}',
      },
    });

    expect(env.MBOS_AGENT_EXECUTION_TICKET).toBeUndefined();
    expect(env.MBOS_CODEX_PROXY_EXECUTION_TICKET).toBeUndefined();
    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCIES).toBeUndefined();
    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCY_JIRA_AUTH).toBeUndefined();
  });
});
