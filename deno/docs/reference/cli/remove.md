# skmtc remove

> Remove a generator from a project. Undoes `install`, `clone`, or
> `create` — and optionally cleans up cloned/local source on disk.

`remove` is the dual of `install`/`clone`/`create`. It strips the
generator's entry from `deno.json#imports`, optionally deletes the
local source directory (for clones and local-creates), and triggers
a rebundle so the worker payload stays consistent.

## Synopsis

```
skmtc remove [project] [generator] [--json] [--no-input]
```

## Arguments

### `[project]`

The target project name. Required in strict mode.

### `[generator]`

The generator name to remove (the import key in
`deno.json#imports`). Required in strict mode.

When unset (and not in strict mode), the CLI prompts with the
project's installed generators.

## Options

### `--no-input`

Disable interactive prompts.

### `--json`

Emit JSON output. Implies `--no-input`.

## Behavior

### `deno.json` imports updated

The CLI removes the matching entry from
`.skmtc/<project>/deno.json#imports`:

```json
// Before:
{
  "imports": {
    "@skmtc/gen-zod": "jsr:@skmtc/gen-zod@^0.0.55",
    "@skmtc/gen-msw": "jsr:@skmtc/gen-msw@^0.0.30"
  }
}

// After (removing @skmtc/gen-zod):
{
  "imports": {
    "@skmtc/gen-msw": "jsr:@skmtc/gen-msw@^0.0.30"
  }
}
```

The Deno lockfile is also updated to drop the removed entry's
pinned version.

### Cloned-source directory handling

When the removed generator's import points at a local path
(`clone` or `create` source), the CLI also deletes the source
directory:

```
.skmtc/<project>/<generator>/   ← deleted
```

This is irreversible. If you have uncommitted changes in the
generator's source, commit them (or move them) before running
`remove`. The CLI does **not** check for git-dirty state.

For JSR (`jsr:` specifier) sources, no source directory exists to
delete — only the import entry is removed.

### Rebundle behavior

If the project still has other clones or local generators after
the removal, the CLI rebundles. If the project is now empty or
remote-only, the rebundle is skipped (the published JSR `bundle.js`
will be used by future `generate` invocations).

Same logic as `install`: bundles exist only when there's local
source to bundle.

### Cascading dependencies

If other generators in the project import the removed one (a rare
but possible case), the rebundle will fail with a clear error:

```
Error: bundle compile failed
  @local/my-form imports '@skmtc/gen-zod' which is no longer in the project
```

The fix is to either restore the generator (re-install) or update
the dependent generator's source to remove the import.

## JSON output

### Removing a JSR-installed generator

```jsonc
{
  "command": "remove",
  "projectName": "my-api",
  "generator": "@skmtc/gen-zod",
  "source": "jsr",
  "directoryDeleted": null,
  "bundle": {
    "kind": "noop",
    "reason": "remote-only"
  },
  "verifyWith": "skmtc list my-api --json"
}
```

### Removing a clone or local generator

```jsonc
{
  "command": "remove",
  "projectName": "my-api",
  "generator": "@local/my-form",
  "source": "local",
  "directoryDeleted": ".skmtc/my-api/my-form",
  "bundle": {
    "kind": "bundled",
    "bundlePath": ".skmtc/my-api/bundle.js"
  },
  "verifyWith": "skmtc list my-api --json"
}
```

### Field reference

- **`source`** — what was removed: `'jsr'`, `'clone'`, or `'local'`.
- **`directoryDeleted`** — path of the removed directory (for
  clone/local), or `null` for JSR.
- **`bundle.kind`** — `'noop'` (no rebundle needed) or `'bundled'`
  (rebuilt after removal).

## Examples

### Remove a JSR generator

```bash
skmtc remove my-api @skmtc/gen-zod
```

Removes the import entry; bundle is unaffected (the source was
remote-only).

### Remove a local generator (with source deletion)

```bash
skmtc remove my-api @local/my-form --json
```

Strict mode. Removes the import entry, deletes
`.skmtc/my-api/my-form/`, and rebundles if other local generators
remain.

### Scripted batch removal

```bash
for gen in @skmtc/gen-msw @skmtc/gen-zod; do
  skmtc remove my-api "$gen" --json
done
```

Or use `skmtc list --json` to discover what's installed first.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — generator removed |
| `1` | Operational failure (filesystem, post-remove bundle failure) |
| `2` | Required argument missing in strict mode |

## Common failure modes

### Generator not found

```
Error: generator '@skmtc/gen-foo' not in project 'my-api'
```

The import key doesn't match anything in `deno.json#imports`. Run
`skmtc list my-api` to see what's actually installed.

### Bundle compile failure after removal

```
Error: post-remove bundle failed: <error from deno bundle>
```

A remaining generator depends on the removed one. The removal
already happened — `deno.json#imports` was updated and the source
directory (if any) was deleted. You're left with an inconsistent
state; either re-install the removed generator or fix the dependent
generator's source.

### Source-directory delete failure

```
Error: failed to delete .skmtc/my-api/my-form: permission denied
```

The `deno.json#imports` removal succeeded but the directory delete
didn't. The generator is "removed" from the project's logical state
but the source files remain. Inspect the directory manually.

## What `remove` does *not* do

- Does **not** remove entries from `client.json` (enrichments,
  paths). Those may now point at a generator that no longer exists,
  which is harmless but cluttered. Manual cleanup if needed.
- Does **not** verify git state — uncommitted changes in a
  clone/local generator's source are deleted with the directory.
- Does **not** undo edits the removed generator made to your
  generated artifacts on previous runs. Those artifacts remain on
  disk; next `generate` may stop producing them, and your tracked
  files will have an unmaintained generator's output until you
  clean it up.

## See also

- [`skmtc install`](install.md) — the inverse for JSR generators
- [`skmtc clone`](clone.md) — the inverse for cloned generators
- [`skmtc create`](create.md) — the inverse for local-created
  generators
- [`skmtc list`](list.md) — verify what's installed before/after
- [`skmtc bundle`](bundle.md) — explicit rebundle if `remove`'s
  rebundle step fails
- [Clone vs install concept](../../concepts/clone-vs-install.md) —
  context for the three source kinds
