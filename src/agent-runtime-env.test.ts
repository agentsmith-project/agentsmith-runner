import { describe, expect, it } from 'vitest';

import { buildAgentRuntimeEnv } from './agent-runtime-env.js';

describe('buildAgentRuntimeEnv', () => {
  it('serializes request-scoped projected dependencies into MBOS_AGENT_PROJECTED_DEPENDENCIES', () => {
    const projectedDependencies = {
      dependencies: {
        plain: 'value',
        structured: {
          fields: {
            token: 'secret_ref',
          },
        },
      },
    };

    const env = buildAgentRuntimeEnv({
      projected_dependencies: projectedDependencies,
    });

    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCIES).toBe(JSON.stringify(projectedDependencies));
  });

  it('clears projected dependencies env when context omits them', () => {
    const env = buildAgentRuntimeEnv({});

    expect(env.MBOS_AGENT_PROJECTED_DEPENDENCIES).toBe('');
  });

  it('does not read parent process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES', () => {
    const previous = process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES;
    process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES = '{"dependencies":{"stale":"parent"}}';

    try {
      const env = buildAgentRuntimeEnv({});

      expect(env.MBOS_AGENT_PROJECTED_DEPENDENCIES).toBe('');
    } finally {
      if (previous === undefined) {
        delete process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES;
      } else {
        process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES = previous;
      }
    }
  });
});
