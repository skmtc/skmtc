# Producers

How to split output into producers. Each rule shows the form that goes
wrong and the form to write. The wrong forms come from real generators
that passed lint and tests.

## From output to producers

Start from the output, not from the document. `@skmtc/gen-effect-http`
writes one function for each operation:

```ts
export const getApiAccountsAccountIdD1Database = (params: typeof GetApiAccountsAccountIdD1DatabaseParams.Type) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(`/accounts/${params.accountId}/d1/database`).pipe(
      HttpClientRequest.setUrlParams({page: params.page}),
      HttpClientRequest.setHeaders({'cf-r2-jurisdiction': params['cf-r2-jurisdiction'] === undefined ? undefined : String(params['cf-r2-jurisdiction'])}),
    );
    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(GetApiAccountsAccountIdD1DatabaseResponse)(response);
  });
```

Name each part that a reader can point at. Each one is a class:

| Part of the output | Producer | Its fields |
|---|---|---|
| The function | `EffectEndpoint` (projection) | `parameters`, `request`, `response` |
| `params: typeof X.Type` | `TypedParameter` | `name`, `schemaName` |
| `const request = … ;` | `EffectRequest` | `method`, `url`, `steps`, `yields` |
| `HttpClientRequest.setUrlParams({ … })` | `UrlParamsStep` | `entries` |
| `HttpClientRequest.setHeaders({ … })` | `HeadersStep` | `entries` |
| `page: params.page` | `QueryEntry` | `name` |
| `'x': params['x'] === undefined ? … ` | `HeaderEntry` | `name` |
| `HttpClientRequest.schemaBodyJson(X)(body)` | `BodyStep` | `schemaName` |
| The two lines that read the response | `ResponseRead` | `schemaName` |
| `yield* client.execute(request);` | `ResponseVoid` | none |

A class of this kind is short. This is all of `HeadersStep`:

```ts
export class HeadersStep extends SnippetBase {
  entries: ListObject<HeaderEntry>

  constructor({ context, names }: HeadersStepArgs) {
    super({ context })

    this.entries = List.toObject(
      names.map((name) => new HeaderEntry({ context, name })),
    )
  }

  override toString(): string {
    return `HttpClientRequest.setHeaders(${this.entries})`
  }
}
```

The package has 10 classes in 487 lines. Outside its classes it has only
the config of the entry and of the base (`transform`, `isSupported`,
`toIdentifierName`, `toIdentifierType`, `toExportPath`) and
`toEnrichmentSchema`. No function returns code. Of its 26 functions and
methods, 23 have a complexity of 1.

## 1. One producer for each part a reader can name

**Wrong.** One class holds one field, `chain: List<Stringable[]>`, with
every call of the output. Its constructor is 230 lines, with each
condition inline (`summary === '' ? undefined : new CliSummary(…)`), and
a complexity of 30. Its `toString()` is `${this.chain}`. No string holds
target code, and lint is clean.

**Right.** One field for each part, and a template in the shape of the
output:

```ts
override toString(): string {
  return `${this.newCommand}
  ${this.summary}
  ${this.description}
  ${this.options}
  ${this.action}`
}
```

The constructor's complexity went from 30 to 4, and the output did not
change.

Ask of each field: "Is this a thing in the output?" `summary`,
`options` and `action` are. `chain`, `parts` and `calls` are not.

## 2. The constructor builds the parts, and `toString()` arranges them

**Wrong.** The constructor stores three names. `toString()` then builds
the parameter list, the URL, three pipeline steps and the response read
as six strings, joined with `\n` and `, `. Target code is written only
in `toString()`, so lint is clean, and each new step is one more branch
in a string join.

**Right.** Each of the six is a class (the table above). `toString()`
is one template over the fields.

A `toString()` longer than a few lines holds parts that have no class
yet.

## 3. A generator renders what the parser gives

An `allOf` that keeps a `$ref` reaches the router as one schema of type
`intersection`, with its `members`. Two generators rendered it.

**Wrong.** The first inspected and rewrote the members before it
rendered them:

```ts
this.members = buildMembers(schema, member => {
  if ('members' in member && 'discriminator' in member && member.members.some(hasNoKeys)) {
    const union = new TsUnion({ context, generatorKey, destinationPath, members: [],
      modifiers: { required: true, nullable: member.nullable }, rootRef, schema: member })
    union.members = member.members.map(toValue)
    return union
  }
  return toValue(member)
})
```

It needed functions to find the keys that no member has, to tell which
of two schemas is narrower, to merge members into one object, and to
find a loop of members. One of those files was copied into seven
packages.

**Right.** The second gave each member to the router:

```ts
this.members = schema.members.map(member => {
  return toTsValue({ destinationPath, schema: member, required: true, context, rootRef })
})
```

A target with no intersection throws from its router case, and the
message names the schema and the setting that makes the parser merge
every `allOf`:

```ts
case 'intersection':
  throw new Error(`${schema.stackTrail.toSchemaPointer()} is an allOf that keeps a $ref, which gen-effect-schema cannot render: Effect has no intersection of schemas. Set settings.system.intersections to "merge" in client.json, and the parser merges each allOf into one schema.`)
```

