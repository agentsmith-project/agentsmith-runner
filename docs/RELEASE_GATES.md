# Release Gates

Current phase: bootstrap-only/docs-governance-first.

## Quick Mode

```bash
bash scripts/verify-release.sh --quick
```

Quick mode validates only the bootstrap governance skeleton and boundary guardrails:

- Canonical repo identity.
- Owner/team metadata.
- Required governance files.
- Scope and non-goals.
- Runner-specific fail-fast guard.
- Contract-consumer/source-boundary guard.
- Release gate entrypoint exists.
- Quick mode explicitly remains separate from release readiness.
- No sibling repo source dependency.
- No AgentSmith runner runtime/source migration.
- No local-protocol contract consumption.
- No non-contract `@mbos` package consumption.
- No adjacent family repo dependency or copied governance implementation.
- No raw secret placeholders.
- No mutable or tag-only release claim.
- No retired runner repo canonical claim.

Quick mode is not release readiness. Quick mode must not be described as a release gate, production approval, image adoption proof, or AgentSmith lock approval.

## Full Release Gate

The future full release gate will be the repo-local authority for this runner repository:

```bash
bash scripts/verify-release.sh
```

During bootstrap, full release mode is intentionally not implemented and must fail closed. It will become authoritative only after this repo contains its own runtime checks, contract conformance tests, image build checks, provenance checks, release evidence validation, and adoption manifest checks.

## P5.0 Contract Consumer Mode

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

This explicit mode is a focused consumer skeleton for a supplied runner contract artifact root. It checks external descriptor `runner-contract-artifact.json`, CI artifact provenance, `@mbos/agent-runner-contract` package identity, artifact URI binding, sha256, npm SRI integrity, the package manifest v1 inside the tgz, tgz installability, and minimal positive and negative contract guard behavior. It rejects legacy `local_pack_manifest`.

Contract consumer mode is not release readiness. It does not replace quick mode, full release mode, image evidence, adoption evidence, or AgentSmith product readiness. It must not read sibling source trees or consume local dependency protocols.

## P5.1 Start Guard

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, `node --check scripts/check-runner-contract-consumer.mjs`, and `bash scripts/test-runner-contract-consumer.sh`. It is intended for CI startup coverage of the consumer skeleton and uses only local temporary fixtures. It must not require an external artifact root.

Start guard is not release readiness. It does not replace full release mode, external artifact validation, image evidence, runtime evidence, adoption evidence, or AgentSmith product readiness.

## Non-Gates

- Bootstrap quick mode is not release readiness.
- P5.0 contract consumer mode is not release readiness.
- P5.1 start guard is not release readiness.
- Passing CI quick mode is not release readiness.
- Team signoff is not release readiness.
- A local image tag is not release readiness.
- Local, dev, or backend-real diagnostics are not release proof.
- A mutable tag is not release readiness.
- AgentSmith product readiness is not owned by this repo.
- Runner image adoption by AgentSmith cannot happen from this repo without a future digest-pinned release manifest and AgentSmith lock update.
