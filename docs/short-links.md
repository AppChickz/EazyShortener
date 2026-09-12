# Short Links and Expiration Design

## Canonical routing key

EazyShortener stores one canonical `short_code` per link. Generated codes and user-selected custom aliases share the same column, uniqueness constraint, redirect route, and cache namespace. There is no second alias-routing mechanism.

## Generated short codes

Generated codes use the Base62 alphabet:

```text
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
```

The implementation generates **7 characters**, giving a theoretical code space of:

```text
62^7 = 3,521,614,606,208
```

Codes are case-sensitive. Random bytes come from Node.js `crypto.randomBytes`. Bytes `248–255` are rejected before applying modulo 62 because 248 is divisible by 62; this avoids modulo bias across the alphabet.

Before creation, the service checks whether a candidate already exists and also rejects reserved route names. The implementation allows the initial candidate plus up to five collision retries. PostgreSQL's unique `short_code` constraint remains the final concurrency-safe authority.

## Custom aliases

Custom aliases are normalized to lowercase before storage. They must:

- be 3–32 characters long
- start with an ASCII letter or digit
- contain only `a-z`, `0-9`, `_`, or `-`
- not collide with reserved application routes such as `api`, `docs`, `health`, `login`, or `register`
- be globally unique in the same `short_code` namespace as generated codes

Guest-created links cannot choose a custom alias. Registered web/API flows may provide one.

## Redirect semantics

The public redirect route is `GET /:shortCode` and returns **302 Found** for a valid active link.

Resolution behavior is:

1. check Redis redirect cache
2. on a miss, query PostgreSQL by unique `short_code`
3. missing or inactive link → **404 Not Found**
4. expired link → **410 Gone**
5. valid link → cache destination with a safe TTL and return **302 Found**
6. record analytics independently so analytics failure does not invalidate the redirect

A 302 is intentional: the destination may be changed by the owner without changing the short code, so clients and intermediaries should not treat the mapping as permanently immutable.

## Link expiration

`Link.expires_at` is nullable and stored as a timestamp. `NULL` means the link does not expire automatically. Supplied expiration values must parse as valid date/times and be strictly in the future when the link is created or updated.

At redirect time, a link is expired when `expires_at <= now`. Expired links return 410 rather than 404 so expiration is distinguishable from a missing/inactive mapping.

Redis cache TTL never outlives link expiration. Permanent links use the configured redirect-cache maximum TTL; expiring links use the smaller of that maximum and their remaining lifetime. Very short remaining lifetimes are not cached. Destination, expiration, activation, or deactivation changes invalidate the cached redirect entry.

## API-token expiration is independent

Short-link lifetime and API-token lifetime are separate concerns. Expiring an API token does **not** expire links previously created with that token, and link expiration does not affect the token.

User-created API tokens may have an optional future `expires_at`; no expiration means the token remains valid until revoked or otherwise invalidated. The initial token issued after email verification uses `INITIAL_API_TOKEN_TTL_DAYS` (default 30 days). Setting that configuration to `0` creates the initial token without automatic expiration.

API authentication rejects tokens that are unknown, revoked, expired, or owned by a user who is not active and email-verified.

## Operational implications

- The large Base62 space plus cryptographically secure sampling keeps accidental collisions rare, while application checks and the database uniqueness constraint make collision handling explicit.
- Lowercasing custom aliases provides a predictable user-controlled namespace while generated codes remain case-sensitive.
- A single canonical routing key simplifies redirects, cache invalidation, analytics association, and uniqueness rules.
- Nullable link/token expiration allows permanent resources without special sentinel dates.
