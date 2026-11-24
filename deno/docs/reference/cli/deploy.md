# skmtc deploy

> Store a new immutable **version** of a project's stack on skmtc-hub,
> then deploy it as a stack server.

`deploy` uploads a local Skmtc project to the hub as a new stack version,
then deploys that version and reports the server status. A stored version
that is not deployed has no use, so one command does both steps. Versions
are addressed by semver and cannot change after the hub stores them.

`deploy` does not move the `production` alias. Hub projects pin a stack
version, and the web app moves the alias.

A stack's identity on the hub is its **package name**: the project root
`deno.json#name`, in `@account/slug` form. The `@account` scope can be a
**user or an org**. The token authenticates you, and the hub authorizes you
as a `writer` on that account and stack (org membership included). The name
is **required**: `deploy` fails with a recipe when `deno.json#name` is
missing or is not a scoped `@account/slug`.

The version comes from the project root `deno.json#version`, or from
`--version`. When the hub already has the `deno.json` version, `deploy`
stores and deploys the next patch after the stack's newest stored version.
For example, when the hub has `0.1.5` and `0.2.0`, `deploy` deploys
`0.2.1`. It compares the versions by semver, and a prerelease does not
count as the newest version.

`deploy` prints `Version 0.1.5 is stored: deploying 0.2.1.` on stderr. It
does not write that version into `deno.json`, because the hub holds the
stack's versions. The next deploy picks the next patch again. `deploy`
never replaces a version that you give with `--version`: when the hub
already has it, `deploy` fails with exit 2.

New to the hub? [What is skmtc-hub](../../explanation/what-is-skmtc-hub.md)
introduces the nouns this page assumes (account, stack, project, PAT).

## Synopsis

```
skmtc deploy <project> --token <pat> [--version <semver>] [--existing] [--env <env>] [--json] [--no-input]
```

## Arguments

### `<project>`

The local project name under `.skmtc/<project>/`. Required. The stack
destination does **not** come from this name. It comes from the project's
`deno.json#name` (`@account/slug`).

## Options

### `--token <pat>`

Personal access token. Resolution order:

1. `--token` flag
2. `$SKMTC_HUB_TOKEN`
3. The token stored by [`skmtc login`](login.md) (`~/.skmtc/auth.json`)

The token needs the `write:releases` scope. Storing the version and
deploying it both use that scope.

### `--version <semver>`

The version to store and deploy, exactly as you give it. When the hub
already stores it, `deploy` fails at stage `exists` with exit 2. Defaults
to the project root `deno.json#version`, which `deploy` replaces with the
next patch when the hub already has it. If neither is present, `deploy` fails before
any network call with a recipe-style error.

### `--existing`

Deploy the version that is already stored on the hub. The CLI does not
check for the version, collect the source or upload it; it only calls the
deploy route. Use it after a deploy that was not confirmed, or after a fix
on the hub. The deploy route is idempotent: a second call deploys the same
version. If an earlier deploy of the version has not finished, the hub
answers `409`; wait a minute, then run it again.

If the hub does not have the version (`404`), the message tells you to run
`skmtc deploy <project>` without `--existing`. A `422` means that the hub
has the version but cannot build it: fix the problem and bump the version.

The commands that failure messages suggest keep this run's `--version` and
`--env`.

### `--env <env>`

