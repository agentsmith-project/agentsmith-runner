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
- P5.0 explicit runner contract artifact consumer skeleton.
- P5.1 start guard that runs local contract-consumer startup checks without an external artifact root.

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

Runner-specific fail-fast guard: this repo must not define Context Store scopes, Files/file-library behavior, managed credential resolution, execution ticket issuance, or permission semantics. It may only consume the published AgentSmith runner contract package and fixtures. Builtin skills runtime may only implement projection consumption and local execution.

Contract-consumer/source-boundary guard: future implementation may reference only the published `@mbos/agent-runner-contract` package for runner contract semantics. It must not consume the contract through local dependency protocols, sibling AgentSmith source paths, other `@mbos` packages, moved runner packages, or removed old runner source.

## Commands

Current quick verification:

```bash
bash scripts/verify-release.sh --quick
```

Quick verification includes the contract-consumer/source-boundary check. It remains a bootstrap guard only, not release readiness.

P5.0 contract artifact consumer diagnostic:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

This command expects a caller-supplied artifact root containing external descriptor `runner-contract-artifact.json` and the tgz referenced by the descriptor. It validates descriptor release truth, CI artifact provenance, sha256, npm SRI integrity, the package manifest v1 inside the tgz, and a temporary npm install from the tgz before running import and guard smokes. It rejects legacy `local_pack_manifest` and is not release readiness.

Script syntax check:

```bash
bash -n scripts/verify-release.sh
bash -n scripts/check-governance-guard.sh
bash -n scripts/test-runner-contract-consumer.sh
node --check scripts/check-runner-contract-consumer.mjs
```

P5.1 start guard:

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, the consumer Node syntax check, and the local consumer self-test with generated temporary fixtures. It does not require an external artifact root.

Start guard is not release readiness. No npm, node, docker, or package installation is required for the quick bootstrap guard. The P5.0 consumer diagnostic and P5.1 start guard use Node and npm only inside a temporary consumer workspace and must not add package manager files to this repo.

## Local Workspace Handoff

The local checkout at `/home/percy/works/mbos-v1/agentsmith-runner` is a workspace convention for handoff beside AgentSmith. Do not use that path, or any sibling checkout path, as a runtime dependency or source path dependency. CI and release work must rely on the canonical `github.com/agentsmith-project/agentsmith-runner` provenance.

## Release Posture

Quick verification proves only that the bootstrap governance surface is intact. It does not prove runtime behavior, image quality, contract compatibility, or release readiness.

Local diagnostics, dev diagnostics, and backend-real diagnostics can become focused evidence later, but they are not release proof for this repository.

The full release gate is a future repo-local authority. Until it exists, no change in this repo may claim that a runner image is releasable, adopted by AgentSmith, or ready for production.
