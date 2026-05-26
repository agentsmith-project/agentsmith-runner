import { mkdir } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';
import {
  assertTaskExecutionContext,
  type TaskExecutionContext,
  type TaskRuntimeProfile,
  type TaskWorkspaceBindingMode,
} from '@mbos/agent-runner-contract';

const RETRYABLE_TASK_WORKSPACE_WRITE_FAILURE_CODES = new Set(['EIO', 'ESTALE', 'ENOTCONN']);
const TASK_HOME_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export type AgentTaskRunnerMode = 'developer' | 'managed_local' | 'managed_platform';
export type { TaskRuntimeProfile, TaskWorkspaceBindingMode };

type TaskWorkspaceIdentity = {
  taskId: string;
  workspaceBindingMode: TaskWorkspaceBindingMode;
  runtimeProfile: TaskRuntimeProfile;
  taskHomeSegment: string;
};

export type TaskWorkspacePaths = {
  mode: AgentTaskRunnerMode;
  runtimeProfile: TaskRuntimeProfile;
  taskHomeSegment: string;
  taskHome: string;
  workspaceDir: string;
  visibleRoot: string;
  libraryRoot: '.';
  mountRoot: string;
  taskRoot: string;
  runtimeRoot: string;
  homeDir: string;
  codexDir: string;
  artifactsDir: string;
  mbosDir: string;
  skillsDir: string;
};

function sanitizeWorkspacePath(raw: string | undefined): string {
  return (raw ?? '').trim();
}

function normalizeRequiredString(value: unknown, errorCode: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(errorCode);
  }
  return value.trim();
}

function normalizeTaskHomeSegment(value: unknown, errorCode: string): string {
  const segment = normalizeRequiredString(value, errorCode);
  if (
    !TASK_HOME_SEGMENT_PATTERN.test(segment)
    || segment === '.'
    || segment === '..'
    || segment.split(/[\\/]+/).some((part) => part === '..')
    || normalize(segment) !== segment
  ) {
    throw new Error(errorCode);
  }
  return segment;
}

function debugTaskWorkspace(message: string, extra?: Record<string, unknown>): void {
  if (process.env.MBOS_AGENT_RUNNER_DEBUG !== '1') return;
  const payload = extra ? ` ${JSON.stringify(extra)}` : '';
  process.stdout.write(`[agentsmith-runner][task-workspace] ${message}${payload}\n`);
}

export function shouldRetryTaskWorkspaceMount(): boolean {
  return false;
}

export function shouldRetryTaskWorkspaceWriteFailure(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  if (RETRYABLE_TASK_WORKSPACE_WRITE_FAILURE_CODES.has(code)) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  return message.includes('stale file handle')
    || message.includes('transport endpoint is not connected')
    || message.includes('input/output error');
}

export function resolveAgentTaskRunnerMode(): AgentTaskRunnerMode {
  const raw = (process.env.MBOS_AGENT_TASK_RUNNER_MODE ?? '').trim();
  switch (raw) {
    case 'developer':
    case 'managed_local':
    case 'managed_platform':
      return raw;
    default:
      throw new Error(`agent_task_runner_mode_invalid:${raw || 'missing'}`);
  }
}

function normalizeTaskWorkspacePath(raw: string | undefined, field: string): string {
  const value = sanitizeWorkspacePath(raw);
  if (!value) {
    throw new Error(`task_workspace_paths_missing:${field}`);
  }
  if (!isAbsolute(value)) {
    throw new Error(`task_workspace_paths_not_absolute:${field}`);
  }
  if (value.split('/').some((part) => part === '..')) {
    throw new Error(`task_workspace_paths_traversal:${field}`);
  }
  const normalized = normalize(value);
  if (normalized === '/') return normalized;
  return normalized.replace(/\/+$/, '');
}

function normalizeTaskLibraryRootPath(raw: string | undefined, field: string): '.' {
  const value = sanitizeWorkspacePath(raw ?? '.');
  if (value !== '.') {
    throw new Error(`task_workspace_paths_inconsistent:${field}`);
  }
  return '.';
}

function buildTaskWorkspaceIdentity(
  executionContext: TaskExecutionContext,
  expectedTaskId: string,
): TaskWorkspaceIdentity {
  const taskId = normalizeRequiredString(
    executionContext.task_id,
    'task_workspace_identity_missing:task_id',
  );
  if (taskId !== expectedTaskId) {
    throw new Error('task_workspace_identity_mismatch:task_id');
  }
  const taskHomeSegment = normalizeTaskHomeSegment(
    executionContext.task_home_segment,
    'task_workspace_identity_invalid:task_home_segment',
  );
  return {
    taskId,
    workspaceBindingMode: executionContext.workspace_binding_mode,
    runtimeProfile: executionContext.runtime_profile,
    taskHomeSegment,
  };
}

