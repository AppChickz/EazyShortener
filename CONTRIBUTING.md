# Contributing to EazyShortener

Thanks for contributing. EazyShortener is intentionally small in product scope but strict about backend quality, security, tests, migrations, and repository hygiene.

## Toolchain

Use the repository-pinned package manager and supported runtime:

- Node.js 22 or newer;
- pnpm 10.30.3 or compatible 10.x;
- Corepack enabled;
- PostgreSQL, Redis, and Mailpit available locally through the existing Laradock environment.

Do not use `npm install` or Yarn in this repository. The `preinstall` guard enforces pnpm for normal install workflows.

## Initial setup

```bash
corepack enable
pnpm install
cp .env.example .env
```

Configure `.env` for your local Laradock PostgreSQL, authenticated Redis instance, and Mailpit SMTP service. Never commit `.env` or real credentials.

Verify local dependencies before starting development:

```bash
pnpm local:check
```

A healthy local setup reports PostgreSQL, Redis, and Mailpit SMTP as available.

Apply migrations and start the app:

```bash
pnpm exec prisma migrate dev
pnpm start:dev
```

## Branch workflow

Use `dev` as the normal integration branch. Create focused feature/fix branches from the current `dev` branch and merge them back through review. Keep `main` for release-ready history rather than day-to-day feature development.

Recommended branch names include:

- `feature/<short-description>`
- `fix/<short-description>`
- `hotfix/<short-description>` for urgent release fixes

Avoid long-lived branches that accumulate unrelated work.

## Commit discipline

Keep commits small and coherent. One commit should represent one logical task when practical.

Use concise imperative subjects such as:

- `feat: add ...`
- `fix: correct ...`
- `perf: optimize ...`
- `test: cover ...`
- `docs: document ...`
- `chore: ...`
- `ci: ...`

Do not mix formatting churn, unrelated refactors, generated files, and behavior changes into the same commit.

## Development checks

Before requesting review, run the checks relevant to your change:

```bash
pnpm run lint
pnpm typecheck
pnpm run test
pnpm run build
```

Formatting can be checked with:

```bash
pnpm run format:check
```

The test suite contains database-backed HTTP E2E coverage, so local PostgreSQL must be configured correctly. The E2E harness substitutes deterministic in-memory Redis and captured mail where isolation is required.

## CI

GitHub Actions runs on pushes and pull requests. The validation job provisions PostgreSQL and Redis, then runs:

1. frozen-lockfile pnpm install;
2. Prisma client generation;
3. `prisma migrate deploy`;
4. lint;
5. TypeScript `tsc --noEmit`;
6. tests;
7. build.

A contribution should not be considered ready while CI is failing.

## Database and Prisma changes

`prisma/schema.prisma` is the source of truth for the data model. Database changes require a committed Prisma migration.

For development schema changes:

```bash
pnpm exec prisma migrate dev --name <descriptive_name>
```

Review the generated SQL before committing it. A migration should contain only the changes intended by that task. Do not edit or replace historical migrations merely to make a fresh local database look cleaner.

When a schema change modifies generated Prisma types, run:

```bash
pnpm run prisma:generate
```

Index changes should be justified by actual query patterns rather than added speculatively.

## API and security changes

Preserve these v1 contracts unless the project plan is deliberately revised:

- browser sessions use the HttpOnly JWT cookie model;
- external clients use hashed Bearer API tokens;
- raw API tokens and email-verification tokens are not persisted;
- guest links may have `user_id = null`;
- generated short codes and custom aliases share the canonical `short_code` namespace;
- API shortening batches contain 1-10 links and are atomic;
- raw visitor IP addresses are not stored in analytics;
- Redis cache TTL must never outlive link expiration;
- cache invalidation must accompany redirect-affecting link mutations.

Do not log secrets, passwords, Authorization/Cookie headers, or raw tokens.

## Documentation

If behavior, environment variables, endpoints, architecture, or setup commands change, update the relevant documentation in the same logical change.

Important references include:

- `README.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/short-links.md`
- `docs/cache-and-rate-limits.md`
- `docs/security.md`
- `docs/api-examples.md`

Documentation must describe implemented behavior accurately. Future architecture should be labeled as roadmap rather than presented as already deployed.

## Scope control

v1 deliberately excludes features such as OAuth/social login, refresh tokens, password reset, billing, teams, custom domains, QR-code generation, CDN/edge redirect implementation, queues, and Kubernetes.

If a contribution requires changing that scope, update and review the project plan first rather than silently expanding the implementation.

## Pull-request checklist

Before review, confirm that:

- the working tree contains no secrets or temporary/debug files;
- pnpm is used and `pnpm-lock.yaml` is consistent;
- migrations are included and reviewed when the schema changes;
- lint/typecheck/tests/build pass;
- security and privacy contracts remain intact;
- documentation reflects externally visible changes;
- the change is focused enough to review independently.
