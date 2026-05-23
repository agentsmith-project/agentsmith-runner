# Development

This repository is intentionally small during bootstrap. The first goal is to make repo ownership, boundaries, and handoff rules machine-checkable before runtime work begins.

## Current Phase

Bootstrap-only/docs-governance-first.

Allowed now:

- Governance docs.
- Scope and non-goal docs.
- Contract and runbook placeholders.
- ADR for the bootstrap boundary.
- Quick governance guard.
- CI workflow that runs the quick guard.

Not allowed now:

- Runner runtime migration.
- Builtin skills runtime migration.
- Runner Dockerfile migration.
- Product API, Context Store, Files, managed credential, audit, usage, or frontend management code.
- AgentSmith product gate scripts or copied implementation assets from adjacent family repos.

## Repo Responsibilities

This repo is responsible for:

- Runner execution process.
- Builtin skills runtime.
- Runner image.
- Runner-side tests and CI.
- Contract conformance tests against the AgentSmith runner contract.

This repo only consumes the AgentSmith runner contract. It does not define Agent task API semantics, Agent Runners API semantics, Context Store scopes, file library behavior, managed credential resolution, audit/usage records, or frontend management behavior.

## Commands

Current quick verification:

```bash
bash scripts/verify-release.sh --quick
```

Script syntax check:

```bash
bash -n scripts/verify-release.sh
bash -n scripts/check-governance-guard.sh
```

No npm, node, docker, or package installation is required for bootstrap.

## Local Workspace Handoff

The local checkout at `/home/percy/works/mbos-v1/agentsmith-runner` is a workspace convention for handoff beside AgentSmith. Do not use that path, or any sibling checkout path, as a runtime dependency or source path dependency. CI and release work must rely on the canonical `github.com/agentsmith-project/agentsmith-runner` provenance.

## Release Posture

Quick verification proves only that the bootstrap governance surface is intact. It does not prove runtime behavior, image quality, contract compatibility, or release readiness.

The full release gate is a future repo-local authority. Until it exists, no change in this repo may claim that a runner image is releasable, adopted by AgentSmith, or ready for production.
