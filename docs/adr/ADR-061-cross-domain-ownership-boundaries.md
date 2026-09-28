# ADR-061 — Cross-domain ownership boundaries

Status: **ACCEPTED**

Date: 2026-09-28

## Context

HOOMA already contains good cross-domain patterns such as narrow readers, authorizers, and access ports. It also still contains incremental legacy cases where a consumer depends on an entire foreign service/repository, plus at least one separately tracked direct foreign persistence write. Without a permanent rule, future work can deepen those dependencies or replace them with a generic cross-domain abstraction.

This decision defines the target architecture only. Migration of the known broad dependencies is intentionally handled in later bounded packets rather than by a big-bang refactor.

## Decision

**PORTS FOR ASKING. ORCHESTRATORS FOR COORDINATING. DOMAINS FOR OWNING.**

1. Every durable product concept has exactly one canonical owning domain.
2. The owning domain owns its business rules, lifecycle, domain authorization, canonical state, repositories, and persistence mutations.
3. When one domain needs a narrow fact or authority from another, the consumer depends on the narrowest practical explicit application boundary: reader, authorizer, resolver, publisher, or capability port.
4. A consumer must not inject another domain's complete service when one narrow capability is sufficient.
5. A consumer must not inject another domain's repository when only application-level information or authority is required.
6. A domain must not import another domain's infrastructure repository.
7. A domain must not directly mutate another domain's canonical persistence. A foreign key or reference does not transfer ownership.
8. Multi-domain write workflows use explicit application orchestration.
9. An orchestrator coordinates owning domains; it does not own their persistence, duplicate their rules, or become an `EverythingService`.
10. Shared packages may provide genuinely shared technical or value primitives, but they do not become hidden business owners.
11. Prefer consumer-specific narrow boundaries over universal cross-domain interfaces or gateways.
12. Before adding a cross-domain dependency, identify the consumer, canonical owner, exact capability, whether the need is read/authorization/write, port vs. orchestrator, persistence owner, and transaction requirement.
13. If ownership cannot be stated clearly, stop rather than coding through the ambiguity.

Concrete implementations may be wired in the composition root. This decision does not prohibit a bootstrap/container from constructing a consumer with an owning domain's concrete adapter.

## Transactions

Transaction requirements do not justify transferring ownership.

If a workflow must remain atomic, use a domain-owned transaction-capable operation or explicit orchestration that coordinates the owning domains while keeping each canonical mutation under its owner. Do not solve atomicity by introducing a universal repository or by letting a consumer write foreign persistence directly.

## Rejected alternatives

- `EverythingService` or equivalent cross-domain service monolith;
- a universal cross-domain repository;
- a giant generic gateway exposing whole domains;
- consumer imports of foreign infrastructure implementations;
- consumer writes to foreign canonical persistence;
- shared packages becoming de facto business owners.

## Incremental migration

Known broad application dependencies remain buildable while they are replaced in bounded follow-up packets. The architecture check introduced with this decision guards the mechanically reliable boundary now: application/domain code may not import another domain's infrastructure. It intentionally does not reject all existing application-to-application dependencies before their dedicated migrations land.

## Explicitly unresolved

This ADR does not resolve whether transaction-local direct `AuditLog` persistence is an approved infrastructure exception or must always flow through the Audit application's `AuditWriter`. Existing governing sources establish Audit as the owner of sensitive-operation history but do not yet establish that transaction-boundary exception. AuditLog ownership remains unchanged and must be resolved separately from evidence before mutation.

## Consequences

- Cross-domain reads and authorization become explicit and capability-specific.
- Canonical writes remain with owning domains.
- Multi-domain workflows remain explicit without creating a second business owner.
- The composition root remains free to wire concrete implementations.
- Existing broad dependencies can be migrated one bounded consumer at a time without breaking the current codebase solely for adopting this rule.
