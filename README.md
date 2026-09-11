# EazyShortener

A production-minded URL shortener and API platform built to demonstrate practical backend engineering, system design, security, caching, analytics, API design, and maintainable application architecture.

> **Status:** Active development. The repository is being implemented incrementally toward the v1 architecture described below.

![NestJS](https://img.shields.io/badge/NestJS-TypeScript-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

EazyShortener is more than a basic `URL -> short code` demo. The project is designed around the concerns that appear in real backend systems:

- guest and authenticated user flows
- email verification and web authentication
- API-token based client access
- atomic batch operations
- redirect caching with Redis
- rate limiting and abuse protection
- privacy-aware click analytics
- predictable HTTP and error contracts
- PostgreSQL persistence with Prisma
- automated tests and CI
- server-rendered web UI without introducing a separate SPA

The goal is to keep the product scope intentionally small while showing production-oriented engineering decisions clearly.

## Landing Page

The public web experience is based on the approved Penpot design stored in `docs/design/`.

![EazyShortener landing page](docs/design/eazyshortener-landing-final.png)

## Key Features

### Guest users

- Shorten one URL per request without registration.
- Choose optional link expiration.
- Receive a cryptographically generated short code.
- Follow generated short URLs through the public redirect endpoint.
- Protected by stricter IP-based rate limits.

### Registered users

- Register with email and password.
- Verify email before account activation.
- Sign in using JWT-based first-party web authentication.
- Create, list, update, activate, and deactivate owned links.
- Create custom aliases.
- Create and revoke API tokens.
- Receive an initial API token after successful email verification.
- View redirect analytics for owned links.

### Client API

- Bearer-token authentication using dedicated API tokens.
- Batch shortening of 1-10 URLs per request.
- Atomic batch creation: if one item fails validation or conflicts, the whole batch is rolled back.
- Input order is preserved in the response.
- Per-link expiration and optional custom aliases.
- Swagger / OpenAPI documentation.

### Redirect and analytics

- `302 Found` for active links.
- `404 Not Found` for missing or inactive links.
- `410 Gone` for expired links.
- Redis cache-aside lookup for redirect performance.
- Cache TTL never outlives link expiration.
- Privacy-aware click analytics with no raw visitor IP persistence.
- Analytics failures are isolated so they never block a valid redirect.

## Tech Stack

| Area | Technology |
| --- | --- |
| Backend | NestJS, TypeScript |
| Runtime | Node.js LTS |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache / rate limiting | Redis |
| Web UI | NestJS server-rendered templates, minimal CSS/JavaScript |
| Authentication | JWT for web sessions, hashed Bearer API tokens |
| Password hashing | Argon2id |
| Secret derivation | HKDF-SHA256 from a single `APP_SECRET` with purpose-specific context |
| Email | SMTP-compatible provider, Mailpit for local development |
| API documentation | Swagger / OpenAPI |
| Testing | Jest, Supertest |
| Local infrastructure | Docker, Docker Compose |
| CI | GitHub Actions |
| License | MIT |

## Architecture

EazyShortener uses a modular monolith architecture. The application keeps web, API, redirect, authentication, token, caching, and analytics concerns separated into focused NestJS modules while sharing one PostgreSQL database and Redis instance.

```mermaid
flowchart LR
    G[Guest Browser] --> WEB[Server-rendered Web]
    U[Registered User Browser] --> WEB
    C[API Client] --> API[REST API / Bearer Token]

    WEB --> APP[NestJS Application]
    API --> APP

    APP --> AUTH[Auth / API Token Modules]
    APP --> LINKS[Links Module]
    APP --> MAIL[SMTP / Mailpit]

    R[GET /:code] --> REDIRECT[Redirect Module]
    REDIRECT --> CACHE[(Redis)]
    REDIRECT --> DB[(PostgreSQL)]
    REDIRECT -. failure isolated .-> ANALYTICS[Analytics Module]
    ANALYTICS --> DB

    AUTH --> DB
    LINKS --> DB
    LINKS --> CACHE

    DOCS[Swagger / OpenAPI] --- API
```

### Redirect path

```text
GET /:code
  -> Redis lookup
      -> cache hit: validate active + expiration -> 302
      -> cache miss: PostgreSQL -> validate -> cache -> 302
  -> record analytics independently
```

### Core design decisions

- `short_code` is the single canonical routing key for both generated codes and custom aliases.
- Generated codes use cryptographically secure 7-character Base62 values.
- Custom aliases are normalized to lowercase and globally unique.
- PostgreSQL unique constraints are the final authority for code collisions.
- API-token expiration and short-link expiration are independent.
- Raw API tokens and email-verification tokens are never stored.
- Redirect cache entries are invalidated when a link changes.
- The web UI is server-rendered to keep the portfolio focus on backend engineering rather than frontend framework complexity.

## Data Model

The core persistence model contains five main entities:

```text
User
  ├── EmailVerificationToken
  ├── ApiToken
  └── Link
        └── ClickEvent
```

A `Link` may belong to a registered user or have `user_id = null` when created anonymously through the guest website.

## Security and Privacy

Security decisions are part of the application design rather than an afterthought:

- passwords are hashed with Argon2id
- minimum password length is 12 characters
- JWT web sessions use HttpOnly, SameSite cookies
- JWT signing and analytics IP hashing use separate HKDF-SHA256 derived keys from a single application root secret
- API tokens use the `ez_live_` prefix and are persisted only as SHA-256 hashes
- email-verification tokens are random, hashed, expiring, and single-use
- raw JWTs, API tokens, verification tokens, Authorization headers, and Cookie headers are excluded from logs
- raw visitor IP addresses are not persisted
- optional visitor fingerprints use HMAC-SHA256 with a purpose-specific derived key; raw IP addresses and the root secret are never persisted with analytics
- only referrer hostnames are stored for analytics, not full URLs or query strings
- cookie-authenticated state-changing requests require same-origin Origin/Host validation
- API, authentication, verification, and guest-shortening flows have independent rate-limit policies

## API Example

Authenticated integrations use a dedicated API token instead of the browser JWT session.

### Request

```http
POST /api/v1/shorten
Authorization: Bearer ez_live_xxxxxxxxxxxxxxxxx
Content-Type: application/json
```

```json
{
  "links": [
    {
      "url": "https://example.com/articles/backend-architecture",
      "expiresAt": "2026-12-31T23:59:59Z",
      "customAlias": "backend-architecture"
    },
    {
      "url": "https://example.com/docs/api",
      "expiresAt": null
    }
  ]
}
```

### Example response

```json
{
  "links": [
    {
      "id": "7d39df5e-59cf-4d8a-bd56-3bf0dcfcf523",
      "shortCode": "backend-architecture",
      "shortUrl": "http://localhost:3000/backend-architecture",
      "originalUrl": "https://example.com/articles/backend-architecture",
      "expiresAt": "2026-12-31T23:59:59.000Z"
    },
    {
      "id": "b6e46af9-aad8-46b8-a1a8-b37ccad44f03",
      "shortCode": "K7pQ2xA",
      "shortUrl": "http://localhost:3000/K7pQ2xA",
      "originalUrl": "https://example.com/docs/api",
      "expiresAt": null
    }
  ]
}
```

The batch is limited to 10 URLs and is transactional: either every link is created or none are.

### Standard error shape

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [],
  "timestamp": "2026-08-22T07:00:00.000Z",
  "path": "/api/v1/shorten",
  "requestId": "req_01J5XYZ..."
}
```

## Installation

### Prerequisites

- Node.js LTS
- pnpm 10 (managed through Corepack)
- Existing Laradock services for PostgreSQL, Redis, and Mailpit

### Local setup

```bash
git clone <your-repository-url>
cd EazyShortener

