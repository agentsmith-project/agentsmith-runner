import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(packageDir, '..', 'package.json');
const mbosScope = '@m' + 'bos/';

describe('agentsmith-runner package metadata', () => {
  it('declares the repo-local runner package and contract dependency', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      name?: string;
      dependencies?: Record<string, string>;
    };

    expect(packageJson.name).toBe('agentsmith-runner');
    expect(packageJson.dependencies?.[`${mbosScope}agent-runner-contract`]).toBe('0.1.0');
    expect(packageJson.dependencies).not.toHaveProperty(`${mbosScope}agent-task-runner`);
    expect(packageJson.dependencies).not.toHaveProperty(`${mbosScope}agent-runner`);
  });

  it('keeps the local runtime entrypoint on built single-process Node execution', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      main?: string;
      scripts?: Record<string, string>;
    };

    expect(packageJson.main).toBe('dist/index.js');
    expect(packageJson.scripts?.build).toContain('esbuild src/index.ts');
    expect(packageJson.scripts?.build).toContain('--outfile=dist/index.js');
    expect(packageJson.scripts?.start).toBe('node dist/index.js');
    expect(packageJson.scripts?.start).not.toMatch(/\btsx\b|src\/index\.ts|\bnpm\b|\bdev\b/u);
  });
});
