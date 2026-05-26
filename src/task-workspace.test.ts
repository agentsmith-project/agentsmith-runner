import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkdirMock, fetchMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  default: {
    mkdir: mkdirMock,
  },
}));

import {
  buildTaskWorkspacePaths,
  clearPreparedTaskWorkspaces,
  prepareTaskWorkspace,
  resolveAgentTaskRunnerMode,
  resolveTaskCwd,
  shouldRetryTaskWorkspaceWriteFailure,
} from './task-workspace.js';

const TASK_HOME = '/home/task_1';
const TASK_WORKSPACE = `${TASK_HOME}/workspace`;
const TASK_ARTIFACTS = `${TASK_WORKSPACE}/.artifacts`;
const TASK_FILE_LIBRARY_ID = 'flib_1';
const TASK_HOME_SEGMENT = 'task_1';

function taskExecutionContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workspace_id: 'ws_default',
    project_id: 'proj_1',
    task_id: 'task_1',
    workspace_file_library_id: TASK_FILE_LIBRARY_ID,
    workspace_binding_mode: 'file_library',
    runtime_profile: process.env.MBOS_AGENT_TASK_RUNNER_MODE === 'developer' ? 'developer' : 'managed',
    task_home_segment: TASK_HOME_SEGMENT,
    task_home_path: TASK_HOME,
    workspace_path: TASK_WORKSPACE,
    artifacts_path: TASK_ARTIFACTS,
    library_root_path: '.',
    api_base: 'http://localhost:20000/api/v1',
    execution_ticket: 'test-token',
    ...overrides,
  };
}

describe('task-workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPreparedTaskWorkspaces();
    mkdirMock.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    delete process.env.MBOS_AGENT_TASK_RUNNER_MODE;
    process.env.HOME = '/home/alice';
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'developer';
  });

  it('resolves runner mode from explicit env', () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'managed_local';
    expect(resolveAgentTaskRunnerMode()).toBe('managed_local');
  });

  it('builds task HOME paths from explicit path truth', () => {
    const paths = buildTaskWorkspacePaths({
      mode: 'managed_platform',
      runtimeProfile: 'managed',
      taskHomeSegment: TASK_HOME_SEGMENT,
      taskHomePath: TASK_HOME,
      workspacePath: TASK_WORKSPACE,
      artifactsPath: TASK_ARTIFACTS,
      libraryRootPath: '.',
    });

    expect(paths.homeDir).toBe(TASK_HOME);
    expect(paths.workspaceDir).toBe(TASK_WORKSPACE);
    expect(paths.artifactsDir).toBe(TASK_ARTIFACTS);
    expect(paths.visibleRoot).toBe(TASK_WORKSPACE);
    expect(paths.libraryRoot).toBe('.');
    expect(paths.codexDir).toBe(`${TASK_HOME}/.codex`);
    expect(paths.mbosDir).toBe(`${TASK_HOME}/.mbos`);
    expect(paths.skillsDir).toBe(`${TASK_HOME}/.agents/skills`);
  });

  it('resolves cwd from pre-mounted path fields without backend workspace access', () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'managed_platform';

    expect(resolveTaskCwd({
      taskId: 'task_1',
      runtimeProfile: 'managed',
      taskHomeSegment: TASK_HOME_SEGMENT,
      taskHomePath: TASK_HOME,
      workspacePath: TASK_WORKSPACE,
      artifactsPath: TASK_ARTIFACTS,
      libraryRootPath: '.',
    })).toMatchObject({
      cwd: TASK_WORKSPACE,
      source: 'path_fields',
    });
  });

  it('uses path fields directly for file-library execution contexts without backend calls', async () => {
    const resolved = await prepareTaskWorkspace({
      executionContext: taskExecutionContext(),
      username: 'alice',
      taskId: 'task_1',
    });

    expect(resolved.cwd).toBe(TASK_WORKSPACE);
    expect(resolved.source).toBe('path_fields');
    expect(mkdirMock).toHaveBeenCalledWith(TASK_WORKSPACE, { recursive: true });
    expect(mkdirMock).toHaveBeenCalledWith(TASK_ARTIFACTS, { recursive: true });
    expect(fetchMock).not.toHaveBeenCalled();

    await resolved.release();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects execution contexts without formal path truth before touching the filesystem', async () => {
    await expect(prepareTaskWorkspace({
      executionContext: taskExecutionContext({
        workspace_path: undefined,
      }),
      username: 'alice',
      taskId: 'task_1',
    })).rejects.toThrow('task_execution_context_invalid');

    expect(mkdirMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses path fields directly for pre-mounted execution contexts', async () => {
    process.env.MBOS_AGENT_TASK_RUNNER_MODE = 'managed_platform';

    const resolved = await prepareTaskWorkspace({
      executionContext: taskExecutionContext({
        workspace_binding_mode: 'pre_mounted',
        runtime_profile: 'managed',
      }),
      username: 'alice',
      taskId: 'task_1',
    });

    expect(resolved.cwd).toBe(TASK_WORKSPACE);
    expect(resolved.source).toBe('path_fields');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recognizes retryable task-root write failures', () => {
    const eio = new Error('input/output error') as NodeJS.ErrnoException;
    eio.code = 'EIO';
    const estale = new Error('stale file handle') as NodeJS.ErrnoException;
    estale.code = 'ESTALE';
    const enotconn = new Error('transport endpoint is not connected') as NodeJS.ErrnoException;
    enotconn.code = 'ENOTCONN';
    const eacces = new Error('permission denied') as NodeJS.ErrnoException;
    eacces.code = 'EACCES';

    expect(shouldRetryTaskWorkspaceWriteFailure(eio)).toBe(true);
    expect(shouldRetryTaskWorkspaceWriteFailure(estale)).toBe(true);
    expect(shouldRetryTaskWorkspaceWriteFailure(enotconn)).toBe(true);
    expect(shouldRetryTaskWorkspaceWriteFailure(eacces)).toBe(false);
  });
});
