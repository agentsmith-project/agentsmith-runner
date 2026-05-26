# Readiness Evidence

Current phase: P5.3b first half.

## Bootstrap Evidence

| Evidence | Status | Source |
| --- | --- | --- |
| Canonical repo identity documented | present | README, AGENTS |
| Scope and non-goals documented | present | README, AGENTS, DEVELOPMENT |
| Quick governance guard present | present | scripts/check-governance-guard.sh |
| Contract-consumer/source-boundary guard present | present | scripts/check-governance-guard.sh |
| P5.0 contract artifact consumer skeleton | focused diagnostic | scripts/check-runner-contract-consumer.mjs |
| Runner contract consumer self-test | focused diagnostic | scripts/test-runner-contract-consumer.sh |
| P5.3a runner release manifest skeleton checker | focused diagnostic | scripts/check-runner-release-manifest.mjs |
| Runner release manifest self-test | focused diagnostic | scripts/test-runner-release-manifest.sh |
| P5.3b runner runtime source | present | src/ |
| P5.3b builtin skills | present | builtin-skills/ |
| P5.3b runtime fast gate | focused diagnostic | scripts/test-runner-runtime-fast.sh |
| P5.3b source boundary guard | focused diagnostic | scripts/check-runner-source-boundary.mjs |
| P5.1 start guard | focused diagnostic | scripts/verify-release.sh --start-guard |
| Quick verify entrypoint present | present | scripts/verify-release.sh |
| CI quick guard present | present | .github/workflows/ci.yml |
| CI runner start guard present | present | .github/workflows/ci.yml |
| Full release gate | not implemented | docs/RELEASE_GATES.md |
| Runtime behavior evidence | focused only | scripts/test-runner-runtime-fast.sh |
| Runner image evidence | not implemented | future implementation workstream |
| Contract conformance evidence | not implemented | future contracts and CI gate workstreams |
| Provenance-backed release manifest artifact | not implemented | future CI gate workstream |
| Local, dev, or backend-real diagnostics as release proof | rejected | docs/RELEASE_GATES.md |

## Current Verdict

No release readiness is claimed in bootstrap.

The quick governance check is:

```bash
bash scripts/verify-release.sh --quick
```

It validates governance skeleton and boundary guardrails only.

The quick guard can reject invalid contract consumption and source-boundary drift, but it does not prove contract compatibility, runtime behavior, image release quality, or production readiness.

## P5.3b Focused Evidence

The runtime fast gate is:

```bash
bash scripts/test-runner-runtime-fast.sh
```

Expected success output includes `runner runtime fast checks passed`.

This evidence proves only that the repo-local runner source passes TypeScript and focused unit tests, and that builtin skill unit tests pass. It is not Docker image evidence, backend-real runtime evidence, AgentSmith adoption evidence, an AgentSmith lock update, or release readiness.

Runtime fast gate is not release readiness. Pre-GA, it also requires an explicitly supplied contract artifact package because `@mbos/agent-runner-contract` is not published to npm yet.

## P5.0 Focused Evidence

The explicit consumer command is:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

Expected success output includes `contract consumer skeleton passed` and `not release readiness`.

This evidence proves only that a supplied artifact root is well formed enough for this repo to consume the tgz and exercise minimal positive and negative contract guards. It is not image evidence, runtime evidence, adoption evidence, or release readiness.

The repo-local consumer self-test is:

```bash
bash scripts/test-runner-contract-consumer.sh
```

It builds temporary fixture artifacts only under a temp directory, covers package manifest v1 acceptance, legacy `local_pack_manifest` rejection, artifact filename and URI drift, digest drift, package dependency rejection, source/test entry rejection, source path leak handling, and other positive and negative consumer cases. It is not run by `bash scripts/verify-release.sh --quick`.

## P5.3a Focused Evidence

The explicit manifest skeleton command is:

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

Expected success output includes `runner release manifest skeleton check passed` and `not release readiness`.

This evidence proves only that a supplied manifest file follows the pinned skeleton shape: schema v1, runner identity, image logical id `agentsmith-runner`, commit and semver formats, protocol `["1.0"]`, digest-pinned GHCR image reference, P5.2 contract package references, CI artifact provenance, subject hash validation, skeleton `artifact_sha256` equal to `subject_sha256`, and fail-fast adoption policy. It is not image evidence, runtime evidence, AgentSmith adoption evidence, an AgentSmith lock update, remote artifact download proof, or release readiness.

The repo-local manifest self-test is:

```bash
bash scripts/test-runner-release-manifest.sh
```

It uses temporary JSON fixtures only. It covers the positive skeleton and negative checks for tag-only image references, image digest mismatch, wrong producer repo, commit SHA drift, artifact URI run id drift, missing contract artifact metadata, local package URI, non-numeric package URI run id, package digest and integrity format drift, protocol drift, invalid semver, subject hash drift, artifact hash drift, empty provenance strings, adoption policy drift, secret or local path leakage, and legacy or unknown fields. It is not run by `bash scripts/verify-release.sh --quick`.

The P5.1 start guard is:

```bash
bash scripts/verify-release.sh --start-guard
```

Expected success output includes `runner start guard passed` and `Start guard is not release readiness`. It runs quick governance, shell syntax checks, source-boundary validation, consumer and manifest syntax checks, and the local consumer and manifest self-tests without an external artifact root or manifest artifact.

Start guard is not release readiness. It intentionally excludes runtime fast checks until clean CI has explicit contract artifact acquisition.
