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
output for free." Skmtc does not work this way. Every model
generator implements the whole `schemaToValueFn` — string, integer,
number, boolean, object, array, union, intersection, unknown, void, ref, custom —
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

`TypeSystemValue` is a union of these variants
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
| `TypeSystemIntersection` | `'intersection'` | `members: TypeSystemValue[]`, `modifiers` |
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
(`core/types/TypeSystem.ts`):

```ts
export type SchemaToValueFn = <Schema extends SchemaType>(
  args: TypeSystemArgs<Schema>
) => TypeSystemOutput<Schema['type']>

export type TypeSystemArgs<Schema extends SchemaType> = {
  context: GenerateContextType
  destinationPath: string
  schema: Schema
  rootRef?: RefParts
  required: boolean | undefined
}

export type SchemaType =
  | OasSchema             // the nine schema variants
  | OasRef<'schema'>      // a ref to one of them
  | OasVoid               // explicit void
  | CustomValue           // generator-injected fragment
```

The function's job: receive a schema-plus-context, switch on
`schema.type`, return the matching variant. The return type is
constrained by the input — `Schema['type'] === 'array'` mandates a
`TypeSystemArray` return.

The convention is a `switch` whose `default` assigns the schema to
`never`. Adding a new schema variant to `OasSchema` is then a compile
error in every generator that has no case for it. At run time the
`default` throws an error that names the type.

## A complete `schemaToValueFn` example

`gen-typescript`'s implementation
(`skmtc-generators/gen-typescript/src/Ts.ts`) for core 0.46. Core 0.47
adds the `'intersection'` variant, so the switch then needs a case for it:

```ts
export const toTsValue: SchemaToValueFn = ({
  schema: schemaNode,
  destinationPath,
  required,
  context,
  rootRef
}) => {
  // `schemaNode` arrives typed as the generic `Schema` parameter, and TypeScript
  // does not narrow a type parameter by discriminant. Widening it to the
  // `SchemaType` union lets the switch below narrow each case on its own —
  // generator code narrows, it does not assert.
  const schema: SchemaType = schemaNode

  const modifiers: Modifiers = {
    required,
    // description: 'description' in schema ? schema.description : undefined,
    nullable: 'nullable' in schema ? schema.nullable : undefined
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: typescriptEntry.id })

  switch (schema.type) {
    case 'custom':
      return schema
    case 'ref':
      return new TsRef({
        context,
        destinationPath,
        ref: schema,
        modifiers,
        rootRef,
        schema
      })
    case 'array':
      return new TsArray({
        context,
        destinationPath,
        modifiers,
        items: schema.items,
        generatorKey,
        rootRef,
        schema
      })
    case 'object':
      return new TsObject({
        context,
        destinationPath,
        value: schema,
        modifiers,
        generatorKey,
        rootRef
      })
    case 'union':
      return new TsUnion({
        context,
        destinationPath,
        members: schema.members,
        discriminator: schema.discriminator,
        modifiers,
        generatorKey,
        rootRef,
        schema
      })
    case 'number':
      return new TsNumber({ context, modifiers, generatorKey, schema })
    case 'integer':
      return new TsInteger({ context, integerSchema: schema, modifiers, generatorKey })
    case 'boolean':
      return new TsBoolean({ context, booleanSchema: schema, modifiers, generatorKey })
    case 'void':
      return new TsVoid({ context, generatorKey })
    case 'string':
      return new TsString({ context, stringSchema: schema, modifiers, generatorKey })
    case 'unknown':
      return new TsUnknown({ context, generatorKey, schema })
    default: {
      const _exhaustive: never = schema
      throw new Error(`Unhandled schema type: ${Reflect.get(_exhaustive, 'type')}`)
    }
  }
}
```

Then `TsProjection` exposes it as the static hook:

```ts
// skmtc-generators/gen-typescript/src/TsProjection.ts
static schemaToValueFn = (...args: Parameters<typeof toTsValue>) => {
  return toTsValue(...args)
}
```

