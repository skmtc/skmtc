# skmtc-generator — task cards

Step-by-step cards for multi-step generator jobs. Loaded on demand
from the `skmtc-generator` skill (its §10 carries the trigger index);
the doctrine the cards apply lives in that skill — read it first.
The variants-aware authoring card lives in [`variants.md`](variants.md).

### Card: Cloning and customizing a stock generator

```bash
skmtc clone <project> -g @skmtc/gen-<name>     # see skmtc-cli skill
```

Then: inspect `ls .skmtc/<project>/gen-<name>/src/`, pick the seam
(§7), edit — `src/base.ts` for path/identifier changes,
`src/<Main>.ts` for output shape, `src/enrichments.ts` for new user
options. Iterate with `skmtc dev <project>` (rebundle + regenerate on
save); verify against §9.

### Card: Authoring a new generator from scratch

```bash
skmtc create <project> <gen-name> operation   # or 'model'
skmtc create <project> <gen-name> model --lang kotlin   # Kotlin target
```

`--lang kotlin` (model generators) writes a working BASELINE — the
mechanical wiring (entry, projection base, one projection making a
single router call, `enrichments.ts`, the project `deno.json`
registration) plus a `toKtValue` router typed `SchemaToValueFn` with
**one module per router case** (§6's layout made material). The split
between scaffolded and thrown follows one rule: a case is scaffolded
when Kotlin has one honest answer (`string` → String, `integer` →
Int/Long, `number` → Double/Float, `boolean` → Boolean, `array` →
List<T>, `ref` → the peer declaration's name via `insertModel`,
`object` → `DataClassValue`, a data-class parameter list routing its
properties back through the router), and throws when the answer is a
decision: `union` (sealed hierarchy vs typealias) and `unknown` (no
honest Kotlin type — `Any` is the absence of an answer). So `generate`
is green from the first run, and every subsequent step is an increment
against a working loop. What the baseline deliberately does NOT decide
is the interesting surface — serialization annotations, `format`
policy, enums as `enum class`, nullability and default strategy,
access control, discriminated hierarchies — each left commented at the
router case that owns it, guided by this skill and
`skmtc-lang-kotlin`. In a non-TTY session `create` runs headlessly
from its command-line args.

For TypeScript, then, matching scaffolds A–D: implement `isSupported` in `src/mod.ts`;
`toIdentifierName` / `toIdentifierType` / `toExportPath` in
`src/base.ts` (the lang import here declares the target language);
the Projection in `src/<MainProjection>.ts`; decompose into Snippets
(scaffold E) as needed; always create `src/enrichments.ts` (scaffold
D — `emptyEnrichmentSchema` when there are no user options). Iterate
with `skmtc dev <project>`.

### Card: Recreating a hand-written file

When the target is a single file replacing a hand-written one: a
constant `toExportPath` returning that one path; register every
definition into the one file (same-package peers need no import
wiring); policy seams for whatever the schema cannot express. Whether
the exact filename matters depends on the language's resolution
model: TypeScript imports by filename, so recreating a module
imported by name needs `client.json#settings.generatedSuffix: ""` to
write the exact name — but Kotlin/JVM resolves by package, so keep
the default suffix and let `Dtos.kt` land as `Dtos.generated.kt`;
the app compiles unchanged and the file keeps its engine-owned
marker. The diff against the
hand-written original is the acceptance signal — but only its
*semantic* residue: KDoc prose and declaration ordering are
non-derivable, and formatter territory (trailing commas, line
wrapping, blank-line style) belongs to the consumer's formatter. All
of those are expected to remain in the raw diff; don't chase them.

### Card: Adding a new field type to a form generator

Prerequisite: cloned. Create `src/fields/MyInput.ts` mirroring
`StringInput.ts` (scaffold E); add a branch in
`src/schemaToField.ts` returning it for the relevant schema shape
(specific branches above general); implement the consumer-side
component at the path the Snippet registers.

### Card: Swapping a peer dependency (e.g., HTTP layer)

Prerequisite: consuming generator cloned; replacement peer installed.
Edit the peer import at the top of `src/<MainProjection>.ts` (e.g.
`gen-tanstack-query-supabase-zod` → `gen-tanstack-query-fetch-zod`).
Peer packages exporting same-shaped Projections need no other change.

### Card: Adding enrichment options to a generator

Prerequisite: cloned. Add Valibot fields in `src/enrichments.ts`
(scaffold D); consume via `this.settings.enrichments.subject` in the
constructor; document the keys in
`reference/stock-generators/gen-<name>.md`. Consumers set them under
`client.json#settings.enrichments[gen-id]...`.

### Card: One Projection, several output shapes (orchestrator–delegate)

When output varies by schema or enrichment shape (query vs mutation
hook, create vs edit form), don't accumulate boolean flags and
`if`-cascades in `toString()`. Give the orchestrator ONE field typed
as a union of delegate Snippets, each with its own complete state:

```ts
export class TanstackQuery extends TanstackQueryBase {
  delegate: QueryHook | MutationHook   // each extends SnippetBase

  constructor(args: OasOperationProjectionConstructorArgs) {
    super(args)
    this.delegate = args.operation.method === 'get'
      ? new QueryHook({ /* its own complete state */ })
      : new MutationHook({ /* its own complete state */ })
  }

  override toString() {
    return `${this.delegate}`
  }
}
```

New output shapes become new delegate classes, not new flags. Worked
example: `gen-tanstack-query-supabase-zod/src/TanstackQuery.ts`.


### Card: Emitting a barrel (re-export-only file)

Re-exports flow through the register family as
`Record<string, Identifier[]>` keyed by source module path; each
identifier's kind picks `export { x }` vs `export type { x }`;
entries merge across registering generators.

```ts
// Own file:
this.register({ reExports: { './User.generated.ts': [identifier] } })
// Shared barrel — each contributor registers into it explicitly:
this.registerInto(join('@', 'index.generated.ts'), {
  reExports: { './User.generated.ts': [identifier] }
})
```

A barrel is *not* an accumulator (next card): no aggregate value, no
`defineAndRegister`.

### Card: Accumulator-style generator (one shared aggregate, many contributors)

When the output is a *single* aggregate value that grows as items are
visited (a routes table, a registry), the per-item Projection isn't
the artifact — it contributes into one. Canonical: `gen-msw`'s
`toRoutesList` (`gen-msw/src/mod.ts`):

```ts fragment
import { defineAndRegister } from '@skmtc/lang-typescript'

transform: ({ context, operation }) => {
  // 1. Insert the per-operation artifact normally.
  const insertedRoute = context.insertOperation({
    projection: MockRoute,
    operation
  })
  const { exportPath } = insertedRoute.settings
  const route = insertedRoute.toName()
  if (!route) return

  // 2. Look up the shared aggregate (read-without-register).
  const existing = context.findDefinition({
    name: 'toRoutesList',
    exportPath
  })

  if (existing?.value instanceof MockRoutesList) {
    existing.value.add(route)   // 3a. hit → mutate the existing value
    return
  }

  // 3b. miss → defineAndRegister a fresh aggregate, then add. The
  //     FUNCTION comes from the lang package — a transform is a
  //     closure with no class, so the language comes from the import.
  const routesList = defineAndRegister(context, {
    identifier: createVariable('toRoutesList'),
    value: new MockRoutesList({ context }),
    destinationPath: exportPath
  })
  routesList.value.add(route)
}
```

The aggregate is a `SnippetBase` whose `toString()` renders the full
accumulated value. `findDefinition` + `defineAndRegister` let many
contributors land in one Definition without the Driver path's
cache-key collision rules. Reference:
[`reference/stock-generators/gen-msw.md`](../../reference/stock-generators/gen-msw.md).


## Stock-generator customization seams (cloning reference)

Deliberately hardcoded values marking customization points. To change
them: clone and edit.

| Seam | Location | Customize by |
|---|---|---|
| Export path | `gen-x/src/base.ts` → `toExportPath` | Edit the `join('@', ...)` call — keep the `.generated.*` suffix |
| Identifier naming | `gen-x/src/base.ts` → `toIdentifierName` | Edit the name-building expression — keep a role suffix |
| Peer dependency (e.g., HTTP layer) | `gen-x/src/<Main>.ts` top imports | Swap the import target |
| Consumer-side component path | `gen-x/src/fields/<X>.ts` `register` call | Change the import key |
| Capability gate | `gen-x/src/mod.ts` → `isSupported` | Change the predicate |
| Enrichment schema | `gen-x/src/enrichments.ts` | Add Valibot fields |
| Field-type routing (form generators) | `gen-x/src/schemaToField.ts` | Add a branch (specific above general) |

Enrichments are limited to what each generator's Valibot schema
declares; anything else requires cloning — never suggest "configuring"
a hardcoded value.


> **Runtime coupling — path-param naming.** Generators that read URL
> params (e.g. `gen-shadcn-form`'s `useSafeParams`) hard-code the
> **OpenAPI** path-param name into the generated component. If the
> consumer's router names the param differently (`{id}` vs
> `:invoiceId`), the form throws at mount — confirm the names line up
> (`rg ':<param>' src/router*`) before migrating such output.

> **Targeting another package (monorepo output).** `toExportPath`
> returns a **forward path** under the target package's `rootPath` —
> e.g. `join('packages/models/src', \`${name}.generated.ts\`)` —
> never a `../`-relative path (rejected at config load). The consumer
> declares the package in `client.json#settings.packages`; imports
> then render `@/…` intra-package and `moduleName` cross-package. See
> [`reference/settings/client-json-schema.md`](../../reference/settings/client-json-schema.md).

