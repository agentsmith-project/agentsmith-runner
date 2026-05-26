# Development

This repository is intentionally narrow during P5. The current goal is to make runner runtime source, builtin skills, dev/fast checks, and focused no-push image build/start smoke repo-local while keeping release, adoption, and product semantics out of scope.

## Current Phase

P5 focused runner work: runner runtime source and builtin skills have a repo-local fast gate, and the runner image has a focused build/start smoke.

Allowed now:

- Governance docs.
- Scope and non-goal docs.
- Contract and runbook placeholders.
- ADR for the bootstrap boundary.
- Quick governance guard.
- CI workflow that runs the quick guard.
- P5.0 explicit runner contract artifact consumer skeleton.
- P5.1 start guard that runs local contract-consumer startup checks without an external artifact root.
- P5.3a runner release manifest skeleton checker and local manifest self-test.
- Root package, TypeScript, and Vitest config for runner runtime fast checks.
- Runner runtime source under `src/`.
- Builtin skills under `builtin-skills/`.
- P5.3b runtime fast gate.
- Dockerfile plus focused image smoke that consumes an explicit runner contract artifact root.

Not allowed now:

- Docker image publish.
- Registry login or GHCR push.
- Release manifest generation from image smoke.
- AgentSmith adoption lock updates.
- Release readiness claims.
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

Runner-specific fail-fast guard: this repo must not define Context Store scopes, Files/file-library behavior, managed credential resolution, execution ticket issuance, or permission semantics. It may only consume the formal AgentSmith runner contract artifact package. After publication, consume it through a registry/package dependency. Pre-GA runtime fast must receive an explicit artifact package and must not use ordinary npm install, sibling source, or local dependency protocols. Builtin skills runtime may only implement projection consumption and local execution.

Contract-consumer/source-boundary guard: implementation may reference only the formal `@mbos/agent-runner-contract` artifact package for runner contract semantics. It must not consume the contract through local dependency protocols, sibling AgentSmith source paths, other `@mbos` packages, moved runner packages, or removed old runner source.

## Commands

Current quick verification:

```bash
bash scripts/verify-release.sh --quick
```

Quick verification includes the contract-consumer/source-boundary check. It remains a bootstrap guard only, not release readiness.

P5.3b runtime fast gate:

```bash
bash scripts/test-runner-runtime-fast.sh
```

This is the focused positive entrypoint for repo-local runtime source and builtin skills. It runs source-boundary validation, `npm run typecheck`, `npm run test:fast`, and builtin skill Python unit tests. It is not an image build, not backend-real evidence, not AgentSmith adoption evidence, and not release readiness.

Runtime fast gate is not release readiness. Pre-GA, it requires local dev dependencies plus an explicitly supplied `@mbos/agent-runner-contract` artifact package because that package is not published to npm yet. This pre-GA input is not ordinary npm install, sibling source, or a file/link/workspace local protocol.

P5.0 contract artifact consumer diagnostic:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

This command expects a caller-supplied artifact root containing external descriptor `runner-contract-artifact.json` and the tgz referenced by the descriptor. It validates descriptor release truth, CI artifact provenance, sha256, npm SRI integrity, the package manifest v1 inside the tgz, and a temporary npm install from the tgz before running import and guard smokes. It rejects legacy `local_pack_manifest` and is not release readiness.

P5 runner image smoke:

```bash
bash scripts/verify-release.sh --image-smoke --artifact-root <dir>
```

This command requires an explicit artifact root containing `runner-contract-artifact.json` and the referenced tgz. It first runs `--contract-consumer`, then builds a temporary Docker context, injects the contract tgz as a build input, builds a local image with a unique non-`latest` tag, and runs it without `MBOS_AGENT_WS_URL`/`MBOS_AGENT_KEY` to confirm fail-fast `Usage`.

Image smoke is not release readiness. It does not publish to GHCR, log in to a registry, generate a release manifest, update AgentSmith adoption, update locks, or prove backend-real behavior.

P5.3a runner release manifest skeleton diagnostic:

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

This command validates only a supplied `agentsmith.runner-release-manifest/v1` JSON manifest file. It requires image logical id `agentsmith-runner`, a digest-pinned GHCR image reference, exact protocol support of `["1.0"]`, P5.2 contract package references (`package_uri`, `package_sha256`, `package_integrity`, and `descriptor_subject_sha256`), CI artifact provenance from `github.com/agentsmith-project/agentsmith-runner`, subject hash validation over the manifest without `artifact_provenance`, skeleton `artifact_sha256` equal to that subject hash, and fail-fast adoption policy fields. It rejects legacy or unknown fields, local paths, and credential-like strings.

Release manifest skeleton mode is not release readiness. It is not an image build, not runtime evidence, not AgentSmith adoption evidence, and not an AgentSmith lock update.

Script syntax check:

```bash
bash -n scripts/verify-release.sh
bash -n scripts/check-governance-guard.sh
bash -n scripts/test-runner-runtime-fast.sh
bash -n scripts/test-runner-image-smoke.sh
bash -n scripts/test-runner-contract-consumer.sh
bash -n scripts/test-runner-release-manifest.sh
node --check scripts/check-runner-source-boundary.mjs
node --check scripts/check-runner-contract-consumer.mjs
node --check scripts/check-runner-release-manifest.mjs
```

P5.1 start guard:

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, source-boundary validation, consumer and manifest Node syntax checks, and the local consumer and manifest self-tests with generated temporary fixtures. The consumer and manifest self-tests do not require an external artifact root or manifest artifact.

Start guard is not release readiness. It intentionally excludes runtime fast checks and image smoke. Runtime fast checks require repo-local Node dependencies, and image smoke requires Docker plus an explicit contract artifact root; neither may introduce generated lockfiles or local dependency protocols. The P5.0 consumer diagnostic uses Node and npm only inside a temporary consumer workspace where needed.

## Local Workspace Handoff

The local checkout at `/home/percy/works/mbos-v1/agentsmith-runner` is a workspace convention for handoff beside AgentSmith. Do not use that path, or any sibling checkout path, as a runtime dependency or source path dependency. CI and release work must rely on the canonical `github.com/agentsmith-project/agentsmith-runner` provenance.

## Release Posture

Quick verification proves only that the governance surface is intact. Runtime fast checks prove only repo-local type/unit and builtin skill fast behavior. Image smoke proves only a clean local image build/start fail-fast path with an explicit contract artifact. None of these prove image release quality, backend-real behavior, AgentSmith adoption, or release readiness.

Local diagnostics, dev diagnostics, and backend-real diagnostics can become focused evidence later, but they are not release proof for this repository.

The full release gate is a future repo-local authority. Until it exists, no change in this repo may claim that a runner image is releasable, adopted by AgentSmith, or ready for production.

The P5.3a manifest skeleton fixes the future machine shape only. It does not publish a GHCR image, prove backend-real runtime behavior, or make AgentSmith consume the runner.
