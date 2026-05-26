# Summary

## Boundary Check

- [ ] This change stays within `agentsmith-runner`.
- [ ] This change does not move AgentSmith product truth.
- [ ] This change does not copy AgentSmith product truth or adjacent family implementation assets.
- [ ] This change consumes only the published runner contract package and does not use sibling source paths.
- [ ] This change does not add secrets, tokens, private keys, credentials, or placeholder secret values.
- [ ] This change does not claim release readiness from quick mode.
- [ ] This change does not claim release readiness, image evidence, AgentSmith adoption, or lock update from the release manifest skeleton.
- [ ] This change does not treat image smoke as release readiness, GHCR publish, release manifest generation, or AgentSmith adoption.
- [ ] If this change touches image smoke, evidence includes `bash scripts/verify-release.sh --image-smoke --artifact-root <dir>`.

## Workstream

Claimed workstream:

- [ ] docs
- [ ] contracts
- [ ] runbooks
- [ ] CI gate
- [ ] implementation

## Verification

```bash
bash scripts/verify-release.sh --quick
bash scripts/verify-release.sh --start-guard
bash scripts/verify-release.sh --image-smoke --artifact-root <dir>
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

Start guard is not release readiness; use it only as focused startup evidence. Image smoke is not release readiness, GHCR publish, release manifest generation, or AgentSmith adoption. Release manifest skeleton mode is also not release readiness; use it only when a manifest JSON file is supplied for shape checking.
