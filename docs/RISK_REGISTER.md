# Risk Register

Current phase: bootstrap-only/docs-governance-first.

| ID | Risk | Status | Mitigation |
| --- | --- | --- | --- |
| R-001 | Bootstrap quick mode is mistaken for release readiness. | Open | RELEASE_GATES states quick mode is not release readiness; quick guard checks the wording. |
| R-002 | Runtime, Dockerfile, or contracts are moved before boundary acceptance. | Open | Bootstrap docs prohibit migration; quick guard checks for source path and dependency drift. |
| R-003 | Runner repo starts defining AgentSmith product semantics. | Open | README, AGENTS, and DEVELOPMENT list non-goals and contract consumer posture. |
| R-004 | Adjacent family repo references become implementation dependencies. | Open | ADR marks them as non-dependency references; quick guard blocks dependency patterns. |
| R-005 | Secret placeholders or raw credentials enter bootstrap docs. | Open | Quick guard scans for common raw secret placeholder patterns. |
| R-006 | Mutable image tags or tag-only claims become release proof. | Open | RELEASE_GATES blocks mutable and tag-only release claims; future releases must be digest-pinned. |
| R-007 | Retired runner repository becomes a second canonical truth. | Open | Quick guard rejects retired runner canonical claims; canonical repo identity is fixed here. |
