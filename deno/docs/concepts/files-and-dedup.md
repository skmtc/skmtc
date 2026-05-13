# Files, deduplication, and integrity

> The `File` class is where output accumulates during Generate. Its
> three maps — `imports`, `reExports`, `definitions` — each carry a
> different dedup rule, and a fourth integrity layer
> (`affirmDefinition` keyed by `generatorKey`) catches the case
> where dedup would otherwise hide a real collision. Together they
> are what lets many generators write into the same file without
> coordinating ahead of time.

A SKMTC run produces a `Map<path, File | JsonFile>` —
`GenerateContext.#files`. Each value holds whatever a Generate-
phase pass put into it. Multiple generators write into the same
file routinely (a form generator and a mutation-hook generator
both contribute to a form's file; a form file imports a model
file's type). The file class is what keeps these concurrent
writers consistent.

This page covers the `File` class shape, how each map dedups, the
`JsonFile` sibling, and the integrity check on top of definitions
that distinguishes "safe reuse" from "collision."

For *who calls these maps*, see
[how-generators-produce-output.md](how-generators-produce-output.md).
For *how the cache key composes with the integrity check*, see
[cross-generator-coordination.md](cross-generator-coordination.md).

## The one-line definition

A `File` carries three maps with three different dedup semantics:
imports dedup by `Set` (multiple registrations of the same import
collapse to one), definitions are first-write-wins via `Map.has`
(later writes of the same name are dropped), and reExports key by
module-then-entity-type then `Set` (same shape as imports, with
the entity split). The integrity layer on top — `affirmDefinition`
checking `generatorKey` — catches the rare case where two
generators independently produce the same definition name in the
same file, which `Map.has`-dedup would silently merge.

## File shape

```ts
// core/dsl/File.ts:101-108
class File {
  path: string
  reExports: Map<string, Record<string, Set<string>>>
  imports: Map<string, Set<string>>
  definitions: Map<string, Definition>
  packages: ModulePackage[] | undefined
}
```

| Map | Shape | Keyed by | Inner dedup |
|---|---|---|---|
| `imports` | `Map<module, Set<name>>` | source module | `Set` of import names |
| `reExports` | `Map<module, { variable: Set<name>, type: Set<name> }>` | source module | entity-type bucket, then `Set` of names |
| `definitions` | `Map<name, Definition>` | definition name | none — `Map.has` gates writes |

The three maps render in fixed order at file serialization time:
re-exports → imports → definitions
(`core/dsl/File.ts:181-214`). Empty sections drop out; non-empty
sections are joined with double newlines.

## The dedup rules

### Imports — `Set.add` collapses repeated registrations

```ts
// core/context/GenerateContext.ts:685-695 (inside register)
Object.entries(imports).forEach(([importModule, importNames]) => {
  const module = currentFile.imports.get(importModule)
  const importItem = new Import({ module: importModule, importNames })
  if (module) {
    importItem.importNames.forEach(n => module.add(`${n}`))
  } else {
    currentFile.imports.set(importModule, new Set(...))
  }
})
```

Two `register({ imports: { 'zod': ['z'] } })` calls on the same
file produce one entry in `Set<'z'>`. At `File.toString()` time
this renders as a single `import { z } from 'zod'` line, not two.

This is what lets a parent Snippet *and* its child Snippets all
register the imports they each need without coordinating — same
module + same name = one final import.

### reExports — keyed by module, split by entity type, then `Set`

```ts
// core/context/GenerateContext.ts:665-683 (inside register)
Object.entries(reExports ?? {}).forEach(([importModule, identifiers]) => {
  if (!currentFile.reExports.get(importModule) && identifiers.length) {
    currentFile.reExports.set(importModule, {})
  }
  identifiers.forEach(identifier => {
    const entityType = identifier.entityType.type   // 'variable' | 'type'
    const module = currentFile.reExports.get(importModule)
    if (!module[entityType]) {
      module[entityType] = new Set()
    }
    module[entityType].add(identifier.name)
  })
})
```

reExports are like imports plus an extra split: each module's
re-exports are bucketed into `variable` (values) and `type`
(type-only). At render time these become separate statements:

```ts
export { DEFAULT_CONFIG } from './models'      // variable bucket
export type { User, Product } from './models'  // type bucket
```

The split exists for `verbatimModuleSyntax: true`, the same
reason `Identifier` carries an `entityType`. Two re-exports of
the same name in different buckets are kept distinct; two
re-exports of the same name in the same bucket dedup via `Set`.

### Definitions — `Map.has` gates writes (first-write-wins)

```ts
// core/context/GenerateContext.ts:697-707 (inside register)
definitions?.forEach(definition => {
  if (!definition) return
  const { name } = definition.identifier
  if (!currentFile.definitions.has(name)) {
    currentFile.definitions.set(name, definition)
  }
})
```

The crucial difference: definitions **are not** added to a `Set`
of "all definitions written so far." They are stored in a
`Map<name, Definition>` keyed by name, and `register` only
inserts if the name isn't already present. Two `register`
calls trying to write a `User` definition in the same file
keep the first one. The second is silently dropped.

This is "first-write-wins" by name. It works for the common case
— a Projection is constructed once via cache miss, its `Definition`
gets registered, subsequent cache hits return the cached one
without re-registering. But it could quietly hide a *real*
collision: two generators independently producing a `User`
definition whose contents differ. The `Map.has` gate would keep
one and drop the other without complaint.

That collision is what the integrity layer catches.

## The integrity layer: `affirmDefinition` + `generatorKey`

The `Map.has` gate is necessary but not sufficient. Two
generators that *both* produce a definition called `User` at
`./models/User.ts` — but for different reasons — would silently
merge under naive dedup. The Drivers (`ModelDriver`,
`OasOperationDriver`, `GqlOperationDriver`) defend against this
with a second check.

Whenever a Driver hits the definition cache (rather than missing
and constructing fresh), it runs `affirmDefinition`:

```ts
// core/dsl/model/ModelDriver.ts:124-144
private affirmDefinition<V extends GeneratedValue>(
  definition: Definition | undefined,
  exportPath: string
): definition is Definition<V> {
  if (!definition) return false

  const currentKey = toModelGeneratorKey({
    generatorId: this.projection.id,
    refName: this.refName
  })

  if (currentKey !== definition.generatorKey) {
    throw new Error(
      `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. ` +
      `Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
    )
  }
  return definition.value instanceof this.projection
}
```

Two checks:

1. **Key match**: the cached definition's `generatorKey` must equal
   the key the current caller would compute. If different,
   **throw**. This means "same name, same file, but different
   generator-and-input combo" is a real collision that fails loudly
   rather than silently merging.
2. **Type match**: the cached definition's value must be an
   instance of the Projection class. If not, return `false` and
   the Driver constructs a fresh definition under the same name
   (which then enters the `Map.has` gate path and is dropped,
   keeping the cached one — this branch is the "structurally
   similar but not the same Projection" fallback).

The integrity layer is what lets the dedup rule stay first-write-
wins without becoming a silent footgun. Genuine reuse — same
generator, same input, same output — passes; accidental collision
— different generator producing the same name — throws.

## The four generator key shapes

`generatorKey` is a branded composite that uniquely identifies a
*generator-and-input* pair. Four shapes
(`core/dsl/GeneratorKeys.ts:170-174`):

| Shape | Format | Created by |
|---|---|---|
| `OasOperationGeneratorKey` | `<generatorId>\|<path>\|<method>` | `toOasOperationGeneratorKey` |
| `GqlOperationGeneratorKey` | `<generatorId>\|<rootKind>\|<fieldName>` | `toGqlOperationGeneratorKey` |
| `ModelGeneratorKey` | `<generatorId>\|<refName>` | `toModelGeneratorKey` |
| `GeneratorOnlyKey` | `<generatorId>` | `toGeneratorOnlyKey` |

The first three are per-item: a generator key identifies "this
generator, for this item." The fourth is generator-wide: used by
Snippets that aren't bound to a specific operation or model
(`gen-typescript`'s variant Snippets — `TsString`, `TsArray`, etc.
— receive a `GeneratorOnlyKey` because the variant itself isn't
keyed by an operation; the parent `TsProjection` is).

The keys are branded `string` types via the `Brand` helper, so
TypeScript can distinguish them at the type level. At runtime
they're plain pipe-delimited strings.

### Reading a "Registered definition mismatch" error

```
Registered definition mismatch: 'createUserBody' in file '@/types/createUserBody.ts'.
Cached key '@my/gen-form|/users|post' does not match new key '@my/gen-zod|/users|post'
```

Decode:

- **Same name** (`createUserBody`) and **same file**
  (`@/types/createUserBody.ts`).
- **Different generator** — `@my/gen-form` produced the cached
  definition; `@my/gen-zod` is now trying to write a different
  definition under the same name in the same file.
- Both keys agree on the operation (`/users|post`), so the
  collision is purely on `generatorId`.

The fix is one of:

1. Change one generator's `toExportPath` so the two land in
   different files.
2. Change one generator's `toIdentifier` so they pick different
   names.
3. Confirm one of the generators is *meant* to defer to the other
   (in which case the second shouldn't be inserting the
   Projection at all — it should be calling `insertOperation` on
   the first generator's Projection).

The error is **loud on purpose**. Silent merging would mean one
generator's output is ignored without anyone noticing. The throw
forces the conflict to surface.

## Cache key vs integrity key

Two different keys, two different jobs:

| | Cache key | Integrity key |
|---|---|---|
| Composed of | `(identifier.name, exportPath)` | `(generatorId, item)` |
| Decides | *whether* to reuse a cached `Definition` | *that* reuse is safe |
| Lives in | `File.definitions: Map<name, Definition>` (keyed by name; file is the outer map) | `Definition.generatorKey` field |
| Pure function of | `(operation, enrichments)` via `toIdentifier` / `toExportPath` | `(generatorId, operation/refName)` |
| Mismatch means | cache miss → construct fresh | name collision between different generators → throw |

The two keys can agree (both "the same generator-and-input pair
under the same `(name, exportPath)`") — the common case, where
reuse is safe. They can also disagree: different generator-and-
input pairs collapse onto the same `(name, exportPath)` because
their `toIdentifier` and `toExportPath` happened to produce the
same outputs. That's the case the integrity key exists to detect.

So the cache key answers "have I seen this `(name, exportPath)`
before?" and the integrity key answers "is the thing I saw the
*same* generator-and-input I'm about to write?" Both must pass
for the Driver to reuse.

## What Drivers do — in one sentence each

The three Drivers (`ModelDriver`, `OasOperationDriver`,
`GqlOperationDriver`) are short orchestrator classes whose
constructor:

1. Computes settings — `identifier`, `exportPath`, `enrichments` —
   by calling the Projection's static methods.
2. Looks up `(identifier.name, exportPath)` in
   `currentFile.definitions`.
3. On **cache miss**: instantiates the Projection
   (`new MyProjection({...})`), wraps the value in a `Definition`
   tagged with the current `generatorKey`, calls
   `context.register({ definitions, destinationPath: exportPath })`.
4. On **cache hit**: runs `affirmDefinition`. If the integrity
   check passes, returns the cached `Definition`. If it fails on
   the key check, throws "Registered definition mismatch."
5. If the caller's file (`destinationPath`) differs from the
   Projection's `exportPath`, also registers an import linking
   them.

The Driver is the unit that makes "same name, same file" mean
"same artifact." Without it, the cache would either be too
permissive (silent merges via `Map.has`) or too strict
(every cache hit rejected without an integrity story). The
Driver's combination of `Map.has`-dedup at the file level and
`generatorKey` integrity at the cache layer is what threads the
needle.

## `JsonFile` — the sibling for JSON output

`File` is for TypeScript. `JsonFile` is its sibling for non-code
output (`core/dsl/JsonFile.ts`):

```ts
class JsonFile {
  fileType: 'json'
  path: string
  content: Record<string, unknown>

