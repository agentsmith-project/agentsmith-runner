# AGENTS.md

Guidance for coding agents working in `agentsmith-runner`.

## Project Boundary

This repository is the canonical AgentSmith runner repository:

- Canonical identity: `github.com/agentsmith-project/agentsmith-runner`
- Remote URL: `https://github.com/agentsmith-project/agentsmith-runner.git`
- Default branch: `main`

Current phase: P5.3b first half. Runtime source, builtin skills, and focused dev/fast checks live here; image build/publish, release readiness, AgentSmith adoption locks, and product semantics do not.

The repo is for runner execution process, builtin skills runtime, runner image, runner CI, and runner contract conformance tests. It only consumes the AgentSmith runner contract.

It is not responsible for Agent task API, Agent Runners API, Context Store, Files/file library, managed credentials, audit/usage, frontend management surface, product permissions, workspace/project governance, product release readiness, or the source of truth for the runner contract.

## Runner-Specific Guard

- Do not define Context Store scopes, Files/file-library behavior, managed credential resolution, execution ticket issuance, or permission semantics in this repo.
- Consume only the formal AgentSmith runner contract artifact package for product semantics.
- After publication, consume it through a registry/package dependency. Pre-GA runtime fast must receive an explicit artifact package and must not use ordinary npm install, sibling source, or local dependency protocols.
- Builtin skills runtime may only implement projection consumption and local execution. It must not add permission or credential resolution semantics.
- Keep owner/team metadata in `OWNERS.md`. Do not introduce a CODEOWNERS system during bootstrap.

## P5.3b Rules

- Do not move Dockerfiles, product contracts, AgentSmith gates, AgentSmith product tests, image publish steps, or release readiness authority during P5.3b first half.
- Do not import sibling repo source or rely on sibling repo relative paths for runtime behavior.
- Do not copy implementation assets from adjacent family repos or retired runner repos.
- Keep scripts KISS, fail closed, and simple.
- Keep all content ASCII.
- Do not add generated lockfiles, local dependency protocols, or vendored dependencies.
- Do not write secrets, tokens, private keys, credentials, or placeholder secret values.

## Team Handoff

Before making changes beyond bootstrap, team members must claim one non-overlapping workstream:

- `docs`
- `contracts`
- `runbooks`
- `CI gate`
- `implementation`

Each workstream must stay inside this repo's boundary and must preserve README, DEVELOPMENT, RELEASE_GATES, and this AGENTS file as the active operating constraints.

## Verification

Use the quick gate for governance changes:

```bash
bash scripts/verify-release.sh --quick
```

Use the runtime fast gate for runner source and builtin skills changes:

```bash
bash scripts/test-runner-runtime-fast.sh
```

These commands are not release readiness and must not be described as release gates.

The future full release gate will be repo-local and authoritative only after runtime, image, contract conformance, release evidence, and provenance checks are implemented here.
