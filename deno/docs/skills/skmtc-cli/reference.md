# skmtc-cli — reference companion

Pull-loaded detail for the `skmtc-cli` skill: the settings file's
full shape, the filter semantics, the JSON envelopes agents parse,
the user-facing operational principles, and the doctor check ids.
Sections keep their historical numbers (§6/§7/§8/§11) — SKILL.md §6
points here; the numbers do not map onto v2's own section numbering.

Read this when you are editing `client.json`, writing a filter,
parsing `--json` output, or checking a principle — not before.

## 6. The client.json shape

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

    // Allow-list. Empty array = no filter. See §7.
    "include": [],

    // Deny-list. Applied after include. See §7.
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
    // to basePath, no `..` — rejected at config load otherwise).
    // When `packages` is set, basePath is the monorepo root and `@`
    // is per-package: intra-package imports render `@/…` (rooted at
    // that package), cross-package imports render the target's
    // `moduleName`. See `reference/settings/client-json-schema.md`.
    "packages": [
      { "rootPath": "packages/models/src", "moduleName": "@app/models" }
    ]
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
  // Stack scope — one leaf shared across every generator.
  "_stack": { "apiTitle": "Billing API" },

  "@skmtc/gen-zod": {
    // Generator scope — a run-constant for gen-zod only.
    "_generator": { "strict": true },

    // Subject scope — per-model, unchanged. `'main'` is the
    // default variant.
    "Pagination": { "main": { "coerce": true } }
  }
}
```

Per-subject enrichments are otherwise unchanged: the routing keys and
the mandatory `'main'` variant level (see the `client.json` shape above
and §7) work exactly as before. A generator reads each scope by known
key through typed helpers (`toStackEnrichment` /
`toGeneratorEnrichment` / the per-subject path) — it never iterates the
enrichments record itself.

`packages` is optional; omit it for the common single-`basePath`
project. With `packages` set, point `basePath` at a common ancestor
of every package (the monorepo root) so each `rootPath` — and every
generator's `toExportPath` — is a plain forward path. A `..` segment
in `basePath` or any `rootPath` is rejected at config load: it means
`basePath` is too deep, and hand-counting `../` segments is the
silent-misplacement footgun the forward-path rule removes.

## 7. Skip and include filters

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

## 8. Common JSON output shapes

Agents drive on these shapes. Discriminator field is usually `type`.

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

`clone` includes a **pre-flight `@skmtc/core` peer-pin check** — if
the project's pin doesn't match the CLI's major.minor, the command
refuses with exit 2 before any state mutation. `--force` overrides
(at the user's risk).

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
  // Shape: [traceId, spanId, "generate", generatorId, identifier]
  "errors": [
    ["trace-1778185255674", "span-1778185255674", "generate",
     "@skmtc/gen-zod", "BrokenModel"]
  ],
  "parseIssues": [
    { "protocol": "oas", "level": "warning", "type": "MISSING_OBJECT_TYPE",
      "location": "components:schemas:User", "message": "..." }
  ]
}
```

With `--typecheck`, gains a `typecheck` field (`{ type: "passed" | "failed" | "no-tsconfig" | "tsc-error" | "skipped", ... }`).
A `failed` typecheck → exit 1; generated files stay on disk.

**`--watch` and `--json` are mutually exclusive.** `--json` writes a
single result and exits; `--watch` is a long-running stream. Passing
both → exit 2 with a recipe error.

### `publish`

```jsonc
// Success — a StackVersion was published. No deploymentId/shortId:
// versions are addressed by semver.
{
  "type": "published",
  "projectName": "my-api",
  "bundlePath": ".skmtc/my-api/server.js",
  "bundleBytes": 1228801,
  "bundleSha256": "e3b0c44298fc1c14...",
  "stack": { "account": "ada", "slug": "my-api" },
  "version": "3.0.1",
  "versionUrl": "https://skmtc.dev/ada/stacks/my-api/versions/3.0.1",
  "sourceFileCount": 28,
  "sourceTotalBytes": 96512
}

// Failure — `stage` pinpoints where:
//   "version"  — no deno.json#version and no --version (fails before
//                any network call)
//   "identity" — GET /v1/user failed (usually a bad PAT)
//   "bundle"   — local Deno bundling / source collection failed
//   "publish"  — POST .../versions failed (commonly 409: that version
//                is already published; versions are immutable — bump
//                and re-publish)
{
  "type": "failed",
  "projectName": "my-api",
  "reason": "version 3.0.1 is already published for ada/my-api — ...",
  "stage": "publish"
}
```

