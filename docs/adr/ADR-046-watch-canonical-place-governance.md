# ADR-046 — Watch uses canonical Place ownership, not a second capability approval

Status: **Accepted**  
Date: **2026-08-26**

## Context

ADR-045 correctly established that Watch, Places and Pitch must share one canonical physical `Place` and that Watch events eventually need a direct Event-to-Place relationship. It also preserved an older Watch-specific capability-application workflow after Place ownership verification.

The product owner has now explicitly simplified that model.

A physical venue must have one durable identity, one moderation lifecycle and one ownership lifecycle. A verified Place owner must not be required to apply a second time for permission to operate the same Place as a Watch venue. FanHub is also not a second venue entity or permission system; it is a discovery/context classification over the canonical Place.

This decision supersedes ADR-045 only where ADR-045 preserved a separate Watch capability/application approval. Pitch remains an independent product capability/application until a newer explicit decision changes Pitch.

## Decision

Watch uses the existing canonical Place and Place ownership lifecycle directly.

```text
Place
  -> one canonical physical location
  -> Place moderation
  -> optional verified PlaceOwnership
  -> Watch discovery / Watch Event association
```

There is no second Watch-business approval after verified ownership.

The target authority model is:

```text
community member suggests Place
  -> Place moderation
  -> approved canonical Place

business owner submits or claims Place
  -> Place moderation where required
  -> PlaceOwnershipClaim review
  -> verified PlaceOwnership

verified PlaceOwnership
  -> sufficient owner authority for Watch at that Place
```

## FanHub rule

FanHub is not a persistent venue identity, ownership role or parallel service.

For the current product direction, FanHub is a discovery/context classification derived from the canonical Place, especially for community-suggested Places.

A Place that was originally community-suggested remains the same Place if a real owner later claims it. Ownership changes authority; it does not create, migrate or duplicate the venue.

Therefore:

- no `FanHub` table is introduced for physical venue identity;
- no `FanHubPlace`, `WatchVenue` or equivalent duplicate physical-location model is introduced;
- no duplicate name/address/coordinates are persisted merely to support FanHub or Watch;
- authorization must never depend on a `FanHub` role.

## Place submission semantics

Both member suggestions and owner submissions must converge on the same canonical Place creation path.

The target persistence model should distinguish submission origin/intent without creating separate entities, for example conceptually:

```text
Place
  submittedByUserId
  origin = COMMUNITY_SUGGESTED | OWNER_SUBMITTED
```

The exact field names are an implementation detail to be finalized in the persistence slice, but the semantic rule is locked: the existing `suggestedByUserId` assumption must not force every Place to pretend it was community-suggested.

Owner submission may create the Place and its ownership claim in one transaction when the persistence slice is implemented. Place moderation and ownership verification remain separate trust decisions.

## Duplicate prevention

All Place entry paths must check the existing canonical Place source before creating another physical venue.

Strong deterministic matches may include normalized name/address and exact phone/website, with coordinates used as candidate evidence. Ambiguous/fuzzy matches must never be silently auto-merged.

When an existing Place is confidently identified, the user should be directed to view or claim that Place instead of creating a duplicate.

## Watch capability cleanup

The Watch-specific use of the generic Place capability-application system is no longer part of the target model.

The implementation slice must remove Watch-specific active usage of:

```text
PlaceCapabilityKind.WATCH
REVIEW_WATCH_APPLICATIONS
Watch PlaceCapabilityService wiring
/api/v1/watch/applications
/api/public/v1/watch capability-directory behavior
/admin/queues/watch capability-application review
PlaceCapabilityOnboarding kind="WATCH"
Watch business-application UI/state
```

Historical database state must be inspected before destructive migration work. Existing Watch application rows must not be silently discarded by assumption.

This decision does **not** remove Pitch capability/application behavior.

## Watch Event relationship

Watch Events must reference the canonical Place directly.

Target relationship:

```text
Event
  type = WATCH
  placeId -> Place.id
```

Watch must never persist `fanHubId` or another physical-venue foreign key.

For Watch, Place becomes the authoritative source for venue identity and Place-owned presentation such as name, location, contact information and future Place media.

PLAY may retain its current venue behavior until a deliberate Play venue normalization requires otherwise.

## Community coupling

The current Event model requires `communityId`, but the product rule for Watch creation does not require the creator to fabricate or belong to a HOOMA Community.

The Watch backend slice must therefore remove that false coupling rather than creating a fake Community.

Target semantics:

```text
PLAY
  -> communityId follows existing Play policy

WATCH
  -> communityId optional
  -> createdByUserId + placeId are sufficient core ownership/context
  -> optional Community context may be attached when real
```

Every Event consumer that currently assumes Community is mandatory must be traced before this schema change is implemented.

## Watch creation authority

Watch creation will be enabled only in the deliberate Event-to-Place implementation slice.

The target policy is:

```text
create WATCH Event
  -> authenticated canonical HOOMA User
  -> approved canonical Place required
  -> verified Place owner may publish with owner/official authority
  -> normal authenticated member may create a community Watch Event where product rules allow
```

There is no separate Platform Admin Watch-event permission request.

Verified Place ownership changes authority and presentation; it does not create a second Watch-business identity.

## Ticket authority

Collector-ticket presentation must derive venue authority from canonical data rather than persist another status table.

Examples:

- verified current Place owner creating the Watch Event may render an owner/official venue indication;
- community-originated activity may render community-suggested context where appropriate.

The governed collector-ticket master remains presentation infrastructure and must not be duplicated per event.

## Routing and product boundaries

Places remains an independent canonical product surface.

Preferred canonical routes are:

```text
/places
/places/new
/places/:placeId
```

Watch may link to Places and filtered FanHub discovery, but must not create a second Watch-owned Place system.

The Places tabs remain:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

## Admin boundary

Platform Admin continues to own:

- Place moderation;
- PlaceOwnershipClaim review;
- Pitch application review while Pitch retains that model;
- audit-sensitive decisions.

Platform Admin no longer needs a Watch capability-application queue once the cleanup slice is implemented.

## Migration safety

Before removing Watch capability enum values, grants or application rows, inspect the intended PostgreSQL/Railway database state.

The migration must deliberately handle any existing Watch application data. No direct production database patch, guessed cleanup or silent data loss is allowed.

## Consequences

This decision deliberately reduces architecture:

- one physical Place identity;
- one Place moderation lifecycle;
- one Place ownership lifecycle;
- no second Watch business-approval lifecycle;
- no FanHub physical-venue identity;
- Watch Events attach directly to Place;
- Pitch remains independent until explicitly changed.

The next implementation work is split so no half-domain is left behind:

1. Place submission/origin semantics, duplicate prevention and owner-submit/claim lifecycle;
2. Watch capability cleanup plus Event-to-Place persistence and authorization;
3. Watch/Places UX over the resulting canonical model.

## Supersession

This ADR supersedes the following parts of ADR-045:

- “independent approved capabilities such as WATCH and PITCH” as a requirement for Watch;
- preservation of the existing Watch capability application workflow;
- approved-Watch-Place discovery being defined by a second Watch application approval.

ADR-045 remains valid for:

- one canonical Place;
- Pitch remaining an independent Place capability/application;
- governed collector-ticket presentation;
- Watch Event creation staying disabled until the Event-to-Place slice is implemented and verified.
