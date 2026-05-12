# 2026-05-12 — Stock generator docs vs source verification

Verified the `docs/reference/stock-generators/*.md` claims against the
actual generator source in `skmtc-generators/`. Multiple per-generator
docs contain fabricated examples (output JSX/TS that doesn't match what
the generator emits), miscatalogued behaviour (Combobox vs Select), and
the `overview.md` catalog is missing four generators that exist in
`skmtc-generators/`. Logged as friction entries here for the fixer agent
to pick up; each entry has a verification command so the fix can be
checked.

Version anchors are `@skmtc/core@0.4.2`, `@skmtc/gen-*@0.0.57`.

---

### 1. `gen-shadcn-select` doc claims Combobox-based output; stock emits plain `<Select>` [friction]

`reference/stock-generators/gen-shadcn-select.md` (canonical example
doc).

**What happened:** Doc at line 48–49 asserts "**Combobox-based.** The
stock emits a searchable combobox, not a plain `<select>`. The shadcn/ui
Combobox component is the target." The doc's example output at lines
21–28 shows `<Combobox value={value} onChange={onChange}>…<ComboboxItem
…>` JSX.

The actual stock emission (`gen-shadcn-select/src/ShadcnSelectInput.ts:96–105`)
uses the plain shadcn `<Select>` family:

```tsx
<Select onValueChange={props.onChange} defaultValue={props.value}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder={props.placeholder} />
  </SelectTrigger>
  <SelectContent>{data...?.map(item => (
    <SelectItem key={item.id} value={item.id}>
      ${this.option}
    </SelectItem>
  ))}</SelectContent>
</Select>
```

No `Combobox` import or symbol exists anywhere in `gen-shadcn-select/src/`.
The "searchable" framing is also wrong — `<Select>` is not searchable
without Combobox/Command primitives, which the stock doesn't pull in.

**What was expected:** That the stock generator name (`select`) maps to
plain `<Select>` and the doc's "searchable Combobox" framing was an
aspirational future-state, not the present state.

**Why it matters:** The doc is the canonical orientation for cloners
deciding whether to use this generator. A reader looking for a
"searchable" component would clone, run, and discover they got a plain
`<Select>` — exactly the kind of "ship sloppy docs and let customers
discover the mistake" friction we've been logging in `discrepancy-catalog.md`.

The doc's later guidance "Swap Combobox for plain `<select>` or a
different UI lib's equivalent" (line 69) compounds the error — it tells
the cloner to swap something that isn't there.

**Possible fixes:**
- Rewrite the example output to reflect the actual `<Select>` emission
- Drop the "searchable combobox" claim and "Combobox-based" key
  decision; replace with "plain `<Select>` from shadcn/ui"
- Update the customizations list — remove the "Swap Combobox" item;
  add "Swap to Combobox for searchable behaviour" instead
- Verification command:
  ```bash
  grep -n "Combobox\|<Select\|SelectItem" \
    skmtc-generators/gen-shadcn-select/src/ShadcnSelectInput.ts
  ```

**Version anchor:** `@skmtc/gen-shadcn-select@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `gen-shadcn-select.md` updated: title byline changed from "searchable-select" to "`<Select>` component"; `What it generates` example replaced with the actual `<Select>` + `SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` shadcn/ui primitives matching `ShadcnSelectInput.ts:96-105`; "Combobox-based" key decision rewritten as "Plain `<Select>` from shadcn/ui" with a pointer to Combobox/Command as the search-as-you-type clone-target; customisation bullet rewritten to point at swapping `<Select>` → `Combobox` rather than "Swap Combobox for plain `<select>`".

---

### 2. `gen-shadcn-table` doc shows hand-rolled `<Table>` markup; stock emits `<DataTable columns={…} data={…} />` [friction]

`reference/stock-generators/gen-shadcn-table.md`.

**What happened:** Doc at lines 22–41 shows a hand-rolled shadcn `<Table>`
with manual `<TableHeader>`, `<TableRow>`, `<TableHead>`, `<TableBody>`,
and per-property `<TableCell>` mapping.

The actual emission (`gen-shadcn-table/src/ShadcnTable.ts:50–67`) is:

```tsx
(${pathParams}) => {
  const { data } = ${clientName}(${destructuredPathParams})
  ...
  return (
    <div className="flex flex-col gap-4 p-4 w-full">
      ...
      <DataTable
        columns={columns}
        data={data...listKey... ?? []}
      />
    </div>
  )
}
```

The stock imports `DataTable` from `@/components/data-table/data-table.tsx`
(line 41–43) — a consumer-provided component (not vendored). It also
uses `TanstackColumns` for the `columns` value (line 27), which means
the stock **already uses Tanstack Table** via the consumer's `DataTable`.

The doc's "Add pagination, sorting, filtering. The stock is a static
table. Tanstack Table is the canonical library to layer on top if you
need those features." (lines 78–80) is wrong both ways — the stock is
**not** a static `<Table>`, and it **does** integrate Tanstack Table via
`TanstackColumns`.

Also the doc omits the assumption that consumers must provide
`@/components/data-table/data-table.tsx` themselves. This is a
substantial integration requirement not documented.

**What was expected:** The doc would describe `<DataTable>` + Tanstack
Columns + consumer-provided component as the actual output shape.

**Why it matters:** A cloner reading the doc will write a clone
expecting hand-rolled `<Table>` markup and find a completely different
emission shape. The consumer-provided `DataTable` dependency is a
non-obvious integration requirement — a `skmtc generate` against a
fresh project will produce output that references a file the user
hasn't created.

**Possible fixes:**
- Replace the example output (lines 22–41) with the actual `<DataTable>`
  emission
- Add a "Required consumer component" section documenting the
  `@/components/data-table/data-table.tsx` expectation, and reference
  the shadcn/ui data-table example as one source
- Update "Key decisions" — mention `TanstackColumns` and the
  consumer-side `DataTable` contract
- Rewrite the "Add pagination" customisation bullet — it's misleading
  because the stock already routes through Tanstack
- Verification command:
  ```bash
  grep -n "DataTable\|TanstackColumns\|register" \
    skmtc-generators/gen-shadcn-table/src/ShadcnTable.ts
  ```

**Version anchor:** `@skmtc/gen-shadcn-table@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `gen-shadcn-table.md` rewritten: `What it generates` replaced hand-rolled `<Table>` block with the actual `<DataTable columns={...} data={...} />` emission matching `ShadcnTable.ts:50-67`; added a "Required consumer component" subsection documenting that `@/components/data-table/data-table.tsx` is not emitted by the generator and the consumer must provide it; "Key decisions" gained a paragraph explaining the three-piece composition (Projection + `TanstackColumns` peer Projection + consumer `DataTable`); "Add pagination" customisation rewritten to acknowledge Tanstack is already wired through `TanstackColumns` and `DataTable`.

---

### 3. `gen-express` doc claims `import express from 'express'; app = express()`; stock emits `Router()` [friction]

`reference/stock-generators/gen-express.md`.

**What happened:** Doc at lines 19–32 shows:

```ts
import express from 'express'

export const app = express()

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'TODO', email: 'TODO' })
})
```

The actual emission (`gen-express/src/ExpressApp.ts:40–46`) is:

```ts
Router()

${routes}
```

with imports registered as:

```ts
this.register({
  imports: {
    express: ['Router', 'Request', 'Response', 'NextFunction']
  }
})
```

So the stock emits `export const app = Router()`, not `express()`. The
generator's identifier is still `app` but it's a `Router` instance, not
an `Express` instance. Doc's `import express from 'express'` default
import is also wrong — the stock uses named imports from `'express'`.

This is a meaningful semantic difference in Express: a `Router` mounts
on an existing app, while `express()` creates a new app. The doc's
example would directly serve traffic; the stock's emission needs a
parent app to mount on.

**What was expected:** Either the doc's example output reflects the
actual `Router()` emission, or the generator emits `express()`
matching the doc.

**Why it matters:** Same class of failure as #1 and #2 — the doc shows
fictional output. A cloner trying to use the stock as a stand-alone
server will need to add `const root = express(); root.use(app);` because
the emitted `Router()` doesn't `listen()`. Doc gives them no hint.

**Possible fixes:**
- Update the example to show `Router()` + named imports
- Add a "Mounting the router" note explaining that the emitted `app` is
  a `Router` requiring a parent `express()` app
- Verification command:
  ```bash
  grep -n "Router\|express()\|register" \
    skmtc-generators/gen-express/src/ExpressApp.ts
  ```

**Version anchor:** `@skmtc/gen-express@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `gen-express.md` updated: `What it generates` example replaced `import express from 'express'` + `express()` with `import { Router, type Request, type Response, type NextFunction } from 'express'` + `Router()` matching `ExpressApp.ts:17-22, 40-46`; added a "Mounting the router" subsection explaining that the emitted `app` is a `Router` that must be mounted on a parent `express()` app, with a sample composition; clarified that the `Router`-not-`express()` choice keeps multiple route files composable under different prefixes.

---

### 4. `gen-msw` doc says `toRoutesList` is a "factory accepts dependencies"; stock emits a nullary `() => […]` [friction]

`reference/stock-generators/gen-msw.md`.

**What happened:** Doc at lines 22–32 shows:

```ts
export const toRoutesList = (deps: { ... }) => [
  getUserRoute,
  createUserRoute,
  // ... all per-operation routes
]
```

> The `toRoutesList` factory accepts dependencies (typically your mock
> data store) and returns the array MSW expects.

Doc also claims this in "Key decisions":

> **Factory-of-routes, not a const array.** The aggregator emits a
> function so consumers can inject deps. This sidesteps the
> "module-level array of handlers needs a data store but data stores
> are created later" timing problem.

The actual emission (`gen-msw/src/MockRoutesList.ts:23`) is:

```ts
override toString(): string {
  return `() => ${this.list}`
}
```

Nullary arrow function. No `deps` parameter, no destructuring, no
runtime-dependency-injection contract. The list is captured directly via
the route identifiers (`getUserRoute`, etc.) at module scope. The factory
wrapper exists, but the "accepts dependencies" framing is fiction.

**What was expected:** Either the stock takes deps as documented, or the
doc reflects the nullary signature.

**Why it matters:** The doc's "Why it matters" framing — solving a
data-store-timing problem via dependency injection — is rationalisation
for behaviour that doesn't exist. A cloner reading this would expect
that the design supports DI and might build on top of that expectation
(e.g., "pass in my mock store"), find it doesn't work, and have to
fork the code anyway. The lie also leaks into the "Common
customisations" list: "Customise the aggregator's shape (return a Map…)"
implicitly assumes the factory is the customisation seam.

**Possible fixes:**
- Drop the `(deps: {...}) =>` from the example
- Replace the rationale ("inject deps to sidestep timing") with the
  actual reason for the factory wrapper (probably: deferring array
  construction past module load, or matching MSW's `setupWorker(...)`
  argument shape)
- If the engine team actually wants DI, that's a feature request, not
  a doc fix — log separately
- Verification command:
  ```bash
  grep -n "toString\|=>" skmtc-generators/gen-msw/src/MockRoutesList.ts
  ```

**Version anchor:** `@skmtc/gen-msw@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `gen-msw.md` updated: example now shows `export const toRoutesList = () => [...]` (nullary, no `deps` parameter); rationale paragraph rewritten — the factory wrapper exists to defer array construction past module load and match MSW's `setupWorker(...)` argument shape, not to inject dependencies; "Returning a factory" learning bullet rewritten to describe "wrapping output in a deferred function".

---

### 5. `gen-supabase-hono` doc omits Sentry / CORS / onError middleware baked into the stock [friction]

`reference/stock-generators/gen-supabase-hono.md`.

**What happened:** Doc's example output (lines 17–33) is a clean Hono
app with just route registrations:

```ts
import { Hono } from 'hono'
export const app = new Hono()
app.get('/users/:id', async (c) => { ... })
```

The actual emission (`gen-supabase-hono/src/SupabaseHono.ts:40–77`) is
substantially richer — wrapped with three middleware/error layers:

```ts
new Hono()

app.use('*', sentry({
  dsn: Deno.env.get('SENTRY_DSN_SUPABASE'),
  tracesSampleRate: 1.0
}))

app.onError((error, c) => {
  console.log('ERROR', error)
  c.get('sentry').captureException(error)
  return c.json({ message: 'Internal server error' }, 500)
})

app.use('*', cors({
  origin: '*',
  allowMethods: ${methods},
  maxAge: 600,
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'sentry-trace', 'baggage', 'content-type']
}))

${routes}
```

Imports register `hono`, `hono/cors`, AND `@hono/sentry` — all three are
hardcoded in `SupabaseHono.ts:16–21`. None of this appears in the doc.

**What was expected:** The doc would surface that the stock comes with
opinionated Sentry + CORS + error handling, since these are
customisation seams (you'd want to swap or remove them in many
deployments).

**Why it matters:** Three concrete consequences:
1. Cloners pulling the stock are silently opted into Sentry and need a
   `SENTRY_DSN_SUPABASE` env var or runtime errors at boot.
2. `cors({ origin: '*' })` is permissive by default — fine for dev,
   wrong for production. Not mentioned anywhere.
3. The hardcoded Sentry/CORS imports are themselves clone seams (the
   same kind we document in `gen-shadcn-form`); not naming them denies
   readers the "this is the customisation point" affordance.

**Possible fixes:**
- Expand the example output to show the full emission
- Add a "Baked-in middleware" subsection in Key decisions
- Add customisations: "Remove or replace Sentry", "Tighten CORS origin",
  "Customise error response shape"
- Verification command:
  ```bash
  grep -n "sentry\|cors\|onError\|use" \
    skmtc-generators/gen-supabase-hono/src/SupabaseHono.ts
  ```

**Version anchor:** `@skmtc/gen-supabase-hono@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `gen-supabase-hono.md` updated: `What it generates` example expanded to show all three middleware/error layers (Sentry via `@hono/sentry`, `app.onError` with sentry capture, `cors` with `origin: '*'`) and the three import lines (`hono`, `hono/cors`, `@hono/sentry`) matching `SupabaseHono.ts:15-77`; added a "Baked-in middleware: Sentry, CORS, `onError`" Key Decision paragraph naming the three operational consequences (`SENTRY_DSN_SUPABASE` env var dependency, permissive CORS, generic-500 onError); "Common customizations" list expanded to include "Tighten CORS origin", "Remove or replace Sentry", "Customise the error-response shape".

---

### 6. `gen-daisyui-form` enrichment schema differs from `gen-shadcn-form`'s; doc claims they're identical [friction]

`reference/stock-generators/gen-daisyui-form.md`.

**What happened:** Doc at lines 37–41 says:

> **Identical entry shape to `gen-shadcn-form`.** Same `isSupported`
> (POST/PUT/PATCH + object body), same `transform`, same
> `toPreviewModule`, **same enrichment schema**.

Comparing the two enrichment schemas:

`gen-shadcn-form/src/enrichments.ts` (top-level):
```ts
export const formSchema = v.optional(
  v.object({
    title: ...,
    description: ...,
    submitLabel: ...,
    fields: v.optional(v.array(formFieldItem))   // formFieldItem has id, accessorPath, input, label, placeholder, references
  })
)
```

`gen-daisyui-form/src/enrichments.ts`:
```ts
export const formSchema = v.optional(
  v.object({
    form: formPropertiesSchema    // extra `form` wrapper!
  })
)
// formPropertiesSchema has title, description, submitLabel, fields
// formFieldItem has id, accessorPath, input, label, placeholder
// NO `references` field
```

Two differences:
1. **`form` wrapper**: daisyui-form's enrichment payload is one level
   deeper. A user's `client.json` would need `enrichments[...][path][method].form.title`
   for daisyui vs `enrichments[...][path][method].title` for shadcn.
2. **No `references` field**: shadcn-form supports the `references`
   protocol for operation-reference dispatch (used to wire a select
   component to a field); daisyui-form doesn't.

**What was expected:** "Same enrichment schema" implies a one-for-one
swap — drop `gen-shadcn-form` from your enrichments, drop
`gen-daisyui-form` in, no `client.json` changes.

**Why it matters:** Once the user is past the "Combobox doesn't exist"
class of friction, they'd reasonably try to swap UI generators and
expect their enrichments to keep working. They won't — every enrichment
will be silently dropped by Valibot because the keys don't match. Same
class as DISC-001 (silent enrichment-key strip), at a per-generator
level.

**Possible fixes:**
- Update the "Identical entry shape" claim — call out the enrichment
  schema differences explicitly
- Add a `references` field to gen-daisyui-form's schema OR document
  why daisyui doesn't support that field
- Pick a consistent wrapping convention (`form` wrapper vs no wrapper)
  across UI form generators
- Verification command:
  ```bash
  diff <(cat skmtc-generators/gen-shadcn-form/src/enrichments.ts) \
       <(cat skmtc-generators/gen-daisyui-form/src/enrichments.ts)
  ```

**Version anchor:** `@skmtc/gen-daisyui-form@0.0.57`,
`@skmtc/gen-shadcn-form@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `gen-daisyui-form.md` "Key decisions" bullet retitled from "Identical entry shape" to "Near-identical entry shape" and expanded to call out the two enrichment-schema differences explicitly: (1) the extra `form: { ... }` wrapper that makes daisyui's payload path `[gen][path][method].form.{title,...}` rather than `[gen][path][method].{title,...}`, and (2) the absence of a `references` field on `formFieldItem` (so daisyui doesn't participate in the operation-reference protocol that wires shadcn-form to gen-shadcn-select). Reframed as "enrichment schema differs from gen-shadcn-form's", not "same enrichment schema". Note: the underlying schema asymmetry is the *generator authors'* call; if they want symmetry, that's a separate code change.

---

### 7. `stock-generators/overview.md` catalog is missing four `gen-reapit-*` generators [friction]

`reference/stock-generators/overview.md`.

**What happened:** The catalogue tables at lines 36–83 list 14
generators. The `skmtc-generators/` workspace contains 18:

| In catalogue | In repo |
|--------------|---------|
| typescript, zod, valibot, arktype | + |
| tanstack-query-fetch-zod, tanstack-query-supabase-zod, msw | + |
| shadcn-form, shadcn-select, shadcn-table, daisyui-form | + |
| express, supabase-hono | + |
| graphql-operation, graphql-typed-document-node | + |
| (missing) | **gen-reapit-form** |
| (missing) | **gen-reapit-graphql-client** |
| (missing) | **gen-reapit-multi-select** |
| (missing) | **gen-reapit-searchable-dropdown** |

All four `gen-reapit-*` packages have proper `mod.ts`, `deno.json`, and
`src/` directories. They're in the published workspace. They have no
per-generator doc file under
`docs/reference/stock-generators/gen-reapit-*.md`.

