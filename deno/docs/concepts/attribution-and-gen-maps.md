# Attribution and gen-maps

> SKMTC's **provenance** subsystem. When emission is enabled, a
> generation run produces — alongside the code — a **sidecar** per
> file that maps byte ranges in the generated output back to the
> generator, schema location, and variant that produced them, plus a
> project-level **generation map** for reverse queries ("which files
> came from `User`?", "which files did `gen-zod` produce?"). It is a
> source map for provenance: generated code ↔ schema position ↔
> generator. It lives in `core/anchors/`. Capture is always on and
> cheap; emission of the on-disk artifacts is opt-in and off by
> default.

This page explains what the subsystem produces, why it exists, how
the four stages of the mechanism work, and the format of the
artifacts. For the engine pipeline it sits inside, see
[the-three-phases.md](the-three-phases.md). For the run record it
runs *alongside* (but is not part of), see
[the-manifest.md](the-manifest.md).

## The one-line definition

**Attribution** is the act of deciding, for a span of generated
text, *which generator, which schema location, and which variant
produced it*. **Gen-maps** are the two on-disk artifacts that record
those decisions: a per-file **sidecar** and a per-project
**generation map**. Attribution *capture* is always on and
unconditional; only **emission** of the on-disk artifacts is opt-in
(supply a `postPass` config to the run).

## Why it exists

SKMTC turns one schema into many files through many generators. Once
the output is on disk it is just TypeScript — nothing in the
generated text says *"this `z.string()` came from
`#/components/schemas/User/properties/email`, rendered by
`@skmtc/gen-zod`, in the `main` variant."* That linkage is lost the
moment the file is written.

Attribution preserves it. With gen-maps a tool can answer questions
that are otherwise un-answerable without re-running generation:

- **Forward** — "this line of generated code: where did it come
  from?" (sidecar: byte range → schema pointer + generator).
- **Reverse** — "I changed `User` in the schema: which generated
  files are affected?" (generation map: schema/refName → files).
- **By generator** — "which files did `gen-shadcn-form` produce?"
  (generation map: generator id → files).

The intended consumers are **downstream tooling** — a provenance
viewer, an IDE extension that shows schema-origin on hover, a
"jump to schema" command, an impact-analysis check in CI. The
engine produces the data; it does not ship a viewer.

This is the heavyweight, byte-level provenance channel. A
lighter-weight, always-on, per-`Definition` channel also exists —
the manifest's `previews` and `mappings` — see [Relationship to the
manifest](#relationship-to-the-manifests-previews-and-mappings)
below.

## The two artifacts

### The sidecar — one per generated file

A **sidecar** is a JSON document carried alongside each generated
source file, named `<filePath>.skm.json`. It records, for that file,
every **anchor** — a byte range plus the attribution of whatever
producer contributed it. A producer is a `Snippet` or `Definition`;
a file's Definitions and the Snippets nested inside them each
contribute one anchor. Sidecar granularity is therefore *byte
range* — finer than a whole file, finer than a whole Definition.

### The generation map — one per project

The **generation map** (`_map.ndjson`) is a project-level
newline-delimited-JSON index with **one row per Definition**
(landmark), not per anchor. Each row pairs a generated artifact with
the schema location, generator, and variant it came from. It is the
reverse-query index; it is wholly rewritten every run (stale rows
would mislead a viewer).

The relationship: the generation map is a *projection* of the
sidecars — `entriesForSidecar` (`core/anchors/generationMap.ts:55`)
extracts one row per landmark from each sidecar, and the run
concatenates them.

## Turning it on: `AttributionState` and `client.json`

Capture is **always on** and needs no configuration — it is intrinsic
to the pipeline (see Stages 1–2 below). What you opt into is
**emission**: the on-disk sidecars and generation map.

The engine-level config is `AttributionState`
(`core/types/AttributionState.ts`), threaded into `toArtifacts`. It
has a single field — the post-pass config:

```ts
type AttributionState = {
  postPass?: {
    parser?: ParserAdapter          // AST landmark/path resolution
    schemaSrc: string               // e.g. 'openapi.json' → sidecar.src
    generatorMeta?: GeneratorMetaLookup  // generatorId → { version, registry }
  }
}
```

- **No `postPass`** (or no `attribution` at all): capture still
  happens, but nothing is emitted — the run produces no sidecars.
- **With a `postPass` block**: the post-render pass runs and surfaces
  `sidecars` + `generationMap` on the `toArtifacts` result.

For a CLI user the switch is `client.json#settings.anchors`
(`core/types/Settings.ts`):

```jsonc
{ "settings": { "anchors": { "enabled": true, "out": ".maps" } } }
```

`out` is optional (defaults to `.maps`). The CLI flags `--anchors` /
`--no-anchors` override `anchors.enabled` for a single run.
`cli/lib/to-attribution-payload.ts` converts the `anchors` block
into the worker's `SerializableAttribution` payload.

## How it works

The mechanism has four stages: two always-on capture concerns (in
Parse and Generate), an emission pass folded into Render, and a
host-side write after the Worker returns. (The `core/anchors/` source
comments label these Phase A–D, referencing the original gen-maps
plan.)

```
PARSE ───────▶ GENERATE ─────────▶ RENDER ──────────────▶ host
  │               │                  │  └─ [post-pass]      │
Stage 1         Stage 2            Stage 3                Stage 4
location      producer-tree      resolve spans,          write
capture       instrumentation    build sidecars          .maps/
(always on)   (always on)        (when postPass set)
```

### Stage 1 — location capture during Parse

Capture is unconditional. Every parsed OAS / GraphQL node snapshots
the visitor's `StackTrail` into its `OasBase` base at construction —
`toLocation()` renders it as a JSON Pointer. This runs on every parse,
whether or not emission is configured. A producer's schema pointer is
later derived from that trail (`stackTrail.toSchemaPointer()`); a
producer with no trail of its own falls back to a coarse pointer
derived from its `generatorKey` (see
[the attribution tuple](#the-attribution-tuple)).

### Stage 2 — producer-tree instrumentation during Generate

Every DSL element extends `SnippetBase`. The constructor installs a
capturing `toString` **unconditionally**
(`core/dsl/SnippetBase.ts`) — there is no attribution flag to check at
construction time. The wrapper is a no-op *at call time* unless the
capture interval is active, gated by `this.context.captureSink`:

```ts
const capturingToString = function (this: SnippetBase): string {
  const sink = this.context.captureSink // undefined outside the capture interval
  // outside capture: just delegate to the subclass toString
  // inside capture: push onto the render stack, record parent/child
  //                 edges + byte spans into the sink, then delegate
  // ...
}
```

The capture interval is opened by Render (Stage 3) around the single
capture render. While it is open, the sink records which producer is
rendering and the parent/child edges as a parent's `toString`
interpolates a child (via `${...}`) — building the tree of every
producer that contributed to the file, and the byte span each one
occupies. Outside the interval the wrapper adds nothing observable.
Subclass authors write nothing different either way; the
instrumentation is transparent.

### Stage 3 — the post-pass (folded into Render)

There is no separate pass between Generate and Render. Render is a
single capture pass: `RenderContext` renders each file once with the
capture interval open, and — *when the run supplies
`attribution.postPass`* — immediately runs the post-pass over that
file's resolved spans. `postPass` (`core/anchors/postPass.ts`) is a
pure function over a file's text + spans; per code `File` (JSON
artifacts have no producer tree and are skipped) it:

1. Takes the byte spans the capture sink resolved from the occurrence
   tree — `{ from, to, producer }` for every contributing Definition /
   Snippet, in document order.
2. **`attribute(span.producer)`** — derives the
   `{ generatorId, schemaPointer, variant, definitionName, producerName }`
   tuple for each span (see below).
3. **Landmark + AST path resolution** — *if* a `ParserAdapter` is
   present, ascends each span to its enclosing top-level export
   (the **landmark**) and records the AST child-index **path** down
   to the span. If no parser is present (the default — see [the
   worker boundary](#the-worker-boundary--why-the-parser-is-omitted)),
   the landmark is the enclosing `Definition`'s identifier name and
   the path is empty.
4. **`buildSidecar(...)`** — pools and interns everything into the
   Sidecar v2 object.

`runPostPassForFiles` does not exist — the post-pass is not a distinct
whole-run stage; it runs inline in `RenderContext.render`, once per
File.

### Stage 4 — disk persistence on the host

The Worker returns `sidecars` and `generationMap` as fields on the
`RESULT` message, *separate from the manifest*. The host writes
them. `writeSidecars` (`core/anchors/writeSidecars.ts:59`, called
from `cli/lib/generate-local.ts`) **wholly rewrites** the output
directory each run:

```
<root>/.skmtc/<project>/.maps/
  <relative-file-path>.skm.json   ← one sidecar per generated file
  _map.ndjson                     ← project-level generation map
```

Wholly rewriting (not merging) keeps the index honest — a stale row
would point a viewer at code that no longer exists — and keeps the
mtime invariant simple for `doctor`'s staleness check.

## The Sidecar v2 format

A sidecar is **pooled and position-indexed**
(`core/anchors/sidecar.ts:66`). Rather than repeating strings, it
holds flat **pools** and an **anchor table** of integer indices into
them:

```ts
const sidecarSchema = v.object({
  v: v.literal(2),       // format version
  f: v.string(),         // file path, relative to basePath
  src: v.string(),       // schema source (e.g. 'openapi.json')
  parser: v.string(),    // "<id>@<version>" or 'none'
  R: v.array(registryEntry),   // registry pool  { host, type }
  G: v.array(generatorEntry),  // generator pool { name, version, r }
  S: v.array(v.string()),      // schema-pointer pool
  V: v.array(v.string()),      // variant pool
  L: v.array(v.string()),      // landmark pool
  P: v.array(v.string()),      // AST-path pool ('.'-joined)
  A: v.array(anchorRow),       // the anchor table
  N: v.optional(v.array(v.string())),  // producer-name pool (optional)
  An: v.optional(v.array(v.number()))  // A[i]'s producer → N (optional)
})
```

Each **anchor row** is a 7-tuple of pool indices plus a byte range
(`core/anchors/sidecar.ts:44`):

```
[ Li, Pi, gi, si, vi, fromByte, toByte ]
   │   │   │   │   │
   │   │   │   │   └─ V[vi]  variant
   │   │   │   └───── S[si]  schema pointer
   │   │   └───────── G[gi]  generator   (G[gi].r indexes into R)
   │   └───────────── P[Pi]  AST path inside the landmark
   └───────────────── L[Li]  landmark (enclosing top-level export)
```

A minimal sidecar for a file holding one `User` type, generated
worker-side (no AST parser):

```json
{
  "v": 2,
  "f": "src/types/User.generated.ts",
  "src": "openapi.json",
  "parser": "none",
  "R": [{ "host": "jsr.io", "type": "jsr" }],
  "G": [{ "name": "@skmtc/gen-typescript", "version": "", "r": 0 }],
  "S": ["#/components/schemas/User"],
  "V": ["main"],
  "L": ["User"],
  "P": [""],
  "A": [[0, 0, 0, 0, 0, 0, 142]]
}
```

The single `A` row reads: landmark `L[0]="User"`, path `P[0]=""`
(the landmark node itself), generator `G[0]`, schema pointer
`S[0]`, variant `V[0]="main"`, byte range `[0, 142)`. The pooling
pays off on real files where the same generator, variant, and
schema pointer recur across dozens of spans.

The `parser` field is the adapter id (`oxcAdapter.id` is
`"oxc@<version>"`) or the sentinel `'none'` when the AST step was
skipped — a re-anchoring consumer warns on a parser mismatch and can
detect "no landmark data" without inspecting the pools.

The format is frozen at **v2** and validated by Valibot
(`sidecarSchema`), so it round-trips reliably across the worker
boundary and on disk. Format evolution bumps `v` and ships an
adapter in the consumer.

## The attribution tuple

`attribute()` (`core/anchors/attribute.ts`) is a pure function
over a producer that yields:

```ts
type Attribution = {
  generatorId: string                 // from the generatorKey; '<unknown>' if none
  schemaPointer: string               // document-relative schema pointer ('' if none)
  variant: string                     // from the key; defaults to 'main'
  definitionName: string | undefined  // identifier name, for Definition producers
  producerName: string                // the producer's class name
}
```

`generatorId` and `variant` come from parsing the producer's
`generatorKey` (see [generators-as-packages.md](generators-as-packages.md)
for the key shapes). `schemaPointer` is resolved in priority order:

1. The producer's **own position** — `stackTrail.toSchemaPointer()`
   when its `StackTrail` is non-empty (the fine-grained pointer
   captured in Stage 1). `toSchemaPointer()` strips the run's
   operational prefix so the pointer is document-relative.
2. Otherwise, a **coarse** fallback derived from the `generatorKey`.
   Pointers are **protocol-agnostic** — no `oas:` / `gql:` prefix;
   the protocol is a property of the run's input schema, not of each
   pointer:
   - OAS operation → `#/paths/<escaped-path>/<method>`
   - GraphQL operation → `<rootKind>.<fieldName>`
   - Model → `#/components/schemas/<refName>`
   - Generator-only / no key → `''` (empty — no schema location)

Path segments are RFC 6901 JSON-Pointer escaped (`~`→`~0`,
`/`→`~1`). A producer with no `generatorKey` (a test double or a
runtime-orphaned Snippet) gets `generatorId: '<unknown>'`.
`producerName` is the producer's class name (e.g. `TsObject`),
carried in the sidecar's optional `N` / `An` pools.

## The worker boundary — why the parser is omitted

The AST step (Stage 3 step 3) needs a TypeScript/JavaScript parser.
The implemented `ParserAdapter` is `oxcAdapter`, backed by the Rust
`oxc-parser` via napi. **Native parsers do not bundle into a Deno
Worker** — `oxc-parser`'s napi `bindings.js` statically references
platform-specific `.node` files, and `tsc`'s npm package pulls in
`source-map-support`. Either makes the worker bundle unbuildable or
non-portable.

So `oxcAdapter` is deliberately **not** re-exported from
`@skmtc/core/Anchors` (importing it would poison the worker bundle);
host-side consumers import it from `@skmtc/core/Anchors/oxc`
directly.

The consequence: the **default CLI path runs the post-pass
worker-side with `parser: undefined`.** In that mode the sidecar
still carries byte ranges, attributions, generators, schema
pointers, and variants — but landmark names come from the enclosing
`Definition`'s identifier and the AST `path` is empty. Re-anchoring
a file *after a formatter has reshaped it* needs the AST paths and
so is not possible in this mode; hover, pin, and related-artifact
flows all work fine without them.

The serialization detail: `AttributionState` holds a `parser`
(function-bearing object) and a `generatorMeta` (function) — neither
survives structured clone. The wire type `SerializableAttribution`
(`worker/types.ts`) carries only plain data; `buildAttributionState`
(`worker/mod.ts:35`) reconstitutes the state worker-side, omitting
the parser by design and rebuilding `generatorMeta` from a plain
`Record`. See [the-worker-runtime.md](the-worker-runtime.md) for the
boundary in general.

A host-side post-pass that re-runs `postPass` with the real
`oxcAdapter` — to fill in true landmarks and AST paths — is a
designed-for but not-yet-wired extension.

## Where the data lives

```
<root>/.skmtc/<project>/.maps/          ← default; set by anchors.out
  src/types/User.generated.ts.skm.json
  src/forms/CreateUserForm.generated.tsx.skm.json
  ...
  _map.ndjson
```

The `.maps` subtree is **derived output** — wholly rewritten every
run, never a historical record. It should be gitignored. (The
`writeSidecars` source notes the `skmtc init` template adds it to
`.gitignore`; verify against the current `init` implementation
rather than relying on that comment.)

## `doctor` checks

`skmtc doctor` runs three gen-maps checks
(`cli/lib/doctor-anchors.ts`), each `skipped` when anchors are not
enabled:

| Check id | What it verifies |
|---|---|
| `anchors-config/<project>` | The `settings.anchors` block in `client.json` is well-formed. |
| `anchors-coverage/<project>` | Every file in `manifest.files` has a matching `.skm.json` sidecar. `ok` at ≥ 95%, `warning` below (JsonFile artifacts have no sidecar — expected). |
| `anchors-staleness/<project>` | No sidecar's mtime is older than the file it describes — a stale sidecar means the file changed without a re-generate. |

## Cost model

Capture is always on, but it is cheap; the real cost is emission,
which you opt into.

- **Capture (always on).** Parse snapshots each node's `StackTrail`
  into its `OasBase` — the trail is already carried through parse, so
  this is a reference, not new work. Every `SnippetBase` gets the
  capturing `toString`, but outside the capture interval
  (`context.captureSink` unset) it delegates straight to the subclass
  `toString` — no stack pushes, no allocation.
- **Emission (opt-in via `postPass`).** Rendering opens the capture
  interval, so the wrapper now records parent/child edges and byte
  spans; then the post-pass resolves spans, attributes each, and
  builds the sidecar, and the host writes `.maps/`. This is where the
  cost lives, and it runs only when the run supplies
  `attribution.postPass`.

There is no cross-run state — like every SKMTC run, an
attribution-enabled run is from cold (see
[the-worker-runtime.md](the-worker-runtime.md)).

## Public API surface

Building tooling on this subsystem? The contract is
`@skmtc/core/Anchors` (`core/anchors/mod.ts`):

- **Types** — `Sidecar`, `RegistryEntry`, `GeneratorEntry`,
  `AnchorRow`, `GenerationMapEntry`, `Span`, `Attribution`,
  `ParserAdapter`, `LandmarkLocation`.
- **Schemas** — `sidecarSchema`, `anchorRow`, `generatorEntry`,
  `registryEntry`, `generationMapEntry` (Valibot; use for
  validation / round-trip).
- **Functions** — `postPass`, `writeSidecars`, `entriesForSidecar`,
  `toNdjson`, `parseNdjson`, `emptySidecar`.

`AttributionState` is exported from `@skmtc/core/AttributionState`.
`oxcAdapter` is host-only, at `@skmtc/core/Anchors/oxc` (never
import it into worker-bundled code).

Internal helpers — `resolveSpans`, `attribute`, `buildSidecar`'s
interning — are deliberately not exported; they are load-bearing for
`postPass` but not part of the cross-package contract.

## Status and limitations

The subsystem is **partially wired**. Working today: the opt-in
config, the render-time instrumentation, sidecar emission, the
generation map, disk persistence, and the `doctor` checks.

Not yet wired in the default path:

- **AST-quality landmarks and paths.** The default (worker-side)
  post-pass runs without a parser; landmarks are Definition
  identifiers and AST paths are empty. The host-side post-pass with
  `oxcAdapter` is designed for but not yet wired.
- **Generator version metadata.** `cli/lib/to-attribution-payload.ts`
  currently leaves `generatorMeta` undefined, so generator pool
  entries land with `version: ''` and a default `jsr.io` registry.
  Populating it from the project's `deno.json` + lockfile is planned.

When reasoning about or extending this subsystem, verify the wiring
in `cli/lib/generate-local.ts` and `worker/mod.ts` against the
current source — this is an actively evolving area.

## Relationship to the manifest's `previews` and `mappings`

Sidecars are **not part of the manifest**. They are a parallel
output: `sidecars` / `generationMap` are separate fields on the
`toArtifacts` result, written to `.maps/`, while the manifest is
written to `.settings/manifest.json`. Two distinct provenance
channels exist, by design:

| | `previews` / `mappings` (manifest) | gen-maps (sidecars) |
|---|---|---|
| Opt-in? | Always on (if a generator implements the hooks) | Opt-in via `anchors` |
| Granularity | Per `Definition` | Per byte range |
| Carries | A module + a source descriptor (operation/model) | Full anchor table, AST paths, generator version |
| Lives in | `manifest.json` | `.maps/*.skm.json` + `_map.ndjson` |
| Consumer | A UI listing generated artifacts | A viewer mapping code spans ↔ schema |

Use `previews` / `mappings` for "list what was generated and roughly
where it came from"; use gen-maps for "trace this exact span of
code." See [the-manifest.md](the-manifest.md#previews-and-mappings--for-tooling).

## Common questions

### Are sidecars committed to the repo?

No. The `.maps` subtree is derived output — it should be gitignored,
and it is wholly rewritten each run. If you need provenance history,
capture the `.maps` tree (or the `sidecars` result field) per run
yourself — the same way the manifest must be captured for run
history.

### Does enabling attribution change the generated code?

No. Render is unchanged by attribution. The instrumentation only
*observes* rendering (it caches `_rendered` and records parent/child
edges); it never alters output. An attribution-on run and an
attribution-off run produce byte-identical artifacts.

### Why does the worker-side sidecar say `"parser": "none"`?

Native parsers do not bundle into a Deno Worker, so the worker-side
post-pass runs without one. Byte ranges and attribution are still
recorded; AST landmarks/paths are not. See [the worker
boundary](#the-worker-boundary--why-the-parser-is-omitted).

### What is a "landmark"?

The top-level export a span lives under — a `Definition`'s name
(`User`, `createUser`). With a parser, it is resolved from the AST;
without one, it is the enclosing `Definition`'s identifier. A span
outside any landmark (empty landmark string) is skipped by
`buildSidecar` — it has nothing stable to re-anchor from.

### Can a generator opt a single file out of attribution?

No. Attribution is a run-level switch. Every code `File` in a run
either gets a sidecar or none do. `JsonFile` artifacts never get
one (they have no producer tree).

### How does the generation map dedupe one Definition across many anchors?

`entriesForSidecar` emits one row per unique landmark, preferring
the anchor whose AST path is empty (the landmark node itself). If no
path-empty anchor exists — rare; happens when a Definition's text
was reshaped between render and post-pass — it falls back to the
first anchor for that landmark, so the Definition still appears in
the map.

## Further reading

- [The three phases](the-three-phases.md) — the Parse / Generate /
  Render pipeline the post-pass sits between
- [The worker runtime](the-worker-runtime.md) — the structured-clone
  boundary that forces the parser-omitted worker-side post-pass
- [The manifest](the-manifest.md) — the run record, and the
  lighter-weight `previews` / `mappings` provenance channel
- [Generators as packages](generators-as-packages.md) — `generatorKey`
  shapes, which `attribute()` parses for `generatorId` / `variant`
- [The StackTrail](the-stack-trail.md) — the parse-phase position
  stack behind Stage 1 location capture
- [`skmtc-architecture` skill §9](../skills/skmtc-architecture/SKILL.md)
  — the compressed mental model for infrastructure builders
- Source: `core/anchors/` (the subsystem), `core/dsl/SnippetBase.ts`
  (instrumentation), `core/context/CoreContext.ts` (post-pass
  wiring), `cli/lib/doctor-anchors.ts` (the `doctor` checks)