Every other model generator (`gen-zod`, `gen-valibot`,
`gen-arktype`) has the same shape. A `toXxxValue` function
switches on `schema.type` exhaustively and returns a generator-specific
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
constructor({ context, ref, settings, rootRef }: ConstructorArgs) {
  super({ context, ref, settings })
  const schema = context.resolveSchemaRefOnce(ref)
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
// core/context/GenerateContext.ts
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
See [how-generators-produce-output.md](how-generators-produce-output.md#contextinsertnormalizedmodelmyprojection--schema-fallbackname-destinationpath-).)

## Why no default visitor?

Most codegen frameworks ship a base class implementing a default
visitor with sensible language defaults; you override only what
differs. Skmtc requires each model generator to implement the full
`schemaToValueFn` itself. The design choice is deliberate:

1. **Target-language opinions don't generalize.** `TsString.toString()`
   returns `string` (or a format-specific scalar like `Date`);
   `ZodString.toString()` returns `z.string()` (or
   `z.string().email()`); `ValibotString.toString()` returns
   `v.string()`. There is no "string handling" code path the three
   could share — the rendered fragment is entirely
   target-specific. A base visitor would just be twelve hooks
   waiting for full overrides.
2. **`schemaToValueFn` is the customization seam.** Cloning
   `gen-typescript` to swap a format mapping means editing
   `toTsValue`'s `case 'string'` directly.
   A base class would force the customizer to either subclass
   (more indirection) or wire in a config flag (the configuration
   approach Skmtc consciously rejected). See
   [clone-vs-install.md](clone-vs-install.md).
3. **Exhaustiveness is type-safe.** A `switch` on the union with a
   `never` default forces every generator to
   handle every schema variant. Adding a new variant to
   `OasSchema` produces a compile error in every generator that
   doesn't update its `schemaToValueFn` — the right place for the
   change to surface.

The cost is duplication: twelve cases in every model
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
case 'custom':
  return schema
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
case 'ref':
  return new TsRef({
    context,
    destinationPath,
    ref: schema, // the OasRef: its refName and refPath travel together
    modifiers,
    rootRef,
    schema
  })
```

The Ref Snippet is what enables cross-file linking. When a
`User` model references `Address`, the `User`'s rendered output
includes `address: Address`, and the file's `imports` map gains
`import { Address } from '...'`.

## Handling recursive types — pending entries

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
`User`, which would hit the ref to `User`, and so on. The engine
stops the cycle with a `PendingDefinition` entry. While the
constructor of a model's projection runs, `ModelDriver` keeps this
entry for that model. A reference to the model during that time finds the entry,
not a cache miss, so the engine never constructs a second
projection for it.

A ref snippet asks for its model through `toModelRef`:

```
1.  context.insertModel(ZodProjection, toSchemaComponentRef('User'))
       │
       ▼
2.  ModelDriver: cache miss  →  pending entry for User
       │
       ▼
3.  new ZodProjection({ context, ref: User's ref, ... })
       │   context.resolveSchemaRefOnce(ref)
       │   toZodValue({ schema, ... })   ← walks the User schema
       │
       │   for each ref in the schema, the ref snippet calls:
       ▼
4.  toModelRef({ context, ref, destinationPath, projection: ZodProjection, ... })
       │
       ├─ refName === 'User'     → User is pending: a reference back
       │                           ├─ { suspended: true }  (no new projection)
       │                           └─ the entry counts the reference
       │
       └─ refName === 'Address'  → not built yet: ModelDriver constructs it
                                   └─ { suspended: false, inCycle: false, definition }
       ▼
5.  isReferencedBack({ context, settings })  → true for User
       │   the projection sets settings.identifier.typeName
       ▼
6.  The constructor returns: the entry leaves the stack, the Definition goes into the file
```

The same protocol covers a cycle of two or more models. When `Employee`
refers to `Team` and `Team` refers back to `Employee`, the reference
from `Team` comes back `suspended`. The reference from `Employee` to
`Team` comes back with `inCycle: true`, because `Team` leads back to a
model whose constructor is still in progress. `isReferencedBack` is
true for `Employee`, the model that the cycle started from.

A model is inside a cycle until the whole cycle is complete. So
`inCycle` is also true when the model leads back there through models
whose constructors have returned. The references inside a cycle are thus
the same ones wherever the run enters the cycle.

The Definition takes its place in the file when the constructor
returns, after the models that the constructor added. So a `const`
always comes after the models that it refers to.

### The render-time effect

A language that reads a value when the module loads must defer each
reference inside a cycle. Zod is an example: a plain reference to a
model that the module has not defined yet fails with `Cannot access
'X' before initialization`. Any model of a cycle can be the first one that
loads, so defer on `suspended || inCycle`, not on `suspended` alone:

```ts
override toString(): string {
  // SLOT(lazy) in the skmtc-generator skeleton's MyLibRef
  return this.deferred
    ? applyModifiers(`z.lazy(() => ${this.name})`, this.modifiers)
    : applyModifiers(this.name, this.modifiers)
}
```

The modifiers go outside the lazy wrapper:
`z.lazy(() => node).optional()` gives an optional key, and
`z.lazy(() => node.optional())` does not.

TypeScript type aliases refer to themselves natively
(`type User = { friends: User[] }`), so `gen-typescript` needs no
wrapper. It still goes through `toModelRef`: a ref snippet that
constructs the model itself gets the error `'User' … is being
constructed further up the stack`.

TypeScript cannot infer the type of a `const` that refers to its own
initializer (TS7022/TS7024). So a projection that `isReferencedBack`
reports as recursive sets `settings.identifier.typeName`, for
example `z.ZodType<User>`.

### What a model-generator author must do

When you write a model generator that has a `'ref'` branch in
`schemaToValueFn`, the `Ref` Snippet must:

1. **Call** `toModelRef({ context, ref, destinationPath,
   rootRef, projection: YourProjection, variant })`. It constructs
   the model, reuses it, or returns it `suspended`. It also stitches
   the import into `destinationPath`.
2. **Take the name** from `ref.settings.identifier.name`.
3. **Defer** in `toString()` when `ref.suspended || ref.inCycle`, if
   the target language reads values at module load.

The projection, after it builds its value, calls
`isReferencedBack({ context, settings })` and sets the type
annotation if the result is true.

The `skmtc-generator` skill's skeleton (`MyLibRef.ts`,
`MyLibProjection.ts`) is a tested example of these steps, with a
self-recursive model and a cycle of two models.

### Why `ModelDriver` keeps the entry, not the Projection

`ModelDriver` puts the `PendingDefinition` entry on
`context.pendingStack` before it constructs the projection. It takes the entry
off when the constructor ends, also when the constructor throws. When
the constructor returns, the Driver adds the Definition to the file.
A projection cannot do this itself: the entry must exist before its
constructor runs.

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

`rootRef` is the ref (`RefParts`) of the top-level model that started
the current render — used to detect recursive type references. A nested
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
3. Adding a case to every existing model generator's
   `schemaToValueFn`, which does not compile without it. The `never`
   default enforces this.

The compile-error cascade is intentional. New variants don't
silently appear in some generators and not others; they appear
nowhere until every generator opts in.

### What about `gen-msw`, `gen-shadcn-form`, and other operation generators — do they have `schemaToValueFn`?

No. `schemaToValueFn` is a contract on `ModelProjection` only
(`core/dsl/model/types.ts`). Operation generators
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
