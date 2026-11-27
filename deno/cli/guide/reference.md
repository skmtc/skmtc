<!-- topic config-shape: Every key of skmtc.config.json, annotated -->
## The skmtc.config.json shape

The file is `.skmtc/<project>/.settings/skmtc.config.json`.
`client.json` (the old file name) and `settings.system` (the old name
of `settings.parse`) still work and are deprecated: run
`skmtc migrate config <project>`.

```jsonc
{
  // Optional. URL or path to the OpenAPI / GraphQL schema.
  // When set, `skmtc generate <project>` doesn't need a schema arg.
  "source": "./openapi.json",

  "settings": {
    // The on-disk anchor for generated output. Required, relative,
    // no `..` segments. Single-package: the consumer app's bundler
    // `@` alias root — generators produce `@/<subdir>/...` paths
    // assuming this aligns with the bundler's alias config.
    // Multi-package (see `packages` below): a common ancestor of
    // every package — the monorepo root — not a bundler alias.
    "basePath": "mobile-app/src",

    // Per-generator and per-item user overrides. Routing
    // keys depend on factory:
    //   - OAS operation:  [path][method][variant]
    //   - GraphQL op:     [rootKind][fieldName][variant]
    //   - Model:          [refName][variant]
    //
    // The trailing `[variant]` level is `'main'` by default. Most
    // consumers write just one variant; a variants-aware generator
    // like gen-shadcn-form (operation) or a coercive zod variant
    // (model) can produce N artifacts per item by declaring extra
    // variant keys. `'main'` MUST be present whenever any variant
    // is declared — the engine throws at start otherwise.
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/contacts": {
          "post": {
            "main": {
              "title": "Create Contact",
              "submitLabel": "Save"
            }
          }
        },
        // Multi-variant operation example: one PATCH endpoint,
        // several section-edit forms with different field subsets.
        "/quotes/{id}": {
          "patch": {
            "main":     { "title": "Edit Quote" },
            "customer": { "title": "Customer details" },
            "location": { "title": "Location" }
          }
        }
      },
      // Multi-variant model example: same component schema produces
      // a strict and a coercive zod schema in adjacent files.
      "@scope/gen-zod-variants": {
        "Customer": {
          "main":     { "coerce": false },
          "coercive": { "coerce": true }
        }
      }
    },

    // Allow-list. Empty array = no filter. See `skmtc guide filters`.
    "include": [],

    // Deny-list. Applied after include. See `skmtc guide filters`.
    "skip": [],

    // Optional. Filename suffix the engine injects into every
    // projection export path before the extension (`CreateForm.tsx`
    // → `CreateForm.generated.tsx`). Defaults to ".generated"; set
    // "" to disable. Injection is idempotent, and the suffix marks a
    // file as engine-owned — it is the seam the eject/adopt flow
    // renames across. Usually leave it alone.
    "generatedSuffix": ".generated",

    // Optional. Multi-package output — route generated files into
    // separate packages of a monorepo. Each entry is
    // `{ rootPath, moduleName? }` with a FORWARD `rootPath` (relative
    // to basePath). A root is a folder, not a prefix. Rejected at
    // config load: a `..` segment, one root listed twice (in any
    // spelling), and the workspace root itself (`.`) — leave
    // `packages` unset to import everything through `@/` from
    // basePath. When `packages` is set, basePath is the monorepo root
    // and `@` is per-package: intra-package imports render `@/…`
    // (rooted at that package), cross-package imports render the
    // target's `moduleName`. Roots may nest: a nested root is a
    // subpath export of the package around it (`@app/sdk/models`),
    // sharing the outer package's `@`. See
    // https://github.com/skmtc/skmtc/blob/main/deno/docs/reference/settings/client-json-schema.md
    "packages": [
      { "rootPath": "packages/sdk/src", "moduleName": "@app/sdk" },
      { "rootPath": "packages/sdk/src/models", "moduleName": "@app/sdk/models" }
    ],

    // Optional. How the OpenAPI parser reads schemas it cannot read
    // faithfully: `allOf`, `not`, `anyOf`, `danglingRefs`,
    // `intersections`, `responseContradictions`. See
    // https://github.com/skmtc/skmtc/blob/main/deno/docs/reference/settings/client-json-schema.md
    "parse": { "allOf": "latestWins" }
  }
}
```

