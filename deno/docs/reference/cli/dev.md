# skmtc dev

> Watch the project tree and rebundle + regenerate on any change.

The local-development loop for generator authoring. Bundles the
project, generates once, then watches the project's source tree for
changes and re-runs the bundle + generate cycle on each save.

Long-running. No `--json` (the streaming nature of watch mode is
incompatible with single-result output).

## Synopsis

```
skmtc dev <project> [schema]
```

## Arguments

### `<project>`

The project name. Required.

### `[schema]`

Optional schema source. If omitted, resolved from
`client.json#source` (same fallback chain as `generate`).

In strict mode (no TTY), a missing schema fails with the same
recipe error `generate` produces.

## Behavior

### Initial bundle and generate

On start, `dev`:

1. Runs `skmtc bundle <project>` (regenerates `worker.ts` and
   `bundle.js`)
2. Runs the generation pipeline once
3. Reports the result on stdout

After the initial run, `dev` enters watch mode.

### chokidar file watcher

`dev` uses `chokidar` to watch the project tree. The watched
directories:

- `<project>/<gen-name>/src/` — every cloned generator's source
- `<project>/<gen-name>/mod.ts` — re-export files

Ignored:

- `<project>/.settings/` — settings changes don't trigger rebundle;
  they're picked up at the next generate
- `<project>/bundle.js` — derived; can't trigger itself
- `<project>/worker.ts` — derived
- `<project>/**/node_modules/`
- `<project>/**/.git/`

### Debouncing

File changes trigger a rebundle-and-regenerate cycle. To avoid
running the cycle for every keystroke in an editor's autosave loop,
events are debounced:

- 250ms debounce window
- 50ms coalesce tail (new events extending the same cycle)
- Changes during a run are queued, not dropped — the next cycle
  picks them up

### Error handling

Bundle or generation errors:

- Logged to the console with timestamps
- Do **not** exit the watcher
- The watcher continues; fix the source and save again

This matches the typical "dev mode" expectation: errors are
transient; the loop survives.

### Schema source

Same resolution as `generate`:

1. Explicit `[schema]` argument
2. `client.json#source`
3. Interactive prompt (TTY only)

If the schema is a URL, `dev` doesn't poll it — `dev` watches the
generator tree, not the schema. For watching schema URLs, use
`skmtc generate --watch` instead.

## Watch boundaries

What `dev` does and doesn't catch:

| Change | Triggers regeneration? |
|---|---|
| Edit a cloned generator's `src/*.ts` | ✓ |
| Edit `client.json` (enrichments, basePath) | ✗ — pick up at next manual `generate` |
| Edit the schema file on disk | ✗ — use `generate --watch` for this |
| Edit `deno.json#imports` | ✓ via worker.ts regen |
| Add a file to `<project>/<gen-name>/src/` | ✓ |
| Delete a file | ✓ |

## Examples

### Iteration loop for cloned generator development

```bash
# Set up
skmtc clone my-api -g @skmtc/gen-shadcn-form --json
# Edit .skmtc/my-api/gen-shadcn-form/src/...

# Iterate
skmtc dev my-api ./schema.json
# Each save triggers rebundle + regenerate; output appears on stdout
```

### With pinned schema source

```bash
# In client.json, set "source": "./schema.json"
skmtc dev my-api
```

### Tearing down

`Ctrl+C` to exit. No cleanup needed — `bundle.js` and `worker.ts`
remain on disk.

## Performance

Typical bundle + generate cycle:

- Bundle: 200-400ms (deno bundle is fast on cached modules)
- Generate: 50-500ms depending on schema size

Total cycle: ~300ms to ~1s. The debounce window adds 250ms of
overhead before the cycle starts, so save-to-output is roughly
500ms to 1.5s.

## Boundary with `skmtc generate --watch`

| | `skmtc dev` | `skmtc generate --watch` |
|---|---|---|
| Watches | Generator source tree | Schema URL/path |
| Use when | Editing cloned generator code | Schema source changes frequently (e.g., mock server) |
| Rebundles? | Yes, every cycle | No |
| Long-running | Yes | Yes |
| `--json` support | No | Mutually exclusive with `--json` |

The two modes can't run simultaneously today. Choose based on what's
changing.

## Exit codes

`dev` is long-running and exits only on:

| Code | Meaning |
|---|---|
| `0` | User pressed Ctrl+C (or the watcher exited cleanly) |
| `1` | Initial bundle failed (the loop never started) |
| `2` | Required argument missing |

Errors during the watch loop don't exit; they log and the loop
continues.

## See also

- [`skmtc bundle`](bundle.md) — what `dev` does on each cycle
- [`skmtc generate`](generate.md) — non-watch generation; `--watch` for schema-source watching
- [`skmtc clone`](clone.md) — typical entry to `dev` workflow
- [Anatomy of a generator](../../authoring/anatomy-of-a-generator.md) — authoring orientation
