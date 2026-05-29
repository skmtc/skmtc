# skmtc deploy

> Build and upload an immutable **deployment** of a project to skmtc-hub.

`deploy` uploads a local SKMTC project to the hub as a new immutable
deployment.
Each invocation creates a new, immutable deployment that the hub
identifies by a UUID and an 8-character `shortId`.

A stack's identity on the hub is **`<authenticated user>/<project>`**.
The PAT picks the account; the project name is the stack slug. There
is no `--stack` flag: the destination is fully determined by who
you're authenticated as and which project you're deploying. (Org-
owned stacks aren't yet reachable from `skmtc deploy`.)

There is also no semver — the deployment's identity is the upload
itself — and no implicit promotion to anything. Promoting a
deployment to your stack's `production` alias is a separate decision
(today via the SPA, later via a `--production` flag).

## Synopsis

```
skmtc deploy <project> --token <pat> [--hub-url <url>] [--json] [--no-input]
```

## Arguments

### `<project>`

The project name under `.skmtc/<project>/`. Required. Doubles as the
stack slug — the deployment lands on the stack `<auth-handle>/<project>`.

## Options

### `--token <pat>`

Personal access token. Required (or set `$SKMTC_HUB_TOKEN`). Mint one
in the SPA's account settings. The PAT also determines the account
half of the stack identity — the CLI looks up your handle with
`GET /v1/user` at deploy time.

### `--hub-url <url>`

Hub base URL. Defaults to `$SKMTC_HUB_URL` or `https://api.skmtc.dev`.

### `--no-input` / `--json`

See the [overview](overview.md#shared-flags).

## What deploy does

```
1. GET /v1/user
     Resolves the PAT to the authenticated user's `handle`. That handle
     is the `account` half of the stack identity; the project name is
     the `slug` half.

2. bundleDeploy(project)
     → <project>/server.js   (one self-contained bundle: the generator
        composition + createServer + @skmtc/server + @skmtc/core, all
        inlined, nothing external)

3. POST /v1/stacks/{handle}/{project}/deployments   (multipart, atomic)
     One `bundle` part (server.js) + N `files` parts (one per project
     source file). The hub allocates id (UUID) + shortId, writes the
     bundle + source to R2, reconciles the stack's stack_generator_refs
     from the uploaded deno.json, and returns the complete Deployment.
```

There is no metadata-only intermediate state — the deploy is atomic
(create + bundle + source in one request). Each step has its own failure
stage in the result envelope (below).

## Strict mode

When `--no-input` or `--json` is set:

- Missing `<project>` or `--token` (and no `$SKMTC_HUB_TOKEN`) → exit
  code 2 with a recipe error on stderr.
- The Ink TUI is skipped; deploy runs straight through `deployHeadless`
  and prints either a one-line text summary or a single JSON object.

## JSON output

### Success

```jsonc
{
  "kind": "deployed",
  "projectName": "my-api",
  "bundlePath": ".skmtc/my-api/server.js",
  "bundleBytes": 1228801,
  "bundleSha256": "e3b0c44298fc1c14...",
  "stack": { "account": "ada", "slug": "my-api" },
  "deploymentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "shortId": "7c9e6679",
  "deploymentUrl": "https://app.skmtc.dev/ada/stacks/my-api/deployments/7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "sourceFileCount": 28,
  "sourceTotalBytes": 96512
}
```

### Failure

```jsonc
{
  "kind": "failed",
  "projectName": "my-api",
  "reason": "deployment create failed (404): Stack not found",
  "stage": "deploy"
}
```

Possible `stage` values:

| Stage | Where the failure happened |
|---|---|
| `identity` | `GET /v1/user` failed — usually a bad PAT |
| `bundle` | `bundleDeploy` — Deno bundling failed locally, or reading the bundle / walking the source tree failed |
| `deploy` | `POST /v1/stacks/.../deployments` failed (commonly: stack doesn't exist yet) |

The deploy is atomic: the deployment row is created with its bundle +
source populated in one request, or not at all. There is no
metadata-only intermediate row, so a dispatchable deployment always has
a bundle.

## Text-mode output

### Success

```
Deployed "my-api" → ada/my-api (7c9e6679)
  bundle: .skmtc/my-api/server.js
  bytes: 1228801
  sha256: e3b0c44298fc1c14...
  source: 28 files, 96512 bytes
  deployment: https://app.skmtc.dev/ada/stacks/my-api/deployments/7c9e6679-...
```

### Failure

```
Deploy failed for "my-api" at deploy:
  POST /v1/stacks/ada/my-api/deployments returned 404: Stack not found
```

## What gets uploaded

### Bundle (one file)

`<project>/server.js` — the compiled CF-Workers entry point produced
by `bundleDeploy`. One self-contained bundle: `@skmtc/core` and
`@skmtc/server` are inlined, nothing external (~1.2 MB).

### Source tree (N files)

Walks `<project>/` and uploads every file except:

- Dotfiles (with the single exception of `.settings/`, which holds
  `client.json`).
- Root-level derived artefacts: `server.ts`, `server.js`, `bundle.js`,
  `worker.ts`.
- Binary asset extensions: `mp4`, `png`, `jpg`, `pdf`, archives, etc.

The hub treats `deno.json` as the source of truth for the stack's
generator composition and reconciles `stack_generator_refs` to match:
imports starting `gen-` that resolve to a `jsr:` specifier become
`imported`; the same prefix resolving to a local path becomes
`cloned`. Mixed states for the same generator name are rejected
(`422 — composition inconsistency`).

## Environment variables

| Variable | Purpose | Equivalent flag |
|---|---|---|
| `SKMTC_HUB_TOKEN` | Default PAT | `--token` |
| `SKMTC_HUB_URL` | Default hub base URL | `--hub-url` |

CLI flags always win over env vars.

## Pre-flight: the stack must already exist

`deploy` does not create stacks. If the destination
`<handle>/<project>` doesn't exist yet, the deploy step
404s. Create the stack first — through the SPA or
`POST /v1/stacks` — then re-run deploy.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — deployment created and bundle + source uploaded |
| `1` | Operational failure at any deploy stage |
| `2` | Missing required argument (recipe error on stderr) |

## Examples

### One-shot deploy

```bash
SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api
```

or

```bash
skmtc deploy my-api --token $SKMTC_HUB_TOKEN
```

### Agent / CI invocation

```bash
SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api --json --no-input
```

### Capture the new shortId in a script

```bash
SHORT=$(SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api --json | jq -r '.shortId')
echo "deployed → $SHORT"
```

## Compared with the previous release-based flow

Before the 2026-05-29 collapse, `deploy` accepted `--stack`,
`--version`, and `--notes`, and created a Release row keyed by
`(stack, version)`. That model is gone. The migration in one
sentence: drop all three flags; the stack is `<authenticated handle>/
<project>`, the deployment's identity is the upload, and there are no
release notes — record context in your VCS commit message instead.

## See also

- [skmtc bundle](bundle.md) — `bundleDeploy` is invoked internally by deploy
- [overview](overview.md) — shared flags and strict-mode semantics
