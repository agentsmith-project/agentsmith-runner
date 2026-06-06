# Development

This repository is intentionally narrow during GA handoff. The current goal is to keep runner runtime source, builtin skills, dev/fast checks, focused no-push image build/start smoke, manual digest-pinned GHCR publish evidence, runner release manifest, and runner-side GA handoff evidence repo-local while keeping AgentSmith adoption locks, product semantics, product readiness, and the final GA verdict out of scope.

## Current Phase

GA handoff runner work: runner runtime source and builtin skills have a repo-local fast gate, the runner image has a focused build/start smoke, default push/PR CI runs only quick/start guards, manual GHCR publish produces digest-pinned evidence, and the runner GA handoff report projects that evidence for AgentSmith adoption and release-kit final aggregation.

Allowed now:

- Governance docs.
- Scope and non-goal docs.
- Contract and runbook placeholders.
- ADR for the bootstrap boundary.
- Quick governance guard.
- Default CI workflow that runs the quick guard and start guard.
- P5.0 explicit runner contract artifact consumer skeleton.
- P5.1 start guard that runs local contract-consumer startup checks without an external artifact root.
- P5.3a runner release manifest skeleton checker and local manifest self-test.
- P5 runner release manifest generator and focused generator self-test coverage.
- Root package, TypeScript, and Vitest config for runner runtime fast checks.
- Runner runtime source under `src/`.
- Builtin skills under `builtin-skills/`.
- P5.3b runtime fast gate.
- Dockerfile plus focused image smoke that consumes an explicit runner contract artifact root.
- Manual `workflow_dispatch` image smoke workflow that downloads the formal AgentSmith runner contract artifact and runs no-push image smoke.
- Manual `workflow_dispatch` GHCR publish workflow that produces digest-pinned image evidence and uploads `runner-release-manifest`.
- Runner GA handoff report generation from a verified runner release manifest.

Not allowed now:

- Docker image publish outside `.github/workflows/runner-image-publish.yml`.
- Registry login or GHCR push outside the focused publish workflow.
- Release manifest generation from image smoke.
- Default push/PR CI checkout of AgentSmith, AgentSmith dependency install/build, or runner contract artifact generation from AgentSmith source.
- Default push/PR CI image smoke execution.
- `latest`, old GHCR aliases, or tag-only image evidence.
- AgentSmith adoption lock updates.
- AgentSmith repo changes or release contract runner digest changes.
- Formal release readiness claims or final GA verdict claims.
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

Child process env guard: Codex and terminal children must use the shared request env sanitizer. Stale runner request/control env is scrubbed from the parent, current request env is injected explicitly, and ambient secret-like parent env is not inherited.

## Commands

Current quick verification:

```bash
bash scripts/verify-release.sh --quick
```

Quick verification includes the contract-consumer/source-boundary check. It remains a governance guard only, not release readiness.

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

This command requires an explicit artifact root containing `runner-contract-artifact.json` and the referenced tgz. It first runs `--contract-consumer`, then builds a temporary Docker context, injects the contract tgz as a build input, builds a local image with a unique non-`latest` tag, checks pinned Codex CLI, `python3`, packaged builtin skills under `/etc/codex/skills`, and `mbos-context` projection reading, and runs it without `MBOS_AGENT_WS_URL`/`MBOS_AGENT_KEY` to confirm fail-fast `Usage`.

The manual `.github/workflows/runner-image-smoke.yml` workflow is the CI-hosted focused diagnostic for this mode. It is `workflow_dispatch` only, requires `agentsmith_contract_run_id`, downloads `agentsmith-runner-contract-artifact` from `agentsmith-project/agentsmith` into `artifacts/runner-contract`, then runs `--contract-consumer` and `--image-smoke` against that explicit artifact root. Default push/PR CI does not run image smoke and must not produce this artifact from AgentSmith source.

Image smoke is not release readiness. It does not publish to GHCR, log in to a registry, generate a release manifest, update AgentSmith adoption, update locks, or prove backend-real behavior.