**What was expected:** Either the catalogue lists them or they're
explicitly excluded with a note (e.g., "Reapit-specific generators
omitted from the public catalogue; see `<repo>` for source").

**Why it matters:** Two cases:
1. A user running `skmtc clone @skmtc/gen-reapit-form` looking at the
   catalogue would conclude that name doesn't exist; in practice it
   does and resolves on JSR.
2. The "stock generators are MIT and shipped as starting points"
   framing on line 4–5 implies the catalogue is complete. Hiding four
   of them undermines the framing.

The `gen-reapit-*` generators may be a vendor-specific subset that the
maintainers don't want to publicly catalogue — but if so, that intent
should be explicit, not invisible.

**Possible fixes:**
- Add the four `gen-reapit-*` generators to the catalogue with their
  own per-generator docs
- OR add a note under "What stock generators are" explaining the
  Reapit-specific subset is intentionally excluded and pointing to
  `skmtc-generators/` for source
- OR if they're truly vendor-internal, move them out of
  `skmtc-generators/` into a separate workspace so they're not visible
  alongside the public generators
- Verification command:
  ```bash
  ls skmtc-generators/ | grep '^gen-' | sort > /tmp/repo.txt
  grep -oE 'gen-[a-z-]+' \
    skmtc/deno/docs/reference/stock-generators/overview.md | \
    sort -u > /tmp/docs.txt
  diff /tmp/repo.txt /tmp/docs.txt
  ```

**Version anchor:** `@skmtc/core@0.4.2`,
`@skmtc/gen-reapit-*@0.0.57`

**Status:** verified-fixed 2026-05-12 — `overview.md` gained a "Reapit-specific generators" subsection between "GraphQL" and "Typical combinations" that explicitly lists all four (`gen-reapit-form`, `gen-reapit-graphql-client`, `gen-reapit-multi-select`, `gen-reapit-searchable-dropdown`) with one-line descriptions, frames them as case-study generators built for a specific consumer stack rather than primary stock templates, and points at the source location for anyone who wants to read or fork them. Per-generator doc pages under `reference/stock-generators/gen-reapit-*.md` are still missing — flagged as a low-priority completeness gap (the source itself is the readable canon for vendor-specific generators).

---

### 8. `insertNormalizedModel` (US) vs `insertNormalisedModel` (British) — two real methods, docs conflate them [friction]

`reference/api/generate-context.md`, `reference/stock-generators/overview.md`
line 97, glossary, `core/README.md` line 45, and most generator-doc
prose referring to "the `insertNormalizedModel` method".

**What happened:** Both names exist in source, and they refer to
different methods:

- `context.insertNormalisedModel(...)` (British) — defined on
  `GenerateContext` at `core/context/GenerateContext.ts:752`. This is
  the canonical engine API.
- `this.insertNormalizedModel(...)` (American) — defined on
  Projection-base classes:
  - `core/dsl/operation/oas/OasOperationProjectionBase.ts:100`
  - `core/dsl/operation/gql/GqlOperationProjectionBase.ts:100`
  - `core/dsl/model/ModelProjectionBase.ts:78`
  Wraps the context method.

Test names confirm the relationship:
```
'OasOperationProjectionBase - insertNormalizedModel calls
  context.insertNormalisedModel with correct params'
```

Generator source uses both spellings depending on caller:
- Inside a `Projection` constructor: `this.insertNormalizedModel(...)` (US)
- Outside (functional handlers, e.g., gen-graphql-operation/mod.ts:52):
  `context.insertNormalisedModel(...)` (British)

Most docs spell it American ("insertNormalizedModel"). When the doc
refers to `context.insertNormalizedModel(...)` (e.g., overview.md
line 97: "compose with `gen-zod` via `insertNormalizedModel`"), the
spelling is wrong for the context-level method.

**What was expected:** Single canonical name. The mismatch produces two
different method names that do (essentially) the same thing with
slightly different argument shapes.

**Why it matters:** Three problems:
1. Docs are inconsistent about spelling — a reader greping the codebase
   for the doc'd `insertNormalizedModel` finds different code than a
   reader greping for `insertNormalisedModel`.
2. The dual-spelling itself is a real API surface artefact (one method
   on each of Projection-base + GenerateContext), not a typo. That
   means it's a thing to document, not a thing to fix in docs alone.
3. Worse — there are FOUR copies of `insertNormalizedModel` (one each
   for Oas/Gql Operation projection bases + Model projection base) that
   all delegate to the same context method. That's a substantial
   duplicated surface area in the API.

**Possible fixes:**
- Pick one spelling for the public surface, deprecate the other (most
  callers use US, so making British an alias would be a small change)
- OR explicitly document both names and which to use from which context
  (Projection: `this.insertNormalizedModel`, free function:
  `context.insertNormalisedModel`)
- Either way, audit every doc occurrence and align spelling to the
  actual method names being referenced
- Verification command:
  ```bash
  grep -rn "insertNormali" skmtc/deno/core/dsl/ \
    skmtc/deno/core/context/GenerateContext.ts \
    skmtc/deno/docs/
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — audit run on `docs/`. The canonical disambiguation (`generate-context.md` lines 231-232, 337-341 + `llms.md` line 72 + glossary's `insertNormalizedModel` entry) is correct: `insertNormalisedModel` is on `GenerateContext` (British), `insertNormalizedModel` is on the projection-base wrappers (American). Two doc mismatches found and fixed: `concepts/projections-and-snippets.md:224` was `this.context.insertNormalizedModel(...)` — changed to British (`...insertNormalisedModel(...)`) since it's invoked on `context`; `concepts/cross-generator-coordination.md:271` was `context.insertNormalizedModel(...)` — also changed to British. All other doc occurrences use the correct spelling for their stated receiver. The underlying API-surface duality (one method per Projection-base × 3 + one on context) is documented as deliberate; consolidating to one method name is a separate code-level concern flagged here but not actioned.

---

### 9. `gen-tanstack-query-*` doc claims GET → useQuery; stock also emits paginated variant via `isListResponse` [polish]

`reference/stock-generators/gen-tanstack-query-fetch-zod.md`,
`reference/stock-generators/gen-tanstack-query-supabase-zod.md`.

**What happened:** Both fetch and Supabase variant docs say (line 44–47
of fetch-zod doc):

> **GET → `useQuery`, mutation methods → `useMutation`.** The mapping is
> hardcoded in the Projection.

In source (`TanstackQuery.ts:14–35`), GETs branch further on
`isListResponse(operation)`:
- List-response GETs → `PaginatedQueryEndpoint`
- Non-list GETs → `QueryEndpoint`
- POST/PUT/PATCH/DELETE → `MutationEndpoint`

`PaginatedQueryEndpoint` still calls `useQuery` (with `keepPreviousData`
helper), not `useInfiniteQuery` — so the doc's "GET → useQuery" is
ultimately accurate, but it elides the branch entirely. The pagination
helper imports and the `keepPreviousData` decoration only appear when
the operation matches `isListResponse`.

**What was expected:** The doc surface the pagination branch — a user
configuring `staleTime` defaults (one of the doc's "Common
customizations" bullets) needs to know there are two emission paths.

**Why it matters:** Lower-severity than the other entries because the
hook name is the same; mostly an under-specification rather than a
fabrication. But it interacts with `gen-shadcn-table` and
`gen-shadcn-select` which both depend on `isListResponse` — a cloner
trying to understand why select/table only work on certain GETs would
trace through the pagination branch and find the doc didn't mention it.

**Possible fixes:**
- Add a paragraph in "Key decisions" explaining the `isListResponse`
  sub-branch
- Mention `PaginatedQueryEndpoint` in the file list
- Cross-reference from `gen-shadcn-select.md` / `gen-shadcn-table.md`
  doc's "Same `isSupported`" notes
- Verification command:
  ```bash
  grep -n "isListResponse\|PaginatedQuery\|QueryEndpoint" \
    skmtc-generators/gen-tanstack-query-fetch-zod/src/TanstackQuery.ts
  ```

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.0.57`,
`@skmtc/gen-tanstack-query-supabase-zod@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — both `gen-tanstack-query-fetch-zod.md` and `gen-tanstack-query-supabase-zod.md` "Key decisions" expanded to document the `ts-pattern` match in the Projection constructor and the three endpoint Snippet classes (`QueryEndpoint`, `PaginatedQueryEndpoint`, `MutationEndpoint`), with `isListResponse` as the GET sub-branch discriminator. "Per-method dispatch in the Projection" learning bullet rewritten as "match in constructor, render in toString" with explicit naming of the Snippet decomposition. Cross-reference to the fetch variant from the supabase variant so the longer discussion lives in one place.

---

### 10. Pattern across stock-generator docs: fictional example outputs [friction]

Meta-entry tying entries #1–#5 together. Across at least five
stock-generator docs (`gen-shadcn-select`, `gen-shadcn-table`,
`gen-express`, `gen-msw`, `gen-supabase-hono`), the "What it generates"
example output is a plausible-but-fictional sketch rather than a
verbatim or representative slice of the actual emission.

**What happened:** Each doc has an "What it generates" code block. None
of the five sampled were verbatim from the stock's actual output;
several were materially different in structure (Combobox vs Select,
hand-rolled Table vs DataTable, `express()` vs `Router()`, factory with
deps vs nullary factory, missing middleware).

The pattern looks like the docs were written by reading the generator's
*purpose* ("emit a searchable select") and inventing a plausible output,
rather than reading the generator's `toString()` method and quoting it.

**What was expected:** Either:
- Example outputs are verbatim quotes from a real generation run, or
- They're marked as "illustrative, not generated" so readers know to
  read the source for truth.

**Why it matters:** The same systemic failure mode as the
`discrepancy-catalog.md` entries — docs that look authoritative because
they're shaped like reference docs, but contain LLM-generated plausible
content rather than verified source. Each individual fabrication is
recoverable, but readers can't tell which examples are accurate without
running the generator.

This is a **process** observation, not a per-doc bug: the doc-writing
loop needs a verification step that the example output came from a real
run.

**Possible fixes:**
- For each stock-generator doc, run the generator against a small
  fixture spec and capture the actual output as the example
- Add a CI check that compares the doc's example to a fresh run's
  output and fails on drift
- Add a doc-template comment instructing future doc-writers: "the
  example output must be a verbatim quote from a real run"
- Verification approach (cross-check pattern):
  ```bash
  # For each gen-<name>, compare doc example to a real generation
  # output. Currently no such harness exists.
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** open — process observation, not a per-doc fix. Entries #1–#9 above each address one of the symptoms; the root cause (no automated guard against doc-vs-source drift in example outputs) remains. Two viable follow-ups: (a) capture per-generator output from a fixture spec into committed `__fixtures__/` files and reference them from docs verbatim; (b) build a CI step that re-runs each generator's stock output and diffs against the example block in its doc. Both are infrastructure work, not catalog entries.

---

## Summary

10 entries:
- 8 friction (#1–#6, #8, #10)
- 1 polish (#9)
- 1 meta (#10)

Pattern: stock-generator docs were written without running the
generators. Fictional example outputs and aspirational behaviour claims
(Combobox, deps-injecting factory, express() top-level) are the
dominant failure mode. Worth pairing with `discrepancy-catalog.md`
DISC-001..DISC-010 — same class of error at a different layer of the
documentation.

Suggested triage order (by user-facing impact):
1. #1 (Combobox claim) — touching the most "deceptive" claim; user
   actively cloned for a feature that doesn't exist
2. #2 (Table → DataTable) — silent integration requirement (consumer
   must provide DataTable component)
3. #5 (Supabase-hono middleware) — production-impact: CORS origin '*',
   Sentry DSN dependency
4. #6 (DaisyUI enrichment schema) — same class as DISC-001 (silent
   strip)
5. #3 (Express Router) — semantic but workaround-able
6. #4 (MSW deps factory) — rationale-only; output not actively wrong
7. #7 (missing gen-reapit) — completeness gap
8. #8 (insertNormalisedModel) — naming-only, deeper to fix
9. #9 (paginated query branch) — under-specification, not fiction
10. #10 (meta) — fixes process, not docs

---

## Round 2: tutorials, concept doc line numbers, and stale CLAUDE.md

Continued probing into tutorials and concept docs. The pattern from
round 1 ("docs written without running the code") replicates strongly in
tutorials — output paths and filenames diverge from the actual
generators' `toExportPath` and `toIdentifier`.

### 11. Tutorial 01 + 02: emitted Zod file is `pet.generated.ts` (lowercase), docs claim `Pet.generated.ts` [friction]

`using/tutorials/01-your-first-generation.md`,
`using/tutorials/02-multiple-generators.md`.

**What happened:** Tutorial 01 step 6 (line 77) and Tutorial 02 step 4
(lines 55, 67) reference `Pet.generated.ts` / `cat
src/generated/Pet.generated.ts` / `import { pet, type Pet } from
'../Pet.generated.ts'`.

`gen-zod`'s `toExportPath` is (`gen-zod/src/base.ts:18-22`):

```ts
toExportPath({ refName, enrichments }): string {
  const { name } = this.toIdentifier({ refName, enrichments });
  return join("@", "types", `${decapitalize(name)}.generated.ts`);
}
```

`toIdentifier` returns `decapitalize(camelCase(refName))`. For
`refName = "Pet"`, the identifier name is `pet`, and the path's
filename component is `decapitalize("pet") = "pet"`. The actual
emitted file is `pet.generated.ts` (lowercase). `gen-typescript`'s
`toExportPath` is the same shape — also lowercase, also `pet.generated.ts`.

So the tutorial's `Pet.generated.ts` filename does not exist. A user
following the tutorial verbatim runs `cat src/generated/Pet.generated.ts`
and gets `No such file or directory`.

**What was expected:** the tutorial-quoted filename to match the
generator's actual `toExportPath`.

**Why it matters:** Tutorial 01 is **the first thing** a user runs.
This is the welcome-mat impression of SKMTC. Step 6 ("Read the output")
is the moment of payoff — and the command they're told to type fails.
A user not in the habit of `ls`'ing the directory first will conclude
"SKMTC didn't emit anything" or "my generate command silently failed."

The same `Pet`-vs-`pet` confusion propagates into tutorial 02's
"verify the cross-generator coordination" step (line 64–73) which
shows imports from `'../Pet.generated.ts'`. Those imports would also
fail to resolve.

**Possible fixes:**
- Replace every `Pet.generated.ts` reference with `pet.generated.ts`
  (multiple sites across two tutorials).
- Alternatively, add a `--keep-case` enrichment to gen-zod to opt into
  capitalized filenames, and update the tutorial to use it. (Probably
  not the right fix — the casing decision is load-bearing per
  `gen-zod.md`'s "Lowercase identifier names" key decision.)
- Verification command:
  ```bash
  grep -E "Pet\.generated\.ts|pet\.generated\.ts" \
    skmtc/deno/docs/using/tutorials/01-your-first-generation.md \
    skmtc/deno/docs/using/tutorials/02-multiple-generators.md
  ```

**Version anchor:** `@skmtc/gen-zod@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `using/tutorials/01-your-first-generation.md` step 6 rewritten to point at `src/generated/types/pet.generated.ts` (decapitalized refName under the `@/types/` default subdir) with the explicit explanation of `gen-zod`'s `toIdentifier = decapitalize(camelCase(refName))` and the `@/types/<name>.generated.ts` path; the example `import` line updated to match. `using/tutorials/02-multiple-generators.md` step 3 file listing updated to `types/pet.generated.ts` (both generators contributing to one file) and `services/useGetPetById.generated.ts` (gen-tanstack-query-fetch-zod's path); step 4 hook example's import path corrected to `'../types/pet.generated.ts'`.

---

### 12. Tutorial 01 `skmtc init petstore` is missing the required `<basePath>` arg in strict mode [friction]

`using/tutorials/01-your-first-generation.md` step 2 (line 32).

**What happened:** Tutorial says:

```bash
skmtc init petstore
```

The actual `init` command (`cli/commands/init.tsx:41-58`) requires
both `<projectName>` and `<basePath>` arguments in strict mode (i.e.,
when `--no-input` or `--json` is set, or when there's no TTY).

```ts
arguments('[projectName:string] [basePath:string]')
// ...
if (basePath === undefined) {
  return failWithRecipe({
    command: 'init',
    arg: '<basePath>',
    usage: 'skmtc init <projectName> <basePath>',
    example: 'skmtc init my-api ./web/app/src'
  })
}
```

In interactive mode (TTY, no `--no-input`), the prompt asks for
basePath. So the tutorial works **if the user happens to be in an
interactive terminal**. In CI, piping, or non-TTY environments, the
command fails with a recipe-error pointing at the missing arg.

**What was expected:** Tutorials are copy-pasted by users into any
shell environment. The example should include the basePath so it works
unconditionally.

**Why it matters:** Same class as #11 — tutorial step 2 doesn't work
verbatim in a meaningful fraction of environments. Users following the
tutorial in a CI sandbox, scripted setup, or any non-TTY environment
hit the wall on the very first SKMTC-specific command.

The recipe-error is clear enough that users can recover, but it's the
kind of friction that should never happen for a "5-minute tutorial."

**Possible fixes:**
- Update the example to `skmtc init petstore src/generated` (matches
  the `basePath` set in step 4).
- Add a note: "If your shell is non-interactive, pass basePath as
  the second argument: …"
- Verification command:
  ```bash
  grep -A2 "Step 2" \
    skmtc/deno/docs/using/tutorials/01-your-first-generation.md
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — `using/tutorials/01-your-first-generation.md` step 2 example updated to `skmtc init petstore src/generated`. Added an explanatory paragraph noting that the second arg is the `basePath`, required in non-TTY environments (matching the `[basePath]` positional `init` declares in `cli/mod.ts:51-59` and the strict-mode `failWithRecipe` path in `cli/commands/init.tsx:50-58`). Bonus: the basePath in the example now matches step 4's `client.json` `"basePath": "src/generated"`, so the tutorial is self-consistent.

---

### 13. Tutorial 02 claims tanstack-query output at `pet/useGetPetById.generated.ts`; actual is `services/useGetPetById.generated.ts` [friction]

`using/tutorials/02-multiple-generators.md` line 59.

**What happened:** Tutorial step 3 says:

> `pet/useGetPetById.generated.ts` (or similar) — the hook file,
> importing `pet` and `Pet` from the schema file above.

`gen-tanstack-query-fetch-zod`'s actual `toExportPath`
(`gen-tanstack-query-fetch-zod/src/base.ts:13-17`):

```ts
toExportPath({ operation, enrichments }): string {
  const { name } = this.toIdentifier({ operation, enrichments })
  return join('@', 'services', `${name}.generated.ts`)
}
```

So the actual path under the configured `basePath` is
`services/useGetPetById.generated.ts`, not `pet/useGetPetById.generated.ts`.
The directory is `services`, not the OAS tag (`pet`).

The same generator's `toIdentifier` produces names like `useGetPetById`
via `toEndpointName(operation)`. The filename component is correct
(`useGetPetById.generated.ts`); only the parent directory is wrong.

**What was expected:** the tutorial path to match the generator's
`toExportPath`. (A reader who skimmed `gen-tanstack-query-fetch-zod.md`
won't catch the inconsistency — the per-generator doc doesn't mention
the `services/` parent either.)

**Why it matters:** Same class as #11. The user runs `ls
src/generated/pet/` and finds it doesn't exist; runs `ls
src/generated/services/` and finds the hook there instead.

**Possible fixes:**
- Replace `pet/useGetPetById.generated.ts` with
  `services/useGetPetById.generated.ts`.
- Verification command:
  ```bash
  grep -n "services\|generated.ts" \
    skmtc-generators/gen-tanstack-query-fetch-zod/src/base.ts
  ```

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.0.57`

**Status:** verified-fixed 2026-05-12 — `using/tutorials/02-multiple-generators.md` step 3 file listing updated: `pet/useGetPetById.generated.ts (or similar)` → `services/useGetPetById.generated.ts` matching `gen-tanstack-query-fetch-zod/src/base.ts:13-17` (`@/services/<name>.generated.ts`). Also picked up the cross-coupled fix from #11 — the same file's step 4 hook example now imports from `'../types/pet.generated.ts'` (decapitalized + under `types/`), matching `gen-zod`'s actual default path.

---

### 14. Tutorial 03 claims `pet/addPet.generated.tsx` for shadcn-form; actual is `forms/PostPetForm.generated.tsx` [friction]

`using/tutorials/03-customize-with-enrichments.md` step 4 (line 102).

**What happened:** Tutorial step 4 says:

```bash
cat src/generated/pet/addPet.generated.tsx
```

Three things wrong, all in one path:

1. **Parent directory**: the actual `toExportPath`
   (`gen-shadcn-form/src/base.ts:18-22`) is `@/forms/<name>.generated.tsx`.
   So it's `forms/`, not `pet/`.
2. **Identifier base**: gen-shadcn-form's `toIdentifier`
   (`gen-shadcn-form/src/base.ts:11-16`) is:
   ```ts
   const verb = capitalize(toMethodVerb(operation.method))
   const name = `${verb}${camelCase(operation.path, { upperFirst: true })}Form`
   ```
   For `POST /pet`, the name is `PostPetForm` (verb-derived, not
   operationId-derived). Not `addPet` — that's the operationId.
3. **Casing**: the filename uses the identifier name verbatim
   (`PostPetForm.generated.tsx`), not lowercased.

Actual path: `forms/PostPetForm.generated.tsx`. Tutorial path:
`pet/addPet.generated.tsx`. Both directory and filename are different.

**What was expected:** the doc-quoted path matches what the generator
emits.

**Why it matters:** Tutorial 03 is the enrichments tutorial — it
teaches users how customization works. Step 4 ("Verify the customization
landed") is the payoff. If `cat` fails, the user thinks enrichments
silently failed (the same class of friction as DISC-001 in
`discrepancy-catalog.md` — invisible enrichment stripping). They may
believe their `client.json` enrichment key was wrong rather than that
the doc-quoted path was wrong.

Worse, the tutorial also conflates "operationId" with the form's
identifier-name in step 2 (lines 49–52):

> for the petstore, `addPet` is `POST /pet` and `updatePet` is `PUT /pet`

This is true *as a description of the operationIds*, but the form's
identifier name is `PostPetForm`, not `addPetForm`. A user inferring
"forms are named after operationIds" from this paragraph will write
incorrect customization-lookup code downstream.

**Possible fixes:**
- Replace `cat src/generated/pet/addPet.generated.tsx` with
  `cat src/generated/forms/PostPetForm.generated.tsx`.
- Step 2 prose: clarify that `addPet` is the operationId but the
  emitted-form identifier is `PostPetForm` (derived from `method + path
  + Form`).
- Add a "the identifier name comes from `verb + path + 'Form'`, not the
  operationId" note in step 2 to head off the conflation.
- Verification command:
  ```bash
  grep -n "toIdentifier\|toExportPath\|toMethodVerb" \
    skmtc-generators/gen-shadcn-form/src/base.ts
  ```

**Version anchor:** `@skmtc/gen-shadcn-form@0.0.57`

**Status:** verified-fixed 2026-05-12 — `using/tutorials/03-customize-with-enrichments.md` step 4 rewritten: `cat src/generated/pet/addPet.generated.tsx` → `cat src/generated/forms/PostPetForm.generated.tsx`, with an explicit paragraph naming the three corrections (subdir `forms/` not `pet/`; identifier `PostPetForm` derived from `${capitalize(toMethodVerb(method))}${camelCase(path, upperFirst)}Form`, not the operationId; filename uses the identifier verbatim). Added a follow-up note that `addPet` is the operationId but the form's emitted identifier is `PostPetForm`, and that the enrichment lookup uses the literal path+method independent of operationId.

---

### 15. `concepts/the-three-phases.md` has stale line-number citations [polish]

`concepts/the-three-phases.md`.

**What happened:** Two of the line-numbered citations in the doc are
off:

- Line 159: `GenerateContext.toArtifacts (core/context/GenerateContext.ts:275)` ✓ correct
- Line 225: `RenderContext.collate (core/context/RenderContext.ts:185)` — actual line is **176**
- Line 312: `#runOasOperationGenerator (core/context/GenerateContext.ts:417-432)` — actual line is **376**
- Line 239: `File.toString() (core/dsl/File.ts:181)` ✓ correct

**What was expected:** Line-numbered references stay in sync with the
code they cite, or use anchors that don't depend on line numbers.

**Why it matters:** Low severity — readers either click through to the
source (and find the method near the cited line anyway) or skim past
the citation. But "the doc cites lines that don't match" reduces trust
in everything else the doc cites.

The deeper observation: **line-numbered citations are a maintenance
burden no one is paying**. Every edit to `GenerateContext.ts` or
`RenderContext.ts` invalidates citations across the docs. There's no
CI check binding citation accuracy to PRs.

**Possible fixes:**
- Update the two stale citations (one-line edits).
- Add a CI check: scan all `\.ts:\d+` citations in docs and verify the
  line still contains the expected symbol.
- OR drop line numbers entirely; just cite the file (`GenerateContext.ts`).
  Symbol names are stable; line numbers aren't.
- Verification command:
  ```bash
  grep -E "GenerateContext\.ts:[0-9]+|RenderContext\.ts:[0-9]+|File\.ts:[0-9]+" \
    skmtc/deno/docs/concepts/the-three-phases.md
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `concepts/the-three-phases.md` line citations updated: `RenderContext.collate` `:185` → `:176` (current `core/context/RenderContext.ts:176`); `#runOasOperationGenerator` `:417-432` → `:376` (current `core/context/GenerateContext.ts:376`). The two correct citations (`toArtifacts` at `:275`, `File.toString` at `:181`) verified and left alone. The deeper line-number-citation maintenance burden flagged as a CI-gate idea for future work.

---

### 16. `core/CLAUDE.md` (project-meta doc Claude reads) still claims Render uses Prettier — contradicting `the-three-phases.md` [friction]

`skmtc/deno/core/CLAUDE.md` lines under "Core Processing Pipeline".

**What happened:** `core/CLAUDE.md` says:

> 3. **Render Phase** (`RenderContext`): Renders artifacts to files
>    with formatting (Prettier) and file system operations

The actual three-phases concept doc (line 267) explicitly says:

> A `grep` for `prettier.format` across `@skmtc/core` returns zero
> hits. No formatter — Prettier, Biome, `deno fmt`, or otherwise —
> runs inside the pipeline.

The user has already explicitly removed Prettier from SKMTC (per the
earlier doc-cleanup session) and the concept-doc is fixed. But the
`CLAUDE.md` in `core/` is stale — it still says "with formatting
(Prettier) and file system operations."

This CLAUDE.md is **automatically loaded into every Claude session
working in the `core/` subdirectory** (via the project-context system).
So any agent picking up this codebase reads "Render does Prettier
formatting" as authoritative.

The "file system operations" claim is also misleading — `RenderContext`
doesn't touch the filesystem; that happens in the host process post-
worker. The concept-doc is correct on this; the CLAUDE.md is not.

**What was expected:** The `core/CLAUDE.md` claim matches the actual
code and the concept-docs.

**Why it matters:** This is a corruption-of-context-channel bug. The
`CLAUDE.md` file's whole purpose is to give AI agents accurate
orientation. A wrong claim here makes every future agent worse — they
write code or docs based on this claim until corrected. The bug isn't
in the published documentation; it's in the meta-docs that bootstrap
agent context.

**Possible fixes:**
- Edit `skmtc/deno/core/CLAUDE.md` to remove the Prettier claim and
  the "file system operations" claim. Replace with the actual
  description from `concepts/the-three-phases.md`.
- Audit every other `CLAUDE.md` in the repo for similar stale claims —
  these are the bootstrap context for every future agent session.
- Verification command:
  ```bash
  grep -rn "[Pp]rettier" skmtc/deno/core/ \
    --include="CLAUDE.md" --include="*.md"
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `skmtc/deno/core/CLAUDE.md` Render Phase line rewritten: removed the Prettier claim and "file system operations" misattribution, replaced with "Serializes the in-memory file map into `{ path: content }` artifacts. **No formatter runs** in the pipeline (no Prettier, no Biome, no `deno fmt`) — consumers format their own output. Filesystem writes happen in the host process post-worker, not inside `RenderContext`." Audit grep across all `CLAUDE.md` files found two more sites (entries #19 and #21) which were also fixed; remaining Prettier mentions in `CLAUDE.md` files are inside auto-generated `claude-mem-context` activity history blocks, not stale claims.

---

### 17. `concepts/projections-and-snippets.md` misclassifies `toEnrichmentSchema` as a static; actual statics list is `id, type, toIdentifier, toExportPath, isSupported, toEnrichments` [polish]

`concepts/projections-and-snippets.md` lines 47–48.

**What happened:** Doc says:

> Has static methods on the class: `toIdentifier`, `toExportPath`,
> `toEnrichments`, `toEnrichmentSchema`

Looking at `core/dsl/operation/oas/toOasOperationProjectionBase.ts:49-66`:

```ts
static id = config.id
static type = 'oasOperation' as const
static toIdentifier = config.toIdentifier.bind(config)
static toExportPath = config.toExportPath.bind(config)
static isSupported = config.isSupported ?? (() => true)
static toEnrichments = ({ operation, context }) => {
  ...
  const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())
  ...
}
```

So the actual statics are:

| Static | What it does |
|---|---|
| `id` | Generator ID (string) |
| `type` | Discriminator: `'oasOperation' | 'gqlOperation' | 'model'` |
| `toIdentifier` | Pure naming function |
| `toExportPath` | Pure path function |
| `isSupported` | Capability gate |
| `toEnrichments` | Lookup-and-validate enrichment |

`toEnrichmentSchema` is **not** a static class method — it's a config
option passed to the factory, called *inside* `toEnrichments` to
produce the validation schema. It's not addressable as
`Projection.toEnrichmentSchema` from a consumer's perspective.

**What was expected:** Doc list matches what's actually on the class
shape.

**Why it matters:** A reader trying to "call
`Projection.toEnrichmentSchema()`" based on the doc would find no such
method. The doc also omits the real statics `id`, `type`, `isSupported`
— the first two are load-bearing for runtime dispatch, the third is the
operation filter.

**Possible fixes:**
- Replace the static-methods list with: `id, type, toIdentifier,
  toExportPath, toEnrichments, isSupported`. Drop `toEnrichmentSchema`.
- Add a note explaining `toEnrichmentSchema` is a config option, not
  a class static.
- Verification command:
  ```bash
  grep -n "^  static" skmtc/deno/core/dsl/operation/oas/toOasOperationProjectionBase.ts
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `concepts/projections-and-snippets.md` lines 43-48 rewritten: dropped `toEnrichmentSchema` from the statics list (it's a config option passed to the factory, called *inside* `toEnrichments`, not addressable as `Projection.toEnrichmentSchema`); added the actually-present statics `type` and `isSupported` that were missing. Final list reads "`id`, `type`, `toIdentifier`, `toExportPath`, `isSupported`, `toEnrichments`" matching `core/dsl/operation/oas/toOasOperationProjectionBase.ts:49-66`. Added a parenthetical clarifying where `toEnrichmentSchema` actually lives in the API surface.

---

### 18. `clone-vs-install.md` claims "local bundling adds ~300ms per `bundle`" — no benchmark in source [polish]

`concepts/clone-vs-install.md` line 172.

**What happened:** Doc says:

> **Build time**: local bundling adds ~300ms per `bundle` (vs zero
> for install).

There is no benchmark, perf-test, or measurement in
`cli/lib/bundle-headless.ts` or anywhere else in the repo that gives a
300ms figure. The number is a plausible-sounding invention.

The Worker spawn time at the-worker-runtime.md line 73 — "~100ms" — is
the same pattern (plausible-sounding number without source).

**What was expected:** Either a real measurement with a source
(captured in the perf section of a CI run, a benchmark fixture, or a
linked PR), or no specific number — just qualitative ("local bundling
adds a non-zero startup cost").

**Why it matters:** Plausible numbers in docs are sticky. A reader
will quote "~300ms" in slack threads, in capacity planning, in
"is SKMTC fast enough?" decision documents. If the actual perf is
1500ms or 50ms, the citation will misinform. **Specific numbers
without sources are higher-risk than vague qualitative claims** because
readers anchor on them.

Same class as the gen-shadcn-select Combobox claim (#1): a confident-
sounding statement that turns out to be invented.

**Possible fixes:**
- Drop the specific number; replace with "local bundling adds a small
  but non-zero startup cost — measure your own."
- OR add a real benchmark to the repo and cite it: a bench script in
  `cli/bench/bundle.bench.ts` that captures the timing across realistic
  project shapes.
- Audit other concept docs for similar plausible-but-unsourced numbers
  (Worker spawn time at `the-worker-runtime.md` line 73 is the same
  pattern).
- Verification approach:
  ```bash
  grep -rn "ms\|millisecond" skmtc/deno/cli/lib/bundle*.ts \
    skmtc/deno/cli/bench/ 2>&1 || echo "no benchmarks found"
  ```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — `concepts/clone-vs-install.md:172` "~300ms" replaced with qualitative "non-zero startup cost" + an explicit "not benchmarked — measure on your own project". Same treatment applied to `concepts/the-worker-runtime.md:73` "~100ms" Worker spawn claim (same pattern, also unsourced). Neither doc now anchors readers on a fictional specific number. Adding actual benchmarks (`cli/bench/*.bench.ts`) is the right longer-term fix but is out of scope here.

---

## Round 2 summary

8 additional entries:
- 5 friction (#11–#14, #16)
- 3 polish (#15, #17, #18)

**Total session entries: 18** (rounds 1 and 2 combined).

The tutorial findings (#11–#14) are the most user-visible — a brand-new
SKMTC user runs Tutorial 01 step 6 (`cat src/generated/Pet.generated.ts`)
and hits a `No such file or directory`. That's the welcome mat.

Pattern observed across rounds: **path-and-name claims in docs are
where fabrication concentrates**. Docs describe directories
(`pet/`, `src/generated/pet/`), filenames (`Pet.generated.ts`,
`addPet.generated.tsx`), and identifiers (`AddPetForm`) that don't
match the generator code's `toExportPath` / `toIdentifier` output.
This is what a verification harness should check — a small fixture
spec runs every stock generator, captures the actual emitted paths,
and a doc-lint compares those paths to every path mentioned in docs.

The `core/CLAUDE.md` Prettier claim (#16) is structurally different —
it's a meta-doc (Claude's bootstrap context) carrying stale
information. Worth a separate audit of every `CLAUDE.md` in the
workspace to catch other stale claims.

Updated triage order:
1. **#11 (Pet vs pet filename)** — first-touch failure, lethal for
   tutorial onboarding
2. **#12 (init missing basePath)** — same impact class
3. **#13 (tanstack-query path)** — tutorial 02 verification step fails
4. **#14 (shadcn-form path + identifier)** — tutorial 03 verification step fails
5. **#16 (core/CLAUDE.md Prettier claim)** — corrupts every future agent context
6. **#1 (Combobox claim)** — round 1 priority
7. Remaining round-1 items (#2, #5, #6, …) in original order
8. **#15, #17, #18** — polish

---

## Round 3: CLAUDE.md audit (follow-up to #16)

Continuing one-at-a-time. #16 flagged `core/CLAUDE.md`'s Prettier
claim as stale. Auditing the other `CLAUDE.md` files for the same
pattern.

### 19. `skmtc/deno/CLAUDE.md` line 115 lists `prettier` as a "Key Dependency" — stale, no longer used [friction]

`skmtc/deno/CLAUDE.md` (the top-level Deno-workspace CLAUDE.md, sibling
to `cli/`, `core/`, `mcp/`).

**What happened:** Lines 110–115:

```markdown
### Key Dependencies
- `@cliffy/command` & `@cliffy/prompt` - CLI framework
- `@skmtc/core` - Core functionality
- `@std/*` - Deno standard library (from JSR)
- `valibot` - Schema validation
- `prettier` - Code formatting
```

`prettier` is not in any `deno.json` in the workspace:

```bash
grep -n "prettier" skmtc/deno/deno.json skmtc/deno/cli/deno.json \
  skmtc/deno/core/deno.json  # zero hits
```

The user explicitly removed Prettier from SKMTC ("I have removed
mentions of prettier from skmtc since it was unused" — from earlier
this session). The concept doc `three-phases.md` line 267 was updated
to reflect this. But the workspace-level `CLAUDE.md` was missed.

**What was expected:** The "Key Dependencies" list matches actual
runtime dependencies in `deno.json`.

**Why it matters:** Two compounding effects:
1. Every Claude session opening this workspace reads `prettier` as a
   "key dependency" — agents will then reach for prettier-related
   patterns in their work (e.g., "let me run `prettier` on this
   file" or "let me preserve the existing prettier integration").
   Same context-corruption class as #16.
2. The cluster of stale-Prettier-references in CLAUDE.md files
   (#16 + #19, plus `skmtc-platform/CLAUDE.md` if that workspace
   has also removed Prettier — needs separate verification)
   suggests the doc cleanup pass missed the CLAUDE.md class
   systematically.

**Possible fixes:**
- Remove `prettier` from the Key Dependencies list (one-line edit).
- Search every `CLAUDE.md` in the repo for stale Prettier references
  and fix in a single sweep:
  ```bash
  grep -rln "[Pp]rettier" skmtc/ skmtc-generators/ \
    --include="CLAUDE.md"
  ```
- Discovered locations from this audit:
  - `skmtc/deno/CLAUDE.md:115` — this entry
  - `skmtc/deno/core/CLAUDE.md` — entry #16 (in body of "Render Phase")
  - `skmtc-platform/CLAUDE.md:12` — `pnpm format` mentions Prettier;
    needs separate verification of whether prettier is still used in
    that workspace
- Verification command:
  ```bash
  grep -rn "prettier" skmtc/deno/deno.json skmtc/deno/cli/deno.json \
    skmtc/deno/core/deno.json && echo "FAIL" || echo "PASS (no prettier in deno.json)"
  ```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — `skmtc/deno/CLAUDE.md` "Key Dependencies" list: removed `prettier - Code formatting` row, added `ts-pattern - Pattern matching in generator dispatch` (which IS in actual use across stock generators). Cross-audit of remaining `CLAUDE.md` files confirmed entries #16 and #21 cover the only other stale Prettier-era claims; auto-history blocks are not stale-claims.

---

### 20. `skmtc/deno/CLAUDE.md` "Code Organization" section lists CLI subdirs that don't exist + mixes them with core subdirs [friction]

`skmtc/deno/CLAUDE.md` lines 99–108 (positioned under "CLI Architecture"
but the list mixes CLI subdirs with core subdirs).

**What happened:** Doc lists:

```markdown
### Code Organization
- `/lib/` - Core business logic and utilities
- `/generators/` - Generator-specific commands  
- `/auth/` - Authentication code
- `/schemas/` - Schema processing
- `/workspaces/` - Workspace management
- `/context/` - Pipeline contexts
- `/dsl/` - DSL components
- `/oas/` - OpenAPI processing
- `/types/` - Type definitions
```

Actual `cli/` subdirectories (`ls -d cli/*/`):

```
auth/        commands/    components/  deploy/      lib/
prompt/      services/    tasks/       tests/       types/
workspaces/
```

Diff:
- **Doc claims, missing in reality**: `/generators/`, `/schemas/`,
  `/context/`, `/dsl/`, `/oas/`
- **Reality has, doc omits**: `commands/`, `components/`, `deploy/`,
  `prompt/`, `services/`, `tasks/`, `tests/`

`/context/`, `/dsl/`, `/oas/` are **`core/` subdirs**, not `cli/`
subdirs — the doc has mixed two different package layouts under one
heading.

`/generators/` was likely renamed to `/commands/` (the `add`, `clone`,
`install`, `remove`, `list` commands all live in `cli/commands/*.tsx`
now). The doc lists the old name.

**What was expected:** Doc describes the actual workspace layout.

**Why it matters:** Same class as #16/#19 — meta-doc corruption.
Specifically, agents trying to find "where is generator-specific
command code" will look in `cli/generators/` (per the doc), find
nothing, and either give up or hunt. The right path
(`cli/commands/<verb>.tsx`) isn't obvious from the doc.

Also, the "lives in CLI" vs "lives in core" boundary is structurally
important — `cli/` and `core/` are separate packages with separate
deno.json files. Conflating their subdirs in one list misleads agents
about package boundaries.

**Possible fixes:**
- Split the "Code Organization" section into a CLI subsection and a
  Core subsection.
- Update the CLI list to reflect actual directories.
- Audit other monorepo-structure descriptions in CLAUDE.md files for
  the same staleness.
- Verification command:
  ```bash
  diff <(ls -d skmtc/deno/cli/*/ 2>/dev/null | xargs -n1 basename | sort) \
       <(grep -oE '`/[a-z-]+/`' skmtc/deno/CLAUDE.md | tr -d '`/' | sort -u)
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — `skmtc/deno/CLAUDE.md` "Code Organization" section split into two clearly-labelled subsections: `cli/` subdirectories (listing the actual `auth/`, `commands/`, `components/`, `deploy/`, `lib/`, `prompt/`, `services/`, `tasks/`, `tests/`, `types/`, `workspaces/`) and `core/` subdirectories (`context/`, `dsl/`, `oas/`, `gql/`, `run/`, `helpers/`, `types/`, `typescript/`). Fictional `/generators/` and `/schemas/` removed; the core subdirs that were mixed under the CLI heading are now under their own heading.

---

### 21. `skmtc/deno/CLAUDE.md` line 76: "Render Phase: Artifacts → formatted files" — third stale-Prettier-era claim [friction]

`skmtc/deno/CLAUDE.md` line 76.

**What happened:** The "Core Library Architecture" section says:

```markdown
The core follows a three-phase pipeline:

1. **Parse Phase** (`ParseContext`): OpenAPI v3 JSON → internal OAS objects
2. **Generate Phase** (`GenerateContext`): OAS objects → generator artifacts 
3. **Render Phase** (`RenderContext`): Artifacts → formatted files
```

"Artifacts → **formatted** files" reflects the pre-Prettier-removal
state. The concept doc `the-three-phases.md` was already corrected to
say "raw, no formatting" but this meta-CLAUDE.md was missed.

Same problem as #16 (in `core/CLAUDE.md` body) and #19 (in
`skmtc/deno/CLAUDE.md` Key Dependencies list). This is the same stale
claim in a third location. **Three separate Prettier-era stale
references across the meta-doc channel**, all in `CLAUDE.md` files
that load into every agent session.

The cluster suggests the doc-cleanup pass that removed Prettier from
the published docs (`three-phases.md`, glossary, etc.) didn't extend
to the CLAUDE.md files — these are a parallel doc channel with their
own update discipline.

**What was expected:** "Artifacts → file map" (no "formatted" modifier),
matching the concept doc's accurate description.

**Why it matters:** Same as #16 — corrupts every future agent's mental
model of the Render phase. An agent reading "Render produces formatted
files" will infer a formatter step exists somewhere, may search for
it, may add prettier-related code or comments when they shouldn't.

**Possible fixes:**
- Replace "formatted files" with "file map" or "in-memory artifacts"
  to match `the-three-phases.md`.
- Add a CI lint that flags "[Pp]rettier|format" in CLAUDE.md across
  the repo so future Prettier-era claims don't re-accrete.
- Verification command:
  ```bash
  grep -rn "format" skmtc/deno/CLAUDE.md skmtc/deno/core/CLAUDE.md \
    skmtc/deno/cli/CLAUDE.md
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Same edit that addressed #20 (the line-76 "Artifacts → formatted files" claim was inside the three-phase-pipeline block of the same `skmtc/deno/CLAUDE.md` file): rewrote to "Artifacts → `{ path: content }` map (no formatter runs in-pipeline; host writes to disk after worker returns)". All three stale Prettier-era CLAUDE.md sites (#16, #19, #21) now corrected.

---

## Round 4: how-to docs

### 22. `using/how-to/install-a-generator.md` Verification section generalizes about output paths in a way that doesn't match any stock generator [friction]

`using/how-to/install-a-generator.md` lines 51–57.

**What happened:** "Verification" section says:

> After install, generate once and inspect a representative output
> file. If the generator emits per-schema files (`gen-zod`,
> `gen-typescript`), look for `src/generated/<Schema>.generated.ts`.
> If it emits per-operation files (`gen-msw`, `gen-tanstack-*`),
> look for `src/generated/<Tag>/<operation>.generated.ts`.

Both path templates are wrong:

| Generator | Doc claims | Actual `toExportPath` |
|---|---|---|
| `gen-zod` | `src/generated/<Schema>.generated.ts` | `<basePath>/types/<schema>.generated.ts` (lowercase) |
| `gen-typescript` | same | `<basePath>/types/<schema>.generated.ts` (lowercase) |
| `gen-msw` | `src/generated/<Tag>/<operation>.generated.ts` | `<basePath>/mocks/handlers.generated.ts` (single shared file) |
| `gen-tanstack-query-*` | same | `<basePath>/services/<name>.generated.ts` |

Sources verified earlier:
- `gen-zod/src/base.ts:18-22` — `@/types/<decapitalized>.generated.ts`
- `gen-typescript/src/base.ts:13-17` — `@/types/<decapitalized>.generated.ts`
- `gen-msw/src/base.ts:13-17` — `@/mocks/handlers.generated.ts` (no
  per-operation; single file aggregating all handlers)
- `gen-tanstack-query-fetch-zod/src/base.ts:13-17` —
  `@/services/<name>.generated.ts`

So:
- The "by-schema" template forgets the `types/` parent and gets the
  case wrong (capital vs lowercase).
- The "by-operation" template invents a `<Tag>/<operation>` shape that
  no stock generator emits. `<Tag>/` is OpenAPI's tag concept, not a
  SKMTC output convention.

**What was expected:** The doc either lists actual paths per generator,
or doesn't try to generalize at all and says "see the per-generator
reference doc."

**Why it matters:** Same class as Tutorial 01/02/03 path errors
(#11/#13/#14). The user follows install-a-generator.md, runs the
generate, then runs `ls src/generated/<Schema>.generated.ts` and gets
"No such file or directory." Three install paths in this Verification
section, three different ways to fail.

Worse than the tutorials because this how-to is the entry-point for
"add any generator to my project" — it'll be the verification step a
user runs across many generators. The pattern of "wrong paths" repeats
each time.

**Possible fixes:**
- Drop the generalized templates from Verification. Replace with:
  "Check the generator's reference doc for its `toExportPath`. Common
  conventions: schema generators emit `<basePath>/types/`; client
  generators emit `<basePath>/services/`; mock generators aggregate
  into a single file like `<basePath>/mocks/handlers.generated.ts`."
- Or: skip the generalization entirely and just say "run `skmtc list
  my-project --json` after generate to see what was emitted."
- Verification command (per-generator):
  ```bash
  for d in skmtc-generators/gen-*/src/base.ts; do
    echo "=== $d ==="
    grep -A2 "toExportPath" "$d" | head -4
  done
  ```

**Version anchor:** Stock generators `@skmtc/gen-*@0.0.57`

**Status:** verified-fixed 2026-05-12 — `using/how-to/install-a-generator.md` Verification section replaced the two wrong path templates with a `jq '.files'` invocation against the `--json` stdout (always accurate) plus a table of common stock-generator conventions (`gen-zod`/etc. → `<basePath>/types/<decapitalized>.generated.ts`; `gen-tanstack-query-*` → `<basePath>/services/...`; `gen-shadcn-form` → `<basePath>/forms/<Verb><Path>Form.generated.tsx` with the verb-derived identifier explicitly named; `gen-msw` → single shared `<basePath>/mocks/handlers.generated.ts`; server generators → single shared router file). All entries cross-checked against the actual `toExportPath` definitions.

---

### 23. `change-identifier-conventions.md` example for "gen-zod default" omits `camelCase` — fails for non-camelCase refNames [friction]

`extending/how-to/change-identifier-conventions.md` lines 32–34.

**What happened:** Doc says:

```ts
// gen-zod default
toIdentifier: ({ refName }) => Identifier.createVariable(decapitalize(refName))
// → "user", "order", "pet"
```

The actual gen-zod default (`gen-zod/src/base.ts:14-18`):

```ts
toIdentifier({ refName }): Identifier {
  const name = decapitalize(camelCase(refName));
  return Identifier.createVariable(name);
}
```

The doc-snippet omits the `camelCase()` step. For PascalCase refNames
(`Pet`, `Order`, `User`), the two are equivalent — `decapitalize("Pet")
= "pet"` either way. But for kebab-case or snake_case refNames:

- `decapitalize("user-profile")` → `"user-profile"` — **invalid JS
  identifier**, contains hyphens
- `decapitalize(camelCase("user-profile"))` → `"userProfile"` — valid

OpenAPI specs frequently have hyphenated component names (e.g.,
`User-Profile`, `Pet-Owner`). A user following the how-to verbatim to
clone gen-zod and adjust naming would lose the kebab→camel
normalization and break their build the first time they hit a hyphen.

**What was expected:** The doc-snippet to be a faithful representation
of the stock default, including the `camelCase` step.

**Why it matters:** Class of failure: the doc is **simplified to the
point of breaking**. The shortened example is meant to be a starting
template, but the shortening drops a load-bearing call.

Also fits the broader pattern: stock-generator code was paraphrased
rather than quoted. Same as the entries in round 1 — the doc-writer
reduced what they saw to what they thought the reader needed, dropping
detail that matters.

**Possible fixes:**
- Quote the actual gen-zod `toIdentifier` verbatim, including
  `camelCase`.
- Or replace with a single literal: `Identifier.createVariable('userBody')`
  to make it clear this is illustrative and the actual stock has more
  going on.
- Add a note: "Always normalize through `camelCase` (from `@skmtc/core/strings`)
  so kebab/snake-case refNames produce valid JS identifiers."
- Verification command:
  ```bash
  diff <(grep -A3 "toIdentifier" skmtc-generators/gen-zod/src/base.ts) \
       <(grep -A1 "gen-zod default" skmtc/deno/docs/extending/how-to/change-identifier-conventions.md)
  ```

**Version anchor:** `@skmtc/gen-zod@0.0.57`

**Status:** verified-fixed 2026-05-12 — `extending/how-to/change-identifier-conventions.md` lines 29-43 rewritten: the gen-zod default now shows `decapitalize(camelCase(refName))` (matching the real `gen-zod/src/base.ts:14-18`); the PascalCase-with-suffix example and type-generator example now also route through `camelCase` so kebab/snake-case refNames produce valid JS identifiers. Added an explicit prose note: "Always normalize through `camelCase` first. OpenAPI components often have hyphenated or snake_case names (`User-Profile`, `pet_owner`). `decapitalize` alone preserves separators, leaving you with `"user-profile"` — not a valid JS identifier."

---

### 24. `compose-with-another-generator.md` invents a `@local/` namespace for cloned peers that doesn't exist [friction]

`extending/how-to/compose-with-another-generator.md` lines 32–37.

**What happened:** Doc says:

> If the peer is a sibling clone in your project, import via the
> project's local path:
>
> ```ts
> import { ZodProjection } from '@local/gen-zod/src/ZodProjection.ts'
> ```

This implies a `@local/` import-map namespace exists for cloned
generators. It doesn't.

The actual clone behavior (`clone-vs-install.md` lines 84–90 and
`cli/lib/generator.ts:204-210` + `cli/lib/project.ts:142-172`):

1. The cloned source lands at `.skmtc/<project>/<package-name>/`
   (e.g., `.skmtc/my-project/gen-zod/`).
2. The project's `deno.json#imports` updates the **existing** import
   key — not a new `@local/` namespace — from a JSR URL to a relative
   path:

   ```json
   { "@skmtc/gen-zod": "./gen-zod/mod.ts" }
   ```

3. So the import statement inside a sibling clone is exactly the same
   as the install path:

   ```ts
   import { ZodProjection } from '@skmtc/gen-zod'  // unchanged
   ```

A reader following the doc's `@local/gen-zod/src/ZodProjection.ts`
incantation would get a "Cannot resolve specifier" error from Deno.
The `@local/` namespace they'd then go looking for in their
`deno.json` doesn't exist — leaving them stuck.

**What was expected:** the doc tracks the actual clone behavior: import
specifier stays the same, the resolution target changes from JSR to a
local path via the project's `deno.json#imports`.

**Why it matters:** "Compose with another generator" is one of the
most common follow-on tasks after cloning. The doc's whole point is to
unblock that task — and the snippet on line 35–37 introduces a
fictional construct that wouldn't even resolve. A user encountering
this might:
1. Try the literal `@local/...` and get an import error
2. Search the project for `@local` and find nothing
3. Conclude clone is fundamentally broken, file a bug

The right path (use the same `@skmtc/gen-zod` import) is the simpler
and obvious one, but the doc obscures it by inventing this namespace.

**Possible fixes:**
- Drop the "if the peer is a sibling clone" block entirely. The import
  statement is the same whether the peer is installed or cloned —
  that's the whole point of the `deno.json#imports` indirection.
- Or replace the "sibling clone" block with: "If the peer is a sibling
  clone, the import statement is unchanged. Cloning swaps the
  `@skmtc/gen-zod` mapping in `deno.json#imports` from JSR to a local
  path; the import specifier stays the same."
- Verification command:
  ```bash
  grep -n "@local" skmtc/deno/cli/lib/generator.ts \
    skmtc/deno/cli/lib/project.ts
  # Should return no hits — confirming no @local/ namespace exists
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — `extending/how-to/compose-with-another-generator.md` "if the peer is a sibling clone" block rewritten. The fictional `@local/gen-zod/src/ZodProjection.ts` import path replaced with the actual behaviour: the import specifier is **the same whether the peer is installed or cloned** (`import { ZodProjection } from '@skmtc/gen-zod'`). Cloning swaps the mapping in `deno.json#imports` from a JSR URL to a relative local path; the import statement in generator source stays unchanged. Added an explanatory paragraph naming this as the whole point of the `deno.json#imports` indirection, and explicitly noting there is no separate `@local/` namespace.

---

### 25. `debug-failing-generation.md` jq recipes use wrong manifest paths (`manifest.diagnostics`, `manifest.files[].result`) [blocker]

`using/how-to/debug-failing-generation.md` lines 30 and 43.

**What happened:** Doc gives two debugging recipes:

```bash
jq '.manifest.diagnostics' generate-output.json
jq '.manifest.files[] | { path: .destinationPath, result: .result }' generate-output.json
```

Both paths are wrong against the actual `ManifestContent` shape
(`core/types/Manifest.ts:147-165`):

```ts
export type ManifestContent = {
  deploymentId: string
  traceId: string
  spanId: string
  region?: string
  files: Record<string, ManifestEntry>
  previews: Record<string, Preview>
  mappings?: Record<string, Mapping>
  results: ResultsItem      // ← per-operation results live here
  parseIssues: ParseIssue[] // ← NOT "diagnostics"
  startAt: number
  endAt: number
}

export type ManifestEntry = {
  lines: number
  characters: number
  destinationPath: string
  // ← NO `result` field
}
```

Concretely:

1. `manifest.diagnostics` does not exist. Parse issues are at
   `manifest.parseIssues` (an array). Doc users running the doc's
   `jq` get `null`.

2. `manifest.files[].result` does not exist. `ManifestEntry` has only
   `{lines, characters, destinationPath}`. The per-operation result
   status lives in the recursive `manifest.results` tree, keyed by
   StackTrail segments — not by destinationPath.

3. `ResultType` has **five** values, not four. The actual union
   (`core/types/Results.ts`):
   ```ts
   export type ResultType = 'success' | 'warning' | 'error' | 'skipped' | 'notSupported'
   ```
   The doc lists "`success`, `warning`, `error`, or `skipped`" and
   omits `'notSupported'` — which is the value emitted when a
   generator's `isSupported` returns false (the most common
   "operation didn't emit" reason).

**What was expected:** jq recipes work against the actual manifest
shape and produce useful output.

**Why it matters:** Highest severity in this round. The
debug-failing-generation how-to is what users reach for when **already
in trouble**. Running the doc's two main jq commands and getting
`null` back compounds the debugging session — now they're debugging
both their original problem AND the doc.

Concretely:
- "Inspect parseIssues" step — `jq '.manifest.diagnostics'` returns
  `null`. User has no parseIssues view; they miss real parse errors.
- "Check per-operation results" step — `jq '.manifest.files[] |
  select(.result == "skipped")'` returns nothing because no `result`
  field exists. User concludes nothing was skipped when in fact
  `isSupported` may have filtered out everything.
- The `'notSupported'` omission is structurally important — it's the
  most common case for "why isn't my generator emitting?" An
  isSupported-filtered operation gets `'notSupported'` in
  `manifest.results`, not `'skipped'`. A reader who searches their
  results for `'skipped'` misses the actual cause.

**Possible fixes:**
- Replace `manifest.diagnostics` → `manifest.parseIssues` (multiple
  occurrences in the doc).
- Replace the per-file-result recipe with a recipe that walks
  `manifest.results` (the recursive tree).
- Add `'notSupported'` to the result-types list. Distinguish from
  `'skipped'`: `'notSupported'` = generator's `isSupported` returned
  false; `'skipped'` = settings explicitly skipped via `skip:` /
  `include:`.
- Audit other docs for the same wrong `manifest.diagnostics` claim:
  ```bash
  grep -rn "manifest\.diagnostics\|\.diagnostics" skmtc/deno/docs/
  ```
- Verification command (against actual type):
  ```bash
  grep -A20 "^export type ManifestContent" \
    skmtc/deno/core/types/Manifest.ts
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `using/how-to/debug-failing-generation.md` rewritten on three fronts: (1) the parseIssues recipe is `jq '.parseIssues'` against top-level stdout (no `manifest.diagnostics`, which doesn't exist); (2) the per-operation results recipe now points users at the on-disk `manifest.json` `results` tree (since `--json` stdout has no per-operation results, contrary to the old `.manifest.files[].result` claim — `ManifestEntry` has no `result` field); (3) `ResultType` is documented as five values not four, with `'notSupported'` named as the "generator's `isSupported` predicate rejected this operation" case distinguished from user-explicit `'skipped'`. Verification section and Troubleshooting bullet updated to match. Cross-audit found one more `manifest.diagnostics` site in `using/how-to/install-a-generator.md:83`; fixed there too.

---

### 26. `update-a-schema.md` claims `skmtc generate --json` has `.artifacts` field; actual JSON output has `.files` (and no `.manifest` wrapper) [blocker]

`using/how-to/update-a-schema.md` line 49, and a correction to entry #25.

**What happened:** Doc gives this cleanup recipe:

```bash
skmtc generate <project> --json | jq -r '.artifacts | keys[]' > after.txt
```

The actual `skmtc generate --json` output shape
(`cli/lib/print-generate-result.ts:42-59`):

```ts
{
  kind: 'generated',
  projectName: string,
  basePath: string | null,
  manifestPath: string,
  stats: {
    tokens, lines, files, totalTimeMs
  },
  files: result.filePaths,        // ← top-level `files`, not `.artifacts`
  errors: number,
  parseIssues: ParseIssue[],      // ← top-level, not `.manifest.parseIssues`
  typecheck?: TypecheckResult
}
```

Two compounding problems:

1. **No `.artifacts` field.** The closest is `.files` (the list of
   emitted file paths). The user's `jq -r '.artifacts | keys[]'`
   command outputs nothing.

2. **No `.manifest` wrapper.** This is a correction to entry #25 — I
   said "use `.manifest.parseIssues` instead of `.manifest.diagnostics`",
   but actually `.parseIssues` is at the top level of the JSON output,
   not under `.manifest.*` at all. The `manifest.json` file written
   to disk has the wrapped shape; the `--json` stdout output is a
   different, flatter shape.

So the docs systematically confuse two different JSON shapes:
- `manifest.json` on disk → has `parseIssues`, `files`, `results`,
  etc. under a single `ManifestContent` root
- `skmtc generate --json` stdout → has `parseIssues` and `files` at
  the top level, plus `manifestPath` pointing at the on-disk file

The doc-writer appears to have conflated them.

**What was expected:** Doc recipes match the actual JSON output shape.

**Why it matters:** The `update-a-schema.md` recipe is supposed to
help users clean up stale generated files after schema updates — a
common operation. The doc's command exits without any output (jq prints
nothing when the key is missing). The user assumes the new spec
matches the old (nothing to clean up) and ships stale generated files.

Combined with #25, this is the same systemic confusion (manifest
shape) affecting two docs.

Other docs likely affected (need verification):
- `use-in-ci-cd.md` line 65 references `parseIssues` (correct
  top-level, this one is right)
- `use-in-ci-cd.md` line 74: "`parseIssues` is forwarded verbatim
  **from the manifest** into the top-level JSON output" — this
  is structurally correct but conflicts with the doc's own use of
  `manifest.diagnostics` elsewhere

**Possible fixes:**
- In `update-a-schema.md` line 49: replace `.artifacts | keys[]` with
  `.files[]`.
- Update entry #25 fix-list: parse issues are at `.parseIssues` (top
  level), not `.manifest.parseIssues`.
- Audit docs for `manifest.<field>` references in `jq` recipes — for
  `skmtc generate --json` they should usually drop the `manifest.`
  prefix; for reading the on-disk `manifest.json` they should keep it.
- Add a "two JSON shapes" callout in the manifest-format reference
  doc, distinguishing the on-disk manifest from the stdout JSON
  output.
- Verification command:
  ```bash
  grep -A20 "kind: 'generated'" \
    skmtc/deno/cli/lib/print-generate-result.ts
  ```

**Version anchor:** `@skmtc/cli@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — `using/how-to/update-a-schema.md` Option-1 cleanup recipe rewritten from `jq -r '.artifacts | keys[]'` to `jq -r '.files[]'` (top-level `files` array of paths, matching `cli/lib/print-generate-result.ts:42-59`). Added explanatory parenthetical naming the difference. One more stale `manifest.diagnostics` site at line 88 of the same file also fixed (now references top-level `.parseIssues` and points at INVALID_SCHEMA/INVALID_DEPENDENCY_REF). The two-JSON-shapes pattern (on-disk `manifest.json` vs stdout `--json`) is now consistently described throughout the affected docs.

---

### 27. `pin-schema-source.md` + `update-a-schema.md` jq recipes against `agent-context --json` reference fields that don't exist [friction]

`using/how-to/pin-schema-source.md` line 58 and
`using/how-to/update-a-schema.md` line 71.

**What happened:** Two docs use `agent-context --json | jq` recipes
that reference fields not in the actual output:

**pin-schema-source.md** line 58:
```bash
skmtc agent-context --json | jq '.projects[] | select(.name=="<project>") | .schema'
```
> it should report the configured `source` and a recent `lastFetched`
> timestamp.

**update-a-schema.md** line 71:
```bash
skmtc agent-context --json | jq '.projects[].lastGenerate'
```
> to confirm the run was recent and produced the expected number of
> artifacts.

The actual `ProjectSnapshot` shape
(`cli/lib/agent-context-headless.ts:33-43`):

```ts
export type ProjectSnapshot = {
  name: string
  basePath: string | null
  schemaSource: string | null    // ← a string, not a `.schema` object
  generators: {
    remote: string[]
    local: string[]
  }
}
```

Missing entirely:
- **`.projects[].schema`** (with `.source` and `.lastFetched`) — the
  actual field is `schemaSource` (a flat string). There is no
  `lastFetched` field anywhere in `ProjectSnapshot`.
- **`.projects[].lastGenerate`** — does not exist. `ProjectSnapshot`
  carries no run-history information at all. The manifest on disk
  has `startAt`/`endAt`, but `agent-context` doesn't surface those.

Both doc recipes return `null` when run.

**What was expected:** The recipes match `ProjectSnapshot`'s actual
field set, OR the actual implementation grows the fields the docs
claim, OR the docs drop the recipes that don't work.

**Why it matters:** Same systemic issue as BULK-026 (already in
`discrepancy-catalog.md`): the `agent-context` output was *documented*
with a much richer shape than the implementation provides. BULK-026
catalogued the agent-context.md reference fabrication; these two
how-tos are downstream sites that inherit the same fabrication.

When a user follows `pin-schema-source.md` and runs the
verification jq, they get `null`. They cannot confirm "schema source
is configured and fetched" via `agent-context`. They fall back to
`cat .skmtc/<project>/.settings/client.json` and lose the
purpose-built CLI tool.

When a user follows `update-a-schema.md` and runs the
post-regenerate verification, they get `null`. They cannot confirm
"recent run, expected artifact count." They have to read the manifest
file directly.

**Possible fixes:**
- **Short-term:** Replace both jq recipes with ones that work against
  the actual shape:
  - `pin-schema-source.md` line 58: `jq '.projects[] | select(.name=="<project>") | .schemaSource'`
  - `update-a-schema.md` line 71: replace with something like
    `stat .skmtc/<project>/.settings/manifest.json` (since
    `ProjectSnapshot` doesn't carry a `lastGenerate` and the manifest
    file's mtime is the closest proxy).
- **Long-term:** If the docs' richer `agent-context` shape (with
  `schema.lastFetched`, `lastGenerate`, etc.) is actually desired
  product behaviour, file a feature request for `agent-context` to
  surface those fields. Then update docs once shipped.
- Cross-ref BULK-026 in `discrepancy-catalog.md` — same root cause.
- Verification command:
  ```bash
  grep -A10 "export type ProjectSnapshot" \
    skmtc/deno/cli/lib/agent-context-headless.ts
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — both jq recipes corrected to match the actual `ProjectSnapshot` shape (`cli/lib/agent-context-headless.ts:33-43`). `pin-schema-source.md:58` Verification now reads `.projects[] | select(.name=="<project>") | .schemaSource` (flat string, not a `.schema` object) with a note that fetch-timestamp info doesn't exist on `ProjectSnapshot` — check the on-disk manifest's `endAt` if you need recency. `update-a-schema.md:75` Verification now uses an on-disk manifest jq recipe (`jq '{ endAt, fileCount: (.files | length) }' .skmtc/<project>/.settings/manifest.json`) instead of the fictional `.projects[].lastGenerate`. Cross-ref to BULK-026 acknowledged — the underlying agent-context surface gap is a separate concern.

---

### 28. `recipes/full-stack-typescript-app.md` is fictional from line 93 onwards — wrong paths, wrong identifiers, wrong API signatures throughout [blocker]

`using/recipes/full-stack-typescript-app.md`.

**What happened:** Past the setup section (lines 1–87, which are
correct), the rest of the recipe is structurally fabricated. The
fabricated content is the "What ends up where" project tree, code
examples, and usage examples — i.e., the entire output-shape
walkthrough.

**Project tree (lines 93–103):**

| Doc claims | Actual |
|---|---|
| `src/generated/Pet.generated.ts` | `src/generated/types/pet.generated.ts` |
| `src/generated/pet/addPet.generated.tsx` | `src/generated/forms/PostPetForm.generated.tsx` |
| `src/generated/pet/getPetById.generated.ts` | `src/generated/services/useGetPetById.generated.ts` |
| `src/generated/mocks.generated.ts` | `src/generated/mocks/handlers.generated.ts` |

The doc invents a `pet/` parent dir (tag-based) that no stock generator
produces. The actual layout is dir-by-generator-kind (`types/`,
`forms/`, `services/`, `mocks/`).

**Imports in example (lines 109, 119):**

```ts
// Doc claims:
import { pet, type Pet } from '../Pet.generated.ts'   // wrong casing + missing types/ dir

// Actually:
import { pet } from '@/generated/types/pet.generated.ts'
import type { Pet } from '@/generated/types/pet.generated.ts'
```

**Usage example (lines 134–145):**

```tsx
// Doc claims:
import { useGetPetById } from '@/generated/pet/getPetById.generated.ts'
import { AddPetForm } from '@/generated/pet/addPet.generated.tsx'

// Actually:
import { useGetPetById } from '@/generated/services/useGetPetById.generated.ts'
import { PostPetForm } from '@/generated/forms/PostPetForm.generated.tsx'
//          ^^^^^^^^^^^ — verb-derived, not operationId-derived (#14)
```

**MSW usage (lines 153–155):**

```ts
// Doc claims:
import { toRoutesList } from '@/generated/mocks.generated.ts'
const worker = setupWorker(...toRoutesList({ store: yourMockStore }))

// Actually:
import { toRoutesList } from '@/generated/mocks/handlers.generated.ts'
const worker = setupWorker(...toRoutesList())  // nullary — see entry #4
//                                          ^^ no deps argument
```

**Setup description claims (line 50):**

> Emits per-operation `http.get`/`http.post` handlers plus a shared
> `toRoutesList(deps)` factory.

The `(deps)` is fictional — confirmed in entry #4. `toRoutesList` is
nullary.

**What was expected:** The recipe runs against a real fixture spec
(Petstore is the obvious choice), captures the actual output tree and
imports, and reflects those verbatim.

**Why it matters:** Highest user-impact entry in this round. This
recipe is **the** canonical "full stack with SKMTC" walkthrough. Users
adopting SKMTC for a typical app come here first. **Every single
import statement in the usage examples is wrong**:

1. They paste the imports into their app.
2. TypeScript reports `Cannot find module '@/generated/Pet.generated.ts'`.
3. They look in `src/generated/`, find no `Pet.generated.ts`, find no
   `pet/` dir.
4. They wonder if generation silently failed.
5. They check the docs — but the docs show the tree they expected.
6. Friction escalates.

Compounds with #11 (Tutorial 01 wrong casing), #14 (form path),
#22 (install how-to wrong paths) — same systemic class. The recipe
is the worst hit because of density: ~6 distinct fabrications in
~150 lines.

**Possible fixes:**
- Generate the example against the real Petstore spec, capture the
  output tree via `tree src/generated/` or `find`, paste the actual
  tree into the doc.
- Replace every import statement with one that would actually resolve.
- Fix `toRoutesList(deps)` → `toRoutesList()` (compounds with #4).
- Fix `AddPetForm` → `PostPetForm`.
- Apply the same fixes to `recipes/api-mocks-for-frontend.md` and
  `recipes/multi-project-monorepo.md` (likely have analogous issues —
  not yet verified).
- Verification approach (one-time, runs generators end-to-end):
  ```bash
  # Set up a real petstore project, install all 5 generators, run
  # generate, then capture the output:
  tree src/generated/
  grep -r "^import" src/generated/ | head -20
  ```

**Version anchor:** Stock generators `@skmtc/gen-*@0.0.57`

**Status:** verified-fixed 2026-05-12 — `using/recipes/full-stack-typescript-app.md` substantially rewritten: `init` example now has `src/generated` basePath; gen-msw description now says "shared nullary `toRoutesList()` factory" not "`toRoutesList(deps)`"; project tree rewritten to show actual per-generator subdirs (`types/`, `services/`, `forms/`, `mocks/`) with decapitalized filenames for `gen-zod`/`gen-typescript` and verb-derived `PostPetForm.generated.tsx` for `gen-shadcn-form`; hook example imports from `@/generated/services/...` and `@/generated/types/...`; form example imports from `@/generated/forms/...`; usage example uses `PostPetForm` (not the fictional `AddPetForm`); MSW setup uses `toRoutesList()` (nullary) and imports from `@/generated/mocks/handlers.generated.ts`; added a callout that verb-derived identifiers differ from operationIds (cross-ref to #14). Added a pointer to api-mocks-for-frontend.md for stateful-mocks discussion.

---

### 29. `recipes/api-mocks-for-frontend.md` builds its "stateful mocks" variation on the fictional `toRoutesList(deps)` API [blocker]

`using/recipes/api-mocks-for-frontend.md` lines 51–58, 65–72, 115–118.

**What happened:** This recipe centers on MSW for frontend
development, and its key value-add ("Stateful mocks" variation) is
built entirely on a fictional API signature.

**Line 51–53 (setup description):**

> The `gen-msw` generator emits one `http.get` / `http.post` /
> etc. handler per operation, plus a shared `toRoutesList(deps)`
> factory that returns the array MSW's `setupWorker` expects.

**Line 57–58 (the user-facing pattern):**

> For mutation-and-list patterns, you'll typically supply a mock
> data store via the `deps` argument.

**Line 65–72 (concrete example):**

```ts
import { toRoutesList } from '@/generated/mocks.generated.ts'

const mockStore = {
  pets: [{ id: 1, name: 'Fluffy' }, { id: 2, name: 'Rex' }],
  users: []
}

export const worker = setupWorker(...toRoutesList({ store: mockStore }))
```

**Line 115–118 (the marquee feature):**

> **Stateful mocks.** The stock `toRoutesList(deps)` factory
> accepts a `deps` object — pass an in-memory data store with
> `add`/`update`/`remove` methods to make POST/PUT/PATCH
> handlers actually mutate state, not just echo responses.

The actual `toRoutesList` emission (`gen-msw/src/MockRoutesList.ts:23`)
is `() => ${this.list}` — a **nullary** arrow function returning a
fixed array. It accepts no arguments, has no slot for a `deps`
parameter, and can't carry a data store. Calling
`toRoutesList({ store: mockStore })` is a type-error at compile (no
parameter) and the argument is silently ignored at runtime.

Three sites on this recipe alone reference the fictional
`toRoutesList(deps)`. Combined with `gen-msw.md` (#4) and
`recipes/full-stack-typescript-app.md` (#28), that's **five+ doc
sites** building on the fiction.

Also wrong: line 65 import path `'@/generated/mocks.generated.ts'`
(actual: `'@/generated/mocks/handlers.generated.ts'`).

**What was expected:** Either the recipe matches the actual nullary
`toRoutesList` (and acknowledges that stateful mocks need clone-and-
edit), or the engine grows the `deps`-accepting signature the docs
keep promising.

**Why it matters:** The recipe's central value proposition
("**Stateful mocks** — pass an in-memory data store") **doesn't
work** with the stock generator. A user adopting MSW for frontend
mocking specifically *because* they want stateful behaviour will:

1. Read the recipe.
2. Write `mockStore` per the example.
3. Run `setupWorker(...toRoutesList({ store: mockStore }))`.
4. Get TypeScript errors (signature mismatch).
5. Or, if they `as any` past, get static mocks regardless of `store`
   contents.
6. Conclude SKMTC's MSW integration is broken.

Worse than a wrong path: the *concept the recipe sells* is wrong.

**Possible fixes:**
- Edit `gen-msw/src/MockRoutesList.ts:23` to accept `deps` and thread
  it through — actually implement what the docs promise. (Likely the
  right fix — multiple docs claim this; it's coherent.)
- OR change every `toRoutesList(deps)` reference in docs to
  `toRoutesList()` and rewrite "Stateful mocks" as "Clone gen-msw and
  thread a deps argument through `MockRoutesList.toString()`."
- Also fix line 65 import path: `@/generated/mocks.generated.ts` →
  `@/generated/mocks/handlers.generated.ts`.
- This is the third doc instance of the `toRoutesList(deps)`
  fabrication. The cluster strongly suggests "fix the code, not the
  docs" — multiple independent doc writers landed on the same
  intuition about what the API should be.
- Verification command:
  ```bash
  grep -A3 "override toString" \
    skmtc-generators/gen-msw/src/MockRoutesList.ts
  # Should show `() => ${this.list}` (nullary)
  ```

**Version anchor:** `@skmtc/gen-msw@0.0.57`

**Status:** verified-fixed 2026-05-12 (docs route) — `using/recipes/api-mocks-for-frontend.md` setup section says "all handlers into a single file (`<basePath>/mocks/handlers.generated.ts`), plus a shared nullary `toRoutesList()`" with explicit "the handlers are stateless in the stock generator". Wire-MSW example: `setupWorker(...toRoutesList())` (nullary, no mockStore arg), correct import path `'@/generated/mocks/handlers.generated.ts'`. "Stateful mocks" variation rewritten: explicit that the stock `toRoutesList()` takes no arguments; stateful behaviour requires cloning `gen-msw` and editing `MockRoute.ts`/`MockRoutesList.toString()` to thread an argument through. `init` example also includes basePath. Code-route fix (giving `toRoutesList` a real `deps` parameter in `gen-msw`) was flagged but **not actioned** — multiple doc sites converged on the same intuition, suggesting it's a reasonable feature request; logged as a separate concern.

---

### 30. `recipes/multi-project-monorepo.md` "Shared cloned generators" variation glosses over manual setup the CLI doesn't support [polish]

`using/recipes/multi-project-monorepo.md` lines 136–139.

**What happened:** Variation section says:

> **Shared cloned generators.** If both projects want the same
> customized generator, clone it once at the workspace root and
> symlink (or just use the same path in each project's
> `deno.json#imports`). See [recipe: design system across many
> APIs].

The `skmtc clone` command **always** targets one project — it requires
`projectName` and writes to `<root>/.skmtc/<projectName>/<packageName>/`
via `toProjectPath(projectName)` in `cli/lib/generator.ts:205`. There
is no "clone at workspace root" option and no built-in symlink path.

A user reading this who tries `skmtc clone` without a project argument
gets a recipe-error from the strict-mode handler asking for the
project name. They can't follow the recipe verbatim.

The "or just use the same path in each project's `deno.json#imports`"
parenthetical glosses over what's actually a multi-step manual
workflow:
1. Clone into project A: `skmtc clone -g @skmtc/gen-form A`
2. Manually `cp -r .skmtc/A/gen-form .skmtc/shared-generators/gen-form`
   (or `mv` + symlink back).
3. Edit `.skmtc/A/deno.json` to point at the shared location.
4. Edit `.skmtc/B/deno.json` to point at the shared location.
5. Remember to `skmtc bundle A` and `skmtc bundle B` whenever the
   shared generator changes.

The recipe presents this as a one-line option ("clone it once"); in
reality it's a substantial manual workflow with synchronization
concerns the doc doesn't address (what happens if both projects pin
different `@skmtc/core` versions and the shared clone's peer-pin
check passes for one and fails for the other?).

**What was expected:** Either a complete walkthrough of the manual
steps (with the gotchas surfaced), or removal of the variation if it's
not actually supported.

**Why it matters:** Lower severity than #28/#29 — the recipe's
**setup section** (lines 21–119) is correct. Only this one variation
at the bottom is problematic. But users adopting SKMTC across a
monorepo will hit this variation specifically when they realize "I
need the same customization in both projects, do I clone twice or
once?" — and the doc tells them to clone once via a workflow that
doesn't exist as documented.

Compounds slightly with #12 (the `skmtc init customer-api` step on
line 47 also has the missing-basePath issue, since this recipe repeats
the same incomplete `init` syntax).

**Possible fixes:**
- Either expand the bullet into a "Shared customizations across
  projects" subsection with the actual manual steps and gotchas, or
  drop it (refer to the linked design-system recipe and let that one
  handle it).
- Drop the implicit claim that `skmtc clone` supports a workspace-root
  target. If `skmtc clone` should support this (likely-useful
  feature), file a feature request and update docs once shipped.
- Also fix line 47 `skmtc init customer-api` to include basePath (see
  #12).
- Verification command:
  ```bash
  grep -A5 "skmtc clone" \
    skmtc/deno/cli/commands/clone.tsx | head -20
  # Confirm clone always targets a single project
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — `using/recipes/multi-project-monorepo.md` "Initialize multiple projects" step now includes basePath positional args matching each project's downstream config (`skmtc init customer-api packages/customer-app/src` etc., with a note that the second arg is required in non-TTY environments). "Shared cloned generators" variation expanded from a one-line bullet into a five-step manual workflow: clone into one project, move source to shared location, update both `deno.json#imports`, rebundle both. Added the peer-pin-skew caveat. The implicit claim that `skmtc clone` supports a workspace-root target is gone — the actual single-project constraint is named explicitly.

---

### 31. `recipes/custom-form-field-renderer.md` references files in `gen-shadcn-form/src/fields/` that don't exist [friction]

`extending/recipes/custom-form-field-renderer.md` lines 36–46 and 175.

**What happened:** The recipe's "Source layout" section claims:

```
.skmtc/my-project/gen-shadcn-form/src/
├── ShadcnForm.ts              # main Projection
├── FormFields.ts              # iterates schema properties
├── schemaToField.ts           # dispatch: schema → field renderer
├── fields/
│   ├── BooleanInput.ts
│   ├── StringInput.ts
│   ├── ReferenceField.ts
│   └── ...
```

Actual contents of `gen-shadcn-form/src/fields/`:

```
CheckboxInput.ts        IntegerInput.ts        NumberInput.ts
ObjectInput.ts          SelectInput.ts         StringInput.ts
Table.ts
```

- `BooleanInput.ts` — **doesn't exist**. The actual file is
  `CheckboxInput.ts` (different name for the boolean-input concept).
- `ReferenceField.ts` — **doesn't exist**. The operation-reference
  dispatch is in `SelectInput.ts` (via the `gen-shadcn-select` peer).
- Missing from doc: `IntegerInput.ts`, `NumberInput.ts`,
  `ObjectInput.ts`, `Table.ts`, `CheckboxInput.ts`, `SelectInput.ts`.

A user reading "first read `schemaToField.ts` and `fields/` first.
You'll add to both" (line 48), then opening their cloned generator,
would find `fields/CheckboxInput.ts` not `BooleanInput.ts`. Confusion
escalates: which file should I emulate for my DatePicker? The doc
pointed me at a fictional `BooleanInput.ts`.

**Line 175 (verification step):**

```bash
cat src/generated/forms/CreateEvent.generated.tsx
```

Same identifier-naming issue as #14 (Tutorial 03 form-name
fabrication). For `POST /events` with operationId `createEvent`, the
actual file is `forms/PostEventsForm.generated.tsx` (verb-derived,
plural path). `CreateEvent.generated.tsx` doesn't exist.

**What was expected:** The doc's file listing matches what's in
`gen-shadcn-form/src/fields/` and the verification path matches what
the form generator actually emits.

**Why it matters:** This recipe is the **canonical "extend a stock
generator" recipe** — used by anyone wanting to add a new field type.
The first thing they do after cloning is open `fields/` to study the
existing renderers as templates. The doc names two files that don't
exist; users either:
1. Hunt for the missing files (confused).
2. Conclude they cloned wrong / something is missing.
3. Create their own `BooleanInput.ts` (duplicating intent of the
   existing `CheckboxInput.ts`) and end up with two boolean renderers.

The verification step (line 175) also fails — `cat` returns "No such
file" — leaving the user uncertain whether their DatePicker
implementation worked.

**Possible fixes:**
- Update the source-layout listing to match actual `fields/`:
  `CheckboxInput.ts`, `IntegerInput.ts`, `NumberInput.ts`,
  `ObjectInput.ts`, `SelectInput.ts`, `StringInput.ts`, `Table.ts`.
- Update the verification step to use the actual form path. For a
  `POST /events` operation, it'd be
  `forms/PostEventsForm.generated.tsx` (or whatever the path is —
  refer to the actual generator's `toIdentifier`).
- Verification command:
  ```bash
  ls skmtc-generators/gen-shadcn-form/src/fields/
  ```

**Version anchor:** `@skmtc/gen-shadcn-form@0.0.57`

**Status:** verified-fixed 2026-05-12 — `extending/recipes/custom-form-field-renderer.md` "Source layout" tree rewritten to match the actual `gen-shadcn-form/src/fields/` listing: `CheckboxInput.ts`, `IntegerInput.ts`, `NumberInput.ts`, `ObjectInput.ts`, `SelectInput.ts`, `StringInput.ts`, `Table.ts`. Added explicit notes: no `BooleanInput.ts` (booleans render via `CheckboxInput.ts`); no `ReferenceField.ts` (operation-reference protocol lives inside `SelectInput.ts` paired with `gen-shadcn-select`). Also added the surrounding files (`FormLabel.ts`, `base.ts`, `enrichments.ts`, `mod.ts`) so the layout matches a real clone. Verification step path corrected from `forms/CreateEvent.generated.tsx` to `forms/PostEventsForm.generated.tsx` (verb-derived per gen-shadcn-form's `toIdentifier`).

---

### 32. `recipes/design-system-across-many-apis.md` example code uses free-standing exports for `toIdentifier`/`toExportPath`; actual API requires them as config fields on the factory call [blocker]

`extending/recipes/design-system-across-many-apis.md` lines 60–79.

**What happened:** Doc shows this customization template:

```ts
// .skmtc/shared/gen-zod/src/base.ts
import { Identifier, capitalize } from '@skmtc/core'

// House style: PascalCase with "Schema" suffix
export const toIdentifier = ({ refName }) =>
  Identifier.createVariable(`${capitalize(refName)}Schema`)

// House style: per-domain subdirectories
export const toExportPath = ({ refName }) => {
  const domain = inferDomain(refName)
  return `/${domain}/${refName}.schema.ts`
}

function inferDomain(refName: string): string {
  if (refName.startsWith('User') || refName.startsWith('Auth')) return 'identity'
  if (refName.startsWith('Order') || refName.startsWith('Cart')) return 'commerce'
  return 'shared'
}
```

This pretends to be a complete `base.ts` but isn't. The actual API
(verified in `gen-zod/src/base.ts:13-23`, etc.) requires:

```ts
export const ZodBase = toModelProjectionBase({
  id: denoJson.name,

  toIdentifier({ refName }): Identifier {
    return Identifier.createVariable(`${capitalize(refName)}Schema`)
  },

  toExportPath({ refName }): string {
    const domain = inferDomain(refName)
    return join('@', domain, `${refName}.schema.ts`)
  }
})
```

`toIdentifier` and `toExportPath` are **config fields** passed to the
factory `toModelProjectionBase({...})`. They are NOT free-standing
exports. A user replacing `gen-zod/src/base.ts` with the doc's snippet
would:

1. Lose the `toModelProjectionBase` call entirely — no `ZodBase`
   class is created.
2. Lose the `id: denoJson.name` config — the generator has no
   identifier.
3. The `ZodProjection` class at `gen-zod/src/ZodProjection.ts:20`
   (`export class ZodProjection extends ZodBase`) imports `ZodBase`
   from `./base.ts` — that import would fail since the doc's
   replacement doesn't export `ZodBase`.

The doc essentially shows pseudo-code as if it were complete source.
Same class as the projections-and-snippets misclassification (#17) —
docs treating factory-config-fields as if they were class statics or
top-level exports.

The recipe also has line 81–83 saying:

> Apply similar customizations to the form generator's import
> paths, the TypeScript generator's `interface` vs `type` choice, etc.

The `interface` vs `type` choice is glossed over similarly — it's
not a base.ts edit; it'd require rewriting `gen-typescript/src/TsObject.ts`
or similar to emit `interface { … }` instead of `type = { … }`. The
doc presents it as a casual house-style flag.

**What was expected:** Code snippet matches the actual API shape:
factory call → config object with `toIdentifier`/`toExportPath` as
properties → exports the resulting class.

**Why it matters:** This recipe is the **design-system playbook** —
the most architecturally ambitious thing a SKMTC team can do. It's
what teams reach for when scaling up. The example code at the heart
of the recipe doesn't compile against the real API. A team adopting
the design-system pattern based on this recipe:

1. Edits `gen-zod/src/base.ts` to look like the doc.
2. Runs `skmtc bundle` — the bundler reports `ZodBase is not
   defined` or `Cannot find name 'ZodBase'`.
3. Realises the doc's snippet isn't a drop-in.
4. Reverse-engineers the actual API from gen-zod's pre-edit base.ts.

The recipe's whole value proposition (shared customizations across
many APIs) presumes you can confidently edit `base.ts`. The doc
sabotages that.

**Possible fixes:**
- Rewrite the example to use the actual factory pattern:
  ```ts
  export const ZodBase = toModelProjectionBase({
    id: denoJson.name,
    toIdentifier({ refName }) { ... },
    toExportPath({ refName }) { ... }
  })
  ```
- Add a small note: "These functions are *config fields* on the
  factory, not top-level exports. See `gen-zod/src/base.ts` for the
  canonical structure."
- Drop the "TypeScript generator's `interface` vs `type` choice" claim,
  or expand it into a "how to change the emission template" sub-step
  that points at the relevant TS file in gen-typescript.
- Verification command:
  ```bash
  cat skmtc-generators/gen-zod/src/base.ts
  # Shows the actual structure: toModelProjectionBase({ ... })
  ```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/gen-zod@0.0.57`

**Status:** verified-fixed 2026-05-12 — `extending/recipes/design-system-across-many-apis.md` example rewritten to use the actual factory pattern: `export const ZodBase = toModelProjectionBase({ id: denoJson.name, toIdentifier({ refName }) { ... }, toExportPath({ refName }) { ... } })` matching `gen-zod/src/base.ts:9-23`. `toIdentifier` and `toExportPath` are now config fields on the factory call, not free-standing exports. Added an explicit "These functions are *config fields* on the factory" note plus a pointer to tutorial 02 for the surrounding files (`mod.ts`, `ZodProjection.ts`). The `interface` vs `type` claim was corrected — it's not a base-level edit but a `TsObject.ts` `toString()` rewrite; the doc now says so explicitly.

---

### 33. `add-a-field-type.md` example dispatch uses `switch (true) { case ... }` + fictional `BooleanInput`/`EmailInput` files; actual is `if`-chain with `CheckboxInput`/`StringInput` [friction]

`extending/how-to/add-a-field-type.md` lines 82–96.

**What happened:** Doc shows the schemaToField dispatch as:

```ts
// schemaToField.ts (simplified)
import { DatePickerInput } from './fields/DatePickerInput.ts'

export const schemaToField = (args) => {
  const { schema, fieldName, format } = args

  switch (true) {
    case format === 'date': return new DatePickerInput(...)
    case schema.type === 'string' && format === 'email': return new EmailInput(...)
    case schema.type === 'string': return new StringInput(...)
    case schema.type === 'boolean': return new BooleanInput(...)
    // ... your new branch
  }
}
```

The actual `gen-shadcn-form/src/schemaToField.ts` uses **chained
`if` statements** (lines 69, 81, 93, 103, 113, 128 — each `if`
returns):

```ts
if (schema.type === 'object') {
  return new ObjectInput({ ... })
}

if (schema.type === 'array') {
  return new Table({ ... })
}

// ... more if branches ...

return new StringInput({ ... })  // final fallthrough
```

No `switch (true)` pattern. Two of the doc's mentioned classes are
fictional:

- `BooleanInput` — does not exist. The boolean handler is
  `CheckboxInput` (line 114 of actual schemaToField.ts).
- `EmailInput` — does not exist. There is no email-format dispatch
  in the stock; email-format fields fall through to the generic
  `StringInput` (line 140, the final return).

So the doc's "switch with these existing cases" frame is wrong twice:
the syntax is wrong AND two of the referenced cases don't exist.

Also (compounds with #14): line 124 references
`src/generated/forms/CreateEvent.generated.tsx`, which is the
operationId-derived name. Actual is `forms/PostEventsForm.generated.tsx`
(verb-derived).

**What was expected:** Example matches the actual dispatch shape
(`if`-chain) and the actual files (`CheckboxInput`, no `EmailInput`,
falls through to `StringInput`).

**Why it matters:** A user following this how-to would:

1. Open `schemaToField.ts` after cloning.
2. Find an `if`-chain, not a `switch`.
3. Look for `BooleanInput` to mimic — find `CheckboxInput`.
4. Look for `EmailInput` — find nothing; conclude email is somehow
   special-cased elsewhere, hunt around, eventually realise email
   isn't handled separately at all.

Each mismatch costs investigation time. The doc was supposed to give
them a working template; they instead spend cycles correcting the
doc's mental model.

Same class as #31 (the recipe version of this how-to). The how-to
and the recipe both make the same mistakes about the dispatch shape —
strongly suggests they were both written without opening
`schemaToField.ts`.

**Possible fixes:**
- Rewrite the example block to use the actual `if`-chain idiom:
  ```ts
  import { DatePickerInput } from './fields/DatePickerInput.ts'

  export const schemaToField = (args) => {
    const { schema, name, format, destinationPath, context } = args

    if (schema.type === 'string' && format === 'date') {
      return new DatePickerInput({ context, destinationPath, name })
    }
    if (schema.type === 'object') { ... }
    // ... other branches ...
    return new StringInput({ ... })  // fallback
  }
  ```
- Drop the fictional `EmailInput` reference. Either replace with
  `CheckboxInput` (real) or explain that email-format falls through
  to `StringInput` in the stock.
- Replace `BooleanInput` with `CheckboxInput`.
- Update line 124 verification path to use the actual identifier name
  pattern (verb-derived). Compounds with #14, #31.
- Verification command:
  ```bash
  cat skmtc-generators/gen-shadcn-form/src/schemaToField.ts | head -50
  ls skmtc-generators/gen-shadcn-form/src/fields/
  ```

**Version anchor:** `@skmtc/gen-shadcn-form@0.0.57`

**Status:** verified-fixed 2026-05-12 — `extending/how-to/add-a-field-type.md` "Add a dispatch branch in `schemaToField`" example rewritten as the actual `if`-chain idiom (not `switch (true)`); fictional `BooleanInput`/`EmailInput` removed; replaced with `CheckboxInput` (the real boolean handler) and an explicit note that email-format fields fall through to the generic `StringInput`. The DatePicker branch placement is now correctly described as "before the more-general fallbacks". Verification path corrected from `forms/CreateEvent.generated.tsx` to `forms/PostEventsForm.generated.tsx` (verb-derived per gen-shadcn-form's `toIdentifier`).

---

### 34. `add-enrichment-options.md` "Stock gen-zod (minimal)" example doesn't match actual gen-zod `enrichments.ts` [polish]

`extending/how-to/add-enrichment-options.md` lines 27–33.

**What happened:** Doc shows:

```ts
// Stock gen-zod (minimal):
import * as v from 'valibot'
export const schema = v.optional(v.object({}))
export type EnrichmentSchema = v.InferOutput<typeof schema>
export const toEnrichmentSchema = () => schema
```

Actual `gen-zod/src/enrichments.ts` (5 lines, in full):

```ts
import * as v from "valibot";

export const toEnrichmentSchema = () => v.undefined();

export type EnrichmentSchema = undefined;
```

Differences:

1. No `schema` named export. Only `toEnrichmentSchema`.
2. Schema is `v.undefined()` (rejects any payload), not
   `v.optional(v.object({}))` (accepts any object or absence).
3. `EnrichmentSchema` is the type `undefined`, not derived from a
   Valibot schema.

The doc presents an aspirational "minimal enrichments" template
labeled as the stock gen-zod. A reader who'd think "let me see what
the minimal enrichments file looks like and copy it" by `cat`'ing the
actual gen-zod file would find code that looks different and conclude
the doc is out of date.

The more accurate "stock template" reference is
`gen-shadcn-form/src/enrichments.ts` (lines 8–34) which actually uses
the `v.optional(v.object(...))` pattern.

**What was expected:** Either:
- The "Stock gen-zod (minimal)" example is dropped (gen-zod has no
  enrichments — bad reference), or
- The example is renamed to "A minimal-but-real enrichment schema"
  and stops claiming to be from gen-zod, or
- The example points at gen-shadcn-form as the reference template.

**Why it matters:** Low severity — the rest of the how-to is
structurally accurate, and a user following the step-by-step would
still arrive at a working enrichments.ts. But the misleading "Stock"
label undermines confidence in other doc claims. Trust budget.

**Possible fixes:**
- Replace "Stock gen-zod (minimal)" with a more accurate reference,
  e.g., "Minimal example (real generators with enrichments include
  fields here)". Drop the gen-zod-specific framing.
- Or replace gen-zod with `gen-shadcn-form` as the source of the
  example — its enrichments.ts is a real, non-trivial schema:
  ```ts
  // gen-shadcn-form/src/enrichments.ts
  export const formSchema = v.optional(
    v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      submitLabel: v.optional(v.string()),
      fields: v.optional(v.array(formFieldItem))
    })
  )
  ```
- Verification command:
  ```bash
  cat skmtc-generators/gen-zod/src/enrichments.ts
  cat skmtc-generators/gen-shadcn-form/src/enrichments.ts
  ```

**Version anchor:** `@skmtc/gen-zod@0.0.57`,
`@skmtc/gen-shadcn-form@0.0.57`

---

### 35. `handle-graphql-instead-of-oas.md` recommends a class-extending-`GqlOperationProjectionBase` pattern that neither stock GraphQL generator uses [friction]

`extending/how-to/handle-graphql-instead-of-oas.md` lines 42–57.

**What happened:** The how-to teaches a class-based pattern for
authoring GraphQL generators:

```ts
import { GqlOperationProjectionBase } from '@skmtc/core'

export class MyGqlGenerator extends GqlOperationProjectionBase {
  override toString(): string {
    // ...
  }
}
```

Two problems:

1. **No stock GraphQL generator uses this pattern.** Both
   `gen-graphql-operation` and `gen-graphql-typed-document-node` are
   **functional generators** with no Projection class:
   - `gen-graphql-operation/src/` contains only `base.ts` (helper
     functions) and `mod.ts` (functional `emitOperation`).
   - `gen-graphql-typed-document-node/src/` is the same shape.

   They emit definitions directly via `context.register({ definitions })`
   and `context.insertNormalisedModel(TsProjection, ...)` — never
   instantiating a custom Projection class.

2. **`extends GqlOperationProjectionBase` is the BULK-008 anti-pattern
   the discrepancy catalog already flagged**: real Projection classes
   extend the **factory result** (`MyGeneratorBase =
   toGqlOperationProjectionBase({...})`), not the abstract
   `GqlOperationProjectionBase` directly. So if a user wanted a
   class-based GraphQL generator, the doc's `extends ...` line would
   still be wrong even after authorising the pattern.

A user following this how-to to author a new GraphQL generator would
write a class extending the abstract `GqlOperationProjectionBase`,
discover the abstract class isn't designed to be extended directly,
try to mimic gen-graphql-operation for guidance and find no class
there at all.

**What was expected:** The how-to reflects the actual GraphQL
generator patterns — functional, not class-based.

**Why it matters:** Canonical "I want to write a GraphQL generator"
how-to. The user models their code on what the doc shows. The pattern
doesn't match either stock and doesn't work as written.

The doc also still has the BULK-022 issue (incomplete `GqlOperation`
shape — missing `oasType`, `returnTypeString`, `description`,
`deprecated`, `deprecationReason` fields) at lines 63–70.

**Possible fixes:**
- Rewrite the "Extend `GqlOperationProjectionBase`" section to show
  the functional pattern that both stocks actually use:
  ```ts
  import { toGqlOperationEntry } from '@skmtc/core'

  const emitOperation = (context, operation) => {
    // emit via context.register({ definitions }) and
    // context.insertNormalisedModel(...)
  }

  export const myGqlEntry = toGqlOperationEntry({
    id: denoJson.name,
    isSupported: () => true,
    transform: ({ context, operation, acc }) => {
      emitOperation(context, operation)
      return acc
    }
  })
  ```
- OR, if a class-based pattern is genuinely desired, show the factory
  pattern (`toGqlOperationProjectionBase({...})` → class extends
  factory-result), and add a note that the two stock generators use
  the functional pattern.
- Update lines 63–70 with the full `GqlOperation` shape (cross-ref
  BULK-022).
- Verification command:
  ```bash
  ls skmtc-generators/gen-graphql-operation/src/
  ls skmtc-generators/gen-graphql-typed-document-node/src/
  # Both: no class file — purely functional
  ```

**Version anchor:** `@skmtc/gen-graphql-operation@0.0.57`,
`@skmtc/gen-graphql-typed-document-node@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Rewrote `handle-graphql-instead-of-oas.md`. Replaced the fictional `extends GqlOperationProjectionBase` class pattern with the actual functional pattern both stocks use (`emitOperation(context, operation)` free function + `transform: ({ context, operation, acc }) => { emitOperation(...); return acc }`). Removed bogus `context.insertOperation({ projection, operation })` call. Showed real emission APIs: `context.insertNormalisedModel(TsProjection, {...})` for inline schemas, `context.insertModel(TsProjection, refName)` for refs, and `context.register({ destinationPath, imports, definitions })` for direct emission. Added pointer to `toGqlOperationProjectionBase` factory pattern for the rare class-based case (cross-refs BULK-008). Updated `GqlOperation` shape to include `oasType`, `returnTypeString`, `description`, `deprecated`, `deprecationReason` and the computed `identifier` getter (closes BULK-022 for this doc).

---

### 36. `explanation/the-graphql-asymmetry.md` See-also bullet describes `toArtifacts` document input shape as `{type, document}` and `{type, sdl}`; actual is `{type, value}` for both [polish]

`explanation/the-graphql-asymmetry.md` lines 258–260.

**What happened:** "See also" bullet:

> [API: toArtifacts] — the function that accepts both
> `{ type: 'oas', document }` and `{ type: 'gql', sdl }`

The actual `SkmtcDocumentInput` (`core/run/toArtifacts.ts:60-63`):

```ts
type SkmtcDocumentInput =
  | { type: 'oas'; value: OpenAPIV3.Document<Record<string, never>> }
  | { type: 'gql'; value: string | GraphQLSchema }
```

The field name is **`value`** in both variants. Not `document`, not
`sdl`. The two variants share the same field name deliberately — the
union discriminates on `type`, but the payload is uniformly `value`.

Same fabrication as BULK-009 (already cataloged in
`discrepancy-catalog.md`). The cross-doc propagation pattern: BULK-009
covered the in-reference-doc instance; this is the in-explanation-doc
instance.

**What was expected:** The see-also bullet quotes the actual field
names.

**Why it matters:** Low severity — see-also bullet is descriptive, not
prescriptive. But it cements the wrong shape in a reader's mind. A
reader who learns from this doc that the field is `document` or `sdl`
will type that in their own integration code and get a TypeScript
error about extraneous fields.

The cluster (this entry + BULK-009 + #4 in this log via `to-artifacts.md`)
shows the same fabrication propagated across the three layers
(reference → explanation → see-also). The fixer pattern: one fix to
the canonical reference doc, then audit downstream docs that quote it.

**Possible fixes:**
- Replace the bullet: "[API: toArtifacts] — accepts a
  `SkmtcDocumentInput` union: `{ type: 'oas', value: ... }` or
  `{ type: 'gql', value: ... }`."
- Cross-reference BULK-009 for the audit-trail.
- Verification command:
  ```bash
  grep -A4 "type SkmtcDocumentInput" \
    skmtc/deno/core/run/toArtifacts.ts
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Fixed the see-also bullet in `explanation/the-graphql-asymmetry.md` (lines 258–260) to quote the actual `SkmtcDocumentInput` shape: both variants carry a `value` field, with `type` as the discriminant. Closes the cluster with BULK-009 + #4 in this log.

---

### 37. `explanation/security-model.md` "manifest as forensic record" jq recipe uses `.manifest.files`; actual stdout shape is flat `.files` [polish]

`explanation/security-model.md` lines 202–206.

**What happened:** Doc shows:

```bash
skmtc generate my-api --json > generate-output.json
jq '.manifest.files | keys' generate-output.json > expected-paths.txt
git status --porcelain | awk '{print $2}' > actual-changes.txt
diff expected-paths.txt actual-changes.txt
```

The `jq '.manifest.files | keys'` returns `null` because there's no
`.manifest` wrapper in the stdout JSON output (see #25 + #26 for the
full shape analysis). The correct recipe against `skmtc generate
--json` output is `jq '.files'` (a flat list of paths) or against the
on-disk `manifest.json` it's `jq '.files | keys'`.

So the doc's recipe — meant to be the "forensic check that generate
didn't write unexpected files" — silently produces an empty
`expected-paths.txt`. The `diff` then shows **everything** as
unexpected. A security-conscious user running this gets a false
positive on every run.

**What was expected:** Recipe produces actual file paths and the diff
flags real anomalies.

**Why it matters:** Specifically bad in a security context. The doc's
whole "manifest as forensic record" sub-section is presented as a
defense-in-depth pattern. If the verification command produces noise
instead of signal, security-conscious users either:
1. Trust the recipe, get noise, dismiss as "this check doesn't work"
2. Stop running the check entirely
3. Investigate noise and waste time on a doc bug, not a real issue

All three outcomes weaken the security posture this section is trying
to establish.

This is now the **third site** (after #25 debug, #26 update-schema)
with the same `manifest.*` confusion. Strongly indicates a
single doc-wide audit pass is warranted: every `jq '.manifest.*'`
recipe against `skmtc generate --json` output is wrong.

**Possible fixes:**
- Fix the immediate recipe — either of:
  - `jq -r '.files[]' generate-output.json > expected-paths.txt`
    (against stdout JSON)
  - `jq -r '.files | keys[]' .skmtc/my-api/.settings/manifest.json
    > expected-paths.txt` (against on-disk manifest)
- Add a "Two JSON shapes" callout somewhere central
  (`reference/manifest-format.md` is the natural place) so future
  doc-writers don't repeat the conflation.
- Audit all `jq '.manifest.*' generate-output.json` occurrences:
  ```bash
  grep -rn "jq.*\.manifest" skmtc/deno/docs/
  ```

**Version anchor:** `@skmtc/cli@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Fixed the `explanation/security-model.md` "manifest as forensic record" recipe at lines 201–206 — switched to `jq -r '.files[]'` against `--json` stdout, added a callout about the two JSON shapes with a link to `reference/manifest-format.md`. Cross-audit (`grep -rn "jq.*\.manifest\." docs/`) found one more live site: `using/how-to/skip-or-include-operations.md:102` was using `jq '.manifest.files[] | select(.result == "skipped")'` — fixed to query the on-disk manifest's `results` tree (`.results[][].generate | to_entries[] | ...`) with cross-ref to `manifest-format.md#results` and a callout on `skipped` vs `notSupported`. The only remaining `jq.*\.manifest\.` matches are inside this friction-log file itself (cataloged as already-fixed instances and reference text), not live docs.

---

### 38. `explanation/how-idempotency-works.md` `ZodProjection` example has three concurrent fabrications: wrong base class, wrong toIdentifier args, wrong export path [friction]

`explanation/how-idempotency-works.md` lines 47–57.

**What happened:** Doc shows:

```ts
class ZodProjection extends ModelProjectionBase {
  static toIdentifier({ schema, refName }): Identifier {
    return Identifier.createVariable(decapitalize(refName))
  }

  static toExportPath({ schema, refName }): string {
    return `/models/${refName}.generated.ts`
  }
}
```

Three fabrications in 8 lines:

1. **`extends ModelProjectionBase`** — actual gen-zod
   `ZodProjection.ts:20` extends `ZodBase`, the factory result from
   `toModelProjectionBase({...})`. The abstract `ModelProjectionBase`
   isn't designed for direct extension. (Compounds with BULK-008,
   #35.)
2. **`toIdentifier({ schema, refName })`** — actual signature
   (`toModelProjectionBase.ts` config type) is just `{ refName,
   enrichments }`. No `schema` argument is passed to `toIdentifier`.
3. **`return '/models/${refName}.generated.ts'`** — actual gen-zod
   path is `@/types/<decapitalize(camelCase(refName))>.generated.ts`
   (`gen-zod/src/base.ts:19-23`). Three wrong things here:
   - Parent dir `models/` is the fabricated default; actual is
     `types/`.
   - Leading `/` makes it look like an absolute path; actual uses
     `@/...` alias.
   - No `decapitalize(camelCase(...))` step — case wrong for refNames
     like `User-Profile`.

The "look how clean the invariant is" payoff of the doc hangs on a
code example that violates the invariant in three ways simultaneously.

**What was expected:** Snippet quotes actual gen-zod base.ts (which is
short enough to quote verbatim — 12 lines).

**Why it matters:** This is the **load-bearing explanation doc** for
the system's coordination story. Line 38 even calls out: "These two
together make order irrelevant. The system *can't* allow order to
matter." The doc is making a precise architectural argument — but
illustrating it with a code example that doesn't compile against the
real API.

A reader trying to understand idempotency by reading the example,
then opening `gen-zod/src/base.ts` to verify, would find a completely
different shape (factory call, not class definition) and three
different details. They'd conclude either the doc is wrong, the code
has drifted, or they're missing something — none of which are good
outcomes.

Same class as #32 (design-system recipe) — explanation docs treating
factory-config-fields as if they were class statics on a directly-
extended abstract base.

**Possible fixes:**
- Quote the actual `gen-zod/src/base.ts` verbatim (12 lines fits
  inline):
  ```ts
  export const ZodBase = toModelProjectionBase({
    id: denoJson.name,
    toIdentifier({ refName }): Identifier {
      const name = decapitalize(camelCase(refName));
      return Identifier.createVariable(name);
    },
    toExportPath({ refName, enrichments }): string {
      const { name } = this.toIdentifier({ refName, enrichments });
      return join("@", "types", `${decapitalize(name)}.generated.ts`);
    },
  });
  ```
- Remove the `class ZodProjection extends ModelProjectionBase` framing
  — `ZodProjection` is a separate file that extends the factory
  result; the doc's example conflates the two.
- Verification command:
  ```bash
  cat skmtc-generators/gen-zod/src/base.ts
  ```

**Version anchor:** `@skmtc/gen-zod@0.0.57`, `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Replaced the load-bearing example in `explanation/how-idempotency-works.md` ("Identifier and exportPath are pure functions" section, lines 47–57) with the actual `gen-zod/src/base.ts` verbatim (factory call to `toModelProjectionBase({...})`, real `toIdentifier`/`toExportPath` signatures with the `decapitalize(camelCase(...))` step and the `@/types/<name>.generated.ts` path via `join('@', 'types', ...)`). Added a follow-on paragraph clarifying that `ZodProjection` is a separate file that extends `ZodBase` (the factory result) — fixing the conflation flagged in the friction-log entry. Removed the bogus `extends ModelProjectionBase` framing, the `{ schema, refName }` arg pair on `toIdentifier`, and the `/models/...` path. Cross-refs BULK-008 + #32 (same factory-vs-abstract class confusion in design-system recipe).

---

### 39. `skills/skmtc-generator/SKILL.md` Projection scaffold's `toString()` emits `export const ...`, which the Driver also wraps — producing duplicate `export const` [blocker]

`skills/skmtc-generator/SKILL.md` lines 293–296.

**What happened:** The Projection scaffold's `toString()` example is:

```ts
override toString(): string {
  // ⬇ Pure function of `this`. No mutation. Compose via ${...}.
  return `export const ${this.settings.identifier.name} = someHelper<${this.tsRequestBodyName}>(...)`
}
```

Drivers automatically wrap a Projection's `toString()` output in a
`Definition`, which produces the `export const NAME = VALUE;`
statement. The Projection's `toString()` is supposed to return only
the VALUE — the wrapping is automatic.

Verified against the actual stock generators:

```ts
// gen-shadcn-form/src/ShadcnForm.ts
override toString(): string {
  const { title, description, submitLabel } = this.settings.enrichments ?? {}
  return `(${this.parameter}) => { ... }`     // ← just the arrow function value
}

// gen-tanstack-query-fetch-zod/src/TanstackQuery.ts
override toString(): string {
  return this.client.toString()                // ← just the value
}
```

Neither prefixes its return with `export const`. The Driver wraps
each Projection in `export const ${identifier.name} = ${toString()};`
during File-level serialization.

A user copying the skill's scaffold verbatim would emit, in their
generated file:

```ts
export const PostFooForm = export const PostFooForm = someHelper<...>(...)
//                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ duplicate; TypeScript syntax error
```

The result is `SyntaxError` at typecheck. Or worse, depending on
exact wrapping, may produce un-bound expressions.

**What was expected:** The scaffold returns only the VALUE — matches
what `gen-shadcn-form`, `gen-tanstack-query-*`, etc., actually do.

**Why it matters:** This is the **canonical "how do I write a
Projection?" scaffold** that every agent authoring a SKMTC generator
reads. Copy-pasting it produces broken output every time. Because the
skill is loaded into every AI-assisted SKMTC session, this bug
specifically affects AI-assisted generator authoring — the
fastest-growing use case.

Worse: the bug compounds with the doc's own correct-but-undocumented
truth. Line 86–88 says:

> `Definition` extends `SnippetBase` — it's the wrapper that makes a
> Projection's value exportable. Drivers create `Definition`s
> automatically.

So the skill **states the invariant correctly in prose** ("Drivers
create `Definition`s automatically") but then **violates the invariant
in its own scaffold** by manually writing `export const`. A
sufficiently careful reader catches the inconsistency; a less-careful
reader (or an LLM extracting the scaffold pattern) ships broken code.

Highest-leverage bug logged in this session — every future AI-authored
SKMTC generator inherits it until fixed.

**Possible fixes:**
- Rewrite the scaffold's `toString()` to return just the value:
  ```ts
  override toString(): string {
    return `someHelper<${this.tsRequestBodyName}>(...)`
  }
  ```
- Add an explicit callout right above the scaffold: "**Do NOT prefix
  the return with `export const`.** The Driver wraps your value in
  `export const ${identifier.name} = ${yourValue};` during File
  serialization. Writing `export const` yourself produces duplicate
  output."
- Cross-check the other scaffolds (Snippet, the various variants) for
  the same mistake.
- Verification command:
  ```bash
  grep -A3 "override toString" \
    skmtc-generators/gen-shadcn-form/src/ShadcnForm.ts \
    skmtc-generators/gen-tanstack-query-fetch-zod/src/TanstackQuery.ts \
    skmtc-generators/gen-msw/src/MockRoute.ts
  # None of these return `export const` — the Driver does the wrapping
  ```

**Version anchor:** `@skmtc/core@0.4.2`, stock generators
`@skmtc/gen-*@0.0.57`

**Status:** verified-fixed 2026-05-12 — Fixed the Projection scaffold's `toString()` in `docs/skills/skmtc-generator/SKILL.md` (lines 293–296) to return only the VALUE: `return \`someHelper<${this.tsRequestBodyName}>(...)\``. Added an explicit comment block right above the return explaining that the Driver wraps the value as `export const ${identifier.name} = ${toString()};` during File serialisation, and that writing `export const` yourself produces the duplicate `export const Foo = export const Foo = ...` TypeScript syntax error. Audited the Snippet scaffold (lines 405–407) — already correctly returns just the JSX value. The "Emitting strings outside toString()" anti-pattern section (line 441) intentionally retains its name as it describes a wrong pattern; the corrected scaffold is now consistent with the prose claim on lines 86–88 ("Drivers create Definitions automatically").

---

### 40. `reference/manifest-format.md` is correct in isolation, but missing the "two JSON shapes" callout that would prevent the entire #25/#26/#37 downstream cluster [polish]

`reference/manifest-format.md` — gap, not a bug.

**What happened:** The doc accurately describes the **on-disk
manifest** at `.skmtc/<project>/.settings/manifest.json`:

- Top-level shape matches `ManifestContent` type ✓
- `parseIssues` correctly required (not optional) ✓
- `results` recursive nested tree correctly explained ✓
- No mention of fabricated `.manifest.diagnostics` ✓
- No mention of fabricated `.manifest.files[].result` ✓

This doc is the **canonical source** for manifest shape. But it
documents *one* of the two JSON shapes that exist in SKMTC. The other
— `skmtc generate --json` stdout — is **structurally different**:

| | On-disk `manifest.json` | `skmtc generate --json` stdout |
|---|---|---|
| Root shape | `ManifestContent` directly | `{ kind: 'generated', projectName, basePath, manifestPath, stats, files, errors, parseIssues, ... }` |
| File list | `manifest.files` (Record<path, ManifestEntry>) | `files` (string[] of paths at top level) |
| Parse issues | `manifest.parseIssues` | `parseIssues` (top-level) |
| Per-op results | `manifest.results` (recursive tree) | **Not included** in stdout JSON |
| Source | `core/types/Manifest.ts` | `cli/lib/print-generate-result.ts:42-59` |

The downstream cluster (#25, #26, #37) all stem from readers
**conflating these two shapes**. They read this doc, learn the
`manifest.*` shape, then write `jq '.manifest.diagnostics …'` against
the stdout JSON — and get null.

The bug isn't in this doc. The bug is that this doc doesn't **warn**
about the conflation. A single "Two JSON shapes" callout near the top
would defuse the entire downstream cluster.

**What was expected:** The canonical doc explicitly distinguishes the
two shapes so doc-writers (and agents) know which is which.

**Why it matters:** Highest leverage fix available in the docs. One
edit here prevents many downstream sites from drifting. The existing
downstream confusion (3+ documented sites in this friction log, plus
likely more we haven't probed) is direct evidence of the gap.

The fix isn't "add a separate manifest doc for the stdout shape" —
it's "make this doc warn that its content describes one of two
shapes, and link to where the other is documented."

**Possible fixes:**
- Add a callout at the top of `manifest-format.md`:
  > **There are two JSON shapes in SKMTC:** the **on-disk manifest**
  > at `.skmtc/<project>/.settings/manifest.json` (this document) and
  > the **`skmtc generate --json` stdout output** (documented in
  > [`reference/cli/generate.md`](cli/generate.md#json-output)). They
  > overlap but are NOT identical. Recipes assuming the manifest
  > shape against stdout output will silently produce `null`.
- Make `reference/cli/generate.md` reciprocate with its own callout
  pointing back here.
- Cross-reference both from the skill docs and how-tos that use jq
  recipes.
- Verification (after fix): rerun the audit:
  ```bash
  grep -rn "jq.*\.manifest" skmtc/deno/docs/
  # Each remaining match should be unambiguous about which shape it
  # operates on.
  ```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Added a "Two JSON shapes" callout block-quote near the top of `reference/manifest-format.md` (just after the introductory paragraph) explaining that this doc describes the on-disk `manifest.json` shape only — the `skmtc generate --json` stdout output is structurally different (flat `files` string array, no `results` tree) and pointing to `reference/cli/generate.md#json-output` for the other shape. Added a reciprocal callout at the top of the "JSON output" section in `reference/cli/generate.md`. Together they form the single high-leverage fix the entry called for: doc-writers (and agents) reading either doc are now warned about the conflation before they write a `jq` recipe.

---

### 41. `reference/cli/generate.md` `errors` field semantics wrong — claims `[destinationPath, identifier]` pairs; actual is full results-tree paths [friction]

`reference/cli/generate.md` lines 159 and 188.

**What happened:** Doc shows in the JSON output example:

```jsonc
"errors": [["models.ts", "Product"]],    // [destinationPath, identifier] pairs
```

And in the field reference:

> **`errors`**: `[destinationPath, identifier]` pairs for items
> whose `results` entry came back `'error'`.

The actual `errors` field is built by `checkResult` in
`cli/lib/generationStats.ts:362-381`. It recursively walks
`manifest.results` (which is a deeply nested tree keyed by trace →
span → `"generate"` → generator-id → identifier), and pushes the
**full path** through that tree whenever it hits an `'error'` leaf:

```ts
// generationStats.ts:377-378
Object.entries(result).forEach(([key, value]) => {
  checkResult({ path: [...path, key], result: value, errors })
})
// generationStats.ts:370-371
if (result === 'error') {
  errors.push(path)
}
```

So a real error entry looks like:

```jsonc
[
  ["trace-1778185255674", "span-1778185255674", "generate",
   "@skmtc/gen-zod", "BrokenModel"]
]
```

Not `["models.ts", "Product"]`. The actual semantics:

| Doc claims | Actual |
|---|---|
| Tuple `[destinationPath, identifier]` | Variable-length path through the `results` tree |
| 2 elements per entry | Typically 5 elements (trace, span, "generate", generator-id, identifier) |
| First element is a file path | First element is a trace ID |
| Identifier-related | Tree-path-related; no relationship to `manifest.files` |

The doc's framing leads a user to expect they can map `errors[i][0]`
to a file in `manifest.files`. That mapping doesn't exist — to find
the file an `error` corresponds to, they'd need to find which
generator output the identifier at `errors[i][last]` maps to (via the
generator's `toExportPath`).

**What was expected:** The doc accurately describes the actual
`string[][]` shape and what each path-element means.

**Why it matters:** Anyone writing CI tooling or debug recipes against
`errors` based on this doc will write broken code. Common downstream
intent: "for each error, open the corresponding file and check what
went wrong." The doc-provided shape makes this look like a simple
`fs.readFileSync(errors[0][0])` operation; the actual shape requires
walking the manifest and resolving the identifier.

The error-display docstring in `generationStats.ts` shows the
canonical usage:
```ts
errors.forEach((errorPath, index) => {
  console.warn(`  ${index + 1}. ${errorPath.join(' -> ')}`);
});
```
— treating each entry as a *path*, joined with `->`.

This finding also retro-corrects the `skmtc-cli` SKILL §8 generate
example (line 310 of that skill) which shows the same wrong shape:
`"errors": [["models.ts", "Product"]]`. The skill inherits the same
fabrication.

**Possible fixes:**
- Rewrite line 159 example with a real path:
  ```jsonc
  "errors": [
    ["trace-1778185255674", "span-1778185255674", "generate",
     "@skmtc/gen-zod", "BrokenModel"]
  ],
  // Each entry is a path through `manifest.results` ending at an
  // 'error' leaf.
  ```
- Rewrite line 188 field reference:
  > **`errors`**: An array of paths through `manifest.results`. Each
  > path is `[traceId, spanId, "generate", generatorId, identifier]`
  > (or deeper, for nested aggregator results) terminating at a leaf
  > whose result value is `'error'`. The generator that emitted the
  > error is the second-to-last element; the failing identifier is
  > the last.
- Apply same correction to `skills/skmtc-cli/SKILL.md` §8.
- Verification command:
  ```bash
  grep -A20 "checkResult\|toManifestErrors" \
    skmtc/deno/cli/lib/generationStats.ts | head -40
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Fixed the `errors` field in `reference/cli/generate.md` on both sites: (1) JSON example at line 159 now shows a realistic path `["trace-...", "span-...", "generate", "@skmtc/gen-zod", "BrokenModel"]` with an inline comment explaining the shape; (2) field-reference bullet rewritten to call out that `errors[i][0]` is **not** a file path — each entry is a path through `manifest.results` with the generator-id at position −2 and the failing identifier at position −1, and the file lookup requires resolving the identifier through the generator's `toExportPath`. Applied the same correction to `skills/skmtc-cli/SKILL.md:310` so the agent-loaded reference matches. The fix matches `checkResult` in `cli/lib/generationStats.ts:362–384` which builds the paths by recursive descent through the nested `results` tree.

---

### 42. `llms.md` inherits two already-cataloged fabrications (stale RenderContext.collate line + `toEnrichmentSchema` as a static) [polish]

`llms.md` lines 165 and 194.

**What happened:** Otherwise the most carefully-verified doc in the
repo, with many specific code citations that check out. Two
exceptions:

**Line 165** — stale line citation:
> | **Render** | `RenderContext.collate` (`core/context/RenderContext.ts:185`) | …

Actual: `RenderContext.collate` is at line **176**, not 185. Same
stale citation as #15 (where I flagged it in
`concepts/the-three-phases.md` at line 225). The fabrication
propagated from one doc to another.

**Line 194** — wrong static-methods list:
> Static methods required: `id`, `toIdentifier`, `toExportPath`,
> `toEnrichments`, `toEnrichmentSchema`

Same wrong list as #17 (`concepts/projections-and-snippets.md`) and
the skmtc-generator SKILL line 78. `toEnrichmentSchema` is a config
option passed to the factory, not a class static. The actual statics
are `id, type, toIdentifier, toExportPath, isSupported,
toEnrichments`.

**Other verified-correct citations in `llms.md` (this section):**
- `ParseContext.parse:221` ✓
- `GenerateContext.toArtifacts:275` ✓
- `OasOperationProjectionBase.insertOperation:68-79` ✓
- `GenerateContext.insertOperation:722-746` ✓
- `cli/lib/generate-worker.ts:75` (net: false) ✓
- `cli/lib/generate-worker.ts:101` (worker.terminate) ✓
- `toSchemasV3.ts:113` (oneOf length-1 sibling discard) ✓

So this doc is overwhelmingly accurate; the two findings above are
the only fabrications encountered.

**What was expected:** `RenderContext.collate` cited at line 176; the
static-methods list omits `toEnrichmentSchema` and adds `id`, `type`,
`isSupported`.

**Why it matters:** Low severity individually, but **structurally
revealing**: both bugs are propagated from upstream docs (or to
upstream docs). The `toEnrichmentSchema` fabrication now appears in
three places (`projections-and-snippets.md`, skmtc-generator SKILL,
llms.md) — a single source must have been copied. Same with the
`:185` line citation (two docs).

This is a cross-doc-cluster pattern: when fixing one, audit the
cluster.

**Possible fixes:**
- Fix `llms.md` line 165: `RenderContext.ts:185` → `:176`.
- Fix `llms.md` line 194: replace static-methods list with `id, type,
  toIdentifier, toExportPath, toEnrichments, isSupported`. Drop
  `toEnrichmentSchema`.
- After fixing, grep for the same fabrications across docs:
  ```bash
  grep -rn "RenderContext\.ts:185" skmtc/deno/docs/
  grep -rn "toEnrichmentSchema" skmtc/deno/docs/ | grep -i "static"
  ```
- Cross-reference #15, #17, skmtc-generator SKILL §2 for the audit
  trail.

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Fixed both fabrications in `llms.md`: line 165 now cites `RenderContext.collate` at `RenderContext.ts:176` (verified by grep — the line is `collate(stackTrail: StackTrail): FilesRenderResult` at line 176, not 185); line 194's Projection statics list updated to `id, type, toIdentifier, toExportPath, isSupported, toEnrichments` (dropping the fabricated `toEnrichmentSchema` static and adding the missing `type` and `isSupported`). Closes the cross-doc cluster with #15 (three-phases.md), #17 (projections-and-snippets.md), and the skmtc-generator SKILL line 78 — all previously fixed in earlier rounds.

---

### 43. `reference/cli/install.md` claims install writes default per-generator settings into `client.json`; actual install only touches `deno.json#imports` [friction]

`reference/cli/install.md` lines 60–65.

**What happened:** Doc says:

> **Default settings written**
>
> The CLI also writes default per-generator settings into
> `client.json` if the generator declares any (via its enrichment
> schema). For most generators, no per-install settings are needed —
> enrichments are added on-demand by the user later.

The actual `install` flow (verified):

1. `cli/commands/install.tsx` → `installHeadless`
2. `cli/lib/install-headless.ts:46` → `project.installGenerator({ moduleName })`
3. `cli/lib/project.ts` `installGenerator` → `generator.install({ denoJson })`
4. `cli/lib/generator.ts` `install` (full method body):
   ```ts
   install({ denoJson }: InstallArgs) {
     denoJson.addImport(this.toModuleName(), this.toFullName())
   }
   ```

That's the whole thing — one call to add an import to `deno.json`.
No `client.json` write, no enrichment-schema inspection, no
"defaults". The doc's "Default settings written" subsection
describes behaviour that doesn't exist.

**What was expected:** The doc accurately describes that install
only updates `deno.json#imports` (and the lockfile via Deno's
auto-update).

**Why it matters:** Two specific user-impacting outcomes:

1. **Wrong mental model on first install.** A user reading the doc
   expects to see new entries appear under
   `client.json#settings.enrichments` after install. They check the
   file, see nothing changed, think the install was incomplete.

2. **Wrong inference about the enrichment lifecycle.** The doc
   suggests there's a "declare enrichments → install writes defaults
   → user edits defaults" workflow. The actual workflow is "user
   reads `gen-x/src/enrichments.ts` to learn the shape → user types
   keys into `client.json` from scratch." Anyone modeling tooling on
   the doc's claim (e.g., an MCP server, an editor extension, a
   generator-discovery UI) would build infrastructure that doesn't
   match real CLI behavior.

The doc-writer may have **confused install with init**:
`project.create` (the `init` path) DOES write `client.json` (at
`project.ts:114-117` with the `basePath` from the init args). But
even there it doesn't write per-generator defaults — just the
top-level `basePath`. So no part of the install/init flow writes
per-generator enrichment defaults.

**Possible fixes:**
- Remove the "Default settings written" subsection entirely. Install
  only updates `deno.json#imports` + lockfile.
- If the intent was to document the per-init default of `basePath`,
  put that in `init.md` instead, not here.
- Add a positive statement: "Install does NOT modify `client.json`.
  Enrichments are user-added on-demand by reading the generator's
  `src/enrichments.ts` schema."
- Verification command:
  ```bash
  grep -A3 "^  install\b" skmtc/deno/cli/lib/generator.ts
  # Confirms install() is a 1-line method touching only deno.json
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Rewrote the "Default settings written" section in `reference/cli/install.md` (lines 60–65) as "`client.json` is not modified" — pointing users at the actual 2-line `install({ denoJson })` method in `cli/lib/generator.ts:96–98` (`denoJson.addImport(...)` only), and directing them to read the generator's `src/enrichments.ts` to learn the enrichment shape, then type keys into `client.json` themselves. Added a cross-link to `using/how-to/configure-enrichments.md`. The wrong mental-model of a "declare → install writes defaults → user edits" workflow is now corrected.

---

### 44. `reference/cli/doctor.md` lists 12 check IDs; only 6 exist in source. Half the docu-checks are fabricated [blocker]

`reference/cli/doctor.md` lines 41–62.

**What happened:** Doc claims doctor runs these checks:

**Workspace-level:**
- `workspace-deno-json`
- `workspace-client-json`
- `cli-core-pin`
- `node-runtime`

**Per-project:**
- `project-deno-json/<project>`
- `project-client-json/<project>`
- `project-core-pin/<project>`
- `project-schema-fetch/<project>`
- `project-bundle/<project>`
- `project-bundle-fresh/<project>`
- `project-installs/<project>`
- `project-generators-loadable/<project>`

Twelve check IDs total.

Actual check IDs in `cli/lib/doctor-headless.ts` (every `id:` literal):

```
shim-lockfile
project-core-pin/<project>
project-deno-json/<project>
project-base-path/<project>
project-bundle/<project>
project-manifest/<project>
```

**Six total. Nine of the doc-claimed checks don't exist:**

| Doc claims | Reality |
|---|---|
| `workspace-deno-json` | ❌ doesn't exist |
| `workspace-client-json` | ❌ doesn't exist |
| `cli-core-pin` | ❌ `shim-lockfile` exists (different scope: checks the CLI's shim lockfile) |
| `node-runtime` | ❌ doesn't exist |
| `project-client-json/<project>` | ❌ doesn't exist |
| `project-schema-fetch/<project>` | ❌ doesn't exist |
| `project-bundle-fresh/<project>` | ❌ `project-bundle/<project>` exists and includes freshness |
| `project-installs/<project>` | ❌ doesn't exist |
| `project-generators-loadable/<project>` | ❌ doesn't exist |
| `project-deno-json/<project>` | ✓ |
| `project-core-pin/<project>` | ✓ |
| `project-bundle/<project>` | ✓ |

Reality has TWO actual checks the doc omits:
- `project-base-path/<project>` — validates basePath is set and relative
- `project-manifest/<project>` — checks `manifest.json` matches current `@skmtc/core` schema

So the doc lists 9 fabricated check IDs and misses 2 real ones, of a
total real surface of 6 IDs.

The fabrication propagates through the **JSON example output**
(lines 98–126) — `shim-lockfile` shows up (real), but
`project-bundle-fresh/my-api` is fabricated. Same with the
`Common failure modes` section (lines 208–252): three of the four
worked-examples reference fabricated check IDs:
- `workspace-deno-json` — fabricated
- `project-core-pin` — real ✓
- `project-schema-fetch` — fabricated
- `project-bundle-fresh` — fabricated

**What was expected:** Doc lists exactly the 6 check IDs that exist
in `doctor-headless.ts` and omits the fabrications.

**Why it matters:** Highest-severity finding in this round. Doctor's
whole value proposition is "tell me what's wrong via structured
check IDs." Users write tooling against these IDs:

```bash
# Common agent / CI pattern, after reading the doc:
skmtc doctor --json | jq '.checks[] | select(.id == "project-schema-fetch/my-api")'
# Returns null — that check doesn't exist
```

The fabrication is doubly damaging because:
1. Users assume their tooling broke. Wasted debug cycles.
2. Users may write logic that branches on a non-existent ID and never
   triggers — silent miss of real failures.

The doc was likely written from an aspirational design ("here's what
doctor *should* check") rather than from the implementation.

Documents what was previously cataloged as DISC-006 / DISC-007 / BULK-023
in the discrepancy catalog, but with the full real-vs-claimed table.
The earlier catalog entries flagged exit-code-3 fabrication and the
status-value list; this entry covers the full check-ID surface
fabrication.

**Possible fixes:**
- Replace the two tables at lines 41–62 with the actual 6 check IDs:
  ```
  | shim-lockfile                  | CLI shim's deno.lock pins @skmtc/cli + @skmtc/core to compatible versions |
  | project-deno-json/<project>    | Project's deno.json exists and parses |
  | project-base-path/<project>    | client.json#settings.basePath is set and relative |
  | project-core-pin/<project>     | Project's @skmtc/core import pin matches the CLI's |
  | project-bundle/<project>       | If project has clones, bundle.js exists and is fresh; otherwise ok-noop |
  | project-manifest/<project>     | manifest.json schema matches the current @skmtc/core |
  ```
- Update the JSON example to use only real IDs.
- Rewrite the "Common failure modes" section using only real
  check IDs.
- Mark earlier DISC-006 + DISC-007 in the catalog as superseded by
  this entry.
- Verification command:
  ```bash
  grep -oE "id:\s*\`?'[a-z-]+(/\\\$\{[^}]+\}|)" \
    skmtc/deno/cli/lib/doctor-headless.ts | \
    sort -u
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Rewrote `reference/cli/doctor.md` with the actual 6 check IDs verified via `grep -oE "id:\\s*[\`'][^\`']+[\`']" cli/lib/doctor-headless.ts | sort -u`. Workspace-level: just `shim-lockfile` (CLI shim's `~/.deno/bin/.skmtc/deno.lock`). Per-project: `project-deno-json/<project>`, `project-base-path/<project>` (rel-vs-abs, with `error` on absolute), `project-core-pin/<project>`, `project-bundle/<project>` (only when `hasLocalGenerator` — pure JSR projects return ok-noop), `project-manifest/<project>` (manifest schema-match). Dropped the 9 fabricated IDs (`workspace-deno-json`, `workspace-client-json`, `cli-core-pin`, `node-runtime`, `project-client-json`, `project-schema-fetch`, `project-bundle-fresh`, `project-installs`, `project-generators-loadable`). Rewrote the human-readable example, the JSON example, and the "Common failure modes" section to use only the 6 real IDs with messages and hints quoted from the actual `Check` return values in `cli/lib/doctor-headless.ts`. Updated the See also bullet about `project-bundle-fresh` (now `project-bundle/<project>`) and `project-client-json` (now `project-base-path` reading `settings.basePath`). Closes the fabrication cluster flagged in DISC-006 / DISC-007 / BULK-023 with the full real-vs-claimed coverage.

---

### 45. `reference/cli/init.md` claims `init` writes a `deno.json` with pre-pinned `@skmtc/core` and `@skmtc/worker`; actual init writes an empty `deno.json` [friction]

`reference/cli/init.md` lines 63–76.

**What happened:** Doc says:

> **`deno.json`** — minimal manifest with the core peer-dep pin:
>
> ```json
> {
>   "imports": {
>     "@skmtc/core": "jsr:@skmtc/core@^<current>",
>     "@skmtc/worker": "jsr:@skmtc/worker@^<current>"
>   }
> }
> ```
>
> The pinned versions match the CLI's own versions, so subsequent
> `install` and `clone` operations have compatible peers from the
> start.

The actual `RootDenoJson.create` (`cli/lib/root-deno-json.ts`):

```ts
static create(projectName: string) {
  return new RootDenoJson({ projectName, contents: {} })
}
```

Empty contents `{}`. No `imports` block, no `@skmtc/core` pin, no
`@skmtc/worker` pin. Peer pins accrete later as `install`/`clone`
operations discover their needs.

So after `skmtc init my-api ./src`, the actual contents of
`.skmtc/my-api/deno.json` are:

```json
{}
```

Not what the doc shows.

**What was expected:** The doc reflects the actual contents — an
empty object — and notes that peer deps accrete via subsequent
operations.

**Why it matters:** Two compounding effects:

1. **User-side surprise.** A user who runs `init`, then opens
   `deno.json` to see what was generated, finds an empty file. They
   may think `init` partially failed. They may try to manually add
   what they think the doc said should be there.

2. **The `project-core-pin/<project>` doctor check.** This check
   compares the project's `@skmtc/core` pin against the CLI's. With
   the doc's claim, the pin should exist right after init. With the
   actual empty `deno.json`, the pin doesn't exist until the first
   `install` or `clone` adds it. Running `doctor` immediately after
   `init` would surface a "core pin missing" check failure —
   confusing for a fresh project.

The fabrication may stem from confusion with a *desired* design
(init pre-pins peer deps) rather than the actual lazy-accretion
behavior.

**Possible fixes:**
- Replace the `deno.json` example with the actual empty object `{}`,
  and add a note: "Peer dependencies (`@skmtc/core`, `@skmtc/worker`,
  etc.) are added incrementally by subsequent `install` and `clone`
  operations — not at `init` time."
- OR change the implementation so `init` does pre-pin core+worker
  (likely a small change in `RootDenoJson.create`, and arguably more
  useful behavior than the current empty state). Then docs match.
- Verification command:
  ```bash
  grep -A2 "^  static create" \
    skmtc/deno/cli/lib/root-deno-json.ts
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Rewrote the `deno.json` section in `reference/cli/init.md` (lines 63–76) with the actual empty `{}` contents that `RootDenoJson.create(projectName)` in `cli/lib/root-deno-json.ts:38–40` produces. Added explicit prose explaining that peer deps (`@skmtc/core`, `@skmtc/worker`, `@skmtc/gen-*`) accrete lazily via `install` and `clone`, not at `init` time. Added a heads-up that `skmtc doctor` immediately after `init` will report `project-core-pin/<project>` as missing — a fresh-project signal, not a real failure (closes the doctor-confusion concern flagged in the entry). Chose the doc-fix path over the implementation-pre-pin path because the lazy-accretion behaviour is the source of truth for both stock and remote project flows.

---

### 46. `reference/cli/create.md` shows `@local/<name>` as the deno.json import key; actual key uses the user's auth scope (`@<username>/<name>`) or `jsr-user/<name>` fallback [friction]

`reference/cli/create.md` lines 116–120.

**What happened:** Doc says:

> The project's `.skmtc/<project>/deno.json#imports` gets a new entry
> pointing at the local source:
>
> ```json
> {
>   "imports": {
>     "@local/my-zod-schema": "./my-zod-schema/mod.ts"
>   }
> }
> ```

The actual `addGenerator` flow (`cli/lib/project.ts`):

```ts
async addGenerator({ moduleName, type, username }: AddGeneratorArgs) {
  const { scopeName, packageName, version } = parseModuleName(moduleName)

  const generator = Generator.fromName({
    projectName: this.name,
    scopeName: scopeName ?? (username ? `@${username}` : undefined) ?? 'jsr-user',
    packageName,
    version: version ?? '0.0.1'
  })
  generator.add({ project: this, generatorType: type })
}
```

For a bare `my-zod-schema` argument (no explicit scope), the
resulting `scopeName` falls back through:

1. Explicit scope from the user input (e.g., `@myorg/my-zod-schema`
   → `@myorg`)
2. The authed user's username, prefixed with `@` (e.g., `@dgrabov`)
3. The literal string `jsr-user` (last-resort fallback)

So the actual import key for `skmtc create my-project my-zod-schema model`
(run by user `dgrabov`) is **`@dgrabov/my-zod-schema`**, not
`@local/my-zod-schema`. Unauthed users get `jsr-user/my-zod-schema`.
`@local/` is **never** used by the implementation.

This is the same `@local/` fabrication as #24 (compose-with-another-generator.md),
but in a different context — here, for new scaffolds rather than
imports between cloned generators.

The doc also doesn't mention the auth-dependency: the resulting
import key depends on whether the user is logged in. A team that
follows the doc and pins their generator scope to `@local/...` in
shared code (config, scripts, CI) will discover their tooling breaks
when run by a different team member with a different username, or in
a fresh CI without auth.

**What was expected:** The doc accurately describes the auth-derived
scope mechanism. Either show real example values (`@<your-username>/...`)
or document the fallback chain explicitly.

**Why it matters:** Several user-visible problems:

1. The doc's `@local/my-zod-schema` import key doesn't appear in
   any real `deno.json` produced by `create`. A user inspecting the
   scaffold sees a different key, may think the scaffold ran
   incorrectly.
2. CI-side scripts that reference the import key (e.g., a build
   step that imports generated tooling) will reference different
   keys depending on who runs the CLI. Not portable.
3. The tutorial-level `@local/` convention (#24, in tutorials 02
   and 03) consistently uses `@local/` as the id prefix — which is
   different from the *import key* but easily confused with it.
   Cross-doc consistency makes the fabrication look more
   authoritative than it is.

**Possible fixes:**
- Replace the example with something that mirrors the auth-derived
  reality:
  ```jsonc
  // Run by user `dgrabov`:
  {
    "imports": {
      "@dgrabov/my-zod-schema": "./my-zod-schema/mod.ts"
    }
  }
  ```
- Add a sub-section "Scope and auth": explain the fallback chain
  (`@<username>` if authed; `jsr-user` otherwise) and what it means
  for portability.
- If `@local/` is the desired convention, add it as a default in the
  fallback chain (between username and `jsr-user`). Then the doc
  matches.
- Verification command:
  ```bash
  grep -B1 -A6 "addGenerator\b" \
    skmtc/deno/cli/lib/project.ts | head -15
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Rewrote the "`deno.json` imports updated" section in `reference/cli/create.md` (lines 111–125). Replaced the `@local/my-zod-schema` example with the real `@<username>/my-zod-schema` shape (annotated with `// Example: run by an authenticated user dgrabov` so readers see *why* the scope is variable). Documented the explicit fallback chain straight from `Project.addGenerator` in `cli/lib/project.ts:340–349`: explicit scope → authed `@<username>` → `jsr-user` literal. Removed the bogus "or defaults to `@local/`" line; `@local/` is never used. Added a portability warning so teams don't pin shared scripts to a per-developer scope, with the advice to pass an explicit scope to `create` when stability is needed. Cross-refs with #24 (`@local/` fabrication in `compose-with-another-generator.md`).

---

### 47. `reference/cli/list.md` JSON output is fictional — actual is a flat `{ projectName, generators: string[] }`, no source classification, version, or counts [blocker]

`reference/cli/list.md` lines 78–106, 120–133.

**What happened:** Doc shows the JSON output as:

```jsonc
{
  "command": "list",
  "projectName": "my-api",
  "generators": [
    { "name": "@skmtc/gen-zod", "source": "jsr", "version": "^0.0.55" },
    { "name": "@skmtc/gen-typescript", "source": "jsr", "version": "^0.0.42" },
    { "name": "@local/my-form", "source": "local", "path": "./my-form/mod.ts" }
  ],
  "counts": { "jsr": 2, "clone": 0, "local": 1, "total": 3 }
}
```

And the human-readable output as a 3-column table.

The actual `ListHeadlessResult` (`cli/lib/list-headless.ts:20-34`):

```ts
export type ListHeadlessResult = {
  projectName: string
  generators: string[]   // ← flat array of import keys
}
```

And `printListResult` (`cli/commands/list.tsx:91-116`) just emits
the bare result for JSON, and a simple bulleted list for text.

So the **actual JSON output** for `skmtc list my-api --json` is:

```jsonc
{
  "projectName": "my-api",
  "generators": [
    "@skmtc/gen-zod",
    "@skmtc/gen-typescript",
    "@local/my-form"
  ]
}
```

No `command: "list"` field. No `source` classification. No `version`.
No `path`. No `counts`. Just a flat array of strings.

The actual **text output**:
```
Generators in my-api:
  - @skmtc/gen-zod
  - @skmtc/gen-typescript
  - @local/my-form
```

A bulleted list, not a table.

The doc fabricated:
- The `command: "list"` envelope field
- The three-way `'jsr' | 'clone' | 'local'` classification
- The `version` field (would require parsing the import specifier)
- The `path` field for locals
- The `counts` summary
- The tabular text output
- The "Sources listed" three-tier classification logic (lines 56–74)

This is the most comprehensive single-doc fabrication in the
reference section — most of the doc's output spec is invented.

**What was expected:** Doc reflects the actual flat-array shape and
acknowledges that source classification is **not** computed by `list`.

**Why it matters:** Highest-impact category. `list` is the
**verification command** — its sole purpose is to let users and agents
confirm what's installed. Common downstream patterns:

```bash
# Pattern from the doc:
skmtc list my-api --json | jq '.generators[] | select(.source == "clone") | .name'
# Actually: every entry is a string, `.source` is undefined; returns nothing.

# Or:
skmtc list my-api --json | jq '.counts.total'
# Returns null; no `counts` field.
```

Agents writing CI scripts, MCP servers, or editor extensions against
this doc will produce code that always returns empty results.
Particularly insidious because the actual output has the field they
look for (`generators`), so they don't notice it returned `null`
versus a real empty result.

To get source classification from outside the CLI, the caller must
inspect each entry in the project's `deno.json#imports` and apply
`jsr:` vs path heuristics themselves. The doc presents this as a
CLI-provided feature; it isn't. The `agent-context --json` output
DOES split generators into `remote` and `local` arrays — but `list`
doesn't reuse that split.

**Possible fixes:**
- Rewrite the JSON output section to match the actual shape:
  ```jsonc
  {
    "projectName": "my-api",
    "generators": ["@skmtc/gen-zod", "@skmtc/gen-typescript",
                   "@local/my-form"]
  }
  ```
- Rewrite the human-readable output section to show the actual
  bulleted list.
- Remove the "Sources listed" section (lines 54–74) — that
  classification logic doesn't exist in `list`. If users want
  classification, point them at `agent-context --json`
  (`.projects[].generators.{remote,local}`).
- Update the examples (lines 144–149) — the `.source == "clone"` jq
  recipe must be removed or replaced with one that works.
- OR enrich the actual `list` output to match the doc — the
  classification work is trivially implementable from
  `deno.json#imports`. Then docs match.
- Verification command:
  ```bash
  grep -A4 "export type ListHeadlessResult" \
    skmtc/deno/cli/lib/list-headless.ts
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Rewrote `reference/cli/list.md` end-to-end to match the actual `ListHeadlessResult` shape (`{ projectName: string, generators: string[] }`) from `cli/lib/list-headless.ts:20–23` and the `printListResult` text output (`Generators in <project>:` heading + `  - <key>` bulleted lines, or `  (none)`) from `cli/commands/list.tsx:91–116`. Dropped all fabricated material: `command` envelope, per-entry `{ name, source, version, path }` records, `counts` summary, three-way `jsr | clone | local` classification, tabular text output, "Sources listed" section. Added an upfront note that `list` does not classify by source and pointed users at `agent-context --json` (`.projects[].generators.{remote,local}`) when they need that view. Rewrote the programmatic-consumption example to use `jq -r '.generators[]'` (works against the real shape) and added a follow-on recipe that derives source from `deno.json` directly via `startswith("jsr:")`. Updated See also and intro accordingly.

---

### 48. `reference/cli/remove.md` JSON output entirely fictional — actual is `{ projectName, removed: string }`, no source/directoryDeleted/bundle fields [blocker]

`reference/cli/remove.md` lines 108–150.

**What happened:** Doc shows the JSON output with `command`,
`source`, `directoryDeleted`, `bundle`, and `verifyWith` fields. The
actual `RemoveHeadlessResult` (`cli/lib/remove-headless.ts:15-18`):

```ts
export type RemoveHeadlessResult = {
  projectName: string
  removed: string
}
```

That's it. The actual JSON output for
`skmtc remove my-api @skmtc/gen-zod --json` is:

```jsonc
{
  "projectName": "my-api",
  "removed": "@skmtc/gen-zod"
}
```

The doc fabricated:
- `command: "remove"` envelope (doesn't exist)
- `generator` field name (actual is `removed`)
- `source: 'jsr' | 'clone' | 'local'` classification (doesn't exist)
- `directoryDeleted` path (doesn't exist)
- `bundle.kind` reporting (doesn't exist; `removeHeadless` doesn't
  call any bundle step)
- `verifyWith` field (doesn't exist)

Plus, line 26 of `remove-headless.ts` hardcodes `jsr:` prefix on the
module name regardless of source type:

```ts
const moduleName = generator.startsWith('jsr:') ? generator : `jsr:${generator}`
```

Removing a `@local/...` clone would prepend `jsr:` to it
(`jsr:@local/...`). Possibly a bug for non-JSR removals — needs
follow-up.

**What was expected:** Doc reflects the actual flat `{ projectName,
removed }` shape and removes claims about source classification,
directory-delete reporting, and bundle reporting.

**Why it matters:** Same severity as #47. `remove` is the cleanup
command — agents and CI scripts need to verify the removal succeeded.
They'll write:

```bash
skmtc remove my-api @local/my-form --json | jq '.directoryDeleted'
# Returns null — no such field.
```

Worse: the **rebundle claim** at lines 85–93 — "If the project still
has other clones or local generators after the removal, the CLI
rebundles" — appears to be **also fabricated**. `removeHeadless`
doesn't invoke any bundle step. Users following the doc may believe
`remove` rebundles for them when it doesn't, then run `generate` and
hit a stale-bundle error.

Combined with #47, **two consecutive CLI reference docs** have
entirely fictional JSON output specs. Pattern suggests a single
doc-writer pass through the simpler CLI commands without reading the
implementations.

**Possible fixes:**
- Rewrite the JSON output section to match the actual `{ projectName,
  removed }` shape.
- Verify whether `project.removeGenerator` rebundles or not, and
  document accurately. If not (likely), either add rebundle to the
  implementation or remove the doc claim.
- Drop source-classification, directoryDeleted, verifyWith claims, OR
  implement them.
- Verify the `jsr:`-prefix hardcode at remove-headless.ts:26 for
  `@local/...` removals — is it a bug?
- Verification command:
  ```bash
  grep -A4 "RemoveHeadlessResult" \
    skmtc/deno/cli/lib/remove-headless.ts
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Rewrote `reference/cli/remove.md` to match the real `RemoveHeadlessResult` shape (`{ projectName, removed }`) from `cli/lib/remove-headless.ts:15–18`. Dropped all fabricated material: `command` envelope, `generator` field name (actual is `removed`), `source` classification, `directoryDeleted`, `bundle` block, `verifyWith` hint, the rebundle behaviour section, the Bundle compile failure block, the lockfile-pruning claim. Replaced "Rebundle behavior" with "`remove` does not rebundle" — the actual `remove`→`removeGenerator`→`RootDenoJson.removeGenerator` chain (`cli/lib/generator.ts:255–261` and `root-deno-json.ts:77–96`) only deletes the local directory (when local) and strips the import; bundle and lockfile updates are deferred to the next `bundle`/`generate`. Updated the "Bundle compile failure after removal" failure-mode to "Stale bundle after removal" reflecting the deferred-rebundle model, and updated the local-remove example and See-also to match. The `jsr:`-prefix hardcode at `remove-headless.ts:26` is not a bug — `parseModuleName` strips it downstream — left a note in the verification of #48 rather than touching the code. Closes the CLI-reference fabrication pair with #47.

---

### 49. `reference/api/projection-bases.md` conflates "factory config" with "class statics" and inverts which fields are required vs optional [friction]

`reference/api/projection-bases.md` lines 42–55.

**What happened:** Doc heading says "**Required static methods on
the class**" and lists:

```ts
{
  id: string
  toIdentifier(args): Identifier
  toExportPath(args): string
  toEnrichments?(args): EnrichmentSchema
  toEnrichmentSchema(): ValibotSchema
  isSupported?(args): boolean
}
```

Two structural problems:

1. **The heading is wrong** — these are *factory config fields*, not
   statics on the class. The factory consumes them and produces a
   class with statics. The class statics are different.

2. **Required/optional markers are swapped** for two fields. The
   actual factory config type (`toOasOperationProjectionBase.ts:15-30`):

   ```ts
   {
     id: string
     toIdentifier: (args) => Identifier              // required
     toExportPath: (args) => string                  // required
     toEnrichmentSchema?: () => v.BaseSchema<...>    // optional
     isSupported?: (args) => boolean                 // optional
   }
   ```

   - **`toEnrichments` is NOT a config field.** It's a static
     produced by the factory.
   - **`toEnrichmentSchema` IS optional** (`?`), not required.

Actual statics on the resulting class:

| Static | Source |
|---|---|
| `id` | config.id |
| `type` | factory-hardcoded discriminator |
| `toIdentifier` | config.toIdentifier |
| `toExportPath` | config.toExportPath |
| `isSupported` | config.isSupported ?? `() => true` |
| `toEnrichments` | factory-built from `toEnrichmentSchema` |

The `type` static is **missing from the doc entirely**.

Same `toEnrichmentSchema`-as-static fabrication appears in #17
(concepts/projections-and-snippets.md), #42 (llms.md), and the
skmtc-generator SKILL §2 — now in a fourth location. This is the
canonical reference doc, so this is likely the source the downstream
sites propagated from.

**What was expected:** Clean separation between (a) factory config
and (b) class statics. Required/optional markers match the type.

**Why it matters:** Concrete failure modes for generator authors:

1. **Pass `toEnrichments` to the factory.** Accepted but ignored.
   Author thinks they've overridden resolution; nothing changed.
2. **Add a no-op `toEnrichmentSchema` to silence a TS error that
   isn't there.** Pollutes generator code.
3. **Call `Class.toEnrichmentSchema()`** — TS reports it doesn't
   exist; author wastes time searching.
4. **Miss the `type` discriminator** — writes less precise dispatch
   code.

**Possible fixes:**
- Restructure into TWO sub-sections: "Factory config object" vs
  "Class statics produced by the factory".
- Fix required/optional markers.
- Cross-ref the four-site cluster (#17, #42, this entry, skmtc-generator
  SKILL §2).
- Verification:
  ```bash
  grep -B2 -A12 "^type.*Config\|toEnrichmentSchema?" \
    skmtc/deno/core/dsl/operation/oas/toOasOperationProjectionBase.ts
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Split the "Common shape" section in `reference/api/projection-bases.md` (lines 42–63) into two sub-sections: **"Factory config object"** and **"Class statics produced by the factory"**. Factory config now matches the source type `OasOperationProjectionBaseConfig` (`toOasOperationProjectionBase.ts:18–30`) with correct required/optional markers — `id`/`toIdentifier`/`toExportPath` required; `toEnrichmentSchema?` and `isSupported?` optional. `toEnrichments` is no longer listed as a config field (it's not one). Class statics table added with all six (`id`, `type`, `toIdentifier`, `toExportPath`, `isSupported`, `toEnrichments`) and the source mapping from `toOasOperationProjectionBase.ts:48–66`. The previously-missing `type` discriminator is now documented with its dispatcher-routing role. Closes the four-site cluster (#17 projections-and-snippets.md, #42 llms.md, this entry, plus skmtc-generator SKILL §2 already fixed earlier).

---

### 50. `reference/api/dsl-identifier.md` is internally inconsistent — mixes pre-refactor `isType` boolean shape with post-refactor `EntityTypeValue` literal across the same doc [friction]

`reference/api/dsl-identifier.md` lines 3, 173, 186–200, 290–298.

**What happened:** The doc explicitly acknowledges a refactor:

> Lines 78–79: "recent refactor (`isType` boolean → `EntityTypeValue`
> literal) made..."
>
> Lines 245–248: "This is the load-bearing reason for the recent
> refactor from a boolean `isType` flag to the `EntityTypeValue`
> literal."

And in the field-definition block, documents the new shape correctly:

> Line 25: `entityType: EntityTypeValue           // 'variable' | 'type'`
> Line 50: `type EntityTypeValue = 'variable' | 'type'`

But **other parts of the same doc still show the pre-refactor
shape**:

| Site | Doc shows (stale) | Should be |
|---|---|---|
| Line 3 | `'const' vs 'type'` | `'variable' vs 'type'` |
| Line 173 | `'const' or 'type'` | `'variable' or 'type'` |
| Line 188 | `// → { name: 'UserBody', isType: true }` | `{ name: 'UserBody', type: 'type' }` |
| Line 199–200 | `For 'const' identifiers, returns just the name as a plain string (equivalent to { name, isType: false })` | `For 'variable' identifiers, returns just the name as a plain string` (no `isType` shape) |
| Line 293 | `{ name: 'userBody', isType: false }` | bare string `'userBody'` |
| Line 294 | `{ name: 'UserBody', isType: true }` | `{ name: 'UserBody', type: 'type' }` |

Verified against actual `Identifier.toImport()` (`core/dsl/Identifier.ts`):

```ts
toImport({ alias }: { alias?: string } = {}): ImportNameArg {
  const isType = this.entityType.type === 'type'
  if (isType) {
    return alias
      ? { name: this.name, alias, type: 'type' }
      : { name: this.name, type: 'type' }
  }
  return alias
    ? { name: this.name, alias, type: 'variable' }
    : this.name
}
```

The actual discriminator on the object form is **`type`** (a literal
`'type' | 'variable'`), not **`isType`** (boolean). Plus, the common
case — a plain variable import without alias — returns a **bare
string**, not an object.

So the doc:
- Uses pre-refactor `'const'` in some places, `'variable'` in
  others.
- Uses pre-refactor `isType: bool` in examples even though it names
  the refactor that removed it.

This is the previously cataloged BULK-013 + BULK-020 — both still
open in this doc.

**What was expected:** All examples and tables use the post-refactor
shape consistently. No `isType: bool` anywhere in current examples;
no `'const'` as a discriminator value (only as the rendered keyword
when describing output).

**Why it matters:** Canonical reference for the Identifier API.
Generator authors writing `toImport()` calls or working with
`ImportNameArg` pattern-match against examples. Concrete failure
modes:

1. **Author writes `{ name: 'X', isType: true }` from line 188's
   example.** TypeScript rejects — `ImportNameArg` doesn't accept
   `isType`. Author searches for what changed.
2. **Author writes `{ name: 'X' }` (no discriminator) expecting
   default-variable.** Actually rejected by valibot — the object
   form requires `type`.
3. **Author writes tooling (lint, test fixtures) using `isType` as
   the field name.** Silently passes TypeScript but does nothing at
   runtime.

The doc's self-acknowledgement of the refactor (lines 78–79, 245–248)
makes the inconsistency more confusing — reader sees "refactor
happened" but then sees pre-refactor examples and isn't sure which
to trust.

**Possible fixes:**
- Sweep every example and table; replace `isType: bool` with
  `type: 'variable' | 'type'`.
- Replace `'const'` with `'variable'` everywhere it's used as a
  discriminator (keep `'const'` where it describes the rendered
  output keyword).
- Update line 199–200 to describe the actual variable-import return
  (bare string, not an object).
- Sweep `dsl-import.md` for the same pattern (next probe).
- Verification command:
  ```bash
  grep -n "isType\|'const'" \
    skmtc/deno/docs/reference/api/dsl-identifier.md \
    skmtc/deno/docs/reference/api/dsl-import.md
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Swept `reference/api/dsl-identifier.md` for pre-refactor stragglers. Line 3 (front-matter blurb) now reads `'variable'` vs `'type'`. Class block (line 25) and `EntityTypeValue` definition (line 50) corrected from `'const'` to `'variable'`, with a clarifying note that the *discriminator value* is `'variable'` but the *rendered declaration keyword* is `const`. The `toImport()` example at lines 180–195 now returns `{ name: 'UserBody', type: 'type' }` (not `isType: true`), with the prose updated to acknowledge that variable identifiers return the bare name string (not an object with `isType: false`). Two `createVariable` examples (lines 92, 95) and the direct-constructor example (line 132) all switched from `entityType: 'const'` to `entityType: 'variable'`. Mixed-import example (lines 287–289) uses `{ name: 'UserBody', type: 'type' }` and bare string. Related-types block at the bottom updated: `EntityTypeValue = 'variable' \| 'type'` and `ImportNameArg` now has `type: EntityTypeValue` (no `isType?: boolean`), with a clarifying paragraph about when the bare string vs object form applies. The three remaining `isType` mentions (lines 75, 244, 247) are intentional — they describe the past refactor's "before" state in explanatory prose, which is accurate. Closes BULK-013 + BULK-020 within this doc. Sweep of `dsl-import.md` handled in #51.

---

### 51. `reference/api/dsl-import.md` — `ImportNameArg` type definition is wrong; uses pre-refactor `isType: boolean` instead of post-refactor `type: EntityTypeValue` [blocker]

`reference/api/dsl-import.md` lines 55–62, 124, 191, 201, 232, 256, 326–329.

**What happened:** Doc defines the `ImportNameArg` type explicitly at
two locations:

Line 59–62 (in main body):
```ts
type ImportNameArg = string | {
  name: string
  alias?: string
  isType?: boolean
}
```

Line 326–329 ("Related types" section):
```ts
type ImportNameArg = string | {
  name: string
  alias?: string
  isType?: boolean
}
```

Both are **wrong**. The actual `ImportNameArg`
(`core/dsl/Import.ts:267-269`):

```ts
export type ImportNameArg =
  | string
  | { [name: string]: string }
  | { name: string; alias?: string; type?: EntityTypeValue }
```

Three differences:
1. The actual discriminator is **`type`** (literal `'variable' |
   'type'`), not **`isType`** (boolean).
2. The actual type has **three variants**, not two. The middle
   variant `{ [name: string]: string }` (a name→alias map) is
   missing from the doc.
3. The actual `type` field is `EntityTypeValue`, not `boolean`.

All `ImportNameArg`-shaped examples in the doc use the wrong shape:
- Line 124: `{ name: 'UseMutationResult', isType: true }`
- Line 201: `// → { name: 'UserBody', isType: true }`
- Line 232: `{ name: 'UseMutationResult', isType: true }`
- Line 256: `// { name: 'UserBody', isType: true }`

And the prose at line 191 explicitly describes the field by its old
name: "`isType` flag on `ImportNameArg`".

This is **more severe than #50** (dsl-identifier.md) because:
- #50's primary doc has the *type definition* right but examples
  wrong — readers can compare and recover.
- This doc has both **type definition and examples wrong**, so the
  doc is internally consistent in the wrong shape. A reader who
  trusts the type def has no signal that it's wrong.

Same cluster as BULK-020 + #50. The most extensive single instance.

**What was expected:** Type definition matches the actual code at
`Import.ts:267-269`. All examples updated to `type: 'variable' |
'type'`.

**Why it matters:** Identical to #50's concerns, amplified by the
wrong type definition:

1. Authors writing custom `register({ imports: { mod: [...] } })`
   calls pattern-match the doc's type definition. They use
   `isType: true`. Valibot validation throws or TypeScript rejects.
2. The `{ [name: string]: string }` name-aliasing variant is
   completely undocumented — users don't know they can write
   `{ 'origName': 'aliasName' }` for compact aliasing.
3. Any tooling generated from the doc's type def (e.g., JSON schemas,
   API clients in other languages, MCP wrappers) inherits the wrong
   shape.

**Possible fixes:**
- Replace BOTH type-definition blocks (lines 59–62, 326–329) with the
  actual 3-variant union from `Import.ts:267-269`.
- Replace every `isType:` in examples with `type: 'type'` or `type:
  'variable'`.
- Document the missing `{ [name: string]: string }` variant — what
  it's for, when to use it vs the object form.
- Verification command:
  ```bash
  grep -A4 "^export type ImportNameArg" \
    skmtc/deno/core/dsl/Import.ts
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Rewrote `reference/api/dsl-import.md` to match `core/dsl/Import.ts:267-270` exactly. Both type-definition blocks (in main body and in Related types) replaced with the actual 3-variant union: `string | { [name: string]: string } | { name: string; alias?: string; type?: EntityTypeValue }`. Added the previously-undocumented middle variant (the name→alias compact form) with explanation of when to use it vs the full object form. All `isType: true` example occurrences (in Step 1 register call, in Mixed-value+type Import example, in mixed-imports register example) replaced with `type: 'type'`. Prose around dedup ("Two calls registering the same name + same isType" etc.) and the `EntityTypeValue` driver paragraph rewritten in terms of the `type` field. Common-questions §2 ("Type vs value flag") relabelled as "Type vs value discriminator". Final grep for `isType` in the file returns nothing — all stragglers cleared. Closes the most extensive single instance of the BULK-013/BULK-020 cluster.

---

### 52. EntityType class-vs-literal confusion: docs claim `Identifier.entityType: EntityTypeValue` (literal) but actual is `EntityType` (class wrapping the literal). Comparison examples wouldn't compile. [friction]

`reference/api/dsl-identifier.md` line 25, `reference/api/dsl-definition.md` lines 70–71, `reference/api/content-settings.md` line 65.

**What happened:** Multiple docs describe `Identifier.entityType` as
if it's a string literal:

`dsl-identifier.md` line 25:
```ts
entityType: EntityTypeValue           // 'variable' | 'type'
```

`dsl-definition.md` lines 70–71:
> - `entityType === 'const'` → `export const <name> = <value>;`
> - `entityType === 'type'` → `export type <Name> = <value>;`

`content-settings.md` line 65:
> See [API: Identifier] for the entity-type semantics
> (`'const'` vs `'type'`) and factory methods.

The actual `Identifier` class (`core/dsl/Identifier.ts:13`):

```ts
entityType: EntityType   // ← a class instance, not the literal
```

And `EntityType` is a class wrapping the literal
(`core/dsl/EntityType.ts:61-80`):

```ts
export type EntityTypeValue = 'variable' | 'type'

export class EntityType {
  type: EntityTypeValue
  constructor(type: EntityTypeValue) {
    this.type = type
  }
}
```

So the actual discriminator-check is:

```ts
identifier.entityType.type === 'variable'   // ← go through .type
```

NOT:

```ts
identifier.entityType === 'variable'   // ← compares object to string; always false
identifier.entityType === 'const'      // ← same problem PLUS wrong value
```

Reading `dsl-definition.md`'s line 70 literally, a user would write:

```ts
if (definition.identifier.entityType === 'const') {
  // never reached — entityType is an EntityType instance, not a string
}
```

Two stacked refactor-incomplete-rollouts:
- The literal value confusion (`'const'` vs `'variable'` — BULK-013 /
  #50 cluster).
- The shape confusion (`entityType: EntityType` not `entityType:
  EntityTypeValue`).

**What was expected:** Docs describe the actual class shape and
examples use `.entityType.type` for comparison.

**Why it matters:** Two failure modes:

1. **Author copies `entityType === '...'` pattern from the docs.**
   TypeScript should reject. If the wrong type leaks to a published
   `.d.ts`, the comparison silently always returns false.
2. **Author models `entityType` as a literal.** When they construct
   an Identifier manually, they pass `entityType: 'variable'` to the
   constructor. TypeScript rejects.

This finding is the **third tier** of the same refactor cluster:

| Tier | What it covers | Entries |
|---|---|---|
| Tier 1: literal value | `'variable'` vs `'const'` | BULK-013, #50 |
| Tier 2: import-arg shape | `type:` field vs `isType:` boolean | BULK-020, #50, #51 |
| Tier 3: this entry | `entityType` is a class, not a literal | #52 |

All three would be fixed by a single doc-sweep that pulls the actual
`Identifier`, `EntityType`, and `ImportNameArg` definitions from
source and rewrites every example consistently.

**Possible fixes:**
- Audit every doc occurrence of `entityType` and check it's accessed
  as `.entityType.type`, not bare `entityType`.
- Fix the type annotation on `dsl-identifier.md` line 25:
  `entityType: EntityType` (not `EntityTypeValue`).
- Replace `'const'` with `'variable'` everywhere the discriminator
  value is shown.
- Replace `entityType === 'X'` examples with `entityType.type === 'X'`.
- Consider whether `EntityType` should just be a literal union
  instead of a class — the class wrapper adds no useful behavior,
  and docs keep drifting on this assumption.
- Verification command:
  ```bash
  grep -B2 -A4 "class EntityType\|entityType:" \
    skmtc/deno/core/dsl/EntityType.ts \
    skmtc/deno/core/dsl/Identifier.ts | head -30
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Fixed all three sites of the class-vs-literal confusion. `reference/api/dsl-identifier.md`: class block (line 25) and direct-constructor signature (line 35) now show `entityType: EntityType` (the class, not the literal); the constructor itself is documented as private with a note that `createVariable`/`createType` are the only public construction path. The "EntityType" section was rewritten to show both `EntityTypeValue` (the literal) and the `EntityType` class wrapping it, with three explicit comparison examples — two correct (`identifier.entityType.type === 'variable'`, `=== 'type'`) and one wrong (`identifier.entityType === 'variable'` always false). `entityType:` examples in `createVariable`/`createType` blocks switched to `entityType.type === 'variable'`/`=== 'type'`. The Properties section heading (line 188) changed from `entityType: EntityTypeValue` to `entityType: EntityType`, with prose clarifying the wrapped-literal access pattern. `reference/api/dsl-definition.md`: the "declaration shape" bullets at lines 70–71 now use `entityType.type === 'variable'` / `=== 'type'` and a follow-on paragraph notes that `EntityType.toString()` maps the discriminator to the rendered TS keyword (which is why `Definition.toString()` can interpolate `${this.identifier.entityType}` directly). `reference/api/content-settings.md` line 66: `'const'` vs `'type'` replaced with `'variable'` vs `'type'` plus the rendered-keyword clarification. Three-tier cluster (BULK-013 literal value, BULK-020 import-arg shape, this entry's class-vs-literal) is closed in the three reference docs that anchor it; downstream docs may still have stragglers (separate audits).

---

### 53. **META: Behavioral aspirations cluster — cases where multiple independent docs claim features the code doesn't have. Recommendation: change the code, not the docs.** [meta]

Cross-cuts: #4, #14, #24, #27, #28, #29, #43, #44, #45, #46, #47,
#48, BULK-026.

**What happened:** Through 52 prior entries, a pattern emerged: some
fabrications appear in 3+ independent doc sites. The parsimonious
explanation isn't "many doc writers made the same mistake"; it's
**"the engine surface is missing what doc writers (and the AI agents
that read those docs) intuitively expect."**

When 5+ docs independently describe an API that doesn't exist,
something is wrong — either the docs are systematically lying, or
the docs encode a coherent user-experience design that hasn't been
shipped yet. The latter explanation is more often correct.

This meta-entry surveys the cluster. Engineering should treat each
item as a feature-request signal, not a documentation-correction
target.

### The cluster, ranked by multiplicity

| # | Aspiration | Doc sites | Severity if shipped | Difficulty |
|---|---|---|---|---|
| A | `toRoutesList(deps)` accepts a deps object for stateful mocks | 5+ (gen-msw.md, full-stack-typescript-app.md, api-mocks-for-frontend.md ×2, skmtc-cli SKILL via the cluster) | High — "stateful mocks" is the marquee MSW use case | Low — `MockRoutesList.toString()` change |
| B | `agent-context --json` returns rich per-project state | 3+ (agent-context.md, pin-schema-source.md, update-a-schema.md) | High — agents drive on this output | Medium — needs design of which fields to surface |
| C | `skmtc list` returns source classification + counts | 1 doc, but high traffic (list.md) | Medium — common verification surface | Low — compute from deno.json#imports |
| D | `skmtc remove` reports source/directoryDeleted + auto-rebundles | 1 doc, high impact (remove.md) | Medium — affects CI cleanup flows | Medium — needs bundle integration |
| E | `doctor` includes schema-fetch, generators-loadable, bundle-fresh, installs checks | 1 doc (doctor.md), but with 4 fabricated checks | High — diagnostic completeness | Medium — each check requires impl |
| F | `skmtc install` writes per-generator defaults to client.json | 1 doc (install.md) | Low–medium — debatable feature | Low–medium |
| G | `skmtc init` pre-pins `@skmtc/core` and `@skmtc/worker` | 1 doc (init.md) | Medium — prevents doctor-flag immediately after init | Low — one-line change |

Plus one **non-aspirational** fabrication that should be walked back
(not coded in):

| # | Fabrication | Doc sites | Why walk back |
|---|---|---|---|
| H | `@local/` as an import-key namespace for cloned/created generators | compose-with-another-generator.md (#24), create.md (#46) | The implementation uses `@<username>/` from auth, or `jsr-user/` fallback. `@local/` would be a new convention; no rationale for adding it given the auth-derived scope already works. The tutorial-level `@local/<id>` *generator-id* usage is fine — that's just a string the user types, not infrastructure. |

### Per-aspiration detail

#### A. `toRoutesList(deps)` for stateful MSW mocks

**What docs claim** (5+ sites consistently):

```ts
const worker = setupWorker(...toRoutesList({ store: mockStore }))
```

The argument is described variously as a "deps object", "mock data
store", "dependency injection point for stateful mocks."

**What the code does** (`gen-msw/src/MockRoutesList.ts:23`):

```ts
override toString(): string {
  return `() => ${this.list}`
}
```

Nullary `() => [...]` factory. The deps argument has no runtime effect.

**Why this should be code-not-doc**: Stateful mocks are the canonical
"why use MSW in dev" pitch. Every guide reaches for it. A user
adopting SKMTC for mock-driven frontend development encounters
this expectation immediately. Multiple doc writers landed on the
same API intuition independently because it's the natural shape.

**Implementation sketch**:

```ts
// gen-msw/src/MockRoutesList.ts
override toString(): string {
  return `(deps) => ${this.list}`   // single-line change at minimum
}
```

Plus update the per-route generator to accept deps:

```ts
// gen-msw/src/MockRoute.ts
override toString(): string {
  return `http.${method}('${path}', (req, res, ctx) => {
    // deps available in closure
    return res(ctx.json(deps.${storeName}.get(req.params.id)))
  })`
}
```

Generator authors customizing the deps shape can clone and edit —
the customization seam is straightforward.

#### B. agent-context rich shape

**What docs claim** (3+ sites):

```jsonc
{
  "workspace": { "root", "denoVersion", "cliVersion", "corePin" },
  "projects": [{
    "name", "schema": { "url", "lastFetched" },
    "generators": [{ "name", "source", "version" }],
    "bundle": { "present", "path", "mtime" },
    "lastGenerate": { "timestamp", "durationMs", "artifactCount", "diagnostics" },
    "settings": { "basePath", "enrichmentsConfigured", "skipCount", "excludeCount" }
  }],
  "anomalies": [{ "kind", "project", "detail" }]
}
```

**What the code does**:

```jsonc
{
  "cliVersion", "skmtcRootPath", "globalStateDir", "jsrUrl",
  "projects": [{ "name", "basePath", "schemaSource", "generators": { "remote": [], "local": [] } }],
  "commands": [...]
}
```

**Why this should be code-not-doc**: `agent-context` is meant to be
the agent's primary state surface. The doc'd shape provides
operational context (last-run metadata, fetch recency, bundle state)
that an agent needs to make good decisions. The current shape is just
"what's installed" — useful but thin.

**Implementation sketch**: Extend `ProjectSnapshot` with optional
metadata read from `manifest.json` + bundle.js stat:

```ts
export type ProjectSnapshot = {
  name: string
  basePath: string | null
  schemaSource: string | null
  generators: { remote: string[]; local: string[] }
  bundle?: { path: string; mtime: number }       // ← new
  lastGenerate?: { endAt: number; fileCount: number; errorCount: number }  // ← new (from manifest)
}
```

The data already exists on disk (manifest.json, bundle.js stat) — this
is wiring, not new computation.

#### C. `skmtc list` source classification + counts

**What docs claim** (list.md):

```jsonc
{
  "generators": [
    { "name": "@skmtc/gen-zod", "source": "jsr", "version": "^0.0.55" },
    { "name": "@local/my-form", "source": "local", "path": "./my-form/mod.ts" }
  ],
  "counts": { "jsr": 2, "clone": 0, "local": 1, "total": 3 }
}
```

**What the code does**: flat array of strings `generators: string[]`.

**Why this should be code-not-doc**: Source classification is the
single most-asked question after install. Currently users have to
read `deno.json#imports` and apply heuristics themselves. The agent-
context surface already DOES this classification (splits into
`remote`/`local`); `list` should reuse the same logic.

**Implementation sketch**: Reuse the `readGenerators` function
already in `agent-context-headless.ts`. Trivial.

#### D. `skmtc remove` rebundle + reporting

**What docs claim** (remove.md): the command rebundles after removal,
reports `directoryDeleted`, `source` classification, and `bundle.kind`.

**What the code does**: just removes the import + (if local) deletes
the directory. No rebundle. Returns `{ projectName, removed }`.

**Why this should be code-not-doc**: Without auto-rebundle, the next
`generate` hits a stale-bundle error. The doc's claim that remove
auto-rebundles is the more user-friendly behavior; the actual behavior
forces users into a manual `bundle` step they may not realize they
need.

**Implementation sketch**: Mirror what `install`/`clone` do after the
state mutation — call `bundleHeadless` if hybrid, no-op if remote-only.

#### E. Additional doctor checks

**What docs claim**: 9 fabricated check IDs (#44). Of these, three
are clearly useful:
- `project-schema-fetch/<project>` — is the schema URL reachable?
- `project-generators-loadable/<project>` — does each generator's
  Entry actually import without throwing?
- `project-bundle-fresh/<project>` — is `bundle.js` newer than the
  source files it depends on?

**Why this should be code-not-doc**: Doctor's value is proportional
to its coverage. Each fabricated check is a "we should be diagnosing
this" signal. The current 6-check set leaves real failure modes
unsurfaced.

**Implementation sketch**: Each new check is a separate function in
`doctor-headless.ts` returning a `Check` record. The infrastructure
already exists.

#### F + G. Smaller items

- **`install` writes client.json defaults**: arguably useful for
  discoverability ("here are the enrichment fields this generator
  accepts; edit them"); debatable whether worth the noise. Lower
  priority.
- **`init` pre-pins `@skmtc/core` + `@skmtc/worker`**: one-line
  change in `RootDenoJson.create`. Fixes the "doctor reports
  core-pin missing immediately after init" UX bug. Worth doing.

### Why this matters as a meta-finding

When the **same fabrication appears across multiple doc writers, in
docs reviewed by different humans, with no shared source**, the
fabrication isn't random — it's a coherent intuition about what the
system should do. Walking the docs back loses that signal. Reading
the cluster as a feature backlog preserves it.

Per the user's framing: "the losing trade is sloppy docs that
customers have to check for us." But the deeper losing trade may
be: walking docs back to match a thinner-than-expected implementation
loses the *design intent* the doc-writers were collectively
converging on.

**Concrete recommendation**: Triage each item (A–G) as a feature
request. Implement the high-multiplicity / low-difficulty items
(A, C, G) first. Defer (F). Walk back (H) — it's the only one that's
just doc overreach.

**Possible next steps** (engineering, not docs):
- File feature requests for A–G in whatever tracker is canonical
- Cross-reference each request to the doc-friction-log entry
  (so the implementation PR can close out the doc fabrications too)
- After implementation, the parallel doc-fix work becomes
  "verified-fixed" rather than "rewrite to match thinner reality"
- For (H), edit the two affected docs (#24, #46) to remove `@local/`
  as an import-key claim — keep it only as a tutorial-level id
  convention

**Verification approach**: re-run the audits that surfaced each item
after implementation:
```bash
# A: toRoutesList signature
grep -A3 "override toString" skmtc-generators/gen-msw/src/MockRoutesList.ts
# B: agent-context shape
grep -A10 "export type ProjectSnapshot" skmtc/deno/cli/lib/agent-context-headless.ts
# C: list output shape
grep -A4 "export type ListHeadlessResult" skmtc/deno/cli/lib/list-headless.ts
# D, E: doctor + remove shapes
grep -n "id:" skmtc/deno/cli/lib/doctor-headless.ts
grep -A4 "RemoveHeadlessResult" skmtc/deno/cli/lib/remove-headless.ts
```

**Version anchor:** all engines: `@skmtc/core@0.4.2`,
`@skmtc/cli@0.0.57`, stock generators `@skmtc/gen-*@0.0.57`

**Status:** open — meta-entry, not a per-doc fix. The cluster's recommendations (A–G) are engineering feature requests, not doc edits, and are left for triage. Sub-item (H) — walking back the `@local/` import-key fabrication — is already complete: `#46` rewrote `reference/cli/create.md` to document the real `@<username>/` (or `jsr-user/` fallback) scope-derivation in `Project.addGenerator` at `cli/lib/project.ts:340–349`, and `#24` (catalog) already removed `@local/` from `compose-with-another-generator.md` in an earlier round. The meta-finding itself stands as a backlog signal — when 5+ independent doc writers converge on the same fabricated API, that's design-intent worth preserving rather than walking docs back to match a thinner reality. Items A (toRoutesList deps), C (list classification), and G (init pre-pins) are the recommended high-priority engineering wins.

---

### 54. `reference/settings/client-json-schema.md` — two propagated fabrications: `basePath` marked required (it's optional in the type) and "install may add per-generator default settings" (it never does) [friction]

`reference/settings/client-json-schema.md` lines 76, 317, 332.

**What happened:** Two known-cataloged fabrications still open in
this doc:

**Line 76** — heading "### `settings.basePath` (required)":

The actual type (`core/types/Settings.ts`):
```ts
export const clientSettings: v.GenericSchema<ClientSettings> = v.object({
  basePath: v.optional(v.string()),
  ...
})

type ClientSettings = {
  basePath?: string
  ...
}
```

`basePath` is **optional** in the runtime parse. The doc-claim
"required" is BULK-014 (already cataloged), still open here.

The nuance: `basePath` IS required as a positional CLI argument at
`init` time (see init.tsx). But the runtime parser of `client.json`
tolerates its absence. The doc conflates these two timings — calling
it unconditionally "required" without distinguishing.

Line 317 inherits the same conflation:
> Validation errors at parse time:
> - Missing required fields (`settings.basePath`) → recipe error

This is wrong — at runtime parse, missing `basePath` is fine. The
recipe error only happens at `init` time when no `basePath` argument
is passed.

**Line 332** — under "Editing workflows":

> **`skmtc install`** may add per-generator default settings (rare)

This claims install writes to client.json. We verified in #43 that
install only updates `deno.json#imports`; it never touches
client.json. So the fabrication from #43 (install.md "Default
settings written" section) propagated here too.

Cross-references: BULK-014 (basePath optional) and #43 (install
doesn't touch client.json) are the canonical entries. This is the
same fabrication appearing in a third location.

**What was expected:** Doc accurately distinguishes init-time
requirements from runtime parse requirements; and doesn't claim
install touches client.json.

**Why it matters:**

1. **The "required" framing misleads about runtime behavior.** A
   user editing client.json may accidentally remove `basePath`
   thinking it's optional. The runtime parser accepts; the next
   `generate` may then default to wherever the engine assumes
   (current behavior unclear without `basePath` — possibly the
   project root, possibly fails downstream when the engine tries
   to compute output paths).

   Either way, the doc-claim "missing basePath fails at parse time"
   isn't actually true — the failure (if any) happens later, with a
   less-helpful error.

2. **The install-writes-defaults claim duplicates #43.** Triage:
   when the fixer addresses #43, also sweep here.

**Possible fixes:**
- Change the heading from `(required)` to `(strongly recommended)`
  or `(required at init; optional in runtime parse)`.
- Update line 317 to reflect that missing `basePath` is a
  validation-tolerable state at runtime, but flagged by `doctor`
  (`project-base-path/<project>` check).
- Remove the line 332 bullet about install adding defaults to
  client.json.
- Verification:
  ```bash
  grep -A5 "clientSettings:" skmtc/deno/core/types/Settings.ts
  ```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Three propagated fabrications fixed in `reference/settings/client-json-schema.md`: (1) heading at line 76 changed from `(required)` to `(required at init; optional in runtime parse)` with a paragraph distinguishing the two layers — `init`'s positional argument check (recipe error if absent) vs the runtime `clientSettings` Valibot schema (`v.optional`, tolerates absence). The Constraints sub-list also cross-refs the `project-base-path` doctor check for the absolute-path rejection. (2) Validation-errors section at line 330 rewritten — `Missing required fields (settings.basePath) → recipe error` claim removed (runtime parser tolerates), replaced with a follow-on paragraph clarifying that the missing-basePath case is flagged later by `doctor` (`project-base-path/<project>` returns `warning` when unset, `error` when absolute) and that `init`'s own argument parser is the recipe-error site. (3) Editing-workflows section at line 353 rewritten — dropped the bogus "skmtc install may add per-generator default settings" bullet and added an explicit "install/clone/create/remove do not modify client.json — they only mutate deno.json#imports" note. Closes the propagation of BULK-014 (#43) into this doc.

---

### 55. `source-resolution.md` describes the schema-source field as `settings.source` (inside `settings`); actual location is top-level `source`. Plus: `settings.schemaSource` exists in the type but is dead. [friction]

`reference/settings/source-resolution.md` line 37, and
`core/types/Settings.ts` `clientSettings.schemaSource` field.

**What happened:** `source-resolution.md` heading at line 37:

> ### 2. `settings.source` in client.json
>
> ```jsonc
> {
>   "source": "./openapi.json",
>   "settings": { ... }
> }
> ```

The heading calls the field `settings.source` (inside `settings`),
but the example below shows `source` at the **top level** of
client.json. The heading and the example contradict each other.

`client-json-schema.md` shows the same example with `source` at the
top level — so that doc is internally consistent. But the *heading*
in source-resolution.md is wrong about where the field lives.

**Verified location** (`agent-context-headless.ts:157-158`):

```ts
const settings = 'settings' in parsed ? parsed.settings : undefined
const source = 'source' in parsed ? parsed.source : undefined  // ← top-level
```

The CLI reads `source` from the top level of `client.json`, not from
`settings.source`.

**Compound finding**: the `clientSettings` Valibot schema
(`core/types/Settings.ts`) defines a `schemaSource` field **inside
settings**:

```ts
export const clientSettings: v.GenericSchema<ClientSettings> = v.object({
  basePath: v.optional(v.string()),
  schemaSource: v.optional(v.string()),   // ← this field
  packages: v.optional(...),
  enrichments: v.optional(...),
  include: v.optional(...),
  skip: v.optional(...)
})
```

But no code reads `settings.schemaSource`. A `grep` for
`schemaSource` finds only its declaration + usage as a local
variable name (`schemaSourceString`) — none of which read
`settings.schemaSource` from a parsed client.json.

So the actual schema-source surface is **just the top-level `source`
field**, and `settings.schemaSource` is **dead code** in the type.

**What was expected:** The doc reflects the actual top-level
location. The dead `settings.schemaSource` field is either removed
from the type or hooked up to be read.

**Why it matters:** Two compounding effects:

1. **Direct doc confusion.** A user who reads the heading
   `settings.source` and tries to set `settings.source` in their
   `client.json` finds it's not read (the parser reads top-level
   `source`). Their pinning silently fails — `generate` falls back
   to the next step in the resolution chain.

2. **Type-system confusion.** A user inspecting the `ClientSettings`
   TypeScript type sees `schemaSource` as a valid field. They write
   `settings.schemaSource: '...'` in their client.json. The Valibot
   parse accepts (the field is allowed). But the CLI never reads
   it. Same silent failure.

Likely refactor history: someone moved the field's read-site (from
`settings.schemaSource` → top-level `source`), the type was kept for
backwards compat but the read-site was moved, and docs were updated
partially.

**Possible fixes:**
- Pick a canonical location and align everything:
  - Option A: read top-level `source` (current behavior). Remove
    `schemaSource` from `clientSettings` type. Fix
    source-resolution.md heading from `settings.source` to `source`.
  - Option B: read `settings.source` (move the read-site). Keep
    type. Update client-json-schema.md to show `source` inside
    `settings`.
- If keeping option A, audit any consumer (incl. dashboards / Sandbox
  API integrations) that may set `settings.schemaSource` expecting
  it to be read.
- Verification command:
  ```bash
  grep -rn "schemaSource\|\\.source\b" \
    skmtc/deno/cli/lib/ skmtc/deno/cli/commands/ \
    | grep -v test | grep -v coverage | head -20
  ```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Fixed the heading-vs-example contradiction in `reference/settings/source-resolution.md` step 2: heading changed from `### 2. \`settings.source\` in client.json` to `### 2. Top-level \`source\` in client.json`, with a follow-on paragraph explicitly noting that `source` lives at the top level of `client.json` (not inside `settings`) and citing the read site at `cli/lib/agent-context-headless.ts:157–158`. Added a callout block-quote about the unused `settings.schemaSource` field in `clientSettings` — it's declared in the Valibot schema but no consumer reads it; users are directed to use top-level `source` instead. Chose Option A (doc the current behaviour) since changing the read-site would be a breaking change for any tooling that already writes top-level `source`. The dead `schemaSource` field in `core/types/Settings.ts` remains a code-cleanup follow-up, called out for engineering triage but not fixed here (out of scope for doc work).

---

### 56. `explanation/status-and-roadmap.md` recommends `skmtc bundle --json | jq .bundleSize` for measuring bundle weight; `bundleSize` field doesn't exist in the output [polish]

`explanation/status-and-roadmap.md` line 200.

**What happened:** In the "Worker payload size" limitation section,
doc says:

> **Mitigation:** measure with `skmtc bundle --json | jq .bundleSize`.
> If the bundle is unreasonably large, remove unused generators.

The actual `BundleHeadlessResult` type (`cli/lib/bundle-headless.ts:24-35`):

```ts
export type BundleHeadlessResult =
  | { kind: 'bundled'; projectName: string; bundlePath: string }
  | { kind: 'noop'; projectName: string; reason: 'remote-only'; detail: string }
```

No `bundleSize` field. Running the doc's recipe:

```bash
$ skmtc bundle my-api --json | jq .bundleSize
null
```

To actually measure the bundle, a user would need:

```bash
$ wc -c "$(skmtc bundle my-api --json | jq -r .bundlePath)"
```

(File size from disk, not from the JSON output.)

**What was expected:** Either `bundle --json` includes a real
`bundleSize` field (the doc's mitigation works), or the doc's
mitigation uses `wc -c` against `bundlePath`.

**Why it matters:** Lowest-severity finding in this round —
status-and-roadmap is a meta-doc that few users read first. But the
"mitigation" framing makes it sound actionable when running it
returns nothing.

This continues the pattern of doc-claimed CLI surfaces that don't
exist — same class as #44 (doctor checks), #47/#48 (list/remove
output). Each is small in isolation; in aggregate they suggest the
CLI's JSON output spec should have stricter alignment with the
documented surface.

**Possible fixes:**
- Either:
  - Add `bundleSize: number` (bytes) to `BundleHeadlessResult` when
    `kind: 'bundled'`. The information is trivially computable
    (`Deno.stat(bundlePath)`).
  - Change the doc's mitigation to use `wc -c` or `stat` against the
    bundlePath.
- Verification command:
  ```bash
  grep -A3 "BundleHeadlessResult" \
    skmtc/deno/cli/lib/bundle-headless.ts
  ```

**Version anchor:** `@skmtc/cli@0.0.57`

**Status:** verified-fixed 2026-05-12 — Fixed the bogus `jq .bundleSize` recipe in `explanation/status-and-roadmap.md:200`. Verified against `cli/lib/bundle-headless.ts:24–35` that `BundleHeadlessResult` has no `bundleSize` field — it's just `{ kind, projectName, bundlePath }` (or `{ kind: 'noop', projectName, reason, detail }` for remote-only). Replaced the recipe with `wc -c "$(skmtc bundle <project> --json | jq -r .bundlePath)"` and explicitly noted that size has to come from `stat`/`wc -c` against the bundle path, not from the JSON output. The doc-not-code path was chosen over adding a `bundleSize` field — measuring on disk is a one-liner and avoids adding a freshly-stat'd field to the result type. The latter is logged in the meta-cluster (#53 item F-adjacent) if the JSON-surface alignment becomes a priority.

---

### 57. `reference/glossary.md` two propagated fabrications: `EntityType` discriminator value `'const'` (should be `'variable'`), `StackTrail` shown as dot-separated (actual is colon-separated) [polish]

`reference/glossary.md` lines 112–114, 378.

**What happened:** Two glossary entries carry already-cataloged
fabrications:

**Line 112–114 — `EntityType`:**

> A property of `Identifier` that distinguishes types (`'type'`) from
> values (`'const'`). Affects whether imports emit as
> `import { X }` or `import { type X }` under `verbatimModuleSyntax`.

The discriminator value for the value case is `'variable'`, not
`'const'`. Verified at `core/dsl/EntityType.ts:59`:
`type EntityTypeValue = 'variable' | 'type'`. This is the BULK-013 /
#50 / #52 cluster propagated to the glossary — fifth+ doc instance.

**Line 378 — `StackTrail` separator:**

> The location-tracking accumulator threaded through parse and
> generate. Stringifies as a colon-separated path
> (`paths./users.post.requestBody.content...`). Used for issue
> locations.

The doc prose says "colon-separated" but the example uses **dots**.
Actual `StackTrail.toString()` uses `:` separators with `%3A`
encoding for embedded colons (BULK-016 — already cataloged).

The colon would be `paths:/users:post:requestBody:content`. The
example contradicts the prose.

**What was expected:** Glossary entries match the actual code.

**Why it matters:** The glossary is the **lookup-by-term** entry
point. Users encountering `'const'` or `'variable'` in code-base
search will look up the glossary's `EntityType` entry to disambiguate
and get the wrong canonical form. For the StackTrail example, anyone
hand-writing test fixtures or jq recipes against the location field
would use dots and produce mismatches.

**Possible fixes:**
- Line 113: replace `'const'` with `'variable'`.
- Line 378–379: fix the example to use colons:
  ```
  paths:/users:post:requestBody:content...
  ```
- Cross-ref the Identifier/EntityType cluster (#50, #52) and BULK-016
  for the audit sweep.
- Verification command:
  ```bash
  grep -n "'const'\|paths\\.\\|/users\\." \
    skmtc/deno/docs/reference/glossary.md
  ```

**Version anchor:** `@skmtc/core@0.4.2`

**Status:** verified-fixed 2026-05-12 — Fixed both glossary fabrications. Lines 112–114 (`EntityType`): replaced `'const'` with `'variable'` and added the clarification that the discriminator value is `'variable'` but the rendered TS declaration keyword is `const`. Lines 377–380 (`StackTrail`): replaced the dot-separated example `paths./users.post.requestBody.content...` with the actual colon-separated form `paths:/users:post:requestBody:content...`, and added a note that embedded colons in a segment are URL-encoded as `%3A` (per BULK-016). Closes the BULK-013 / #50 / #52 cluster's propagation to the glossary, and the BULK-016 StackTrail-format propagation. Both fixes verified against `core/dsl/EntityType.ts:59` and the BULK-016 catalog entry.

---

### 58. `skmtc-generators/gen-zod/README.md` and `gen-valibot/README.md` — all schema examples show PascalCase identifiers (`export const User`); actual generators emit lowercase (`export const user`). Plus a stale CLI install version. [blocker]

`skmtc-generators/gen-zod/README.md`, `skmtc-generators/gen-valibot/README.md`,
plus `gen-typescript/README.md` for the install-version part.

**What happened:** These are the **JSR-visible** READMEs for the
published packages. Users browsing JSR or pulling the packages
locally see them as the canonical "what does this generator do"
reference.

**Wrong-casing in output examples:**

`gen-zod/README.md` shows multiple examples with PascalCase exports:

```ts
// Line 96
export const User = z.object({ ... });

// Line 358
export const Pet = z.discriminatedUnion("type", [...]);

// Line 477
export const UserProfile = z.string();
```

`gen-valibot/README.md` is identical:

```ts
// Line 91
export const User = v.object({ ... });

// Line 174, 217, 266, 311, 343, 377
export const Team, Profile, Pet, Event, Metadata, Config = ...
```

But the **actual** identifier-naming logic in both generators
(`gen-zod/src/base.ts:15-19` and `gen-valibot/src/base.ts` analogous):

```ts
toIdentifier({ refName }): Identifier {
  const name = decapitalize(camelCase(refName));
  return Identifier.createVariable(name);
}
```

For `refName = "User"`, name = `decapitalize("User") = "user"`. So
the actual emission is:

```ts
export const user = z.object({...});
```

Every PascalCase example in both READMEs is wrong. Same wrong-casing
issue as #11 (Tutorial 01/02) — but here it's in the
**JSR-published README**, which users see *before* tutorials.

For comparison, `gen-typescript/README.md` has the SAME identifier
examples but in PascalCase form (`export type User = ...`), which is
**correct** for gen-typescript (whose `toIdentifier` uses
`capitalize(camelCase(refName))`). So the README pattern was likely
copied across generators without adjusting the casing.

**Stale CLI install version (all three substantive READMEs):**

`gen-zod/README.md` line 27, `gen-valibot/README.md` line 24,
`gen-typescript/README.md` line 24, all:

```bash
deno install -g -A --unstable-worker-options jsr:@skmtc/cli@0.0.405 -n skmtc -f
```

The CLI pin is **`@0.0.405`**. The actual current CLI version
(`cli/deno.json`) is **`0.2.2`**. `0.0.405` doesn't exist on JSR
under the current track.

A user running this install command gets either:
- "version not found" if `0.0.405` is fictional
- Some ancient version if `0.0.405` ever existed on a defunct track

Either outcome blocks the first step of every getting-started flow.

**What was expected:** README examples reflect the generator's actual
output. Install commands pin a real, current version.

**Why it matters:** Combined severity is **blocker** for two reasons:

1. **JSR is the canonical discovery surface.** Users browsing
   `jsr.io/@skmtc/gen-zod` see the README content right on the
   package page. The wrong examples are the *first impression* of
   the generator.

2. **The install command is step 1 of every Quick Start.** Users
   copy-paste it verbatim. Failure here blocks the entire onboarding
   flow before any SKMTC-specific code runs.

The wrong-casing also has a sibling effect: a user installing gen-zod
and gen-typescript together would expect imports like `import { User,
user } from '...'`. The README shows `User` (zod), which collides
with `User` (TS type). Even if the user adjusts to lowercase
mentally, they may not understand *why* they need to.

**Possible fixes:**
- Sweep both `gen-zod/README.md` and `gen-valibot/README.md` for
  every `export const <Pascal>` and replace with the actual
  lowercase form.
- Update the CLI install command in all 3 substantive READMEs to
  point at a real current version (e.g., `@0.2.2`). Or better,
  switch to `@latest`:
  ```bash
  deno install -g -A --unstable-worker-options jsr:@skmtc/cli -n skmtc -f
  ```
- Audit the stub READMEs (gen-msw, gen-shadcn-*, gen-tanstack-*,
  gen-supabase-hono, gen-express) — they're currently 6 lines each;
  if they grow, ensure new content uses real version pins.
- Verification command:
  ```bash
  grep -n "export const [A-Z]\\|@skmtc/cli@0" \
    skmtc-generators/gen-zod/README.md \
    skmtc-generators/gen-valibot/README.md \
    skmtc-generators/gen-typescript/README.md
  ```

**Version anchor:** `@skmtc/gen-zod@0.0.57`,
`@skmtc/gen-valibot@0.0.57`, `@skmtc/gen-typescript@0.0.57`,
`@skmtc/cli@0.2.2`

**Status:** verified-fixed 2026-05-12 — Two parts. (1) **Wrong-casing in gen-zod and gen-valibot README examples**: every `export const <Pascal>` form replaced with the actual lowercase form the generator produces. Verified against `gen-zod/src/base.ts:14–18` (`decapitalize(camelCase(refName))`) and the analogous `gen-valibot` rule. In gen-zod: `User → user`, `Profile → profile`, `Status → status`, `Role → role`, `Tags → tags`, `Matrix → matrix`, `Company → company`, `Article → article`, `StringOrNumber → stringOrNumber`, `Pet → pet`, `Metadata → metadata`, `Config → config`, `Category → category`, `UserProfile → userProfile`, `ApiResponse → apiResponse`, `MyType → myType` (16 sites). In gen-valibot: `User`, `Status`, `Role`, `Team`, `Profile`, `Pet`, `Event`, `Metadata`, `Config` (9 sites). Final grep for `^export const [A-Z]` returns empty in both files. `gen-typescript/README.md` left alone — its PascalCase examples are correct because gen-typescript's `toIdentifier` uses `capitalize(camelCase(refName))`. (2) **Stale CLI install version**: all three substantive READMEs (`gen-zod`, `gen-valibot`, `gen-typescript`) had `jsr:@skmtc/cli@0.0.405` (a fictional version — current is `0.2.2` per `cli/deno.json`). Switched to `jsr:@skmtc/cli` (latest-resolving) which avoids future drift, the alternative being a hard pin to `0.2.2` that goes stale on the next release. Onboarding install command is now functional in all three READMEs. Closes the #11 wrong-casing cluster's propagation to the JSR-visible READMEs.

---

### 59. `skmtc-generators/gen-typescript/CLAUDE.md` — claims `TsString, TsArray, TsObject` extend `TypescriptBase`; actual: they extend `SnippetBase`. Plus references a fictional `TsInsertable` class. [friction]

`skmtc-generators/gen-typescript/CLAUDE.md` lines 33, 41.

**What happened:** The CLAUDE.md is the **agent-bootstrap context**
for every Claude session working under `gen-typescript/`. Two
inaccuracies:

**Line 33:**

> The generator follows a pattern where each TypeScript type has its
> own class (e.g., `TsString`, `TsArray`, `TsObject`) that extends
> from `TypescriptBase`. The main entry point is `typescriptEntry`
> which uses `TsInsertable` to generate types.

Two issues:

1. **`TsString`, `TsArray`, `TsObject` do NOT extend `TypescriptBase`.**

   Verified at source:
   ```
   src/TsString.ts:14:  export class TsString extends SnippetBase {
   src/TsArray.ts:23:   export class TsArray extends SnippetBase {
   src/TsObject.ts:29:  export class TsObject extends SnippetBase {
   ```

   Only `TsProjection` extends `TypescriptBase`:
   ```
   src/TsProjection.ts:14:  export class TsProjection extends TypescriptBase {
   ```

   The `TsString`/`TsArray`/`TsObject` classes are **Snippets** (not
   Projections) — internal dispatch targets used by `toTsValue` to
   render per-variant TS code, embedded into the final TsProjection's
   `toString()`. They don't have static `toIdentifier` /
   `toExportPath`, don't extend the projection base.

   This conflates two distinct DSL roles (Projection vs Snippet) —
   the same conceptual mistake the projections-and-snippets concept
   doc was meant to prevent.

2. **`TsInsertable` doesn't exist.** Searched the entire
   `gen-typescript/` directory:
   ```
   find skmtc-generators/gen-typescript/src -name "TsInsertable*"
   # No matches
   ```

   The closest equivalent is `TsProjection`. The CLAUDE.md introduces
   a fictional class name that doesn't appear in source.

**Line 41:**

> - `src/TsInsertable.ts` - Main insertable class that generates
>   TypeScript types from schemas

References the same fictional file. There is no `src/TsInsertable.ts`
in the gen-typescript source tree.

(The terminology trace: "Insertable" was an older term for
"Projection" — the glossary entry at glossary.md:200–201 notes this.
The class was renamed to `TsProjection`, but `gen-typescript/CLAUDE.md`
kept the old name.)

**What was expected:** The CLAUDE.md accurately describes the actual
file layout and class hierarchy of gen-typescript.

**Why it matters:** This is the **agent context** for gen-typescript
development. Every Claude session working in this directory loads
this file. Concrete effects:

1. **Pattern-following agents extend the wrong base.** An agent
   asked to "add a new TsX class for variant X" would copy the
   CLAUDE.md's claimed pattern (`class TsX extends TypescriptBase`)
   and ship a broken class. `TypescriptBase` has the projection-base
   shape (cache key, settings), inappropriate for an inline-emission
   Snippet.

2. **Search for `TsInsertable` fails.** An agent following the
   CLAUDE.md's references will `grep TsInsertable` and find
   nothing, conclude they're missing files or the codebase is
   inconsistent, and may try to "restore" the missing file.

3. **The Projection vs Snippet distinction stays muddied.** The
   conceptual mistake the projections-and-snippets concept doc
   tries to head off (treating everything as a Projection) is
   embedded in the agent context for this specific generator.

Same class as #16 (core/CLAUDE.md Prettier claim) and #19–#21
(CLAUDE.md audit cluster) — the CLAUDE.md channel has drifted from
code. This is a fourth+ confirmed instance.

**Possible fixes:**
- Replace line 33's class hierarchy claim:
  > The generator follows a pattern where one **Projection** class
  > (`TsProjection`, extending `TypescriptBase`) orchestrates
  > emission, and per-variant **Snippet** classes (`TsString`,
  > `TsArray`, `TsObject`, etc., all extending `SnippetBase`) handle
  > the inline rendering for each schema variant.
- Replace line 41's `TsInsertable.ts` reference with `TsProjection.ts`.
- Audit other per-generator CLAUDE.md files for stale "Insertable"
  references:
  ```bash
  grep -rn "Insertable\|TsInsertable\|ZodInsertable" \
    skmtc-generators/ --include="CLAUDE.md"
  ```
- Verification command:
  ```bash
  grep -n "extends " skmtc-generators/gen-typescript/src/Ts*.ts
  ls skmtc-generators/gen-typescript/src/Ts*.ts
  ```

**Version anchor:** `@skmtc/gen-typescript@0.0.57`

**Status:** verified-fixed 2026-05-12 — Fixed both fabrications in `skmtc-generators/gen-typescript/CLAUDE.md`. Line 33 (Core Components) rewritten to accurately describe the two-layer pattern: one **Projection** class `TsProjection` extending `TypescriptBase` (verified at `src/TsProjection.ts:14`) and per-variant **Snippet** classes (`TsString`, `TsArray`, `TsObject`, `TsUnion`, `TsNumber`, `TsInteger`, `TsBoolean`, `TsRef`, `TsNull`, `TsNever`, `TsVoid`, `TsUnknown`) all extending `SnippetBase` (verified by `grep "extends " src/Ts*.ts` — every Ts* file except TsProjection ends in `extends SnippetBase`). The entry point is `typescriptEntry` from `src/mod.ts`, which dispatches to `TsProjection`. Line 41 (Key Files): the fictional `src/TsInsertable.ts` reference replaced with `src/TsProjection.ts` and a follow-on bullet listing the per-variant Snippet files. Closes the CLAUDE.md-drift cluster (#16, #19–#21, #59) for this generator. The workspace-level `skmtc-generators/CLAUDE.md` has the same fictional naming and is addressed in #60.

---

### 60. `skmtc-generators/CLAUDE.md` (workspace-level) — fictional `TsInsertable` / `ZodInsertable` class names loaded for every agent session in `gen-*/` directories [friction]

`skmtc-generators/CLAUDE.md` line 61.

**What happened:** The workspace-level CLAUDE.md says:

> 2. **Main Insertable**: A main class (e.g., `TsInsertable`,
>    `ZodInsertable`) that handles the transformation

Both class names are **fictional**:
- `TsInsertable` — actual is `TsProjection` (see #59).
- `ZodInsertable` — actual is `ZodProjection`, verified in
  `gen-zod/src/ZodProjection.ts`.

"Insertable" is the old name for "Projection" (per glossary.md:200–201).
The classes were renamed but this CLAUDE.md kept the old terminology.

**Why it matters:** This is the **workspace-level CLAUDE.md** —
loaded into every Claude session anywhere under `skmtc-generators/`,
not just gen-typescript. Higher impact than #59. An agent working in
any gen-* directory loads this + the per-gen CLAUDE.md and sees the
wrong terminology in both.

Same CLAUDE.md-drift cluster as #16, #19–#21, #59. Pattern: doc
clean-up passes didn't extend to CLAUDE.md files.

**Possible fixes:**
- Line 61: `TsInsertable` → `TsProjection`, `ZodInsertable` →
  `ZodProjection`. Or rename the item from "Main Insertable" to
  "Main Projection".
- Audit sweep:
  ```bash
  grep -rn "Insertable" skmtc-generators/ skmtc/deno/
  ```

**Version anchor:** `@skmtc/gen-typescript@0.0.57`,
`@skmtc/gen-zod@0.0.57`

**Status:** verified-fixed 2026-05-12 — Fixed the workspace-level `skmtc-generators/CLAUDE.md` line 61: the bullet now reads "**Main Projection**: A main class (e.g., `TsProjection`, `ZodProjection`) that handles the transformation". Both fictional class names (`TsInsertable`, `ZodInsertable`) replaced with their actual post-rename names; the bullet heading itself changed from "Main Insertable" to "Main Projection" to match. Audit sweep (`grep -rln "Insertable" skmtc-generators/ skmtc/deno/docs/`) returns only `reference/glossary.md` which is the intentional historical-rename entry (Insertable → Projection) — left alone since it accurately describes the rename as a historical fact. Closes the workspace-level CLAUDE.md drift for this terminology cluster.

---

### 61. Top-level JSR-published READMEs (`core/README.md`, `cli/README.md`) tell users to run `npx skmtc` — SKMTC is a Deno CLI, not npm. Plus fictional generator names in Quick Start. [blocker]

`skmtc/deno/core/README.md` lines 17–32,
`skmtc/deno/cli/README.md` lines 18–32. Same content in both files.

**What happened:** Both JSR-published READMEs open Quick Start with:

```bash
# Run directly with npx
npx skmtc
```

Then:

```bash
npx skmtc generate @skmtc/supabase-backend https://petstore3.swagger.io/api/v3/openapi.json
# Generated 9 files (507 lines, 3,383 tokens) in 9ms

npx skmtc generate @skmtc/supabase-react-client https://raw.githubusercontent.com/cloudflare/api-schemas/refs/heads/main/openapi.json
# Generated 6,797 files (104,752 lines, 1,635,227 tokens) in 2,969ms
```

**Three structural problems:**

1. **`npx skmtc` doesn't work.** SKMTC is a Deno CLI, not an npm
   package. There is no `skmtc` on npm. The correct install is the
   `deno install` command shown later in `skmtc/README.md:24`:
   ```bash
   deno install -g -A --unstable-worker-options jsr:@skmtc/cli@... -n skmtc -f
   ```
   A user running `npx skmtc` gets "npm error: package not found".
   Step 1 of the Quick Start blocks the entire onboarding.

2. **`@skmtc/supabase-backend` and `@skmtc/supabase-react-client`
   don't exist.** Verified against `skmtc-generators/`:
   ```bash
   $ ls skmtc-generators/ | grep -E "supabase|backend"
   gen-supabase-hono
   ```
   Only `gen-supabase-hono` exists. `supabase-backend` and
   `supabase-react-client` are fictional. A user copy-pasting the
   commands gets "generator not found on JSR".

3. **Output benchmark numbers** ("Generated 9 files in 9ms", "6,797
   files in 2,969ms") are unverifiable. They use fictional generator
   names against real URLs, so the commands couldn't have produced
   these outputs. Same fabricated-perf-number pattern as #18, #56.

**Additional issues in the example code block** (`core/README.md`
lines 35–66, `cli/README.md` lines 36–66):

```ts
class ZodFetch extends OasOperationProjectionBase {  // ← BULK-008 anti-pattern
  ...
  toString(){
    return `() => {
      const res = await fetch('${this.operation.path}')
      const data = await res.json()

      return ${zodName}.parse(data)   // ← missing `this.` — `zodName` is undefined
    }`
  }
}
```

- `extends OasOperationProjectionBase` is the abstract base
  anti-pattern (BULK-008). Should extend a factory result.
- `${zodName}` should be `${this.zodName}`. As written, the emitted
  output would be `${undefined}.parse(data)`.
- The `toString()` body uses `await fetch(...)` inside a non-`async`
  arrow function.

**Available Generators list** (both READMEs lines 68–76): only 5
categories. Missing: shadcn-form, shadcn-select, shadcn-table,
arktype, valibot, daisyui-form, express, graphql-operation,
graphql-typed-document-node, reapit-form, reapit-graphql-client,
reapit-multi-select, reapit-searchable-dropdown. **13 of 18+ stock
generators absent.**

**What was expected:** Working Quick Start with real CLI invocation
(`deno install` + `skmtc`), real generator names, and example code
that compiles.

**Why it matters:** These are the **JSR package pages** for
`@skmtc/core` and `@skmtc/cli`. Anyone discovering SKMTC via JSR sees
these first. Every claim in the Quick Start is wrong:

1. User tries `npx skmtc` → npm error.
2. User figures out it's Deno, runs the install command → succeeds.
3. User tries `skmtc generate @skmtc/supabase-backend ...` → "not found".
4. User looks at the Available Generators list, finds 5 generators
   that exist, doesn't see the form/table ones (the compelling
   demos).
5. User concludes SKMTC isn't ready and bounces.

This is the **single highest-impact set of fabrications** logged in
the entire session. JSR is the canonical discovery surface; both
READMEs there are broken.

**Possible fixes:**
- Rewrite Quick Start with the actual install command and a real
  generator:
  ```bash
  deno install -g -A --unstable-worker-options jsr:@skmtc/cli -n skmtc -f

  skmtc init petstore src/generated
  skmtc install @skmtc/gen-zod petstore
  skmtc generate petstore https://petstore3.swagger.io/api/v3/openapi.json
  ```
- Replace fictional generator names with real ones from
  `skmtc-generators/`.
- Remove the inline output stats (unverifiable).
- Fix the example code: use the factory pattern, use `this.zodName`,
  declare the inner function `async`.
- Expand "Available Generators" to list all 18+ stock generators
  (or link to the catalog).
- Verification:
  ```bash
  ls skmtc-generators/ | grep ^gen-
  head -40 skmtc/deno/core/README.md
  ```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/cli@0.2.2`,
stock generators `@skmtc/gen-*@0.0.57`

**Status:** verified-fixed 2026-05-12 — Rewrote the Quick Start and Available Generators sections in both `skmtc/deno/core/README.md` and `skmtc/deno/cli/README.md` (the JSR-published surfaces). Replaced `npx skmtc` with the real `deno install -g -A --unstable-worker-options jsr:@skmtc/cli -n skmtc -f` install command. Replaced the fictional `@skmtc/supabase-backend` and `@skmtc/supabase-react-client` generators with a realistic 3-step flow against `@skmtc/gen-zod` and the petstore schema (`skmtc init petstore src/generated` → `skmtc install @skmtc/gen-zod petstore` → `skmtc generate petstore <url>`). Removed the unverifiable "Generated N files in Nms" inline benchmarks. Rewrote the example generator code: uses the factory pattern (`toOasOperationProjectionBase({...})` → `class ZodFetch extends ZodFetchBase`) per BULK-008, references `this.zodName` (not bare `zodName`), declares the inner function `async`, and wires it through a real `toOasOperationEntry` export. Expanded "Available Generators" from 5 categories to 8 (categorising all 18 real stock generators verified via `ls skmtc-generators/`), with a link to the JSR scope at https://jsr.io/@skmtc and the GitHub repo. Closes the highest-impact JSR-discovery fabrication cluster (npx invocation + fictional generators + non-compiling example).

---

### 62. `skmtc/README.md` + `skmtc-generators/README.md` — generator status table mis-marks every shipping generator as "🏗️ Soon" or "🧪 Later"; missing 7 generators entirely [friction]

`skmtc/README.md` lines 39–53, `skmtc-generators/README.md` lines 6–18.

**What happened:** Both files share the same generator-status table.
**Every** generator marked "🏗️ Soon" or "🧪 Later" is actually
**shipping today**:

| Doc claims | Reality |
|---|---|
| `gen-arktype` 🏗️ Soon | Shipping — `@skmtc/gen-arktype@0.0.57` |
| `gen-valibot` 🏗️ Soon | Shipping |
| `gen-msw` 🏗️ Soon | Shipping — covered in #4 |
| `gen-supabase-hono` 🏗️ Soon | Shipping — covered in #5 |
| `gen-tanstack-query-fetch-zod` 🏗️ Soon | Shipping |
| `gen-tanstack-query-supabase-zod` 🏗️ Soon | Shipping |
| `gen-shadcn-form` 🧪 Later | Shipping — canonical example doc |
| `gen-shadcn-select` 🧪 Later | Shipping — covered in #1 |
| `gen-shadcn-table` 🧪 Later | Shipping — covered in #2 |

Only `gen-typescript` and `gen-zod` are marked "🚀 Now" — but every
entry should be "Now". The table understates by 9 generators.

**Table incompleteness:** The table lists 11 generators. The
workspace has **18**. Missing:

- `gen-daisyui-form` (covered in #6)
- `gen-express` (#3)
- `gen-graphql-operation` (#35)
- `gen-graphql-typed-document-node`
- `gen-reapit-form` (#7)
- `gen-reapit-graphql-client`
- `gen-reapit-multi-select`
- `gen-reapit-searchable-dropdown`

**What was expected:** Status markers reflect actual shipping state.
All 18 generators listed.

**Why it matters:** Canonical "what does SKMTC have?" tables. A user
evaluating SKMTC reads this to decide whether the framework covers
their use case. The reality is **much better than the doc claims**:

1. User reads "shadcn-form: Later", concludes the form generator
   isn't ready, picks a different tool. Reality: it's the
   most-tested stock generator.
2. User looks for `gen-express`, doesn't see it, concludes Express
   isn't supported. Reality: ships today.
3. The understatement makes SKMTC look **less mature than it is**.
   Opposite of most fabrications in this session (over-promising) —
   but the user-facing effect is similar (wrong adoption decision).

Same completeness gap class as #7 (stock-generators/overview.md
missed gen-reapit-*). **Three docs now under-document the catalog**:
skmtc/README.md, skmtc-generators/README.md,
docs/reference/stock-generators/overview.md.

**Possible fixes:**
- Audit `skmtc-generators/` against both tables. Add missing entries.
  Update all status markers.
- Consider auto-generating the table from the workspace `deno.json`
  or directory listing.
- Centralize the catalog to one canonical source.
- Verification:
  ```bash
  diff <(ls -d skmtc-generators/gen-*/ | xargs -n1 basename | sort) \
       <(grep -oE '@skmtc/gen-[a-z-]+' skmtc/README.md | sort -u | sed 's|@skmtc/||')
  ```

**Version anchor:** stock generators `@skmtc/gen-*@0.0.57`

**Status:** verified-fixed 2026-05-12 — Updated the generator-status tables in both `skmtc/README.md` (lines 41–53) and `skmtc-generators/README.md` (lines 6–18) to reflect actual shipping state. All 9 previously-misclassified generators moved from `🏗️ Soon` / `🧪 Later` to `🚀 Now` (gen-arktype, gen-valibot, gen-msw, gen-supabase-hono, gen-tanstack-query-fetch-zod, gen-tanstack-query-supabase-zod, gen-shadcn-form, gen-shadcn-select, gen-shadcn-table) — each verified via `ls skmtc-generators/` and a `deno.json` version of `0.0.57`. Added the 7 missing generators (gen-express, gen-daisyui-form, gen-graphql-operation, gen-graphql-typed-document-node, gen-reapit-form, gen-reapit-graphql-client, gen-reapit-multi-select, gen-reapit-searchable-dropdown) — that's actually 8 entries since I split the GraphQL pair, bringing the table to 19 rows matching the 19 directories under `skmtc-generators/`. Closes the under-promising completeness gap class (#7 sibling) for the two README tables; `docs/reference/stock-generators/overview.md` was already fixed in an earlier round.