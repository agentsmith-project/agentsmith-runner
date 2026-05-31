import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { accessMock } = vi.hoisted(() => ({
  accessMock: vi.fn(),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    access: accessMock,
    default: {
      ...actual,
      access: accessMock,
    },
  };
});

import { prepareLaunchCommand, resetChildLauncherForTests } from './child-launcher.js';

describe('child-launcher', () => {
  const previousMode = process.env.MBOS_AGENT_TASK_RUNNER_MODE;
  const previousRequireBwrap = process.env.MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP;
  const previousAgentKey = process.env.MBOS_AGENT_KEY;
  const previousAgentWsUrl = process.env.MBOS_AGENT_WS_URL;
  const previousAgentExecutionTicket = process.env.MBOS_AGENT_EXECUTION_TICKET;
  const previousCodexProxyExecutionTicket = process.env.MBOS_CODEX_PROXY_EXECUTION_TICKET;
  const previousProjectedDependencies = process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES;
  const previousProjectedDependencySmokeSecret = process.env.MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    resetChildLauncherForTests();
    accessMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (previousMode === undefined) {
      delete process.env.MBOS_AGENT_TASK_RUNNER_MODE;
    } else {
      process.env.MBOS_AGENT_TASK_RUNNER_MODE = previousMode;
    }
    if (previousRequireBwrap === undefined) {
      delete process.env.MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP;
    } else {
      process.env.MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP = previousRequireBwrap;
    }
    if (previousAgentKey === undefined) {
      delete process.env.MBOS_AGENT_KEY;
    } else {
      process.env.MBOS_AGENT_KEY = previousAgentKey;
    }
    if (previousAgentWsUrl === undefined) {
      delete process.env.MBOS_AGENT_WS_URL;
    } else {
      process.env.MBOS_AGENT_WS_URL = previousAgentWsUrl;
    }
    if (previousAgentExecutionTicket === undefined) {
      delete process.env.MBOS_AGENT_EXECUTION_TICKET;
    } else {
      process.env.MBOS_AGENT_EXECUTION_TICKET = previousAgentExecutionTicket;
    }
    if (previousCodexProxyExecutionTicket === undefined) {
      delete process.env.MBOS_CODEX_PROXY_EXECUTION_TICKET;
    } else {
      process.env.MBOS_CODEX_PROXY_EXECUTION_TICKET = previousCodexProxyExecutionTicket;
    }
    if (previousProjectedDependencies === undefined) {
      delete process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES;
    } else {
      process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES = previousProjectedDependencies;
    }
    if (previousProjectedDependencySmokeSecret === undefined) {
      delete process.env.MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET;
    } else {
      process.env.MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET = previousProjectedDependencySmokeSecret;
    }
  });

  it('returns direct child commands for managed platform mode', async () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'managed_platform';
    const result = await prepareLaunchCommand({
      file: 'bash',
      args: ['-i'],
      cwd: '/home/task_1/workspace',
      env: {
        HOME: '/home/task_1',
        TASK_HOME: '/home/task_1',
        WORKSPACE_PATH: '/home/task_1/workspace',
      },
    });
    expect(result).toEqual({
      file: 'bash',
      args: ['-i'],
      env: {
        HOME: '/home/task_1',
        TASK_HOME: '/home/task_1',
        WORKSPACE_PATH: '/home/task_1/workspace',
      },
    });
  });

  it('wraps managed local children with bwrap, preserves env HOME, and binds cwd plus HOME writable', async () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'managed_local';
    const result = await prepareLaunchCommand({
      file: 'codex',
      args: ['exec', 'hello'],
      cwd: '/home/task_1/workspace',
      env: {
        HOME: '/home/task_1',
        TASK_HOME: '/home/task_1',
        WORKSPACE_PATH: '/home/task_1/workspace',
        PATH: '/home/task_1/.local/bin:/home/task_1/.cargo/bin:/usr/bin:/bin',
        PYTHONUSERBASE: '/home/task_1/.local',
        PIP_USER: '1',
        npm_config_prefix: '/home/task_1/.local',
        CARGO_HOME: '/home/task_1/.cargo',
        RUSTUP_HOME: '/home/task_1/.rustup',
      },
    });
    expect(result.file).toBe('/usr/bin/bwrap');
    expect(result.args).toEqual(expect.arrayContaining([
      '--clearenv',
      '--ro-bind', '/', '/',
      '--bind', '/home/task_1/workspace', '/home/task_1/workspace',
      '--bind', '/home/task_1', '/home/task_1',
      '--chdir', '/home/task_1/workspace',
      '--setenv', 'HOME', '/home/task_1',
      '--setenv', 'TASK_HOME', '/home/task_1',
      '--setenv', 'WORKSPACE_PATH', '/home/task_1/workspace',
      '--setenv', 'PYTHONUSERBASE', '/home/task_1/.local',
      '--setenv', 'PIP_USER', '1',
      '--setenv', 'npm_config_prefix', '/home/task_1/.local',
      '--setenv', 'CARGO_HOME', '/home/task_1/.cargo',
      '--setenv', 'RUSTUP_HOME', '/home/task_1/.rustup',
      '--',
      'codex',
      'exec',
      'hello',
    ]));
  });

  it('does not leak runner control or stale request env into the managed local bwrap wrapper process', async () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'managed_local';
    process.env.MBOS_AGENT_KEY = 'runner_control_key';
    process.env.MBOS_AGENT_WS_URL = 'ws://runner-control.example/ws';
    process.env.MBOS_AGENT_EXECUTION_TICKET = 'stale_parent_agent_ticket';
    process.env.MBOS_CODEX_PROXY_EXECUTION_TICKET = 'stale_parent_proxy_ticket';
    process.env.MBOS_AGENT_PROJECTED_DEPENDENCIES = '{"dependencies":{"stale":"parent"}}';
    process.env.MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET = '{"fields":{"value":"stale_parent"}}';
    const inputEnv = {
      HOME: '/home/task_1',
      TASK_HOME: '/home/task_1',
      WORKSPACE_PATH: '/home/task_1/workspace',
      ARTIFACTS_PATH: '/home/task_1/workspace/.artifacts',
      PATH: '/home/task_1/.local/bin:/usr/bin:/bin',
      MBOS_AGENT_EXECUTION_TICKET: 'current_request_ticket',
      MBOS_CODEX_PROXY_EXECUTION_TICKET: 'current_proxy_ticket',
      MBOS_AGENT_PROJECTED_DEPENDENCIES: '{"dependencies":{"fresh":"request"}}',
    };

    const result = await prepareLaunchCommand({
      file: 'codex',
      args: ['exec', 'hello'],
      cwd: '/home/task_1/workspace',
      env: inputEnv,
    });

    expect(result.file).toBe('/usr/bin/bwrap');
    expect(result.env).toEqual(inputEnv);
    expect(result.env.MBOS_AGENT_KEY).toBeUndefined();
    expect(result.env.MBOS_AGENT_WS_URL).toBeUndefined();
    expect(result.env.MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET).toBeUndefined();
    expect(result.args).toEqual(expect.arrayContaining([
      '--clearenv',
      '--setenv', 'MBOS_AGENT_EXECUTION_TICKET', 'current_request_ticket',
      '--setenv', 'MBOS_CODEX_PROXY_EXECUTION_TICKET', 'current_proxy_ticket',
      '--setenv', 'MBOS_AGENT_PROJECTED_DEPENDENCIES', '{"dependencies":{"fresh":"request"}}',
    ]));
  });

  it('falls back to direct launch for developer when bwrap is unavailable', async () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'developer';
    accessMock.mockRejectedValue(new Error('missing'));

    const result = await prepareLaunchCommand({
      file: 'bash',
      args: ['-i'],
      cwd: '/home/task_1/workspace',
      env: { HOME: '/home/task_1', TASK_HOME: '/home/task_1', WORKSPACE_PATH: '/home/task_1/workspace' },
    });

    expect(result).toEqual({
      file: 'bash',
      args: ['-i'],
      env: { HOME: '/home/task_1', TASK_HOME: '/home/task_1', WORKSPACE_PATH: '/home/task_1/workspace' },
    });
  });

  it('still requires bwrap for managed_local', async () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'managed_local';
    accessMock.mockRejectedValue(new Error('missing'));

    await expect(prepareLaunchCommand({
      file: 'bash',
      args: ['-i'],
      cwd: '/home/task_1/workspace',
      env: { HOME: '/home/task_1', TASK_HOME: '/home/task_1', WORKSPACE_PATH: '/home/task_1/workspace' },
    })).rejects.toThrow('bwrap_missing_for_agent_task_runner');
  });

  it('can require bwrap for developer explicitly', async () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'developer';
    process.env.MBOS_AGENT_TASK_RUNNER_REQUIRE_BWRAP = 'true';
    accessMock.mockRejectedValue(new Error('missing'));

    await expect(prepareLaunchCommand({
      file: 'bash',
      args: ['-i'],
      cwd: '/home/task_1/workspace',
      env: { HOME: '/home/task_1', TASK_HOME: '/home/task_1', WORKSPACE_PATH: '/home/task_1/workspace' },
    })).rejects.toThrow('bwrap_missing_for_agent_task_runner');
  });
});
