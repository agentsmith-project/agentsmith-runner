# Contracts

This directory is the future home for runner contract consumer notes and conformance test documentation.

The AgentSmith runner contract is not authored in this bootstrap repository. This repo consumes the contract produced by the AgentSmith shared contract flow and validates runner behavior against it.

## Contract Authority

Runner contract authority stays outside this repository. This repo must not define protocol schemas, product semantics, compatibility rules, or acceptance truth.

The only allowed future contract dependency is the published package `@mbos/agent-runner-contract`. That package must carry the contract artifacts this repo consumes, including fixtures and provenance metadata. Local dependency protocols such as file, link, or workspace are not valid contract consumption, and sibling AgentSmith source paths are not valid contract consumption.

Until the package is published and consumable from a package registry, this repo remains documentation-only for contracts. Markdown, local examples, copied source, or backend-real diagnostics here cannot stand in for the published contract artifact.

## Bootstrap Boundary

Allowed now:

- Document that this repo expects to consume `@mbos/agent-runner-contract` after publication.
- Document fixture and provenance expectations for the published contract artifact.
- Document conformance test categories.
- Document fail-closed compatibility expectations.

Not allowed now:

- Defining a new runner contract source of truth.
- Copying AgentSmith contract source.
- Copying contract assets from adjacent family repos.
- Treating AsyncAPI, Markdown, local fixtures, or implementation code here as a second contract authority.
- Treating local, dev, or backend-real diagnostics as release proof.

## Future Conformance Areas

- Protocol version compatibility.
- Invalid JSON handling.
- Unsupported protocol version handling.
- Required execution context fields.
- Request-scoped environment projection.
- Forbidden credential persistence.
- Terminal and artifact frame behavior.
- Builtin skills runtime behavior.
