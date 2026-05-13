# Generators as packages

> SKMTC generators are JSR packages with a canonical internal layout.
> Understanding the package structure is the foundation for both
> using generators (install from JSR) and authoring or cloning them
> (where the source lives).

A generator is not a config block in a YAML file or a plugin loaded
through a registry. It's a self-contained TypeScript package
published to JSR. SKMTC's CLI knows how to install, clone, and run
these packages, but the packages themselves are ordinary Deno code.

## The one-paragraph essence

A SKMTC generator is a JSR package (or a local directory mirroring
the same layout). It has a `deno.json` declaring its identity and
peer dependencies, a `mod.ts` that re-exports the entry default, and
a `src/` directory with the actual generator code: an entry function
in `src/mod.ts`, identifier/path conventions in `src/base.ts`,
enrichment schema in `src/enrichments.ts`, the main Projection class,
and any supporting Snippet classes. The CLI's `install` adds the
JSR specifier; `clone` copies the source locally; both write to the
project's `deno.json#imports` and the project's `worker.ts` bundles
all listed generators into a single `bundle.js`.

## Per-generator package layout

The canonical layout for `gen-x`:

```
@skmtc/gen-x/                 ← package root (JSR or local)
├── deno.json                 ← package manifest
├── mod.ts                    ← top-level re-export
└── src/
    ├── mod.ts                ← entry function (toOasOperationEntry, etc.)
    ├── base.ts               ← toIdentifier, toExportPath (the customization seams)
    ├── enrichments.ts        ← Valibot schema for user options
    ├── <MainProjection>.ts   ← the Projection class
    └── <Snippet>.ts          ← supporting Snippet classes (optional, multiple)
```

Each file's role:

### `deno.json`

The package's identity and dependencies:

```json
{
  "name": "@skmtc/gen-x",
  "version": "0.0.55",
  "exports": "./mod.ts",
  "imports": {
    "@skmtc/core": "jsr:@skmtc/core@^0.3.7",
    "@skmtc/worker": "jsr:@skmtc/worker@^0.2.0",
    "@std/path": "jsr:@std/path@^1.0.0",
    "valibot": "jsr:valibot@^0.40.0"
  }
}
```

The `name` matches the JSR scope/package. The `version` follows
semver (informally — many generators are pre-1.0 and use 0.0.x
patches). The `imports` list declares peer dependencies that the
consuming project must also pin compatibly.

### `mod.ts` (top-level)

A thin re-export of the actual entry:

```ts
// gen-x/mod.ts
export { default } from './src/mod.ts'
export * from './src/mod.ts'
```

The package's default export is the generator's entry function. The
re-export shape is so that consumers can `import gen from
'@skmtc/gen-x'` and get the entry function directly.

### `src/mod.ts` (entry)

The function the engine calls to register the generator:

```ts
// gen-x/src/mod.ts
import { toOasOperationEntry } from '@skmtc/core'
import { MyProjection } from './MyProjection.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

const MyGenEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  isSupported({ operation }) {
    return /* boolean: handle this operation? */
  },

  transform({ context, operation }) {
    context.insertOperation({ projection: MyProjection, operation })
  }
})

export default MyGenEntry
```

The entry function selects which `toOasOperationEntry` /
`toGqlOperationEntry` / `toModelEntry` factory based on what the
generator operates on. `isSupported` is the capability gate;
`transform` is the per-item hook.

### `src/base.ts` (projection base)

The `toIdentifier` / `toExportPath` factory — these are the
customization seams when the generator is cloned:

```ts
// gen-x/src/base.ts
import { Identifier, toOasOperationProjectionBase, capitalize, camelCase } from '@skmtc/core'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const MyGenBase = toOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  toIdentifier({ operation }): Identifier {
    // The generator's identifier-naming convention.
    // Hardcoded here on purpose — this is the seam users edit
    // (in a clone) to change names.
    const name = `${capitalize(operation.method)}${camelCase(operation.path, { upperFirst: true })}`
    return Identifier.createVariable(name)
  },

  toExportPath({ operation, enrichments }): string {
    // Where output files land. Must align with consumer's @ alias.
    const { name } = this.toIdentifier({ operation, enrichments })
    return join('@', 'my-gen', `${name}.generated.ts`)
  }
})
```

The hardcoded values in `toIdentifier` and `toExportPath` are
deliberately literal. They're the *primary* clone seams.

### `src/enrichments.ts`

The Valibot schema for user-supplied options. See
[enrichments](enrichments.md).

### `src/<MainProjection>.ts`

The Projection class — the actual code that renders output. Extends
the base from `src/base.ts`. See
[projections and snippets](projections-and-snippets.md).

### `src/<Snippet>.ts` files

Optional. Anonymous Snippet classes used by the Projection. One file
per Snippet is the convention; some generators (like
`gen-shadcn-form`) have a `src/fields/` subdirectory with one
Snippet per field type.

## Peer dependencies

A generator depends on `@skmtc/core` (the engine), `@skmtc/worker`
(the runtime wrapper), and any external runtime libraries it
references in its output (`valibot`, `react`, etc.).

The peer dependencies must be **version-compatible** with the
consuming project's pins. If `gen-x` is built against
`@skmtc/core@^0.3.0` but the project pins `@skmtc/core@^0.2.0`,
bundling will fail with cryptic `No matching export …` errors deep
in `deno bundle` output.

### The peer-pin check

