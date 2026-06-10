# skmtc logout

> Delete the stored skmtc-hub credential (`~/.skmtc/auth.json`).
> Idempotent.

## Synopsis

```
skmtc logout [--json]
```

Like `doctor` and `clean`, `logout` has no interactive Ink variant —
it always runs headless.

## Behavior

Deletes `~/.skmtc/auth.json` and reports whether a file was removed.
Running it again (or when never logged in) is a no-op that still
exits 0. It touches only the stored file — `--token` flags and
`$SKMTC_HUB_TOKEN` are the caller's to manage.

## JSON output

```jsonc
{ "kind": "logged-out", "removed": true }   // a credential was deleted
{ "kind": "logged-out", "removed": false }  // nothing was stored — still exit 0
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Always (idempotent) |

## See also

- [`login`](login.md) — store a credential
