# Contracts

This directory is the future home for runner contract consumer notes and conformance test documentation.

The AgentSmith runner contract is not authored in this bootstrap repository. This repo consumes the contract produced by the AgentSmith shared contract flow and validates runner behavior against it.

## Contract Authority

Runner contract authority stays outside this repository. This repo must not define protocol schemas, product semantics, compatibility rules, or acceptance truth.

The only allowed contract dependency is the formal AgentSmith runner contract artifact package for `@mbos/agent-runner-contract`. After publication, runner code may consume it through a registry/package dependency. That package must carry the contract artifacts this repo consumes, including fixtures and provenance descriptor linkage. Release provenance metadata remains in the external descriptor supplied with the artifact root. Local dependency protocols such as file, link, or workspace are not valid contract consumption, and sibling AgentSmith source paths are not valid contract consumption.

Pre-GA local runtime fast requires an explicit artifact package supplied by the caller. This is not ordinary npm install, not sibling AgentSmith source, and not a file/link/workspace local protocol. Committed dependencies must remain normal package references and must not point at sibling source paths. Markdown, local examples, copied source, or backend-real diagnostics here cannot stand in for the formal contract artifact package.

## Bootstrap Boundary

Allowed now:

- Document that this repo expects to consume `@mbos/agent-runner-contract` after publication through a registry/package dependency.
- Document fixture and provenance expectations for the formal contract artifact package.
- Document conformance test categories.
- Document fail-closed compatibility expectations.
- Run the P5.0 consumer skeleton against an explicit artifact root supplied by the caller.
- Run the P5.1 start guard with local negative fixtures and no external artifact root.
- Run the P5.3a runner release manifest skeleton checker against an explicit manifest supplied by the caller.
- Run the P5.3b runtime fast gate against repo-local runner source and builtin skills.

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

## P5.3a Release Manifest Contract Binding

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

The runner release manifest skeleton does not download or unpack contract artifacts. It checks that `contract_artifact` binds to the P5.2 handoff facts that downstream manifests can reference directly: tgz `package_uri`, tgz `package_sha256`, tgz `package_integrity`, and descriptor `descriptor_subject_sha256`. The package URI must be a P5.2 canonical remote CI artifact URI for a `.tgz` file, not a file path, local protocol, workspace path, or non-numeric run id.

This checker fixes the manifest adoption shape only. It is not a contract source of truth, not a runtime conformance test, not image evidence, not AgentSmith adoption, and not release readiness. AgentSmith should consume a future provenance-backed manifest plus lock state rather than local runner source.

## P5.1 Start Guard

```bash
bash scripts/verify-release.sh --start-guard
```

Start guard runs quick governance, shell syntax checks, source-boundary validation, consumer and manifest syntax checks, and both local skeleton self-tests. The consumer self-test builds only temporary fixtures and covers rejection of legacy descriptor fields, artifact filename escape, artifact URI drift, sha256 drift, npm SRI drift, local or non-empty package dependencies, and source/test files inside the tgz. The manifest self-test uses temporary JSON fixtures and covers image digest pinning, producer repo drift, contract artifact metadata, protocol drift, semver drift, subject hash drift, local path or credential-like leakage, and unknown fields.

Start guard is not release readiness. It intentionally excludes runtime fast checks until clean CI has explicit contract artifact acquisition. It is a CI startup guard for local skeleton checks, not proof of runtime compatibility, image release quality, AgentSmith adoption, or lock update.

## Future Conformance Areas

- Protocol version compatibility.
- Invalid JSON handling.
- Unsupported protocol version handling.
- Required execution context fields.
- Request-scoped environment projection.
- Forbidden credential persistence.
- Terminal and artifact frame behavior.
- Builtin skills runtime behavior.
