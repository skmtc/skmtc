---
name: skmtc-generator
version: 0.17.0
description: >
  Write and edit Skmtc generators: packages that turn an OpenAPI
  document into application code as a tree of producer classes. Use
  before you write or change any generator source: a new generator, a
  cloned one, a schema type or an operation kind it does not render
  yet, names and export paths, enrichments, another generator's
  output, or an edge case it renders wrongly.
metadata:
  describes:
    '@skmtc/core': '0.54'
    '@skmtc/lang-typescript': '0.15'
---

# Write a Skmtc generator

Skmtc derives application code from an OpenAPI document. A **generator**
is a small package that the engine runs over every **model** (a schema,
by its `ref`) and every **operation** (`path` + `method`) of the
document. The engine writes every generated file again on each run, so
you change the generator and never its output.

## A generator is a tree of producers

A **producer** is a class with a constructor and a `toString()`.

- The constructor takes one part of the document and stores what that
  part is made of as fields: other producers, and plain facts such as a
  name, a method or a flag.
- `toString()` arranges those fields into target code. It reads its own
  fields and nothing else.

A **projection** is a producer that owns one named definition in a file.
A **snippet** is a producer for a part inside a definition. Your code
builds producers while the engine generates. The engine calls
`toString()` once for each file, at the end.

`@skmtc/gen-effect-http` writes this for `POST /search`:

```ts
export const createApiSearch = (body: typeof SearchRequest.Type) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = yield* HttpClientRequest.post("/search").pipe(
      HttpClientRequest.schemaBodyJson(SearchRequest)(body),
    );
    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(CreateApiSearchResponse)(response);
  });
```

These producers build it:

```
EffectEndpoint                       the function            projection
├─ parameters   List<TypedParameter> (body: typeof … .Type)
├─ request      EffectRequest        const request = … ;
│  └─ steps     List<UrlParamsStep | HeadersStep | BodyStep>
│                                    one line inside .pipe( … )
└─ response     ResponseRead | ResponseVoid
                                     the last two lines
```

```ts
// EffectEndpoint
override toString(): string {
  return `${this.parameters} =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    ${this.request}
    ${this.response}
  })`
}
```

Each part that a reader of the output can name is a class. Each field
is a thing in the output: `parameters`, `request`, `response`. A new
kind of step is a new class and one line in `EffectRequest`. No function
in the package returns code, and the mean complexity of its functions is
1.5 (`scripts/complexity.ts` in this skill measures it).

## Why producers

Code that builds output from functions and joined strings is correct for
the common cases and wrong for the rest. Text has no imports, the engine
cannot reuse it, and another generator cannot refer to it. A function
that inspects or rewrites a schema does the parser's work a second time,
and takes one more branch for each case it meets.

A producer handles its case once. Each place that has the part gets it,
with its imports. A new case is a new class and one case in the router.
The classes that exist do not change.

## What Skmtc already does

Most of a generator's hard problems are solved before your code runs.
**Before you write a function that reads the document, find its job in
this table.** If the job is here, use what does it.

