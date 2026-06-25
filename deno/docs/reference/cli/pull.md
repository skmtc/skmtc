# skmtc pull

> Pull a project's config (enrichments + filters) from its skmtc-hub
> **project** down into the local `client.json`.

`pull` is the hub→local counterpart to [`push`](push.md). It fetches an
**existing** hub project's config — the same config the web CMS edits —
and folds it into the local SKMTC project's `client.json`. The read half
of the round-trip: edit enrichments in the hub, `pull` them down,
regenerate locally, commit.

The destination is recorded in `client.json` as the `project` field —
`"@<account>/<slug>"`, the git-remote analog — exactly as for `push`.
Identity (your PAT) is separate from destination (the `project` field) is
separate from authorization (the hub checks you can read the project).

`pull` never creates a project. A `404` means "create the project in the
web app first".

## Synopsis

```
skmtc pull <project> [--project <@account/slug>] [--origin <url>] [--token <pat>] [--force] [--json] [--no-input]
```

## Arguments

### `<project>`

The **local** project name under `.skmtc/<project>/` — the destination to
pull *into*. (Distinct from the `--project` flag, which is the hub source
to pull *from*.)

## Options

### `--project <@account/slug>`

The hub source. Overrides the `project` field in `client.json`. On an
explicit `--project`, the value is written back into `client.json` (the
`git push -u` ergonomic) so later pulls are a bare `skmtc pull`.
Resolution order:

1. `--project` flag
2. `client.json#project`
3. Otherwise a recipe error — `pull` never guesses the account from your
   identity.

### `--token <pat>`

Personal access token. Resolution: `--token` → `$SKMTC_HUB_TOKEN` → the
token stored by [`skmtc login`](login.md). The PAT authenticates you; the
hub authorizes the read against the **source** project (`read:catalog`;
`write:catalog` implies it).

### `--origin <url>`

Hub origin (base URL). Defaults to `$SKMTC_ORIGIN`; then — only when the
token came from the stored `skmtc login` file — the `host` recorded there;
then `https://api.skmtc.dev`.

### `--force`

Skip the overwrite confirmation in a TTY. (In strict/`--json` mode there
is no prompt regardless.)

### `--no-input` / `--json`

See the [overview](overview.md#shared-flags).

## What pull does

```
1. Resolve the source
     --project wins; otherwise client.json#project. Missing → fail at
     stage `destination` before any network call.

2. GET /v1/projects/{account}/{slug}/client-config
     The hub unfolds its flat ProjectConfig into the nested client.json
     `settings` shape. A 404 is decisive: the project doesn't exist —
     create it in the web app first (fail at stage `pull`).

3. Merge into the local client.json (see the field-merge policy below).

4. Write only when the merged config differs from the local file. In a
     TTY (no --force) a change is confirmed first; an unchanged pull is a
     silent no-op (changed: false, nothing written).

5. Write-back (only on an explicit --project)
     Records the source in client.json#project.
```

## Field-merge policy

`pull` is **not** a blind overwrite of the whole file. It replaces the
shared, hub-edited config and **preserves local wiring** that differs per
checkout:

| `client.json` key | On pull |
|---|---|
| `settings.enrichments` | **replaced** from the hub |
| `settings.include` / `settings.skip` | **replaced** from the hub |
| `settings.basePath` | **preserved** (where files land in this checkout) |
| `settings.packages` | **preserved** |
| `settings.inputDirs` | **preserved** (preview discovery dirs are local) |
| `source` | **preserved** (the schema pin — the hub has no `source`) |
| `project` | **preserved** (the remote) |

An **empty** hub value for `enrichments` / `include` / `skip` clears the
local key rather than writing an empty `[]` / `{}`. The merged result is
re-validated through `@skmtc/core`'s `skmtcClientConfig`, whose enrichment
schema is opaque — generator-owned enrichment payloads pass through
untouched.

This is a single-user, last-write-wins merge. Fast-forward + structured
3-way merge on a revision are a later layer (the enrichment-lifecycle
plan); for now, a `pull` overwrites local enrichments with the hub's.

## JSON output

### Success (changed)

```jsonc
{
  "kind": "pulled",
  "projectName": "my-api",
  "project": { "account": "acme-org", "slug": "petstore-client" },
  "origin": "https://api.skmtc.dev",
  "changed": true,
  "wrote": "/abs/path/.skmtc/my-api/.settings/client.json",
  "enrichmentGenerators": 3,
  "remoteWritten": false
}
```

### Success (no-op — already in sync)

```jsonc
{ "kind": "pulled", "projectName": "my-api", "project": { "account": "acme-org", "slug": "petstore-client" },
  "origin": "https://api.skmtc.dev", "changed": false, "wrote": null, "enrichmentGenerators": 3, "remoteWritten": false }
```

`enrichmentGenerators` counts the generator slots carrying enrichments
(excluding the `_stack` scope).

### Aborted (overwrite declined)

```jsonc
{ "kind": "aborted", "projectName": "my-api", "project": { "account": "acme-org", "slug": "petstore-client" } }
```

### Failure

```jsonc
{ "kind": "failed", "projectName": "my-api", "reason": "...", "stage": "pull" }
```

Possible `stage` values:

| Stage | Where the failure happened |
|---|---|
| `read` | No `client.json` for the local project |
| `destination` | No `--project` and no `client.json#project`, or a malformed `@account/slug`. Fails before any network call. |
| `pull` | The source project doesn't exist (`404`), the token isn't authorized (`403`), the response was malformed, or the merged config failed validation |

## Text-mode output

```
Pulled acme-org/petstore-client → "my-api"
  origin: https://api.skmtc.dev
  enrichments: 3 generators
  wrote: /abs/path/.skmtc/my-api/.settings/client.json
```

An in-sync pull prints `Already up to date — "my-api" matches acme-org/petstore-client.`

## Errors

| Status | Meaning |
|---|---|
| `401` | No or invalid token |
| `403` | Not authorized to read the source project |
| `404` | The source project doesn't exist — create it in the web app first |

## Environment variables

| Variable | Purpose | Equivalent flag |
|---|---|---|
| `SKMTC_HUB_TOKEN` | Default PAT | `--token` |
| `SKMTC_ORIGIN` | Default hub origin (base URL) | `--origin` |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Pulled (changed or no-op), or aborted on a declined overwrite |
| `1` | Operational failure at any stage |
| `2` | Missing required argument (recipe error on stderr) |

## Examples

```bash
# Source recorded in client.json#project
skmtc pull my-api

# Pull, then regenerate locally and review the diff
skmtc pull my-api && skmtc generate my-api && git diff

# Agent / CI invocation
SKMTC_HUB_TOKEN=$PAT skmtc pull my-api --json --no-input
```

## See also

- [`push`](push.md) — push a project's config up to the hub (the write half)
- [`generate`](generate.md) — regenerate locally after a pull
- [`login`](login.md) — store the hub PAT + origin
- [overview](overview.md) — shared flags and strict-mode semantics
