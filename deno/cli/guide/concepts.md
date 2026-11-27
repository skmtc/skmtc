<!-- topic model: The workspace: root, project, config, bundle and manifest -->
## Mental model

The Skmtc CLI generates code from OpenAPI v3 or GraphQL SDL documents.
It's a Deno binary that wraps a project workspace under
`<root>/.skmtc/`, fetches generators from JSR, and runs them against a
schema source pinned in each project.

| Concept | Where it lives | Notes |
|---|---|---|
| Skmtc root | nearest ancestor dir containing `.skmtc/` | Created by `skmtc init` |
| Project | `<root>/.skmtc/<project>/` | One schema + one set of generators |
| Project deps | `<root>/.skmtc/<project>/deno.json` | JSR imports of installed generators |
| Schema pin | `<root>/.skmtc/<project>/.settings/skmtc.config.json` | `source` field — URL or path. Resolution: explicit schema arg → `skmtc.config.json#source` → interactive prompt (TTY only; strict mode fails with a recipe error) |
| **basePath** | `skmtc.config.json#settings.basePath` | **Must match the consumer app's `@` alias root.** Both the on-disk root for generated files AND the alias root in the bundler's resolver. Generators produce `@/<subdir>/...` paths assuming this alignment. Absolute paths are rejected at `init`. |
| Bundle | `<root>/.skmtc/<project>/bundle.js` | Compiled worker entry. Rebuilt before every run by `generate`/`dev`, and by `bundle`/`clone`/`install`. `describe`/`status`/`clean` build their own copy outside the project. |
| Manifest | `<root>/.skmtc/<project>/.settings/manifest.json` | Per-run record of every file written and every (generator × item) outcome |
| Generator | JSR package or local folder | Local: `<root>/.skmtc/<project>/<gen-name>/` |
| **Global state** | `~/.skmtc/` | `auth.json` (the hub login stored by `skmtc login`: its environment and token; `skmtc whoami` shows the account, environment and origin a hub command will use), shadow project state, schema caches. **Check this when local state alone doesn't explain a failure.** |

A "project" is **not** the consuming app — it's the *generator
configuration* the consuming app pulls code from.

**Generators are opinionated templates, not configurable libraries.**
Stock `@skmtc/gen-*` packages ship hardcoded defaults — export paths,
identifier naming, peer imports, output shapes — and there are no
config flags for any of them, deliberately. To change them,
`skmtc clone` the generator into the project and edit its source;
that is the customization seam, not a workaround. "Stock generator
hardcodes X" is almost never a CLI bug. Enrichments supply the
settings a generator's author declared it needs — its `enrichments.ts`
schema is the whole contract a consumer can fill; cloning changes the
shape.

Two engine facts that shape CLI expectations: generator order never
affects output (coordination is a memoized cache, not a dependency
graph — never sequence generators), and render does not run a
formatter (unformatted output is by design; consumers format
separately).

<!-- topic contract: Input modes, --json, exit codes and recipe errors -->
## The agent contract

Every state-touching command supports three modes, picked
automatically:

| Mode | When | Behavior |
|---|---|---|
| **Interactive** | TTY attached and no `--json` / `--no-input` | Ink TUI; prompts for missing args |
| **Strict text** | Non-TTY (CI / pipes / agents) OR `--no-input` | Plain-text result on stdout; missing required args fail with a recipe error on stderr |
| **Strict JSON** | `--json` (implies `--no-input`) | Single JSON object on stdout; logs on stderr |

**For agents: add `--json` to every command.** The CLI auto-degrades
to non-interactive mode on any non-TTY stdin/stdout — no PTY wrappers
needed. (Two exceptions surface in help: `dev` is long-running and
has no `--json`; `create` has no `--json` yet.)

Exit codes are consistent across all commands: `0` success (including
documented no-ops), `2` required input missing or invalid (recipe
error on stderr) or the named project did not load (one line,
`Project "<name>" did not load: <reason>`, no recipe: repair that
folder in `.skmtc/`), `1` anything else (registry unreachable, schema
parse failure, fatal parseIssue, typecheck failure). For `generate
--json`, an empty `errors` array is the success condition — not the
exit code alone.

**Recipe errors are the discovery mechanism.** When a required
argument is missing in strict mode, stderr carries the usage line, a
worked example, and a `Discover:` line naming the command that lists
the valid values (e.g. `ls .skmtc/` for project names). Trust it:
run the command, read the recipe, run the discovery, retry.

