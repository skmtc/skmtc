# 2026-09-13 — Effect Schema generators and vendor-document projects

Authored two in-house generators in a consumer monorepo (`tradespring`): a model
generator emitting Effect 4 `Schema` values from the skmtc-model skeleton, and an
operation generator emitting one endpoint-as-data const per operation. Then ran
them over two third-party documents fetched from skmtc.dev (Firecrawl, 44 ops;
Cloudflare, 3,465 ops / 25 MB) as separate skmtc projects, scoped with `include`,
and wired the output into the app's vendor clients.

## Knowledge acquired

Authoring against `@skmtc/core@0.28.3` / `@skmtc/lang-typescript@0.12.17`, CLI
`0.9.41`, with several projects sharing one set of local generators.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **`insertNormalizedModel` never runs the peer projection's constructor.** It builds the value through the `schemaToValueFn` static and names it through `createIdentifier`, then registers a definition itself. Anything a projection does in its constructor beyond building the value — a barrel re-export via `registerInto`, the recursion `typeName` annotation — does not happen for a normalized (inline) schema. I moved barrel registration from the entry into the constructor so Driver-reached components would be exported, and the normalized `…Body` / `…Response` definitions still were not. | skmtc-model §3 says the two statics "make the projection consumable by peers"; it should say the constructor is bypassed, and list what therefore does not apply to normalized output |
| K2 | **Generator-scoped enrichments (`[id]._generator`) are read for a projection that is only ever reached through a Driver**, with the generator's entry absent from the stack. A vendor project whose worker holds only `gen-effect-http` still routed `gen-effect-schema`'s components to the root named under `gen-effect-schema`'s `_generator` block. So a "dependency-only" generator can be configured without being run. | skmtc-generator §4 (enrichments) — one sentence: routing is by generator id in `client.json`, independent of the stack |
| K3 | **`worker.ts` is derived from the project `deno.json#imports`** — every alias that is not `@skmtc/worker` / `@skmtc/core` becomes a stack member. A generator that another generator depends on must be reachable through the *dependant's* own `deno.json` (as a workspace member), not listed in the project's imports, or it joins the stack and generates its whole subject set. | skmtc-cli reference §6 or the bundle card: say what `worker.ts` is built from |
| K4 | **Deno refuses a workspace member outside the workspace directory** (`Workspace member must be nested in a directory under the workspace`), so sharing one local generator across `.skmtc/<a>/` and `.skmtc/<b>/` needs a symlink (`.skmtc/b/gen-x -> ../a/gen-x`). Deno, `skmtc bundle` and `skmtc generate` all follow the symlink; git stores it as a symlink. | skmtc-cli task card: "one generator, several projects" is a real workflow with no card |
| K5 | **`client.json#source` takes a URL, and the hub has two document URLs that are not interchangeable.** `https://skmtc.dev/<owner>/apis/<slug>/revisions/<ref>?raw` is the raw document; the `…skmtc.workers.dev/v1/apis/<owner>/<slug>/revisions/<ref>/schema` URL the hub's own `.md` page advertises as "OpenAPI document" returns an envelope `{ format, contentType, content: "<json string>" }`. Only the first works as a `source`. | Hub markdown page: link the `?raw` URL; skmtc-cli source card: show a hub-pinned `source` |
| K6 | **The hub lookup API is `POST https://api.skmtc.dev/v1/apis/lookup` with `{ "items": [{ "name": "…" }] }`.** The landing page says "ask … through `POST /v1/apis/lookup`" with no host and no body shape; `skmtc.dev/v1/apis/lookup` is 404, and the validation errors had to be walked (`items` expected array → `items.0` expected object → `items.0.name` expected string). Results carry `links.schemaLatest` / `links.schema`, the exact strings for `source`. | Landing page / hub docs: host + a one-line request example |
| K7 | `toArtifacts` in a test needs `settings.packages` (`{ rootPath, moduleName }`) for emitted imports to be rewritten to `@/…`; with `settings: undefined` they render as raw repo-relative paths. The skeleton test passes `undefined` and pins the raw form, so a generator whose real project uses `packages` has its import header untested by the skeleton's pins. | skmtc-model skeleton `mod.test.ts`: pass a `packages` entry and pin the `@/` form |
| K8 | An `allOf` whose members disagree on `type` (`{ result: { type: "object" } }` ∧ `{ result: { type: "array", items } }` — Cloudflare's "override the envelope" idiom) is refused with an error-level `INVALID_RESPONSE`, and the operation's `toSuccessResponse()` then resolves to nothing. The generator sees no response and emits its void fallback. Cloudflare's document does this on ~700 responses. | See entry #2 |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc generate --json` exits 1 on error-level parse issues with `errors: []`, so a `&&` chain stops on a clean run | friction | open |
| 2 | A refused `allOf` on a response degrades silently to the generator's void fallback | friction | open |
| 3 | `skmtc/single-dispatch` fires on a pattern the stock gen-zod carries | polish | open |
| 4 | `skmtc init` / `bundle` strip the trailing newline from sibling projects' `deno.json` and `client.json` | polish | open |
| 5 | Endpoint-as-data is the right operation shape for a vendor document | win | superseded by 2026-09-13-effect-http-client-overlays.md#3 |

---

### 1. `skmtc generate --json` exits 1 on error-level parse issues with `errors: []`, so a `&&` chain stops on a clean run [friction]

Running the Cloudflare project (`include` scoped to 13 of 3,465 operations) from
the monorepo's `pnpm generate` script, which chains three projects with `&&`.

**What happened:** The run wrote all 113 files, the envelope had
`"type": "generated"`, `"errors": []`, and every included item `success` — and the
process exited 1, because the document carries 730 error-level parse issues
(`INVALID_RESPONSE`, `INVALID_SCHEMA`) on paths the project never includes. The
`&&` chain stopped there, and CI's drift job would have too. The skill's own
contract ("for `generate --json`, an empty `errors` array is the success condition
— not the exit code alone") turned out to describe the envelope, not the exit
code, and the two disagree. Firecrawl's document, with 2 warnings, exits 0.

I ended up wrapping the CLI in a 40-line script that parses the last top-level
JSON object off stdout and judges by `errors` — the documented rule, reimplemented
because the binary does not apply it to its own exit status.

**What was expected:** Exit 0 whenever the envelope says the run generated with no
errors; exit 1 reserved for what the exit-code table calls "fatal parseIssue"
(nothing generated).

**Why it matters:** `2026-07-24-deep-index-catalog-backfill.md` K1 already
established that error-level parse issues do not mean unusable artifacts, for the
runtime response. The CLI encodes the opposite policy in the one channel a shell
pipeline reads. Any consumer that scopes a large third-party document with
`include` — the documented purpose of `include` — hits this, because the issues are
on the parts they excluded. The workaround also has a subtle cost: the envelope is
the *last* JSON object on stdout after any log lines, so the wrapper has to find it
by scanning for the last unindented `{` — a shape the reference §8 does not
promise.

**Possible fixes:** unresolved — exit 0 when `errors` is empty regardless of parse
issue severity; or an explicit `--fail-on parse-error|error|never`; or count only
issues on *included* subjects toward the exit status. Whichever, the skill's
"success condition" sentence and the exit-code table should agree with the binary.

**Version anchor:** `@skmtc/cli@0.9.41`, `@skmtc/core@0.28.3`

**Status:** open

### 2. A refused `allOf` on a response degrades silently to the generator's void fallback [friction]

Generating `GET /accounts/{account_id}/d1/database` from Cloudflare's document
through an operation generator that inserts `operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty()`.

**What happened:** The 200 response is
`allOf: [ d1_api-response-common (result: {type: object}), { properties: { result: { type: array, items } } } ]`.
The parser reports `Cannot merge schemas: conflicting types 'object' and 'array'`
at error level and drops the response. `toSuccessResponse()` then returns
`undefined`, the `?? OasVoid.empty()` idiom — the one the skmtc-operation skill
prescribes — fires, and the emitted endpoint reads
`response: Schema.Void` with no marker that anything went wrong at that item.
The manifest records the *item* as `success`. I only noticed because I read the
file; the other 12 endpoints in the same run were fine.

**What was expected:** Either the merge takes the last member's `type` (every
Cloudflare SDK reads this idiom as an override), or the operation fails as an
item so the manifest and the `--json` envelope name it, or the response is
handed to the generator as `unknown` rather than absent.

**Why it matters:** The void fallback exists for operations that genuinely have
no body (a 204). Conflating "no body" with "body the parser refused" turns a
document defect into a typed lie — a consumer decoding with `Schema.Void` rejects
every real answer, and nothing between parse and render said so. The item-level
`success` is the part that hides it: the generator cannot tell the two cases apart
either, because `toSuccessResponse()` is `undefined` for both. The document idiom is
not exotic — it is how Cloudflare (and Stripe, in places) express a typed `result`
over a shared envelope — and a branch named `skmtc-allof-cycles` suggests `allOf`
handling is already under work.

**Possible fixes:** unresolved — a last-wins merge policy for scalar `type`
conflicts under `allOf`; or `toSuccessResponse()` returning an `OasUnknown` with
the parse issue attached, so the void fallback only fires on a genuinely absent
body; or the parse issue's location being matched against the item so the item is
recorded `error`, not `success`.

**Version anchor:** `@skmtc/core@0.28.3`

**Status:** open

### 3. `skmtc/single-dispatch` fires on a pattern the stock gen-zod carries [polish]

Filling the skeleton's array slot by imitation of `gen-zod`'s `ZodArray`, as the
generator skill's §2 says to.

**What happened:** `ZodArray` takes `schema?: OasSchema | OasRef<'schema'>` for
attribution and narrows inside the snippet — `if (schema?.type === 'array') { …minItems… }`
— to read `minItems`/`maxItems`. Copying that shape, `deno lint` with
`jsr:@skmtc/lint-plugin@0.1.0` fails it:
`schema?.type === 'array' outside the router — mapping is decided in exactly one place`.
The stock generator the skill names as the pattern source would not pass the
lint plugin the skill says to keep wired. The fix was easy (the router passes the
narrowed `OasArray`; the snippet reads `items`/`minItems`/`maxItems` off it) and
arguably better, but the imitation-then-lint loop cost a cycle that pointed at
the exemplar.

**Why it matters:** The skill's method is "clone the structure, swap the target
syntax" and its safety net is the lint plugin. When the exemplar and the lint
disagree, the agent has to decide which is authoritative — and the stock
generator's shape is the one training data reinforces. Either the exemplar should
be lint-clean or the skeleton (which *is* lint-clean here — it passes `schema` for
attribution only) should be named as the pattern for this slot instead of gen-zod.

**Possible fixes:** run the lint plugin over the stock generators; or in the
skeleton's array slot, note that `minItems`/`maxItems` come off a narrowed
`OasArray` the router passes, not off the attribution `schema`.

**Version anchor:** `@skmtc/gen-zod@0.0.59`, `jsr:@skmtc/lint-plugin@0.1.0`

**Status:** open

### 4. `skmtc init` / `bundle` strip the trailing newline from sibling projects' `deno.json` and `client.json` [polish]

Creating `.skmtc/firecrawl/` and `.skmtc/cloudflare/` beside an existing
`.skmtc/tradespring/`, in a repo whose formatter (oxfmt) enforces a final newline.

**What happened:** After `skmtc init firecrawl .` and a bundle, `git status` showed
`.skmtc/tradespring/deno.json` and `.skmtc/tradespring/.settings/client.json`
modified — the diff was `\ No newline at end of file` and nothing else. Something
in the init/bundle path rewrote files of a *sibling* project it had no reason to
touch, and serialised them without the final newline. Two `git checkout`s fixed
it, but in a repo with a pre-commit formatter this shows up as a spurious diff on
every project operation.

**Possible fixes:** write only the project being operated on; serialise JSON with a
trailing newline; or skip the write when the parsed content is unchanged.

**Version anchor:** `@skmtc/cli@0.9.41`

**Status:** open

### 5. Endpoint-as-data is the right operation shape for a vendor document [win]

Deciding what an operation generator should emit for Firecrawl's and Cloudflare's
documents, whose responses we consume are inline on the operations rather than
named components.

**What happened:** A model generator alone produced Firecrawl's 52 components and
missed the one thing we needed — `POST /search`'s inline 200. The skmtc-operation
skill's exemplars are all *clients* (a hook, a fetch function, a form). For a
vendor whose transport we already own (`vendorFetch`, an SDK, an Effect
`HttpClient`), a client is the wrong artifact; what the document uniquely knows is
the schemas. So the generator emits, per included operation:

```ts
export const createApiSearch = {
  method: "post",
  path: "/search",
  params: CreateApiSearchParams,   // path + query + header, via insertNormalizedModel
  body: CreateApiSearchBody,       // Schema.Void when the method has none
  response: CreateApiSearchResponse,
} as const;
```

— ~60 lines, no runtime imports of its own, every schema a peer definition. The
consumer keeps its transport and adds `Schema.encodeSync(endpoint.body)` /
`Schema.decodeUnknownSync(endpoint.response)`. `include` scoped Cloudflare's
3,465 operations to 13, and the components those 13 reach (≈100) came along
through the Driver without being listed anywhere. The `body: Schema.Void` choice
matters: a uniform shape is what lets a generic `call(endpoint, …)` exist without
a per-method branch.

**Why it matters:** Without this, the next agent handed "generate schemas for a
vendor API" reaches for the tanstack clone and builds a second client around a
transport the app already has — or gives up when the model generator emits no
response schema. The operation skill should name this as a fourth output family,
with its own two rules: schemas by peer insert, transport by the consumer.

**Possible fixes:** a row in skmtc-operation §1's table ("endpoint as data — no
transport; consumer owns the call"); optionally a stock `gen-endpoints-<schema>`.

**Version anchor:** `@skmtc/core@0.28.3`, `@skmtc/lang-typescript@0.12.17`

**Status:** superseded by `2026-09-13-effect-http-client-overlays.md` #3 — the data object was the halfway point; the shape that held is a client function over the caller's `HttpClient`.

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — `generate --json` exit code vs `errors: []` | Every `include`-scoped run over a real third-party document exits 1 while succeeding, and the skill's stated success condition is not what the binary does; CI pipelines break on the documented happy path. | SKMTC code (CLI exit policy) + skmtc-cli skill sentence |
| 2 | #2 — refused `allOf` degrades to void silently | Turns a parser limitation into a typed `Schema.Void` with `success` in the manifest; the void-fallback idiom the operation skill prescribes cannot distinguish "no body" from "body refused". | SKMTC code (parser merge policy or item outcome) |
| 3 | K1 — `insertNormalizedModel` bypasses the projection constructor | Constructor-side registration and recursion annotation silently do not apply to normalized output; the model skill implies the opposite. | skmtc-model skill §3 |
