# What is skmtc-hub

> The hosted service behind `login`, `publish`, `push`, and `pull`:
> accounts own published stacks and the projects that run them. The CLI
> talks to it with a personal access token; execution and deployment
> live on the hub, not in the CLI.

Several CLI commands assume a service called **skmtc-hub** without
introducing it. This page is that introduction: the nouns the hub adds
on top of a local SKMTC workspace, and which command touches which.

None of it is required for local generation. `init`, `install`,
`generate`, `clone` — the whole local loop — work with no account and
no network beyond fetching schemas and packages.

## The nouns

### Account

The owner of everything else — a **user or an org**. Hub names are
scoped the way JSR package names are: `@account/slug`, where the
account may be an org you belong to. Your PAT authenticates *you*; the
hub then authorizes you per account (org membership included).

### Stack

A **published, immutable version of a SKMTC project** — the project's
generator set, built and uploaded as a package. A stack's identity is
the project root `deno.json#name` (`@account/slug`); versions are
semver, and re-publishing an existing version is rejected. Produced by
[`publish`](../reference/cli/publish.md).

### Project (hub project)

The **running side**: a hub project binds a stack version to a
registered API schema and owns execution — deployments, runs, and the
`production` alias, driven from the web app. Its editable config is
the same `client.json` shape the CLI uses locally:
[`push`](../reference/cli/push.md) uploads yours,
[`pull`](../reference/cli/pull.md) fetches the project's. The link
between a local workspace and its hub project is the `project` field
in `client.json` (`"@account/slug"` — the git-remote analog).

### Personal access token (PAT)

The hub's only programmatic credential, minted in the hub UI under
`Settings → Access tokens`. [`login`](../reference/cli/login.md)
validates it and stores it in `~/.skmtc/auth.json`; `publish`, `push`,
and `pull` use it from there (or take `--token` / `$SKMTC_HUB_TOKEN`
directly).

## Which command touches what

| Command | Hub noun | Direction |
| --- | --- | --- |
| [`login`](../reference/cli/login.md) | PAT | store credential locally |
| [`publish`](../reference/cli/publish.md) | stack | local project → new immutable version |
| [`push`](../reference/cli/push.md) | project config | local `client.json` → hub project |
| [`pull`](../reference/cli/pull.md) | project config | hub project → local `client.json` |
| [`project`](../reference/cli/project.md) | project | create / remove a hub project from the local setup |

## The division of labor

The CLI ships bytes; the hub runs them. `publish` never deploys —
it uploads a version. Hub projects pin a version, and deployments,
runs, and promotion to `production` happen in the web app. That split
keeps the CLI's surface small (no deploy flags, no run orchestration)
and keeps everything executable addressable by an immutable stack
version.

## See also

- [`publish`](../reference/cli/publish.md) — stack identity, versioning, and the 409 rule
- [`push`](../reference/cli/push.md) / [`pull`](../reference/cli/pull.md) — config
  ownership in both directions
- [`login`](../reference/cli/login.md) — PAT storage and `--origin`
