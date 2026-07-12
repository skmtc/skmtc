# The type system

> The intermediate representation a model generator uses to turn an
> `OasSchema` into target-language output. Each variant of
> `OasSchema` is mapped to a structurally matching `TypeSystemValue`
> by the generator's own `schemaToValueFn` — a complete, exhaustive
> switch on `OasSchema`'s discriminator every model generator writes
> itself. There is no default visitor.

If you have worked with code generators that ship a base schema
visitor with overridable per-type hooks (openapi-generator's
`AbstractTypeScriptCodegen`, graphql-codegen's
`BaseVisitor`/`BaseTypesVisitor`, etc.), the default expectation is:
"I extend the base, override `visitStringSchema`, get TypeScript
output for free." SKMTC does not work this way. Every model
generator implements the whole `schemaToValueFn` — string, integer,
number, boolean, object, array, union, unknown, void, ref, custom —
itself.

This page covers what the type system is, how `schemaToValueFn`
works, how a generator's variant classes wear two hats (a
structurally-typed `TypeSystemValue` and a `Stringable` Snippet),
and where the engine calls `schemaToValueFn` from.

For *who runs and when*, see
[how-generators-produce-output.md](how-generators-produce-output.md).
For *how output composes*, see
[stringable-composition.md](stringable-composition.md). For
*OasSchema variants*, see
[reference: oas-schema-variants](../reference/api/oas-schema-variants.md).
This page covers *how a model generator turns one into the other*.

## The one-line definition

`TypeSystemValue` is a discriminated union of variant shapes —
`TypeSystemString`, `TypeSystemArray`, `TypeSystemObject`,
`TypeSystemUnion`, `TypeSystemRef`, `TypeSystemCustom`, … — that
sit between an `OasSchema` (the parsed schema) and the rendered
target-language code. A model generator declares a static
`schemaToValueFn: SchemaToValueFn` that takes a schema-and-context
bag and returns the matching variant value. The engine invokes
this function on demand to fill peer generators' inline schemas.

## Where the type system fits

The pipeline-level view:

```
OasSchema (Parse output)
       │
       ▼
schemaToValueFn(schema)           ← the model generator's switch on schema.type
       │
       ▼
TypeSystemValue                   ← the IR, structurally matches the union
       │
       │  In stock generators, the value is also a Snippet
       │  (TsString, ZodObject, etc.) — same instance plays both roles.
       ▼
Stringable composition            ← interpolated into a Definition.value
       │
       ▼
File body                         ← serialized by File.toString() at Render
```

The type system is the *generator-side* representation. Each model
generator owns its own `schemaToValueFn` and decides how each
OasSchema variant becomes target-language code. The return type is
structural: `TypeSystemOutput<Schema['type']>`, a mapped-type lookup
keyed by the discriminator.

## The structural shapes

`TypeSystemValue` is a union of twelve variants
(`core/types/TypeSystem.ts`):

| Variant | Discriminator | Carries |
|---|---|---|
| `TypeSystemString` | `'string'` | `format?`, `enums?`, `modifiers` |
| `TypeSystemInteger` | `'integer'` | `modifiers` |
| `TypeSystemNumber` | `'number'` | `modifiers` |
| `TypeSystemBoolean` | `'boolean'` | `modifiers` |
| `TypeSystemNull` | `'null'` | `modifiers` |
| `TypeSystemArray` | `'array'` | `items: TypeSystemValue`, `modifiers` |
| `TypeSystemObject` | `'object'` | `objectProperties?`, `recordProperties?`, `modifiers` |
| `TypeSystemUnion` | `'union'` | `members: TypeSystemValue[]`, `discriminator?`, `modifiers` |
| `TypeSystemRef` | `'ref'` | `name`, `modifiers` |
| `TypeSystemCustom` | `'custom'` | `value: Stringable` |
| `TypeSystemVoid` | `'void'` | (no payload) |
| `TypeSystemUnknown` / `TypeSystemNever` | `'unknown'` / `'never'` | (no payload) |

Each is a structural type — no class hierarchy, no `extends`. A
generator's variant class (e.g. `TsString`) satisfies
`TypeSystemString` by having `type: 'string'`, `format`, `enums`,
and `modifiers` as fields. TypeScript's structural matching does
the rest.

This is the same "discriminated union of sibling shapes" design as
`OasSchema`. The discriminator field is the entry into
type-narrowing; there is no `BaseTypeSystemValue`. See the
[OAS schema variants reference](../reference/api/oas-schema-variants.md)
for the parallel design on the parsed-schema side.

