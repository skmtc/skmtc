# skmtc bundle

> Compile the project's local generators into `bundle.js`.

Regenerates `worker.ts` from `deno.json#imports`, then runs
`deno bundle worker.ts -o bundle.js`. The resulting `bundle.js` is
what the SKMTC Worker loads at generate time.

Every project builds a local bundle — remote-only (all generators
installed from JSR) and hybrid (some cloned) alike. `deno bundle`
resolves `jsr:` specifiers through the project's import map, so the
build is identical either way. (Older CLI versions no-op'd on
remote-only projects on the assumption that a published JSR bundle
would be used at generate time; no such path existed, which left
pure-install projects unable to generate.)

## Synopsis

```
skmtc bundle [project] [--json] [--no-input]
```

## Arguments

### `[project]`

The project name. Required in strict mode.

## Options

### `--no-input`

Disable interactive prompts.

### `--json`

Write JSON output to stdout. Implies `--no-input`.

## Behavior

### worker.ts regeneration

The CLI regenerates `<project>/worker.ts` from the current
`deno.json#imports`. The file is templated as:

```ts
import toWorker from '@skmtc/worker'
import gen1 from '@skmtc/gen-zod'
import gen2 from './gen-typescript/mod.ts'  // local
// ... one import per generator

export default toWorker(() => Object.fromEntries(
  [gen1, gen2].map(g => [g.id, g])
))
```

`worker.ts` is a **derived file**. Hand-edits are lost on the next
bundle.

### deno bundle invocation

After regenerating `worker.ts`, the CLI shells out:

```bash
cd <project>
deno bundle -o bundle.js worker.ts
```

The output is captured to `.settings/logs.txt` (stdout) and
`.settings/error-logs.txt` (stderr). On any non-zero exit from
`deno bundle`, the CLI surfaces the bundle error and exits 1.

### Bundle output

If successful, `<project>/bundle.js` is overwritten with the new
compiled JS. The bundle includes:

- The `@skmtc/worker` runtime
- The `@skmtc/core` engine
- All installed generators' source (JSR + local)
- Any transitive dependencies

Bundle sizes typically range from 1MB to several MB depending on
the number of generators.

### Logs

Two log files are appended (not overwritten) per bundle:

```
.skmtc/<project>/.settings/logs.txt        ← stdout from deno bundle
.skmtc/<project>/.settings/error-logs.txt  ← stderr from deno bundle
```

Useful for debugging bundle failures. Inspect after a failed bundle
run.

## JSON output

### Successful bundle

```jsonc
{
  "type": "bundled",
  "projectName": "my-api",
  "bundlePath": ".skmtc/my-api/bundle.js"
}
```

There is no no-op outcome: a successful run always writes
`bundle.js`. (The former `kind: "noop", reason: "remote-only"` result
was removed along with the remote-only special case.)

## Examples

### Basic bundle

```bash
skmtc bundle my-api
```

### Agent / CI invocation

```bash
skmtc bundle my-api --json --no-input
```

### Verify success

```bash
skmtc bundle my-api --json | jq '.kind'
# "bundled"
```

## When to run bundle explicitly

The CLI runs `bundle` automatically after `skmtc clone` and after
`skmtc install`. So in normal workflows, manual `bundle` is rarely
needed.

Explicit bundle is useful when:

- **You hand-edited `deno.json`** to change a generator pin or path
  without going through the CLI. The auto-rebundle didn't run.
- **You hand-edited a cloned generator's source.** The watch loop
  (`skmtc dev`) is the better answer, but if you don't want a
  watch, `skmtc bundle` rebuilds once.
- **CI setup.** Pre-warming the bundle before running `generate` —
  though `generate` will trigger a freshness check anyway.

## Bundle freshness gate

Strict-mode `generate` checks that the on-disk `bundle.js` matches
the current `deno.json#imports`. If they've drifted, `generate`
refuses with a recipe error pointing at `skmtc bundle`. See
[generate reference](generate.md#bundle-freshness-gate-strict-mode).

The `skmtc doctor` command surfaces freshness as
`project-bundle/<project>`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — bundle written |
| `1` | `deno bundle` failed (check `.settings/error-logs.txt`) |
| `2` | Required argument missing |

## Common failure modes

### Peer-dependency version skew

```
error: No matching export … for import "SnippetBase"
```

The cloned generator's `@skmtc/core` peer doesn't match the
project's pin. Run `skmtc doctor --json` and look at the
`project-core-pin/<project>` check. Fix the pin in `deno.json`, then
re-run bundle.

### Missing transitive peer

```
error: Module not found "@std/path"
```

A peer dep declared by the cloned generator isn't in the project's
`deno.json`. Add it manually.

## See also

- [`skmtc clone`](clone.md) — auto-rebundles after clone
- [`skmtc install`](install.md) — auto-rebundles for hybrid projects
- [`skmtc dev`](dev.md) — bundle + regenerate on file changes
- [`skmtc generate`](generate.md) — uses the bundle at run time
- [the-worker-runtime concept](../../concepts/the-worker-runtime.md) — what the bundle is for
- [generators-as-packages concept](../../concepts/generators-as-packages.md) — the package structure
