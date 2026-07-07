# 2026-05-24 — skmtc-reapit build-out: clone peer reference architecture

A long session standing up `skmtc-reapit` (a Vite/React + Reapit
Connect OAuth + Elemental UI app driven by SKMTC). The bulk of the
friction was around how cloned generators reference each other and
their `@skmtc/core` peer — clones produced by `skmtc clone` hardcode
`jsr:@scope/name@x.y.z` URLs in source rather than using bare
specifiers + a deno.json import map. That made every version bump
chase pins through dozens of files, and it meant editing one clone
didn't help any other clone that imported it. A separate friction
came from an early-session reflex to ask the user to hand-code
components rather than diagnose why the cloned generator was
emitting skeleton output.

## Knowledge acquired

Working across the SKMTC core, the CLI clone surface, the generator
authoring layer, and the consumer app.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `skmtc clone` writes JSR URLs (`jsr:@skmtc/X@x.y.z`) directly into source files instead of bare specifiers, even though the clone's deno.json has an import map that would resolve bare specifiers correctly. Canonical generators (`skmtc-generators/gen-*/`) use bare specifiers. | CLI behaviour change — `skmtc clone` should match canonical pattern. |
| K2 | Even with bare specifiers, a fresh `skmtc clone` pins peer generators to JSR. When multiple peers are cloned side-by-side in the same project, they don't pick each other up locally — edits to one clone's source require republishing to be visible to its siblings. The fix is to rewrite the cloned deno.json so `@skmtc/gen-*` peers map to `../sibling/mod.ts`. | CLI behaviour change — clone should default to local mapping when sibling clones exist. |
| K3 | The release script's cascade is **intra-workspace only**. `skmtc/deno` and `skmtc-generators/` are separate workspaces; bumping `@skmtc/core` in the former doesn't trigger any republishes in the latter, because generators pin core as a JSR external. Cross-workspace coordination is manual. | Release script enhancement or explicit how-to. |
| K4 | Per-item resource lookup via the by-id endpoint paired with React Query dedup is the correct pattern for resolving foreign-key columns, not list-fetch with a high `pageSize`. The §3.5 operation-reference protocol composes naturally with this: enrichment names the list path (`/offices/`), generator resolves the sibling by-id path (`/offices/{id}`), inserts that endpoint's `TanstackQuery`, and emits per-row wrapper components in the same file. | Recipe under `authoring/recipes/` — "resolving foreign-key columns via per-item lookup". |
| K5 | Reapit's live API returns `null` for unset optional fields even though the OAS schema only declares them `required: false`, not `nullable: true`. Generators that emit strict `.optional()` zod schemas reject those responses. Mitigation: coerce `nullable = !required` in the `applyModifiers` of both `gen-zod` and `gen-typescript`. | Either generator-level convention (Reapit-specific enrichment) or a general "nullable-by-default" mode that's selectable. |
| K6 | The generated `queryFn` in `gen-tanstack-query-fetch-zod` destructured all query parameters into the hook signature but never appended them to the URL, so `pageNumber`/`pageSize`/etc. were silently dropped from outgoing requests. Pagination state changed → React Query re-keyed → no behavioural change. | SKMTC code gap (already fixed in this session). |
| K7 | `OasTag.externalDocs` is silently dropped by the parser — there's even a commented-out `// externalDocs: externalDocs.optional()` line in `tag-types.ts`. The helpers (`toExternalDocs`, `ExternalDocs`, the Valibot schema) already exist. | Wire-up; already done in this session. |
| K8 | `@reapit/connect-session` bundles its own copy of React, which triggers React's "Invalid hook call" if your app loads a different version. Vite's `resolve.dedupe: ['react', 'react-dom']` is the fix. | Knowledge — not SKMTC-specific. |
| K9 | Tailwind v4 doesn't scan `node_modules` for utility classes by default. A UI library that ships compiled components referencing classes like `bg-muted/50` needs `@source '../node_modules/<lib>/dist'` in your CSS, otherwise the classes silently don't generate. | Knowledge — not SKMTC-specific, but worth noting for any project consuming a Tailwind-based UI lib via npm. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Reflex to ask the user to hand-code around cloned-generator output | friction | open |
| 2 | `skmtc clone` hardcodes JSR URLs in source instead of bare specifiers | friction | open |
| 3 | Cloned generators pin peers to JSR even when sibling clones exist | friction | open |
| 4 | Per-item resource lookup + React Query dedup is the right resource-reference pattern | win | open |
| 5 | `isListResponse` matched scalar-array `/{id}` responses as lists | friction | resolved 2026-05-24 (commit 09b227a) |
| 6 | Release script cascade stops at workspace boundary | friction | open |
| 7 | Generated `queryFn` dropped all query parameters from the request URL | friction | resolved 2026-05-24 (gen-tanstack-query-fetch-zod) |
| 8 | `UseMutationOptions` emitted as value import under `verbatimModuleSyntax: true` | friction | resolved 2026-05-24 (gen-tanstack-query-fetch-zod) |
| 9 | Reapit API returns `null` for fields the OAS doesn't declare nullable | friction | mitigated 2026-05-24 (consumer-side generator edit) |

