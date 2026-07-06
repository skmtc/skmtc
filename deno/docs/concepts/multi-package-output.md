# Multi-package output

By default SKMTC writes every generated file under a single root —
`client.json#settings.basePath` — and every cross-file import renders through
one `@/…` alias. **Multi-package output** lets a project route generated files
into _separate packages_ of a monorepo (generated models in one package,
generated server or UI code in others) with cross-package imports that resolve
correctly.

The feature is `client.json#settings.packages`. It is first-class in
`@skmtc/core` but easy to miss — without it an agent emits raw relative imports
or assumes cross-package output isn't supported.

## `basePath` has two meanings

`basePath` is the on-disk anchor for generated output. Its precise role depends
on whether `packages` is set:

- **Single-package** (no `packages`): `basePath` is the consumer app's bundler
  `@` alias root — `@/foo` lands at `<basePath>/foo`, and the app's bundler is
  configured so `@` resolves there.
- **Multi-package** (`packages` set): `basePath` is purely _a common on-disk
  ancestor of every package_ — typically the monorepo root. It is **not** a
  bundler alias; `@` is per-package (see below).

## The `packages` setting

Every package is a `{ rootPath, moduleName? }` entry. **`rootPath` is a forward
path** — relative to `basePath`, with no `..` segments. Because `basePath` is a
common ancestor, every package sits forward from it:

```jsonc
{
  "source": "skmtc-hub/packages/api/dist/openapi.json",
  "settings": {
    "basePath": "skmtc-hub",
    "packages": [
      { "rootPath": "packages/models/src", "moduleName": "@skmtc/models" },
      { "rootPath": "apps/mock-server", "moduleName": "@skmtc/mock-server" }
    ]
  }
}
```

`rootPath` is where that package's generated files live — on disk,
`join(basePath, rootPath)`. `moduleName` is its npm/JSR package name, used when
_other_ packages import from it.

> **Forward paths only.** A `rootPath` (or `basePath`) containing a `..` segment
> is **rejected at config load**. A `..` means `basePath` was placed below some
> output location — lift `basePath` to a common ancestor instead. Hand-counting
> `../` segments, and keeping that count in lockstep across config fields, is
> exactly the silent-misplacement footgun the forward-path rule removes.

## How a file is routed

Two resolutions — **where the file lands on disk** and **how an import to it
renders**.

**On disk.** `toResolvedArtifactPath` is `join(basePath, exportPath)`. A
generator targeting a package returns a `toExportPath` that is a forward path
under that package's `rootPath` (e.g. `packages/models/src/User.ts`); joined
onto `basePath` it lands in the right place. No `..`.

**In imports.** `normalizeModuleName` (`dsl/File.ts`) resolves a cross-file
import three ways:

- importer and target in the **same package** → intra-package `@/…` (the
  target's `exportPath` with the package `rootPath` replaced by `@`);
- importer and target in **different packages** → the target package's
  `moduleName`;
- **no package match** → the raw `exportPath`.

So `@` is **per-package**, not a single global alias: a file under
`packages/models/src` sees `@/` rooted at that package; a file in another
package importing it gets `@skmtc/models`.

## Barrels: a re-export-only file

A package usually wants one entry point that re-exports everything it generated.
A barrel does **not** need an accumulator class — it is a `File` populated only
with re-exports:

```ts
context.register({
  reExports: { [modelExportPath]: [settings.identifier] },
  destinationPath: barrelPath,
});
```

`reExports` is `Record<string, Identifier[]>` (module → identifiers); each
identifier's entity type selects `export { x }` vs `export type { x }`. Multiple
generators may `register` re-exports into the same `destinationPath` — the
`File.reExports` map merges them. A `File` with only `reExports` (no
`Definition`s) is a valid emitted artifact: there is no shared _value_, just a
shared file accumulating re-export entries.

## See also

- [`projects-and-workspaces.md`](./projects-and-workspaces.md) — the
  single-`basePath` model
- [`files-and-dedup.md`](./files-and-dedup.md) — the `File` model and import
  normalisation
- `skmtc-cli` skill §6 — the `client.json` shape
