# Readiness Evidence

Current phase: bootstrap-only/docs-governance-first.

## Bootstrap Evidence

| Evidence | Status | Source |
| --- | --- | --- |
| Canonical repo identity documented | present | README, AGENTS |
| Scope and non-goals documented | present | README, AGENTS, DEVELOPMENT |
| Quick governance guard present | present | scripts/check-governance-guard.sh |
| Contract-consumer/source-boundary guard present | present | scripts/check-governance-guard.sh |
| P5.0 contract artifact consumer skeleton | focused diagnostic | scripts/check-runner-contract-consumer.mjs |
| Runner contract consumer self-test | focused diagnostic | scripts/test-runner-contract-consumer.sh |
| P5.1 start guard | focused diagnostic | scripts/verify-release.sh --start-guard |
| Quick verify entrypoint present | present | scripts/verify-release.sh |
| CI quick guard present | present | .github/workflows/ci.yml |
| CI contract consumer start guard present | present | .github/workflows/ci.yml |
| Full release gate | not implemented | docs/RELEASE_GATES.md |
| Runtime behavior evidence | not implemented | future implementation workstream |
| Runner image evidence | not implemented | future implementation workstream |
| Contract conformance evidence | not implemented | future contracts and CI gate workstreams |
| Provenance-backed release manifest | not implemented | future CI gate workstream |
| Local, dev, or backend-real diagnostics as release proof | rejected | docs/RELEASE_GATES.md |

## Current Verdict

No release readiness is claimed in bootstrap.

The only supported check is:

```bash
bash scripts/verify-release.sh --quick
```

It validates governance skeleton and boundary guardrails only.

The quick guard can reject invalid contract consumption before runtime starts, but it does not prove contract compatibility, runtime behavior, image release quality, or production readiness.

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

The P5.1 start guard is:

```bash
bash scripts/verify-release.sh --start-guard
```

Expected success output includes `contract consumer start guard passed` and `Start guard is not release readiness`. It runs quick governance, shell syntax checks, the consumer syntax check, and the local consumer self-test without an external artifact root.

Start guard is not release readiness.