## The `SchemaToValueFn` contract

Every model generator must expose a static `schemaToValueFn` on
its Projection class. The signature
(`core/types/TypeSystem.ts:607`):

```ts
export type SchemaToValueFn = <Schema extends SchemaType>(
  args: TypeSystemArgs<Schema>
) => TypeSystemOutput<Schema['type']>

export type TypeSystemArgs<Schema extends SchemaType> = {
  context: GenerateContextType
  destinationPath: string
  schema: Schema
  rootRef?: RefName
  required: boolean | undefined
}

export type SchemaType =
  | OasSchema             // the eight schema variants
  | OasRef<'schema'>      // a ref to one of them
  | OasVoid               // explicit void
  | CustomValue           // generator-injected fragment
```

The function's job: receive a schema-plus-context, switch on
`schema.type`, return the matching variant. The return type is
constrained by the input — `Schema['type'] === 'array'` mandates a
`TypeSystemArray` return.

The convention is to use exhaustive pattern matching, typically
through `ts-pattern`'s `.exhaustive()`, so that adding a new
schema variant to `OasSchema` produces a compile error in every
generator that doesn't handle it.

## A complete `schemaToValueFn` example

`gen-typescript`'s implementation
(`skmtc-generators/gen-typescript/src/Ts.ts:16-82`):

```ts
export const toTsValue: SchemaToValueFn = ({
  schema, destinationPath, required, context, rootRef
}) => {
  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined
  }
  const generatorKey = toGeneratorOnlyKey({ generatorId: typescriptEntry.id })

  return match(schema satisfies SchemaType)
    .with({ type: 'custom' }, custom => custom)
    .with({ type: 'ref' }, ref => new TsRef({ context, destinationPath, refName: toRefName(ref.$ref), modifiers, rootRef }))
    .with({ type: 'array' }, ({ items }) => new TsArray({ context, destinationPath, modifiers, items, generatorKey, rootRef }))
    .with({ type: 'object' }, matched => new TsObject({ context, destinationPath, value: matched, modifiers, generatorKey, rootRef }))
    .with({ type: 'union' }, ({ members, discriminator }) => new TsUnion({ context, destinationPath, members, discriminator, modifiers, generatorKey, rootRef }))
    .with({ type: 'number' }, () => new TsNumber({ context, modifiers, generatorKey }))
    .with({ type: 'integer' }, integerSchema => new TsInteger({ context, integerSchema, modifiers, generatorKey }))
    .with({ type: 'boolean' }, booleanSchema => new TsBoolean({ context, booleanSchema, modifiers, generatorKey }))
    .with({ type: 'void' }, () => new TsVoid({ context, generatorKey }))
    .with({ type: 'string' }, stringSchema => new TsString({ context, stringSchema, modifiers, generatorKey }))
    .with({ type: 'unknown' }, () => new TsUnknown({ context, generatorKey }))
    .exhaustive()
}
```

Then `TsProjection` exposes it as the static hook:

```ts
// skmtc-generators/gen-typescript/src/TsProjection.ts:30-32
static schemaToValueFn = (...args: Parameters<typeof toTsValue>) => {
  return toTsValue(...args)
}
```

Every other model generator (`gen-zod`, `gen-valibot`,
`gen-arktype`) has the same shape: a `toXxxValue` function that
matches `schema.type` exhaustively and returns a generator-specific
Snippet per branch. They share the *protocol* (`SchemaToValueFn`)
but agree on no implementation.

## The two roles a variant class plays

Notice in the example: each branch returns `new TsString(...)`,
`new TsArray(...)`, etc. — *Snippet* class instances, not plain
object literals. The classes are designed to fit two contracts at
once:

1. **Structural match for `TypeSystemValue`.** `TsString` has
   `type: 'string' as const`, plus `format`, `enums`, `modifiers`.
   Any code that wants to inspect "is this an integer or a string?"
   can read `value.type` and narrow normally.
2. **`Stringable`.** `TsString.toString()` returns the rendered
   TypeScript fragment (`'string'`, `'string' | null`,
   `'admin' | 'user'`, etc.). Once you interpolate
   `${value}` into a parent template, the string is what lands in
   the output.

