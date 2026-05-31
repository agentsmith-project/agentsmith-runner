import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectBuiltinSkills, resolveBuiltinSkillsConfig, seedBuiltinSkills } from './builtin-skills.js';
import { parseBuiltinSkillCapabilityContract, readBuiltinSkillCapabilityContract } from './skill-capabilities.js';

const resolveBuiltinSkillsConfigWithArgs = resolveBuiltinSkillsConfig as unknown as (
  args?: {
    fileExists?: (path: string) => boolean;
  },
) => ReturnType<typeof resolveBuiltinSkillsConfig>;

describe('builtin-skills', () => {
  it('resolves dev fallback defaults when env vars are not set', () => {
    const previousDir = process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR;
    const previousRequired = process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
    const previousSkills = process.env.MBOS_AGENT_BUILTIN_SKILLS;
    delete process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR;
    delete process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
    delete process.env.MBOS_AGENT_BUILTIN_SKILLS;
    try {
      const config = resolveBuiltinSkillsConfig();
      expect(config.sourceDir).toMatch(/agentsmith-runner\/builtin-skills$/);
      expect(config.required).toBe(true);
      expect(config.skills).toEqual(['mbos-context']);
    } finally {
      if (previousDir === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR = previousDir;
      if (previousRequired === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = previousRequired;
      if (previousSkills === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS = previousSkills;
    }
  });

  it('prefers packaged image builtin skills when /etc/codex/skills is present', () => {
    const previousDir = process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR;
    const previousRequired = process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
    const previousSkills = process.env.MBOS_AGENT_BUILTIN_SKILLS;
    delete process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR;
    delete process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
    delete process.env.MBOS_AGENT_BUILTIN_SKILLS;
    try {
      const config = resolveBuiltinSkillsConfigWithArgs({
        fileExists: (target: string) => target === '/etc/codex/skills',
      });
      expect(config.sourceDir).toBe('/etc/codex/skills');
      expect(config.required).toBe(true);
      expect(config.skills).toEqual(['mbos-context']);
    } finally {
      if (previousDir === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR = previousDir;
      if (previousRequired === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = previousRequired;
      if (previousSkills === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS = previousSkills;
    }
  });

  it('treats an explicit empty skill list as no optional builtin skills', () => {
    const previousSkills = process.env.MBOS_AGENT_BUILTIN_SKILLS;
    const previousRequired = process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
    delete process.env.MBOS_AGENT_BUILTIN_SKILLS_DIR;
    process.env.MBOS_AGENT_BUILTIN_SKILLS = '';
    process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = '0';
    try {
      const config = resolveBuiltinSkillsConfig();
      expect(config.required).toBe(false);
      expect(config.skills).toEqual([]);
    } finally {
      if (previousSkills === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS = previousSkills;
      if (previousRequired === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = previousRequired;
    }
  });

  it('rejects invalid explicit skill names instead of silently sanitizing them', () => {
    const previousSkills = process.env.MBOS_AGENT_BUILTIN_SKILLS;
    const previousRequired = process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
    process.env.MBOS_AGENT_BUILTIN_SKILLS = ', , ###';
    process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = '0';
    try {
      expect(() => resolveBuiltinSkillsConfig()).toThrow('builtin_skill_name_invalid:###');
    } finally {
      if (previousSkills === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS = previousSkills;
      if (previousRequired === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = previousRequired;
    }
  });

  it('rejects dot-prefixed builtin skill names from env selection', () => {
    const previousSkills = process.env.MBOS_AGENT_BUILTIN_SKILLS;
    const previousRequired = process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
    process.env.MBOS_AGENT_BUILTIN_SKILLS = 'mbos-context,.system';
    process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = '1';
    try {
      expect(() => resolveBuiltinSkillsConfig()).toThrow('builtin_skill_name_forbidden:.system');
    } finally {
      if (previousSkills === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS = previousSkills;
      if (previousRequired === undefined) delete process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED;
      else process.env.MBOS_AGENT_BUILTIN_SKILLS_REQUIRED = previousRequired;
    }
  });

  it('inspects builtin skills from a configured source dir', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    try {
      mkdirSync(join(sourceRoot, 'sample-skill'), { recursive: true });
      writeFileSync(join(sourceRoot, 'sample-skill', 'SKILL.md'), 'sample');
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'capabilities.json'),
        JSON.stringify({
          version: 1,
          skill_name: 'sample-skill',
          dependencies: [
            {
              name: 'sample-dependency',
              kind: 'opaque_projection',
              provider_label: 'sample',
              expected_fields: ['value'],
              required: true,
            },
          ],
        }),
      );
      mkdirSync(join(sourceRoot, 'extra-skill'), { recursive: true });
      writeFileSync(join(sourceRoot, 'extra-skill', 'SKILL.md'), 'extra');
      writeFileSync(
        join(sourceRoot, 'extra-skill', 'capabilities.json'),
        JSON.stringify({
          version: 1,
          skill_name: 'extra-skill',
          dependencies: [
            {
              name: 'extra-dependency',
              kind: 'opaque_projection',
              provider_label: 'extra',
              expected_fields: ['endpoint', 'value'],
              required: true,
            },
          ],
        }),
      );
      const result = await inspectBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['sample-skill', 'extra-skill'],
        required: true,
      });
      expect(result.available).toEqual(['sample-skill', 'extra-skill']);
      expect(result.missing).toEqual([]);
      expect(result.skillContracts['extra-skill']?.dependencies?.[0]).toMatchObject({
        name: 'extra-dependency',
        kind: 'opaque_projection',
      });
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it('throws when required skills are missing', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    try {
      mkdirSync(join(sourceRoot, 'sample-skill'), { recursive: true });
      writeFileSync(join(sourceRoot, 'sample-skill', 'SKILL.md'), 'sample');
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'capabilities.json'),
        JSON.stringify({ version: 1, skill_name: 'sample-skill', dependencies: [] }),
      );
      await expect(inspectBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['sample-skill', 'extra-skill'],
        required: true,
      })).rejects.toThrow('builtin_skills_missing:extra-skill');
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it('supports optional skill sets without failing when missing', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    try {
      mkdirSync(join(sourceRoot, 'extra-skill'), { recursive: true });
      writeFileSync(join(sourceRoot, 'extra-skill', 'SKILL.md'), 'extra');
      writeFileSync(
        join(sourceRoot, 'extra-skill', 'capabilities.json'),
        JSON.stringify({ version: 1, skill_name: 'extra-skill', dependencies: [] }),
      );
      const result = await inspectBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['sample-skill', 'extra-skill'],
        required: false,
      });
      expect(result.available).toEqual(['extra-skill']);
      expect(result.missing).toEqual(['sample-skill']);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it('seeds builtin skills into the task user directory and rewrites absolute /etc paths', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'runner-skills-target-'));
    const manifestRoot = mkdtempSync(join(tmpdir(), 'runner-skills-manifest-'));
    try {
      mkdirSync(join(sourceRoot, 'sample-skill'), { recursive: true });
      mkdirSync(join(sourceRoot, '.mbos-runtime'), { recursive: true });
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'SKILL.md'),
        'python3 /etc/codex/skills/sample-skill/scripts/sample_tool.py tools-list',
      );
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'capabilities.json'),
        JSON.stringify({
          version: 1,
          skill_name: 'sample-skill',
          dependencies: [
            {
              name: 'sample-dependency',
              kind: 'opaque_projection',
              provider_label: 'sample',
              expected_fields: ['value'],
              required: true,
            },
          ],
        }),
      );
      writeFileSync(join(sourceRoot, '.mbos-runtime', 'capability_runtime.py'), 'RUNTIME = True\n');
      const result = await seedBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['sample-skill'],
        targetDir: targetRoot,
        manifestDir: manifestRoot,
      });
      expect(result.seeded).toEqual(['sample-skill']);
      expect(readFileSync(join(targetRoot, 'sample-skill', 'SKILL.md'), 'utf-8')).toContain(
        `${targetRoot}/sample-skill/scripts/sample_tool.py`,
      );
      expect(readFileSync(join(targetRoot, '.mbos-runtime', 'capability_runtime.py'), 'utf-8')).toContain('RUNTIME');
      const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8')) as {
        installed_skills: string[];
        runtime_helpers?: string[];
        skill_contracts?: Record<string, { dependencies?: Array<{ name?: string }> }>;
      };
      expect(manifest.installed_skills).toEqual(['sample-skill']);
      expect(manifest.runtime_helpers).toContain('.mbos-runtime');
      expect(manifest.skill_contracts?.['sample-skill']?.dependencies?.[0]?.name).toBe('sample-dependency');
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(manifestRoot, { recursive: true, force: true });
    }
  });

  it('fails inspection when a selected skill is missing its machine-readable capability contract', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    try {
      mkdirSync(join(sourceRoot, 'extra-skill'), { recursive: true });
      writeFileSync(join(sourceRoot, 'extra-skill', 'SKILL.md'), 'extra');
      await expect(inspectBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['extra-skill'],
        required: true,
      })).rejects.toThrow('builtin_skill_contract_missing:extra-skill');
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it('rejects dot-prefixed selected skill dirs during inspection and seeding', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'runner-skills-target-'));
    const manifestRoot = mkdtempSync(join(tmpdir(), 'runner-skills-manifest-'));
    try {
      mkdirSync(join(sourceRoot, '.hidden-skill'), { recursive: true });
      writeFileSync(join(sourceRoot, '.hidden-skill', 'SKILL.md'), 'hidden');
      writeFileSync(
        join(sourceRoot, '.hidden-skill', 'capabilities.json'),
        JSON.stringify({ version: 1, skill_name: '.hidden-skill', dependencies: [] }),
      );

      await expect(inspectBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['.system'],
        required: true,
      })).rejects.toThrow('builtin_skill_name_forbidden:.system');

      await expect(seedBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['.hidden-skill'],
        targetDir: targetRoot,
        manifestDir: manifestRoot,
      })).rejects.toThrow('builtin_skill_name_forbidden:.hidden-skill');
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(manifestRoot, { recursive: true, force: true });
    }
  });

  it('allows concurrent builtin-skill seeding into the same task workspace without EEXIST races', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'runner-skills-target-'));
    const manifestRoot = mkdtempSync(join(tmpdir(), 'runner-skills-manifest-'));
    try {
      mkdirSync(join(sourceRoot, 'sample-skill', 'scripts'), { recursive: true });
      mkdirSync(join(sourceRoot, '.mbos-runtime', 'scripts'), { recursive: true });
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'SKILL.md'),
        'python3 /etc/codex/skills/sample-skill/scripts/sample_tool.py tools-list',
      );
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'capabilities.json'),
        JSON.stringify({ version: 1, skill_name: 'sample-skill', dependencies: [] }),
      );
      writeFileSync(join(sourceRoot, 'sample-skill', 'scripts', 'sample_tool.py'), 'print("sample")\n');
      writeFileSync(join(sourceRoot, '.mbos-runtime', 'scripts', 'capability_runtime.py'), 'RUNTIME = True\n');

      const results = await Promise.all(
        Array.from({ length: 12 }, () => seedBuiltinSkills({
          sourceDir: sourceRoot,
          skills: ['sample-skill'],
          targetDir: targetRoot,
          manifestDir: manifestRoot,
        })),
      );

      expect(results).toHaveLength(12);
      for (const result of results) {
        expect(result.seeded).toEqual(['sample-skill']);
        expect(result.manifestPath).toBe(join(manifestRoot, 'builtin-skills-manifest.json'));
      }
      expect(readFileSync(join(targetRoot, 'sample-skill', 'SKILL.md'), 'utf8')).toContain(
        `${targetRoot}/sample-skill/scripts/sample_tool.py`,
      );
      expect(readFileSync(join(targetRoot, '.mbos-runtime', 'scripts', 'capability_runtime.py'), 'utf8')).toContain(
        'RUNTIME = True',
      );
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(manifestRoot, { recursive: true, force: true });
    }
  });

  it('retries when the builtin-skill lock parent is briefly unavailable', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'runner-skills-target-'));
    const manifestRoot = mkdtempSync(join(tmpdir(), 'runner-skills-manifest-'));
    const lockDir = join(manifestRoot, '.builtin-skills-seed.lock');
    let lockEnoentFailures = 0;
    const lockMkdirOptions: unknown[] = [];

    vi.resetModules();
    vi.doMock('node:fs/promises', () => {
      type Mkdir = typeof fsPromises.mkdir;
      const mkdirMock: Mkdir = (async (
        path: Parameters<Mkdir>[0],
        options?: Parameters<Mkdir>[1],
      ) => {
        if (String(path) === lockDir) {
          lockMkdirOptions.push(options);
          if (lockEnoentFailures === 0) {
            lockEnoentFailures += 1;
            const error = new Error('transient manifest parent not visible') as NodeJS.ErrnoException;
            error.code = 'ENOENT';
            throw error;
          }
        }
        return fsPromises.mkdir(path, options);
      }) as Mkdir;
      const mocked = {
        ...fsPromises,
        mkdir: mkdirMock,
      };
      return {
        ...mocked,
        default: mocked,
      };
    });

    try {
      mkdirSync(join(sourceRoot, 'sample-skill', 'scripts'), { recursive: true });
      writeFileSync(join(sourceRoot, 'sample-skill', 'SKILL.md'), 'sample');
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'capabilities.json'),
        JSON.stringify({ version: 1, skill_name: 'sample-skill', dependencies: [] }),
      );
      writeFileSync(join(sourceRoot, 'sample-skill', 'scripts', 'sample_tool.py'), 'print("sample")\n');

      const { seedBuiltinSkills: seedBuiltinSkillsWithMockedFs } = await import('./builtin-skills.js');
      const result = await seedBuiltinSkillsWithMockedFs({
        sourceDir: sourceRoot,
        skills: ['sample-skill'],
        targetDir: targetRoot,
        manifestDir: manifestRoot,
      });

      expect(result.seeded).toEqual(['sample-skill']);
      expect(readFileSync(join(targetRoot, 'sample-skill', 'SKILL.md'), 'utf8')).toBe('sample');
      expect(lockEnoentFailures).toBe(1);
      expect(lockMkdirOptions).toEqual([undefined, undefined]);
      expect(existsSync(lockDir)).toBe(false);
    } finally {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(manifestRoot, { recursive: true, force: true });
    }
  });

  it('keeps existing task-root state and skips replaying builtin-skill mirrors on repeated seeding', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'runner-skills-target-'));
    const manifestRoot = mkdtempSync(join(tmpdir(), 'runner-skills-manifest-'));
    try {
      mkdirSync(join(sourceRoot, 'sample-skill', 'scripts'), { recursive: true });
      writeFileSync(join(sourceRoot, 'sample-skill', 'SKILL.md'), 'seeded-skill-v1');
      writeFileSync(
        join(sourceRoot, 'sample-skill', 'capabilities.json'),
        JSON.stringify({ version: 1, skill_name: 'sample-skill', dependencies: [] }),
      );
      writeFileSync(join(sourceRoot, 'sample-skill', 'scripts', 'seeded-tool.py'), 'print("v1")\n');

      await seedBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['sample-skill'],
        targetDir: targetRoot,
        manifestDir: manifestRoot,
      });

      writeFileSync(join(targetRoot, 'sample-skill', 'local-state.txt'), 'keep-me');
      writeFileSync(join(sourceRoot, 'sample-skill', 'SKILL.md'), 'seeded-skill-v2');
      writeFileSync(join(sourceRoot, 'sample-skill', 'scripts', 'new-tool.py'), 'print("v2")\n');

      await seedBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['sample-skill'],
        targetDir: targetRoot,
        manifestDir: manifestRoot,
      });

      expect(readFileSync(join(targetRoot, 'sample-skill', 'local-state.txt'), 'utf8')).toBe('keep-me');
      expect(readFileSync(join(targetRoot, 'sample-skill', 'SKILL.md'), 'utf8')).toBe('seeded-skill-v1');
      expect(existsSync(join(targetRoot, 'sample-skill', 'scripts', 'new-tool.py'))).toBe(false);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(manifestRoot, { recursive: true, force: true });
    }
  });

  it('removes previously managed skill directories that are no longer selected', async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'runner-skills-src-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'runner-skills-target-'));
    const manifestRoot = mkdtempSync(join(tmpdir(), 'runner-skills-manifest-'));
    try {
      mkdirSync(join(sourceRoot, 'neutral-skill'), { recursive: true });
      writeFileSync(join(sourceRoot, 'neutral-skill', 'SKILL.md'), 'neutral skill');
      writeFileSync(
        join(sourceRoot, 'neutral-skill', 'capabilities.json'),
        JSON.stringify({ version: 1, skill_name: 'neutral-skill', dependencies: [] }),
      );
      mkdirSync(join(targetRoot, 'neutral-skill'), { recursive: true });
      mkdirSync(join(targetRoot, 'old-managed-skill'), { recursive: true });
      mkdirSync(join(targetRoot, 'user-installed-skill'), { recursive: true });
      writeFileSync(join(targetRoot, 'old-managed-skill', 'SKILL.md'), 'old managed skill');
      writeFileSync(join(targetRoot, 'user-installed-skill', 'SKILL.md'), 'user skill');
      writeFileSync(
        join(manifestRoot, 'builtin-skills-manifest.json'),
        `${JSON.stringify({
          version: 2,
          source_dir: sourceRoot,
          installed_skills: ['neutral-skill', 'old-managed-skill'],
          runtime_helpers: [],
          skill_contracts: {
            'neutral-skill': { version: 1, skill_name: 'neutral-skill', dependencies: [] },
            'old-managed-skill': { version: 1, skill_name: 'old-managed-skill', dependencies: [] },
          },
          installed_at: '2026-01-01T00:00:00.000Z',
        }, null, 2)}\n`,
      );

      await seedBuiltinSkills({
        sourceDir: sourceRoot,
        skills: ['neutral-skill'],
        targetDir: targetRoot,
        manifestDir: manifestRoot,
      });

      expect(existsSync(join(targetRoot, 'neutral-skill'))).toBe(true);
      expect(existsSync(join(targetRoot, 'old-managed-skill'))).toBe(false);
      expect(existsSync(join(targetRoot, 'user-installed-skill'))).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(manifestRoot, { recursive: true, force: true });
    }
  });

  it('parses opaque projection dependency descriptors', () => {
    const contract = parseBuiltinSkillCapabilityContract({
      version: 1,
      skill_name: 'sample-skill',
      dependencies: [
        {
          name: 'sample-dependency',
          kind: 'opaque_projection',
          provider_label: 'sample',
          expected_fields: ['value', 'endpoint'],
          required: true,
        },
      ],
    });

    expect(contract.dependencies[0]).toMatchObject({
      name: 'sample-dependency',
      kind: 'opaque_projection',
      provider_label: 'sample',
      expected_fields: ['value', 'endpoint'],
      required: true,
    });
  });

  it('ships mbos-context without product policy capability definitions', async () => {
    const config = resolveBuiltinSkillsConfigWithArgs({
      fileExists: (target: string) => target !== '/etc/codex/skills',
    });
    const contract = await readBuiltinSkillCapabilityContract(join(config.sourceDir, 'mbos-context'));
    expect(contract.dependencies).toEqual([]);
    expect('provides' in contract).toBe(false);
  });

  it('documents mbos-context as projection inspection only', () => {
    const config = resolveBuiltinSkillsConfigWithArgs({
      fileExists: (target: string) => target !== '/etc/codex/skills',
    });
    const skillDoc = readFileSync(join(config.sourceDir, 'mbos-context', 'SKILL.md'), 'utf8');
    expect(skillDoc).toContain('request projections');
    expect(skillDoc).toContain('Do not infer write policy');
    expect(skillDoc).toContain('--dependency');
  });
});
