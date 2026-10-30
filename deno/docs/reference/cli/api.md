# skmtc api

> Manage hub APIs: `publish` adds an OpenAPI document to an API as a
> revision. `link` makes a link request, so that a GitHub workflow can
> publish to the API.

## `skmtc api publish <file>`

Publishes an OpenAPI document to skmtc-hub as a revision of the API
`@account/slug`. It needs no Skmtc workspace: no `.skmtc` folder, no
`client.json` and no `deno.json`. It runs in any CI.

```
skmtc api publish <file> --api @<account>/<slug> [--visibility public|private] [--origin-url <url>] [--env <env>] [--token <pat>] [--json] [--no-input]
```

The hub stores revisions by content. When the API already has these
bytes, the command adds no revision and reports `deduped`. A publish
does not make a version.

### Create or add

- **Without `--visibility`**, the API must exist. The command adds the
  revision with `POST /v1/apis/{account}/{api}/revisions`. When the API
  does not exist, the command fails with `not-found`. The hub gives the
  same answer when you cannot see the API. A typo in the slug thus never
  makes a new API.
- **With `--visibility`**, the command calls `POST /v1/apis/publish`.
  It makes the API when the API does not exist, or adds a revision when
  it exists. When the API exists with a different visibility, the
  command fails with `conflict`.

### Arguments

|          |                                                                     |
| -------- | ------------------------------------------------------------------- |
| `<file>` | The OpenAPI document, JSON or YAML, relative to the current folder. |

### Options

| Option                  | Meaning                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--api <ref>`           | The hub API as `@account/slug`. Required.                                                                                                                                            |
| `--visibility <v>`      | `public` or `private`. Makes the API when it does not exist.                                                                                                                         |
| `--origin-url <url>`    | The URL where these bytes are available. The command sends it on both routes. The revisions route records it as the revision source. The create route records it once the hub accepts it. It needs `--token`, `$SKMTC_HUB_TOKEN` or `skmtc login`, not a linked repository token. |
| `--token <pat>`         | A personal access token. Without it, the command uses `$SKMTC_HUB_TOKEN`, then the token from `skmtc login`, then, in GitHub Actions, a linked repository token. See [Sign in from GitHub Actions](#sign-in-from-github-actions). |
| `--env <env>`           | As for [`pull`](pull.md).                                                                                                                                                            |

The command exits `2` when you give no `<file>`, no `--api`, or an
`--api` that is not `@account/slug`. Then it reads `<file>`: an
unreadable file fails with `file-unreadable` before any sign-in
request. Only then does it look for a token, and it exits `2` when
there is none. In GitHub Actions, "no token" also means a job without
`id-token: write`.

### Sign in from GitHub Actions

In GitHub Actions, the command needs no stored token. When `--token`,
`$SKMTC_HUB_TOKEN` and `skmtc login` give no token, the command:

1. Gets an OIDC token for the job from GitHub. Its audience is the hub
   API URL, for example `https://api.skmtc.dev`.
2. Sends the OIDC token to the hub. The hub gives a linked repository
   token for this API only. The token expires after 15 minutes.
3. Publishes with the linked repository token.

The command does these steps only when `GITHUB_ACTIONS` is `true`. A
token that you give always wins, and then the command does not get an
OIDC token.

Before the first run:

- An admin of the API links the repository on skmtc.dev. The link names
  the workflow file, and an environment if you set one. The first run of
  the workflow confirms the link. A repository that you rename before
  that run does not match.
- The API must exist. A linked repository token never makes an API, so
  the first publish needs `skmtc login` or a PAT. A `--visibility` that
  is different from the API's visibility fails with `conflict`.
- A linked repository token cannot add a source. With `--origin-url`,
  the command fails with `bad-request` before it gets an OIDC token.
- The job needs the `id-token: write` permission:

```yaml
permissions:
  contents: read
  id-token: write
```