---

### 1. Reflex to ask the user to hand-code around cloned-generator output [friction]

Triggered early in the session, immediately after loading the
`skmtc-generator` and `skmtc-cli` skills. The user explicitly flagged
this and asked me to log it for the retro.

**What happened:** Inspected the freshly-cloned + regenerated form
output and found `CreateApplicantsForm.generated.tsx` was 15 lines —
just the `Body` type + zod schema + `Props` type, no React component
body. `inputs/*.generated.tsx` were 0 bytes. I reflexively offered the
user three options for how to *scaffold consumer-side components*
around what I called "skeleton output", including suggesting they
hand-write the missing component bodies.

The user pushed back: I had just loaded a skill whose entire premise
is the opposite — *generator source is the customization surface*.
After re-evaluating, the actual cause was visible in the cloned
generator source: `gen-shadcn-form/src/ShadcnForm.ts:1` imported
`jsr:@skmtc/gen-tanstack-query-supabase-zod@0.0.60` (Supabase variant)
but the project had installed the `-fetch-zod` variant. `isSupported`
returned true → `transform` ran → `ShadcnForm` constructor called
`insertOperation(TanstackQuery, op)` → driver's `assertPeerSupported`
threw because the supabase-variant peer didn't support Reapit's REST
endpoints → all 99 form items were recorded as `"error"` in the
manifest, and only the side-effect Definitions registered before the
throw point survived. Result: 15-line truncated output that *looked*
like an "incomplete generator", but was a coordinated abort.

The misdiagnosis would have been visible in the manifest's per-item
`Counter({error: ...})` if I'd inspected it; visible in the cloned
generator's `toString()` template (which clearly emitted a full JSX
function); and visible in `gen-shadcn-form/deno.json`'s import map
pinning the supabase peer.

**What was expected:** That on encountering "incomplete" generator
output, my diagnostic stance would default to reading the cloned
generator's `toString()` template and the manifest's per-item status
*before* proposing consumer-side workarounds.

**Why it matters:** The skill explicitly enumerates this exact failure
mode — *"Stock generator hardcodes X" is almost never a CLI bug; it's
the customization seam in action* — and the operational principles
table has a row mapping "Add a config flag to make X customizable" →
"`skmtc clone` and edit source". Despite that being immediately in
context, I reached for the wrong category of fix. The misfire suggests
the skill's prose was insufficient: it tells you what the customization
seam IS, but doesn't give you a procedural "what to do when you see
partial output" stance.

**Possible fixes:** unresolved — needs reflection. Candidates: (1) a
new section in the `skmtc-generator` skill titled "diagnosing
apparently-skeleton output", with a four-step ritual (read the
cloned `toString()` template → check the manifest per-item statuses →
check peer pins in deno.json → only THEN consider consumer scaffolds);
(2) reordering the existing skill to lead with that diagnostic, since
it's the most common cause of confusion; (3) accept this as a
"defaults from training data are strong" problem and lean on the user
to redirect, which is what happened here.

**Version anchor:** `@skmtc/core@0.6.3`, `@skmtc/cli@0.3.8`,
`@skmtc/gen-shadcn-form@0.0.60`