To know what enrichment keys a generator accepts, **read its
`gen-x/src/enrichments.ts`** — Valibot schema is canonical.

### Three enrichment scopes

The `enrichments` namespace carries **per-subject** enrichments (the
original, unchanged form) plus **two reserved `_`-prefixed scopes**.
Three scopes in all, distinguished by key-depth:

| Scope | Where the key sits | Reserved key | Lifetime |
|---|---|---|---|
| **subject** | `[id][subject][variant]` | — (customer subject names) | per item (model / operation) |
| **generator** | `[id]._generator` | `_generator` | run-constant for that one generator |
| **stack** | `._stack` | `_stack` | run-constant shared across every generator |

`_stack` is a **top-level** key — a sibling of the generator-id keys.
`_generator` lives **inside a generator's slot** — a sibling of the
subject keys.

**Reserved-key rule:** customer keys (generator ids at the top level,
subject names inside a slot) **must not start with `_`**. The only
reserved keys are `_stack` and `_generator`; any other `_`-prefixed key
fails config validation at start.

```jsonc
"enrichments": {
  // Stack scope — one leaf shared across every generator. Valid only
  // when every generator in the run declares `stack` in its umbrella.
  "_stack": { "apiTitle": "Billing API" },

  "@acme/gen-zod-strict": {
    // Generator scope — a run-constant for this generator only.
    "_generator": { "strict": true },

    // Subject scope — per-model, unchanged. `'main'` is the
    // default variant.
    "Pagination": { "main": { "coerce": true } }
  }
}
```

In `enrichments.ts` the same three scopes are the umbrella members
`subject`, `generator` and `stack` — no underscore. A generator opts
into a scope by declaring it; `v.undefined()` rejects any value at that
key. Which scopes a generator declares is in its `enrichments.ts` —
the stock generators declare `subject` only — so the `_generator` /
`_stack` blocks above need cloned generators that declare them, and
`_stack` needs every generator in the run to.

Per-subject enrichments are otherwise unchanged: the routing keys and
the mandatory `'main'` variant level (see the `skmtc.config.json` shape above
and `skmtc guide filters`) work exactly as before. A generator reads each scope by known
key through typed helpers (`toStackEnrichment` /
`toGeneratorEnrichment` / the per-subject path) — it never iterates the
enrichments record itself.

`packages` is optional; omit it for the common single-`basePath`
project. With `packages` set, point `basePath` at a common ancestor
of every package (the monorepo root) so each `rootPath` — and every
generator's `toExportPath` — is a plain forward path. A `..` segment
in `basePath` or any `rootPath` is rejected at config load: it means
`basePath` is too deep, and hand-counting `../` segments is the
silent-misplacement footgun the forward-path rule removes. Two more
rejections at config load: a root listed twice (spellings such as
`./packages/sdk/`, `@/packages/sdk` and `packages/sdk` are one root)
and the workspace root itself as a package root — with no `packages`
every import already goes through `@/` from `basePath`. Roots may
nest; a nested root is a subpath export of the package around it,
named by its own `moduleName` for importers outside the package and
sharing the outer package's `@` for files inside it.

<!-- topic filters: How settings.skip and settings.include choose what runs -->
## Skip and include filters

Both `skip` and `include` accept three entry shapes:

```jsonc
[
  // 1. Whole generator (string)
  "@skmtc/gen-zod",

  // 2. Per-operation (path → method → variant[])
  //    `[]` means "every variant of this method".
  //    `["customer", "main"]` means "only those variants".
  { "@skmtc/gen-shadcn-form": {
      "/customers": { "post": [] },
      "/quotes/{id}": { "patch": ["customer", "location"] }
  } },

  // 3. Per-model (refName → variant[])
  //    `[]` means "every variant of this refName".
  //    `["coercive", "main"]` means "only those variants".
  { "@scope/gen-zod-variants": {
      "Customer": [],
      "Order": ["coercive"]
  } }
]
```

