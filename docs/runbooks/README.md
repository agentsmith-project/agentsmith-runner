# Runbooks

This directory holds focused operator and developer runbook notes for the runner repo.

Current status: P5 focused runner work. Runtime fast checks, a focused no-push image smoke, a manual image smoke workflow that consumes an explicit artifact, and a manual focused GHCR publish evidence workflow are available, but no runner image deploy, release, or adoption runbook is authoritative yet.

## P5.3b Runtime Fast Diagnostic

Use this as the focused local runtime and builtin skills entrypoint:

```bash
bash scripts/test-runner-runtime-fast.sh
```

The command runs the source-boundary guard, TypeScript checking, runner unit tests, and builtin skill unit tests. It must finish with `runner runtime fast checks passed`.

Do not use this as an image build, GHCR publish step, backend-real proof, AgentSmith adoption step, or reason to update locks. Runtime fast gate is not release readiness.

Pre-GA, install runtime fast dependencies from an explicit runner contract artifact package. A plain `npm install` is not sufficient while `@mbos/agent-runner-contract` is unpublished.

## P5 Runner Image Smoke

Use this only when a formal runner contract artifact root has been supplied:

```bash
bash scripts/verify-release.sh --image-smoke --artifact-root <artifact-root>
```

The command first validates the artifact root with `--contract-consumer`, builds a temporary Docker context, injects the descriptor-referenced tgz into the Docker build, builds `dist/index.js` inside the image, checks pinned Codex CLI, `python3`, packaged builtin skills under `/etc/codex/skills`, and `mbos-context` projection reading, then runs the image without `MBOS_AGENT_WS_URL`/`MBOS_AGENT_KEY`. It must finish with `image smoke passed`.

The CI-hosted focused diagnostic is `.github/workflows/runner-image-smoke.yml`. Run it manually with `agentsmith_contract_run_id`; it downloads `agentsmith-runner-contract-artifact` from AgentSmith into `artifacts/runner-contract`, then runs the same contract consumer and no-push image smoke commands. Default push/PR CI does not run image smoke and must not build the contract artifact from AgentSmith source.

Image smoke is not release readiness. Do not use it as a release gate, GHCR publish step, registry login step, release manifest generator, AgentSmith adoption step, lock update reason, or backend-real proof. It does not publish anything.

## P5 Image Task-Execution Smoke

Use this only when a formal runner contract artifact root has been supplied and local runner Node dependencies are installed:

```bash
bash scripts/verify-release.sh --image-task-execution-smoke --artifact-root <artifact-root>
```

The command first validates the artifact root with `--contract-consumer`, builds a local no-push image, starts the real `/app/dist/index.js` process in Docker, connects it to a local WebSocket harness, runs fake Codex from the formal `managedTaskRun` fixture, validates task HOME/workspace/artifacts env and projected dependency env, expects `agent.ready`, `agent.response.delta`, `agent.response.artifact`, and `agent.response.done`, checks that `agent.response.done` has no local token usage field, and scans task HOME for request-scoped sentinel leakage. It must finish with `image task-execution smoke passed`.

Manual only during P5. Do not wire smoke execution into CI, and do not use it as backend-real proof, a real LLM run, a GHCR publish step, AgentSmith adoption, a lock update reason, or release readiness.

## P5.0 Contract Consumer Diagnostic

Use this only when a formal runner contract artifact root has been supplied:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

The command validates external descriptor shape, CI artifact provenance, tgz digest and npm SRI integrity, then validates package manifest v1 inside the tgz, installs the tgz in a temporary npm consumer workspace, and runs import smokes. It must finish with `contract consumer skeleton passed` and `not release readiness`.

Do not use this as a release gate, image publish step, AgentSmith adoption step, or reason to update locks. The command consumes only the artifact root and must not read sibling source trees.

## P5.3a Runner Release Manifest Skeleton Diagnostic

Use this only when a runner release manifest JSON file has been supplied for shape validation:

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

The command validates schema v1, runner identity, commit and semver formats, exact protocol support, digest-pinned GHCR image reference, P5.2 contract package references, CI artifact provenance, subject hash, skeleton `artifact_sha256` equal to `subject_sha256`, and fail-fast adoption policy. It must finish with `runner release manifest skeleton check passed` and `not release readiness`.

Do not use this as an image build, GHCR publish step, runtime evidence, AgentSmith adoption step, or reason to update locks. The command validates only the supplied JSON and must not read sibling source trees.

## P5 Runner Image Publish Focused Evidence

Use `.github/workflows/runner-image-publish.yml` only through GitHub Actions `workflow_dispatch`.

Inputs:

- `agentsmith_contract_run_id`: required positive AgentSmith workflow run id that produced `agentsmith-runner-contract-artifact`.
- `release_id`: optional safe id; if empty, the workflow uses `runner-${GITHUB_RUN_ID}`.

The workflow validates the formal contract artifact, runs no-push image smoke, pushes only `ghcr.io/agentsmith-project/agentsmith-runner` with safe non-`latest` tags, resolves the pushed digest, generates and verifies `artifacts/runner-release/runner-release-manifest.json`, and uploads artifact `runner-release-manifest`.

This is focused publish evidence only. Do not use it as release readiness, AgentSmith adoption, an AgentSmith lock update, an AgentSmith repo change, or a release contract runner digest change.

## P5.1/P5.3a/P5.3b Start Guard

Use this for CI startup coverage of the local skeleton checks:

```bash
bash scripts/verify-release.sh --start-guard
```

The command runs quick governance, shell syntax checks, source-boundary validation, `node --check` for Node checkers, the local consumer self-test, and the local manifest self-test. Contract and manifest checks use generated temporary fixtures only and do not require a supplied artifact root or manifest artifact. Coverage for image task-execution smoke is syntax-only (`bash -n`/`node --check`); start guard does not run that smoke.

Start guard is not release readiness. It intentionally excludes runtime fast checks and manual image smoke execution. Do not use it as a release gate, image publish step, AgentSmith adoption step, or reason to update locks.

## Future Runbook Areas

- Local runner development setup.
- Runner image deploy and release handoff.
- Builtin skills runtime diagnostics beyond the fast unit gate.
- Contract conformance execution.
- Release evidence generation.
- AgentSmith adoption handoff.

Every future runbook must preserve the repo boundary:

- AgentSmith owns product readiness and product contracts.
- This repo owns runner execution implementation and runner image release evidence after the full gate exists.
- Quick mode is not release readiness.

## P5 Runtime Handoff Checklist

Before a P5 runtime worker starts implementation:

- `bash scripts/verify-release.sh --quick` passes, including the contract-consumer/source-boundary guard.
- `bash scripts/test-runner-runtime-fast.sh` passes for repo-local source and builtin skills.
- The published `@mbos/agent-runner-contract` artifact is consumable, including required fixtures, package manifest v1, and external provenance descriptor metadata.
- Future AgentSmith adoption consumes provenance-backed manifest plus lock state, not local source.
- Runtime work consumes the contract artifact only; it must not use sibling AgentSmith source paths, local dependency protocols, copied package sources, or removed old runner source.
- Runtime work does not migrate AgentSmith product semantics into this repo. Product semantics remain in AgentSmith and the published contract artifact.
- Local, dev, and backend-real diagnostics may help focused debugging, but they are not release proof and must not replace the future full release gate.
