# HOOMA Requests | FundMe | Donations Implementation Plan

Status: **ACTIVE ORDERED EXECUTION PROGRAM**  
Last reconciled: **2026-09-24**

This file is the scoped implementation program for HOOMA Help. It must be used together with `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, root `requirements.md`, root `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, ADR-060, and the current repository/database/runtime evidence.

Open-PR behavior is in-flight only. Merged `phase-0-foundation` remains current foundation truth.

## 0. Current verified baseline

At the time of this reconciliation:

- target base: `phase-0-foundation`;
- clean Requests branch: `feat/requests-clean-completion`;
- draft PR: `#351`;
- last verified application-code baseline before documentation-only reconciliation: `9f558264cf2125f178a0cdc5625c623a871f263a`;
- exact-head CI on that application baseline: run `#2361` (`35992814011`) — **SUCCESS**;
- contaminated PRs `#349` and `#350` remain reference-only and are not implementation ancestry;
- PR `#347` is a separate Play -> Requests reference branch and is not safe to merge/cherry-pick wholesale over the clean branch without fresh reconciliation;
- FundMe and Donations have Help navigation/routes/placeholders, but no durable owning backend domains yet;
- canonical Help taxonomy already contains a `DONATIONS` surface that must be extended/reused rather than replaced.

Every new execution session must re-verify these mutable facts before mutation.

## 1. Prime execution rule

Use exactly this loop:

```text
INSPECT CURRENT SOURCE
-> VERIFY FACTS
-> IDENTIFY ONE CURRENT COMMAND
-> INSPECT OWNER/DEPENDENCIES/TESTS
-> PREFLIGHT
-> ONE LOGICAL MUTATION
-> DIFF AUDIT
-> FOCUSED TESTS
-> REQUIRED REGRESSION
-> EXACT-HEAD GATE WHEN APPLICABLE
-> REPORT
-> NEXT AUTHORIZED COMMAND
```

Do not guess, reorder, combine, skip, broaden or substitute slices.

Do not:

- create duplicate domains/tables/services/repositories;
- revive stale/dead branches as ancestry;
- patch UI symptoms over wrong backend/domain behavior;
- introduce frontend-only fake functionality;
- perform unrelated cleanup/refactors;
- create generic `ownerType/ownerId` persistence;
- merge or deploy without explicit authorization and exact-state proof;
- loop on status/CI polling.

## 2. Source-of-truth order

1. latest explicit product-owner instruction;
2. root `requirements.md`;
3. root `structure.md`;
4. `docs/DECISIONS.md` + ADR-060;
5. `docs/CANONICAL_MODEL.md`;
6. current repository/database/runtime as evidence of present state;
7. visual references only for content-area presentation where they do not conflict with the above.

Generated top/bottom app navigation, fake payment rails, fake statuses/categories, HOOMA-token fields or unsupported product mechanics are not authority.

## 3. Product/domain boundaries

### Requests

Meaning: **I need something / I need help.**

Owner: Requests.

Canonical persistence remains:

```text
HelpRequest
HelpRequestResponse
HelpRequestImage
```

### FundMe

Meaning: **I need financial support for a campaign/project/community purpose.**

Owner: Fundraising.

Target persistence:

```text
Fundraiser
FundraiserContribution
FundraiserBudgetItem
FundraiserUpdate
FundraiserMedia
FundraiserCryptoDestination
```

### Donations

Meaning: **I have a physical item to give away for free.**

Owner: Donations.

Target persistence:

```text
DonationOffer
DonationClaim
DonationImage
```

Never merge these domains into a generic HelpItem/GenericRequest model.

## 4. Dependency rule

```text
Frontend
-> frontend API client
-> contracts
-> HTTP route
-> application service
-> narrow ports
-> infrastructure repository
-> Prisma
-> PostgreSQL
```

Identity presentation comes from canonical Identity readers. Media bytes use shared ObjectStorage. Domain services own authorization/metadata; shared storage owns byte transport.

## 5. Shared Help foundation — H0

Before FundMe/Donations implementation, extract only genuinely Help-wide live authority reads currently buried in Request infrastructure.

Target narrow boundary:

```text
HelpAccessReader
  communityRole(...)
  teamResponsibility(...)
  athletesRole(...)
  isCommunityMember(...)
  isAthletesMember(...)
```

H0 requirements:

- zero Request behavior change;
- no schema change;
- no UI change;
- no generic authorization engine;
- Request authorization tests remain green;
- Fundraising/Donations later consume the same live authority facts instead of copying SQL.

## 6. Global Help UI rules

