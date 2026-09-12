# EazyShortener Database Model

EazyShortener uses PostgreSQL through Prisma. PostgreSQL is the system of record; Redis contains derived cache and rate-limit state only.

## Entities

### User (`users`)

- `id` UUID primary key
- `email` unique
- `password_hash`
- `status` — `PENDING`, `ACTIVE`, or `DISABLED`
- `email_verified_at` nullable
- `created_at`, `updated_at`

Relations: one user may own many links, verification tokens, and API tokens.

### EmailVerificationToken (`email_verification_tokens`)

- `id` UUID primary key
- `user_id` required FK to `users`
- `token_hash` unique
- `expires_at`
- `used_at` nullable
- `created_at`

The raw verification token is never persisted. Deleting a user cascades to verification tokens.

Indexes: `user_id`, `expires_at`, unique `token_hash`.

### ApiToken (`api_tokens`)

- `id` UUID primary key
- `user_id` required FK to `users`
- `name`
- `token_prefix`
- `token_hash` unique
- `expires_at`, `revoked_at`, `last_used_at` nullable
- `created_at`

The raw API token is returned only at issuance and is not stored. Deleting a user cascades to API tokens.

Indexes: `user_id`, `expires_at`, `(user_id, created_at)`, unique `token_hash`.

### Link (`links`)

- `id` UUID primary key
- `user_id` nullable FK to `users`
- `short_code` unique canonical routing key
- `original_url`
- `expires_at` nullable
- `is_active`
- `created_via` — `GUEST_WEB`, `USER_WEB`, or `API`
- `created_at`, `updated_at`

`user_id = NULL` represents a guest-created link. Registered web/API links have an owner. `short_code` is used for both generated codes and normalized custom aliases.

Indexes: unique `short_code`, `user_id`, `expires_at`, `(user_id, created_at)`.

### ClickEvent (`click_events`)

- `id` UUID primary key
- `link_id` required FK to `links`
- `clicked_at`
- `referrer_host` nullable
- `user_agent` nullable
- `ip_hash` nullable

Deleting a link cascades to its click events. Raw visitor IP addresses are not stored.

Indexes: `(link_id, clicked_at)`, `(link_id, referrer_host)`, `clicked_at`.

## Relationship and deletion rules

- User → EmailVerificationToken: one-to-many, cascade delete.
- User → ApiToken: one-to-many, cascade delete.
- User → Link: one-to-many, optional from the Link side because guest links have no owner.
- Link → ClickEvent: one-to-many, cascade delete.

## Query-oriented indexes

The final v1 index set supports the implemented access paths:

- redirect lookup by unique `short_code`
- owned-link pagination by `(user_id, created_at)`
- API-token listing by `(user_id, created_at)`
- verification/API-token lookup by unique hash
- expiration-related maintenance queries
- analytics history by `(link_id, clicked_at)`
- referrer aggregation by `(link_id, referrer_host)`
- retention cleanup by `clicked_at`

Migrations are stored under `prisma/migrations/`; `prisma/schema.prisma` remains the canonical application schema.
