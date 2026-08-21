# HOOMA ULTIMATE — Locked Requirements

Status: **Product and engineering acceptance baseline**

## 1. Product identity

HOOMA ULTIMATE is one football product with two authenticated frontend surfaces: Web and Telegram Mini App. Public discovery remains available without sign-in.

## 2. Admin terminology

The word **ADMIN** belongs only to the global HOOMA App Admin.

Global role: `PLATFORM_ADMIN`  
Global route: `/admin`  
Global API: `/api/v1/admin/*`

Forbidden final terminology includes Community Admin, Team Admin, ULTRAS Admin, Gamer Admin, Pitch Admin, Venue Admin and FanHub Admin.

Scoped responsibilities:

- Community: FOUNDER, COACH, MEMBER;
- Team: COACH, ASSISTANT, PLAYER;
- ULTRAS: LEADER, MODERATOR, MEMBER;
- Gamer Squad: LEADER, MEMBER;
- Place: CONTRIBUTOR / VERIFIED OWNER concepts.

## 3. Authentication

Exactly two authenticated entry systems are required.

### Telegram

`Telegram initData -> cryptographic server validation -> TelegramIdentity -> canonical User`

### Web

Registration requires:

- login username;
- password;
- display username;
- optional email;
- optional/progressive display name.

Login uses login username + password.

Passwords use Argon2id.

Web sessions use opaque random tokens, with only a secure token hash stored in PostgreSQL.

Production session controls include HttpOnly cookies, Secure cookies, suitable SameSite policy, expiration, revocation, throttling/lockout and write-origin/CSRF protection.

`TELEGRAM_BOT_TOKEN` is required for production Telegram startup.

Explicitly supplied invalid Telegram credentials fail closed.

If valid Telegram identity maps User A and valid Web session maps User B, return `AUTH_CONFLICT`.

No automatic account merging by username, email, display name, city/Houma, photo or profile similarity.

## 4. Public browsing

Sign-in is required for actions, not browsing.

Public discovery uses `/api/public/v1/*`. Member actions use `/api/v1/*`.

Guests may browse:

- Home;
- HOOMA Communities;
- Teams and public Team detail;
- Play and public Events;
- Watch;
- Pitch;
- Places, Lounges/Cafes and FanHub;
- ULTRAS public pages;
- Gamers public pages;
- privacy-safe Requests;
- Ride public summaries;
- FundMe public listings;
- public Profiles;
- HOOMA NOW/discovery;
- public Replay where permitted.

Authentication begins when an action requires membership/identity, including JOIN, CREATE, CLAIM, REQUEST, CONTRIBUTE, WHISTLE, EDIT, MANAGE, SUBMIT, CHALLENGE and CHECK IN.

Web login preserves `returnTo`.

## 5. Navigation

### Permanent bottom navigation

Exactly:

`HOME | PLAY | WATCH | HOOMA | PITCH`

Pitch must never be replaced with Places.

### Home feature gateway

Exactly:

`HOOMA | TEAMS | ULTRAS | GAMERS`  
`PLACES | REQUESTS | RIDE | FUNDME`

Use approved black/silver/aged-gold feature artwork rather than generic replacement icons.

### Places top navigation

Exactly:

`LOUNGES/CAFES | PITCH | FANHUB`

Opening `/places` defaults to `LOUNGES/CAFES`.

## 6. Canonical Place

One physical Place record serves Lounge/Cafe, Pitch, Watch, FanHub and Ride contexts. Do not create duplicate physical-place rows for each product.

A Place detail may expose real source-backed fields such as name, photos, description, city, Houma, address, map/location, allowed contact info, verification/owner state, football tags, upcoming Watch activity, related Events and amenities.

No hardcoded production cards or localStorage persistence.

## 7. Place contribution and ownership

Any authenticated HOOMA member may suggest a real Place regardless of profile identity.

`Suggest Place` and `Add/Claim My Place` are separate concepts.

Suggestion flow:

