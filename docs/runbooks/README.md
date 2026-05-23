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
