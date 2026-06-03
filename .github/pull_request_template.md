# Summary

## Boundary Check

- [ ] This change stays within `agentsmith-runner`.
- [ ] This change does not move AgentSmith product truth.
- [ ] This change does not copy AgentSmith product truth or adjacent family implementation assets.
- [ ] This change consumes only the published runner contract package and does not use sibling source paths.
- [ ] This change does not add secrets, tokens, private keys, credentials, or placeholder secret values.
- [ ] This change does not claim release readiness from quick mode.
- [ ] This change does not claim release readiness, image evidence, AgentSmith adoption, or lock update from the release manifest skeleton.
- [ ] This change does not treat runner GA handoff as a formal verdict, AgentSmith adoption, or lock update.
- [ ] This change does not treat image smoke as release readiness, GHCR publish, release manifest generation, or AgentSmith adoption.
- [ ] If this change touches focused publish, it uses only `.github/workflows/runner-image-publish.yml`, does not create `latest` or old GHCR aliases, and does not update AgentSmith locks or release contract runner digest.
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
bash scripts/verify-release.sh --ga-handoff --manifest <manifest-path> --output-dir <dir>
bash scripts/test-runner-release-manifest.sh
```

Start guard is not release readiness; use it only as focused startup evidence. Image smoke is not release readiness, GHCR publish, release manifest generation, or AgentSmith adoption. Focused publish evidence is not release readiness, AgentSmith adoption, an AgentSmith lock update, or a release contract runner digest change. Release manifest skeleton mode is also not release readiness; use it only when a manifest JSON file is supplied for shape checking. Runner GA handoff is not a formal verdict.