export function buildTaskWorkspacePaths(input: {
  mode: AgentTaskRunnerMode;
  runtimeProfile?: TaskRuntimeProfile;
  taskHomeSegment?: string;
  taskHomePath?: string;
  workspacePath?: string;
  artifactsPath?: string;
  libraryRootPath?: string;
}): TaskWorkspacePaths {
  const taskHome = normalizeTaskWorkspacePath(input.taskHomePath, 'task_home_path');
  const workspaceDir = normalizeTaskWorkspacePath(input.workspacePath, 'workspace_path');
  const artifactsDir = normalizeTaskWorkspacePath(input.artifactsPath, 'artifacts_path');
  const libraryRoot = normalizeTaskLibraryRootPath(input.libraryRootPath, 'library_root_path');
  const runtimeProfile = input.runtimeProfile ?? (input.mode === 'developer' ? 'developer' : 'managed');
  const taskHomeSegment = input.taskHomeSegment
    ? normalizeTaskHomeSegment(input.taskHomeSegment, 'task_workspace_paths_invalid:task_home_segment')
    : taskHome.split('/').filter(Boolean).at(-1) ?? '';
  if (!taskHomeSegment) {
    throw new Error('task_workspace_paths_invalid:task_home_segment');
  }
  if (input.mode === 'developer' && runtimeProfile !== 'developer') {
    throw new Error('task_workspace_paths_runtime_profile_mismatch');
  }
  if (input.mode !== 'developer' && runtimeProfile !== 'managed') {
    throw new Error('task_workspace_paths_runtime_profile_mismatch');
  }
  if (taskHome === '/') {
    throw new Error('task_workspace_paths_invalid:task_home_path');
  }
  if (!taskHome.endsWith(`/${taskHomeSegment}`)) {
    throw new Error('task_workspace_paths_inconsistent:task_home_segment');
  }
  if (runtimeProfile === 'managed' && taskHome !== join('/home', taskHomeSegment)) {
    throw new Error('task_workspace_paths_inconsistent:runtime_profile');
  }
  if (workspaceDir !== join(taskHome, 'workspace')) {
    throw new Error('task_workspace_paths_inconsistent:workspace_path');
  }
  if (artifactsDir !== join(workspaceDir, '.artifacts')) {
    throw new Error('task_workspace_paths_inconsistent:artifacts_path');
  }
  return {
    mode: input.mode,
    runtimeProfile,
    taskHomeSegment,
    taskHome,
    workspaceDir,
    visibleRoot: workspaceDir,
    libraryRoot,
    mountRoot: taskHome,
    taskRoot: taskHome,
    runtimeRoot: taskHome,
    homeDir: taskHome,
    codexDir: join(taskHome, '.codex'),
    artifactsDir,
    mbosDir: join(taskHome, '.mbos'),
    skillsDir: join(taskHome, '.agents', 'skills'),
  };
}

export function resolveTaskCwd(input: {
  taskId: string;
  runtimeProfile?: TaskRuntimeProfile;
  taskHomeSegment?: string;
  taskHomePath?: string;
  workspacePath?: string;
  artifactsPath?: string;
  libraryRootPath?: string;
}): { cwd: string; source: 'path_fields'; mode: AgentTaskRunnerMode; paths: TaskWorkspacePaths } {
  const mode = resolveAgentTaskRunnerMode();
  const paths = buildTaskWorkspacePaths({
    mode,
    runtimeProfile: input.runtimeProfile,
    taskHomeSegment: input.taskHomeSegment,
    taskHomePath: input.taskHomePath,
    workspacePath: input.workspacePath,
    artifactsPath: input.artifactsPath,
    libraryRootPath: input.libraryRootPath,
  });
  return {
    cwd: paths.workspaceDir,
    source: 'path_fields',
    mode,
    paths,
  };
}

async function ensureTaskWorkspaceWritable(paths: TaskWorkspacePaths): Promise<void> {
  await mkdir(paths.workspaceDir, { recursive: true });
  await mkdir(paths.artifactsDir, { recursive: true });
}

export async function prepareTaskWorkspace(input: {
  executionContext: unknown;
  username: string;
  taskId: string;
}): Promise<{
  cwd: string;
  source: 'path_fields';
  paths: TaskWorkspacePaths;
  release: () => Promise<void>;
}> {
  void input.username;
  const executionContext = assertTaskExecutionContext(input.executionContext);
  const identity = buildTaskWorkspaceIdentity(executionContext, input.taskId);
  const resolved = resolveTaskCwd({
    taskHomePath: executionContext.task_home_path,
    workspacePath: executionContext.workspace_path,
    artifactsPath: executionContext.artifacts_path,
    libraryRootPath: executionContext.library_root_path,
    runtimeProfile: identity.runtimeProfile,
    taskHomeSegment: identity.taskHomeSegment,
    taskId: input.taskId,
  });

  await ensureTaskWorkspaceWritable(resolved.paths);
  debugTaskWorkspace('prepare_workspace_from_path_fields_ready', {
    task_id: identity.taskId,
    workspace_binding_mode: identity.workspaceBindingMode,
    cwd: resolved.cwd,
  });
  return {
    cwd: resolved.cwd,
    source: 'path_fields',
    paths: resolved.paths,
    release: async () => undefined,
  };
}

export function clearPreparedTaskWorkspaces(): void {
  // Path-field preparation keeps no process-local workspace leases.
}

export async function releaseAllPreparedTaskWorkspaces(): Promise<void> {
  // Path-field preparation keeps no process-local workspace leases.
}

export async function releasePreparedTaskWorkspace(): Promise<void> {
  // Path-field preparation keeps no process-local workspace leases.
}

export async function evictPreparedTaskWorkspace(): Promise<void> {
  // Path-field preparation keeps no process-local workspace leases.
}
