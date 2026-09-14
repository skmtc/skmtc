# 2026-09-13 — Effect client functions per operation, and overlays over a vendor document

Continuation of `2026-09-13-effect-schema-vendor-generators.md`, as a distinct
phase: `gen-effect-http` changed from emitting endpoint data to emitting one
Effect client function per operation over the caller's `HttpClient`; Cloudflare's
document was patched with an OpenAPI Overlay (`@skmtc/openapi-overlays`) before
generation; and both Cloudflare providers in the consumer app moved onto the
generated functions, on a vendor `HttpClient` layer.

## Knowledge acquired

The overlay workflow around `skmtc generate`, the operation-generator shape for a
vendor client, and the hub's listing API.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **`skmtc generate` applies no overlay; `@skmtc/openapi-overlays` is a library and a CLI, and the join is `client.json#source` pointing at a file.** The working shape is a pre-step: fetch the pinned document → `applyOverlay(doc, overlay, { strict: true })` → write `.skmtc/<project>/openapi.json` (gitignored) → `source` names that path (repo-relative, like `packages/api-spec/dist/openapi.json`). Nothing in the CLI or the skills says how the two fit; I inferred it from `source` accepting a path. | skmtc-cli task card: "patching a vendor document with an overlay" — the pre-step, the gitignore, and where `source` points |
| K2 | **An overlay `remove` on a component's `enum` is the sanctioned way to open a vendor's closed enum.** Removing `$.components.schemas['…_status-3'].enum` made the model generator emit `Schema.String` for a state Cloudflare adds to over time, and every consumer of the component followed — the provider-side "widen the generated Struct's `fields`" workaround from the earlier session went away. The defect stays described beside the pin, with its reason, rather than in provider code. | The same card: an example that is not an `allOf` repair — "the document is stricter than the wire" is the commoner case |
| K3 | **`insertNormalizedModel`'s return carries the definition's name but not where it landed.** To re-export a co-located `…Params`/`…Body`/`…Response` from the barrel I had to infer co-location by name prefix (`startsWith(fallbackName-stem)`), because a `$ref` body comes back under its own name at its own path and there is no field on the returned definition saying which case occurred. Coupled with `2026-09-13-effect-schema-vendor-generators.md` K1 (the peer's constructor never runs for a normalized schema, so it cannot register itself), a projection that consumes normalized models has no clean way to get them into a barrel. | API reference: the shape of `insertNormalizedModel`'s return, and whether an export path should be on it |
| K4 | The hub's listing endpoint is `GET https://api.skmtc.dev/v1/apis?limit=100&cursor=…` → `{ items, pagination: { hasMore, totalCount, nextCursor } }` (95 pages for the whole catalogue), and `GET /v1/search?q=…` returns typed hits (`type: "api"`, owner, URLs). Neither is documented on the landing page, which names only `POST /v1/apis/lookup`. | Hub docs: the three read endpoints in one place |
| K5 | The listing endpoint reports `specType: null` and `refetchEnabled: false` on every one of 9,477 items, while the lookup endpoint reports `specType: "openapi"` and `refetchEnabled: true` for the same records. The list view is a thinner projection than the detail view, and the field names suggest otherwise. | See entry #2 |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | A normalized model cannot be re-exported by anyone: its producer's constructor never runs, and its consumer is not told where it landed | friction | open |
| 2 | The hub's list endpoint returns `null`/`false` for fields the detail endpoint fills | polish | open |
| 3 | The vendor-client operation shape: a function over the caller's `HttpClient`, transport-free | win | open |

---

### 1. A normalized model cannot be re-exported by anyone: its producer's constructor never runs, and its consumer is not told where it landed [friction]

Making the `…Params` / `…Body` / `…Response` schemas an operation inserts through
`insertNormalizedModel` reachable from the package barrel that the projections
otherwise maintain themselves.

**What happened:** The model projection registers its own barrel line in its
constructor (so components reached only through a Driver are exported). That
never fires for a normalized schema — the engine builds it from the
`schemaToValueFn` static and registers the definition itself. So the operation
projection has to do it, and all it gets back is `{ identifier, … }`: no export
path, no flag for "this was a `$ref` and lives elsewhere" versus "this was inline
and co-located with you". I ended up with

```ts
const coLocated = [paramsName, bodyName, responseName]
  .filter((n): n is string => n !== null && n.startsWith(name))   // name = capitalize(identifier)
```

— a name-prefix heuristic standing in for a fact the engine has.

**What was expected:** Either the peer's constructor participates in the
normalized path (so its own registrations apply), or the returned definition
says where it was written, so the consumer can register the re-export
correctly.

**Why it matters:** Barrels are the consumer-facing surface of a generated
package — the `tsdown` entry, the thing an app imports. Every other definition
gets there by its producer's own rule; the normalized ones fall through both
producer and consumer. The heuristic works today because the fallback names are
derived from the operation's identifier, which the operation skill prescribes,
but it is coupling to a naming convention rather than to a fact.

**Possible fixes:** unresolved — expose the export path (or a `coLocated`
boolean) on `insertNormalizedModel`'s return; or run the peer projection's
constructor for normalized schemas with the caller's settings; or let the entry
declare a barrel once and have the engine re-export every definition it registers
under the root.

**Version anchor:** `@skmtc/core@0.28.3`, `@skmtc/lang-typescript@0.12.17`

**Status:** open

### 2. The hub's list endpoint returns `null`/`false` for fields the detail endpoint fills [polish]

Paging the whole catalogue through `GET /v1/apis` to answer "which APIs are in
skmtc.dev".

**What happened:** All 9,477 rows carry `"specType": null` and
`"refetchEnabled": false`. The lookup endpoint (`POST /v1/apis/lookup`) returns
the same records with `"specType": "openapi"`, `"refetchEnabled": true` and a
`sourceUrl`. A consumer reading the list to find refetch-tracked OpenAPI documents
concludes there are none.

**Possible fixes:** fill the fields in the list projection, or omit them there so
absence is not mistaken for a value.

**Version anchor:** hub as of 2026-09-13 (`api.skmtc.dev`)

**Status:** open

### 3. The vendor-client operation shape: a function over the caller's `HttpClient`, transport-free [win]

Supersedes `2026-09-13-effect-schema-vendor-generators.md` #5 (endpoint as data),
which turned out to be the halfway point.

**What happened:** For each `include`d operation the generator now emits

```ts
export const getApiAccountsAccountIdR2Buckets = (params: typeof GetApiAccountsAccountIdR2BucketsParams.Type) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(`/accounts/${params.account_id}/r2/buckets`).pipe(
      HttpClientRequest.setUrlParams({ name_contains: params.name_contains, cursor: params.cursor, … }),
      HttpClientRequest.setHeaders({ "cf-r2-jurisdiction": … }),
    );
    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(GetApiAccountsAccountIdR2BucketsResponse)(response);
  });
```

with these rules, each of which a first attempt got wrong or nearly did:

- **Require only `HttpClient`.** Base URL, auth, retry and status policy are the
  layer the caller provides (`HttpClient.mapRequest(prependUrl, bearerToken)` +
  a `transformResponse`). One generator then serves every vendor, and a test
  provides a stub client. The temptation is to bake a base URL or an auth
  header in — the document even names a `servers` entry — and that is what makes
  a generated client unusable behind a proxy, in a test, or with a second token.
- **The signature reflects the operation.** No parameters → no `params`; no JSON
  body → no `body`; a bodiless response → `execute` and return void, and no
  `HttpClientResponse` import. A uniform `(params, body)` signature reads
  cleanly but makes every GET take an empty object and every 204 decode nothing.
- **One `params` object for path, query and header**, from
  `operation.toParametersObject()` inserted through the model peer; the function
  splits it by `operation.toParams(['path' | 'query' | 'header'])` names at
  render, header values stringified. Path interpolation is
  `toPathTemplate(path, 'params')`.
- **Bodies and answers go through the schemas**
  (`HttpClientRequest.schemaBodyJson(Body)`, `HttpClientResponse.schemaBodyJson(Response)`)
  — never a hand-written type.
- **The vendor's failure convention lives in the layer, not the function.**
  Cloudflare reports refusals in the body regardless of status; the consumer's
  `transformResponse` reads the body first, and — because the `HttpClient`
  service's failure type is fixed at `HttpClientError` — carries the typed
  refusal as the `cause` of a `StatusCodeError`, unwrapped once at the provider
  boundary. The function itself knows nothing of this.

**Why it matters:** The operation skill's exemplars are all *clients that own
their transport* (a fetch function, a hook). For a third-party API, the thing
the document uniquely knows is the shapes and the request line; the transport
is the consumer's, and often vendor-specific in ways no generator should guess
at (multipart uploads, body-carried error codes, egress rules). Splitting it this
way is what let one generator cover Firecrawl and Cloudflare with no per-vendor
code in the generator, and what let the consumer keep its 404/10004 idempotency
handling exactly where it was.

**Possible fixes:** a row in skmtc-operation §1 for this family, and the five
rules above as its section; optionally a stock generator for it.

**Version anchor:** `@skmtc/core@0.28.3`, `@skmtc/lang-typescript@0.12.17`, `effect@4.0.0-rc.113`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | K1/K2 — the overlay pre-step around `skmtc generate` | It is the answer to the earlier session's #2 (a refused `allOf` degrading to void) and to "the document is stricter than the wire", and nothing today says how overlays and `generate` connect. | skmtc-cli task card |
| 2 | #1 — normalized models fall through both barrels | Any generator that consumes `insertNormalizedModel` and maintains a barrel needs the heuristic or loses those exports. | SKMTC code (return shape) or API reference |
| 3 | #3 — the transport-free client function | The next agent asked for "an Effect client for vendor X" will bake in the base URL and auth; the split is the non-obvious part. | skmtc-operation skill |