  toString(): string {
    return JSON.stringify(this.content, null, 2)
  }
}
```

Only one map (`content`), no dedup story — it's just a JSON
serialization wrapper. `register({ json, destinationPath })` (via
the `RegisterJsonArgs` path on `GenerateContext`) writes to a
`JsonFile`'s `content`. Used for `package.json`, manifests, route
configs, etc.

`GenerateContext.#files: Map<path, File | JsonFile>` holds both;
the type discriminates on `fileType`. Render serializes each
file's `toString()` into `{ path: content }` artifacts.

## Cross-package path translation

`File.toString()` runs each import/reExport module through
`normaliseModuleName` (`core/dsl/File.ts:281-306`). The function
consults the project's `packages: ModulePackage[]` config and
rewrites paths:

- Within the same package: `./packages/types/models/User.ts` →
  `@/models/User.ts` (root path replaced by `@`).
- Across packages: `./packages/types/models/User.ts` →
  `@company/types` (the `moduleName` of the matching package).
- No matching package: returns the original path unchanged.

This is what makes monorepos work — generators can write
relative paths into the file map, and the rendered imports come
out as the right package-name imports for the consumer. See
[clone-vs-install.md](clone-vs-install.md) for the broader
package-customization story.

## Common questions

### Why is the dedup rule for definitions different from imports?

