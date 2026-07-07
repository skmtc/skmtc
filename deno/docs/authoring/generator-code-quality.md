# What good generator code looks like

> Status: DRAFT (2026-06-12), provisional home — Dmitri will place it
> properly later. Mined from the endorsed reference generators
> (gen-typescript, gen-zod, gen-valibot, gen-shadcn-form,
> gen-tanstack-query-fetch-zod, gen-tanstack-query-supabase-zod,
> gen-shadcn-table, gen-shadcn-select, gen-supabase-hono, gen-msw) by
> contrast with gen-kotlin-sdk's request-body milestone, whose source
> drifted while its output stayed byte-perfect. Working record and
> violation walkthrough: `notes/lang/33` (not committed).
>
> Every rule carries a positive citation from a reference generator
> and (where one exists) a violation citation from gen-kotlin-sdk. A
> rule that cannot cite an exemplar pair does not get added.

## Rule 0 — Speak SKMTC

Rules, reviews, and design discussion are written in SKMTC
vocabulary: **Projection, Snippet, producer (= a Projection or
Snippet), Definition, Identifier, `toString()`, `register`,
`insertOperation` / `insertModel`, entry, enrichment**. If a rule or
a design can only be stated in imported
vocabulary ("renderer", "delegate", "dispatch site", "domain layer"),
that is the tell that the idea came from somewhere else and has not
been re-derived from how SKMTC actually works. Re-derive it from the
reference generators first; usually the skill already has a card for
it in the right words.

## Rule 1 — The producer IS the model; output renders via `toString()`

SKMTC does not split code into models and renderers — each producer
represents both the model and its representation. The constructor
walks the spec into typed fields (which are often OTHER producers);
`toString()` is that model's representation. The two are never
separate: there is no parallel data-record layer walked first and
rendered later, and no file of string-returning render functions.

- ✅ `gen-zod/src/ZodString.ts` — the constructor-set fields (`enums`,
  `format`, `constraints`) ARE the model of a string schema;
  `toString()` is its representation. `toZodValue` routes schema
  shapes to producers; it never builds records.
- ✅ `gen-tanstack-query-supabase-zod/src/QueryEndpoint.ts` — shared
  state across output positions is a child PRODUCER whose fields the
  parent reads (`${this.queryFn.parameter}` and `${this.queryFn}`),
  not a record passed to several renderers.
- ❌ `gen-kotlin-sdk/src/model/SdkModel.ts` + `toSdkModel.ts` (and the
  `SdkParams` / `SdkService` records) — inert data records produced by
  walkers and consumed by section Snippets. The model/renderer split
  smuggled back in one level deeper than the render functions were.

When one piece of data feeds many sections (a model's field list
feeding the constructor, accessors, builder, validate, equals), the
SKMTC answer is a producer holding that data as fields — sections
read the producer's fields. Derivation decisions (naming, ordering,
requiredness axes) happen once, in its constructor.

### Where functions remain legitimate

Functions appear in exactly two supporting positions in the reference
generators, and only those:

- **Routers** that CONSTRUCT Snippets — `toZodValue`
  (`gen-zod/src/Zod.ts`), `schemaToField`
  (`gen-shadcn-form/src/schemaToField.ts`). They normalize (unwrap the
  single-member intersection, resolve refs), then one exhaustive
  branch per schema shape builds one Snippet, forwarding the typed
  schema. They never build strings.
- **Leaf grammar helpers** used *inside* a `toString()` —
  `applyModifiers` (`gen-zod/src/applyModifiers.ts`), `List`,
  `withDescription`. Small, stateless wraps of already-rendered
  content.

A file of functions whose return values are output text is the
violation, no matter how pure the functions are.

- ✅ `gen-tanstack-query-supabase-zod/src/QueryEndpoint.ts` — fields
  set in the constructor, `toString()` interpolates them.
- ❌ `gen-kotlin-sdk/src/model/renderModel.ts`,
  `src/params/renderParams.ts` — ~1,300 lines of string-returning
  section functions. (The KS-C spec in `notes/lang/32` said
  "section-snippet set"; the implementation drifted to functions, and
  every other violation below follows from that one wrong turn.)

## Rule 2 — Each section of output is a Snippet that registers its own imports

A Snippet's constructor walks exactly the inputs its construct needs
and calls `register({ imports, destinationPath })` for exactly what
its own output uses. Presence of a section then *implies* presence of
its imports — no bookkeeping. A central per-file import collector is
the symptom of sections having been written as functions: with real
section Snippets the collector does not get fixed, it ceases to
exist.