`member -> suggestion form -> PENDING -> App Admin moderation -> approve/reject -> discoverable Place`

Ownership flow:

`authenticated user -> submit/select Place -> evidence/details -> PENDING claim -> App Admin review -> APPROVED -> PlaceOwnership`

Unverified owner submissions do not auto-publish as verified.

Verified owners may edit permitted business-facing data through server-side ownership checks.

## 8. Pitch

Preserve the mature dedicated `/pitch` product and bottom-nav destination.

The Places Pitch tab reuses the same backend/query/data as `/pitch`, based on canonical `Place + approved PitchProfile`.

Verified Place Owners may apply for Pitch capability. Approval is App Admin moderated.

Do not invent booking/calendar/payment functionality unless already genuinely implemented or separately required.

## 9. Watch and FanHub

Watch remains `/watch`, an activity product. Places remains location discovery.

Watch Events link to canonical Places with real foreign keys. Historical snapshots may preserve event accuracy if Place data later changes.

FanHub is a football-place/community discovery feature, not a user role or permission.

## 10. Teams

Preserve/adapt mature Source A:

- discovery;
- detail/update;
- roster;
- lineups and slots;
- challenges;
- challenge detail/messages;
- incoming/outgoing challenge lists;
- accept/reject/cancel;
- accepted games and current lifecycle;
- existing useful tests.

Add Source B authority improvements:

- explicit Coach responsibility;
- Assistant responsibility;
- delegated Assistant capabilities;
- player removal/deactivation;
- Assistant revocation;
- source-level self-challenge prevention.

Recommended main tabs: `DISCOVER | CHALLENGES | GAMES`.

## 11. Coach Control Room

Never call Team management Admin.

Coach may be authorized to edit Team details, manage roster, assign/revoke Assistant, grant capabilities, manage lineups, create/respond to challenges and manage Team events.

Assistant capabilities are explicit:

- `EDIT_TEAM`
- `MANAGE_ROSTER`
- `MANAGE_LINEUP`
- `CREATE_CHALLENGE`
- `RESPOND_TO_CHALLENGE`
- `MANAGE_TEAM_EVENTS`

Self-challenge is rejected server-side and tested.

## 12. Events / Play

Preserve mature behavior:

- creation/detail;
- Play/Watch Event flows;
- RSVP;
- capacity/waitlist;
- formations/slots;
- check-in;
- temporary event chat;
- completion lifecycle;
- relevant tests.

Do not replace this with a smaller RSVP-only implementation.

## 13. Profile

Preserve the strongest Source A presentation.

Presentation includes display username, display name, avatar/photo, bio, city/Houma and public information.

Profile identities include PLAYER, FAN and GAMER. Derived identities may include ULTRAFAN, GHOST_RIDER and future explicit states.

Responsibilities include Team Coach/Assistant/Player, ULTRAS Leader/Moderator/Member, Gamer Squad Leader/Member and Place Owner.

Profile identity never grants authorization.

Real membership sections include MY TEAMS, MY ULTRAS, MY GAMER SQUADS and MY PLACES.

## 14. ULTRAS

Independent domain; never implemented with Team tables or as a renamed Community.

Core concepts:

- UltrasGroup;
- UltrasMembership;
- UltrasInvite;
- UltrasJoinRequest;
- UltrasGameDay;
- UltrasGameDayAttendance.

Roles: LEADER, MODERATOR, MEMBER.

Every group connects to a canonical football entity of type CLUB or NATIONAL_TEAM. No fake free-text official identity.

Provide public discovery/detail and private member HQ. Random public visitors cannot read private HQ data.

Integrate shared Watch, Ride, FundMe, Replay and Whistle.

## 15. Gamers

Independent domain; never Team tables.

Core concepts:

- GamerGame;
- GamerProfile;
- GamerHandle;
- GamerSquad;
- GamerSquadMembership;
- GamerChallenge;
- GamerResultSubmission.

Roles: LEADER, MEMBER.

Complete public catalog, profiles/handles, squads, joins, challenges, result confirmation/dispute and shared Whistle. App Admin controls canonical GamerGame catalog.