| Job | Use | What it gives you |
|---|---|---|
| Merge an `allOf`, read `oneOf` and `anyOf` as a union, resolve each `$ref`, remove what a broken `$ref` holds | The parser. A `settings.parse` key (`allOf`, `anyOf`, `intersections`, `danglingRefs`) changes how it reads | A schema you render as it is, with no code that inspects, repairs, merges or compares schemas |
| Choose the code for a schema type | Your **router**: one `switch (schema.type)` with a `never` default, which returns a producer | Each class reads typed fields from a narrowed schema. A new type is a compile error until it has a case and a class |
| Build a model once, wherever it is used | `insertModel`, `toModelRef` | One definition and one import for each model. You hold its name |
| Give an inline schema (a body, a parameters object, a response) a definition | `insertNormalizedModel` with a `fallbackName` | The model generator renders it. You hold its name |
| Find a cycle, and the reference that must be lazy | `toModelRef` (`suspended`, `inCycle`) and `isReferencedBack` | No walk of the document and no set of visited schemas |
| Write the imports of a file | `this.register({ imports })` for a library. Nothing for an insert | Imports that match what the file uses |
| Know a name or a path before anything is built | The base's statics, `toIdentifierName` and `toExportPath`, in `base.ts`. Other files read `settings.identifier` and `settings.exportPath` | One place to change a name. Other generators find your definition |
| Read an operation's parameters, body and response | `toParams`, `toParametersObject`, `toRequestBody`, `toSuccessResponse` on the operation | The path item's parameters merged in, the JSON media type chosen, a `$ref` resolved |
| Join a list and leave out absent items | `List`, built in the constructor | Separators and brackets in one place |
| Put a string from the document into code | `handleKey`, `sanitizeIdentifier`, `toStringLiteral`, `toPathTemplate` (`references/typescript.md`) | Correct quotes and escapes for any character |
| Make more than one definition from one subject | Variants. Pass `variant` on | Names and files that stay apart |
| Take a setting from the consumer | Enrichments, declared as a schema | A wrong value fails the run and names its place in `skmtc.config.json` |
| Catch two definitions that claim one name | The engine: `Registered definition mismatch` | Nothing to write |
| Report a fault in the document | The parser: issues in the manifest | Nothing to write |

Four jobs are yours, and each has one place:

| Your decision | Its one place |
|---|---|
| Which producer renders a part that has kinds (a response with a body, a response with none) | The constructor of the producer that holds the part |
| A name you derive from the identifier (an alias, a suffix) | A function in `base.ts`, beside the statics |
| Optional and nullable | The modifiers, applied once where the value renders |
| A fact that several producers read | One plain class, named after what it reads from the document |

## Read first

1. **Your twin.** A stock generator already does the nearest job. Open
   it before you write a line, and copy its shape, names and order.

   | You write | Start from |
   |---|---|
   | A model generator: each schema becomes a validator, a schema value or a type | `skeleton/` in this skill. Copy it and fill its slots |
   | An operation generator that builds a function: a client call, a handler | `@skmtc/gen-effect-http`: `EffectEndpoint.ts` and the nine classes beside it |
   | An operation generator for a hook over a model generator | `@skmtc/gen-tanstack-query-fetch-zod` |
   | A form or other UI for each operation | `@skmtc/gen-shadcn-form` |
   | Many operations in one file (an accumulator) | `@skmtc/gen-msw`, `@skmtc/gen-express` |
   | A class for one schema type | The class for that type in `skeleton/src/` or `@skmtc/gen-effect-schema` |

   Get the source with `skmtc clone <project> -g @skmtc/<name>`, or read
   it at `https://jsr.io/@skmtc/<name>`.

2. **The reference for your path** (next section).

3. **Signatures.** Skmtc has almost no presence in training data, so
   read a signature and never recall one:
   `deno doc jsr:@skmtc/core@<pinned version> <Symbol>`. Read it in
   place of a cast around a type error too.

## Pick your path

1. **A new model generator.** Read
   [references/model.md](references/model.md).
2. **A new operation generator.** Read
   [references/operation.md](references/operation.md).
3. **A change to a generator that exists**, yours or a clone. Find the
   job in the tables above, open the file that holds it, and read the
   reference for that generator's shape.

Every path uses these when the work reaches them:

- [references/producers.md](references/producers.md): how to split
  output into producers, with the wrong form and the right form of each
  rule. Read it before you write the first class.
- [references/engine.md](references/engine.md): read it before you use
  another generator's output, add an enrichment or an option, pass a
  variant on, or write many subjects into one file.
- [references/typescript.md](references/typescript.md): read it before
  you register an import, choose an identifier kind, or put a string
  from the document into code.

Every path ends with [references/finish.md](references/finish.md).

## Steps

1. **Write the output by hand** for two subjects that differ: an
   operation with a body and one without, or an object and a union.
   Done when each file would compile in the target project.