corepack enable
pnpm install
cp .env.example .env
```

### Environment configuration

Edit `.env` after copying `.env.example`.

The application connects to PostgreSQL through `DATABASE_URL`. `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are used by the local PostgreSQL container during bootstrap and should match the credentials embedded in `DATABASE_URL`.

`APP_SECRET` is the application's root secret. Generate one strong random value for each environment, for example:

```bash
openssl rand -base64 48
```

The application does not reuse `APP_SECRET` directly for multiple cryptographic purposes. It derives purpose-specific keys with HKDF-SHA256, including separate keys for JWT signing and analytics IP hashing. This keeps the environment configuration simple while preserving key separation inside the application.

Do not commit the real `APP_SECRET` or your local `.env` file. Rotating `APP_SECRET` invalidates JWTs and changes derived analytics fingerprints, so production rotation should be planned rather than done casually.

After configuring `.env`, make sure the required local services are already running. This project reuses the existing Laradock environment for PostgreSQL, Mailpit, and Redis instead of starting duplicate project-level containers. Point `DATABASE_URL`, the SMTP settings, and `REDIS_URL` in `.env` at those local services. In the current local Laradock setup, Mailpit SMTP is exposed on `localhost:1125`, the Mailpit web inbox is available at `http://localhost:8125`, and Redis is exposed on `localhost:6379` with authentication enabled. Keep the real Redis password only in `.env`; do not commit it.

