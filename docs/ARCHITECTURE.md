# HOOMA — Architecture Reference

Status: **REFERENCE POINTER — NOT AN INDEPENDENT ARCHITECTURE AUTHORITY**

The authoritative repository/domain architecture is maintained in root [`structure.md`](../structure.md).

This file previously duplicated architecture rules and became stale relative to the current HOOMA source. It must not grow back into a second architecture contract.

For architecture work, read in this order:

1. root `AGENTS.md` for mandatory execution rules;
2. root `requirements.md` for product behavior;
3. root `structure.md` for current architecture/domain ownership;
4. `docs/DECISIONS.md` for architectural decisions;
5. `docs/CANONICAL_MODEL.md` for canonical data and authority;
6. current source/database/runtime for evidence of current implementation state.

Key permanent rule: HOOMA uses clean owning domains and one-way dependencies. Do not create cross-domain monolithic scripts, services, repositories, contract files, frontend clients/stores, controllers, or catch-all modules. Cross-domain workflows are composed through explicit application/orchestration boundaries while each domain keeps its own business and persistence authority.

When architecture changes, update `structure.md` and the affected decision/canonical documents in the same task. Do not copy the updated prose back into this file.
