# skmtc project

> Manage **ephemeral, per-branch** hub projects: `fork` a base project for the
> current branch, `rm` it when the branch merges.

The model is the per-PR preview-environment pattern. A long-lived **base**
project (`client.json#project`, e.g. `@acme/petstore-client`) is the canonical
anchor; each git branch forks it into a short-lived project that carries that
branch's enrichment edits:

```
git checkout -b enrich/foo
skmtc project fork my-api            # fork base → @acme/petstore-client-enrich-foo
  …edit enrichments in the fork's rail…
skmtc pull my-api                    # pull the edits into the branch's client.json
git commit && open PR
  …PR merges…
skmtc project rm my-api              # tear the fork down
```

Git is the source of truth; the fork is a transient editing surface.

## `skmtc project fork <project>`

Forks the base project (`client.json#project`) into an ephemeral per-branch
project, **inheriting the base's stack + API bindings** (so a fork is near
zero-config — you don't re-specify the generators or the schema) and **seeding
the fork from the branch's local `client.json`**.

```
skmtc project fork <project> [--as @account/slug] [--visibility private|public] [--base-files] [--origin <url>] [--token <pat>] [--json] [--no-input]
```

What it does:

```
1. Resolve the base       client.json#project (the canonical project). Missing → fail.
2. Resolve the ephemeral  --as @account/slug, else <base-slug>-<git-branch>
                          (branch read from .git/HEAD; sanitized).
3. GET /projects/{base}    inherit stack + stackPin + api + apiPin.
4. POST /projects          create the fork with those bindings (409 = exists → re-seed).
5. PUT …/client-config     seed config (enrichments + filters) from the branch.
6. PUT …/preview/base-files  (only with --base-files — needed for the live preview container).
```

The fork is editable as soon as it exists: descriptors come from the inherited
stack version's shared cache (no per-fork re-deploy), so time-to-editable is
effectively instant. The live preview container is lazy (spun up on demand).

### Options

| Option | Meaning |
|---|---|
| `--as <@account/slug>` | Ephemeral destination. Default: `<base-slug>-<git-branch>`. |
| `--visibility <v>` | `private` (default) or `public`. |
| `--base-files` | Also seed the app tree (only needed for the live preview iframe). |
| `--token` / `--origin` | As for [`push`](push.md) / [`pull`](pull.md). |

### JSON output

```jsonc
{ "kind": "forked", "base": { "account": "acme", "slug": "petstore-client" },
  "ephemeral": { "account": "acme", "slug": "petstore-client-enrich-foo" },
  "branch": "enrich/foo", "created": true, "enrichmentCount": 19,
  "url": "https://…/acme/projects/petstore-client-enrich-foo" }
```

`failed` carries a `stage` of `read` (no base / no branch / can't read config),
`base` (base project missing / unreadable), `create`, or `seed`.

## `skmtc project rm <project>`

Deletes the ephemeral project (same slug `fork` derives — `<base-slug>-<git-branch>`
or `--as`).

```
skmtc project rm <project> [--as @account/slug] [--origin <url>] [--token <pat>] [--json] [--no-input]
```

> **Scope:** deleting a project needs the **`admin:resource`** scope (creating
> only needs `write:catalog`). A token that lacks it gets a `403` with that hint.
> For automation, prefer a typed-ephemeral + TTL/GC story over handing a broad
> delete token to the loop.

```jsonc
{ "kind": "removed", "ephemeral": { "account": "acme", "slug": "petstore-client-enrich-foo" },
  "existed": true }
```

`existed: false` means it was already gone (idempotent). `failed` carries a
`stage` of `read` or `delete`.

## Gotcha — `--token` and `--origin` together

`--origin` only inherits the `skmtc login` store host when the **token came from
the store**. If you pass `--token` explicitly (e.g. an `admin:resource` PAT for
`rm`) against a non-default hub (local / staging), **also pass `--origin`** —
otherwise it defaults to `https://api.skmtc.dev`.

## See also

- [`pull`](pull.md) — pull the fork's edits back into the branch
- [`push`](push.md) — push config to an existing project
- [overview](overview.md) — shared flags