**Deprecated config names.** A project on `client.json` or
`settings.system` still loads. Each run prints one deprecation warning
on stderr, and a `--json` result carries a `deprecations` array
(`{ kind, old, new, fix }`). Run the `fix` (`skmtc migrate config
<project>`) to move the project to the current names. Only interactive
mode offers this migration with a `(Y/n)` prompt; strict and JSON
modes never prompt.

<!-- topic commands: Where the command list is, and the deploy and publish names -->
## The command surface

The guide holds no command table. Read it from the binary:

```bash
skmtc --help        # every command, with real descriptions
skmtc <cmd> -h      # full flags for one command
```

The newer commands' help descriptions (`status`, `eject`, `adopt`,
`deploy`, `push`, `pull`, `api publish`, `api link`) carry their full semantics — read them
there rather than guessing from the names. One naming trap help
cannot intercept: a stack is **deployed, not published**. `skmtc
deploy` stores a new immutable semver version and deploys it in one
step; `skmtc publish` is its old name, kept for one release. Deploying
never moves the `production` alias — that belongs to hub projects and
is driven from the web app.

<!-- topic start: The two commands to run first in a workspace -->
## First steps in a workspace

```bash
skmtc agent-context --json    # enumerate projects, commands, guide topics, state
skmtc doctor --json           # check for known frictions
```

These two give the full workspace picture without documentation
lookups — `agent-context` is the snapshot, `doctor` the diagnostic,
in that order. `doctor`'s `summary` is the worst status across checks
(`error > warning > ok`; exit 1 only on `error`), and every check
carries its own `id`, `status`, `message`, and remediation `hint` —
the output is self-describing. The check-id catalogue, if you need to
reason about a specific check: `skmtc guide doctor-checks`.

<!-- topic bundle: When bundle.js is built, and what a build failure means -->
## The bundle is rebuilt on every generate

Generation runs the compiled `bundle.js`, not generator source. For a
local project, `generate` rebuilds `bundle.js` from `deno.json#imports`
and the generator source on disk before every run, so pin changes and
edits to cloned source apply on the next `generate` — no `skmtc bundle`
step. `dev` builds the same way; `describe`, `status` and `clean` build
a read-only copy in a temporary directory (`deno bundle --frozen`), so
after a pin change run `generate` once before them. A build failure exits 1 with the
`deno bundle` error; a module graph with two copies of `@skmtc/core`
(or a `@skmtc/lang-*`) exits 1 naming the packages that import each
copy.

<!-- topic config: What skmtc.config.json holds: packages, enrichments and filters -->
## Configuration: skmtc.config.json and filters

`.skmtc/<project>/.settings/skmtc.config.json` — top level is
`{ source?, settings }`; `settings` carries `basePath` (required,
relative, no `..`), `packages`, `enrichments`, `skip`, `include`,
`generatedSuffix`, `parse`. Full annotated shape, every key:
`skmtc guide config-shape` — read it before editing the file.
`client.json` (the old file name) and `settings.system` (the old name
of `settings.parse`) still work and are deprecated: run
`skmtc migrate config <project>`.

`packages` (optional) routes output into monorepo packages. Each
entry `{ rootPath, moduleName? }` is a folder forward from `basePath`,
which is then the common ancestor of every package, not a bundler
alias. Inside a root, imports render `@/` from that root; from
outside, they render the root's `moduleName`. Nested roots are subpath
exports (`@app/sdk/models`) that share the outer package's `@`. Config
load rejects `..`, a repeated root and the workspace root; render
fails on an outside import of a root with no `moduleName`. Task page:
[generate into multiple packages](https://github.com/skmtc/skmtc/blob/main/deno/docs/using/how-to/generate-into-multiple-packages.md).

Enrichment misaddressing never errors. When a customization does not
land, read `manifest.enrichmentWarnings` (printed after `generate`,
and re-read by `skmtc doctor` as `project-enrichments/<project>`): a
typo'd id, path, method, model name or leaf key is reported with the
nearest match. Routing is the literal path plus lowercase method,
never `operationId`, under a `main` variant key. A wrong-typed value
fails the run: nothing is written, and the last good run's files and
manifest stay. The `RUN_FAILED` issue in the output of `generate`
(`parseIssues` with `--json`) names each wrong value's place in
`settings.enrichments`.

`settings.skip` / `settings.include` accept a whole generator, a
per-operation entry (`path → method → variant[]`), or a per-model
entry (`refName → variant[]`); `[]` means every variant. Filters are
where **user intent** is expressed — never a generator's
`isSupported`. Semantics and precedence: `skmtc guide filters`.

Every command's `--json` envelope is one object discriminated by a
`type` field; per-command shapes: `skmtc guide output` — read when
parsing output, not before.
