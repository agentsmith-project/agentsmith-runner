# Readiness Evidence

Current phase: P5 focused runner work.

## Bootstrap Evidence

| Evidence | Status | Source |
| --- | --- | --- |
| Canonical repo identity documented | present | README, AGENTS |
| Scope and non-goals documented | present | README, AGENTS, DEVELOPMENT |
| Quick governance guard present | present | scripts/check-governance-guard.sh |
| Contract-consumer/source-boundary guard present | present | scripts/check-governance-guard.sh |
| P5.0 contract artifact consumer skeleton | focused diagnostic | scripts/check-runner-contract-consumer.mjs |
| Runner contract consumer self-test | focused diagnostic | scripts/test-runner-contract-consumer.sh |
| P5.3a runner release manifest skeleton checker | focused diagnostic | scripts/check-runner-release-manifest.mjs |
| P5 runner release manifest generator | focused diagnostic | scripts/write-runner-release-manifest.mjs |
| Runner release manifest self-test | focused diagnostic | scripts/test-runner-release-manifest.sh |
| P5.3b runner runtime source | present | src/ |
| P5.3b builtin skills | present | builtin-skills/ |
| P5.3b runtime fast gate | focused diagnostic | scripts/test-runner-runtime-fast.sh |
| P5.3b source boundary guard | focused diagnostic | scripts/check-runner-source-boundary.mjs |
| P5 runner Dockerfile | present | Dockerfile |
| P5 runner image smoke | focused diagnostic | scripts/verify-release.sh --image-smoke --artifact-root <artifact-root> |
| Manual runner image smoke workflow | explicit artifact diagnostic | .github/workflows/runner-image-smoke.yml |
| P5 image task-execution smoke | focused diagnostic | scripts/verify-release.sh --image-task-execution-smoke --artifact-root <artifact-root> |
| P5 runner image publish workflow | focused publish evidence | .github/workflows/runner-image-publish.yml |
| P5.1 start guard | focused diagnostic | scripts/verify-release.sh --start-guard |
| Quick verify entrypoint present | present | scripts/verify-release.sh |
| CI quick guard present | present | .github/workflows/ci.yml |
| CI runner start guard present | present | .github/workflows/ci.yml |
| Default CI image smoke | not present | image smoke is manual explicit artifact diagnostic |
| Full release gate | not implemented | docs/RELEASE_GATES.md |
| Runtime behavior evidence | focused only | scripts/test-runner-runtime-fast.sh |
| Runner image evidence | focused only | scripts/verify-release.sh --image-smoke --artifact-root <artifact-root> |
| Contract conformance evidence | not implemented | future contracts and CI gate workstreams |
| Runner release manifest artifact | focused publish evidence only | runner-image-publish workflow artifact `runner-release-manifest` |
| Local, dev, or backend-real diagnostics as release proof | rejected | docs/RELEASE_GATES.md |

## Current Verdict

No release readiness is claimed in bootstrap.

The quick governance check is:

```bash
bash scripts/verify-release.sh --quick
```

It validates governance skeleton and boundary guardrails only.

The quick guard can reject invalid contract consumption and source-boundary drift, but it does not prove contract compatibility, runtime behavior, image release quality, or production readiness.

## P5.3b Focused Evidence

The runtime fast gate is:

```bash
bash scripts/test-runner-runtime-fast.sh
```

Expected success output includes `runner runtime fast checks passed`.

This evidence proves only that the repo-local runner source passes TypeScript and focused unit tests, and that builtin skill unit tests pass. It is not Docker image evidence, backend-real runtime evidence, AgentSmith adoption evidence, an AgentSmith lock update, or release readiness.

Runtime fast gate is not release readiness. Pre-GA, it also requires an explicitly supplied contract artifact package because `@mbos/agent-runner-contract` is not published to npm yet.

## P5 Image Smoke Focused Evidence

The focused image smoke is:

```bash
bash scripts/verify-release.sh --image-smoke --artifact-root <artifact-root>
```

Expected success output includes `image smoke passed` and `Image smoke is not release readiness`.

This evidence proves only that a supplied contract artifact root passes the contract consumer diagnostic, a temporary Docker build context can inject the referenced tgz, the image can build `dist/index.js` without local ignored `dist/`, the image contains pinned Codex CLI, `python3`, and packaged builtin skills under `/etc/codex/skills`, `mbos-context` can read a mock projected dependency from `MBOS_AGENT_PROJECTED_DEPENDENCIES`, and the container exits with `Usage` when required runner env is missing.

Default push/PR CI does not run image smoke and does not checkout AgentSmith or generate the contract artifact root from source. Manual CI-hosted image smoke lives in `.github/workflows/runner-image-smoke.yml`: it requires `agentsmith_contract_run_id`, downloads `agentsmith-runner-contract-artifact` into `artifacts/runner-contract`, and runs contract consumer validation plus no-push image smoke against that explicit artifact root.

