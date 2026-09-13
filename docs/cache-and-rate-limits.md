# Cache and Rate-Limit Design

## Purpose

EazyShortener uses Redis for two distinct runtime concerns:

1. redirect destination caching, to keep the hot redirect path away from PostgreSQL when possible; and
2. request-rate counters, to apply independent abuse controls to guest, authentication, and API-token traffic.

The two concerns share one Redis connection layer but use different key prefixes and lifecycle rules.

## Redirect cache

The redirect cache is a cache-aside layer in front of PostgreSQL.

For `GET /:shortCode` the application first reads `redirect:<shortCode>` from Redis. A cache hit returns the stored destination and continues with analytics recording. A miss loads the link from PostgreSQL, rejects missing/inactive links with `404`, rejects expired links with `410`, then caches the valid destination before returning a `302` redirect.

Only valid redirect destinations are cached. Missing, inactive, or already-expired links are not negative-cached.

### TTL alignment

`REDIRECT_CACHE_MAX_TTL_SECONDS` defaults to `3600` seconds.

Permanent links use that configured maximum TTL. For links with an expiration time, the cache TTL is:

`min(REDIRECT_CACHE_MAX_TTL_SECONDS, floor(expiresAt - now))`

If fewer than one whole second remains, the entry is not cached. This guarantees that Redis cannot keep serving a destination beyond the link's database expiration.

### Invalidation

The routing key is immutable in v1. Link mutations that can change redirect behavior invalidate `redirect:<shortCode>` after the database update succeeds. This covers destination changes, expiration changes, deactivation, and reactivation.

The next redirect is therefore a cache miss and repopulates Redis from the authoritative PostgreSQL row.

### Consistency model

PostgreSQL is the source of truth. Redis is disposable acceleration state. If Redis data is lost, valid redirects can be rebuilt from PostgreSQL on demand.

The current implementation does not use negative caching, distributed cache tags, or background refresh-ahead.

## Rate limiting

Rate limits use Redis fixed-window counters. A request consumes a key of the form:

`rate-limit:<scope>:<subject>`

The Redis operation increments the counter and inspects its TTL. A new counter, or one without a valid TTL, receives the configured window expiry. The guard returns `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers. Rejected requests also receive `Retry-After` and a `429 Too Many Requests` response.

The implementation is intentionally simple and deterministic for v1. It is not a sliding-window or token-bucket algorithm.

## Profiles and subjects

| Profile | Subject | Default limit | Default window |
| --- | --- | ---: | ---: |
| `guest` | request IP | 30 requests | 3600 s |
| `auth` | request IP | 10 requests | 900 s |
| `api` | SHA-256 fingerprint of the Bearer token | 30 requests | 60 s |

Guest and authentication limits therefore constrain traffic per observed client IP. API traffic is scoped per API token rather than per IP, allowing independent integration clients behind shared networks.

The raw Bearer token is not used as a Redis key. The guard hashes the token with SHA-256 before passing it to the rate-limit service.

## Configuration

The relevant environment variables are:

- `REDIS_URL`
- `REDIRECT_CACHE_MAX_TTL_SECONDS=3600`
- `GUEST_RATE_LIMIT_WINDOW_SECONDS=3600`
- `GUEST_RATE_LIMIT_MAX_REQUESTS=30`
- `AUTH_RATE_LIMIT_WINDOW_SECONDS=900`
- `AUTH_RATE_LIMIT_MAX_REQUESTS=10`
- `API_RATE_LIMIT_WINDOW_SECONDS=60`
- `API_RATE_LIMIT_MAX_REQUESTS=30`

Local development reuses the authenticated Redis instance provided by the existing Laradock environment. Credentials belong in `.env`, never in committed files.

## Failure and scaling considerations

Redis is currently a required runtime dependency: the cache, rate-limit guard, and readiness endpoint use the same Redis service. `/health/ready` therefore fails when Redis is unavailable.

For a higher-scale deployment, Redis high availability, explicit fail-open/fail-closed policy per feature, observability around counter/cache failures, and a more advanced rate-limit algorithm can be introduced without changing the external short-link data model.