- page background: pitch black / near-black;
- cards: slightly raised black/graphite;
- normal structural outline: `1px solid rgba(190, 180, 145, 0.22)`;
- no thick brown/gold outline;
- no normal-card glow;
- green = active/status/action, not structure;
- gold = restrained HOOMA brand emphasis;
- strongest titles = bright white;
- important descriptive/body text = `#F7F7F7`;
- metadata may be lower-emphasis only if still clearly readable;
- page/major title approximately 23–24px;
- section title approximately 20px;
- card title approximately 17px;
- body/description approximately 16–17px;
- metadata approximately 14px;
- touch targets approximately 48px minimum;
- prefer scrolling over shrinking content;
- quick taxonomy/filter rails may scroll horizontally;
- do not compress feed cards to show many cards above the fold.

## 7. Locked execution order

```text
H0  shared Help access extraction

R1  Requests server-side search
R2  Requests Sport | Community + quick taxonomy + advanced filters
R3  readable Request cards + feed media + accessible expansion
R4  Request create-flow redesign using existing canonical domain
R5  Request detail/response/lifecycle UI completion
R6  Play -> Requests projection
R7  Athletes -> Requests projection
R8  Requests browser/mobile/final gate

F1  FundMe contracts + schema + migrations + repository interfaces
F2  Fundraising service/repository/authority/contribution lifecycle
F3  FundMe routes + search/filter + progress aggregation
F4  FundMe media + featured/admin + Worker/lifecycle behavior
F5  FundMe frontend + browser/mobile gate

D1  Donation taxonomy extension + contracts + schema + migrations
D2  Donation service/repository/routes + concurrency + privacy
D3  Donation plural media + cleanup + signed delivery
D4  Donation frontend + Sport/Community + search/filter + claim lifecycle
D5  Donation browser/mobile/concurrency/final gate

H1  visibility-aware Help overview
H2  Request <-> Donation matching if still explicitly authorized
H3  notifications/moderation/integration hardening
H4  final docs/provenance/exact-head gate
```

Do not start FundMe/Donations before R8 passes.

## 8. Requests — current canonical mechanics to preserve

Request lifecycle:

```text
OPEN
IN_PROGRESS
FULFILLED
CANCELLED
EXPIRED
```

Response lifecycle:

```text
PENDING
ACCEPTED
DECLINED
WITHDRAWN
```

`HelpRequestResponse` is private one-shot coordination, not a public comment/chat thread. One canonical response exists per `(requestId, responderUserId)`. Accepting a response moves an OPEN Request into `IN_PROGRESS`. Managers may fulfill/cancel according to RequestService policy.

Current Request data includes canonical publisher/audience references, Request Type, sport/taxonomy, title/description, optional product fields, city/Houma, private optional `fullAddress`, timing/expiry, status and one optional image.

Public/member Request read DTOs must not expose `fullAddress` under the current policy.

## 9. R1 — Requests real server-side search

Add a bounded query field such as `q` through the full stack:

```text
search input
-> debounce
-> RequestsListQuery
-> URL serialization
-> contract validation
-> RequestService
-> RequestRepository
-> Prisma WHERE
-> cursor pagination
```

Initial search fields:

- title;
- description;
- `customNeed`.

Do not search private full address, response messages or arbitrary profile content.

Search must execute before cursor/take pagination. No client-side filtering of an already-loaded page.

R1 proof includes q validation, title/description/customNeed matches, visibility + q, taxonomy + q, cursor correctness and frontend debounce/reset behavior.

## 10. R2 — Requests discovery controls

Standalone Requests information architecture:

```text
Requests | FundMe | Donations

All Requests | Sport | Community

[ Search requests... ] [ Filters N ]

[ All ][ Football ][ Basketball ][ Tennis ] ...
```

Canonical Request taxonomy roots remain exactly `SPORT | COMMUNITY`. Standalone Requests defaults to All Requests, meaning no `requestType` filter. All Requests is a presentation/query state, not a third taxonomy root. Selecting Sport or Community applies the corresponding canonical taxonomy root; selecting All Requests clears only taxonomy-specific selections.

Sport quick rail derives from canonical taxonomy/sports. Community quick rail derives from canonical Community categories.

Advanced filters:

- Category;
- Specific Need;
- City;
- Houma;
- canonical status.

Parent changes clear invalid descendants. `Filters N` counts active advanced filters only unless the final UI contract explicitly says otherwise.

Empty states:

- no data: `No Requests are listed yet.`
- filtered/search result empty: `No Requests match these filters.`

## 11. R3 — Request cards, media and expansion

Collapsed card may show:

- primary image when available;
- taxonomy/need;
- status;
- title;
- readable `#F7F7F7` description preview;
- city/Houma;
- timing;
- relevant product metadata;
- requester avatar/display name/username;
- expand/navigation affordance.

Do not show every stored field in collapsed state.

### Feed media

Current Request detail has authorized image delivery. Feed media must not cause one eager delivery-metadata call per off-screen card. Prefer a visibility-safe projected primary media URL or viewport-lazy delivery consistent with the current storage architecture.

### Inline card expansion

Displayed Request cards support accessible expansion:

- `aria-expanded`;
- keyboard operation;
- no nested invalid interactive controls;
- requester profile remains independently clickable;
- expanded controls do not retrigger collapse;
- canonical Request data only;
- lazily fetch detail only if expanded content needs fields not in list projection.

`/requests/:requestId` remains the canonical deep-link/full-management route.

## 12. R4 — Request create flow

Do not rebuild Request persistence/API.

Create flow must preserve:

- Request Type;
- taxonomy;
- `Publish as`;
- audience;
- title/description;
- city/Houma;
- optional private `fullAddress`/location note;
- optional Request image;
- timing/expiry;
- conditional quantity/size/condition-preference fields.

SPORT flow is progressive: Sport -> Category -> Need -> Request fields.

COMMUNITY flow is Community Category -> Need -> Request fields.

If launched from Community/Sport or a projection surface, preserve that context. SPORT is only the fallback default.

Do not silently reduce the current Request description contract because a generated mockup shows `0/500`.

If Request creation succeeds but image upload fails, retry media against the created Request; do not create a duplicate Request.

## 13. R5 — Request detail/lifecycle UI

Implement all real states:

- guest detail/sign-in;
- signed-in private response;
- pending response + withdraw;
- accepted response state;
- manager response cards + Accept/Decline;
- IN_PROGRESS + accepted responder;
- Mark Fulfilled;
- Cancel where service permits;
- FULFILLED;
- CANCELLED;
- EXPIRED.

Do not invent public threads or DMs.

Terminal-state presentation must not broaden backend visibility.

## 14. R6 — Play projection

Target tabs:

```text
Games | Players | Requests | Mine
```

Requests pane uses canonical Requests API with `surface=PLAY` and canonical Help taxonomy `surface=PLAY`.

Creation uses `/requests/new?surface=PLAY` and returns to Play.

Reuse canonical Request feed/search/filter/card/detail behavior. Never create Play-owned Request persistence.

PR #347 is reference-only until freshly reconciled; no wholesale merge/cherry-pick.

## 15. R7 — Athletes projection

Add Help Requests as a projection over canonical Requests using `surface=ATHLETES` and `help taxonomy surface=ATHLETES`.

Do not confuse Help Requests with Athletes membership/join requests.

Do not modify Athletes Calendar, Photo Board, Whistle or membership mechanics beyond bounded presentation integration.

## 16. R8 — Requests final gate

Browser/mobile verification at 390/393/412/430 px must cover:

- main Requests;
- search;
- Sport/Community;
- quick rail;
- advanced filters;
- loading/error/empty;
- readable cards;
- images;
- expansion accessibility;
- create flow;
- detail/response lifecycle;
- Play projection;
- Athletes projection;
- pagination and q+filters;
- signed-out behavior;
- authorization/privacy;
- no accidental horizontal overflow outside intended rails.

Only after R8 may FundMe implementation begin.

## 17. FundMe product contract

FundMe is a real Fundraising-owned domain.

Routes target:

```text
/requests/fundme
/requests/fundme/new
/requests/fundme/:fundraiserId
/fundme -> /requests/fundme
```

### Support methods — locked

Only:

```text
CASH
CRYPTO
```

Ignore generated credit/debit-card, Visa/Mastercard/Amex, Stripe and Telegram-Stars checkout concepts.

FundMe does not claim to execute a payment. It records contribution coordination/accounting and authorized confirmation.

## 18. F1 — Fundraising contracts/database

Target `Fundraiser` includes canonical creator/publisher/audience references, optional SPORT/COMMUNITY context, canonical sport where relevant, Fundraising-owned category, title/description, goal minor units, currency code, Cash/Crypto enablement, optional cash instructions, deadline, status, featured metadata and timestamps.

Bounded categories include Equipment/Gear, Infrastructure, Events, Travel and Other. Do not force Fundraising into Request taxonomy.

Lifecycle:

```text
ACTIVE
COMPLETED
CANCELLED
EXPIRED
```

### Crypto destination

`FundraiserCryptoDestination` stores:

- fundraiser id;
- network;
- token code;
- public wallet address;
- optional memo/tag;
- active state.

Never store private key, seed phrase, wallet password or custody secret.

