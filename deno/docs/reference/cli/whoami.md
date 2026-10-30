# skmtc whoami

> Show the skmtc-hub account, the environment and the API origin that a
> hub command such as `api publish` would use, and where its token
> comes from.

## Synopsis

```
skmtc whoami [--env production|staging|local] [--token <pat>] [--json] [--no-input]
```

Run it before `skmtc api publish` to see where the publish goes. A
stored login from `skmtc login --env local` or `--env staging` sends
later hub commands to that environment, unless you set `--env` or
`$SKMTC_ENV`.

## Behavior

1. `whoami` finds the token as every hub command does: `--token`, then
   `$SKMTC_HUB_TOKEN`, then the login stored by `skmtc login`. The
   environment is `--env`, then `$SKMTC_ENV`, then `production`. When
   the token comes from the stored login, its environment comes before
   `production`.
   See [Token resolution elsewhere](login.md#token-resolution-elsewhere).
2. It asks the hub whose token it is, with `GET /v1/user`. The hub
   accepts this for any token, whatever its scopes.
3. It prints the account handle, the environment, the API origin and
   the source of the token.

`whoami` never prints more of the token than its last 4 characters.
It does not do the GitHub Actions OIDC exchange of `api publish`: in a
job without a token, it exits `2`.

## Output

```
Logged in as acme (token …1a2b)
  environment: staging
  origin:      https://api.skmtc.net
  token from:  skmtc login (~/.skmtc/auth.json)
```

`token from` is `--token`, `$SKMTC_HUB_TOKEN` or
`skmtc login (~/.skmtc/auth.json)`.

## JSON output

```json
{
  "type": "whoami",
  "handle": "acme",
  "env": "staging",
  "origin": "https://api.skmtc.net",
  "tokenSource": "stored"
}
```

`tokenSource` is `flag`, `env` or `stored`.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0`  | The hub accepted the token |
| `1`  | The hub refused the token (401 or 403), or answered with an error, or the connection failed. For a stored login, the message tells you to run `skmtc logout`, then `skmtc login` |
| `2`  | No token for the environment (recipe error naming `skmtc login`, `$SKMTC_HUB_TOKEN` and `--token`) |

## See also

- [`login`](login.md): sign in, and how hub commands find the token
- [`api`](api.md): `api publish` names the same origin on every result
- [`logout`](logout.md): delete the stored login
