# Client API Integration Examples

## Endpoint

Authenticated integrations shorten URLs through:

`POST /api/v1/shorten`

Use a dedicated API token in the `Authorization` header:

`Authorization: Bearer ez_live_<token>`

The browser JWT cookie is not used for this endpoint.

A request contains a `links` array with 1-10 items. Each item supports:

- `url` — required target URL;
- `customAlias` — optional custom short code;
- `expiresAt` — optional ISO-8601 expiration timestamp or `null`.

The batch is atomic: if one item fails validation or collides, no links from that request are committed.

The response preserves input order and returns `id`, `shortCode`, `shortUrl`, `originalUrl`, and `expiresAt` for each created link.

## Environment variables used in examples

```bash
export EAZY_BASE_URL="http://localhost:3000"
export EAZY_API_TOKEN="ez_live_replace_me"
```

## curl — one item

```bash
curl -sS \
  -X POST "$EAZY_BASE_URL/api/v1/shorten" \
  -H "Authorization: Bearer $EAZY_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "links": [
      {
        "url": "https://example.com/docs/getting-started",
        "customAlias": "getting-started",
        "expiresAt": "2026-12-31T23:59:59Z"
      }
    ]
  }'
```

Example response shape:

```json
{
  "links": [
    {
      "id": "7d39df5e-59cf-4d8a-bd56-3bf0dcfcf523",
      "shortCode": "getting-started",
      "shortUrl": "http://localhost:3000/getting-started",
      "originalUrl": "https://example.com/docs/getting-started",
      "expiresAt": "2026-12-31T23:59:59.000Z"
    }
  ]
}
```

## curl — ten-item batch

```bash
curl -sS \
  -X POST "$EAZY_BASE_URL/api/v1/shorten" \
  -H "Authorization: Bearer $EAZY_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "links": [
      {"url":"https://example.com/1"},
      {"url":"https://example.com/2"},
      {"url":"https://example.com/3"},
      {"url":"https://example.com/4"},
      {"url":"https://example.com/5"},
      {"url":"https://example.com/6"},
      {"url":"https://example.com/7"},
      {"url":"https://example.com/8"},
      {"url":"https://example.com/9"},
      {"url":"https://example.com/10","expiresAt":null}
    ]
  }'
```

Sending 11 items is rejected. The API limit is independent from the per-token request rate limit.

## JavaScript — one item

```js
const baseUrl = process.env.EAZY_BASE_URL ?? 'http://localhost:3000';
const apiToken = process.env.EAZY_API_TOKEN;

if (!apiToken) throw new Error('EAZY_API_TOKEN is required');

const response = await fetch(`${baseUrl}/api/v1/shorten`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    links: [
      {
        url: 'https://example.com/products/42',
        customAlias: 'product-42',
        expiresAt: null,
      },
    ],
  }),
});

if (!response.ok) {
  throw new Error(`EazyShortener returned ${response.status}: ${await response.text()}`);
}

const result = await response.json();
console.log(result.links[0].shortUrl);
```

## JavaScript — ten-item batch

```js
const baseUrl = process.env.EAZY_BASE_URL ?? 'http://localhost:3000';
const apiToken = process.env.EAZY_API_TOKEN;

if (!apiToken) throw new Error('EAZY_API_TOKEN is required');

const links = Array.from({ length: 10 }, (_, index) => ({
  url: `https://example.com/articles/${index + 1}`,
  expiresAt: null,
}));

const response = await fetch(`${baseUrl}/api/v1/shorten`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ links }),
});

if (!response.ok) {
  throw new Error(`EazyShortener returned ${response.status}: ${await response.text()}`);
}

const result = await response.json();
for (const link of result.links) console.log(link.shortUrl);
```

## TypeScript — reusable client

```ts
export interface ShortenInput {
  url: string;
  customAlias?: string | null;
  expiresAt?: string | null;
}

export interface ShortenedLink {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  expiresAt: string | null;
}

export interface ShortenResponse {
  links: ShortenedLink[];
}

export async function shortenLinks(
  baseUrl: string,
  apiToken: string,
  links: ShortenInput[],
): Promise<ShortenResponse> {
  if (links.length < 1 || links.length > 10) {
    throw new Error('links must contain between 1 and 10 items');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/shorten`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ links }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`EazyShortener ${response.status}: ${body}`);
  }

  return (await response.json()) as ShortenResponse;
}
```

One-item usage:

```ts
const result = await shortenLinks(
  'http://localhost:3000',
  process.env.EAZY_API_TOKEN!,
  [{ url: 'https://example.com/one', customAlias: 'one', expiresAt: null }],
);

console.log(result.links[0].shortUrl);
```

Ten-item usage:

```ts
const result = await shortenLinks(
  'http://localhost:3000',
  process.env.EAZY_API_TOKEN!,
  Array.from({ length: 10 }, (_, index) => ({
    url: `https://example.com/batch/${index + 1}`,
  })),
);

console.log(result.links.map((link) => link.shortUrl));
```

## Expiration and aliases

`expiresAt` must represent a future timestamp. `null` or omission means the link does not expire automatically.

Custom aliases are normalized to lowercase by the server and share the same globally unique `shortCode` namespace as generated codes. Do not assume the API preserves alias casing.

## Rate limiting

The default API profile permits 30 requests per 60 seconds per API token. Responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining`. A rejected request returns `429` with a `Retry-After` header.

Batch size and request rate are separate controls: one successful request may contain up to 10 links.

## Errors and API documentation

Errors use the application's standard HTTP error envelope with fields including `statusCode`, `error`, `message`, `path`, `requestId`, and `timestamp`.

Interactive Swagger documentation is available at `/docs`; the OpenAPI JSON document is available at `/docs-json` when the application is running.
