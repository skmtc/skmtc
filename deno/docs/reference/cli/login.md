# skmtc login

> Validate and store a skmtc-hub personal access token (PAT) — the
> paste-a-PAT, npm-login pattern. The stored token becomes the
> default credential for `skmtc publish`.

The hub's only programmatic credential is a PAT minted in the hub UI
(`Settings → Access tokens`, i.e. `https://skmtc.dev/settings/tokens`;
the `write:releases` scope alone is enough for publishing). `login`
takes that token once, validates it against the hub, and stores it in
`~/.skmtc/auth.json` so subsequent `publish` runs need no `--token`
flag or `$SKMTC_HUB_TOKEN`.

There is no OAuth flow, no localhost callback server, and no browser
automation — the command prints the token-settings URL rather than
opening it (the recommended install grants `--allow-run=deno,sh`
only, so spawning `open` would fail).

## Synopsis

```
skmtc login [--with-token] [--hub-url <url>] [--json] [--no-input]
```

## Options

### `--with-token`

Read the token from stdin instead of prompting (the `gh auth login`
pattern). This is the non-interactive form:

```bash
echo $MY_PAT | skmtc login --with-token
```

An empty stdin fails with a recipe error (exit 2).

### `--hub-url <url>`

Hub API base URL to validate against. Defaults to `$SKMTC_HUB_URL`,
then `https://api.skmtc.dev`. The URL is stored alongside the token
as `host` — `publish` later uses it as its default hub URL whenever
the token comes from the stored file, so a token minted against a
local dev hub is never silently sent to production.

### `--json` / `--no-input`

Standard agent-mode pair. `--json` emits
`{ "kind": "logged-in", "handle": "<handle>" }` on success.

## Behavior

1. **Validation before storage.** The token is checked with
   `GET /v1/user` — the hub allows this for ANY authenticated token
   regardless of scopes (the self-introspection carve-out), so
   least-privilege tokens work. The file is written **only after a
   200**; a rejected token writes nothing and exits 1.
2. **Storage.** `~/.skmtc/auth.json`, mode `0600`, shape
   `{ "host": "<hub api base>", "token": "..." }`. Single-host for
   now; the shape leaves room for a per-host map later.
3. **Already logged in.** Plain `skmtc login` with a stored token
   reports `Logged in as <handle> (token …last4)` instead of
   prompting — this is the `whoami`. To re-login, `skmtc logout`
   first or pipe a new token via `--with-token`.
4. **Interactive prompt.** With a TTY and no `--with-token`, the
   command prints the token-settings URL + scope hint and shows a
   masked input. Output never echoes more than the token's last 4
   characters.
5. **Strict mode without input.** Non-TTY (or `--no-input`) with no
   stored token and no `--with-token` → recipe error, exit 2.

## Token resolution elsewhere

Every hub-token consumer (today: `publish`) resolves the credential
through one helper with this precedence:

1. `--token` flag (explicit beats ambient)
2. `$SKMTC_HUB_TOKEN` (env beats file, so CI overrides a developer login)
3. `~/.skmtc/auth.json` (this command's output)

When the token resolves from the stored file, the file's `host` also
becomes the default hub URL (explicit `--hub-url` / `$SKMTC_HUB_URL`
still win).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Logged in (or already logged in and the stored token validates) |
| `1` | Hub rejected the token (nothing stored), or the stored token no longer validates |
| `2` | Strict mode with no token available (recipe error) |

## Examples

```bash
# Interactive: prints the mint URL, masked paste prompt
skmtc login

# Non-interactive / CI bootstrap
echo $PAT | skmtc login --with-token --json

# Against a local dev hub
skmtc login --hub-url http://localhost:4812

# Status check ("whoami")
skmtc login --json
```

## See also

- [`logout`](logout.md) — delete the stored credential
- [`publish`](publish.md) — the consumer of the stored token
- [`doctor`](doctor.md) — offline `hub-auth` shape check of `auth.json`
