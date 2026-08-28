# ADR-042 — Pitch suggestion and claim lifecycle

Status: **Accepted**

## Context

Pitch is a dedicated product over canonical `Place`. A community user may know that a real football pitch exists without owning or managing it. HOOMA must be able to submit that Pitch for App Admin review and later let the actual operator claim it, without treating the suggester as the owner and without creating a second physical venue record.

A public Pitch is a rental listing. Its hourly rental price is part of the Pitch data being reviewed for publication, not optional presentation that may be invented or deferred until ownership is claimed.

`PlaceCapabilityApplication` remains the verified-owner workflow for later proposed Pitch rental/profile updates. Using an application itself as the public Pitch identity would incorrectly require ownership before discovery and would make an already-approved Pitch disappear whenever an owner submits an update for review.

## Decision

`Place` remains the only physical-location source of truth.

Canonical Place contact fields (`phone`, `email`, and `websiteUrl`) are also the single contact authority for Pitch. Pitch applications must not introduce a second rental-contact record that can drift from the Place reviewed by users and App Admin.

A Pitch suggestion creates the canonical `Place` and its pending `PITCH` `PlaceCapability` together. The Pitch suggestion must include `hourlyRateMinor` and a supported rental `currency`. App Admin reviews the Place and that submitted Pitch price before approval. An approved public Pitch must therefore have complete reviewed hourly pricing.

A durable `PlaceCapability` represents that an approved Place participates in the `PITCH` product. Public Pitch discovery reads approved `PlaceCapability + Place` data only when the Pitch capability contains complete supported hourly pricing. An incomplete historical capability is not a valid public Pitch rental listing and must not be represented by guessed values or a fallback such as "Contact for price".

`PlaceCapabilityApplication` remains the verified-owner workflow for subsequent Pitch rental/profile changes. It contains only Pitch-owned profile/pricing data. Approving an application copies the reviewed Pitch profile fields and price into the durable `PlaceCapability`. Pending or rejected updates never erase or replace the last approved public capability profile, and they never create a parallel contact authority.

A user can explicitly suggest a Place as a Pitch. The Place and pending Pitch capability are reviewed by App Admin together. Approval publishes the Pitch designation and reviewed hourly price but does **not** create `PlaceOwnership` for the suggester. Once that Pitch suggestion is approved, the unverified suggester no longer has Place-management authority merely because they suggested it.

The actual operator uses the existing canonical Place ownership-claim workflow. Pitch management and later Pitch application submission require verified `PlaceOwnership`. The UI determines `Own this pitch?` versus `Manage pitch` from a protected verified-ownership status boundary, not from generic Place-management access.

Generic Place suggestions that are not explicitly Pitch suggestions retain their existing ownership behavior in this slice.

## Consequences

- no duplicate Pitch venue table;
- no copied Place name/address/media/contact truth;
- canonical Place `phone` / `email` / `websiteUrl` remain the Pitch contact source;
- Pitch applications contain Pitch-owned profile/pricing fields only;
- every newly submitted Pitch carries its hourly rental price and currency from creation;
- App Admin reviews the price before that Pitch can become public;
- incomplete historical Pitch capabilities are not exposed as valid public rental listings and are never assigned fabricated pricing;
- suggestion does not imply ownership;
- owner profile/rate updates can be moderated without temporarily unpublishing the previous approved profile;
- Play and Teams may continue tagging the same approved Pitch through canonical `Place.id`.