Image smoke is not release readiness. It is not GHCR publish evidence, not registry login evidence, not release manifest generation, not provenance-backed release evidence, not backend-real runtime evidence, not AgentSmith adoption evidence, and not an AgentSmith lock update.

## P5 Image Task-Execution Smoke Focused Evidence

The focused image task-execution smoke is a manual diagnostic; the command and operator steps live in [runbooks/README.md](runbooks/README.md#p5-image-task-execution-smoke), and its release boundary lives in [RELEASE_GATES.md](RELEASE_GATES.md).

Its evidence claim is limited to one local fake-Codex task through a no-push image. It is not backend-real runtime evidence, a real LLM run, GHCR publish evidence, AgentSmith adoption evidence, an AgentSmith lock update, or release readiness.

## P5 Publish Focused Evidence

Manual publish evidence is produced only by `.github/workflows/runner-image-publish.yml` through `workflow_dispatch`.

The workflow downloads the formal AgentSmith artifact `agentsmith-runner-contract-artifact`, runs contract consumer validation, runs no-push image smoke, pushes `ghcr.io/agentsmith-project/agentsmith-runner` without a `latest` tag or old alias, resolves the pushed digest, writes `artifacts/runner-release/runner-release-manifest.json`, verifies it with:

```bash
bash scripts/verify-release.sh --release-manifest --manifest artifacts/runner-release/runner-release-manifest.json
```

It uploads artifact `runner-release-manifest`. This is focused publish evidence only: digest-pinned GHCR image plus manifest artifact. It is not release readiness, not AgentSmith adoption evidence, not an AgentSmith lock update, not an AgentSmith repo change, and not a release contract runner digest change.

## P5.0 Focused Evidence

The explicit consumer command is:

```bash
bash scripts/verify-release.sh --contract-consumer --artifact-root <artifact-root>
```

Expected success output includes `contract consumer skeleton passed` and `not release readiness`.

This evidence proves only that a supplied artifact root is well formed enough for this repo to consume the tgz and exercise minimal positive and negative contract guards. It is not image evidence, runtime evidence, adoption evidence, or release readiness.

The repo-local consumer self-test is:

```bash
bash scripts/test-runner-contract-consumer.sh
```

It builds temporary fixture artifacts only under a temp directory, covers package manifest v1 acceptance, legacy `local_pack_manifest` rejection, artifact filename and URI drift, digest drift, package dependency rejection, source/test entry rejection, source path leak handling, and other positive and negative consumer cases. It is not run by `bash scripts/verify-release.sh --quick`.

## P5.3a Focused Evidence

The explicit manifest skeleton command is:

```bash
bash scripts/verify-release.sh --release-manifest --manifest <manifest-path>
```

Expected success output includes `runner release manifest skeleton check passed` and `not release readiness`.

This evidence proves only that a supplied manifest file follows the pinned skeleton shape: schema v1, runner identity, image logical id `agentsmith-runner`, commit and semver formats, protocol `["1.0"]`, digest-pinned GHCR image reference, P5.2 contract package references, CI artifact provenance, subject hash validation, skeleton `artifact_sha256` equal to `subject_sha256`, and fail-fast adoption policy. It is not image evidence, runtime evidence, AgentSmith adoption evidence, an AgentSmith lock update, remote artifact download proof, or release readiness.

The repo-local manifest self-test is:

```bash
bash scripts/test-runner-release-manifest.sh
```

It uses temporary JSON fixtures only. It covers the positive skeleton and negative checks for tag-only image references, image digest mismatch, wrong producer repo, commit SHA drift, artifact URI run id drift, missing contract artifact metadata, local package URI, non-numeric package URI run id, package digest and integrity format drift, protocol drift, invalid semver, subject hash drift, artifact hash drift, empty provenance strings, adoption policy drift, secret or local path leakage, and legacy or unknown fields. It is not run by `bash scripts/verify-release.sh --quick`.

The same self-test also exercises `scripts/write-runner-release-manifest.mjs` with a temporary formal descriptor fixture, checks the generated manifest through the checker and `verify-release`, and covers generator rejection for unsafe image refs, wrong GHCR repos, and unsafe release ids.

The P5.1 start guard is:

```bash
bash scripts/verify-release.sh --start-guard
```

Expected success output includes `runner start guard passed` and `Start guard is not release readiness`. It runs quick governance, shell syntax checks, source-boundary validation, consumer and manifest syntax checks, and the local consumer and manifest self-tests without an external artifact root or manifest artifact. Coverage for image task-execution smoke is syntax-only; it checks script/harness syntax and does not run the smoke.

Start guard is not release readiness. It intentionally excludes runtime fast checks and manual image smoke execution.
