# ADR-042 — HOOMA Community privacy and membership requests

Status: **ACCEPTED**

## Decision

HOOMA Communities gain an explicit visibility model and a separate membership-request lifecycle.

Canonical Community visibility:

```text
PUBLIC | PRIVATE
```

Canonical join policy:

```text
OPEN | APPROVAL_REQUIRED
```

The initial product UI exposes a simple Public/Private choice:

- `PUBLIC` defaults to `OPEN` join behavior unless the product later exposes policy separately.
- `PRIVATE` uses `APPROVAL_REQUIRED`.

Existing Communities migrate to `PUBLIC` + `OPEN` so current behavior is preserved unless the Founder changes it.

A pending join request is **not** a membership. `CommunityMembership` remains the single source of truth for active members and roles. Pending requests live in a dedicated `CommunityJoinRequest` lifecycle and never grant member-only access.

Canonical request lifecycle:

```text
PENDING | APPROVED | DECLINED | CANCELLED
```

For a private HOOMA:

1. an authenticated non-member requests to join;
2. the Founder can approve or decline;
3. approval transactionally creates/reactivates the canonical `CommunityMembership` as `MEMBER` and marks the request `APPROVED`;
4. rejection marks the request `DECLINED`;
5. a requester may cancel a still-pending request;
6. the Founder may directly add an existing HOOMA User as a member without a request.

Private Communities may expose a privacy-safe discovery shell so people can find and request access, but member-private content, member directory, Whistle content, and Community-owned private activity must not leak to outsiders.

Public discovery and downstream public projections must respect Community visibility. Teams, Events, and Discovery/HOOMA NOW must not expose private-Community child activity to unauthorised public callers merely because the child record itself is active/published.

## Ownership

- Communities owns visibility, join policy, membership requests, and membership authorization.
- `CommunityMembership` remains canonical member truth.
- Teams, Events, Whistle, and Discovery consume Community access policy through explicit application boundaries; they do not query or duplicate Community privacy rules independently in UI code.
- PostgreSQL owns durable visibility/request state.

## Media boundary

This ADR does not redefine media storage. Community media remains a separate Media/Object Storage slice. Media bytes belong in S3-compatible object storage when managed media is implemented.

## Reason

A cosmetic Private toggle would be unsafe because the current system treats every ACTIVE Community as public and joins outsiders immediately. The privacy model therefore must exist at the canonical Community domain and persistence layers, with explicit downstream enforcement and a real request state machine.
