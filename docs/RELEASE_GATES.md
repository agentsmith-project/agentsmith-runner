# Release Gates

Current phase: GA runner handoff work, with repo-local runner runtime source, builtin skills, focused fast checks, a no-push image build/start smoke, manual digest-pinned GHCR publish evidence, runner release manifest generation, and runner-side GA handoff evidence.

## Quick Mode

```bash
bash scripts/verify-release.sh --quick
```

Quick mode validates only the governance skeleton and boundary guardrails:

- Canonical repo identity.
- Owner/team metadata.
- Required governance files.
- Scope and non-goals.
- Runner-specific fail-fast guard.
- Contract-consumer/source-boundary guard.
- Release gate entrypoint exists.
- Quick mode explicitly remains separate from release readiness.
- No sibling repo source dependency.
- No local-protocol contract consumption.
- No non-contract `@mbos` package consumption.
- No adjacent family repo dependency or copied governance implementation.
- No raw secret placeholders.
- No mutable or tag-only release claim.
- No retired runner repo canonical claim.

Quick mode is not release readiness. Quick mode must not be described as a release gate, production approval, image adoption proof, runtime readiness proof, or AgentSmith lock approval.

## Default Full Mode

Default full mode is intentionally fail-closed during GA handoff:

```bash
bash scripts/verify-release.sh
```

The runner repo now emits runner-side GA evidence through the verified runner release manifest and `runner-ga-handoff-report.json`. Default full mode must still fail closed because formal release readiness is not issued here: AgentSmith owns lock adoption and release contract runner digest adoption, and release-kit owns the final GA verdict. A broader repo-local runner release gate can be introduced only after it replaces old ambiguity without adding a third formal GA verdict.

## P5.3b Runtime Fast Gate

```bash
bash scripts/test-runner-runtime-fast.sh
```

This focused gate is the positive local entrypoint for runner runtime source and builtin skills. It runs `scripts/check-runner-source-boundary.mjs`, TypeScript checking, runner Vitest unit tests, and builtin skill Python unit tests.

Runtime fast gate is not release readiness. It does not build or publish a runner image, validate backend-real behavior, prove contract conformance beyond local unit coverage, update an AgentSmith lock, or replace the default fail-closed full mode.

## P5.0 Contract Consumer Mode

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

This explicit mode is a focused consumer skeleton for a supplied runner contract artifact root. It checks external descriptor `runner-contract-artifact.json`, CI artifact provenance, `@mbos/agent-runner-contract` package identity, artifact URI binding, sha256, npm SRI integrity, the package manifest v1 inside the tgz, tgz installability, and minimal positive and negative contract guard behavior. It rejects legacy `local_pack_manifest`.

Contract consumer mode is not release readiness. It does not replace quick mode, full release mode, image evidence, adoption evidence, or AgentSmith product readiness. It must not read sibling source trees or consume local dependency protocols.

## P5 Runner Image Smoke Mode

```bash
bash scripts/verify-release.sh --image-smoke --artifact-root <artifact-root>
```

This explicit mode is a focused no-push image build/start smoke for a supplied runner contract artifact root. It first runs `--contract-consumer --artifact-root <artifact-root>`, parses `runner-contract-artifact.json` for the tgz filename, copies repo source and the tgz into a temporary Docker context, builds `dist/index.js` inside the image, checks pinned Codex CLI, `python3`, packaged builtin skills under `/etc/codex/skills`, and `mbos-context` projection reading, then runs the image with `--network=none` and no `MBOS_AGENT_WS_URL`/`MBOS_AGENT_KEY`. The expected final runtime result is exit code 1 with `Usage` on stderr.

Default push/PR CI must not run image smoke, checkout AgentSmith, install/build AgentSmith dependencies, or generate a runner contract artifact root from AgentSmith source. Manual focused image smoke is available through `.github/workflows/runner-image-smoke.yml` with `workflow_dispatch`; it downloads `agentsmith-runner-contract-artifact` by `agentsmith_contract_run_id` and runs `--contract-consumer` plus no-push `--image-smoke` against `artifacts/runner-contract`.

