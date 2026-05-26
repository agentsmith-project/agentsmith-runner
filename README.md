# AgentSmith Runner

AgentSmith Runner is the implementation home for the AgentSmith managed runner execution process. Current P5 scope has repo-local runtime source, builtin skills, a focused dev/fast runtime gate, and a focused no-push image build/start smoke while keeping release readiness, AgentSmith adoption locks, and product semantics out of scope.

Canonical repository identity: `github.com/agentsmith-project/agentsmith-runner`

Remote URL:

```bash
https://github.com/agentsmith-project/agentsmith-runner.git
```

## Scope

This repo owns:

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

This P5 image-smoke slice adds only a repo-local Dockerfile and focused build/start smoke. It does not move product tests, product contracts, AgentSmith release gates, image publish steps, AgentSmith adoption locks, release manifests, or release readiness authority.

## Boundary Rules

- Keep AgentSmith product truth in AgentSmith.
- Keep runner contract truth in the AgentSmith contract flow.
- Runner code must not define Context Store scopes, Files/file-library behavior, managed credential resolution, execution ticket issuance, or permission semantics.
- Runner code may only consume the formal AgentSmith runner contract artifact package for product semantics.
- After publication, runner code may consume that artifact package through a registry/package dependency. Pre-GA local runtime fast requires an explicit artifact package supplied by the caller; it is not ordinary npm install, sibling source, or a local dependency protocol.
- Builtin skills runtime may only implement projection consumption and local execution. It must not add permission or credential resolution semantics.
- Do not import AgentSmith product source or use sibling repo source paths as a runtime dependency.
- Do not copy implementation assets from adjacent family control-plane repos.
- AFSCP and ASBCP are bootstrap discipline references only, not dependencies.
- Do not use mutable tags as release proof; future release adoption must be digest-pinned and provenance-backed.
- Do not store secrets, credentials, tokens, private keys, or placeholder secrets in this repo.

## Local Workspace Handoff

For local handoff in this workspace, `/home/percy/works/mbos-v1/agentsmith-runner` is the bootstrap checkout beside AgentSmith. This is only a workspace convention and must not become a runtime dependency or source path dependency. CI and release provenance must be based only on `github.com/agentsmith-project/agentsmith-runner`.

## Quick Verification

The current quick check validates governance skeleton and boundary claims only:

```bash
bash scripts/verify-release.sh --quick
```

Quick mode is not release readiness. The full repo-local release gate is a future authority and is not implemented in this stage.

## P5.3b Runtime Fast Gate

The focused runtime fast gate is the local positive entrypoint for runner source and builtin skills:

```bash
bash scripts/test-runner-runtime-fast.sh
```

It runs the repo-local source boundary guard, TypeScript checking, Vitest runner unit tests, and builtin skill Python unit tests. Runtime fast gate is not release readiness. It is intentionally narrow: it does not build or publish an image, prove backend-real behavior, or update AgentSmith adoption state.

Pre-GA runtime fast requires local dev dependencies plus an explicit `@mbos/agent-runner-contract` artifact package input. It is not ordinary npm install from a public registry, sibling source, or a file/link/workspace local protocol.

## P5 Runner Image Smoke

The focused image smoke is:

```bash
bash scripts/verify-release.sh --image-smoke --artifact-root <dir>
```

The artifact root must contain `runner-contract-artifact.json` and the tgz named by that descriptor. The smoke first runs `--contract-consumer`, then builds a temporary Docker context, injects the explicit contract tgz into the image build, runs a no-push local image with `--network=none`, and expects missing `MBOS_AGENT_WS_URL`/`MBOS_AGENT_KEY` to fail fast with `Usage`.

Image smoke is not release readiness. It is no GHCR publish, no registry login, no release manifest, no AgentSmith adoption, no lock update, and no release-ready claim. It proves only that a clean local image can build from the explicit contract artifact and start far enough to reject missing required runner env.

## P5.1/P5.3a/P5.3b Start Guard

