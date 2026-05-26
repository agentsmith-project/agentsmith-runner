# Release Gates

Current phase: P5.3b first half, with repo-local runner runtime source, builtin skills, and focused fast checks.

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

## Full Release Gate

The future full release gate will be the repo-local authority for this runner repository:

```bash
bash scripts/verify-release.sh
```

During bootstrap, full release mode is intentionally not implemented and must fail closed. It will become authoritative only after this repo contains its own runtime checks, contract conformance tests, image build checks, provenance checks, release evidence validation, and adoption manifest checks.

## P5.3b Runtime Fast Gate

```bash
bash scripts/test-runner-runtime-fast.sh
```

This focused gate is the positive local entrypoint for runner runtime source and builtin skills. It runs `scripts/check-runner-source-boundary.mjs`, TypeScript checking, runner Vitest unit tests, and builtin skill Python unit tests.

Runtime fast gate is not release readiness. It does not build or publish a runner image, validate backend-real behavior, prove contract conformance beyond local unit coverage, update an AgentSmith lock, or replace the future full release gate.

## P5.0 Contract Consumer Mode

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

This explicit mode is a focused consumer skeleton for a supplied runner contract artifact root. It checks external descriptor `runner-contract-artifact.json`, CI artifact provenance, `@mbos/agent-runner-contract` package identity, artifact URI binding, sha256, npm SRI integrity, the package manifest v1 inside the tgz, tgz installability, and minimal positive and negative contract guard behavior. It rejects legacy `local_pack_manifest`.

Contract consumer mode is not release readiness. It does not replace quick mode, full release mode, image evidence, adoption evidence, or AgentSmith product readiness. It must not read sibling source trees or consume local dependency protocols.

## P5.3a Runner Release Manifest Skeleton Mode

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

This explicit mode validates only the future runner release manifest machine shape. The manifest must use `agentsmith.runner-release-manifest/v1`, contain only the allowed top-level fields, use runner `agentsmith-runner`, bind `git_sha` to a 40-character lowercase commit, keep `runner_contract_version` semver, and keep `supported_protocol_versions` exactly `["1.0"]`.

The image field must use logical id `agentsmith-runner` and a digest-pinned GHCR reference for `ghcr.io/agentsmith-project/agentsmith-runner`; tag-only references fail. The `contract_artifact` field must carry P5.2 contract package references: `package_uri`, `package_sha256`, `package_integrity`, and `descriptor_subject_sha256`. The `package_uri` must be a canonical remote CI artifact URI for a `.tgz` package under `gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/<positive-run-id>/`. The `artifact_provenance` field must be CI artifact provenance for `github.com/agentsmith-project/agentsmith-runner`, subject `runner-release-manifest`, subject URI `runner-release-manifest.json`, and must pass subject hash validation over the manifest with `artifact_provenance` excluded. In P5.3a, `artifact_provenance.artifact_sha256` must equal `subject_sha256`; this is the skeleton manifest subject hash, not remote artifact download proof. Workflow, job, generator command, and generator version are required as non-empty strings only. The `adoption_policy` field must require fail-fast adoption, lock update, and release contract adoption.

Release manifest skeleton mode is not release readiness. It does not build a runner image, publish a GHCR image, prove runtime behavior, prove AgentSmith adoption, update an AgentSmith lock, or replace the future full release gate.

## P5.1 Start Guard

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, source-boundary validation, `node --check` for the source-boundary, contract consumer, and release manifest checkers, `bash scripts/test-runner-contract-consumer.sh`, and `bash scripts/test-runner-release-manifest.sh`. It is intended for CI startup coverage of local skeleton checks. Contract and manifest self-tests use only local temporary fixtures and must not require an external artifact root or manifest artifact.

Start guard is not release readiness. It intentionally excludes runtime fast checks until clean CI has explicit contract artifact acquisition, and it does not replace full release mode, external artifact validation, image evidence, runtime evidence, adoption evidence, AgentSmith product readiness, or an AgentSmith lock update.

## Non-Gates

- Bootstrap quick mode is not release readiness.
- P5.3b runtime fast gate is not release readiness.
- P5.0 contract consumer mode is not release readiness.
- P5.3a release manifest skeleton mode is not release readiness.
- P5.1 start guard is not release readiness.
- Passing CI quick mode is not release readiness.
- Team signoff is not release readiness.
- A local image tag is not release readiness.
- Local, dev, or backend-real diagnostics are not release proof.
- A mutable tag is not release readiness.
- AgentSmith product readiness is not owned by this repo.
- Runner image adoption by AgentSmith cannot happen from this skeleton; it requires future provenance-backed manifest evidence and AgentSmith lock state.
