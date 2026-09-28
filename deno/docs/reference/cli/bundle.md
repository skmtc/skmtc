# skmtc bundle

> Compile the project's local generators into `bundle.js`.

Regenerates `worker.ts` from `deno.json#imports`, then runs
`deno bundle worker.ts -o bundle.js`. `skmtc generate` runs the same
build before every generation, so you do not need to run `bundle`
before `generate`. Use `bundle` to check that a project builds
without generating.

Every project builds a local bundle — remote-only (all generators
installed from JSR) and hybrid (some cloned) alike. `deno bundle`
resolves `jsr:` specifiers through the project's import map, so the
build is identical either way.

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

### One copy of `@skmtc/core`

Before `deno bundle` runs, the CLI resolves the module graph of
`worker.ts` with `deno info --json`. The graph must hold one copy of
`@skmtc/core` and of each `@skmtc/lang-*` package. The engine
recognizes definitions and files with `instanceof`, which fails across
two copies: a bundle with two copies generates empty files and reports
success.

A copy is a version from JSR (or another host), from npm, or from a
local directory — a checkout mapped in `deno.json` beside the JSR
package is a second copy. `import type` imports don't count, because
`deno bundle` erases them.

When the graph holds two copies, `bundle` exits 1 with a message that
names each copy and the packages that import it. The build also
refuses a graph that `deno info` can't read, because nothing checks the
bundle it would produce:

```
Project "api" resolves more than one copy of @skmtc/core:
  @skmtc/core 0.28.7 ← @skmtc/worker@0.3.55
  @skmtc/core 0.29.0 ← @skmtc/gen-typescript@0.2.7, @skmtc/gen-zod@0.2.7, @skmtc/lang-typescript@0.12.22
```

Change the pins in the project's `deno.json` so that those packages
agree, then run the command again. `skmtc generate` runs the same
check before every generation.

### Bundle output

`deno bundle` writes to a temporary file under `.settings/`, which is
renamed over `<project>/bundle.js` only when the build succeeds, so a
command running at the same time never loads a missing or half-written
bundle. A failed build leaves the previous `bundle.js` in place; no
command runs it. The bundle includes:

- The `@skmtc/worker` runtime
- The `@skmtc/core` engine
- All installed generators' source (JSR + local)
- Any transitive dependencies

Bundle sizes typically range from 1MB to several MB depending on
the number of generators.

### Logs

Each build replaces two log files, so they hold the output of the last
build only:

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
`bundle.js`. (The former `type: "noop", reason: "remote-only"` result
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
skmtc bundle my-api --json | jq '.type'
# "bundled"
```

## When to run bundle explicitly

Rarely. `skmtc generate` and `skmtc dev` build the bundle before they
run it, `skmtc describe`, `skmtc status` and `skmtc clean` build their
own copy in a temporary directory, and `skmtc clone` and `skmtc install`
build it to check the new generator. Nothing runs a `bundle.js` that it
did not build in the same command.

Run `bundle` explicitly to check that a project builds, for example
after you change a pin, without generating any files.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — bundle written |
| `1` | `deno bundle` failed (check `.settings/error-logs.txt`), or the module graph holds more than one copy of `@skmtc/core` or a `@skmtc/lang-*` package |
| `2` | Required argument missing |

## Common failure modes

### Peer-dependency version skew

```
error: No matching export … for import "SnippetBase"
```

The cloned generator's `@skmtc/core` peer doesn't match the
project's pin. Run `skmtc doctor --json` and look at the
`project-core-pin/<project>` check. Fix the pin in `deno.json`, then
run the command again.

### Missing transitive peer

```
error: Module not found "@std/path"
```

A peer dep declared by the cloned generator isn't in the project's
`deno.json`. Add it manually.

## See also

- [`skmtc clone`](clone.md) — builds the bundle after clone
- [`skmtc install`](install.md) — builds the bundle after install
- [`skmtc dev`](dev.md) — bundle + regenerate on file changes
- [`skmtc generate`](generate.md) — builds the bundle, then runs it
- [the-worker-runtime concept](../../concepts/the-worker-runtime.md) — what the bundle is for
- [generators-as-packages concept](../../concepts/generators-as-packages.md) — the package structure