## 11. Operational principles (user-facing subset)

Selected from the full operational principles in `llms.md`. These are
the ones most likely to override default LLM intuitions during CLI
work:

| Default intuition | SKMTC's stance |
|---|---|
| Add a config flag to customize a stock generator | Use `skmtc clone` and edit the source |
| Run Prettier in the pipeline | Don't — produce valid TS; consumer formats separately |
| Restart from scratch when something's off | Run `skmtc doctor --json` first; targeted fix beats nuke-and-pave |
| Manually edit `bundle.js` or `worker.ts` | They're derived; run `skmtc bundle` to regenerate |
| Mock the database in tests | Use real Supabase / real DB (project convention) |
| Use `process.env.X` | Use `Deno.env.get('X')` — Deno codebase |
| Use `skmtc deploy` to put a stack on the hub | The command is `skmtc publish` — `deploy` no longer exists. Stacks are published as immutable semver versions (`POST /v1/stacks/{account}/{stack}/versions`); there is no deploymentId/shortId/production alias in the CLI. Deployments and the `production` alias belong to hub *projects*, driven from the web app. |
| After bumping to `@skmtc/core@0.5.0+`, treat the existing operation-level enrichment as still-valid | Wrap each `[id][path][method]` block in `{ "main": { … } }`. The variant level is now mandatory whenever an operation-level block exists — the engine throws at start with `"must include a 'main' variant"` if it's missing. See `concepts/variants.md`. |
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

Background: friction log entry `2026-05-28-composition-consistency-and-cloned-prefix.md`.

Full list in [`../../llms.md#operational-principles-for-proposing-changes`](../../llms.md#operational-principles-for-proposing-changes).

## Doctor check ids

`skmtc doctor --json` output is self-describing (every check carries
`id`, `status`, `message`, `hint`); this catalogue exists for
reasoning about a specific check without running it.

| Check id | What it inspects |
|---|---|
| `cli-version-current` | The running CLI vs the newest published `@skmtc/cli` — the only check that reaches the network (2s bound, `skipped` when unreachable, `--offline` skips it). Names Deno's 24h minimum-dependency-age window when the newest release is still inside it, since a reinstall without `--minimum-dependency-age=0` silently resolves an older one |
| `install-lockfile` | `~/.deno/bin/.skmtc/deno.lock` — the installed CLI's version pin of `@skmtc/cli` and `@skmtc/core` |
| `deno-version` | Running Deno is ≥ 2.4.0 — the floor for the esbuild-based `deno bundle` |
| `hub-auth` | `~/.skmtc/auth.json` parses to `{ host, token }` — offline only; `skipped` when not logged in, `warning` + logout/login hint when malformed; never reports more than the token's last 4 chars |
| `project-deno-json/<project>` | `deno.json` exists and parses |
| `project-base-path/<project>` | `client.json#settings.basePath` present and relative |
| `project-core-pin/<project>` | Project's `@skmtc/core` pin matches the CLI's major.minor |
| `project-bundle/<project>` | `bundle.js` exists — every project (remote-only included) generates from it; warning with a `skmtc bundle` hint when missing |
| `project-enrichments/<project>` | Last generate's `manifest.enrichmentWarnings` has no `warning`-level entries — dead enrichment config (typo'd generator id, path, method or model name) surfaces here between runs; `info` entries keep it `ok` |
| `project-worker-pin/<project>` | If `worker.ts` exists, `@skmtc/worker` is pinned (the generated worker imports it); ok-noop before the first bundle |
| `project-manifest/<project>` | `manifest.json` matches the current `@skmtc/core` schema |
| `anchors-config/<project>` | `client.json#settings.anchors` shape; gen-maps are opt-in via `settings.anchors.enabled` |
| `anchors-coverage/<project>` | Share of manifest files carrying an attribution sidecar; `warning` below threshold |
| `anchors-staleness/<project>` | Sidecars on disk are current for the last run |
