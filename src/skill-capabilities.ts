import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const SKILL_CONTRACT_FILENAME = 'capabilities.json';

export type BuiltinSkillDependencyDescriptor = {
  name: string;
  kind?: 'opaque_projection';
  expected_fields?: string[];
  provider_label?: string;
  required?: boolean;
};

export type BuiltinSkillCapabilityContract = {
  version: 1;
  skill_name: string;
  dependencies: BuiltinSkillDependencyDescriptor[];
};

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`skill_contract_invalid:${fieldName}`);
  }
  const values = value.map((item) => readTrimmedString(item));
  if (values.some((item) => item === null)) {
    throw new Error(`skill_contract_invalid:${fieldName}`);
  }
  return Array.from(new Set(values)) as string[];
}

function parseDependency(input: unknown, index: number): BuiltinSkillDependencyDescriptor {
  if (!isPlainObject(input)) {
    throw new Error(`skill_contract_invalid:dependencies[${index}]`);
  }
  const name = readTrimmedString(input.name);
  const kind = input.kind === undefined ? undefined : readTrimmedString(input.kind);
  const providerLabel = input.provider_label === undefined ? undefined : readTrimmedString(input.provider_label);
  if (!name || (kind !== undefined && kind !== 'opaque_projection')) {
    throw new Error(`skill_contract_invalid:dependencies[${index}]`);
  }
  if (providerLabel === null) {
    throw new Error(`skill_contract_invalid:dependencies[${index}].provider_label`);
  }
  return {
    name,
    ...(kind === undefined ? {} : { kind }),
    ...(providerLabel === undefined ? {} : { provider_label: providerLabel }),
    ...(input.required === undefined ? {} : { required: input.required !== false }),
    ...(input.expected_fields === undefined
      ? {}
      : { expected_fields: readOptionalStringArray(input.expected_fields, `dependencies[${index}].expected_fields`) }),
  };
}

export function parseBuiltinSkillCapabilityContract(input: unknown): BuiltinSkillCapabilityContract {
  if (!isPlainObject(input)) {
    throw new Error('skill_contract_invalid:root');
  }
  if (input.version !== 1) {
    throw new Error('skill_contract_invalid:version');
  }
  const skillName = readTrimmedString(input.skill_name);
  if (!skillName) {
    throw new Error('skill_contract_invalid:skill_name');
  }
  if (!Array.isArray(input.dependencies)) {
    throw new Error('skill_contract_invalid:dependencies');
  }
  return {
    version: 1,
    skill_name: skillName,
    dependencies: input.dependencies.map((item, index) => parseDependency(item, index)),
  };
}

export async function readBuiltinSkillCapabilityContract(skillRoot: string): Promise<BuiltinSkillCapabilityContract> {
  const path = resolve(skillRoot, SKILL_CONTRACT_FILENAME);
  const raw = await readFile(path, 'utf8');
  return parseBuiltinSkillCapabilityContract(JSON.parse(raw) as unknown);
}