### Contribution

`FundraiserContribution` includes:

- fundraiser;
- supporter where authenticated;
- persisted idempotency key;
- method CASH/CRYPTO;
- campaign-currency minor-unit amount;
- optional Crypto destination/reference/original token amount;
- visibility PUBLIC/ANONYMOUS;
- message;
- lifecycle timestamps/status.

Contribution statuses:

```text
PENDING
CONFIRMED
DECLINED
WITHDRAWN
VOIDED
```

Only CONFIRMED contributions affect progress.

Progress = SQL aggregation of confirmed campaign-currency minor units / goal. Do not maintain a drifting editable raised-total column.

For Crypto, original token amount/reference may be stored, but campaign-currency equivalent must be organizer-confirmed. Do not silently call an FX provider.

## 19. F2-F4 — Fundraising application/API/media

Manager authority uses live publisher facts via shared Help access, never RequestRepository.

Contribution creation is idempotent. Organizer/authorized manager confirms/declines/voids according to audited policy. Supporter may withdraw pending contribution where allowed.

`FundraiserUpdate` is organizer-authored campaign news, not public comments.

Initial media requirement is one primary cover image using Fundraising-owned metadata plus shared ObjectStorage.

Featured state is persisted and Platform Admin-owned. Only ACTIVE campaigns may be featured.

Search is server-side over title/description before pagination. Filters are implemented only when backend query support exists.

## 20. F5 — FundMe frontend

Required surfaces:

- main feed;
- search/categories/filters;
- empty state;
- Start Fundraiser progressive flow;
- goal/deadline;
- Cash/Crypto setup;
- cover media;
- organizer/audience;
- review/publish;
- published success;
- campaign detail;
- confirmed progress;
- supporter list;
- updates;
- Cash contribution record;
- Crypto destination/record flow;
- pending contribution;
- organizer confirmation/decline/void;
- terminal lifecycle states.

Feed cards remain large/readable with cover, category, status, title, `#F7F7F7` description, raised/goal, progress, organizer, city and deadline.

Do not label any manual flow `Continue to Payment` or claim payment execution.

## 21. Donations product contract

Donations is physical-item giving only. Financial contribution belongs to FundMe. A generic service marketplace is not created.

Standalone Donations mirrors Requests at the discovery level:

```text
Donations
Sport | Community
Search
quick taxonomy rail
advanced filters
readable Donation cards
```

Sport is default only when no stronger context exists.

## 22. D1 — Donation taxonomy/contracts/database

`DonationOffer` owns:

- creator;
- publisher/audience references;
- root `SPORT | COMMUNITY`;
- canonical sport for SPORT;
- taxonomy subcategory/Need/custom text where allowed;
- title/description;
- quantity total;
- optional size/label;
- actual condition;
- city/Houma;
- optional private pickup/full address/location note;
- expiry;
- offer status/timestamps.

Actual Donation condition enum is separate from Request preference. Initial target:

```text
NEW
LIKE_NEW
GOOD
FAIR
```

Offer lifecycle:

```text
OPEN
COMPLETED
CANCELLED
EXPIRED
```

`DonationClaim` owns claimant, requested quantity, private message and:

```text
PENDING
ACCEPTED
DECLINED
WITHDRAWN
FULFILLED
```

One canonical claim identity per offer/user.

### Taxonomy

Sport Donations reuse canonical sports PRODUCT taxonomy.

Community Donations add governed physical PRODUCT categories/Needs only, such as Food/Pantry, Clothing, School/Youth Supplies, Household/Community Supplies, Event/Community Supplies and Other Physical Goods.

Do not copy Coach, Advice, Training Partner or other non-item Request Needs into Donations.

## 23. D2 — Donation service/concurrency/privacy

Derived available quantity:

```text
quantityTotal - SUM(ACCEPTED/FULFILLED claim quantity)
```

Pending claims do not reserve quantity.

Accept claim inside a transaction/locking boundary:

```text
lock/read offer
-> verify claim and offer state
-> calculate accepted/fulfilled reserved quantity
-> verify requested quantity fits
-> transition claim
-> commit
```

Concurrent accepts must never over-reserve.

When fulfilled quantity reaches quantity total, set offer COMPLETED transactionally.

Offer cancellation must reject while unresolved accepted handoffs exist.

Expiry blocks new claims but does not prevent an already ACCEPTED claim from becoming FULFILLED.

Exact pickup/full address is backend-protected. Public projections expose only privacy-safe location. Accepted claimant/donor-manager receive precise pickup only where authorized.

## 24. D3 — Donation media

Donation offers support **up to four photos**.

