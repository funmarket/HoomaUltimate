# HOOMA ULTIMATE — Authorization

Status: **Locked authorization model**

## 1. Authentication is not authorization

Authentication resolves a canonical User. Authorization answers whether that User may perform a specific action in a specific scope.

Profile identity such as PLAYER, FAN or GAMER never grants management permissions.

## 2. Global authority

Only global App Admin uses the term Admin.

Role:

- `PLATFORM_ADMIN`

Routes:

- UI: `/admin`
- API: `/api/v1/admin/*`

Non-admin users receive 403 for App Admin actions even if they are Team Coaches, ULTRAS Leaders, Gamer Leaders or Place Owners.

Every sensitive App Admin write creates an `AuditLog` containing actor, action, target/scope, timestamp and safe structured metadata.

## 3. Scoped role vocabulary

### HOOMA Community

- FOUNDER
- COACH
- MEMBER

No Community Admin.

### Team

Responsibilities:

- COACH
- ASSISTANT
- PLAYER

Team management is the **Coach Control Room**, never Admin.

### ULTRAS

- LEADER
- MODERATOR
- MEMBER

### Gamer Squad

- LEADER
- MEMBER

### Place

Authority is derived from verified contribution/ownership records, not a generic Admin role.

- CONTRIBUTOR concept: may submit/suggest under normal member rules;
- VERIFIED OWNER: approved `PlaceOwnership` permits specific business management actions.

## 4. Public vs authenticated vs scoped actions

| Action class | Guest | Authenticated member | Scoped authority |
|---|---:|---:|---:|
| Browse public lists/details | Yes | Yes | No |
| View public profile | Yes | Yes | No |
| Join/request/create/contribute | No | Yes, subject to domain rules | Sometimes |
| Edit own profile | No | Yes | Own-user check |
| Suggest Place | No | Yes | No profile-role requirement |
| Claim Place | No | Yes | Approval required before owner authority |
| Manage verified Place | No | No by default | Verified owner |
| Coach Control Room | No | No by default | Team Coach / granted Assistant capability |
| ULTRAS private HQ | No | No by default | Active ULTRAS membership |
| ULTRAS moderation | No | No | Leader/Moderator according to action |
| Gamer Squad management | No | No | Leader |
| Whistle | No | Yes | Relationship/context policy must pass |
| App Admin | No | No | PLATFORM_ADMIN |

## 5. Team authority

Coach is ultimate Team authority.

Assistant can perform only explicitly granted capabilities.

Capability set:

- `EDIT_TEAM`
- `MANAGE_ROSTER`
- `MANAGE_LINEUP`
- `CREATE_CHALLENGE`
- `RESPOND_TO_CHALLENGE`
- `MANAGE_TEAM_EVENTS`

Rules:

- capability grant references an active Assistant responsibility;
- revoking Assistant invalidates effective delegated permissions;
- Coach can revoke grants/responsibility;
- frontend hidden/disabled controls are UX only, never the authorization boundary;
- self-challenge is rejected in domain/application policy and tested even if frontend prevents it;
- challenge conversation access is limited to authorized participants/representatives according to final policy.

## 6. Community authorization

Community scoped authorization must migrate away from legacy `OWNER/ADMIN/MEMBER` semantics. Do not merely relabel strings in UI.

Founder/Coach/Member permissions are defined in domain policy and verified against existing mature Source A behavior before migration SQL is written.

## 7. Place authorization

### Suggestion

Any authenticated member can suggest a Place. PLAYER/FAN/GAMER identity is irrelevant.

### Ownership claim

Submitting a claim does not grant owner permissions. App Admin approval creates/elevates the durable verified ownership state.

### Owner management

Server derives owner User from authenticated principal and verifies active `PlaceOwnership`. Client-supplied `ownerUserId` is never trusted for authorization.

Pitch/Watch capability management additionally checks approved capability/application state as appropriate.

## 8. App Admin moderation

App Admin controls global moderation such as:

- users/platform moderation;
- reports;
- Place suggestions and owner claims;
- Lounge/Cafe, Pitch and Watch applications;
- canonical football entities;
- Gamer game catalog;
- audit/system operations.

Approval actions must be idempotent/transaction-safe and audited.

## 9. ULTRAS authorization

Public discovery/detail contains public projection only.

Private HQ requires active membership.

Leader/Moderator action matrix must explicitly cover:

- invite/member management;
- join-request approval/rejection;
- group settings;
- GameDay management;
- moderation;
- shared Whistle access.

Random public users never receive private HQ data merely because the group itself is public.

## 10. Gamer authorization

Public catalog/squad discovery can be public where product rules allow.

Gamer Squad Leader manages squad membership/challenges/results according to explicit domain policy. MEMBER cannot acquire Leader abilities through profile identity or client flags.

Canonical GamerGame catalog changes are App Admin only.

## 11. Event authorization

Public Events are browsable anonymously.

RSVP, check-in, formation management, chat, editing and completion each have separate action policies. Do not protect the entire Event detail page just because one action is private.

Temporary event chat access is scoped to the mature event-participation rules carried from Source A.

## 12. Whistle authorization

A user may Whistle only through an allowed relationship/context:

- same active Event;
- same Team;
- accepted Ride;
- same HOOMA Community;
- same ULTRAS;
- same Gamer Squad/approved Gamer context;
- mutual or explicit player contact.

A public profile lookup alone is insufficient.

On reveal, authorization is checked again before transient body access. Persistent notification possession alone does not authorize body retrieval.

## 13. Ride privacy authorization

Public Ride projections never expose exact coordinates/meeting details.

Exact meeting/live-location information is available only to explicitly authorized accepted participants and relevant offer/request owners according to the mature Ride policy.

Live tracking defaults OFF.

## 14. Payment authorization

Payment mutation/read/refund permissions must preserve Source A's mature ownership/provider/admin boundaries.

Provider webhook endpoints authenticate provider authenticity/idempotency, not end-user sessions.

Stars refunds and sensitive settlement actions require explicit policy checks and audit/operational evidence where appropriate.

## 15. Authorization implementation pattern

Prefer explicit policy functions/services:

```text
controller
 -> authenticated principal
 -> application command/query
 -> policy/capability check
 -> repository mutation/read
```

Never:

- trust client role flags;
- trust client owner IDs;
- infer authority from profile identity;
- make UI visibility the only guard;
- query unrelated repositories directly from controllers;
- duplicate policy inside Worker.

## 16. Tests

Required authorization matrix tests cover:

- guest/member/admin public boundaries;
- Platform Admin 403/allow + AuditLog;
- Community Founder/Coach/Member;
- Team Coach and every Assistant capability;
- Assistant revocation;
- self-challenge rejection;
- challenge conversation scope;
- Place suggestion/claim/verified-owner permissions;
- Pitch/Watch applications;
- ULTRAS Leader/Moderator/Member/private HQ;
- Gamer Leader/Member;
- Event RSVP/formation/chat/check-in;
- every Whistle context and random-public-profile denial;
- Ride exact-location privacy;
- payment ownership/refund/provider boundaries.
