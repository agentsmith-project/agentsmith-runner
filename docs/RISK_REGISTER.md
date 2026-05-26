# Risk Register

Current phase: P5 focused runner work.

| ID | Risk | Status | Mitigation |
| --- | --- | --- | --- |
| R-001 | Bootstrap quick mode is mistaken for release readiness. | Open | RELEASE_GATES states quick mode is not release readiness; quick guard checks the wording. |
| R-002 | Image publish, product contracts, AgentSmith gates, release readiness claims, or AgentSmith adoption are moved before boundary acceptance. | Open | Dockerfile and focused image smoke are allowed in this slice; docs prohibit publish/readiness/adoption moves, and quick guard checks source path and dependency drift. |
| R-003 | Runner repo starts defining AgentSmith product semantics. | Open | README, AGENTS, and DEVELOPMENT list non-goals and contract consumer posture. |
| R-004 | Adjacent family repo references become implementation dependencies. | Open | ADR marks them as non-dependency references; quick guard blocks dependency patterns. |
| R-005 | Secret placeholders or raw credentials enter bootstrap docs. | Open | Quick guard scans for common raw secret placeholder patterns. |
| R-006 | Mutable image tags or tag-only claims become release proof. | Open | RELEASE_GATES blocks mutable and tag-only release claims; future releases must be digest-pinned. |
| R-007 | Retired runner repository becomes a second canonical truth. | Open | Quick guard rejects retired runner canonical claims; canonical repo identity is fixed here. |
| R-008 | P5.3a release manifest skeleton is mistaken for image build, runtime evidence, AgentSmith adoption, lock update, or release readiness. | Open | RELEASE_GATES, README, DEVELOPMENT, runbooks, and readiness evidence state the manifest checker is a focused skeleton diagnostic only. |
| R-009 | Release manifest adoption semantics drift before GA. | Open | `scripts/check-runner-release-manifest.mjs` rejects unknown or legacy fields, requires digest-pinned image refs, validates CI provenance, and checks subject hash over the manifest without `artifact_provenance`. |
| R-010 | P5.3b runtime fast gate is mistaken for image evidence, backend-real evidence, AgentSmith adoption, or release readiness. | Open | README, DEVELOPMENT, RELEASE_GATES, runbooks, and readiness evidence state the fast gate is focused local evidence only. |
| R-011 | P5 image smoke is mistaken for release readiness, publish evidence, release manifest generation, or AgentSmith adoption. | Open | README, DEVELOPMENT, RELEASE_GATES, contracts docs, runbooks, and readiness evidence state image smoke is focused no-push evidence only. |
