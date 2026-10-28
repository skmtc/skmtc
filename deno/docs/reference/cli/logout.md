# skmtc logout

> Sign out of skmtc-hub: revoke a browser sign-in at identity, and
> delete the stored credential (`~/.skmtc/auth.json`). Idempotent.

## Synopsis

```
skmtc logout [--json]
```

Like `doctor` and `clean`, `logout` has no interactive Ink variant —
it always runs headless.

## Behavior

1. If the stored credential is from the browser sign-in, `logout`
   revokes its refresh token at identity (`/api/auth/oauth2/revoke`).
   Identity then refuses the token everywhere, and the CLI loses access
   until the next `skmtc login`.
2. `logout` deletes `~/.skmtc/auth.json` and reports whether it
   removed a file. It deletes the file also when the revoke fails. Then
   it tells you to revoke the Skmtc CLI in the hub at
   **Settings > Connected apps**.

For a stored personal access token, `logout` only deletes the file.
Revoke the token in the hub at **Settings > Access tokens**.

Running `logout` again (or when never logged in) does nothing and
exits 0. It touches only the stored file: `--token` flags and
`$SKMTC_HUB_TOKEN` are the caller's to manage.

## JSON output

```jsonc
{ "type": "logged-out", "removed": true, "revoked": "revoked" }         // browser sign-in revoked and deleted
{ "type": "logged-out", "removed": true, "revoked": "failed" }          // deleted; revoke in Settings > Connected apps
{ "type": "logged-out", "removed": true, "revoked": "not-applicable" }  // a PAT was deleted
{ "type": "logged-out", "removed": false, "revoked": "not-applicable" } // nothing was stored, still exit 0
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Always (idempotent) |

## See also

- [`login`](login.md) — store a credential