P5 image task-execution smoke is a manual focused diagnostic. Use [docs/runbooks/README.md](docs/runbooks/README.md#p5-image-task-execution-smoke) for the command and steps, and [docs/RELEASE_GATES.md](docs/RELEASE_GATES.md) for boundaries; keep it no-push, keep smoke execution out of CI, not backend-real, not a real LLM run, not GHCR publish, not AgentSmith adoption, and not release readiness.

P5 runner release manifest generator:

```bash
node scripts/write-runner-release-manifest.mjs --artifact-root <artifact-root> --image-ref ghcr.io/agentsmith-project/agentsmith-runner:<tag> --image-digest sha256:<64> --release-id <id> --git-sha <40> --workflow-name <name> --job <job> --run-id <positive> --run-attempt <positive> --output <path>
```

The generator reads `runner-contract-artifact.json` from the formal AgentSmith artifact root, writes JSON with a trailing newline, and is fail-fast about unsafe release ids, unsafe image refs, wrong GHCR repos, tag refs that already contain a digest, and digest formats. It generates focused evidence only; it does not build an image, push to GHCR, update AgentSmith locks, or claim release readiness.

P5.3a runner release manifest skeleton diagnostic:

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

This command validates only a supplied `agentsmith.runner-release-manifest/v1` JSON manifest file. It requires image logical id `agentsmith-runner`, a digest-pinned GHCR image reference, exact protocol support of `["1.0"]`, P5.2 contract package references (`package_uri`, `package_sha256`, `package_integrity`, and `descriptor_subject_sha256`), CI artifact provenance from `github.com/agentsmith-project/agentsmith-runner`, subject hash validation over the manifest without `artifact_provenance`, skeleton `artifact_sha256` equal to that subject hash, and fail-fast adoption policy fields. It rejects legacy or unknown fields, local paths, and credential-like strings.

Release manifest skeleton mode is not release readiness. It is not an image build, not runtime evidence, not AgentSmith adoption evidence, and not an AgentSmith lock update.

Runner GA handoff:

```bash
bash scripts/verify-release.sh --ga-handoff --manifest <manifest-path> --output-dir <dir>
```

This command validates the supplied manifest with `--release-manifest`, writes `<dir>/runner-ga-handoff-report.json`, and cross-checks the report projection against that manifest before returning success. The report projects runner release id, git sha, image digest, contract artifact binding, manifest digest, and CI provenance for downstream AgentSmith adoption and release-kit final aggregation. It is not a formal verdict, does not contain `formal_verdict`, does not update AgentSmith locks, and does not replace AgentSmith product readiness or the release-kit final GA verdict.

To validate downloaded artifacts without regenerating the report, pass the manifest when it is available:

```bash
bash scripts/verify-release.sh --ga-handoff-report --report <runner-ga-handoff-report.json> --manifest <manifest-path>
```

Script syntax check:

```bash
bash -n scripts/verify-release.sh
bash -n scripts/check-governance-guard.sh
bash -n scripts/test-runner-runtime-fast.sh
bash -n scripts/test-runner-image-smoke.sh
bash -n scripts/test-runner-image-task-execution-smoke.sh
bash -n scripts/test-runner-contract-consumer.sh
bash -n scripts/test-runner-release-manifest.sh
bash -n scripts/test-runner-ga-handoff-report.sh
node --check scripts/check-runner-source-boundary.mjs
node --check scripts/check-runner-contract-consumer.mjs
node --check scripts/check-runner-release-manifest.mjs
node --check scripts/write-runner-release-manifest.mjs
node --check scripts/write-runner-ga-handoff-report.mjs
node --check scripts/check-runner-ga-handoff-report.mjs
node --check scripts/runner-task-execution-smoke.mjs
```

P5.1 start guard:

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, source-boundary validation, consumer/manifest/handoff report Node syntax checks, and the local consumer, manifest, and handoff report self-tests with generated temporary fixtures. The self-tests do not require an external artifact root or manifest artifact. Coverage for image task-execution smoke is syntax-only (`bash -n`/`node --check`); start guard does not run `--image-task-execution-smoke`.

Start guard is not release readiness. It intentionally excludes runtime fast checks and manual image smoke execution. Runtime fast checks require repo-local Node dependencies, and image smoke execution requires Docker plus an explicit contract artifact root; neither may introduce generated lockfiles or local dependency protocols. The P5.0 consumer diagnostic uses Node and npm only inside a temporary consumer workspace where needed.

## Local Workspace Handoff

The local checkout at `/home/percy/works/mbos-v1/agentsmith-runner` is a workspace convention for handoff beside AgentSmith. Do not use that path, or any sibling checkout path, as a runtime dependency or source path dependency. CI and release work must rely on the canonical `github.com/agentsmith-project/agentsmith-runner` provenance.

## Release Posture

Quick verification proves only that the governance surface is intact. Runtime fast checks prove only repo-local type/unit and builtin skill fast behavior. Image smoke proves only a clean local image build/start fail-fast path with an explicit contract artifact. None of these prove image release quality, backend-real behavior, AgentSmith adoption, or release readiness.

Image task-execution smoke adds one fake-Codex runner process and WebSocket path through the built image. It is still focused evidence only and does not prove backend-real behavior, AgentSmith adoption, or release readiness.

The manual GHCR publish workflow proves runner-side publish evidence: a digest-pinned `ghcr.io/agentsmith-project/agentsmith-runner` image, uploaded `runner-release-manifest` artifact, and uploaded `runner-ga-handoff` artifact. It does not update AgentSmith, change an adoption lock, change release contract runner digest, issue a formal verdict, or replace the release-kit final GA verdict.

Local diagnostics, dev diagnostics, and backend-real diagnostics can become focused evidence later, but they are not release proof for this repository.

The full release gate is a future repo-local authority. Until it exists, no change in this repo may claim that a runner image is releasable, adopted by AgentSmith, or ready for production.

The P5.3a manifest skeleton fixes the future machine shape only. It does not publish a GHCR image, prove backend-real runtime behavior, or make AgentSmith consume the runner.