2. **Name the parts.** Mark each part of that output that a reader can
   name. List one producer for each, with its fields. Done when every
   line of the hand-written output belongs to one producer in the list,
   and every field names a thing in the output.
3. **Give each need its owner.** List each thing in that output that is
   not fixed text: a name, an import, another schema's code, a list, a
   lazy reference, a value from the consumer. Beside each, write the row
   of "What Skmtc already does" that supplies it. Done when every item
   has a row, or is one of your producers.
4. **Write identity first**: `base.ts`, with the name and the export
   path of each definition. Done when no other file builds a name or a
   path.
5. **Build the producers from the leaves up.** Run the generator after
   each one. Read the import header of an output file first, then the
   body. Done when the output matches what you wrote in step 1.
6. **Finish** with [references/finish.md](references/finish.md).

## When a case does not fit

An edge case shows that a decision has no place yet. Give it its place:

1. **A part renders wrongly for some subjects.** The part needs its own
   producer, or a second producer for the other kind. Add the class, and
   choose between the two in one place.
2. **A schema type or a keyword has no rendering.** Add a case to the
   router and a class for it.
3. **A name is wrong or clashes.** Change the static in `base.ts`.
4. **You need the code or the name of another schema.** Insert it.
5. **The document is ambiguous or broken.** Render what the parser
   gives. If your target has no form for it, throw from the router case
   and name the schema's pointer and the `settings.parse` key that
   changes the parse. Code that detects, repairs, merges or compares
   schemas is the parser's.
6. **None of these fits.** The engine lacks something. Stop, and report
   the case and what you need from the engine.

Three signs that you have left this path: a function that takes a schema
and returns a schema or a yes or no about it; the same condition in two
places; a second function written to correct the first.

## Rules for every path

- **Two methods.** A producer has a constructor and `toString()`. The
  one exception is the method that adds to an accumulator
  (`references/engine.md`).
- **A field is a part or a fact.** `summary`, `options` and `action`
  are parts. `chain`, `parts` and `lines` hold everything and name
  nothing.
- **Target code is written in `toString()`**, as one template over the
  fields, in the shape of the output.
- **`List` is for a real list**: items of one kind, in a number the
  document sets. A fixed set of different parts is a template over named
  fields.
- **Only `undefined` and `null` are absent.** `0`, `false`, `''` and
  `[]` are values, and they render.
- **Name an operation from its method and path**, with core's
  `toEndpointName`. `operationId` is the document author's and changes
  without notice.
- **Read the document through its methods**: `isRef()`, `resolve()`,
  `toParams()`, `toRequestBody()`. Do the same thing the same way as
  the code around you.
- **A function outside a class needs a reason a class cannot give**:
  the router, the config of the entry and of the base, an identity
  function in `base.ts`, a type guard on raw input.
- **Complexity of 10 or less for each function.** The router is exempt.
  A constructor above 10 holds two concepts.
- **Generate only what the document changes.** Code that is the same
  for every document is a hand-written file in the project.
- **Render does not run Prettier or Biome.** No formatter runs in the
  engine. Read the raw output, and format after generation.

## When you're done

1. **Generate from a real document**, not only from fixtures. Read the
   manifest: the definitions you expect, at the paths you expect, with
   no errors.
2. **Lint.** `deno lint`, with `jsr:@skmtc/lint-plugin` in the
   generator's `deno.json`. No findings.
3. **Measure.**
   `deno run --allow-read --allow-env <this skill>/scripts/complexity.ts <generator>/src`
   exits 0.
4. **Test.** Run the generator's tests and type-check the generated
   output in the target project.
5. **Do the finish pass** in
   [references/finish.md](references/finish.md) on your diff.
6. **Report** each command with its exit code, what you could not
   check, each function you wrote for a job that the table gives to
   Skmtc, each thing the engine lacked, and each place where this skill
   or the docs were wrong or silent. `skmtc feedback` sends the last two
   to the Skmtc team as a public issue, so put no tokens or personal
   data in it.