GitHub gives no OIDC token to a job without this permission, or to a
pull request from a fork. Then the command exits `2` and names the
permission. For more about the OIDC token, see
[OpenID Connect](https://docs.github.com/en/actions/reference/security/oidc)
in the GitHub docs.

The command never prints the OIDC token or the linked repository token.

### JSON output

```jsonc
{
  "type": "published",
  "api": { "account": "acme", "slug": "pets" },
  "revision": "1a2b3c4d5e6f",
  "url": "https://skmtc.dev/…",
  "deduped": false,
  "created": true,
  "origin": "https://api.skmtc.dev"
}
```

`created` is `true` when this publish made the API. A failure exits `1`:

```jsonc
{
  "type": "failed",
  "code": "not-found",
  "status": 404,
  "message": "API @acme/pets not found, or you cannot see it. …",
  "requestId": "…",
  "details": [{ "field": "…", "message": "…" }]
}
```

| `code`             | Cause                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| `file-unreadable`  | The command cannot read `<file>`.                                         |
| `bad-request`      | 400: an empty or too-large document, or a slug that is not canonical. Also `--origin-url` with a linked repository token, with no `status`: the command refuses it before any request. |
| `unauthorized`     | 401: the hub refused the token. Run `skmtc login` again.                 |
| `forbidden`        | 403: the token has no `publish:schemas` scope or no write access.        |
| `not-found`        | 404: the API does not exist, or you cannot see it.                       |
| `conflict`         | 409: the visibility is different, or another API has these bytes.        |
| `invalid-document` | 422: the document is not a valid OpenAPI document.                       |
| `network`          | The command cannot reach the hub.                                         |
| `hub-error`        | Another answer from the hub.                                              |
| `oidc-token`       | GitHub gave no OIDC token: an error, an answer with no token, no connection, or no answer in time. |
| `oidc-exchange`    | The hub gave no linked repository token for the OIDC token. A `403` means that no linked repository matches this workflow run, or that the API does not exist. |

A request with no answer in time ends as `network`, or as `oidc-token`
for the request to GitHub. GitHub and the exchange have 20 seconds each,
and the publish has 120 seconds.

`status` is there when the hub answered. It is not there for
`oidc-token`, because the hub did not answer. `requestId` and `details`
are there when the hub's answer carried them.

## `skmtc api link`

Makes a link request on skmtc-hub for the API `@account/slug`, then
opens the request page in the browser. On the page, an admin of the API
checks the values and selects **Link repository**. Then the workflow can
publish with a linked repository token. See
[Sign in from GitHub Actions](#sign-in-from-github-actions).

```
skmtc api link --api @<account>/<slug> [--repo <owner>/<repo>] [--workflow <path>] [--environment <name>] [--no-open] [--env <env>] [--token <pat>] [--json] [--no-input]
```

Run the command in the folder of the repository. It finds the values
for the request:

- **The repository** comes from `git remote get-url origin`. The
  command accepts only a GitHub URL: `https://github.com/<owner>/<repo>`,
  `git@github.com:<owner>/<repo>` or `ssh://git@github.com/<owner>/<repo>`,
  with or without `.git`. `--repo` sets a different repository.
- **The workflow** is the one file in `.github/workflows/` that uses
  `skmtc/publish-action` or runs `skmtc api publish`. `--workflow` sets
  a different file.
- **The environment** is the value of `--environment`. Without it, the
  link accepts a job in any environment.

The request expires after 15 minutes. An API can have 10 open requests.

### Options

| Option                 | Meaning                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--api <ref>`          | The hub API as `@account/slug`. Required.                                                                      |
| `--repo <owner/repo>`  | The GitHub repository. Without it, the command uses the `origin` remote.                                       |
| `--workflow <path>`    | The workflow file, for example `.github/workflows/publish.yml`. It must be a `.yml` or `.yaml` file in `.github/workflows/`. |
| `--environment <name>` | The GitHub environment of the workflow job. The hub trims it and makes it lowercase.                           |
| `--no-open`            | Do not open the browser. The command prints the page.                                                          |
| `--token <pat>`        | A personal access token. Without it, the command uses `$SKMTC_HUB_TOKEN`, then the token from `skmtc login`.   |
| `--env <env>`          | As for [`pull`](pull.md).                                                                                      |

The command exits `2` when:

- you give no `--api`, or an `--api` that is not `@account/slug`;
- there is no `origin` remote, or the remote is not on GitHub;
- no workflow publishes, or two or more workflows publish;
- `--repo` or `--workflow` is not a value that the hub accepts;
- there is no token.

The message names the option that solves the problem. The command
reads git and the workflows before it looks for a token, so it sends
no request in these cases. A linked repository token cannot make a
link request, so the command does not get an OIDC token in GitHub
Actions.

The command opens the browser through `sh`, with `open` on macOS and
`xdg-open` on Linux. It does not open the browser on Windows, with
`--no-open`, or when `GITHUB_ACTIONS` or `CI` is `true`. It opens only
a page on the site of the hub environment. An agent gives `--no-open`.

### JSON output

```jsonc
{
  "type": "requested",
  "api": { "account": "acme", "slug": "pets" },
  "repository": "acme/pets",
  "workflow": ".github/workflows/publish.yml",
  "environment": null,
  "id": "…",
  "url": "https://skmtc.dev/acme/apis/pets/settings?linkRequest=…",
  "expiresAt": "2026-10-30T12:15:00.000Z",
  "origin": "https://api.skmtc.dev",
  "opened": false
}
```

`environment` is `null` when you give no `--environment`. `opened` is
`true` when the command opened the browser. A failure exits `1`, with
the same shape as for `api publish`:

| `code`         | Cause                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| `bad-request`  | 400: the hub refused a value. `details` names it.                               |
| `unauthorized` | 401: the hub refused the token. Run `skmtc login` again.                        |
| `forbidden`    | 403: you are not an admin of the API.                                           |
| `not-found`    | 404: the API does not exist, or you cannot see it.                              |
| `rate-limited` | 429: the API has 10 open requests. Wait 15 minutes, or decline one on the settings page. |
| `network`      | The command cannot reach the hub, or the hub did not answer in 20 seconds.      |
| `hub-error`    | Another answer from the hub.                                                    |

## See also

- [`project`](project.md): make a hub project from the local setup
- [`login`](login.md): sign in, so that the command has a token
- [overview](overview.md): shared flags and exit codes
