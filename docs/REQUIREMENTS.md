# HOOMA — Requirements Reference

Status: **REFERENCE POINTER — NOT AN INDEPENDENT PRODUCT REQUIREMENTS AUTHORITY**

The authoritative product behavior and acceptance contract is root [`requirements.md`](../requirements.md).

This file previously duplicated product requirements and became stale relative to the current HOOMA source and newer product-owner decisions. It must not grow back into a second product contract.

For product work:

1. read the latest explicit product-owner instruction;
2. read root `requirements.md`;
3. read root `structure.md` for architecture/domain ownership;
4. read `docs/DECISIONS.md` and the relevant dedicated ADRs;
5. read `docs/CANONICAL_MODEL.md` for canonical data/authority;
6. inspect current source/database/runtime before editing.

When product behavior changes, update root `requirements.md` in that same task. When architecture or canonical data ownership changes with it, update the corresponding authoritative documents too.

Do not copy the requirement text back into this file. Keeping one product requirements authority prevents stale instructions from silently overriding the current app state.