`DonationImage` is plural ordered metadata. Service enforces maximum four. First ordered image may be primary/feed image.

Use shared ObjectStorage, actual-byte validation/normalization, signed delivery and Outbox/Worker cleanup.

No image bytes/base64 in PostgreSQL.

## 25. D4-D5 — Donation frontend/final gate

Real server-side `q` search over title/description/custom item text before pagination.

Advanced filters may include category, Need, city, Houma, condition, status and only other fields actually supported by backend query.

Required screens/states:

- Sport feed;
- Community feed;
- expanded filters;
- empty state;
- Offer Sport Donation;
- Offer Community Donation;
- quantity/size/condition;
- up to four photos;
- location/audience/publish-as;
- review;
- submitted success;
- guest detail;
- signed-in claim quantity/message;
- pending claim + withdraw;
- donor/manager claim cards + Accept/Decline;
- partial availability;
- accepted/reserved handoff;
- private pickup detail for authorized parties;
- Mark Fulfilled;
- COMPLETED;
- CANCELLED/EXPIRED;
- Other items from this donor.

`houma` is neighborhood/location. It is not a HOOMA token.

Donation claim is the coordination object. Do not invent a separate public chat/DM system.

## 26. Help overview — H1

Only after all three domains exist.

Metrics are database-derived and visibility-aware.

Recommended semantics:

```text
Open Requests      = HelpRequest.status == OPEN
Active Fundraisers = Fundraiser.status == ACTIVE
Donated Items      = SUM(FULFILLED DonationClaim.quantity)
```

If the product intentionally counts OPEN + IN_PROGRESS Requests, label it `Active Requests`, not `Open Requests`.

Use narrow domain summary readers. Do not load feeds to count and do not create a second source-of-truth table.

## 27. Later Request <-> Donation matching — H2

Only after Requests and Donations are stable and explicitly authorized.

Matching is a read/projection feature over shared taxonomy/location/size compatibility. It does not auto-claim, auto-accept, copy records or create a second lifecycle.

## 28. Authorization/privacy invariants

- every write uses authenticated canonical User;
- UI visibility is never authorization;
- publisher authority comes from live owning-domain facts;
- public Help lists never expose private audience records;
- Request fullAddress remains hidden;
- Donation exact pickup remains hidden until authorized accepted handoff;
- private response/claim messages remain private;
- anonymous FundMe supporter presentation never leaks identity;
- Crypto stores public receiving addresses only.

## 29. Database/migration invariants

- forward-only migrations;
- never rewrite applied shared migration history;
- deterministic taxonomy seeds/migrations;
- explicit FK/uniqueness/indexes;
- real transaction boundaries for Request/Donation concurrency-sensitive transitions;
- integer minor units for FundMe accounting;
- no polymorphic JSON ownership blobs;
- no duplicate sports/identity/category authorities;
- no speculative tables ahead of ordered slices.

## 30. Media/performance invariants

- shared ObjectStorage transport;
- domain-owned media metadata/authorization;
- bounded image limits;
- signed delivery;
- no eager off-screen per-card delivery storms;
- batched user presentation;
- cursor pagination;
- filters/search before pagination;
- no N+1 identity/taxonomy/count queries.

## 31. Documentation and stale-code policy

`rideplan.md` is Ride history for Help purposes; its old Requests/FundMe ordering is superseded by this plan.

PRs #349/#350 are reference-only contamination history.

PR #347 is read-only Play projection reference until explicitly reconciled.

Do not use stale branches as implementation ancestry. Adapt only proven behavior file-by-file into current canonical source.

## 32. Verification rule per slice

For every behavioral slice:

1. inspect current source/tests;
2. define exact acceptance evidence;
3. add/identify focused test;
4. observe RED where appropriate;
5. mutate canonical owner only;
6. run focused tests;
7. inspect exact diff;
8. run relevant regression/integration/database checks;
9. run browser/mobile proof where UI is part of acceptance;
10. recheck exact head/CI at the final gate;
11. update governing docs with current truth.

Never weaken tests to make code pass.

## 33. Merge gate

Before merge:

- fresh base/head;
- exact PR diff;
- no unauthorized files;
- migrations/schema valid;
- focused and broad required checks green;
- exact final SHA CI green;
- browser/runtime/database evidence where required;
- no unresolved contradictions;
- no stale branch ancestry;
- explicit user merge authorization.

Green CI alone is not merge authorization.

## 34. Current next command

After a fresh repository/PR state capture, the next authorized implementation command is:

```text
H0 — extract the narrow shared Help access reader with zero Request behavior change
```

After H0 passes its gate:

```text
R1 — canonical Requests server-side search
```

Do not start later work early.
