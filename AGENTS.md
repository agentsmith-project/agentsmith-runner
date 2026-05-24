# AGENTS.md

Guidance for coding agents working in `agentsmith-runner`.

## Project Boundary

This repository is the canonical AgentSmith runner repository:

- Canonical identity: `github.com/agentsmith-project/agentsmith-runner`
- Remote URL: `https://github.com/agentsmith-project/agentsmith-runner.git`
- Default branch: `main`

Current phase: bootstrap-only/docs-governance-first skeleton.

The repo is for runner execution process, builtin skills runtime, runner image, runner CI, and runner contract conformance tests. It only consumes the AgentSmith runner contract.

It is not responsible for Agent task API, Agent Runners API, Context Store, Files/file library, managed credentials, audit/usage, frontend management surface, product permissions, workspace/project governance, product release readiness, or the source of truth for the runner contract.

## Runner-Specific Guard

- Do not define Context Store scopes, Files/file-library behavior, managed credential resolution, execution ticket issuance, or permission semantics in this repo.
- Consume only the published AgentSmith runner contract package and fixtures for product semantics.
- Builtin skills runtime may only implement projection consumption and local execution. It must not add permission or credential resolution semantics.
- Keep owner/team metadata in `OWNERS.md`. Do not introduce a CODEOWNERS system during bootstrap.

## Bootstrap Rules

- Do not move runtime code, Dockerfiles, product contracts, AgentSmith gates, or product tests during bootstrap.
- Do not import sibling repo source or rely on sibling repo relative paths for runtime behavior.
- Do not copy implementation assets from AgentSmith, adjacent family repos, or legacy runner repos.
- Keep scripts KISS, fail closed, and simple. Bash, grep, and find are enough for the current quick gate.
- Keep all content ASCII.
- Do not add package managers, package manifests, generated lockfiles, or vendored dependencies unless a later implementation workstream explicitly owns them.
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

Use the bootstrap quick gate for current changes:

```bash
bash scripts/verify-release.sh --quick
```

This command checks governance skeleton and boundary guardrails only. It is not release readiness and must not be described as a release gate.

The future full release gate will be repo-local and authoritative only after runtime, image, contract conformance, release evidence, and provenance checks are implemented here.