`skmtc clone` performs a pre-flight check that the cloned
generator's `@skmtc/core` peer version matches the project's. On
mismatch, it refuses with exit code 2 and a recipe error pointing at
the canonical remediation. See
[clone vs install](clone-vs-install.md#why-is-there-a-peer-pin-check-on-clone).

`skmtc doctor`'s `project-core-pin/<project>` check surfaces the
same mismatch for already-installed setups.

### Updating peer pins

When a generator updates its `@skmtc/core` pin (e.g., from `^0.2.x`
to `^0.3.x`), every project using the generator needs to:

1. Update its own `@skmtc/core` pin in `deno.json`
2. Run `skmtc bundle` (if the project has clones) or just `skmtc generate` (otherwise)

The CLI doesn't auto-update peer pins on `skmtc install` or
`skmtc clone` — that would risk breaking the project's other
generators. The user resolves peer-pin drift explicitly.

## JSR publishing

Generators are published to JSR. The publish flow is standard Deno:

```bash
cd gen-x/
deno publish
```

JSR resolves the package's exports, runs basic validation, and
makes the package available at `jsr:@skmtc/gen-x@<version>`.

After publish, anyone can install:

```bash
skmtc install @skmtc/gen-x my-project
```

The CLI fetches the latest matching version from JSR and adds it to
the project's `deno.json#imports`.

### Versioning

Generators follow informal semver. Pre-1.0 generators use 0.0.x for
patches, 0.x.0 for minor releases. Once a generator stabilizes, it
typically jumps to 1.0.0 to signal API stability.

Breaking changes in the generator's output shape are not
distinguishable from breaking changes in its peer pins via semver
alone. Both bump the version; the user reads the changelog to know
what changed.

## Local cloning

`skmtc clone <project> -g @skmtc/gen-x`:

1. Fetches the generator's source from JSR (the same content
   `install` would resolve)
2. Writes the source to `.skmtc/<project>/gen-x/`
3. Changes `deno.json#imports` from a JSR specifier to a local path:
   ```json
   { "@skmtc/gen-x": "./gen-x/mod.ts" }
   ```
4. Triggers a post-clone rebundle (the project's `bundle.js` is
   updated)

After cloning, the source is the user's code. JSR is not consulted
at generate time; the local `bundle.js` is loaded by the Worker.

Edits to the cloned source take effect at the next `skmtc bundle`
(or `skmtc dev`, which auto-rebundles on file changes).

## Common questions

### Can a generator depend on another generator?

Yes — many stock generators do. `gen-shadcn-form` depends on
`gen-tanstack-query-supabase-zod` for the mutation hook. The
dependency is declared in `gen-shadcn-form/deno.json#imports` and
imported in `gen-shadcn-form/src/ShadcnForm.ts`.

When you install `gen-shadcn-form`, you need to install the
dependent generator too. The CLI doesn't auto-install transitive
deps — you list them explicitly.

### How does the package version get embedded in the bundle?

`deno.json` is imported at runtime via `import denoJson from
'../deno.json' with { type: 'json' }`. The version is accessible
through `denoJson.version`. Generators use this to stamp output with
their version, or for `id` (which is typically the package name).

### Can I publish a fork of a stock generator?

Yes — just give it a different `name` in `deno.json`. Publish it to
your own JSR scope (`@yourorg/gen-x-customized`). Then other
projects can `skmtc install @yourorg/gen-x-customized`.

This is the path to sharing a customized generator across multiple
projects — see [clone vs install](clone-vs-install.md#can-two-projects-share-a-cloned-generator).

### What's the difference between a generator's `mod.ts` and `src/mod.ts`?

- `mod.ts` (at package root) is the public API — it's what JSR
  treats as `exports`, and what consumers import via `import x from
  '@skmtc/gen-x'`.
- `src/mod.ts` (inside `src/`) is the actual implementation — the
  entry function call (`toOasOperationEntry({ ... })`).

The split keeps the public API thin (it's just a re-export) and the
implementation focused.

### Why JSR and not npm?

JSR is Deno-native, supports TypeScript directly (no compilation
step), and has a simpler version model. SKMTC runs on Deno (the CLI
and Worker are both Deno), so JSR is the natural distribution
channel. There's no inherent reason a generator couldn't be
published to npm with the right tooling, but stock generators don't
do this.

### Are generators sandboxed at the package level?

No. Sandboxing happens at the Worker level (Deno permissions). All
generators in a project's bundle run with the same permissions
inside the same Worker. Per-generator isolation isn't a feature.

If you need to constrain a specific generator's capabilities,
clone-and-audit is the answer.

### Can a generator import third-party npm packages?

Yes, via Deno's npm compatibility layer. The generator's `deno.json`
adds an `npm:` specifier:

```json
{ "imports": { "lodash": "npm:lodash@^4" } }
```

The generator can then `import { ... } from 'lodash'`. The npm
package becomes part of the bundle.

This works but adds bundle size. Generators tend to prefer JSR
dependencies or no dependencies where possible.

## Further reading

- [Clone vs install](clone-vs-install.md) — the customization gradient
- [Projects and workspaces](projects-and-workspaces.md) — where installed and cloned generators live
- [The Worker runtime](the-worker-runtime.md) — how generators get loaded
- [Enrichments](enrichments.md) — how per-generator user options work
- [Projections and Snippets](projections-and-snippets.md) — the DSL the generator implements
- [`skmtc install` reference](../reference/cli/install.md)
- [`skmtc clone` reference](../reference/cli/clone.md)
- [`skmtc-generator` skill](../skills/skmtc-generator/SKILL.md) — operational authoring guidance
