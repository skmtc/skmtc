# skmtc login

> Sign in to skmtc-hub in the browser, or store a personal access token
> (PAT) from stdin. The stored token becomes the default credential for
> `publish`, `push`, `pull` and `project`.

`skmtc login` uses the OAuth device authorization grant (RFC 8628). It
prints a link and a code. You open the link, sign in to the hub, check
that the page shows the same code, and approve it. The CLI then stores
the token in `~/.skmtc/auth.json`, so later hub commands need no
`--token` flag or `$SKMTC_HUB_TOKEN`.

The token can create and update APIs, projects and pipelines, publish
schemas, publish stack versions and create deployments
(`write:catalog`, `write:releases`). It stays valid until you revoke it
in the hub at **Settings > Connected apps**: the CLI refreshes it when
it expires.

The command prints the link and does not open a browser: the
recommended install grants `--allow-run=deno,sh` only, so spawning
`open` would fail.

New to the hub? [What is skmtc-hub](../../explanation/what-is-skmtc-hub.md)
introduces the nouns this page assumes (account, stack, project, PAT).

## Synopsis

```
skmtc login [--env production|staging|local] [--with-token] [--json] [--no-input]
```

## Options

### `--env <env>`

The hub environment to sign in to: `production` (the default),
`staging` or `local`. Defaults to `$SKMTC_ENV`, then `production`.

| Env          | API                       | Sign-in                |
| ------------ | ------------------------- | ---------------------- |
| `production` | `https://api.skmtc.dev`   | `https://skmtc.dev`    |
| `staging`    | `https://api.skmtc.net`   | `https://skmtc.net`    |
| `local`      | `https://api.skmtc.co.uk` | `https://skmtc.co.uk`  |

`local` is the skmtc-hub dev stack behind its `skmtc.co.uk` tunnel.
The environment is stored with the token, and later hub commands use
it whenever the token comes from the stored file.

### `--with-token`

Read a personal access token from stdin. The browser sign-in does not
happen (the `gh auth login` pattern). Use it in CI:

```bash
echo $MY_PAT | skmtc login --with-token
```

Mint the token in the hub at **Settings > Access tokens**
(`https://skmtc.dev/settings/tokens`). An empty stdin fails with a
recipe error (exit 2).

### `--json` / `--no-input`

Standard agent-mode pair. `--json` prints each JSON object on a
different line. The browser sign-in prints the code first:

```json
{"type":"device-code","verificationUri":"https://skmtc.dev/login/device","verificationUriComplete":"https://skmtc.dev/login/device?user_code=WDJBMJHT","userCode":"WDJB-MJHT","expiresIn":900}
```

Then, on success:

```json
{"type":"logged-in","env":"production","handle":"<handle>"}
```

The browser sign-in needs no terminal input, so it also runs with
`--no-input`. An agent shows the link and the code to its user and
waits for the command to exit.

## Behavior

1. **Browser sign-in.** The CLI asks identity for a device code. It
   prints the link and the code. Then it polls the token endpoint at the
   interval that identity gives. When identity answers `slow_down`, the
   CLI polls more slowly. The code expires after 15 minutes. A denied or
   expired code exits 1.
2. **Validation before storage.** The token is checked with
   `GET /v1/user`. The hub allows this for any authenticated token
   regardless of scopes, so a least-privilege PAT works. The file is
   written **only after a 200**. A rejected token writes nothing and
   exits 1.
3. **Storage.** `~/.skmtc/auth.json`, mode `0600`, shape
   `{ "env": "<env>", "token": "..." }`. A browser sign-in adds
   `refreshToken` and `expiresAt`. The file holds one login: a sign-in
   to another environment replaces it. An older CLI wrote the shape
   `{ "host", "token" }`. The CLI reads that file and finds the
   environment whose API is `host`.
4. **Refresh.** A token expires after a time. Before a hub command uses
   a stored token, the CLI checks its expiry. If the token expires
   within a minute, the CLI refreshes it and stores the new token. If you revoke the token, the hub refuses
   the refresh. The command then fails with a message to run
   `skmtc login`.
5. **Already logged in.** Plain `skmtc login` with a stored token for
   the same environment reports `Logged in as <handle> (token …last4)`.
   Without `--env` or `$SKMTC_ENV`, the environment is the one stored
   with the login.
   It does not start a new sign-in. This is the `whoami`. To sign in
   again, run `skmtc logout` first, or pipe a new token with
   `--with-token`.

## Token resolution elsewhere

Every hub command (`publish`, `push`, `pull`, `project`) resolves the
credential through one helper with this precedence:

1. `--token` flag (explicit beats ambient)
2. `$SKMTC_HUB_TOKEN` (env beats file, so CI overrides a developer login)
3. `~/.skmtc/auth.json` (this command's output)

The environment is `--env`, then `$SKMTC_ENV`, then (when the token
comes from the stored file) the stored environment, then `production`.
The CLI uses a stored token only for its own environment: with
`--env production` and a stored `local` login, the command has no
token.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Logged in (or already logged in and the stored token validates) |
| `1`  | Sign-in denied or expired, the hub rejected the token (nothing stored), or the stored token no longer validates |
| `2`  | `--with-token` with an empty stdin (recipe error) |

## Examples

```bash
# Sign in to production in the browser
skmtc login

# Sign in to the local dev hub
skmtc login --env local

# Non-interactive / CI bootstrap with a PAT
echo $PAT | skmtc login --with-token --json

# Status check ("whoami")
skmtc login --json
```

## See also

- [`logout`](logout.md) — revoke the sign-in and delete the stored credential
- [`publish`](publish.md) — a consumer of the stored token
- [`doctor`](doctor.md) — offline `hub-auth` shape check of `auth.json`