Order of evaluation in `GenerateContext.toArtifacts`:
**`isSupported` (capability) → `include` (allow) → `skip` (deny).**

- `include` is **per-generator**, not document-global. A generator
  with a per-operation `include` entry runs in allow-list mode (only
  the listed items); a generator absent from `include` is unaffected
  and runs default-on. There is no whole-generator exclusion.
- `include === []` or undefined → no filter active; everything runs
- A per-operation `include` entry → only matched items run for that
  generator; non-matching items emit `skipped`
- A **bare-string** `include` entry (`"@skmtc/gen-zod"`) carries no
  per-operation filter and is a no-op — the generator runs default-on
  either way. Whole-generator opt-out is `skip`.
- `include` + `skip` on the same item → **`skip` wins** (`final =
  include_set \ skip_set`) — `skip` is the deny-list, always decisive
- Matching is exact — no wildcards, on path, method, OR variant name
- The variant array is the third axis: `[]` matches every variant
  of the named method; a populated array matches only those variant
  names

> **Migration note.** Earlier `@skmtc/core` treated a non-empty
> `include` as document-global: every generator not mentioned was
> silently excluded. `include` is now per-generator. If a project
> relied on the global behaviour — listing a few generators in
> `include` to switch the rest off — turn those off explicitly with
> whole-generator `skip` entries instead.

Use `include` for opt-in generators (forms, tables, page shells) where
a blanket run would produce dozens of files the team doesn't want.
Use a variant array under a method to narrow the allow/deny to
specific variants of a multi-variant operation.

<!-- topic output: The JSON that each command prints with --json -->
## Common JSON output shapes

Agents drive on these shapes. Discriminator field is usually `type`.

When a project uses a deprecated config name, a command's JSON result
also has a `deprecations` array. `doctor --json` and
`agent-context --json` always have it at the top level. Each entry is
`{ kind, old, new, fix }`, where `kind` is `configFile` or
`settingsKey`, and `fix` is `skmtc migrate config <project>`. A
project with both `skmtc.config.json` and `client.json` gets a
`kind: 'ignoredConfigFile'` entry: skmtc ignores `client.json`, and `fix`
is `rm .skmtc/<project>/.settings/client.json`.

### `migrate config`

```jsonc
{
  "projects": [
    {
      "project": "my-api",
      "configPath": { "before": ".../client.json", "after": ".../skmtc.config.json" },
      "renamedFile": true,
      "movedKeys": ["allOf"],   // keys of settings.system moved to settings.parse
      "conflicts": [],
      "alreadyMigrated": false,
      "dryRun": false
      // "refused": "<reason>" — only when the project was refused (both files exist); exit 1
    }
  ]
}
```

### `install`

```jsonc
{
  "projectName": "my-api",
  "installed": ["@skmtc/gen-zod"],
  "bundle": { "type": "bundled", "projectName": "my-api", "bundlePath": "..." },
  "verifyWith": "cat .skmtc/my-api/deno.json"
}
```

The post-install rebundle runs for every project — remote-only and
hybrid alike — so `bundle.type` is always `"bundled"`.

### `clone`

```jsonc
{
  "projectName": "my-api",
  "cloned": [
    { "moduleName": "@skmtc/gen-typescript", "version": "0.0.55" }
  ],
  "bundle": { "type": "bundled", "projectName": "my-api", "bundlePath": "..." },
  "verifyWith": "ls .skmtc/my-api/"
}
```

`clone` refuses, with exit 2, a generator that the project already
has a clone of: a clone is a one-time copy for local edits. `--force`
replaces it: it deletes the folder and its edits.

`clone` also has a **`@skmtc/core` check**. It plans one core pin for the generators it
clones and the ones that stay. When no version fits, it refuses with
exit 2 before it writes any file. The clones it replaces do not
count, so name every clone you move to a new core in one
`clone --force` command. `--force` never skips this check. `clone`
also refuses, even with `--force`, a folder that holds another
generator.

### `bundle`

```jsonc
// Wrote bundle.js — the only outcome; every project (remote-only
// included) builds a local bundle, since `generate` loads it:
{ "type": "bundled", "projectName": "my-api", "bundlePath": "..." }
```

### `generate`

