# Scalability Roadmap

## Baseline: v1 architecture

EazyShortener v1 is a modular NestJS application backed by one PostgreSQL database and one Redis instance. Redirects use Redis cache-aside, authenticated writes go to PostgreSQL, rate limiting uses Redis counters, and click analytics are currently written directly to PostgreSQL on the redirect path as best-effort work.

This is intentionally a compact portfolio architecture. The items below are a roadmap, not claims about what v1 already runs in production.

## Target thought experiment: 10 million redirects per day

Ten million redirects per day is roughly 116 requests per second when averaged across 24 hours. Real traffic is bursty, so capacity planning must use peak throughput, cache-hit ratio, link distribution, geographic latency, and write amplification rather than the daily average alone.

The architectural goal is to keep the redirect path cheap, horizontally scalable, and tolerant of dependency degradation while preserving PostgreSQL as the authoritative link store.

## Stage 1 — Stateless application pool

The current application should remain stateless at the HTTP process level. JWT browser sessions and Bearer API tokens already avoid in-memory session affinity, and durable link state lives in PostgreSQL/Redis.

A first scaling step is therefore multiple identical NestJS instances behind a load balancer. Instances should share:

- PostgreSQL;
- Redis;
- the same application secrets/configuration;
- external SMTP infrastructure.

No sticky sessions should be required for normal web/API traffic.

Operational additions at this stage should include structured metrics, latency histograms, cache hit/miss ratios, Redis/PostgreSQL pool metrics, and centralized logs keyed by request ID.

## Stage 2 — Redis high availability

At redirect-heavy scale, Redis becomes critical because it serves hot destinations and rate-limit counters.

A production evolution can use managed Redis or Redis Sentinel/clustered infrastructure with replication and automatic failover. Capacity planning should consider:

- memory consumed by redirect keys and counter keys;
- eviction policy;
- replication lag;
- connection-pool limits;
- hot-key behavior for extremely popular short codes.

Redirect cache entries remain disposable because PostgreSQL is authoritative. Rate-limit counters have stronger behavioral significance, so the application should explicitly define fail-open or fail-closed behavior per traffic class before operating across Redis failures.

## Stage 3 — PostgreSQL read scaling

Cache misses and management/analytics queries still reach PostgreSQL. As traffic grows, separate read-heavy workloads from write authority.

Possible steps include:

1. tune indexes and connection pools first;
2. introduce one or more read replicas for eligible read-only queries;
3. keep writes, uniqueness enforcement, token state changes, and transactional batch creation on the primary;
4. route replica reads only where temporary replication lag is acceptable.

Redirect cache misses may use a replica only if the stale-read implications for deactivation/expiration are acceptable. Otherwise they should remain on the primary or use explicit invalidation/versioning semantics.

## Stage 4 — Asynchronous analytics

The current v1 redirect path performs analytics recording as best-effort database work. At higher redirect volume, synchronous analytics writes should be removed from the latency-critical path.

A future design can publish a small click event to a durable queue or stream and return the redirect without waiting for PostgreSQL analytics persistence. Consumers can batch inserts, aggregate counters, enforce retention, and retry independently.

Possible technologies include managed queues/streams or systems such as Kafka, RabbitMQ, SQS, or Redis Streams. No queue is implemented in v1.

Queue design should preserve the current privacy contract: no raw IP persistence, referrer hostname only, bounded user-agent storage, and HMAC-derived IP fingerprints where retained.

## Stage 5 — Analytics partitioning and archival

At sustained high click volume, `click_events` will dominate row count. PostgreSQL range partitioning by `clicked_at` is a natural next step because retention is time-based.

Benefits include:

- bounded index sizes per partition;
- easier deletion/drop of expired data;
- faster time-range scans;
- simpler cold-data archival.

Aggregated daily/hourly tables can serve dashboards without repeatedly scanning raw events. Raw event retention may remain short while aggregates are retained longer if product requirements permit.

## Stage 6 — CDN or edge redirects

The largest latency and origin-load reduction comes from moving globally popular redirects closer to users.

A future edge layer could cache immutable routing records or resolve redirects from an edge key-value store. The control plane would still use the NestJS application and PostgreSQL for creation/update/ownership rules, while changes would invalidate or version edge entries.

Important design constraints include:

- deactivation and expiration propagation delay;
- custom-alias uniqueness remaining authoritative in PostgreSQL;
- cache purge/version semantics;
- analytics delivery from edge locations;
- protection against serving stale destinations after security-sensitive changes.

CDN/edge redirect execution is explicitly outside v1.

## Hot links and cache strategy

A small number of short codes may account for a large fraction of traffic. Those hot keys should normally remain Redis/edge hits and avoid PostgreSQL.

Future improvements may include longer cache TTLs with versioned invalidation, refresh-ahead for hot entries, local in-process read-through caches with very short TTLs, and prewarming for known campaigns. Each adds consistency complexity and should be justified by measured miss rates rather than introduced preemptively.

## Write-path scaling

Link creation is far less frequent than redirect traffic but requires stronger consistency. PostgreSQL must remain the authority for:

- short-code/custom-alias uniqueness;
- ownership;
- activation state;
- expirations;
- API-token state;
- atomic batches.

At larger scale, code generation can continue to be decentralized because uniqueness is enforced by the database. Collision retries should remain bounded.

## Capacity and SLO thinking

For a 10M-redirect/day target, planning should track at least:

- redirects/second at average and peak;
- p50/p95/p99 redirect latency;
- Redis cache hit ratio;
- PostgreSQL redirect-miss QPS;
- analytics events/second and queue lag;
- Redis memory and evictions;
- database connections and replication lag;
- error rates by 302/404/410/429/5xx outcomes.

Load testing should use realistic hot/cold link distributions and burst patterns rather than a uniform request stream.

## Recommended progression

Do not jump directly from the v1 modular monolith to a distributed system. A pragmatic sequence is:

1. instrument and load-test the current app;
2. horizontally scale stateless NestJS instances;
3. harden Redis and PostgreSQL operations;
4. move analytics off the redirect path;
5. add replicas/partitioning as measured data requires;
6. introduce CDN/edge redirects only when global latency or origin throughput justifies the added invalidation complexity.

This preserves the simple v1 model for as long as it remains effective while keeping clear seams for later scale-out work.
