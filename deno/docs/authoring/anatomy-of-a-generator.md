# Anatomy of a generator

> The one-page map of a generator's parts — what each file is, how the
> parts run, and what keeps a generator maintainable as it grows. Read
> this before the authoring tutorials; every page in this tree assumes
> the vocabulary introduced here.

Start with the part that surprises people. This is real rendering code
from `gen-tanstack-query-fetch-zod`, the class that renders each query
function:

```ts fragment
override toString(): string {
  const { path, method } = this.operation

  return `async () => {
    const res = await fetch(\`${toPathTemplate(path)}\`, {
      method: '${method.toUpperCase()}'
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(error)
    }

    const data = await res.json()

    return ${this.zodResponseName}.parse(data)
  }`
}
```

There is no AST builder and no template file. The template is a
TypeScript template literal that reads like the output, with holes —
and every hole is a typed field the compiler checks. That is the whole
authoring model in miniature: a generator is ordinary TypeScript whose
classes know how to print themselves. The rest of this page names the
parts around that class.

## The parts

A generator is a package (JSR-published or cloned into your project)
with a canonical layout:

```
gen-x/
├── deno.json                 ← identity + peer dependencies
├── mod.ts                    ← thin re-export of the entry
└── src/
    ├── mod.ts                ← the ENTRY — how the engine calls you
    ├── base.ts               ← naming + path SEAMS — what clones edit
    ├── enrichments.ts        ← Valibot schema for user options
    ├── MyProjection.ts       ← the PROJECTION — a named, filed artifact
    └── MySnippet.ts          ← SNIPPETS — anonymous fragments (optional)
```

Five parts matter when you're writing code; `deno.json`/`mod.ts` are
packaging (see
[generators-as-packages](../concepts/generators-as-packages.md)).

**The entry (`src/mod.ts`)** declares what the generator operates on —
one of `toModelEntry` (per schema component), `toOasOperationEntry`
(per operation), or `toGqlOperationEntry` — and provides two hooks:
`isSupported` (the capability gate) and `transform` (the per-item
hook). `transform` produces nothing by returning — it works entirely by
side effect, inserting Projections into the run:

```ts fragment
transform({ context, operation }) {
  context.insertOperation({ projection: MyProjection, operation })
}
```

**The base (`src/base.ts`)** binds the generator's naming and placement
conventions: `toIdentifierName` (what output is called) and
`toExportPath` (which file it lands in). The values in here are
deliberately hardcoded — they are the primary seams you edit after
`skmtc clone`, which is why changing them has its own how-tos
([export paths](how-to/change-export-paths.md),
[identifier conventions](how-to/change-identifier-conventions.md)).

**The enrichments schema (`src/enrichments.ts`)** declares the options
users can set per operation or model in `client.json` — the
configuration surface, validated with Valibot. See
[add enrichment options](how-to/add-enrichment-options.md).

**The Projection** is the named artifact: it extends the base, its
constructor walks the schema into typed fields, and its `toString()`
renders them — the code at the top of this page. A Projection has an
identifier and an export path; that pair is what other generators can
ask for.

**Snippets** are the anonymous fragments a Projection composes —
sections of output with no name and no file of their own. A form
Projection might hold one field Snippet per schema property; each
Snippet renders its own section and registers its own imports.

## How the parts run

The engine walks every (generator × item) pair, calling `isSupported`
then `transform`. Each inserted Projection is constructed once —
and during construction it inserts the definitions *it* depends on,
which either constructs them in turn or reuses ones already
registered. Names, files, and cross-file imports all resolve through
that insert call; rendering happens at the end, when every file
serializes its accumulated definitions. The mechanism — files as keyed
maps, insert as create-or-reuse, why generation order can't matter —
is one short page:
[Definitions and files](../concepts/definitions-and-files.md).

Two facts to internalize before your first generator, because they
invert other tools' models
([how generators produce output](../concepts/how-generators-produce-output.md)):

- `transform` returns `void`. Output happens through `context.insert*`
  and `register` side effects, never through return values.
- Writing a Projection class does nothing by itself. Projections run
  only when something inserts them.

## What keeps a generator maintainable

The stock generators converge on five structural habits. They're not
enforced by types — but generators that follow them stay small, and
generators that don't accumulate parallel bookkeeping that drifts.

**The producer is the model.** A Projection or Snippet holds its data
as typed fields set in the constructor, and `toString()` renders those
fields. There is no separate data-record layer walked first and
rendered later, and no file of string-returning render functions — in
`gen-zod`, `ZodString`'s constructor-set fields (`enums`, `format`,
constraints) *are* the model of a string schema, and `toString()` is
its representation.

**Each section registers its own imports.** A Snippet's constructor
calls `register({ imports })` for exactly what its own output uses —
`ZodString` registers `zod: ['z']` itself; nothing else knows zod is
needed. Presence of a section then implies presence of its imports,
with no central bookkeeping to drift. A per-file import collector is
the tell that sections have drifted into plain functions.

**Choose an output shape once.** When one producer renders differently
by case (query vs mutation; the request-body forms), the constructor
picks the Snippet once and stores it in one union-typed field —
`gen-tanstack-query-supabase-zod`'s `TanstackQuery` holds
`client: PaginatedQueryEndpoint | QueryEndpoint | MutationEndpoint`,
chosen by a single `match(operation)`. After that choice, no other
code asks "which kind is this?" — a new shape is a new Snippet class
plus one new arm at the choosing site.

**Decisions are fields.** An ordering, naming, or membership decision
is computed once — in a constructor — and stored; `toString()` reads
it and never re-derives it. Two sites deriving the same decision will
disagree after the next change.

**Small producers, composed.** Prefer one definition per producer, and
start breaking out producers rather than growing files — `gen-zod` is
thirteen small Snippet files, one construct each. Snippets exist for
composition; what prevents reuse is almost always a producer that got
big, not output that's genuinely unique.

## Where to go next

- [Tutorial 01: Cloning a generator](tutorials/01-cloning-a-generator.md)
  — the on-ramp; your first edit to a real generator
- [Tutorial 02: Authoring a model generator](tutorials/02-authoring-a-model-generator.md)
  — build the five parts yourself, smallest case first
- [Projections and Snippets](../concepts/projections-and-snippets.md)
  — the two-level DSL in depth
- [Generators as packages](../concepts/generators-as-packages.md) —
  the packaging half: deno.json, peer pins, publishing, cloning
- [Languages](../concepts/languages.md) — where TypeScript enters the
  class hierarchy, and what a lang package owns