Imports are idempotent: "import `z` from `zod`" said twice is the
same as said once. `Set` collapses them naturally.

Definitions are not idempotent. Two definitions named `User`
might have different bodies. `Set` of definitions couldn't dedup
them (the bodies differ, so the structural identity differs).
The Driver+`generatorKey` design instead says: "if the same
generator-and-input pair tried to write this name twice, that's
expected reuse — drop the second. If two *different*
generator-and-input pairs landed on the same name, that's a
collision — throw."

So the `Map.has` gate is the optimistic path; `affirmDefinition`
is the safety net.

### What happens if I call `register({ definitions })` with a name not in the cache?

`Map.has` is false → insert. No integrity check runs at this
path — `register` doesn't know about `generatorKey`. The integrity
check is on the cache-lookup side (in the Driver, before the
construction-and-register decision).

Most generators don't call `register({ definitions })` directly;
they go through `insertOperation` / `insertModel` /
`insertNormalizedModel`, which delegate to a Driver. Direct
`register` calls bypass the integrity layer entirely. That's
fine for one-off definitions that aren't expected to participate
in cross-generator reuse (a Snippet registering a helper function,
for example).

### Can two generators write the same import from different files into different generated files?

Yes — that's the common case. The form file imports `Z from
'zod'`; the mutation file imports `Z from 'zod'`. They're
separate File instances, each with its own `imports` map. The
`Set`-dedup applies per file, not across files.

### What if I want a definition to deliberately be re-written?

You can't. The `Map.has` gate is the contract. The only way to
"replace" a definition is to either change the name or change the
exportPath so the cache key differs.

In practice this is rarely needed — Drivers handle "construct
once, reuse" automatically, and Snippet authors usually don't
re-register the same name. If you find yourself wanting to
rewrite, double-check that the right path is a different Snippet
or a different identifier.

### What's the difference between `generatorKey` on `Definition` and `generatorKey` on `SnippetBase`?

Same field, same shape. `SnippetBase.generatorKey` is optional
and used as a tag for identification in error messages and logs.
`Definition` extends `SnippetBase` and the Driver populates
`Definition.generatorKey` from the Projection-and-input pair, so
the integrity check has a stable key to compare against.

A Snippet that doesn't need cross-generator coordination can omit
`generatorKey` entirely. Definitions registered via a Driver
always have one.

### Why is `reExports` keyed by entity-type at the inner level?

For `verbatimModuleSyntax: true`. Under that mode, value
re-exports and type re-exports require different statements
(`export { X }` vs `export type { X }`). Keying the inner
structure by entity-type lets the render step produce the right
form per name. The `Identifier.entityType` is the source of
truth for which bucket a name lands in.

### Does `JsonFile` participate in the dedup story?

No — it has only `content`, which is a plain `Record<string,
unknown>`. Multiple writers to the same `JsonFile` overwrite each
other (last-write-wins) unless they shape their writes to merge.
This is intentional: JSON output is usually a single-author
file (a `manifest.json`, a `package.json`); multi-writer JSON
isn't a use case the design optimizes for.

## Further reading

- [How generators produce output](how-generators-produce-output.md)
  — the dispatcher and `register` / `insertOperation` /
  `insertModel` call sites that mutate the maps documented here
- [Cross-generator coordination](cross-generator-coordination.md)
  — the cache-key story (the *coordination* layer; this page is
  the *integrity* layer)
- [Composing output with Stringable](stringable-composition.md) —
  how a `Definition`'s value composes; how Snippet `toString()`
  output gets joined at Render time
- [The three phases](the-three-phases.md) — the Driver lifecycle
  inside the Generate phase
- [Projects and workspaces](projects-and-workspaces.md) — where
  `packages: ModulePackage[]` is configured and how it feeds
  cross-package path translation
- [Reference: glossary](../reference/glossary.md) — `File`,
  `Driver`, `Generator key`, `Definition` entries
