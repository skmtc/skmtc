# skmtc project

> Manage a hub project built from the local setup: `create` a new project, `rm`
> it.

## `skmtc project create <name>`

Creates a **new** hub project named `<name>` from the local project — binding
its stack + API and seeding its config. It is **create-only**: a name clash
fails (use [`push`](push.md) to update an existing project — `push` confirms
before it overwrites). It composes existing hub endpoints; it never silently
updates.

```
skmtc project create <name> [--from <project>] [--stack-version <v>] [--visibility public|private] [--base-files] [--env <env>] [--token <pat>] [--json] [--no-input]
```

What it does:

```
1. Stack    deno.json#name — the local stack, which must already be deployed
            (skmtc deploy). Pinned to `latest`, or --stack-version <v>.
2. API      client.json#api if set. A file client.json#source is then added
            to that API as a revision (POST /v1/apis/{account}/{api}/revisions)
            — schemaStep "revision-added"; an unchanged file adds nothing —
            "unchanged". A URL source is not uploaded — "url-not-uploaded" —
            and the project binds the hub's latest revision of the API, which
            can be older than the document at the URL now. With no source,
            nothing is sent and the project binds that latest revision —
            "no-source".
            Without client.json#api, register client.json#source —
            /v1/apis/upload (a file) or /v1/apis/import (a URL) — and write the
            resulting @account/slug back into client.json#api — "registered".
3. Project  POST /v1/projects binding the two. A 409 (already exists) STOPS the
            command — nothing is overwritten.
4. Seed     PUT …/client-config (config) + …/preview/base-files (--base-files).
5. Record   fills client.json#project + #api when absent (never overwrites an
            existing ref — that's yours).
```

### Arguments

|          |                                                                                               |
| -------- | --------------------------------------------------------------------------------------------- |
| `<name>` | The **new hub project's** slug, or `@account/slug`. A bare slug inherits the stack's account. |

### Options

| Option                 | Meaning                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `--from <project>`     | Local project under `.skmtc/<project>/` to build from. Defaults to the only project when there's exactly one. |
| `--stack-version <v>`  | Pin the stack to an exact stored version. Default: `latest`.                                                  |
| `--visibility <v>`     | `private` (default) or `public`.                                                                              |
| `--base-files`         | Also seed the app tree (needed for the live preview iframe).                                                  |
| `--token` / `--env`    | As for [`push`](push.md) / [`pull`](pull.md).                                                                 |

### JSON output

```jsonc
{
  "type": "created",
  "project": { "account": "acme", "slug": "petstore-sandbox" },
  "stack": "acme/petstore-stack",
  "api": { "account": "acme", "slug": "petstore" },
  "apiRegistered": false,
  "schemaStep": "revision-added",
  "enrichmentCount": 19,
  "remoteWritten": true,
  "url": "https://…/acme/projects/petstore-sandbox"
}
```

`failed` carries a `stage`:

- `read`: no client.json, or a bad name.
- `stack`: no scoped `deno.json#name`.
- `api`: no schema, the register failed, or the schema revision upload failed.
- `create`: **409 → already exists**, or 422 → stack not deployed.
- `seed`.

## `skmtc project rm <name>`

Deletes a hub project.

```
skmtc project rm <name> [--from <project>] [--env <env>] [--token <pat>] [--json] [--no-input]
```

> **Scope:** deleting needs the **`admin:resource`** scope (creating only needs
> `write:catalog`). A token that lacks it gets a `403` with that hint.

`existed: false` means it was already gone (idempotent). `--from` scopes the
account when `<name>` is a bare slug.

## How identity & create-vs-update work

- **Stack** — identity is the explicit `deno.json#name`. The hub creates the
  stack on first `deploy`, appends a version after; you bump
  `deno.json#version`.
- **API** — uploads don't self-identify (the hub can't match a local file to an
  existing API). So `create` records the registered `@account/slug` in
  **`client.json#api`** (like `client.json#project` is the project remote) — a
  re-run reuses it instead of registering a duplicate.
- **Project** — `create` is create-only; **`push` is update** (and asks before
  overwriting). They never share a path, so you can't accidentally clobber a
  project's config by re-running `create`.

## Gotcha — `--token` and `--env` together

The environment comes from the `skmtc login` store only when the token comes
from the store. If you give `--token` (for example an `admin:resource` PAT for
`rm`) for a hub other than production, **also give `--env`**. Else the command
goes to production.

## See also

- [`pull`](pull.md) — pull a project's config back into client.json
- [`push`](push.md) — push config to an existing project (the _update_ path)
- [`deploy`](deploy.md) — deploy the stack the project binds
- [overview](overview.md) — shared flags
