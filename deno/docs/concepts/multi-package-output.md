# Multi-package output

By default SKMTC writes every generated file under a single root —
`client.json#settings.basePath` — and every cross-file import renders
through one `@/…` alias. **Multi-package output** lets a project route
generated files into *separate packages* of a monorepo (generated
models in one package, generated server or UI code in others) with
cross-package imports that resolve correctly.

The feature is `client.json#settings.packages`. It is first-class in
`@skmtc/core` but easy to miss — without it an agent emits raw
relative imports or assumes cross-package output isn't supported.

## The `packages` setting

```jsonc
{
  "settings": {
    "basePath": "apps/main/src",
    "packages": [
      { "rootPath": "../../packages/models/src", "moduleName": "@app/models" },
      { "rootPath": "../../apps/mock-server/src", "moduleName": "@app/mock-server" }
    ]
  }
}
```

Each entry is a `ModulePackage`: a `rootPath` (where that package's
generated files live) and an optional `moduleName` (its npm/JSR
package name, used when *other* packages import from it).

## How a file is routed into a package

There are two separate resolutions — **where the file lands on disk**
and **how an import to it renders**.

**On disk.** `toResolvedArtifactPath` is just
`join(basePath ?? './', destinationPath.replace(/^@\//, ''))`. The
`@/` prefix is stripped, then joined onto `basePath`. A generator's
`toExportPath` that returns a **`../`-relative** path (no `@/`)
therefore climbs *out* of `basePath` — that is the mechanism for
writing a file into a sibling package. `join` normalises the `..`
segments away, so the result looks like any other path.

**In imports.** `normalizeModuleName` (`dsl/File.ts`) resolves a
cross-file import three ways:

- importer and target in the **same package** → intra-package
  `@/…` (the target's `exportPath` with the package `rootPath`
  replaced by `@`);
- importer and target in **different packages** → the target
  package's `moduleName`;
- **no package match** → the raw `exportPath`.

So `@` is **per-package**, not a single global alias. A file under
`packages/models/src` sees `@/` rooted at that package; a file in
`apps/main/src` importing it gets `@app/models`.

## Hazard: the `..` count is load-bearing and fails silently

To land a file outside `basePath`, `toExportPath` returns a
`../`-relative path. The number of `../` segments must match the depth
of `basePath` under the monorepo root. **A wrong count misplaces every
artifact with no error** — `join` happily normalises
`apps/main/src` + `../../packages/...` to `apps/packages/...` if the
count is short by one.

Worse, the count lives in **two places that must agree**:

1. the `../`-relative prefix returned by `toExportPath`, and
2. `packages[].rootPath`, which `normalizeModuleName` matches against
   the `exportPath` with a raw `startsWith`.

If the `..` count changes in one, it must change in the other in the
same edit, or `normalizeModuleName` silently stops matching and
cross-package imports render as raw paths.

When customising a cloned generator's `toExportPath` to target another
package, derive the `../` prefix from `basePath`'s depth deliberately,
and keep `rootPath` in lockstep.

## Barrels: a re-export-only file

A package usually wants one entry point that re-exports everything it
generated. A barrel does **not** need an accumulator class (see the
`skmtc-generator` skill's "Accumulator-style generator" card) — it is
simply a `File` populated only with re-exports:

```ts
context.register({
  reExports: { [modelExportPath]: [settings.identifier] },
  destinationPath: barrelPath
})
```

`reExports` is `Record<string, Identifier[]>` (module → identifiers);
each identifier's entity type selects `export { x }` vs
`export type { x }`. Multiple generators may `register` re-exports
into the same `destinationPath` — the `File.reExports` map merges
them. A `File` with only `reExports` (no `Definition`s) is a valid
emitted artifact: there is no shared *value*, just a shared file
accumulating re-export entries, so none of the cross-generator
coordination concerns of the accumulator pattern apply.

## See also

- [`projects-and-workspaces.md`](./projects-and-workspaces.md) — the single-`basePath` model
- [`files-and-dedup.md`](./files-and-dedup.md) — the `File` model and import normalisation
- `skmtc-cli` skill §6 — the `client.json` shape