**Status:** open

---

### 2. `skmtc clone` hardcodes JSR URLs in source instead of bare specifiers [friction]

Discovered after cascading the `@skmtc/core@0.6.3 → 0.6.4` bump through
the generators workspace and updating the cloned project's pins. Every
cloned generator's `deno.json` had a correct import map with bare
specifier → JSR pin mappings (matching canonical), but the **source
files** had hardcoded `jsr:@skmtc/core@0.6.3` URLs everywhere,
completely bypassing the import map.

**What happened:** In `.skmtc/skmtc-reapit/gen-shadcn-table/src/mod.ts`:

```ts
import { isListResponse } from 'jsr:@skmtc/gen-tanstack-query-fetch-zod@0.0.61'
```

But canonical `skmtc-generators/gen-shadcn-table/src/mod.ts` has:

```ts
import { isListResponse } from '@skmtc/gen-tanstack-query-fetch-zod'
```

The canonical relies on the package's own `deno.json` import map to
resolve the bare specifier. The clone duplicated the version into the
source — so a version bump required rewriting 82 files (`@skmtc/core`,
`@skmtc/worker`, peer generators) when the import map *already had*
the mapping.

The user pointed this out:
> `import { isListResponse } from 'jsr:@skmtc/gen-tanstack-query-fetch-zod@0.0.61'` <- is incorrect

After rewriting every cloned source file to use bare specifiers,
version bumps now touch deno.json only.

**What was expected:** That `skmtc clone` would mirror the canonical
generator's source style — bare specifiers in source, version pins
only in the package's deno.json import map. If the JSR registry stores
the source as-published (which preserves bare specifiers — Deno
resolves them at consume time), the clone process should be reading
the source verbatim.

