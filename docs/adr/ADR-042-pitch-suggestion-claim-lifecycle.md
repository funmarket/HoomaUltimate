# ADR-042 — Pitch submission and claim lifecycle

Status: **Accepted**

## Context

Pitch is a dedicated product over canonical `Place`. A HOOMA member may add a real football pitch either as its owner/operator or as a FanHub community contribution. Both paths must reuse the same physical Place record, moderation boundary, and ownership model without creating a second venue identity.

A public Pitch is a rental listing. Its hourly rental price is part of the Pitch data being reviewed for publication, not optional presentation that may be invented or deferred until ownership is claimed.

`PlaceCapabilityApplication` remains the verified-owner workflow for later proposed Pitch rental/profile updates. Using an application itself as the public Pitch identity would incorrectly require verified ownership before discovery and would make an already-approved Pitch disappear whenever an owner submits an update for review.

## Decision

`Place` remains the only physical-location source of truth.

Canonical Place submission provenance is also authoritative for Pitch. Initial Pitch submission accepts the same immutable `Place.submissionOrigin` values as Spots:

- `OWNER` means the submitting member states that they own or manage the Pitch. Canonical Place creation records `OWNER` provenance and creates a pending `PlaceOwnershipClaim` for that user. This does **not** create verified `PlaceOwnership`.
- `FANHUB` means a registered HOOMA member is adding the Pitch for the community. Canonical Place creation records `FANHUB` provenance and creates no ownership claim.

Canonical Place contact fields (`phone`, `email`, and `websiteUrl`) are also the single contact authority for Pitch. Pitch applications must not introduce a second rental-contact record that can drift from the Place reviewed by users and App Admin.

An initial Pitch submission creates the canonical `Place` and its pending `PITCH` `PlaceCapability` together when the Place is new. The Pitch submission must include `hourlyRateMinor` and a supported rental `currency`. App Admin reviews the Place and that submitted Pitch price before approval. An approved public Pitch must therefore have complete reviewed hourly pricing.

A durable `PlaceCapability` represents that an approved Place participates in the `PITCH` product. Public Pitch discovery reads approved `PlaceCapability + Place` data only when the Pitch capability contains complete supported hourly pricing. An incomplete historical capability is not a valid public Pitch rental listing and must not be represented by guessed values or a fallback such as "Contact for price".

`PlaceCapabilityApplication` remains the verified-owner workflow for subsequent Pitch rental/profile changes. It contains only Pitch-owned profile/pricing data. Approving an application copies the reviewed Pitch profile fields and price into the durable `PlaceCapability`. Pending or rejected updates never erase or replace the last approved public capability profile, and they never create a parallel contact authority.

Pitch submission provenance and verified ownership are separate facts. Choosing **By Owner** creates only the existing canonical pending ownership claim. App Admin must still verify that claim before owner-only Pitch management or later Pitch application submission is available. Choosing **FanHub** creates no ownership authority.

A later verified ownership claim must never rewrite the original `Place.submissionOrigin`. A FanHub-added Pitch stays FanHub provenance even if its real operator later becomes the verified owner.

Pitch management and later Pitch application submission require verified `PlaceOwnership`. The UI determines owner-management actions from a protected verified-ownership status boundary, not from submission provenance or generic Place-management access.

## Consequences

- no duplicate Pitch venue table;
- no copied Place name/address/media/contact truth;
- Pitch and Spots use the same canonical `OWNER | FANHUB` Place provenance model;
- owner-submitted Pitch creation creates a pending ownership claim, never automatic verified ownership;
- FanHub Pitch submission creates no ownership claim;
- later ownership verification never rewrites immutable submission provenance;
- canonical Place `phone` / `email` / `websiteUrl` remain the Pitch contact source;
- Pitch applications contain Pitch-owned profile/pricing fields only;
- every newly submitted Pitch carries its hourly rental price and currency from creation;
- App Admin reviews the price before that Pitch can become public;
- incomplete historical Pitch capabilities are not exposed as valid public rental listings and are never assigned fabricated pricing;
- owner profile/rate updates can be moderated without temporarily unpublishing the previous approved profile;
- Play and Teams may continue tagging the same approved Pitch through canonical `Place.id`.