```jsonc
{
  "type": "generated",
  "projectName": "my-api",
  "basePath": "mobile-app/src",
  "manifestPath": ".skmtc/my-api/.settings/manifest.json",
  "stats": { "tokens": 201029, "lines": 1234, "files": 753, "totalTimeMs": 180 },
  "files": ["mobile-app/src/types/User.generated.ts", "..."],
  // errors: array of paths through manifest.results ending at 'error' leaves.
  // Shape: [traceId, spanId, "generate", generatorId, ...item, "variant", variant]
  // item: path, method (OAS) | "webhook", name, method | rootKind, fieldName (GraphQL) | refName (model)
  "errors": [
    ["trace-1778185255674", "span-1778185255674", "generate",
     "@skmtc/gen-zod", "BrokenModel", "variant", "main"]
  ],
  "parseIssues": [
    { "protocol": "oas", "level": "warning", "type": "MISSING_OBJECT_TYPE",
      "location": "components:schemas:User", "message": "..." }
  ]
}
```

With `--typecheck`, gains a `typecheck` field (`{ type: "passed" | "failed" | "no-tsconfig" | "tsc-error" | "skipped", ... }`).
A `failed` typecheck → exit 1; generated files stay on disk.

With `--save`, gains a `savedSource` field (`{ source, configPath, changed, stored }`):
the schema argument, the config file it was written to, and `changed: false`
when that source was already stored. `stored: false` when the run had an
`error` level issue: the source is then not written, and exit is 1.

**`--watch` and `--json` are mutually exclusive.** `--json` writes a
single result and exits; `--watch` is a long-running stream. Passing
both → exit 2 with a recipe error.

### `deploy`

```jsonc
// Deployed — the version is stored, then deployed as a stack server.
// Exit 0, except `deploy.status: "error"` → exit 1.
{
  "type": "deployed",
  "projectName": "my-api",
  "stack": { "account": "ada", "slug": "my-api" },
  "version": "3.0.1",            // the version stored and deployed
  "versionPicked": false,        // true: deno.json's version was stored, the CLI picked this one
  // null with --existing (nothing uploaded)
  "upload": {
    "sourceHash": "e3b0c44298fc1c14...",
    "versionUrl": "https://skmtc.dev/ada/stacks/my-api/versions/3.0.1",
    "sourceFileCount": 28,
    "sourceTotalBytes": 96512
  },
  // the @skmtc/server pin this run changed in deno.json, or null
  "serverPin": { "package": "@skmtc/server", "from": "jsr:@skmtc/server@0.3.34", "to": "jsr:@skmtc/server@0.3.33" },
  "deploy": {
    "status": "active",          // deploying | active | idle | paused | error
    "statusReason": null,        // set when status is "error"
    "endpointUrl": "",           // always empty: a stack server has no direct URL
    "url": "https://api.skmtc.dev/v1/stacks/ada/my-api/servers/3.0.1"
  }
}

// Failure — `stage` pinpoints where; `stored: true` means the version
// is on the hub and cannot change (fix, bump the version, deploy again):
//   "version"  — no deno.json#version and no --version (before any
//                network call), or the deno.json version is stored and
//                the next patch cannot be picked (versions list unreadable)
//   "identity" — deno.json#name missing or not @account/slug
//   "exists"   — the --version version is already stored (exit 2): pick
//                another, or `skmtc deploy <project> --version <v> --existing`
//   "source"   — source collection failed, or deno.lock is missing
//   "upload"   — POST .../versions failed, or 409'd again after a re-pick
//   "deploy"   — POST .../servers failed, was refused (needs the
//                write:releases scope), is still deploying (409: wait,
//                then --existing) or was not confirmed (re-run with
//                --existing; the route is idempotent)
{
  "type": "failed",
  "projectName": "my-api",
  "reason": "Version 3.0.1 already exists. Pass another `--version`, run `skmtc deploy my-api` to deploy the deno.json version (or the next patch when it is stored), or run `skmtc deploy my-api --version 3.0.1 --existing` to deploy the stored version.",
  "stage": "exists",
  "stored": true
}
```