The start guard is CI-safe startup coverage for source-boundary, contract consumer skeleton, and runner release manifest skeleton:

```bash
bash scripts/verify-release.sh --start-guard
```

This runs quick governance, shell syntax checks, source-boundary validation, Node checker syntax checks, `bash scripts/test-runner-contract-consumer.sh`, and `bash scripts/test-runner-release-manifest.sh`. The contract and manifest self-tests use only local temporary fixtures and do not require an external artifact root or manifest artifact.

Start guard is not release readiness. It intentionally excludes the runtime fast gate and image smoke, and it does not replace full release mode, image evidence, runtime evidence, AgentSmith adoption evidence, or an AgentSmith lock update.

## P5.3a Runner Release Manifest Skeleton

P5.3a adds an explicit runner release manifest skeleton checker:

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

The manifest path must point to a JSON file. The manifest must use `agentsmith.runner-release-manifest/v1`, runner `agentsmith-runner`, image logical id `agentsmith-runner`, a 40-character lowercase `git_sha`, semver `runner_contract_version`, exact `supported_protocol_versions` of `["1.0"]`, a digest-pinned GHCR image reference, P5.2 contract package references (`package_uri`, `package_sha256`, `package_integrity`, and `descriptor_subject_sha256`), CI artifact provenance from `github.com/agentsmith-project/agentsmith-runner`, and a fail-fast adoption policy.

The checker also validates `artifact_provenance.subject_sha256` by hashing the manifest without `artifact_provenance`, requires skeleton `artifact_provenance.artifact_sha256` to equal that subject hash, rejects unknown or legacy fields, rejects local paths or credential-like values, and requires `contract_artifact.package_uri` to be a P5.2 canonical remote CI artifact URI for a `.tgz` package. In P5.3a, `artifact_sha256` is the manifest subject hash only; it is not remote artifact download proof.

This skeleton is not an image build, not runtime evidence, not AgentSmith adoption, not an AgentSmith lock update, and not release readiness. AgentSmith should consume a future provenance-backed manifest plus lock state, not local runner source.

## P5.0 Contract Consumer Skeleton

P5.0 adds an explicit runner contract artifact consumer diagnostic:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

The artifact root must contain external descriptor `runner-contract-artifact.json` and the tgz named by that descriptor. The external descriptor remains the release truth for descriptor schema, CI artifact provenance, artifact URI binding, sha256, npm SRI integrity, and subject hash. The tgz must carry package manifest v1 at `package/contract-artifact.json`: `agentsmith.runner-contract-package-manifest/v1`, `runner_contract_package_manifest`, package identity, entrypoints, and `release_provenance` pointing back to `runner-contract-artifact.json`.

The consumer rejects legacy `local_pack_manifest`, descriptor and URI drift, digest drift, local or non-empty dependencies, source/test files in the tgz, verifies installability from the tgz, and runs a small import smoke for `@mbos/agent-runner-contract`.

This mode is intentionally not release readiness. It does not migrate runtime code, build a runner image, publish anything, update an AgentSmith lock, read sibling source trees, or allow local dependency protocols.

## Handoff

When team members enter this repo, first claim non-overlapping workstreams before implementation starts:

- `docs`: README, AGENTS, DEVELOPMENT, ADR, readiness evidence, risk register.
- `contracts`: consumer contract docs, conformance fixture plan, version compatibility notes.
- `runbooks`: local runner operation, image build/run handoff, release operator notes.
- `CI gate`: quick governance guard, future release gate design, workflow hardening.
- `implementation`: runner process, skills runtime, runner image, conformance tests.

All workstreams are bound by this README, [AGENTS.md](AGENTS.md), [DEVELOPMENT.md](DEVELOPMENT.md), and [docs/RELEASE_GATES.md](docs/RELEASE_GATES.md). Quick gate, runtime fast gate, and image smoke success only open repo-local focused work; they do not approve release, adoption, or AgentSmith lock updates.