```ts
// skmtc-generators/gen-typescript/src/TsString.ts
export class TsString extends TsSnippet {
  type = 'string' as const          // ← satisfies TypeSystemString
  format: string | undefined         // ← satisfies TypeSystemString
  enums: string[] | undefined        // ← satisfies TypeSystemString
  modifiers: Modifiers               // ← satisfies TypeSystemString

  override toString(): string {       // ← satisfies Stringable
    // ... format/enum-aware rendering with applyModifiers
  }
}
```

One instance, two roles. This is what lets `schemaToValueFn`
return values that are simultaneously typed IR and composable
Snippets. A generator that wanted plain object literals (without a
`toString` method) could return them — but it would then need a
separate rendering step. The stock generators chose unified
classes for the same reason the rest of the DSL does:
template-literal composition.

## Modifiers — required, not optional

Every typed `TypeSystemValue` carries a `modifiers` field
(`core/types/Modifiers.ts`):

```ts
export type Modifiers = {
  required?: boolean
  nullable?: boolean
  description?: string
}
```

The polarity is **`required`**, not `optional` — the same as OAS's
field requirement semantics. So:

- `modifiers.required === true` → field appears as `name: T`
  (no `?`).
- `modifiers.required === false` or `undefined` → field appears
  as `name?: T` (with `?`).
- `modifiers.nullable === true` → type gains `| null`.

`gen-typescript`'s `withOptional` (`src/withOptional.ts`) shows
the consumption pattern:

```ts
export const withOptional = (value: Stringable, { required }: Modifiers): string => {
  if (required) return `${value}`
  const valueStr = `${value}`
  const needsParens = valueStr.includes(' | ')
  return needsParens ? `(${valueStr}) | undefined` : `${valueStr} | undefined`
}
```

The polarity matters because the natural TS reflex —
`if (modifiers.optional)` — reads `undefined`, which is falsy,
which gives the wrong branch. The correct check is
`if (!modifiers.required)`.

## Where `schemaToValueFn` is called from

Two call sites:

### 1. The generator's own Projection constructor (top-level)

When a model generator's Projection is constructed (via cache miss
in `ModelDriver`), the constructor calls its own `schemaToValueFn`
on the schema being rendered:

```ts
// skmtc-generators/gen-typescript/src/TsProjection.ts
constructor({ context, refName, settings, rootRef }: ConstructorArgs) {
  super({ context, refName, settings })
  const schema = context.resolveSchemaRefOnce(refName, TypescriptBase.id)
  this.value = toTsValue({
    schema, required: true, destinationPath: settings.exportPath,
    context, rootRef
  })
}
```

The static `schemaToValueFn` exposes the same function for external
callers; the constructor uses the local helper directly. Either
works.

### 2. `context.insertNormalizedModel` (inline schemas)

When a peer generator (a form generator, an MSW handler, etc.)
needs the model generator's representation of an *inline* schema
(one without a `$ref`), it calls
`context.insertNormalizedModel(MyProjection, { schema, fallbackName, destinationPath })`.
The engine then calls the projection's `schemaToValueFn`:

```ts
// core/context/GenerateContext.ts:782-787
const value = projection.schemaToValueFn({
  context: this,
  schema,
  destinationPath,
  required: true
})
```

`insertNormalizedModel` wraps the result in a `Definition` and
registers it. The static `schemaToValueFn` is the contract that
makes inline-schema cross-generator coordination work — without
it, the engine couldn't construct a `Definition` for a schema
that has no `$ref` of its own.

