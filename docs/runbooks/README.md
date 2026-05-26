# Runbooks

This directory will hold operator and developer runbooks after the bootstrap boundary is accepted.

Current status: placeholder only. No runner image build, deploy, publish, or adoption runbook is authoritative yet.

## P5.0 Contract Consumer Diagnostic

Use this only when a formal runner contract artifact root has been supplied:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

The command validates external descriptor shape, CI artifact provenance, tgz digest and npm SRI integrity, then validates package manifest v1 inside the tgz, installs the tgz in a temporary npm consumer workspace, and runs import smokes. It must finish with `contract consumer skeleton passed` and `not release readiness`.

Do not use this as a release gate, image publish step, AgentSmith adoption step, or reason to update locks. The command consumes only the artifact root and must not read sibling source trees.

## P5.3a Runner Release Manifest Skeleton Diagnostic

Use this only when a runner release manifest JSON file has been supplied for shape validation:

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

The command validates schema v1, runner identity, commit and semver formats, exact protocol support, digest-pinned GHCR image reference, P5.2 contract package references, CI artifact provenance, subject hash, skeleton `artifact_sha256` equal to `subject_sha256`, and fail-fast adoption policy. It must finish with `runner release manifest skeleton check passed` and `not release readiness`.

Do not use this as an image build, GHCR publish step, runtime evidence, AgentSmith adoption step, or reason to update locks. The command validates only the supplied JSON and must not read sibling source trees.

## P5.1/P5.3a Start Guard

Use this for CI startup coverage of the local skeleton checks:

```bash
bash scripts/verify-release.sh --start-guard
```

The command runs quick governance, shell syntax checks, `node --check` for both checkers, the local consumer self-test, and the local manifest self-test. It uses generated temporary fixtures only and does not require a supplied artifact root or manifest artifact.

Start guard is not release readiness. Do not use it as a release gate, image publish step, AgentSmith adoption step, or reason to update locks.

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
- The published `@mbos/agent-runner-contract` artifact is consumable, including required fixtures, package manifest v1, and external provenance descriptor metadata.
- Future AgentSmith adoption consumes provenance-backed manifest plus lock state, not local source.
- Runtime work consumes the contract artifact only; it must not use sibling AgentSmith source paths, local dependency protocols, copied package sources, or removed old runner source.
- Runtime work does not migrate AgentSmith product semantics into this repo. Product semantics remain in AgentSmith and the published contract artifact.
- Local, dev, and backend-real diagnostics may help focused debugging, but they are not release proof and must not replace the future full release gate.
