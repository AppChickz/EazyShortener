# Security and Privacy Model

## Scope

EazyShortener v1 uses a compact security model built around first-party browser sessions, dedicated API tokens, strict secret handling, bounded abuse controls, and privacy-aware analytics. The goal is to protect credentials and reduce unnecessary personal-data retention without adding identity or threat-detection features that are outside the v1 scope.

## Root secret and key separation

`APP_SECRET` is the root application secret and must be at least 32 bytes. It is never used directly for multiple cryptographic purposes.

`AppKeyService` derives 32-byte purpose-specific keys with HKDF-SHA256:

- `eazyshortener:v1:jwt` for JWT signing;
- `eazyshortener:v1:ip-hash` for analytics IP HMAC values.

This prevents JWT signing and analytics fingerprinting from sharing the same effective key material.

## Passwords

Passwords must contain 12-128 Unicode characters. They are hashed with Argon2id using the current application parameters:

- memory cost: `19456` KiB;
- time cost: `2`;
- parallelism: `1`.

Only the Argon2 hash is persisted. Password verification uses the Argon2 library against that encoded hash.

## Browser authentication

The first-party web interface uses an HS256 JWT containing `sub`, `email`, `iat`, and `exp`. The signing key is derived from `APP_SECRET`; the root secret itself is not embedded in the token.

The default JWT lifetime is controlled by `JWT_ACCESS_TTL_SECONDS` and defaults to 3600 seconds.

After login, the JWT is stored in the configured `JWT_COOKIE_NAME` cookie with:

- `HttpOnly=true`;
- `SameSite=Lax`;
- `Secure=true` in production;
- `Path=/`;
- cookie lifetime aligned with the JWT TTL.

Cookie-authenticated state-changing requests are also protected by same-origin Origin/Host validation. This is an additional boundary beyond SameSite cookie behavior.

The external client API does not use this browser cookie; it uses Bearer API tokens.

## API tokens

API tokens are high-entropy bearer credentials with the `ez_live_` prefix. The raw token is returned only when issued. Persistence stores a SHA-256 token hash and a short non-secret prefix for identification; raw tokens are not stored in PostgreSQL.

API tokens can be revoked and can optionally expire. The initial token issued after email verification defaults to 30 days through `INITIAL_API_TOKEN_TTL_DAYS`; setting that value to `0` creates a non-expiring initial token.

API rate-limit Redis keys do not contain raw bearer tokens. The guard derives a SHA-256 fingerprint of the presented bearer token before using it as the rate-limit subject.

## Email verification tokens

Email verification tokens are generated from 32 random bytes and encoded as base64url. PostgreSQL stores only their SHA-256 hash together with expiration and one-time-use state.

Verification is atomic: the token must exist, have `used_at = null`, and have an expiration later than the verification time. Reuse or expiry is rejected.

The default verification lifetime is 24 hours through `EMAIL_VERIFICATION_TTL_SECONDS=86400`.

## Request validation and HTTP hardening

The application enables a global NestJS validation pipe with whitelisting and rejection of non-whitelisted fields. Request bodies are bounded by `BODY_LIMIT_BYTES`, which defaults to 1 MiB.

The HTTP layer applies explicit CORS configuration, disables unnecessary framework disclosure, emits security headers, and enables HSTS in production. Cookie-authenticated mutations require same-origin validation.

Errors use a standardized response filter. Unknown internal exceptions return a generic 500 message rather than exposing implementation details.

## Logging and request IDs

Every HTTP request receives an `x-request-id`; a safe incoming identifier may be reused, otherwise a new UUID is generated.

`SafeLogger` redacts these headers:

- `Authorization`;
- `Cookie`;
- `Set-Cookie`;
- `X-API-Key`.

It also redacts sensitive URL query parameters including `token`, `access_token`, `api_key`, and `apikey`.

Passwords, password hashes, raw API tokens, raw verification tokens, and JWT credentials must not be intentionally logged.

## Analytics privacy

Redirect analytics are best-effort and cannot block a valid redirect.

The application stores:

- click timestamp;
- referrer hostname only, not the complete referrer URL/query string;
- user agent truncated to 2048 characters;
- optional HMAC-SHA256 IP fingerprint.

Raw visitor IP addresses are not stored in `ClickEvent`. The IP fingerprint uses the separate HKDF-derived IP-hash key, so it is not a plain SHA-256 hash and cannot be reproduced without application key material.

Analytics retention defaults to 90 days through `ANALYTICS_RETENTION_DAYS`. A daily in-process cleanup removes `ClickEvent` rows older than the configured cutoff.

## Data and infrastructure trust boundaries

PostgreSQL is trusted with application state and credential hashes, but not raw API or verification tokens. Redis is trusted with redirect destinations and rate-limit counters; it is not a durable source of truth. SMTP receives verification mail content and therefore must be treated as a trusted delivery dependency.

Production secrets belong in environment configuration or the deployment platform's secret store. `.env` is local-only and must never be committed.

## Availability versus security behavior

Redis is currently a required runtime dependency because redirect caching, rate limiting, and readiness checks share the Redis service. The application does not silently bypass rate limits when Redis is unavailable.

Analytics are deliberately different: recording failures are swallowed so telemetry cannot break the redirect path.

## Explicit v1 non-goals

The v1 design does not implement OAuth/social login, refresh tokens, password reset, MFA, malware/phishing scanning, teams/organizations, billing, device fingerprinting, geolocation analytics, or automated production CD. These should not be inferred from the existing security controls.
