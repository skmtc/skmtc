# skmtc push

> Push a local project's `client.json` (config + enrichments) to its
> skmtc-hub **project**.

`push` uploads a local SKMTC project's `client.json` to an **existing**
hub project, where it becomes that project's editable config — the same
flat config the web CMS edits. It is the project-level counterpart to
[`publish`](publish.md): `publish` ships an immutable *stack* version;
`push` updates a *project's* config.

The destination is recorded in `client.json` as the `project` field —
`"@<account>/<slug>"`, the git-remote analog. The account may be a user
**or an org**, and the hub slug can differ from the local
`.skmtc/<dir>` name. Identity (your PAT) is separate from destination
(the `project` field) is separate from authorization (the hub checks
you're a writer on that project) — exactly like git.

`push` never creates a project. Hub projects bind a stack + an API and
are created in the web app; a `404` from `push` means "create the
project first".

## Synopsis

```
skmtc push <project> [--project <@account/slug>] [--origin <url>] [--token <pat>] [--force] [--json] [--no-input]
```

## Arguments

### `<project>`

The **local** project name under `.skmtc/<project>/` — the source to
push *from*. (Distinct from the `--project` flag, which is the hub
destination to push *to*.)

## Options

### `--project <@account/slug>`

The hub destination. Overrides the `project` field in `client.json`.
On an explicit `--project`, the value is written back into
`client.json` (the `git push -u` ergonomic) so later pushes are a bare
`skmtc push`. Resolution order:

1. `--project` flag
2. `client.json#project`
3. Otherwise a recipe error — `push` never guesses the account from
   your identity.

### `--token <pat>`

Personal access token. Resolution: `--token` → `$SKMTC_HUB_TOKEN` →
the token stored by [`skmtc login`](login.md). The PAT authenticates
you; the hub authorizes the write against the **destination** account
(an org member with write access passes).

### `--origin <url>`

Hub origin (base URL). Defaults to `$SKMTC_ORIGIN`; then — only when
the token came from the stored `skmtc login` file — the `host` recorded
there; then `https://api.skmtc.dev`.

### `--force`

Skip the overwrite confirmation in a TTY. (In strict/`--json` mode
there is no prompt regardless — see below.)

### `--no-input` / `--json`

See the [overview](overview.md#shared-flags).

## What push does

```
1. Resolve the destination
     --project wins; otherwise client.json#project. Missing → fail at
     stage `destination` before any network call.

2. GET /v1/projects/{account}/{slug}/config
     The overwrite pre-check. A 404 is decisive: the project doesn't
     exist — create it in the web app first (fail at stage `push`).
     When it already holds config and you're in a TTY without --force,
     push prompts to confirm the overwrite.

3. PUT /v1/projects/{account}/{slug}/client-config
     Sends { source?, settings } from the local client.json. The hub
     folds the nested settings into its flat ProjectConfig and
     overwrites it, returning the result.

4. Write-back (only on an explicit --project)
     Records the destination in client.json#project.
```

`source` in the upload is accepted but ignored — a hub project's
source is its bound API.

## Overwrite behavior

`push` **overwrites** the hub project's config. When the destination
already holds config:

- **Interactive (TTY, no `--force`):** a confirmation prompt — the
  warning. Decline to abort with no change.
- **Strict / `--json` / `--force`:** overwrites without prompting;
  the result carries `"overwroteExistingConfig": true`.

## JSON output

### Success

```jsonc
{
  "kind": "pushed",
  "projectName": "my-api",
  "project": { "account": "acme-org", "slug": "petstore-client" },
  "origin": "https://api.skmtc.dev",
  "enrichmentCount": 12,
  "overwroteExistingConfig": true,
  "remoteWritten": false
}
```

### Aborted (overwrite declined)

```jsonc
{ "kind": "aborted", "projectName": "my-api", "project": { "account": "acme-org", "slug": "petstore-client" } }
```

### Failure

```jsonc
{ "kind": "failed", "projectName": "my-api", "reason": "...", "stage": "push" }
```

Possible `stage` values:

| Stage | Where the failure happened |
|---|---|
| `read` | No `client.json` for the local project |
| `destination` | No `--project` and no `client.json#project`, or a malformed `@account/slug`. Fails before any network call. |
| `push` | The destination project doesn't exist (`404`), the token isn't authorized (`403`), or the `PUT` otherwise failed |

## Text-mode output

```
Pushed "my-api" → acme-org/petstore-client
  origin: https://api.skmtc.dev
  enrichments: 12
  note: replaced existing config
  note: recorded destination in client.json#project
```

## Errors

| Status | Meaning |
|---|---|
| `401` | No or invalid token |
| `403` | Not a writer on the destination project |
| `404` | The destination project doesn't exist — create it in the web app first |

## Environment variables

| Variable | Purpose | Equivalent flag |
|---|---|---|
| `SKMTC_HUB_TOKEN` | Default PAT | `--token` |
| `SKMTC_ORIGIN` | Default hub origin (base URL) | `--origin` |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Pushed, or aborted on a declined overwrite |
| `1` | Operational failure at any stage |
| `2` | Missing required argument (recipe error on stderr) |

## Examples

```bash
# Destination recorded in client.json#project
skmtc push my-api

# First push to an org project (records the destination for next time)
skmtc push my-api --project @acme-org/petstore-client

# Agent / CI invocation
SKMTC_HUB_TOKEN=$PAT skmtc push my-api --json --no-input
```

## See also

- [`publish`](publish.md) — publish an immutable stack version (vs. push a project's config)
- [`login`](login.md) — store the hub PAT + origin
- [overview](overview.md) — shared flags and strict-mode semantics
