# ADR 0001: Bootstrap Boundary

Status: Accepted for bootstrap

Date: 2026-05-23

## Context

AgentSmith is splitting the runner implementation into a sibling repository so the runner execution process, builtin skills runtime, runner image, runner CI, and conformance tests can evolve behind a clear engineering boundary.

The split must not move AgentSmith product truth. Agent task API, Agent Runners API, Context Store, Files/file library, managed credentials, audit/usage, frontend management surface, and runner contract source of truth remain outside this repository.

Adjacent family repos are useful historical references for bootstrap discipline. They are not dependencies for this repository.

## Decision

Create this repository as a bootstrap-only/docs-governance-first skeleton.

The repository will include:

- README, AGENTS, and DEVELOPMENT boundary docs.
- Release gate documentation.
- Contract and runbook placeholders.
- ADR, readiness evidence, and risk register.
- Pull request template.
- CI workflow that runs the quick governance guard.
- Bash quick guard with no package dependencies.

At bootstrap creation, the repository did not include runtime code, Dockerfile, copied contracts, copied gates, image publication, release readiness claims, or AgentSmith adoption lock changes.

ADR 0001 is the historical record of the bootstrap boundary. Current P5 focused runner work allows repo-local runtime source and a no-push Dockerfile/image smoke, but still does not allow image publish, release manifest generation, AgentSmith adoption, release readiness claims, or AgentSmith product semantics to move into this repo.

Local handoff uses `/home/percy/works/mbos-v1/agentsmith-runner` as a checkout beside AgentSmith. That path is a workspace convention only; no runtime behavior, scripts, CI, release evidence, or source path dependency may rely on it. Release provenance remains the canonical GitHub repository.

## Consequences

- Team members can enter with a shared boundary and claim non-overlapping workstreams.
- Quick mode can catch boundary drift early.
- Quick mode cannot approve release readiness.
- Full release authority remains future work and must be implemented repo-locally before any runner image release or AgentSmith adoption claim.