| For the same ten router cases | Wrong | Right |
|---|---|---|
| Source lines added | 3,455 | 227 |
| Functions added outside a class | 143 | 0 |
| Files that are copies of another | 18 | 0 |
| Branches added | 588 | 10 |
| Highest complexity of a new function | 19 | 1 |

The first version did not use three things that were there. The parser
merges an `allOf` and leaves a reference only where a merge cannot end.
`settings.system.intersections` changes which references it leaves. The
router renders any schema, so it renders a member too.

Review found nine blocking faults in the first version, and three of
them came from the fixes for the first four. Each function that reads a
schema is one more reading of the document that can disagree with the
parser's.

## 4. Choose a kind in one place

When a part has kinds, the producer that holds the part chooses, in its
constructor, and types the field as the union of the classes:

```ts
response: ResponseRead | ResponseVoid

this.response = response === null
  ? new ResponseVoid({ context })
  : new ResponseRead({ context, destinationPath, schemaName: response.name })
```

- Type the field as `ResponseRead | ResponseVoid`, not as the snippet
  base. The field then shows each case, and a new case changes the type
  where each reader sees it.
- Make two classes when the kinds differ in fields or in behavior. When
  one fact differs (`<name>` or `[name]`), keep one class with a field
  for the fact and one ternary in `toString()`.
- A schema type is chosen by the router. No class tests
  `schema.type` again.

## 5. `List` is for a real list

A real list has items of one kind, in a number the document sets:
properties, parameters, entries, steps. Build it in the constructor.
`List` leaves out an item that is `undefined`.

```ts
this.entries = List.toObject(names.map((name) => new HeaderEntry({ context, name })))
```

**Wrong.** A fixed set of different parts in one `List`, and a `List`
that always has one item.

One exception is in the skeleton. A model generator's classes keep
`members` and `properties` as the type-system contract defines them (an
array and a record that peers read), and join them in `toString()`.
Keep those as they are. Use `List` for a list of your own.

## 6. Every name is in the base

**Wrong.** A snippet builds the alias that it imports a type under:
`` const alias = `${tsType.toName()}Type` ``. The alias clashes with a
model named `NodeType` beside `Node`, and the rule that has to change is
in a file about references.

**Right.** The alias is a function in `base.ts`, beside the naming rule
it must not clash with:

```ts
export const toTypeAlias = (schemaName: string): string => `${schemaName}$Type`
```

`toIdentifierName` and `toExportPath` are statics that the engine calls
before it builds anything. Any other name the generator chooses (an
alias, a suffix, a name for a part with no name) is a function in the
same file, derived from the identifier.

## 7. The producer that uses a schema inserts it

A snippet can insert a peer through `context`:

```ts
const body = context.insertNormalizedModel(PeerProjection, {
  schema,
  fallbackName,
  destinationPath,
})
```

A projection has the same call as `this.insertNormalizedModel`, with
its own export path. Put the insert in the producer that uses the
result. A projection that does every insert for its parts grows into
the large constructor of rule 1.

## 8. Fields hold facts, and `toString()` writes the code

**Wrong.** The constructor goes from the schema to text:
`this.minLength = 'min length: ' + schema.minLength`.

**Right.** The constructor stores the fact
(`new Constraint({ keyword: 'minLength', value })`), and
`Constraint.toString()` writes the wording.

Test a value for absence with `!== undefined && !== null`. A truthiness
test (`x ? … : ''`, `x || undefined`) leaves out `minimum: 0`,
`default: false` and `title: ""`, which must render.

## 9. One class reads the document for several producers

When more than one producer needs a fact, read it in a plain class that
renders nothing and is named after what it reads: `ParameterDocument`
holds what the document says about a parameter.

- Each setting is then one statement:
  `override.required ?? document.required`.
- Give an optional input a default once (`{ override = {} }` in the
  arguments), not `override?.x` on each line.

Two constructors went from complexity 32 and 31 to 9 with this shape,
and the output did not change.

## 10. One engine

Each of these is a second copy of something in "What Skmtc already
does":

- A walk over `$ref`s in a constructor, with its own set of visited
  schemas. `toModelRef` already says which reference closes a cycle.
- A `ref` built from a string of your own. It points at a schema that
  is not in the document.
- A function that copies another generator's naming rule. Insert the
  model and read the name from the result.
- A class that renders text for a schema in an operation generator.
  That is a model generator's job, reached through an insert.

## What to expect in numbers

Complexity of each function and method in the stock generators, from
`scripts/complexity.ts` in this skill:

| Package | Functions | Mean | Median | Highest outside the router |
|---|---|---|---|---|
| `gen-effect-http` | 26 | 1.5 | 1 | 9 |
| `gen-typescript` | 52 | 1.9 | 1 | 6 |
| `gen-valibot` | 44 | 2.3 | 1 | 7 |
| `gen-zod` | 42 | 2.8 | 2 | 7 |

A router scores 14, one for each schema type, and is exempt.
