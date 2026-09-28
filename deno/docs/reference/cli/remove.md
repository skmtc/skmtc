# skmtc remove

> Remove a generator from a project. Undoes `install`, `clone`, or
> `create` — and deletes the local source directory if there is one.

`remove` is the dual of `install`/`clone`/`create`. It strips the
generator's entry from `deno.json#imports` and, when the entry
pointed at a local path (a clone or a local-create), deletes the
source directory under `.skmtc/<project>/<generator>/`. `remove`
does **not** rebundle and does **not** update the Deno lockfile —
the next `generate` rebuilds the bundle and updates the lockfile.

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

Write JSON output to stdout. Implies `--no-input`.

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

The Deno lockfile is not touched by `remove`. Stale entries are
pruned the next time Deno re-resolves imports (e.g., on the next
`bundle` or `generate`).

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

### `remove` does not rebundle

`remove` does not invoke `bundle`. The existing `bundle.js` still
holds the removed generator, but nothing runs it: the next
`skmtc generate` rebuilds the bundle without it.

### Cascading dependencies

If other generators in the project import the removed one (a rare
but possible case), the next `bundle` will fail. The fix is to
either restore the generator (re-install) or update the dependent
generator's source to drop the import.

## JSON output

```jsonc
{
  "projectName": "my-api",
  "removed": "@skmtc/gen-zod"
}
```

The shape matches `RemoveHeadlessResult` in
`cli/lib/remove-headless.ts`:

```ts
export type RemoveHeadlessResult = {
  projectName: string
  removed: string
}
```

That's the entire payload. There is no `command` envelope, no
`source` classification, no `directoryDeleted` field, no `bundle`
field, no `verifyWith` hint. The output reports only *which*
generator was removed from *which* project. Side effects (deno.json
mutation, local source directory delete) are silent — verify them
yourself via `skmtc list <project> --json` and a filesystem check
on `.skmtc/<project>/<generator>/`.

## Examples

### Remove a JSR generator

```bash
skmtc remove my-api @skmtc/gen-zod
```

Removes the import entry. The next `skmtc generate my-api` rebuilds
`bundle.js` without the removed generator.

### Remove a local generator (with source deletion)

```bash
skmtc remove my-api @dgrabov/my-form --json
```

Strict mode. Removes the import entry from `deno.json#imports` and
deletes `.skmtc/my-api/my-form/`. No rebundle is performed; the next
`skmtc generate my-api` rebuilds `bundle.js`.

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
- [Clone vs install concept](../../concepts/clone-vs-install.md) —
  context for the three source kinds
