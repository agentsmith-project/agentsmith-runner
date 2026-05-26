# AgentSmith Runner

AgentSmith Runner is the future implementation home for the AgentSmith managed runner execution process. This bootstrap repository is intentionally docs-governance-first: it establishes the repo identity, scope boundary, handoff rules, and quick governance guard before any runtime code, Dockerfile, contract implementation, or release workflow is moved here.

Canonical repository identity: `github.com/agentsmith-project/agentsmith-runner`

Remote URL:

```bash
https://github.com/agentsmith-project/agentsmith-runner.git
```

## Scope

This repo owns, after the bootstrap boundary is accepted:

- Runner execution process.
- Builtin skills runtime.
- Runner image.
- Runner-side CI.
- Runner contract conformance tests.

This repo only consumes the AgentSmith runner contract. AgentSmith and its shared contract flow remain the source of truth for product objects, API semantics, protocol schemas, fixtures, and compatibility rules.

## Owner Metadata

Owning team metadata lives in [OWNERS.md](OWNERS.md). This repo does not use a CODEOWNERS system during bootstrap.

## Non-Goals

This repo does not own:

- Runner contract source of truth.
- Agent task API.
- Agent Runners API.
- Runner key, presence, or heartbeat product semantics.
- Context Store.
- Files or file library.
- Managed credentials.
- Audit or usage.
- Frontend management surface.
- AgentSmith product release readiness.

This bootstrap slice also does not move the existing AgentSmith runner runtime, builtin skills runtime implementation, runner Dockerfile, product tests, contracts, or release gates.

## Boundary Rules

- Keep AgentSmith product truth in AgentSmith.
- Keep runner contract truth in the AgentSmith contract flow until an explicit shared contract package is published for consumption.
- Runner code must not define Context Store scopes, Files/file-library behavior, managed credential resolution, execution ticket issuance, or permission semantics.
- Runner code may only consume the published AgentSmith runner contract package and fixtures for product semantics.
- Builtin skills runtime may only implement projection consumption and local execution. It must not add permission or credential resolution semantics.
- Do not import AgentSmith product source or use sibling repo source paths as a runtime dependency.
- Do not copy implementation assets from adjacent family control-plane repos.
- AFSCP and ASBCP are bootstrap discipline references only, not dependencies.
- Do not use mutable tags as release proof; future release adoption must be digest-pinned and provenance-backed.
- Do not store secrets, credentials, tokens, private keys, or placeholder secrets in this repo.

## Local Workspace Handoff

For local handoff in this workspace, `/home/percy/works/mbos-v1/agentsmith-runner` is the bootstrap checkout beside AgentSmith. This is only a workspace convention and must not become a runtime dependency or source path dependency. CI and release provenance must be based only on `github.com/agentsmith-project/agentsmith-runner`.

## Quick Verification

The current bootstrap quick check validates governance skeleton and boundary claims only:

```bash
bash scripts/verify-release.sh --quick
```

Quick mode is not release readiness. The full repo-local release gate is a future authority and is not implemented in this bootstrap stage.

## P5.0 Contract Consumer Skeleton

P5.0 adds an explicit runner contract artifact consumer diagnostic:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

The artifact root must contain external descriptor `runner-contract-artifact.json` and the tgz named by that descriptor. The external descriptor remains the release truth for descriptor schema, CI artifact provenance, artifact URI binding, sha256, npm SRI integrity, and subject hash. The tgz must carry package manifest v1 at `package/contract-artifact.json`: `agentsmith.runner-contract-package-manifest/v1`, `runner_contract_package_manifest`, package identity, entrypoints, and `release_provenance` pointing back to `runner-contract-artifact.json`.

The consumer rejects legacy `local_pack_manifest`, verifies installability from the tgz, and runs a small import smoke for `@mbos/agent-runner-contract`.

This mode is intentionally not release readiness. It does not migrate runtime code, build a runner image, publish anything, update an AgentSmith lock, read sibling source trees, or allow local dependency protocols.

## Handoff

When team members enter this repo, first claim non-overlapping workstreams before implementation starts:

- `docs`: README, AGENTS, DEVELOPMENT, ADR, readiness evidence, risk register.
- `contracts`: consumer contract docs, conformance fixture plan, version compatibility notes.
- `runbooks`: local runner operation, image build/run handoff, release operator notes.
- `CI gate`: quick governance guard, future release gate design, workflow hardening.
- `implementation`: runner process, skills runtime, runner image, conformance tests.

All workstreams are bound by this README, [AGENTS.md](AGENTS.md), [DEVELOPMENT.md](DEVELOPMENT.md), and [docs/RELEASE_GATES.md](docs/RELEASE_GATES.md). Bootstrap quick gate success only opens repo-local focused work; it does not approve release, adoption, or AgentSmith lock updates.
