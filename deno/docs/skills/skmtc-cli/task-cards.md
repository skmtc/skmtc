# skmtc-cli — task cards

Pull-loaded workflows for the `skmtc-cli` skill: end-to-end
recipes for the common jobs, referenced from SKILL.md §7.

Read the card for the job in front of you. The command surface lives
in the binary (`skmtc --help`, `skmtc <cmd> -h`) — you do not need a
card to run one command.

## Task cards

### Card: Setting up SKMTC in a project

```bash
cd path/to/your-app                           # this becomes the SKMTC root
skmtc init my-api ./src --json                # creates .skmtc/my-api/
skmtc install @skmtc/gen-zod @skmtc/gen-typescript my-api --json
# Edit .skmtc/my-api/.settings/client.json — set "source" to the schema URL/path
skmtc generate my-api --json                  # one-shot generation
```

The final `--json` run returns `{ files, stats, errors, parseIssues, ... }`.
Inspect `errors` and `parseIssues` for any non-success outcomes.

### Card: Adding a generator to an existing project

```bash
skmtc install @skmtc/gen-<name> <project> --json
```

If `installed` is non-empty and `bundle.type === "bundled"` → ready
to `generate`; the rebundle ran automatically (remote-only and
hybrid projects alike).

### Card: Configuring enrichments

1. Read the target generator's `gen-x/src/enrichments.ts` (in
   `skmtc-generators/` or via `deno info`) to learn the accepted
   *per-variant inner* shape. The variant axis is core-owned;
   generator schemas describe what goes inside a single variant.
2. Edit `.skmtc/<project>/.settings/client.json` →
   `settings.enrichments[generatorId][...routingKeys][variant]`.
   Routing keys depend on the generator's factory:
   `[path][method][variant]` for OAS ops, `[refName][variant]` for
   models, `[rootKind][fieldName][variant]` for GraphQL ops. The
   variant level defaults to `'main'`; declare extra variants to
   get N artifacts per item from a variants-aware generator.
3. Single-variant case (most common):
   ```jsonc
   { "@skmtc/gen-shadcn-form": { "/contacts": { "post":
     { "main": { "title": "Create Contact" } }
   } } }
   ```
4. Multi-variant case (variants-aware generators only):
   ```jsonc
   { "@skmtc/gen-shadcn-form": { "/quotes/{id}": { "patch":
     {
       "main":     { "title": "Edit Quote" },
       "customer": { "title": "Customer section" }
     }
   } } }
   ```
5. `skmtc generate <project>` — no rebundle needed; enrichments are
   runtime config.

If you see `must include a 'main' variant` at engine start, you wrote
non-`'main'` variant keys without `'main'`. Add it (often `"main": {}`
is enough) or remove the other variants.

### Card: Pinning the schema source

1. Edit `.skmtc/<project>/.settings/client.json` → add `"source"` at
   the top level.
2. After this, `skmtc generate <project>` works without the schema
   positional arg.

### Card: Cleaning a project's generated output

Use when stale output has accumulated and you want a guaranteed fresh
tree, or before deleting a project. `clean` reads the manifest,
deletes every file it recorded, prunes the directories those
deletions emptied, and removes the manifest.

```bash
skmtc clean <project> --dry-run --verbose   # preview: lists files + dirs, touches nothing
skmtc clean <project> --json                # apply; returns { deleted, removedDirs, manifestRemoved, ... }
```

Then, for a clean-slate regeneration:

```bash
skmtc clean <project> --json && skmtc generate <project> --json
```

Key facts:

- **`clean` is the full delete; `generate`'s internal prune is
  incremental.** `generate` only deletes the files the *next* run
  won't rewrite (stale artifacts from a removed generator). `clean`
  deletes the *entire* manifest-recorded set. Both now also prune the
  directories they empty.
- **Directory pruning is self-limiting and anchored.** It removes only
  dirs it emptied, stops at the first non-empty ancestor, and never
  removes `basePath` or a `packages[].rootPath`. If `basePath` is
  unset in `client.json`, dir pruning is skipped entirely.
- **`clean` touches only generated output.** It never rebundles,
  contacts JSR, or edits `client.json` / `deno.json`. To uninstall a
  *generator*, use `remove`, not `clean`.