Apply the Prisma schema and start the application:

```bash
pnpm exec prisma migrate dev
pnpm start:dev
```

The application is expected to run at:

```text
http://localhost:3000
```

Local API documentation will be exposed through Swagger once the API module is enabled in the implementation.

## Development

Common development commands:

```bash
# start in watch mode
pnpm start:dev

# type-check / build
pnpm build

# unit tests
pnpm test

# end-to-end tests
pnpm test:e2e

# lint
pnpm lint
```

Database workflow:

```bash
# create/apply a development migration
pnpm exec prisma migrate dev

# inspect data with Prisma Studio
pnpm exec prisma studio
```

Local infrastructure:

EazyShortener does not ship a project-local Compose stack. Start PostgreSQL, Redis, and Mailpit from the existing Laradock environment, configure their connection values in `.env`, then verify all three dependencies from the project root:

```bash
pnpm local:check
```

The check connects to PostgreSQL with Prisma, authenticates to Redis through `REDIS_URL`, and verifies the Mailpit SMTP greeting. It reports only service status and never prints connection credentials. Once all checks report `OK`, start EazyShortener with `pnpm start:dev`.

## Project Structure

The target source layout follows NestJS feature modules rather than large cross-cutting files:

```text
src/
├── analytics/
├── api-tokens/
├── auth/
├── cache/
├── client-api/
├── common/
├── config/
├── database/
├── health/
├── links/
├── mail/
├── rate-limit/
├── redirect/
└── web/

prisma/
├── schema.prisma
└── migrations/

views/              server-rendered templates
public/             static assets
docs/design/        approved UI reference
```

Controllers are kept thin, business logic lives in services/domain helpers, and persistence, authentication, DTO, guard, and transport concerns remain separated.

## Testing and CI

The project is designed to include:

- focused unit tests for domain and security rules
- controller/service integration coverage
- Supertest-based HTTP end-to-end tests
- database-backed tests for transactional behavior
- redirect status and cache behavior tests
- authentication and API-token security tests
- GitHub Actions for automated build, lint, and test checks

## API Conventions

- Client-facing APIs are versioned under `/api/v1/...`.
- Pagination defaults to `page=1&pageSize=20` with a maximum `pageSize=100`.
- Stable application error codes are preferred over parsing human-readable messages.
- Important status codes include `400`, `401`, `403`, `404`, `409`, `410`, `429`, `500`, and `503`.

## Engineering Focus

This repository is intentionally designed as a compact portfolio project that demonstrates:

- backend architecture and modular design
- secure authentication and credential handling
- relational data modelling and transactional consistency
- REST API design and documentation
- caching and invalidation strategy
- rate limiting and abuse prevention
- privacy-aware analytics
- observability-friendly error and request handling
- automated testing and CI discipline

## License

Distributed under the MIT License. See `LICENSE` for details.