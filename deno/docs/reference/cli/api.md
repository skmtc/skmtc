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
| `--origin-url <url>`    | The URL where these bytes are available. The command sends it on both routes. The revisions route records it as the revision source. The create route records it once the hub accepts it. |
| `--token` / `--env`     | As for [`push`](push.md) / [`pull`](pull.md).                                                                                                                                        |

The command exits `2` when you give no `<file>`, no `--api`, an
`--api` that is not `@account/slug`, or no token.

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
| `bad-request`      | 400: an empty or too-large document, or a slug that is not canonical.    |
| `unauthorized`     | 401: the hub refused the token. Run `skmtc login` again.                 |
| `forbidden`        | 403: the token has no `publish:schemas` scope or no write access.        |
| `not-found`        | 404: the API does not exist, or you cannot see it.                       |
| `conflict`         | 409: the visibility is different, or another API has these bytes.        |
| `invalid-document` | 422: the document is not a valid OpenAPI document.                       |
| `network`          | The command cannot reach the hub.                                         |
| `hub-error`        | Another answer from the hub.                                              |

`status` is there when the hub answered. `requestId` and `details` are
there when its answer carried them.

## See also

- [`project`](project.md): make a hub project from the local setup
- [`login`](login.md): sign in, so that the command has a token
- [overview](overview.md): shared flags and exit codes