- **No confirmation prompt** (no Ink variant). `--dry-run` is the
  safety valve; deletion is irreversible.
- A project with no manifest (never generated, or already cleaned) →
  no-op, exit 0, `noManifest: true`.

### Card: Filtering operations (opt-in form generator pattern)

```jsonc
// In client.json#settings:
{
  "include": [
    {
      "@skmtc/gen-shadcn-form": {
        "/customers": { "post": [] },
        "/locations": { "post": [] }
      }
    }
  ]
}
```

This produces forms only for the listed (path, method) pairs. The
empty variant array (`[]`) means "every variant of this method" —
i.e. the standard "all" allow. To narrow to specific variants of a
multi-variant operation, list them by name:

```jsonc
"include": [{ "@skmtc/gen-shadcn-form":
  { "/quotes/{id}": { "patch": ["customer", "location"] } }
}]
```

Other operations route through other generators normally. Other
generators not mentioned in `include` are unaffected — they continue
producing their normal output.

### Card: Customizing a published generator

```bash
skmtc clone <project> -g @skmtc/gen-<name> --json
# Inspect: ls .skmtc/<project>/<gen-name>/src/
# Edit src/base.ts (paths, identifiers) or src/<Main>.ts (output shape)
skmtc dev <project>                           # rebundle + regenerate on save
```

Hand off to `skmtc-generator` for the editing work.

### Card: Registering an agent-authored local generator (programmatic / sandbox use)

Use this when generator **source already exists on disk** (authored
programmatically, not scaffolded) and you want the CLI to run it —
e.g. a sandbox handed "a folder of generator source + a schema".

**`skmtc create` is agent-usable for Kotlin.** In a non-TTY session
it runs headlessly from its command-line args, and
`skmtc create <project> <name> model --lang kotlin` writes a WORKING
baseline generator: a plain-signature `toKtValue` router with one
module per scaffolded case (string/integer/number/boolean/array/ref/
object), `protocol.ts` carrying the value-field contracts, decision
cases throwing loudly (union, unknown, map-shaped object),
`enrichments.ts`, and a real root `mod.ts` default export, plus the
project `deno.json` registration — scaffold-then-customise is the
preferred flow. The **TypeScript** templates (`--lang typescript`,
the default) still scaffold stubs and leave the package root `mod.ts`
empty — for TS, the direct-registration flow below remains the
practical path.

**The CLI discovers a local generator ONLY via the project
`deno.json#imports`.** `toGeneratorIds()` = the import *keys* whose
package name starts with `gen-`; `worker.ts` is generated by importing
exactly those ids. A folder on disk not referenced from
`deno.json#imports` is invisible.

**`worker.ts` and `bundle.js` are the only derived artifacts** — never
hand-write them. `bundle` regenerates `worker.ts` from
`deno.json#imports`, then runs `deno bundle -o bundle.js worker.ts`.
`deno.json` and `.settings/client.json` are *config*, not derived —
hand-writing those is correct and expected.

```bash
skmtc init lab <basePath> --json   # writes .skmtc/lab/deno.json ({}) + .settings/client.json
```

Then, **by hand**, write under `.skmtc/lab/`:

1. The generator folder `.skmtc/lab/<gen-dir>/`:
   ```
   <gen-dir>/
     deno.json     # { "name": "@<scope>/gen-<name>", "version": "0.0.1",
                   #   "exports": "./mod.ts", "imports": { ...cross-generator deps... } }
     mod.ts        # re-export the entry as DEFAULT:
                   #   export { xEntry as default } from './src/mod.ts'
     src/
       mod.ts      # toOasOperationEntry({ id, transform, ... }) /
                   #   toModelEntry({ id, transform }) — pure pipeline
                   #   config, NO `lang` field (core 0.8.0+)
       base.ts     # imports its projection-base veneer from the lang
                   #   package (e.g. toTsOasOperationProjectionBase from
                   #   @skmtc/lang-typescript; toKt*/toCs* for the Kotlin
                   #   / C# lang packages) — the import graph declares the
                   #   language
       *.ts
   ```
   - Package name **must** be `@<scope>/gen-<name>` — the `gen-`
     prefix is the discovery filter.
   - Root `mod.ts` **must have a default export that is the entry
     object** — the worker does `import g from '@scope/gen-x'` and
     reads `g.id`.
   - `src/mod.ts`'s entry `id` **must equal the package name** — it's
     the key `worker.ts` (`g.id`) and `client.json`
     enrichments/skip/include route on.

