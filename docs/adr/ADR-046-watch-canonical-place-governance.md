# ADR-046 — Watch uses canonical Place ownership, not a second capability approval

Status: **Accepted**  
Date: **2026-08-26**

## Context

ADR-045 correctly established that Watch, Places and Pitch share one canonical physical `Place` and that Watch events need a direct Event-to-Place relationship. It also preserved an older Watch-specific capability-application workflow after Place ownership verification.

The product owner has now explicitly simplified and clarified that model.

A physical venue has one durable Place identity, one moderation lifecycle and one ownership lifecycle. A verified Place owner must not be required to apply a second time for permission to use that Place for Watch.

The product owner also clarified two community paths that must stay distinct from business-owner submission:

1. **community-suggested Places are posted under `Places -> FANHUB`;**
2. **fans/authenticated HOOMA users can suggest Watch matches/events.**

Neither action grants Place ownership or official-venue authority.

This ADR supersedes ADR-045 only where ADR-045 preserved a separate Watch capability/application approval or implied a different Watch/FanHub model. Pitch remains an independent product capability/application until a newer explicit decision changes Pitch.

## Decision

Watch uses canonical Place identity and Place ownership directly.

```text
Place
  -> one canonical physical location
  -> Place moderation
  -> optional verified PlaceOwnership
  -> Watch Event association
```

There is no second Watch-business approval after verified ownership.

## Place entry paths

Community suggestion and owner submission are two different product intents over the same physical Place domain. They must not be collapsed into one undifferentiated meaning.

### Community-suggested Place

```text
community member suggests Place
  -> Place moderation
  -> approved Place
  -> surfaced under Places -> FANHUB
```

Rules:

- community-suggested Places are specifically FanHub listings in Places;
- suggestion does not grant ownership;
- suggestion does not make the suggester a business owner or official venue representative;
- FanHub is a discovery classification, not a user role;
- FanHub must not duplicate the physical Place into another venue table.

### Owner-submitted Place

```text
business owner submits Place
  -> Place moderation where required
  -> ownership claim/review
  -> verified PlaceOwnership
  -> owner-managed business listing
```

Rules:

- owner-submitted Places are business listings;
- they are not FanHub by default;
- verified ownership is the authority source for owner-management actions;
- the owner must not submit a second Watch capability application after ownership is verified.

### Existing community-suggested Place later claimed by owner

If a real owner later claims a Place that already exists as a community-suggested FanHub Place, the claim attaches to the same physical Place identity rather than creating a duplicate venue row.

That ownership claim changes authority; it does not mean the original community-suggestion history was fake. Any future rule about whether claimed FanHub Places remain visible in FanHub must be explicit rather than guessed during implementation.

## FanHub rule

`FANHUB` is the Places discovery destination for approved community-suggested Places.

```text
Places
  -> LOUNGES/CAFES
  -> PITCH
  -> FANHUB  <- community-suggested Places
```

FanHub is not:

- a separate physical venue entity;
- a `FanHubPlace` table;
- a Watch venue table;
- an ownership model;
- an authorization role.

No duplicate name/address/coordinates are persisted merely to support FanHub or Watch.

## Place persistence semantics

The current `suggestedByUserId` assumption is too narrow because not every Place is a community suggestion.

The persistence slice must preserve submission origin/intent explicitly, conceptually:

```text
Place
  submittedByUserId
  origin = COMMUNITY_SUGGESTED | OWNER_SUBMITTED
```

Exact field names are an implementation detail to be finalized in the persistence slice, but these semantics are locked:

```text
COMMUNITY_SUGGESTED
  -> appears under Places -> FANHUB
  -> no ownership granted

OWNER_SUBMITTED
  -> business-owner flow
  -> may create/accompany ownership claim
  -> not FanHub by default
```

Owner submission may create the Place and ownership claim in one transaction when implemented. Place moderation and ownership verification remain separate trust decisions.

## Duplicate prevention

Both entry paths must check the canonical Place source before creating another physical venue.

This is duplicate prevention, not semantic convergence.

Strong deterministic matches may include normalized name/address and exact phone/website, with coordinates used as candidate evidence. Ambiguous/fuzzy matches must never be silently auto-merged.

When an existing Place is confidently identified, the caller should be routed according to intent: view it, suggest activity at it, or claim ownership rather than create a duplicate Place.

## Fan-suggested Watch matches/events

Fans/authenticated canonical HOOMA users may suggest Watch matches/events.

This is a Watch Event/community-activity action, not Place ownership and not a business capability application.

Target semantics:

```text
fan suggests Watch match
  -> authenticated canonical HOOMA User
  -> selects an approved canonical Place
  -> creates/suggests a community Watch Event
  -> Event is marked/presented as community/fan suggested
```