## 16. Whistle

Exactly one shared engine.

Locked rules:

- maximum 33 grapheme clusters;
- maximum 11 total per user per UTC day/defined period across all contexts;
- body stored only in Redis/Valkey;
- metadata stored in PostgreSQL;
- unread body TTL 24 hours;
- after first authorized reveal, body TTL exactly 60 seconds;
- no body column in PostgreSQL;
- no body in persistent notifications/outbox/push payloads;
- no likes/comments/reposts/follower mechanics/permanent message history.

Authorized relationship contexts include same active Event, same Team, accepted Ride, same HOOMA Community, same ULTRAS, same Gamer Squad/approved Gamer context, mutual or explicit player contact.

A random person who finds a public profile cannot Whistle that user.

## 17. Notifications

A persistent notification may say `Youssef sent you a Whistle` but never contains the transient body.

The Worker must attempt configured Telegram delivery, retry safely, log failures and avoid duplicate delivery.

## 18. Requests

Preserve concurrency-safe claiming and business invariants. Expose public read only where privacy allows.

## 19. Ride

Preserve offers, requests, seat/match flow, accepted participants, location privacy, ratings if retained, Whistle integration and Event/Place destinations.

Public projections never expose exact coordinates. Exact meeting/location data is restricted to authorized accepted participants.

Live tracking defaults OFF and is never silently enabled by frontend defaults.

## 20. FundMe and payments

Preserve mature Source A Cash and Telegram Stars behavior:

- digital products;
- invoice creation;
- payment lookup;
- idempotency;
- provider webhook handling;
- pre-checkout;
- successful payment;
- cancellation;
- cash confirmation/voiding;
- Stars refunds;
- entitlements where used.

A table alone never makes Telegram Stars complete.

## 21. Media

PostgreSQL stores MediaAsset metadata, object storage stores bytes, Worker handles validation/orientation/EXIF+GPS stripping/resizing/variants.

Large permanent image blobs must not be sent through Express/PostgreSQL as the storage strategy.

## 22. Worker / Outbox

Business transaction writes durable state + OutboxEvent atomically. Worker claims safely using `FOR UPDATE SKIP LOCKED`, uses retries/backoff, attemptCount, lastError, bounded retries, dead-letter/operational visibility and structured logging.

Worker does not duplicate domain policy.

## 23. Replay

Event completion integrates with Outbox/Worker to create Replay. Authorized attendees may upload during configured windows. Public/shareable projection is permission-based.

## 24. Database and migrations

One coherent schema; do not concatenate both schemas.

Preserve Source A deployed migration history if reusing the current Railway database. Extend forward only. Never edit deployed migrations. Clean and upgrade paths must converge to the same final schema. Do not use `prisma db push` for production migration.

## 25. CI and tests

Do not copy V3's broken ordering. Required CI/test categories include auth, public access, App Admin/audit, Teams, Places, Pitch, Events, Whistle, ULTRAS, Gamers, payments, Worker and migrations using disposable real PostgreSQL/Redis for integration tests.

## 26. Preview Mode

Provide `npm run dev:preview` using isolated frontend mocks such as MSW and personas for Spectator, Member, Player, Coach, Assistant, ULTRAS Leader/Moderator, Gamer Leader, Place Owner and Platform Admin.

Preview mode never weakens production backend auth, and production build must reject it.

## 27. Design

Preserve HOOMA identity: nearly black surfaces, subtle print/paper texture, warm cream typography, silver/white football iconography, aged gold borders/details, premium heritage, mobile-first spacing and touch targets.

Watch may retain the collector-ticket aesthetic; not every screen should become a ticket.

## 28. Definition of done

A feature is DONE only after:

`migration -> repository -> service/domain -> authorization -> contract -> HTTP -> frontend API/state -> UI -> persistence -> reload/read-back -> errors/validation -> tests -> build -> deploy/runtime config -> verification`.

Preview Mode never counts as production completion.