2. Patch `.skmtc/lab/deno.json`:
   ```jsonc
   {
     "imports": {
       "@<scope>/gen-<name>": "./<gen-dir>/mod.ts",  // local generator
       "@skmtc/core":   "jsr:@skmtc/core@<pin>",      // peer deps the
       "@skmtc/worker": "jsr:@skmtc/worker@<pin>",    // generator src
       "@skmtc/lang-typescript": "jsr:@skmtc/lang-typescript@<pin>", // the lang package the base file imports
       "@std/path":     "jsr:@std/path@^1",           // imports by bare
       "tiny-invariant":"npm:tiny-invariant@^1.3.3"   // specifier
       // ...valibot, ts-pattern, etc. as the source needs
     },
     "workspace": ["./<gen-dir>"]
   }
   ```
   `init` writes an empty `{}`. `skmtc bundle` (and any command that
   rebundles — `clone`, `dev`) now adds the `@skmtc/core` and
   `@skmtc/worker` pins automatically, at the CLI's own versions, when
   it generates `worker.ts` — so you no longer hand-pin those two. You
   **do** still pin every *other* bare specifier the generator source
   imports (`@std/path`, `valibot`, `tiny-invariant`, …) — `bundle`
   only knows about the worker peer deps. Remote-only projects need
   no hand-pinning beyond the `jsr:` generator entries — published
   packages carry their own dependencies.

3. Set the schema in `.skmtc/lab/.settings/client.json#source` (or
   pass it as the `generate` positional). `basePath` is set by `init`.

```bash
skmtc bundle lab --json   # → { type: "bundled", bundlePath } — writes worker.ts AND bundle.js
skmtc generate lab <schema> --json --typecheck
```

`bundle` returns `type: "bundled"` for every project. To confirm the
step-2 wiring took, check the generated `worker.ts` imports the
local `@<scope>/gen-<name>` id — a missing entry means the import
key isn't a `gen-*` entry in `deno.json#imports`.

### Card: Using SKMTC in CI

```bash
# Setup (once per CI run) — the installer bootstraps Deno if needed;
# SKMTC_VERSION pins the CLI so runs are reproducible:
SKMTC_VERSION=<version> curl -fsSL https://skmtc.dev/install | sh
# Build the project's bundle.js (required for every project unless a
# fresh one is committed/cached):
skmtc bundle <project>

# Run:
skmtc generate <project> --json --no-input --typecheck
# Exit 0 on success, 1 on fatal parseIssue or typecheck failure.

# Archive for forensics:
cp <basePath>/../.skmtc/<project>/.settings/manifest.json ci-artifacts/
```

`--unstable-worker-options` is required: `@skmtc/worker` constructs
each per-project Worker with `new Worker(..., { deno: { permissions:
{...} } })`. That uses Deno's `Worker.deno.permissions` API, which is
gated behind this flag on current Deno releases. Without it the
first `skmtc generate` exits at runtime with `Unstable API
'Worker.deno.permissions'. The --unstable-worker-options flag must
be provided.` The flag has to be passed at install time — `deno
install` bakes the runtime flags into the installed CLI binary at
`~/.deno/bin/skmtc`. If a previously-installed binary is missing the
flag, reinstall with `-f` to overwrite it; adding the flag to
invocations of the existing binary does not work.

The install uses **scoped permissions, not `-A`**:
`--allow-read --allow-write --allow-net --allow-env
--allow-run=deno,sh --allow-sys=homedir`. skmtc reads/writes project
files, fetches schemas + packages over the network (the schema
`source` can be any URL, so `--allow-net` stays unscoped), reads a few
env vars, spawns only `deno` (bundle) and `sh` (typecheck), and needs
`homedir` to locate the workspace root. It uses no FFI and no remote
imports, so those grants are dropped. Empirically validated against
`doctor` / `generate` / `bundle`.

### Card: Publishing a stack version to skmtc-hub

Use when the project should be shared on the hub as a stack package.
Publishing creates an immutable semver version of the stack; a hub
*project* later pins that version and runs it (deployments and the
`production` alias are project concerns, driven from the web app).