Rules:

- a fan suggestion must never make the fan a Place owner;
- a fan-suggested Watch Event must never be presented as an official venue event unless canonical owner authority actually exists for the publisher;
- fan-suggested Watch Events and owner-published Watch Events use the same canonical Event lifecycle rather than separate event tables;
- fan suggestion must not create a duplicate Place merely because the selected venue is a FanHub Place;
- no separate Platform Admin Watch-business permission request is required merely for a fan to suggest a Watch match;
- any moderation rule specific to fan-suggested Watch Events must be defined explicitly in the Event implementation slice rather than invented here.

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

All Watch Events reference the canonical Place directly.

```text
Event
  type = WATCH
  placeId -> Place.id
```

Watch never persists `fanHubId` or another physical-venue foreign key.

Place is the authoritative source for venue identity and Place-owned presentation such as name, location, contact information and future Place media.

PLAY may retain its current venue behavior until a deliberate Play venue normalization changes it.

## Community coupling

The current Event model requires `communityId`, but Watch creation/suggestion does not require a fan or Place owner to fabricate or belong to a HOOMA Community.

The Watch backend slice must remove that false coupling rather than create fake Community records.

Target semantics:

```text
PLAY
  -> communityId follows existing Play policy

WATCH
  -> communityId optional
  -> createdByUserId + placeId are sufficient core context
  -> optional real Community context may be attached when applicable
```

Every Event consumer that assumes Community is mandatory must be traced before the schema change is implemented.

## Watch publishing authority and presentation

Watch has at least two truthful publishing contexts:

```text
verified Place owner publishes Watch Event
  -> owner/official venue authority may be shown

fan/authenticated HOOMA user suggests Watch Event
  -> community/fan-suggested authority is shown
```

Both use canonical `Event` + canonical `Place`.

There is no second Watch-business identity and no second Watch event lifecycle.

Verified Place ownership changes authority/presentation; fan suggestion does not.

## Ticket authority

Collector-ticket presentation derives authority from canonical data rather than another status table.

Examples:

- verified current Place owner publishing the Watch Event may render an owner/official venue indication;
- fan-suggested Watch activity may render a community/fan-suggested indication.

The governed collector-ticket master remains presentation infrastructure and must not be duplicated per event.

## Routing and product boundaries

Places remains an independent canonical product surface.

Preferred canonical routes are:

```text
/places
/places/new
/places/:placeId
```

Watch may link to Places and FanHub discovery, but must not create a second Watch-owned Place system.

Places tabs remain:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

`FANHUB` specifically surfaces approved community-suggested Places.

## Admin boundary

Platform Admin continues to own:

- Place moderation;
- PlaceOwnershipClaim review;
- Pitch application review while Pitch retains that model;
- audit-sensitive decisions.

Platform Admin no longer needs a Watch capability-application queue once the cleanup slice is implemented.

This ADR does not invent a separate Admin approval queue for fan-suggested Watch matches. If Event moderation is required later, it must be designed as Event moderation rather than resurrecting Watch business capability approval.

## Migration safety

Before removing Watch capability enum values, grants or application rows, inspect the intended PostgreSQL/Railway database state.

The migration must deliberately handle any existing Watch application data. No direct production database patch, guessed cleanup or silent data loss is allowed.

## Consequences

The target architecture preserves clear product distinctions without duplicating physical venues:

- one physical Place identity;
- one Place moderation lifecycle;
- one Place ownership lifecycle;
- community-suggested Places appear under `Places -> FANHUB`;
- owner-submitted Places are business listings and are not FanHub by default;
- fans can suggest Watch matches/events at approved canonical Places;
- fan-suggested Watch events are community activity, not owner authority;
- verified owners can publish Watch events with owner/official authority;
- no second Watch business-approval lifecycle;
- no FanHub physical-venue identity;
- Watch Events attach directly to Place;
- Pitch remains independent until explicitly changed.

The next implementation work remains split so no half-domain is left behind:

1. Place origin semantics, FanHub projection, duplicate prevention and owner-submit/claim lifecycle;
2. Watch capability cleanup plus Event-to-Place persistence and fan/owner Watch Event authorization;
3. Watch/Places UX over the resulting canonical model.

## Supersession

This ADR supersedes the following parts of ADR-045:

- `WATCH` requiring a separate approved Place capability after ownership;
- preservation of the existing Watch capability-application workflow;
- approved-Watch-Place discovery being defined by a second Watch application approval.

ADR-045 remains valid for:

- one canonical Place physical-location source;
- Pitch remaining an independent Place capability/application;
- governed collector-ticket presentation;
- Watch Event creation staying disabled until the Event-to-Place slice is implemented and verified.