- ✅ `gen-zod/src/ZodString.ts` — registers `zod: ['z']` itself;
  nothing else knows zod is needed.
- ❌ `gen-kotlin-sdk/src/model/modelImports.ts` and `toParamsImports`
  in `src/params/SdkParamsValue.ts` — central fact-collectors walking
  the data to reconstruct what the sections will need.

## Rule 3 — Several output shapes = one field typed as a union of Snippets

When one producer renders differently by shape (query vs mutation;
the three request-body forms), the orchestrator's constructor chooses
ONCE and stores the chosen Snippet in one union-typed field;
`toString()` delegates. After that choice, **no other code in the
producer asks "which kind is this?"**. A new shape is a new Snippet
class plus one new arm at the choosing site — nothing else moves.
(This is the skmtc-generator skill's "One Projection, several output
shapes" card.)

A router function is the same rule in function position: one place
per axis that picks the Snippet.

- ✅ `gen-tanstack-query-supabase-zod/src/TanstackQuery.ts:15` —
  `client: PaginatedQueryEndpoint | QueryEndpoint | MutationEndpoint`,
  chosen by one `match(operation)`.
- ❌ `gen-kotlin-sdk/src/params/renderParams.ts` — the request-body
  shape is re-tested in ~8 sibling places (constructor-parameter
  lines, builder variables, `from()` lines, setter blocks, build
  arguments, accessors, `_body()`, equals-member list, plus the
  import collector). Adding a fourth body shape means finding all of
  them.

## Rule 4 — Small producers, composed

Prefer one definition per producer. Three or four definitions inside
one projection is acceptable when necessary; at five or more, start
breaking them out into their own producers. Snippets are designed for
composition and re-use, and there is rarely so much variety in
generator code that re-use is impossible — what prevents re-use is
massive producers.

Longer files quickly accumulate complexity; the remedy is structural
(break out producers), not a line-count lint.

- ✅ `gen-zod` — thirteen small Snippet files, one construct each;
  private sibling Snippets (`ZodObjectProperties`, `ZodRecord`) stay
  unexported inside the one file that uses them.
- ❌ `gen-kotlin-sdk/src/model/renderModel.ts` (~700 lines),
  `src/params/renderParams.ts` (~650) — every section of two file
  families in one module each.

## Rule 5 — Decisions are fields

An ordering, naming, or membership decision is computed once — in a
constructor or walker — and stored; `toString()` reads it and never
re-derives it. Two sites deriving the same decision will disagree
after the next change.

- ✅ `gen-zod/src/ZodObject.ts` — property order is fixed once in the
  constructor's map; `toString()` iterates the stored entries.
- ❌ `gen-kotlin-sdk/src/params/renderParams.ts` — `allNames()`
  re-encodes the constructor-parameter order that
  `renderParamsConstructorParameters` already decided; the
  wire-name-vs-Kotlin-name choice for `checkRequired` / `checkKnown` /
  `getRequired` is made inline at each call site instead of living on
  the field data.

## Rule 6 — Config needs a named counterpart and a citation

(For corpus-parity generators like gen-kotlin-sdk, where config
mirrors the upstream tool's config.) A config field is legitimate iff
its doc comment names BOTH the upstream-config concept it mirrors AND
the corpus evidence that forced it. A knob for an output variation we
merely suspect exists is illegitimate. When better evidence reveals a
universal rule, the knob is deleted — that motion is expected
(precedent: `pathParamDescriptions`, added and deleted in one session
when the real rule turned out to be "path/header params document from
the schema description, query params from the parameter").

## Rule 7 — Empirical rules carry their evidence

Every rendering rule derived from corpus observation carries a
`// corpus: <file>` comment, with the site count when thin
(`n=1`). An unanchored empirical rule cannot be falsified at review
time.

## Hygiene (lintable, necessary, not the definition of good)

- No `as` outside tests; narrow with guards (skill §4).
- `switch` + exhaustive `never` on unions; no if/else-if chains ≥3
  (routers may use guard-chains for their normalize steps only).
- No module-scope mutable state (the dual-copy hazard).
- No abbreviations in names.
- Process: no scripted bulk edits to source without an end-to-end
  re-read of the result.

## How this is enforced

Two processes run together on gen-kotlin-sdk (and future
corpus-parity generators):

1. **Output parity** — byte-diff of generated output against the
   pinned corpus SDK (ktfmt-normalized). This is the behavior gate.
2. **Source quality** — review against these rules. The parity gate
   makes behavior-preserving restructuring cheap to verify: if the
   regenerated tree is byte-identical, the restructure is safe.

A change that improves parity but adds a rule violation does not get
banked: green twice or not at all.
