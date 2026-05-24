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
- No legacy runner repo canonical claim.

Quick mode is not release readiness. Quick mode must not be described as a release gate, production approval, image adoption proof, or AgentSmith lock approval.

## Full Release Gate

The future full release gate will be the repo-local authority for this runner repository:

```bash
bash scripts/verify-release.sh
```

During bootstrap, full release mode is intentionally not implemented and must fail closed. It will become authoritative only after this repo contains its own runtime checks, contract conformance tests, image build checks, provenance checks, release evidence validation, and adoption manifest checks.

## Non-Gates

- Bootstrap quick mode is not release readiness.
- Passing CI quick mode is not release readiness.
- Team signoff is not release readiness.
- A local image tag is not release readiness.
- Local, dev, or backend-real diagnostics are not release proof.
- A mutable tag is not release readiness.
- AgentSmith product readiness is not owned by this repo.
- Runner image adoption by AgentSmith cannot happen from this repo without a future digest-pinned release manifest and AgentSmith lock update.
