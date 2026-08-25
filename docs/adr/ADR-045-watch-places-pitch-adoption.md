# ADR-045 — Watch, Places and Pitch clean adoption

Status: **Accepted**  
Date: **2026-08-25**

## Context

ADR-038 froze new Places, Watch and Pitch implementation while foundation normalization was active. Since then the repository has implemented and verified the canonical physical `Place`, Place moderation, verified Place ownership, Watch/Pitch capability applications and Platform Admin review. The product owner has now explicitly authorized the next Watch/Places/Pitch adoption work.

The approved Watch product also has a governed collector-ticket master supplied by the product owner. The master is presentation infrastructure: event and Place data are overlaid into designated regions; the ticket artwork is not recreated as page-local CSS or duplicated per event.

## Decision

Places, Watch and Pitch are removed from ADR-038's freeze for the bounded adoption work described here. ADR-038 continues to apply to unrelated frozen future domains unless another explicit decision supersedes it.

The following architecture is locked:

```text
Place
  -> one canonical physical location
  -> verified ownership
  -> independent approved capabilities such as WATCH and PITCH

Event
  -> one canonical event lifecycle
  -> WATCH is a product-specific Event type when its creation policy is enabled
  -> RSVP / waitlist / check-in remain Event-owned
```

Rules:

- never create a second physical venue record merely because a Place appears in Watch, Pitch, Places or FanHub;
- existing Place moderation, ownership verification, Watch/Pitch application and Platform Admin review remain the canonical workflows;
- `/watch` becomes a consumer discovery product first; business onboarding remains available as a secondary owner action;
- `/pitch` remains a permanent standalone product over the canonical Place source;
- Watch event creation remains disabled until the Event-to-Place relationship and Watch-specific authorization/validation slice are deliberately implemented and verified;
- the existing public `WATCH` Event read may be used for truthful presentation of already persisted Watch events;
- unsupported presentation data must remain absent rather than fabricated;
- the product-owner-supplied collector-ticket artwork is the canonical Watch ticket visual master and is governed through shared UI brand ownership;
- runtime Watch data may populate only the designated master regions; event-specific rendered tickets are not stored as separate artwork;
- Web and Telegram consume the same shared Watch presentation tree and canonical data.

## First authorized presentation slice

The first Watch presentation slice may:

- replace the generic Watch capability page with a dedicated Watch discovery surface;
- list truthful persisted public `WATCH` Events;
- render those events over the supplied collector-ticket master;
- list approved Watch Places from the existing capability API;
- preserve the existing verified Place-owner application flow behind a secondary business entry;
- expose search and location filters from data currently available.

It must not:

- enable Watch event creation;
- invent home/away club identities, crests, venue photography, official-venue linkage or other data not currently owned by the model;
- add a parallel Watch RSVP/check-in/event lifecycle;
- duplicate Place or Platform Admin persistence.

## Follow-up dependency

The next backend dependency for full Watch behavior is a deliberate canonical Event-to-Place relationship. Only after that relationship and its authorization rules are proven may Watch creation and Place-aware Watch detail become enabled.
