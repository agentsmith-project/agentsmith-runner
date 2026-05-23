# Contracts

This directory is the future home for runner contract consumer notes and conformance test documentation.

The AgentSmith runner contract is not authored in this bootstrap repository. This repo consumes the contract produced by the AgentSmith shared contract flow and validates runner behavior against it.

## Bootstrap Boundary

Allowed now:

- Document which contract artifacts this repo expects to consume in the future.
- Document conformance test categories.
- Document fail-closed compatibility expectations.

Not allowed now:

- Defining a new runner contract source of truth.
- Copying AgentSmith contract source.
- Copying contract assets from adjacent family repos.
- Treating AsyncAPI, Markdown, local fixtures, or implementation code here as a second contract authority.

## Future Conformance Areas

- Protocol version compatibility.
- Invalid JSON handling.
- Unsupported protocol version handling.
- Required execution context fields.
- Request-scoped environment projection.
- Forbidden credential persistence.
- Terminal and artifact frame behavior.
- Builtin skills runtime behavior.
