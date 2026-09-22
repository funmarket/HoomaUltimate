# ADR-060 — Requests taxonomy root and the single Request photo capability

**Status:** accepted

**Context.** Requests shipped sport-first: the create flow began at a sport, so a need that has nothing to do with a sport had no canonical way to be expressed, and the only taxonomy entry point was `sport → subcategory → need`. At the same time surfaces needed a Request photo, and the guidance was explicit that no second taxonomy engine and no second media pipeline may be introduced.

**Decision.**

1. Requests carry one canonical root, `HelpRequest.requestType`, of type `HelpRequestType = SPORT | COMMUNITY`. The root is chosen in the create flow before any taxonomy selection and is persisted on the Request.
2. A `SPORT` Request keeps the sport-first path: `sport → HelpTaxonomySubcategory → HelpTaxonomyNeed`. A `COMMUNITY` Request selects directly from the community groups and needs of the same shared taxonomy and requires no sport at all.
3. Taxonomy rows stay in the single existing engine (`HelpTaxonomyGroup` / `HelpTaxonomySubcategory` / `HelpTaxonomyNeed`, surface-scoped). Subcategories carry `requestType` so a group only ever offers the branch that matches the chosen root. Requests reference leaves by id (`subcategoryId`, `needId`); they do not copy taxonomy text.
4. Free text is allowed only where the selected need sets `allowsCustomText`; that text is stored as `HelpRequest.customNeed`. The user-entered Request `title` remains first class regardless of taxonomy.
5. One photo capability: a Request may carry either a requester-supplied `imageUrl` or one server-stored uploaded image. The uploaded image is written through the canonical `ObjectStorage` port, kept under a private `imageObjectKey` that is never serialized, with `imageContentType` and `imageSizeBytes` recorded for delivery. `hasUploadedImage` tells a surface which of the two paths applies, and the uploaded bytes are served by the canonical Requests image route rather than by a new media subsystem.
6. `HelpRequest.fullAddress` is an optional address on the Request, projected only to the requester. Public and member list surfaces continue to expose the existing coarse location fields.
7. Projections do not duplicate Requests: Play, Athletes and community surfaces read the same Request rows through the existing projection rule.

**Reason.** Community-only needs are a first-class product requirement and must not be modelled by inventing a synthetic sport or a parallel taxonomy. Likewise a photo is one capability with two sources, not a new storage stack.

**Consequences.**

- `requestType` is nullable in the database for Requests written before the root existed; every new write selects a root explicitly.
- The taxonomy response is root-discriminated (`sports` and `community`), so a caller cannot silently read a sport branch for a community Request.
- Adding a need kind or a community group is taxonomy data work only — no Request schema change.
- Removing the obsolete category-only Request path is a separate, explicitly gated cleanup (see the plan's removal slice).