(If the schema *is* a `$ref`, `insertNormalizedModel` delegates to
`insertModel` instead, which goes through the full Driver flow —
including the constructor's own internal `schemaToValueFn` call.
See [how-generators-produce-output.md](how-generators-produce-output.md#contextinsertnormalizedmodelmyprojection-schema-fallbackname-destinationpath).)

## Why no default visitor?

Most codegen frameworks ship a base class implementing a default
visitor with sensible language defaults; you override only what
differs. SKMTC requires each model generator to implement the full
`schemaToValueFn` itself. The design choice is deliberate:

1. **Target-language opinions don't generalize.** `TsString.toString()`
   returns `string` (or a format-specific scalar like `Date`);
   `ZodString.toString()` returns `z.string()` (or
   `z.string().email()`); `ValibotString.toString()` returns
   `v.string()`. There is no "string handling" code path the three
   could share — the rendered fragment is entirely
   target-specific. A base visitor would just be eleven hooks
   waiting for full overrides.
2. **`schemaToValueFn` is the customization seam.** Cloning
   `gen-typescript` to swap a format mapping means editing
   `toTsValue`'s `with({ type: 'string' }, ...)` branch directly.
   A base class would force the customizer to either subclass
   (more indirection) or wire in a config flag (the configuration
   approach SKMTC consciously rejected). See
   [clone-vs-install.md](clone-vs-install.md).
3. **Exhaustiveness is type-safe.** A `ts-pattern`
   `.exhaustive()` call on the union forces every generator to
   handle every schema variant. Adding a new variant to
   `OasSchema` produces a compile error in every generator that
   doesn't update its `schemaToValueFn` — the right place for the
   change to surface.

The cost is duplication: eleven match arms in every model
generator. The benefit is independence — each generator's
`schemaToValueFn` fits the target language without negotiation
with a shared base.

## `CustomValue` — the escape hatch in the union

`SchemaType` includes `CustomValue` alongside the OAS-derived
variants. `CustomValue` is a DSL primitive that wraps an arbitrary
`Stringable` (`core/dsl/CustomValue.ts`). When `schemaToValueFn`
encounters `{ type: 'custom' }`, the conventional behavior is to
return it unchanged:

```ts
.with({ type: 'custom' }, custom => custom)
```

This makes `schemaToValueFn` a no-op for custom values — they pass
through with whatever rendering they already had. The use case is
generator-injected fragments that don't correspond to any OAS
schema: a typed scalar mapping that needs `Date`, a `Required<T>`
utility wrapper, etc. The injecting code wraps the fragment in
`CustomValue` and feeds it into `schemaToValueFn` like any other
schema-shaped input.

## Refs in `schemaToValueFn`

`SchemaType` also includes `OasRef<'schema'>`. Most generators
handle it as a separate branch that produces a `TypeSystemRef`
(or a generator-specific `TsRef`, `ZodRef`, etc.) carrying the
referenced name. The Ref's `toString()` typically renders just the
identifier name, while its constructor registers an import from
the ref's destination file:

```ts
// gen-typescript schemaToValueFn
.with({ type: 'ref' }, ref => new TsRef({
  context, destinationPath,
  refName: toRefName(ref.$ref),
  modifiers, rootRef
}))
```

The Ref Snippet is what enables cross-file linking. When a
`User` model references `Address`, the `User`'s rendered output
includes `address: Address`, and the file's `imports` map gains
`import { Address } from '...'`.

## Handling recursive types — the `modelDepth` counter

A naive `schemaToValueFn` would infinitely recurse on
self-referential schemas:

```yaml
User:
  type: object
  properties:
    name: { type: string }
    friends:
      type: array
      items: { $ref: '#/components/schemas/User' }
```

Rendering `User` would hit the ref to `User`, which would render
`User`, which would hit the ref to `User`, and so on. The pipeline
breaks the cycle with a per-`(generatorId, refName)` counter on
`GenerateContext`:

```ts
// core/context/GenerateContext.ts:279
modelDepth: Record<string, number>
```

`ModelDriver` brackets every model render with a known-zero state,
and `resolveSchemaRefOnce` increments the counter when the
Projection's constructor asks for its schema:

```
1.  context.insertModel(ZodProjection, 'User')
       │
       ▼
2.  new ModelDriver({ projection: ZodProjection, refName: 'User', ... })
       │
       ├─ ModelDriver.ts:79  →  modelDepth['@skmtc/gen-zod:User'] = 0
       │
       │   (cache miss path)
       ▼
3.  new ZodProjection({ context, refName: 'User', ... })
       │
       ▼
4.  context.resolveSchemaRefOnce('User', '@skmtc/gen-zod')
       │
       │   GenerateContext.ts:1467  →  modelDepth['@skmtc/gen-zod:User']++
       │                                                          (now 1)
       ▼
5.  toZodValue({ schema, ... })   ← walks the User schema
       │
       │   for each ref encountered in the schema:
       ▼
6.  new ZodRef({ refName, ... })
       │
       │   ZodRef.ts:27  →  is modelDepth['@skmtc/gen-zod:<refName>'] > 0?
       │
       ├─ refName === 'User'      → YES (was set to 1 in step 4)
       │                            ├─ skip recursion (no new ModelDriver)
       │                            └─ terminal = true  → renders as z.lazy(() => User)
       │
       └─ refName === 'Address'   → NO (different key, value is 0/undefined)
                                    ├─ recurse: new ModelDriver({ refName: 'Address', ... })
                                    │   which brackets *its* counter at 0,
                                    │   increments to 1, etc.
                                    └─ terminal = false → renders as Address (no wrapper)
       ▼
7.  ZodProjection constructor returns
       │
       ▼
8.  ModelDriver.ts:93  →  modelDepth['@skmtc/gen-zod:User'] = 0  (cleanup)
```

The depth counter is, in practice, **binary** — always 0 or 1.
The `> 0` check in `ZodRef`/`TsRef` is the cycle break: it asks
"am I currently inside this `refName`'s render?" The `Record<string, number>`
type leaves headroom for a future depth-N budget, but the current
design uses it as a presence flag.

### The render-time effect

`ZodRef.toString()` wraps the terminal branch in `z.lazy`:

```ts
// skmtc-generators/gen-zod/src/ZodRef.ts:56-59
override toString(): string {
  const out = applyModifiers(this.name, this.modifiers)
  return this.terminal ? `z.lazy(() => ${out})` : out
}
```

The wrapper is **Zod-specific**. Zod evaluates the schema graph
eagerly at module load time, so a recursive reference would reach
an undefined name during initialization. `z.lazy(() => User)`
defers the lookup until the schema is actually used.

`TsRef.toString()` does *not* wrap:

```ts
// skmtc-generators/gen-typescript/src/TsRef.ts:50-52
override toString(): string {
  return applyModifiers(this.name, this.modifiers)
}
```

TypeScript type aliases self-reference natively
(`type User = { friends: User[] }` works without ceremony), so no
wrapper is needed. The depth check still runs — without it,
`TsRef`'s constructor would recursively invoke `ModelDriver` for
the same `refName` and blow the stack — but the rendered output
is identical to a non-recursive ref.

Other target languages diverge similarly: `gen-valibot` wraps in
`v.lazy(() => ...)`, `gen-arktype` uses ArkType's thunk syntax,
and so on. The cycle-break is universal; the render-time
expression of "this is a deferred reference" varies by language.

### What a model-generator author must do

When you write a model generator that has a `'ref'` branch in
`schemaToValueFn`, the `Ref` Snippet must:

1. **Check** `context.modelDepth[`${yourGeneratorId}:${refName}`] > 0`
   **before** recursing into `new ModelDriver(...)`. Without this,
   the first self-referential schema in the input will stack-
   overflow.
2. **On terminal (`> 0`)**: look up the peer's settings via
   `context.toModelContentSettings({ refName, projection: YourProjection })`
   and capture the identifier name. Do **not** construct a new
   `ModelDriver` — the outer one is already handling this
   `refName`.
3. **On non-terminal**: instantiate `new ModelDriver({ context,
   refName, destinationPath, projection: YourProjection, rootRef })`
   normally. The recursive case is the common case for most refs;
   the terminal case only fires on actual cycles.
4. **In both branches**, register the import from the peer's
   `exportPath` into `destinationPath`. Even terminal refs need
   the import to resolve at consumer compile time.
5. **In `toString()`**, wrap terminal refs in your target
   language's lazy primitive (`z.lazy(() => Name)`,
   `v.lazy(() => Name)`, etc.) if the language requires it.
   Non-terminal refs render as the bare identifier.

Failing step 1 stack-overflows on the first recursive schema.
Failing step 5 produces a runtime module that fails on `import`
time evaluation (for Zod/Valibot) or never terminates (for
arrays-of-self type evaluation, in extreme cases).

### Why `ModelDriver` does the bracketing, not the Projection

The two `modelDepth = 0` assignments in `ModelDriver.ts:79` and
`ModelDriver.ts:93` bracket the entire Projection-construction
window. They run regardless of whether the inner Projection
constructor throws.

If a Projection tracked its own depth, two separate `insertModel`
calls for the same `refName` (e.g., two consumer Projections both
asking for `User` independently) could leave depth in an
indeterminate state. `ModelDriver` runs once per `insertModel`
call and brackets the work with a known-zero state, so the
counter is always reliable across nested invocations.

Operation Drivers don't need this. OAS operations and GraphQL
operations are leaf entities — operations can reference models,
but operations can't reference other operations. The recursion
only fans out within the model graph.

## Common questions

### Why is `required: boolean | undefined` and not just `boolean`?

`undefined` is the "not yet specified" case — when
`schemaToValueFn` is called from a context that hasn't decided
requirement-ness (e.g., a top-level schema where the
property-vs-not distinction doesn't apply). Branches typically
treat `undefined` like `false` (optional). The explicit `undefined`
lets `schemaToValueFn` preserve "unknown requirement" through
nested calls instead of coercing it.

### What's `rootRef` for?

`rootRef` is the top-level `RefName` that started the current
render — used to detect recursive type references. A nested
schema whose `schemaToValueFn` call encounters a `$ref` back to
`rootRef` can render a self-reference rather than recursing into
infinite expansion. Most generator branches just thread it through
to child constructors and inspect it only inside the `ref` branch.

### Why does `schemaToValueFn` take `destinationPath`?

So that each branch can register imports against the file where
the rendered output will land. A `TsRef` whose target lives at
a different file path needs to register the cross-file import on
`destinationPath`. `schemaToValueFn` threads the path down so
every constructor has it without re-deriving from the projection's
settings.

### Can I add a new schema variant?

Adding a variant to `OasSchema` means:

1. Extending the `OasSchema` union with the new variant class.
2. Extending `TypeSystemValue`, `SchemaToTypeSystemMap`, and
   `TypeSystemOutput` with the matching variant shape.
3. Every existing model generator's `schemaToValueFn` fails to
   compile until its match arm covers the new variant (the
   `.exhaustive()` call enforces this).

The compile-error cascade is intentional. New variants don't
silently appear in some generators and not others; they appear
nowhere until every generator opts in.

### What about `gen-msw`, `gen-shadcn-form`, and other operation generators — do they have `schemaToValueFn`?

No. `schemaToValueFn` is a contract on `ModelProjection` only
(`core/dsl/model/types.ts:81`). Operation generators
(`OasOperationProjectionBase`, `GqlOperationProjectionBase`) don't
have it because operations aren't schema variants — they're path-
and-method-keyed entities. Operation generators that need to
render a schema *property* delegate to a model generator via
`context.insertNormalizedModel(SomeModelProjection, { schema, fallbackName, destinationPath })`,
which calls the model generator's `schemaToValueFn` on their
behalf.

### Why is `OasVoid` in `SchemaType` but not in `OasSchema`?

`OasVoid` is the explicit "no value" — typically the response
body type for endpoints that return nothing. It can appear in
positions where a schema would normally go (a response body, a
request body), so `schemaToValueFn` must handle it. But it isn't
a schema variant in the OAS sense (no JSON Schema construct
produces it), so it lives outside `OasSchema` and gets included in
`SchemaType` as a separate union arm.

### `TypeSystemCustom.value` is a `Stringable` — can I put anything in it?

Yes. `CustomValue` wraps an arbitrary `Stringable`. Generators use
it for things like `Required<UserBody>`, type-only imports of
external libraries, or any fragment whose shape doesn't fit a
JSON-Schema variant. The trade is that consumers can't introspect
it — the value is opaque past its `toString()`. Save it for the
escape-hatch cases; reach for a structured schema first.

### Should each `schemaToValueFn` branch return a class instance or a plain object?

Convention in stock generators is class instances (Snippet
subclasses). Two reasons: (a) the class doubles as a Stringable
for interpolation, avoiding a separate render step; (b) the
class's constructor is where side effects like
`register({ imports })` happen, which is the right place for
"this fragment depends on importing X."

A `schemaToValueFn` implementation could return plain object
literals if rendering happens elsewhere — but you'd need to either
re-traverse the value to register imports or accept that imports
go through some other channel. The class-as-Snippet convention
keeps the side effects co-located with the rendering.

## Further reading

- [How generators produce output](how-generators-produce-output.md)
  — `GenerateContext.toArtifacts` and `insertNormalizedModel`, the
  call sites that invoke `schemaToValueFn` for inline schemas
- [Composing output with Stringable](stringable-composition.md) —
  how a returned `TsString` / `ZodString` / etc. composes into a
  parent template
- [Projections and Snippets](projections-and-snippets.md) — the
  DSL classification that variant classes live under
- [Refs and resolution](refs-and-resolution.md) — `OasRef` in
  `schemaToValueFn` and the lazy resolution it enables
- [The GraphQL pipeline](the-graphql-pipeline.md) — how GraphQL
  types are mapped onto this same `OasSchema` vocabulary; custom
  scalar configuration via the `format` field
- [Reference: OAS schema variants](../reference/api/oas-schema-variants.md)
  — the parsed-schema union `schemaToValueFn` reads from
- [Reference: projection-bases](../reference/api/projection-bases.md)
  — the `ModelProjection` factory the static `schemaToValueFn`
  hangs off
- [Anatomy of a generator](../authoring/anatomy-of-a-generator.md) —
  orientation for authoring and cloning generators
