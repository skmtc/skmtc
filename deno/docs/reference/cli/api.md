# skmtc api

> Manage hub APIs: `publish` adds an OpenAPI document to an API as a
> revision.

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

The command exits `2` when you give no `<file>`, no `--api`, an
`--api` that is not `@account/slug`, or no token. In GitHub Actions,
"no token" also means a job without `id-token: write`.

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

- An admin of the API links the repository on skmtc.dev. The repository
  must be public. The link names the workflow file, and an environment
  if you set one.
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
| `oidc-token`       | GitHub gave no OIDC token: an error, an answer with no token, or no connection. |
| `oidc-exchange`    | The hub gave no linked repository token for the OIDC token. A `403` means that no linked repository matches this workflow run, or that the API does not exist. |

`status` is there when the hub answered. It is not there for
`oidc-token`, because the hub did not answer. `requestId` and `details`
are there when the hub's answer carried them.

## See also

- [`project`](project.md): make a hub project from the local setup
- [`login`](login.md): sign in, so that the command has a token
- [overview](overview.md): shared flags and exit codes
