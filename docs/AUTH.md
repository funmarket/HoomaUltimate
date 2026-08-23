# HOOMA — Authentication

Status: **Locked authentication architecture**

## 1. Principles

HOOMA has exactly two authenticated entry systems:

1. Telegram Mini App authentication.
2. Classic Web username/password authentication.

They resolve independently to one canonical `User`. Authentication proves identity; domain authorization is evaluated separately.

No heuristic automatic account linking.

A delivery-platform identity is not by itself a HOOMA account. Privacy-safe public browsing must not silently provision a canonical `User` or `UserPresentation`. Account creation happens only when the visitor explicitly creates an account or crosses a protected action boundary.

## 2. Telegram authentication

Telegram has two deliberately separate steps:

```text
Telegram Mini App
 -> initData
 -> API receives explicit Telegram credential
 -> server cryptographically validates initData
 -> look up an existing TelegramIdentity/User without creating one
 -> existing account may become the request principal
```

For a first-time Telegram visitor, valid initData proves the Telegram delivery identity but does **not** create a HOOMA account during public browsing.

When that visitor explicitly chooses a protected action such as join, create, participate, challenge or contribute:

```text
protected action intent
 -> explicit Create HOOMA account screen/action
 -> validate Telegram initData again server-side
 -> create TelegramIdentity + canonical User + UserPresentation transactionally
 -> return to the requested HOOMA route
 -> protected action can proceed through normal server authorization
```

Requirements:

- validate Telegram signature/hash server-side;
- enforce Telegram freshness rules according to final configured max age;
- never trust frontend Telegram user JSON without validated initData;
- `TELEGRAM_BOT_TOKEN` is required for Telegram production startup;
- explicitly supplied invalid Telegram credentials fail closed and are not silently treated as anonymous;
- a valid but not-yet-provisioned Telegram visitor remains a public browser until explicit account activation;
- account activation is idempotent for an already existing TelegramIdentity;
- secrets never appear in logs or frontend bundles.

## 3. Web registration

Required fields:

- login username;
- password;
- display username.

Optional/progressive fields:

- email;
- display name.

Validation:

- normalize login username deterministically;
- enforce uniqueness in the database;
- normalize optional email consistently before uniqueness checks;
- validate display username separately from login username;
- return structured conflict errors without leaking sensitive account details.

When a Web guest crosses a protected action boundary, the default destination is the Create account flow with the original safe internal `returnTo`. Existing account holders can switch to Sign in from the same authentication surface.

## 4. Password storage

Use **Argon2id**.

Do not retain V3 scrypt in the final implementation.

Configuration must be centralized, versionable and production-safe. Store only the encoded Argon2id hash containing algorithm parameters/salt/hash; never plaintext passwords or reversible encryption.

Password verification should support future parameter upgrades: after successful login, rehash when the stored parameters no longer meet policy.

## 5. Web login

Flow:

```text
username + password
 -> normalize username
 -> rate-limit / account-policy check
 -> locate WebCredential
 -> Argon2id verify
 -> create opaque random session token
 -> persist secure hash of token only
 -> set HttpOnly session cookie
 -> return authenticated state
```

Never store the raw bearer/session token in PostgreSQL.

## 6. Web sessions

`WebSession` should include enough state for:

- token hash;
- user ID;
- created time;
- expires time;
- revoked time;
- last-used/security metadata only where justified;
- optional session-family/device metadata if later needed.

Cookie policy:

- `HttpOnly`;
- `Secure` in production;
- deliberate `SameSite` policy;
- explicit path/domain policy;
- expiration aligned with server session expiry.

Logout revokes the server-side session and clears the cookie. Logout is a state-changing action and receives write-origin/CSRF protection appropriate to the final HTTP design.

## 7. Login abuse protection

Implement layered controls:

- IP/client rate limiting;
- username/account-oriented throttling without user-enumeration leaks;
- bounded failed-attempt tracking;
- temporary lockout/backoff;
- structured security logging that never logs passwords/session tokens.

Exact thresholds belong in central config and tests, not scattered constants.

## 8. CSRF / write-origin protection

Cookie-authenticated Web writes require explicit protection. Final implementation may combine SameSite cookies, Origin/Referer verification and CSRF tokens according to deployment topology, but must be tested for all mutation methods.

Telegram credential transport is not a reason to disable Web CSRF protections.

## 9. Dual-credential conflict

A request may technically present both a valid Web session and valid Telegram credential.

Resolution rule:

- both resolve same User -> allowed;
- only one existing valid account credential supplied -> use that principal;
- valid Telegram initData with no HOOMA account -> no member principal until explicit account activation;
- explicitly supplied invalid credential -> fail according to credential type, do not silently downgrade;
- valid Telegram -> User A and valid Web -> User B -> `AUTH_CONFLICT`.

Never choose one credential by precedence in a conflict.

## 10. Account linking

Not part of the initial merge unless explicitly added later.

Forbidden automatic merge signals:

- matching username;
- matching email alone;
- display name;
- city/Houma;
- photo/avatar;
- profile similarity.

Any future link flow must prove control of both identities and maintain audit/security evidence.

## 11. Public browsing and action gating

Public routes do not require an authenticated principal. They may optionally recognize credentials for personalized non-sensitive projections, but they must not provision a new HOOMA account merely because a delivery credential is present. Invalid explicitly supplied credentials are handled safely.

Anonymous/non-profile visitors may browse public HOOMA surfaces including public Community, Team, Play, Watch, Places, ULTRAS and Gamers discovery as those domains exist.

Protected actions include join, create, RSVP, edit, manage, claim, contribute/pay, challenge, GamerProfile creation, GamerSquad membership, and member-private access.

When a Web guest triggers a protected action:

`current URL -> /register?returnTo=<encoded current URL> -> Create account or choose Sign in -> successful auth -> validated internal returnTo`

When a first-time Telegram visitor triggers a protected action:

`current URL -> /account/create?returnTo=<encoded current URL> -> explicit Create HOOMA account -> validated Telegram provisioning -> validated internal returnTo`

`returnTo` must be restricted to safe internal destinations to avoid open redirects.

A HOOMA account/profile is reusable across all domains. Gamers, Team, HOOMA Community, ULTRAS and other features must never require a second application account.

## 12. Production environment validation

Central config validation distinguishes runtime applications.

API/Telegram production configuration requires Telegram secrets when Telegram auth or notification delivery is enabled as mandatory product behavior.

Web production validates cookie/security origins and public API URLs.

No hardcoded bot token, bot username, bot ID, Mini App URL, database password or session secret.

## 13. Authentication tests

Required tests:

- Web registration success;
- duplicate normalized username;
- optional email behavior/uniqueness;
- Argon2id hash/verify;
- Web login success/invalid password;
- throttling and lockout behavior;
- opaque cookie/session storage and revocation;
- logout write protection;
- expired/revoked session rejection;
- Telegram valid initData;
- Telegram invalid signature/freshness;
- invalid explicitly supplied Telegram credential does not become anonymous;
- valid first-time Telegram browsing does not create `User`, `UserPresentation` or `TelegramIdentity`;
- explicit Telegram account activation creates the canonical account exactly at the action boundary;
- dual-auth same User;
- `AUTH_CONFLICT` for different Users;
- public browsing without auth;
- safe `returnTo` behavior;
- no credential/token leakage in logs/responses.