**Call a deployed stack** through the hub, at the `url` of the output:
`https://api.skmtc.dev/v1/stacks/{account}/{stack}/servers/{version}` (or
`production` as the version). To generate, `POST` to that URL plus
`/artifacts`. A private stack needs a hub token
(`Authorization: Bearer <token>`).

**Version rule.** `--version <v>` is exact: stored → exit 2. Without it,
the `deno.json` version deploys as it is when the hub does not store it.
When the hub does, the CLI deploys the next patch after the stack's newest
stored release (semver; prereleases do not count; every page of
`GET /v1/stacks/{account}/{slug}/versions`), prints
`Version 0.1.5 is stored: deploying 0.1.6.` on stderr, and sets
`versionPicked: true`. It never writes the picked version into
`deno.json` — the hub holds the versions. An upload `409` for a version
the CLI did not get from `--version` picks again once; a second `409` →
stage `upload`, exit 1. So CI can deploy every change without bumping.

`skmtc publish` is the old name of `deploy`: same output and exit
codes, after one notice line on stderr.

<!-- topic principles: Where Skmtc differs from what an agent would do by default -->
## Operational principles (user-facing subset)

Selected from the full operational principles of the Skmtc docs (the
link is at the end of this topic). These are
the ones most likely to override default LLM intuitions during CLI
work:

| Default intuition | Skmtc's stance |
|---|---|
| Add a config flag to customize a stock generator | Use `skmtc clone` and edit the source |
| Run Prettier in the pipeline | Don't — produce valid TS; consumer formats separately |
| Restart from scratch when something's off | Run `skmtc doctor --json` first; targeted fix beats nuke-and-pave |
| Manually edit `bundle.js` or `worker.ts` | They're derived; `skmtc generate` writes `worker.ts` on every run and builds `bundle.js` again when an input changed |
| "Publish" a stack to the hub, then deploy it later | One step: `skmtc deploy` stores the immutable semver version (`POST /v1/stacks/{account}/{stack}/versions`) and deploys it (`POST /v1/stacks/{account}/{stack}/servers`), so a version that cannot build fails at once. `skmtc publish` is its old name. Deploying never moves the `production` alias — that belongs to hub *projects*, driven from the web app. |
| After bumping to `@skmtc/core@0.5.0+`, treat the existing operation-level enrichment as still-valid | Wrap each `[id][path][method]` block in `{ "main": { … } }`. The variant level is now mandatory whenever an operation-level block exists — the engine throws at start with `"must include a 'main' variant"` if it's missing. See `skmtc guide enrichments`. |
| Switch a generator between `install` and `clone` by editing only deno.json (or only the on-disk folder) | They're mutually exclusive states. A `jsr:` import in deno.json AND a `gen-X/` folder for the same name in the project root is a silent-failure footgun — deno's workspace resolver picks the local folder over the JSR pin, so the engine runs the vendored source even though the user thinks they're running the pinned version. See the *Imported vs cloned exclusivity* section below. |

### Imported vs cloned: mutually exclusive states

For every `gen-*` generator referenced in a project's `deno.json#imports`,
**exactly one** of the following must be true:

| State | `deno.json#imports[…]` value | On-disk `gen-X/` folder | Source served by |
|---|---|---|---|
| Imported | `"jsr:@scope/gen-X@^1"` | **MUST NOT exist** | JSR (proxied via `/v1/generators/.../source`) |
| Cloned | `"./gen-X/mod.ts"` | **MUST contain `mod.ts`** | hub R2 (uploaded with the release) |

Mixed states are silently broken:

- **`jsr:` import + folder both present**: deno's workspace resolver
  picks the local folder. The engine runs the vendored source. The
  pinned JSR version is ignored. No warning at runtime.
- **`./path` import + no folder**: deno resolution fails at bundle
  time with a "module not found" — loud, easy to spot.
- **Folder present + no import for it**: stale artefact from a
  previous `clone` that the user has since `install`-replaced
  without `rm -rf`'ing the directory. Harmless until the next
  `clone` of the same name re-uses the directory.

**How states get out of sync:**

- `skmtc clone @scope/gen-X` rewrites the import to `./gen-X/mod.ts`
  AND creates the folder. Then `skmtc install @scope/gen-X` rewrites
  the import back to `jsr:` — but doesn't remove the folder. The
  user is now in the silent-shadowing state.
