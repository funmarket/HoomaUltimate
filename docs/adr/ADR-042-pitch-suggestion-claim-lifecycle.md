# ADR-042 — Pitch suggestion and claim lifecycle

Status: **Accepted**

## Context

Pitch is a dedicated product over canonical `Place`. A community user may know that a real football pitch exists without owning or managing it. HOOMA must be able to publish that Admin-reviewed pitch for discovery and later let the actual operator claim it, without treating the suggester as the owner and without creating a second physical venue record.

`PlaceCapabilityApplication` is an owner submission/review workflow. Using an approved application itself as the public Pitch identity incorrectly requires ownership before discovery and makes an already-approved Pitch disappear whenever an owner submits an update for review.

## Decision

`Place` remains the only physical-location source of truth.

A durable `PlaceCapability` row represents that an approved Place participates in a capability product such as `PITCH`. For Pitch it may exist with no rental summary, price or currency yet. Public Pitch discovery reads approved `PlaceCapability + Place` data.

`PlaceCapabilityApplication` remains the verified-owner workflow for proposed Pitch rental/profile details. Approving an application copies the reviewed profile fields into the durable `PlaceCapability`. Pending or rejected updates never erase the last approved public capability profile.

A user can explicitly suggest a Place as a Pitch. The Place and pending Pitch capability are created together and reviewed by App Admin together. Approval publishes the Pitch designation but does **not** create `PlaceOwnership` for the suggester. Once that Pitch suggestion is approved, the unverified suggester no longer has Place-management authority merely because they suggested it.

The actual operator uses the existing canonical Place ownership-claim workflow. Pitch management and Pitch application submission require verified `PlaceOwnership`. The UI determines `Own this pitch?` versus `Manage pitch` from a protected verified-ownership status boundary, not from generic Place-management access.

Generic Place suggestions that are not explicitly community Pitch suggestions retain their existing ownership behavior in this slice.

## Consequences

- no duplicate Pitch venue table;
- no copied Place name/address/media/contact truth;
- Pitch may be discoverable before rental pricing exists;
- suggestion does not imply ownership;
- owner profile updates can be moderated without temporarily unpublishing the previous approved profile;
- Play and Teams may continue tagging the same approved Pitch through canonical `Place.id`.
