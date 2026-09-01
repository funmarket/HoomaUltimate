# ADR-054 — Athletes is an independent HOOMA-connected domain

Status: Accepted
Date: 2026-09-01

## Context

PR #212 restored the HOOMA/Teams creation hierarchy:

- `/hooma` creates only canonical HOOMA Communities.
- Team creation remains owned by Teams at `/teams/new`.
- Teams may use only the bounded `/hooma/new?after=team-create` continuation when a user must create an eligible HOOMA context first.

The Athletes foundation now begins as a separate product slice. Athletes needs sports-community discovery, creation, membership and join-request behavior, but it must not reopen the Community-type chooser bug fixed by ADR-053.

## Decision

Athletes is a separate HOOMA-connected domain inside the existing HOOMA application.

Athletes uses the canonical `User` identity and owns independent lifecycle records:

```text
User
  ├── CommunityMembership
  ├── Team relationships
  └── AthletesMembership

AthletesCommunity
  ├── AthletesMembership
  └── AthletesJoinRequest
```

The word “community” in `AthletesCommunity` names the Athletes product concept. It does not mean Prisma `Community` inheritance, ownership, or storage.

Athletes owns:

- contracts;
- Prisma models and committed migrations;
- repository ports and Prisma repository implementation;
- application service and authorization policy;
- public and authenticated HTTP routes;
- frontend API client;
- real `/athletes`, `/athletes/new`, and `/athletes/:athletesCommunityId` routes;
- separate HOOMA navigation entry after the Athletes routes are real.

Athletes must not create or use:

- `CommunityKind.ATHLETES`;
- `CommunityType` or `Community.type`;
- `FeatureType`;
- `ChildDomainType`;
- `CreateAnythingPage`;
- `CreationService`;
- `GenericCommunity`;
- `GenericMembership`;
- a generic cross-domain creator;
- Community-owned or Team-owned Athletes lifecycle records.

HOOMA Communities remain Communities-owned. Teams remain Teams-owned. ADR-053’s Communities-only HOOMA creation rule remains unchanged.

ULTRAS remains frozen.

Whistle, equipment posts, marketplace, Events, Ride integration, Requests integration, FundMe and Payments are separate future slices and are not part of this foundation.

## Authorization

Server-side Athletes authorization is authoritative.

Foundation roles:

- `FOUNDER` manages Athletes community settings, archive, join requests, direct-add, member removal and moderator role changes. The foundation does not implement Founder transfer; the existing Founder cannot be removed or demoted, so an active Athletes community cannot be left with zero active Founder memberships.
- `MODERATOR` uses minimum-safe authority in this foundation: review join requests, direct-add canonical users, and remove `MEMBER` records only. Moderators cannot remove other Moderators, remove Founders, promote themselves, archive communities, or change Founder-only settings.
- `MEMBER` can read the member list and has no management authority.
- Guests may access public discovery and privacy-safe public detail only.

Visibility and join policy are separate:

- `visibility`: `PUBLIC` or `PRIVATE`.
- `joinPolicy`: `OPEN` or `APPROVAL_REQUIRED`.

This foundation keeps the invariant that `PRIVATE` Athletes communities require approval. Public communities may still require approval if the creator chooses that join policy.

## Consequences

- Athletes needs its own PostgreSQL constraints for slug uniqueness, membership uniqueness, pending-request uniqueness, public discovery, and authorization reads.
- Athletes creation must atomically create the `AthletesCommunity` and the founder `AthletesMembership`.
- Direct-add resolves a username to canonical `User.id`; it never creates shadow users and never stores username as membership identity.
- Frontend Athletes pages must use Athletes API routes, not `api.communities.create` or Team APIs.
- `/hooma` may link to Athletes only as a separate domain navigation surface, never as a “Create HOOMA” option.
- Home gateway and bottom navigation remain unchanged in this PR.