- Hand-edited `deno.json` divergent from disk reality.
- Cloning into a previously-vendored directory without first
  cleaning it.

**Detecting + correcting:**

- `skmtc doctor` (when the consistency check lands) emits an `error`
  for each mismatch with the fix in the hint.
- The hub validates at upload (`POST .../source` returns 422 with a
  precise reason if the uploaded `deno.json` contradicts the
  uploaded folder tree).
- Manual remediation: pick the desired state, fix BOTH sides:
  - To use the pinned JSR version → import is `jsr:`, remove the
    folder.
  - To use cloned source → import is `./gen-X/mod.ts`, ensure the
    folder + `gen-X/mod.ts` exist.

Full list in
[`llms.md`, "Operational principles for proposing changes"](https://github.com/skmtc/skmtc/blob/main/deno/docs/llms.md#operational-principles-for-proposing-changes).

<!-- topic doctor-checks: What each check of skmtc doctor reads -->
## Doctor check ids

`skmtc doctor --json` output is self-describing (every check carries
`id`, `status`, `message`, `hint`); this catalogue exists for
reasoning about a specific check without running it.

| Check id | What it inspects |
|---|---|
| `cli-version-current` | The running CLI vs the newest published `@skmtc/cli` — the only registry lookup (2s bound, `skipped` when unreachable, `--offline` skips it). Names Deno's 24h minimum-dependency-age window when the newest release is still inside it, since a reinstall without `--minimum-dependency-age=0` silently resolves an older one |
| `install-lockfile` | `~/.deno/bin/.skmtc/deno.lock` — the installed CLI's version pin of `@skmtc/cli` and `@skmtc/core` |
| `deno-version` | Running Deno is ≥ 2.4.0 — the floor for the esbuild-based `deno bundle` |
| `hub-auth` | `~/.skmtc/auth.json` parses to `{ env, token }` (a file from an older CLI, `{ host, token }`, is also read) — offline only; `skipped` when not logged in, `warning` + logout/login hint when malformed; never reports more than the token's last 4 chars |
| `project-deno-json/<project>` | `deno.json` exists and parses |
| `config-names/<project>` | `warning` when the project uses a deprecated config name (`client.json`, `settings.system`; hint `skmtc migrate config <project>`) or has both `client.json` and `skmtc.config.json`; `ok` otherwise |
| `project-base-path/<project>` | `skmtc.config.json#settings.basePath` present and relative |
| `project-alias/<project>` | `settings.basePath` is the folder the app's `@/` alias points to (read from a tsconfig's `paths` or a `deno.json` import map). `warning` means generated files import each other through an alias that resolves somewhere else. `skipped` when no such file states the alias, or the project sets `settings.packages` |
| `project-core-pin/<project>` | Project's `@skmtc/core` pin matches the CLI's major.minor |
| `project-package-copies/<project>` | One copy of `@skmtc/core` and of each `@skmtc/lang-*` in the `worker.ts` module graph (`deno info --frozen`, never writes the lock); `error` names each copy and the packages that import it — two copies generate empty files, so `generate` and `bundle` refuse to build the graph; `skipped` for `serverUrl` projects, with `--offline`, or when the graph can't be read (e.g. a pin edit no build has locked yet) |
| `project-enrichments/<project>` | Last generate's `manifest.enrichmentWarnings` has no `warning`-level entries — dead enrichment config (typo'd generator id, path, method or model name) surfaces here between runs; `info` entries keep it `ok` |
| `project-worker-pin/<project>` | If `worker.ts` exists, `@skmtc/worker` is pinned (the generated worker imports it); ok-noop before the first bundle |
| `project-manifest/<project>` | `manifest.json` matches the current `@skmtc/core` schema |
| `anchors-config/<project>` | `skmtc.config.json#settings.anchors` shape; gen-maps are opt-in via `settings.anchors.enabled` |
| `anchors-coverage/<project>` | Share of manifest files carrying an attribution sidecar; `warning` below threshold |
| `anchors-staleness/<project>` | Sidecars on disk are current for the last run |