Image smoke is not release readiness. It does not publish an image, log in to a registry, push to GHCR, generate a release manifest, produce provenance, update AgentSmith adoption, update an AgentSmith lock, or replace the default fail-closed full mode.

## P5 Image Task-Execution Smoke Mode

```bash
bash scripts/verify-release.sh --image-task-execution-smoke --artifact-root <artifact-root>
```

This explicit mode is a manual, focused no-push image task-execution smoke for a supplied runner contract artifact root. It validates the artifact root, builds a local image, and drives one fake-Codex task through a local WebSocket harness. The harness checks task HOME/workspace/artifacts env, projected dependency reading through the seeded `mbos-context` skill CLI, runner/control env scrubbing, Codex CLI argv sentinel leakage, local response frames, and request-scoped sentinel plus obvious credential path leakage under task HOME. Operator steps live in [runbooks/README.md](runbooks/README.md#p5-image-task-execution-smoke).

Image task-execution smoke is not release readiness. It does not call AgentSmith, issue a real ticket, call a real LLM, publish an image, produce provenance, update AgentSmith adoption, update an AgentSmith lock, or replace the default fail-closed full mode.

## P5 Locked-Image Task-Execution Smoke Mode

```bash
bash scripts/verify-release.sh --locked-image-task-execution-smoke --artifact-root <artifact-root> --image <digest-pinned-ghcr-image-ref>
```

This explicit mode is a manual, focused task-execution smoke for an already published runner image ref. The image ref must be canonical and digest-pinned: `ghcr.io/agentsmith-project/agentsmith-runner:<safe-tag>@sha256:<64hex>`. The wrapper rejects tag-only refs, `latest`, local images, old repos, and non-lowercase digest refs before Docker execution. It validates the supplied artifact root, skips the local image build, and drives the same fake-Codex local WebSocket harness against the supplied image.

Locked-image task-execution smoke is not backend-real, not a real LLM run, not a registry login, not a publish step, not release manifest generation, not AgentSmith adoption, and not release readiness. Do not wire it into default push/PR CI.

## P5 Runner Image Publish Focused Evidence

Manual publish is available only through `.github/workflows/runner-image-publish.yml` with `workflow_dispatch`.

The workflow downloads AgentSmith artifact `agentsmith-runner-contract-artifact` from repository `agentsmith-project/agentsmith` using the supplied run id, runs:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root artifacts/runner-contract
bash scripts/verify-release.sh --image-smoke --artifact-root artifacts/runner-contract
```

It then pushes only `ghcr.io/agentsmith-project/agentsmith-runner`, using safe non-`latest` tags `release-<release_id>` and `sha-<git-sha-12>`, resolves a `sha256:<64>` image digest, runs:

```bash
bash scripts/verify-release.sh --locked-image-task-execution-smoke --artifact-root artifacts/runner-contract --image "$RUNNER_RELEASE_REF@$RUNNER_IMAGE_DIGEST"
```

It then generates `artifacts/runner-release/runner-release-manifest.json`, verifies it with `bash scripts/verify-release.sh --release-manifest --manifest ...`, and uploads artifact `runner-release-manifest`.

This locked smoke proves only that the resolved digest-pinned image can run the fake-Codex safety harness. The workflow remains focused publish evidence only, with a runner GA handoff report for downstream aggregation. It is not release readiness, not AgentSmith adoption, not an AgentSmith lock update, not an AgentSmith repo change, and not a release contract runner digest change.

## Runner GA Handoff Mode

```bash
bash scripts/verify-release.sh --ga-handoff --manifest <manifest-path> --output-dir <dir>
```

This explicit mode validates the supplied runner release manifest, writes `<dir>/runner-ga-handoff-report.json`, and cross-checks the report projection against that manifest before returning success. The report uses schema `agentsmith.runner-ga-handoff-report/v1`, status `pass`, the raw manifest sha256, the digest-pinned runner image, the contract artifact binding, and runner manifest provenance.

To validate downloaded artifacts without regenerating the report, pass the manifest when it is available:

```bash
bash scripts/verify-release.sh --ga-handoff-report --report <runner-ga-handoff-report.json> --manifest <manifest-path>
```

Runner GA handoff does not issue formal_verdict, does not update AgentSmith locks, does not modify the release contract, and does not replace AgentSmith product readiness or the release-kit final GA verdict. It is the runner-side handoff artifact that downstream GA aggregation can cite after AgentSmith adopts the manifest and lock.

## P5.3a Runner Release Manifest Skeleton Mode

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

This explicit mode validates only the runner release manifest machine shape. The manifest must use `agentsmith.runner-release-manifest/v1`, contain only the allowed top-level fields, use runner `agentsmith-runner`, bind `git_sha` to a 40-character lowercase commit, keep `runner_contract_version` semver, and keep `supported_protocol_versions` exactly `["1.0"]`.

The image field must use logical id `agentsmith-runner` and a digest-pinned GHCR reference for `ghcr.io/agentsmith-project/agentsmith-runner`; tag-only references fail. The `contract_artifact` field must carry P5.2 contract package references: `package_uri`, `package_sha256`, `package_integrity`, and `descriptor_subject_sha256`. The `package_uri` must be a canonical remote CI artifact URI for a `.tgz` package under `gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/<positive-run-id>/`. The `artifact_provenance` field must be CI artifact provenance for `github.com/agentsmith-project/agentsmith-runner`, subject `runner-release-manifest`, subject URI `runner-release-manifest.json`, and must pass subject hash validation over the manifest with `artifact_provenance` excluded. In P5.3a, `artifact_provenance.artifact_sha256` must equal `subject_sha256`; this is the skeleton manifest subject hash, not remote artifact download proof. Workflow, job, generator command, and generator version are required as non-empty strings only. The `adoption_policy` field must require fail-fast adoption, lock update, and release contract adoption.

Release manifest skeleton mode is not release readiness. It does not build a runner image, publish a GHCR image, prove runtime behavior, prove AgentSmith adoption, update an AgentSmith lock, or replace the default fail-closed full mode.

`scripts/write-runner-release-manifest.mjs` is the focused generator for the same manifest shape. It accepts a formal contract artifact root plus a safe GHCR image tag ref without digest and a resolved digest, then writes the manifest artifact JSON. It is covered by `bash scripts/test-runner-release-manifest.sh`.

## P5.1 Start Guard

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, source-boundary validation, `node --check` for the source-boundary, contract consumer, release manifest, and handoff report checkers, `bash scripts/test-runner-contract-consumer.sh`, `bash scripts/test-runner-release-manifest.sh`, and `bash scripts/test-runner-ga-handoff-report.sh`. It is intended for CI startup coverage of local skeleton checks. Contract, manifest, and handoff report self-tests use only local temporary fixtures and must not require an external artifact root or manifest artifact. Coverage for image task-execution smoke is syntax-only (`bash -n` and `node --check`); it does not run `--image-task-execution-smoke`, build Docker images, or produce image/runtime evidence.

Start guard is not release readiness. It intentionally excludes runtime fast checks and manual image smoke modes, and it does not replace full release mode, external artifact validation, image evidence, runtime evidence, adoption evidence, AgentSmith product readiness, or an AgentSmith lock update.

## Non-Gates

- Bootstrap quick mode is not release readiness.
- P5.3b runtime fast gate is not release readiness.
- P5.0 contract consumer mode is not release readiness.
- P5 runner image smoke is not release readiness.
- P5 image task-execution smoke is not release readiness.
- P5 locked-image task-execution smoke is not release readiness.
- P5 runner image publish focused evidence is not release readiness.
- Runner GA handoff is not a formal verdict.
- P5.3a release manifest skeleton mode is not release readiness.
- P5.1 start guard is not release readiness.
- Passing CI quick mode is not release readiness.
- Team signoff is not release readiness.
- A local image tag is not release readiness.
- Local, dev, or backend-real diagnostics are not release proof.
- A mutable tag is not release readiness.
- AgentSmith product readiness is not owned by this repo.
- Runner image adoption by AgentSmith cannot happen from runner source or local diagnostics; it requires the runner release manifest, runner GA handoff evidence, and AgentSmith lock state.
