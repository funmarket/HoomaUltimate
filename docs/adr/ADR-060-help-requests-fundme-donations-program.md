# ADR-060 — Ordered HOOMA Help program: Requests, FundMe and Donations

Status: **ACCEPTED**

Date: 2026-09-24

## Context

HOOMA Help is presented as `Requests | FundMe | Donations`, but the three products have different business truth and lifecycle semantics. Requests already has a canonical `HelpRequest` implementation in draft PR #351; FundMe and Donations currently have Help routes/tabs/placeholders and taxonomy foundation but no durable owning domains. The product owner has explicitly authorized completing Requests and then implementing real FundMe and Donations without collapsing their persistence or mechanics.

Generated design references are authoritative only for the content-area visual direction where they agree with current product rules. Their top/bottom app navigation, fake payment rails, fake HOOMA token fields, unsupported statuses/categories and other generated artifacts are not product authority.

## Decision

Implementation order is strict:

```text
H0 shared Help access extraction
R1-R8 complete canonical Requests
F1-F5 implement FundMe/Fundraising
D1-D5 implement physical-item Donations
H1+ visibility-aware Help overview and later explicitly authorized matching/hardening
```

### Requests

Requests remains the only owner of `HelpRequest`, `HelpRequestResponse` and `HelpRequestImage`. Standalone Requests uses `Sport | Community` with Sport default only when there is no stronger incoming context. Discovery adds real server-side search, taxonomy-driven quick rails and advanced filters before cursor pagination. Cards remain readable on mobile, use `#F7F7F7` for important descriptive copy, support accessible inline expansion, and keep `/requests/:requestId` as the canonical deep-link/full-management route. Play and Athletes projections read the same HelpRequest records; no `PlayRequest` or `AthletesRequest` persistence is permitted.

### FundMe

FundMe is owned by a new/independent Fundraising boundary, not Requests or Payments. Initial support methods are **Cash and Crypto only**. No credit/debit-card rail, Stripe-style checkout, Visa/Mastercard/Amex UI or Telegram-Stars checkout is part of this FundMe program. Cash/Crypto support is manual/confirmed coordination and accounting; only confirmed contributions affect campaign progress.

Crypto destinations must be network-aware and store only public receiving information such as network, token code, wallet address and optional memo/tag. HOOMA never stores private keys, seed phrases or wallet passwords.

Fundraising owns campaign categories, goal/currency, contributions, updates, media and lifecycle. Raised progress is derived from confirmed contributions rather than a drifting editable total. Contribution creation has a persisted idempotency boundary.

### Donations

Donations is owned by an independent Donations boundary and means a physical item offered for free. It mirrors Requests at the discovery/UI level with `Sport | Community`, server-side search, taxonomy/filter rails, readable cards and claim/detail lifecycle, but it never reuses HelpRequest persistence.

Sport Donations reuse canonical sport/product taxonomy. Community Donations use governed physical PRODUCT categories/Needs; non-item Request concepts such as Coach, Advice and Training Partner are not Donation categories. Money support belongs to FundMe. A generic service marketplace is not created.

Donation offers may have up to four ordered photos. Claims are private coordination records with quantity and message. Accepted/fulfilled claims reserve quantity; acceptance is transactional and cannot over-reserve. Exact pickup/full-address data is backend-protected and shown only to authorized parties. Accepted handoffs may still be fulfilled after offer expiry.

### Shared Help boundaries

Only genuinely shared concerns may be reused through narrow interfaces:

- live Community/Team/Athletes publisher and membership facts (`HelpAccessReader`-style boundary);
- Help taxonomy where semantics genuinely overlap;
- canonical Identity presentation readers;
- shared object-storage transport and domain-neutral image processing primitives;
- Outbox/Worker infrastructure;
- visibility-aware summary read ports.

Shared infrastructure does not create shared business persistence.

## Consequences

- Requests must be finished and verified before FundMe/Donations implementation begins.
- Fundraising, Donations and Requests have separate contracts/services/repositories/migrations/frontend modules.
- Help overview is a read model and never a second source of truth.
- Reference-image mistakes never justify unsupported backend behavior.
- Open PR behavior must remain clearly separated from merged `phase-0-foundation` truth.

## Rejected alternatives

- one generic HelpItem/GenericRequest persistence model;
- Donations as HelpRequest subtype;
- FundMe as Request category;
- generic polymorphic `ownerType/ownerId` authority;
- client-only search/filtering after pagination;
- frontend-only authorization/privacy;
- credit/debit-card FundMe flow in this program;
- financial/service Donation categories;
- duplicated sports/category/Identity systems.
