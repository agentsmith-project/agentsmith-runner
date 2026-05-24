# Runbooks

This directory will hold operator and developer runbooks after the bootstrap boundary is accepted.

Current status: placeholder only. No runner image build, deploy, publish, or adoption runbook is authoritative yet.

## Future Runbook Areas

- Local runner development setup.
- Runner image build and smoke.
- Builtin skills runtime diagnostics.
- Contract conformance execution.
- Release evidence generation.
- AgentSmith adoption handoff.

Every future runbook must preserve the repo boundary:

- AgentSmith owns product readiness and product contracts.
- This repo owns runner execution implementation and runner image release evidence after the full gate exists.
- Quick mode is not release readiness.

## P5 Runtime Handoff Checklist

Before a P5 runtime worker starts implementation:

- `bash scripts/verify-release.sh --quick` passes, including the contract-consumer/source-boundary guard.
- The published `@mbos/agent-runner-contract` artifact is consumable, including required fixtures and provenance metadata.
- Runtime work consumes the contract artifact only; it must not use sibling AgentSmith source paths, local dependency protocols, copied package sources, or legacy runner code.
- Runtime work does not migrate AgentSmith product semantics into this repo. Product semantics remain in AgentSmith and the published contract artifact.
- Local, dev, and backend-real diagnostics may help focused debugging, but they are not release proof and must not replace the future full release gate.