```bash
# 1. Set the version — `version` in .skmtc/<project>/deno.json,
#    or pass --version. The CLI never invents or auto-bumps one.
# 2a. One-off: log in once (paste a PAT from Settings → Access tokens;
#     write:releases scope is enough), then publish with no token flags:
skmtc login            # or: echo $PAT | skmtc login --with-token
skmtc publish <project> --json
# 2b. CI: pass the token explicitly (flag or env beats the stored login):
skmtc publish <project> --token $SKMTC_HUB_TOKEN --json
```

Key facts:

- **Token resolution is `--token` → `$SKMTC_HUB_TOKEN` → the
  `skmtc login` store** (`~/.skmtc/auth.json`). When the token comes
  from the store, the store's `host` is also the default hub URL —
  a token minted against a local dev hub is never silently sent to
  production. Explicit `--origin` / `$SKMTC_ORIGIN` always win.
- **The stack identity is the project `deno.json#name`** (`@account/slug`,
  the JSR-style package name) — the `@account` scope may be a user OR an
  **org**, so org-owned stacks are reachable: the PAT authenticates, the hub
  authorizes you as a `writer` on that account/stack. `name` is required —
  recipe error (stage `identity`) if missing or not a scoped `@account/slug`.
- **The hub auto-creates the stack on first publish** ("git push
  creates the repo").
- **Versions are immutable.** Re-publishing an existing semver →
  `409`, surfaced as `stage: "publish"` with an "already published"
  reason. Bump the version and re-run.
- **Missing version fails fast** (`stage: "version"`, exit 1, before
  any network call) with the recipe: set `deno.json#version` or pass
  `--version`.
- The upload is atomic: `version` + compiled `server.js` bundle + the
  source tree (filtered by built-in defaults + `.skmtcignore`) in one
  multipart request. The root `deno.json` must be in the upload — the
  hub reconciles the version's generator composition from it.
- Read `version` / `versionUrl` from the JSON output. There is no
  `deploymentId` or `shortId` anymore.

Full reference: [`reference/cli/publish.md`](../../reference/cli/publish.md).

### Card: Pushing a project's config to skmtc-hub

Use when local `client.json` edits (config + enrichments) should land
on the project's hub project — the project-level counterpart to
`publish`. `push` overwrites the hub project's config; it never creates
a project (create it in the web app first).

```bash
# Destination is the `project: "@account/slug"` field in client.json.
skmtc login                                   # once; stores PAT + origin
skmtc push <project> --json
# First push to an org project — records the destination for next time:
skmtc push <project> --project @acme-org/petstore-client --json
```

Key facts:

- **`<project>` is the LOCAL project** (`.skmtc/<project>/`) — the
  source. The **hub destination** is `client.json#project` (or
  `--project @account/slug`), decoupled from your identity like a git
  remote. The account may be an org; the hub slug can differ from the
  local dir name.
- **Destination resolution:** `--project` → `client.json#project` →
  recipe error (no silent fallback to your handle). An explicit
  `--project` is written back into client.json (the `git push -u`
  ergonomic).
- **Overwrites** the hub project's config. In a TTY it confirms first
  when config already exists (`--force` skips); in strict/`--json` it
  overwrites and reports `overwroteExistingConfig`.
- **Never creates a project** — a `404` means "create it in the web
  app first". Authorization is checked against the destination account
  (org writers pass).
- **`--base-files`** also pushes the app tree (package.json, components,
  css…) to `/preview/base-files`. Collected from the **app root**
  (`dirname(basePath)`) via the same `.skmtcignore` methodology as publish,
  minus `.skmtc/` and the manifest's generated files. Default push is
  config-only (config changes often, base files rarely).
- Token + origin resolve exactly like `publish` (`--token` /
  `$SKMTC_HUB_TOKEN` / store; `--origin` / `$SKMTC_ORIGIN` / store host).

Full reference: [`reference/cli/push.md`](../../reference/cli/push.md).

### Card: When to hand off to other skills

- "I want to edit this generator" → `skmtc-generator`
- "Why is my generation failing / wrong / empty" → `skmtc-debug`
  (verify-first stance takes priority)
- "Let's reflect on this session" → `skmtc-retro`