**Why it matters:** Hardcoded versions in source make version bumps
O(files) instead of O(packages). The pattern also masks the fact that
each generator has a self-contained import map — which becomes
load-bearing for the next observation (#3) about local peer mapping.

**Possible fixes:** unresolved — needs investigation into whether the
JSR publish process rewrites bare specifiers to versioned URLs, or
whether `skmtc clone` does the rewriting locally during fetch. The
correct behaviour is to leave source bare and have the clone include a
deno.json with the same import map shape as canonical.

**Version anchor:** `@skmtc/cli@0.3.8`

**Status:** open

---

### 3. Cloned generators pin peers to JSR even when sibling clones exist [friction]

Even after fixing #2 (rewriting source to bare specifiers), the
generator clones still resolved their peers through JSR — because each
clone's `deno.json` mapped `@skmtc/gen-tanstack-query-fetch-zod` to
`jsr:@skmtc/gen-tanstack-query-fetch-zod@0.0.61`, not to the
side-by-side clone at `../gen-tanstack-query-fetch-zod/mod.ts`.

**What happened:** Made the `isListResponse` fix locally in
`.skmtc/skmtc-reapit/gen-tanstack-query-fetch-zod/src/listFns.ts`,
rebundled, and saw the 30 invariant errors persist. Cause: the cloned
`gen-shadcn-table` and `gen-shadcn-select` imported
`isListResponse` via JSR — which served the (still-broken) `0.0.61`
published version, not my local edit. The local edit was a no-op until
the package was republished. I republished, then the user said:

> we should be using local generator reference here and import it via
> deno json.

Rewriting each clone's `deno.json` peer pins to local paths:

```jsonc
{
  "imports": {
    "@skmtc/gen-tanstack-query-fetch-zod": "../gen-tanstack-query-fetch-zod/mod.ts",
    "@skmtc/gen-typescript": "../gen-typescript/mod.ts",
    "@skmtc/gen-zod": "../gen-zod/mod.ts",
    "@skmtc/core": "jsr:@skmtc/core@0.6.4"
  }
}
```

The next rebundle immediately picked up the local `isListResponse`
edit. No republish needed.

**What was expected:** That `skmtc clone` would notice when you're
cloning multiple generators into the same project and wire them to
each other locally — that's the whole point of cloning peers
side-by-side. Pinning them to JSR means you're round-tripping through
the registry for every edit, which defeats the customization workflow.

**Why it matters:** This is the single biggest barrier to fast
iteration when customizing multiple generators in one project. With
JSR peer pins, an `isListResponse` fix required: edit local source →
edit canonical source → patch-bump → release-cascade → wait for JSR
publish → update consumer pins → rebundle. With local peer pins: edit
local source → rebundle. Two commands instead of seven.

**Possible fixes:** unresolved — `skmtc clone` could detect that the
project already has sibling clones of declared peers and write the
local mapping into the new clone's deno.json instead of the JSR URL.
For the inverse case (a generator pinned to JSR but a sibling clone
exists), `skmtc doctor` could flag it.

**Version anchor:** `@skmtc/cli@0.3.8`

**Status:** open

---

### 4. Per-item resource lookup + React Query dedup is the right resource-reference pattern [win]

Codification candidate. Came out of the user's correction during the
operation-reference protocol implementation in `gen-shadcn-table`.

**What happened:** The first implementation of the §3.5
operation-reference protocol for table columns resolved foreign-key
values (e.g. an applicant's `departmentId`) by fetching the LIST
endpoint (`/departments/`) once via `useGetApiDepartments({})` and
matching on `data._embedded[i].id === value`. This works for small
lookup tables (departments has ~10 rows) but fails for larger ones:
offices has 415 rows across 25 pages, and `useGetApiOffices({})` only
returned page 1. Most negotiators referenced offices on later pages,
which showed up as raw id codes in the fallback.

User suggested per-item lookup. Switched the generator: for a column
with `references: '/offices/'`, the generator finds the sibling by-id
operation (`/offices/{id}`), inserts its TanstackQuery hook
(`useGetApiOfficesId`), and emits a small wrapper component:

```tsx
const OfficesIdItemLookupInner = ({ id }: { id: string }) => {
  const { data } = useGetApiOfficesId({ id })
  return <span>{data?.name ?? ...}</span>
}

const OfficesIdItemLookupCell = ({ value }: { value: unknown }) => {
  // dispatch null / array / scalar
  ...
}
```

React Query keys by `({ id })` so the same id requested across many
rows = one network call. Scales to any lookup table size.

**Why it matters:** This is the *general* solution to resource-by-id
columns and it composes naturally with the existing operation-reference
protocol — but the protocol doc only describes list-based resolution.
Per-item lookup is strictly better when the by-id endpoint exists
(which is the Reapit-API-style convention, and broadly the
REST norm). The skill's §3.5 documentation should call this out as the
preferred form, with the list-fetch form being a fallback for list-only
endpoints.

**Possible fixes:** unresolved — candidates: (1) extend the skill's
§3.5 with a "two flavours" subsection (per-item via by-id endpoint vs
whole-list via list endpoint); (2) add a recipe under
`authoring/recipes/` with the two-component pattern (inner that calls
the hook, outer that dispatches over null/array/scalar) shown above.

**Version anchor:** `@skmtc/core@0.6.4`, `@skmtc/gen-shadcn-table@0.0.61`

**Status:** open

---

### 5. `isListResponse` matched scalar-array `/{id}` responses as lists [friction]

Pre-existing bug surfaced when ~30 `/applicants/{id}` /
`/offices/{id}` / etc. endpoints kept erroring with `Invariant
failed: Expected object type`.

**What happened:** `gen-tanstack-query-fetch-zod/src/listFns.ts`
swallowed exceptions in `toListKeyAndItem` and returned `Boolean(schema)`,
which is `true` whenever `toListKeyAndItem` finds *any* array property
on the response object. Reapit's `/applicants/{id}` returns a single
applicant object — but the object contains arrays like
`type: string[]`, `officeIds: string[]`, `related: object[]`.
`toListKeyAndItem` happily returned `{ key: ['type'], schema: <string
items> }`, making `isListResponse` say "yes, this is a list". The
shadcn-table and shadcn-select generators then accepted these
endpoints in `isSupported`, ran `transform`, and threw in the
Projection constructor when `schema.resolve().type !== 'object'`.

Fix in canonical:

```ts
const itemType = schema?.resolve().type
return itemType === 'object'
```

**Why it matters:** The original implementation conflated "found an
array property somewhere" with "this response is a list". The fix is
two lines; the lack of a test case for object responses with scalar
arrays let the bug persist for a long time.

**Possible fixes:** Resolved by the gate. Worth adding a test case
with a singleton-object response containing a scalar array property.

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.0.61` (bug)
→ `0.0.62` (fix)

**Status:** resolved 2026-05-24 (commit `09b227a` in skmtc-generators)

---

### 6. Release script cascade stops at workspace boundary [friction]

Two separate workspaces (`skmtc/deno/` and `skmtc-generators/`) each
have their own `.scripts/release.ts`. Each cascade is intra-workspace
only.

**What happened:** Bumped `@skmtc/core@0.6.3 → 0.6.4`. The
`skmtc/deno` release script correctly cascaded core's bump to
`@skmtc/worker`, `@skmtc/cli`, `@skmtc/server` (intra-workspace
dependents) and published all four. Then ran `deno task release` in
`skmtc-generators/`: "Nothing to publish — every deno.json version is
already on the registry." Because generators pin `@skmtc/core` as a
JSR external, not as a workspace member, the script doesn't see it as
"a workspace dependency was released" and doesn't cascade.

Had to write an ad-hoc Python script to walk every generator's
deno.json, rewrite the `@skmtc/core` pin to `0.6.4` and patch-bump the
generator, then run release.

**What was expected:** That `deno task release` in either workspace
would notice the registry was ahead of any workspace package's pin and
include the bump in the cascade. Or, alternatively, that there's a
documented two-workspace flow with an explicit step for the
boundary-crossing case.

**Why it matters:** The release flow becomes a manual coordination
problem any time `@skmtc/core` changes — which is "any time the engine
gets a new feature". The current cascade design is correct for
intra-workspace cases but blind to the cross-workspace edge.

**Possible fixes:** unresolved — candidates: (1) extend the release
script to query the registry for any external `@skmtc/*` pin that's
behind and offer to bump it (with cascade); (2) add a "cross-workspace
release" how-to under `using/how-to/`; (3) merge the workspaces (not
realistic).

**Version anchor:** release script in `skmtc/deno/.scripts/release.ts`
and `skmtc-generators/.scripts/release.ts`

**Status:** open

---

### 7. Generated `queryFn` dropped all query parameters from the request URL [friction]

`gen-tanstack-query-fetch-zod` emitted hooks that destructured all
query params into the signature but never appended them to the URL.

**What happened:** Generated `useGetApiOffices` had this shape:

```ts
export const useGetApiOffices = ({pageSize, pageNumber, sortBy, ...}) => {
  return useQuery({
    queryKey: ['Offices', pageSize, pageNumber, sortBy, ...],
    queryFn: async () => {
      const res = await apiFetch(`/offices/`, { method: 'GET' })  // no params!
      ...
    }
  })
}
```

`queryKey` correctly included the params so React Query re-keyed on
change, but the URL was always the same — so the response was always
the same. Pagination state changed but no behavioural change visible.

Fix: emit URLSearchParams construction in `queryFn`:

```ts
const search = new URLSearchParams()
Object.entries({ pageSize, pageNumber, ... }).forEach(([k, v]) => {
  if (v === undefined || v === null) return
  Array.isArray(v) ? v.forEach((x) => search.append(k, String(x))) : search.set(k, String(v))
})
const res = await apiFetch(`${path}${search.toString() ? '?' + search.toString() : ''}`, ...)
```

**Why it matters:** This was a silent broken — no error, no warning,
just no observed behaviour. Every consumer of `gen-tanstack-query-
fetch-zod` got broken pagination/filter args until they noticed.

**Possible fixes:** Resolved in this session for the cloned generator
+ canonical. Worth a test that asserts query params appear in the
emitted URL.

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.0.61`

**Status:** resolved 2026-05-24 (gen-tanstack-query-fetch-zod canonical)

---

### 8. `UseMutationOptions` emitted as value import under `verbatimModuleSyntax: true` [friction]

Vite + tsconfig with `verbatimModuleSyntax: true` rejected the
generated service files at runtime: `The requested module
'/@tanstack/react-query' does not provide an export named
'UseMutationOptions'`.

**What happened:** `gen-tanstack-query-fetch-zod/src/MutationEndpoint.ts`
registered the import as:

```ts
'@tanstack/react-query': ['useMutation', 'useQueryClient', 'UseMutationOptions']
```

Emitted as a bare value import:

```ts
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
```

Modern Vite consumers (skmtc-reapit's tsconfig has
`verbatimModuleSyntax: true`) reject this — `UseMutationOptions` is a
type and must be imported via `import type` or `{ name, type: 'type' }`
in the SKMTC register API.

Fixed by tagging:

```ts
['useMutation', 'useQueryClient', { name: 'UseMutationOptions', type: 'type' }]
```

**Why it matters:** This is exactly the
"bare value imports of type-only symbols" anti-pattern called out in
the `skmtc-generator` skill — yet a stock generator was violating it.
Worth a lint pass across all canonical generators for similar issues.

**Possible fixes:** Resolved in cloned + canonical. SKMTC core could
emit a warning during `register` when a TypeScript-only name (one
starting with `Use*Options`, `*Args`, `*Response`, etc.) is registered
without `type: 'type'` — heuristic, but would catch this class of bug.

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.0.61` (bug)

**Status:** resolved 2026-05-24

---

### 9. Reapit API returns `null` for fields the OAS doesn't declare nullable [friction]

The Reapit API treats "unset optional field" as `null` in JSON
responses, but the OAS schema declares those fields only `required:
false`, not `nullable: true`. Strict zod parsing rejects every
response.

**What happened:** OfficesTable lit up the React Query devtools with
this in `state.error`:

```
[
  { "expected": "record", "code": "invalid_type",
    "path": ["_embedded", 0, "_embedded"],
    "message": "Invalid input: expected record, received null" },
  { "expected": "string", "code": "invalid_type",
    "path": ["_embedded", 0, "manager"],
    "message": "Invalid input: expected string, received null" },
  ...
]
```

Every optional field that Reapit returned as `null` failed the zod
parse. `data` was `undefined`; table showed "No results."

Fix in `gen-zod` and `gen-typescript` (`applyModifiers.ts`):

```ts
const reapitModifiers: Modifiers = {
  ...modifiers,
  nullable: modifiers.nullable || !modifiers.required,
}
```

**Why it matters:** This is an API/spec divergence — Reapit's OAS
spec is inaccurate about nullability. The mitigation is consumer-side
generator-level tolerance. But the same pattern likely applies to many
real-world APIs whose specs were written before strict type checking
was popular.

**Possible fixes:** Resolved for this project by editing the cloned
generators. Generalizable as a generator-level "treat optional as
nullable" enrichment knob — could be opt-in per project. Probably
worth a recipe under `authoring/recipes/` titled "handling APIs that
return null for missing optionals".

**Version anchor:** `@skmtc/gen-zod@0.0.60`, `@skmtc/gen-typescript@0.0.62`

**Status:** mitigated 2026-05-24 (cloned generator edits in this project)

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #3 — Cloned generators pin peers to JSR even when sibling clones exist | This single behaviour is the largest barrier to fast iteration when customizing multiple generators in one project. A CLI-level fix would turn a seven-step republish loop into a two-step rebundle for the common case. | SKMTC code change in `skmtc clone`: detect sibling clones and write local pins. Possibly a `skmtc doctor` check. |
| 2 | #2 — `skmtc clone` hardcodes JSR URLs in source instead of bare specifiers | Forces every version bump to rewrite ~100 source files when the deno.json import map already has the mapping. Fixing it makes clones match canonical style. | SKMTC code change in `skmtc clone`'s source-fetch step; investigate whether JSR is serving versioned URLs or the rewriting happens client-side. |
| 3 | #1 — Reflex to ask the user to hand-code around cloned-generator output | When a generator produces partial output, the correct stance is to inspect the cloned `toString()` + manifest first, not propose consumer-side scaffolds. The skill explains the principle but doesn't give a procedural diagnostic recipe. | Add a "diagnosing apparently-skeleton output" section to the `skmtc-generator` skill with a fixed inspection ritual. |
