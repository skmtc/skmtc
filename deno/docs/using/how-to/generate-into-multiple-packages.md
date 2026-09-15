# How to generate into multiple packages

> Route generated files into separate packages of a monorepo with
> `client.json#settings.packages`. Cross-package imports then render as
> package names, and intra-package imports stay on the `@/` alias.

## When to use this

- Types, validators and clients must land in different workspace
  packages (`packages/types`, `packages/client`), and other packages
  import them by name.
- One generated package must expose subpaths (`@acme/sdk/models`,
  `@acme/sdk/client`) instead of one root barrel.

Most projects do not need this. With no `packages`, every generated
file imports every other file through `@/` from `basePath`.

## Prerequisites

- A SKMTC project whose generators write export paths under the
  package folders you want. Stock generators hardcode paths such as
  `@/types/...`. To put output under `packages/sdk/src/models`, clone
  the generator and
  [change its export paths](../../authoring/how-to/change-export-paths.md).
- A `tsconfig` in each target package that maps `@/*` to that
  package's root. This is the alias convention of a single-package
  project, applied to each package.

## Steps

### Point `basePath` at a common ancestor

When you set `packages`, `basePath` is the folder that holds every
package, usually the monorepo root. Write each `rootPath` forward from
it. The config loader rejects a `rootPath` with a `..` segment, because
that shows `basePath` sits too deep.

```jsonc
{
  "settings": {
    "basePath": ".",
    "packages": [
      { "rootPath": "packages/types", "moduleName": "@acme/types" },
      { "rootPath": "packages/client", "moduleName": "@acme/client" }
    ]
  }
}
```

### List each package root, with the name other files import it by

Each entry is `{ rootPath, moduleName? }`:

- `rootPath` is a **folder**, not a prefix. `packages/sdk` does not
  contain `packages/sdk-legacy`. The form of the path does not matter:
  `./packages/sdk/`, `packages/sdk` and `@/packages/sdk` are one root.
- `moduleName` is what a file **outside** the root writes to import
  from it. Omit it only for a package that no outside file imports. An
  outside import of a root without `moduleName` fails at render.

The order of the array does not matter. The config loader rejects a
root that appears twice in any form, and the workspace root itself
(`.`, `./`, `@/`).

### Nest roots for subpath exports

A root inside another root is a **subpath export** of the outer
package. Files under it share the outer package's `@/` alias. A file
outside the package imports them by the nested root's own
`moduleName`:

```jsonc
{
  "settings": {
    "basePath": ".",
    "packages": [
      { "rootPath": "packages/sdk/src", "moduleName": "@acme/sdk" },
      { "rootPath": "packages/sdk/src/models", "moduleName": "@acme/sdk/models" },
      { "rootPath": "packages/sdk/src/client", "moduleName": "@acme/sdk/client" }
    ]
  }
}
```

With this configuration:

| Importer | Target | Rendered import |
|---|---|---|
| `packages/sdk/src/client/getUser.ts` | `packages/sdk/src/models/User.ts` | `@/models/User.ts` |
| `apps/api/src/routes/users.ts` | `packages/sdk/src/models/User.ts` | `@acme/sdk/models` |
| `apps/api/src/routes/users.ts` | `packages/sdk/src/client/getUser.ts` | `@acme/sdk/client` |
| any file | `zod` | `zod` |

The **outermost** root that holds the target decides whether an import
is intra-package. The **innermost** root's `moduleName` is what an
outside importer writes. Declare each subpath in the package's
`package.json#exports`, so consumers can resolve it.

### Regenerate

```bash
skmtc generate <project>
```

After generation, the CLI removes empty output folders. It never
removes a package root folder, even when a run leaves it empty.

## Verification

Open a generated file that imports across packages and read its
import header:

```bash
cat packages/client/src/getUser.generated.ts
```

Expect a package name for a cross-package target
(`from '@acme/types'`) and an alias path for a same-package target
(`from '@/models/User.generated.ts'`). Some artifacts of one subpath
collapse into one statement. A file that imports three models writes
one `import { … } from '@acme/sdk/models'`.

Then compile the consumer package. A `Module not found` for a package
name means the package's `package.json` does not declare the
`moduleName` (`name`, or an `exports` entry for a subpath).

## Troubleshooting

The config loader rejects the file:

- `package rootPath '…' must be a forward path with no ".." segments`.
  Move `basePath` up to a common ancestor. Then rewrite each `rootPath`
  forward from it.
- `package rootPath '…' is already listed as '…'`. The same folder
  appears twice in a different form. Keep one entry.
- `package rootPath '…' is the workspace root`. A package root is a
  folder below `basePath`. Remove the entry, or remove `packages` to
  import all files through `@/`.

Generation fails at render:

- `Package root '…' has no moduleName, but '…' imports '…' from outside it`.
  A file outside that root needs a name to import it by. Set
  `moduleName`. For a nested root, the message suggests the subpath
  name (`@acme/sdk/models`).
- `'…' is in package root '…' but imports '…', which is under no package root`.
  A file inside a package resolves `@/` from its own root. It cannot
  reach a workspace-root path that no package holds. Add a root that
  holds the target. Or move the target under a root: change the export
  path of the generator that produces it.

## Related

- [client.json reference: `settings.packages`](../../reference/settings/client-json-schema.md#settingspackages-optional-advanced)
- [File routing](../../concepts/projects-and-workspaces.md#how-a-file-is-routed):
  the two meanings of `@` and the routing rules
- [How to change export paths](../../authoring/how-to/change-export-paths.md):
  put a generator's output under a package root
- [File reference](../../reference/api/dsl-file.md): how imports merge
  for each rendered module
