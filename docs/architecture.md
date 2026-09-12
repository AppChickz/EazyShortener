# EazyShortener Architecture

## Overview

EazyShortener is a modular NestJS monolith. One application process serves the server-rendered web UI, authenticated client API, public redirects, health endpoints, and Swagger documentation. PostgreSQL is the source of truth, Redis is an acceleration and abuse-protection dependency, and SMTP is used for verification mail.

## Runtime components

- **NestJS application** — HTTP routing, validation, authentication, link management, analytics, health checks, and server-rendered views.
- **PostgreSQL + Prisma** — users, verification tokens, API tokens, links, and click events.
- **Redis** — redirect cache and fixed-window rate-limit counters.
- **SMTP / Mailpit** — email verification delivery in local development.
- **Swagger/OpenAPI** — client API documentation at `/docs` and `/docs-json`.

Local development reuses the existing Laradock PostgreSQL, Redis, and Mailpit services. The repository does not require a second project-local Compose stack.

## Request paths

### Guest web flow

A guest browser submits one URL to the guest endpoint. Guest requests are IP-rate-limited, validated, and stored as links with no `user_id`. Guests cannot use the client API.

### Registered web flow

Registration creates a pending user and sends a single-use verification token by email. After verification the account becomes active and may receive an initial API token. Browser login creates a JWT-backed HttpOnly cookie. Cookie-authenticated state-changing requests are protected by same-origin validation.

### Client API flow

External clients call `/api/v1/shorten` with a dedicated `ez_live_...` Bearer token. The raw token is hashed before lookup and never stored. Batch requests contain 1–10 items and run in one database transaction so partial creation cannot occur.

### Redirect flow

`GET /:code` first checks Redis. On a cache miss, PostgreSQL is queried by canonical `short_code`. Missing or inactive links return 404, expired links return 410, and valid links return 302. Cache TTL is capped so it never outlives link expiration. Link mutations invalidate the redirect cache.

Click analytics are recorded separately from redirect success. Analytics failures are isolated and must not block an otherwise valid redirect.

## Trust boundaries

1. **Public internet → NestJS** — untrusted HTTP input is size-limited and globally validated; security headers and request IDs are applied centrally.
2. **Browser session boundary** — first-party web authentication uses an HttpOnly, SameSite JWT cookie plus same-origin checks for mutations.
3. **Client API boundary** — integrations authenticate with dedicated Bearer API tokens rather than browser JWTs.
4. **Application → PostgreSQL** — Prisma owns persistence and transaction boundaries; database uniqueness is the final collision authority.
5. **Application → Redis** — Redis stores derived cache/rate-limit state, not primary business records.
6. **Application → SMTP** — verification mail contains a one-time raw verification token; only its SHA-256 hash is persisted.
7. **Analytics privacy boundary** — raw visitor IP addresses are not persisted. Optional IP fingerprints use an HMAC key derived from `APP_SECRET`.

## Availability and health

- `/health/live` reports application liveness.
- `/health/ready` checks PostgreSQL and Redis readiness.
- Redirect analytics are intentionally fail-open relative to redirect delivery.
- PostgreSQL remains the source of truth when Redis cache entries are absent.

## Deployment shape

The production `Dockerfile` uses a multi-stage Node.js 22 build, installs with pnpm, prunes development dependencies, and runs the final image as the non-root `node` user. Configuration is injected through environment variables; secrets are not baked into the image.

See `architecture.mmd` for the component and trust-boundary diagram.