The hub environment: `production`, `staging` or `local`. Defaults to
`$SKMTC_ENV`. Then, when the token comes from the stored `skmtc login`
file, the environment in that file. Then `production`. The CLI sends a
stored token only to its own environment. [`login`](login.md#--env-env)
lists the hosts of each environment.

### `--no-input` / `--json`

See the [overview](overview.md#shared-flags).

## What deploy does

```
1. Resolve the version + stack identity (both before any network call)
     `--version` wins; otherwise the project root deno.json#version.
     Missing → fail at stage `version`. The stack `@account/slug` comes
     from deno.json#name; missing or unscoped → fail at stage `identity`.

2. GET /v1/stacks/{account}/{slug}/versions/{version}   (20 s timeout)
     200 for a `--version` version → fail at stage `exists`, exit 2,
     nothing uploaded.
     200 for the deno.json version → read every page of
     GET /v1/stacks/{account}/{slug}/versions (20 s timeout each) and
     pick the next patch after the newest stored release. If the list
     cannot be read, or no stored version is a release, fail at stage
     `version`, exit 1, nothing uploaded.
     Any other answer goes on to step 3 with the version as it is.

3. Collect the source tree and check it
     deno.lock missing → fail at stage `source`. Then choose the
     @skmtc/server pin: the newest published server whose @skmtc/core
     range accepts the project's core. The pin is no newer than the
     CLI's own pin, and no older than 0.2.39, the first server that
     serves every route the hub sends to it. When the registry's
     version list can be read, a yanked version is not chosen.
     The project's core is its exact @skmtc/core pin. For a range, it
     is the version that deno.lock resolves the project's own pin to.
     If deno.lock does not resolve that pin, fail at stage `source`.
     With a local core, the pin is the CLI's version.
     No server accepts the core → fail at stage `source`, before the
     upload. The message says to update the CLI only when a newer CLI
     can help: the core is newer than the CLI's server takes, or the
     CLI's server takes it but is yanked.
     If the CLI's own server cannot be read from the registry
     (an error, or no such version), the pin is the CLI's version, with
     a warning. If that version does not fit and the registry then
     fails, fail at stage `source`.
     If the pin changes, write it to deno.json and print it. Then run
     `deno install` to refresh deno.lock, and collect the tree again.
     A local override (a path, not a jsr: pin) is not changed. A failed
     result carries `serverPin` when the pin changed before the
     failure.

4. POST /v1/stacks/{account}/{slug}/versions   (multipart, atomic)
     One `version` part + one `files` part per source file. The hub
     stores the source and returns the StackVersion. A 409 for a
     `--version` version is the same `exists` failure as step 2. A 409
     for any other version means another deploy stored it first: `deploy`
     picks the next patch again, as in step 2, and uploads once more. A
     second 409 fails at stage `upload`, exit 1.

5. POST /v1/stacks/{account}/{slug}/servers   { "version": "<v>" }
     (120 s timeout) The hub deploys the stored version and returns the
     StackServer. The body never carries `promote`.
```

With `--existing`, steps 2 to 4 do not run.

The CLI uploads source, not a compiled bundle. To deploy a version, the
hub writes its own `server.ts`, which imports `@skmtc/server` through the
uploaded `deno.json`. A version without that import cannot deploy, so
`deploy` adds it. When `deploy` changes `deno.json`, it prints a line on
stderr: commit `deno.json` and `deno.lock`. `deploy` does not change a
local path for `@skmtc/server` (a checkout of the package).

The hub creates the stack on the first deploy, under the `@account` from
`deno.json#name`.

## A version that is stored but not deployed

After step 4 the version is stored, and it cannot change. When the deploy
in step 5 fails, the output says that the version is stored:

| What happened | Output | Exit |
|---|---|---|
| The server status is `error` | `deploy: error` and the `statusReason`. Fix the problem, bump `version`, deploy again. | 1 |
| `400`, `404` or `422` from the deploy | The hub's reason, for example `Stack version '3.0.1' failed to deploy: <reason>`. Fix the problem, bump `version`, deploy again. | 1 |
| `409` from the deploy | An earlier deploy of the version is still running. Wait a minute, then run `skmtc deploy <project> --existing`. | 1 |
| `401` or `403` from the deploy | The hub refused the deploy; the token needs the `write:releases` scope. | 1 |
| Another status from the deploy, for example `503` | The hub's reason. Run `skmtc deploy <project> --existing`. | 1 |
| No answer in 120 s | `deploy not confirmed`. Run `skmtc deploy <project> --existing`. | 1 |
| A `2xx` from the upload that the CLI cannot read | Stage `upload`, `stored: true`. Run `skmtc deploy <project> --existing`. | 1 |

The statuses `deploying`, `idle` and `paused` print as the hub returns
them and exit 0. Only `error` exits 1.

## Strict mode

When `--no-input` or `--json` is set:

- Missing `<project>`, or no token from any source (`--token`,
  `$SKMTC_HUB_TOKEN`, stored `skmtc login`) → exit code 2 with a recipe
  error on stderr.
- The Ink TUI is skipped. `deploy` prints the text summary, or one JSON
  object on stdout.

## JSON output

### Deployed

```jsonc
{
  "type": "deployed",
  "projectName": "my-api",
  "stack": { "account": "ada", "slug": "my-api" },
  // The version that was stored and deployed.
  "version": "3.0.1",
  // true when the deno.json version was stored, so the CLI picked `version`.
  "versionPicked": false,
  // null with --existing: this run uploaded nothing.
  "upload": {
    "sourceHash": "e3b0c44298fc1c14...",
    "versionUrl": "https://skmtc.dev/ada/stacks/my-api/versions/3.0.1",
    "sourceFileCount": 28,
    "sourceTotalBytes": 96512
  },
  // The @skmtc/server pin this run changed in deno.json, or null.
  "serverPin": {
    "package": "@skmtc/server",
    "from": "jsr:@skmtc/server@0.3.34",
    "to": "jsr:@skmtc/server@0.3.33"
  },
  "deploy": {
    "status": "active",
    "statusReason": null,
    "endpointUrl": "https://ada-my-api.deno.dev/api",
    "url": "https://api.skmtc.dev/v1/stacks/ada/my-api/servers/3.0.1"
  }
}
```

A `deploy.status` of `error` carries the reason in `deploy.statusReason`
and exits 1.

### Failure

```jsonc
{
  "type": "failed",
  "projectName": "my-api",
  "reason": "Version 3.0.1 already exists. Bump `version` in deno.json, or run `skmtc deploy my-api --version 3.0.1 --existing` to deploy the stored version.",
  "stage": "exists",
  // true: the version is stored on the hub and cannot change.
  "stored": true
}
```

This is the failure of `skmtc deploy my-api --version 3.0.1` when the hub
already stores `3.0.1`.

Possible `stage` values:

| Stage | Where the failure happened |
|---|---|
| `version` | No version: no `deno.json#version` and no `--version`, before any network call. Or the `deno.json` version is stored and the next patch cannot be picked: the versions list cannot be read, or no stored version is a release. |
| `identity` | No stack name: `deno.json#name` is missing or not a scoped `@account/slug`. Before any network call. |
| `exists` | The `--version` version is already on the hub (the check's `200`, or the upload's `409`). Exit 2. |
| `source` | Reading the source tree failed, `deno.lock` is missing, no published `@skmtc/server` accepts the project's `@skmtc/core`, or `deno install` failed after `deploy` changed the `@skmtc/server` pin. |
| `upload` | `POST /v1/stacks/.../versions` failed with another status, or answered `409` again for the version picked after a `409`. |
| `deploy` | `POST /v1/stacks/.../servers` failed, was refused, or was not confirmed. |

## Text-mode output

### Deployed

```
Stored ada/my-api@3.0.1
  source: 28 files, 96512 bytes
  sourceHash: e3b0c44298fc1c14...
  version: https://skmtc.dev/ada/stacks/my-api/versions/3.0.1
deploy: active
  url: https://api.skmtc.dev/v1/stacks/ada/my-api/servers/3.0.1
  endpoint: https://ada-my-api.deno.dev/api
```

With `--existing`, the first line is `Already stored ada/my-api@3.0.1`.
When the CLI picked the version, a line
`  picked: the deno.json version is stored, so the CLI deployed the next patch`
follows the summary.

### Failure

```
Deploy failed for "my-api" at exists:
  Version 3.0.1 already exists. Bump `version` in deno.json, or run `skmtc deploy my-api --version 3.0.1 --existing` to deploy the stored version.
```

## What gets uploaded

Walks `<project>/` and uploads every file except:

- Dotfiles (with the single exception of `.settings/`, which holds
  `client.json`).
- Root-level derived artifacts: `server.ts`, `server.js`, `bundle.js`,
  `worker.ts`.
- Binary asset extensions: `mp4`, `png`, `jpg`, `pdf`, archives, etc.
- Paths in the project's `.skmtcignore`.

The hub treats `deno.json` as the source of truth for the stack's
generator composition and reconciles it per version: imports starting
`gen-` that resolve to a `jsr:` specifier become `imported`; the same
prefix resolving to a local path becomes `cloned`. Mixed states for the
same generator name are rejected (`422 — composition inconsistency`). The
root `deno.json` must be part of the upload.

## Network isolation

A deployed stack server accepts a `source` URL on `/artifacts` and
`/to-v3-json` and fetches it server-side. The server rejects URLs whose
hostname is a loopback, private, link-local or `.internal`/`.local` name,
and checks every redirect hop again — but it inspects the **hostname
only**. A public name with a private DNS record still resolves and is
fetched, and the fetched body comes back to the caller as the schema.

The control that actually holds is the runtime's network isolation. On the
hub, stack servers run under Deno subhosting, which has no route to an
internal network. **Running a stack server anywhere else requires an egress
policy in front of it** — the hostname check is defense in depth, not a
substitute.

## Environment variables

| Variable | Purpose | Equivalent flag |
|---|---|---|
| `SKMTC_HUB_TOKEN` | Default PAT | `--token` |
| `SKMTC_ENV` | Default hub environment | `--env` |

CLI flags always win over env vars; env vars win over the stored
`skmtc login` credential (so CI can override a developer login).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | The version is stored and deployed, with a status other than `error` |
| `1` | A failure at any stage, a deploy status of `error`, a refused deploy, or a deploy that was not confirmed |
| `2` | Missing required argument, or the `--version` version already exists (recipe error on stderr). A stored `deno.json` version is not exit 2: `deploy` picks the next patch. |

## Examples

### One-shot deploy

```bash
SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api
```

### Agent / CI invocation

```bash
SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api --json --no-input
```

### Deploy again after a deploy that was not confirmed

```bash
skmtc deploy my-api --existing
```

### Read the deploy status in a script

```bash
STATUS=$(SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api --json | jq -r '.deploy.status')
echo "deploy: $STATUS"
```

## `skmtc publish`

`skmtc publish` is the old name of this command. For one release it runs
`deploy` with the same options and exit codes, after one line on stderr:
`` `skmtc publish` is now `skmtc deploy` ``. See [publish](publish.md).

## See also

- [publish](publish.md) — the old name of `deploy`
- [project](project.md) — create a hub project that pins a stack version
- [overview](overview.md) — shared flags and strict-mode semantics
