# Contracts

This directory is the future home for runner contract consumer notes and conformance test documentation.

The AgentSmith runner contract is not authored in this bootstrap repository. This repo consumes the contract produced by the AgentSmith shared contract flow and validates runner behavior against it.

## Contract Authority

Runner contract authority stays outside this repository. This repo must not define protocol schemas, product semantics, compatibility rules, or acceptance truth.

The only allowed future contract dependency is the published package `@mbos/agent-runner-contract`. That package must carry the contract artifacts this repo consumes, including fixtures and provenance descriptor linkage. Release provenance metadata remains in the external descriptor supplied with the artifact root. Local dependency protocols such as file, link, or workspace are not valid contract consumption, and sibling AgentSmith source paths are not valid contract consumption.

Until the package is published and consumable from a package registry, this repo remains documentation-only for contracts. Markdown, local examples, copied source, or backend-real diagnostics here cannot stand in for the published contract artifact.

## Bootstrap Boundary

Allowed now:

- Document that this repo expects to consume `@mbos/agent-runner-contract` after publication.
- Document fixture and provenance expectations for the published contract artifact.
- Document conformance test categories.
- Document fail-closed compatibility expectations.
- Run the P5.0 consumer skeleton against an explicit artifact root supplied by the caller.
- Run the P5.1 start guard with local negative fixtures and no external artifact root.

Not allowed now:

- Defining a new runner contract source of truth.
- Copying AgentSmith contract source.
- Copying contract assets from adjacent family repos.
- Treating AsyncAPI, Markdown, local fixtures, or implementation code here as a second contract authority.
- Treating local, dev, or backend-real diagnostics as release proof.

## P5.0 Consumer Skeleton

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

The artifact root is an input boundary. It must contain external descriptor `runner-contract-artifact.json` and the tgz named by the descriptor. The descriptor must identify `@mbos/agent-runner-contract`, use `agentsmith.runner-contract-artifact/v1`, carry CI artifact provenance from `github.com/agentsmith-project/agentsmith`, and bind its URI to `gh-artifact://agentsmith-project/agentsmith/runner-contract-artifact/<run-id>/<filename>`.

Inside the tgz, `package/contract-artifact.json` must be package manifest v1: `agentsmith.runner-contract-package-manifest/v1`, `runner_contract_package_manifest`, package identity, entrypoints, and `release_provenance` pointing to the external descriptor. It is not required to duplicate external release truth such as tgz sha256, integrity, artifact URI, CI provenance, or subject hash.

The consumer checks the tgz hash and npm SRI integrity, rejects legacy `local_pack_manifest`, installs only that tgz in a temporary npm workspace, and runs a smoke that imports the package root, `@mbos/agent-runner-contract/artifact`, and `@mbos/agent-runner-contract/contract-artifact.json`. The smoke verifies positive fixture/spec behavior and negative rejection for unsupported protocol and removed legacy fields.

This skeleton is intentionally not a second contract authority and not release readiness.

## P5.1 Start Guard

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, the consumer syntax check, and the local consumer self-test. The self-test builds only temporary fixtures and covers rejection of legacy descriptor fields, artifact filename escape, artifact URI drift, sha256 drift, npm SRI drift, local or non-empty package dependencies, and source/test files inside the tgz.

Start guard is not release readiness. It is a CI startup guard for the consumer skeleton, not proof of runtime compatibility or image release quality.

## Future Conformance Areas

- Protocol version compatibility.
- Invalid JSON handling.
- Unsupported protocol version handling.
- Required execution context fields.
- Request-scoped environment projection.
- Forbidden credential persistence.
- Terminal and artifact frame behavior.
- Builtin skills runtime behavior.
