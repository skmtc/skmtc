# Projections and Snippets

> The DSL's two-level model: named exportable artifacts (Projections) and
> anonymous embedded fragments (Snippets). Both descend from `SnippetBase`. The
> distinguishing question is whether the unit of output needs a name at file
> scope.

A Projection produces an `export const X = …` declaration. A Snippet produces a
fragment that gets spliced into a Projection's body via template-literal
interpolation. The split makes file-scope identity a deliberate choice, not a
default.

## The one-line distinction

A Projection has a name and a file. A Snippet has neither.

Projections produce `export const NAME = VALUE;` (or `export type NAME = …;`)
declarations. They're addressable, importable, and participate in
cross-generator coordination through the `(name, exportPath)` cache. Snippets
produce JSX elements, function bodies, type fragments, or any other
stringifiable value that gets _embedded into_ a Projection.

## Why two levels?

The split maps onto JSX components vs JSX expressions. Top-level React
components have names, get imported by other modules, and exist in their own
files. JSX expressions (`<Button onClick={...} />`) are anonymous and embedded
in their parent's rendering. SKMTC's DSL makes the same cut.

The alternative — a single "unit" abstraction — would force every snippet to
have a name and a path, even ones that exist only as an inline `<StringField />`
JSX element. That's overhead with no benefit to the cross-generator coordination
story (which only needs file-scope items in its cache). The two-level split
keeps the cache small and the authoring ergonomics natural.

## Projections

The full-citizen class for unit-of-output:

- Subclasses one of three projection bases: `ModelProjectionBase`,
  `OasOperationProjectionBase`, or `GqlOperationProjectionBase`
- Has a class-level `id` (the generator package name)
- Has static methods on the class: `toIdentifier`, `toExportPath`,
  `toEnrichments`, `toEnrichmentSchema`
- Has instance properties: `settings: ContentSettings` (= identifier +
  exportPath + enrichments), plus `context` and `generatorKey`
- Has instance methods inherited from the base: `insertOperation`,
  `insertModel`, `insertNormalizedModel` (these auto-fill `destinationPath` from
  `this.settings.exportPath`)

Drivers wrap a Projection's output value in a `Definition`, which produces the
`export const NAME = VALUE;` statement. The Projection's `toString()` produces
just the VALUE; the wrapping is automatic.

### Examples in stock generators

- `ZodProjection` (`gen-zod`) — produces
  `export const userBody = z.object({...})`
- `TsProjection` (`gen-typescript`) — produces `export type UserBody = { ... }`
- `ShadcnForm` (`gen-shadcn-form`) — produces
  `export const CreateUserForm = (props) => ...`
- `TanstackQuery` (`gen-tanstack-query-fetch-zod`) — produces
  `export const useCreateUser = (args) => ...`

Each is a class that extends an operation or model projection base. Each has the
static `toIdentifier` / `toExportPath` pair that makes it addressable in the
cache.

### The three projection bases

| Base                         | Source unit                           | When                                             |
| ---------------------------- | ------------------------------------- | ------------------------------------------------ |
| `ModelProjectionBase`        | An OAS schema component (a `refName`) | Generators that produce one file per type/schema |
| `OasOperationProjectionBase` | An OAS operation (path + method)      | Generators that produce one file per endpoint    |
| `GqlOperationProjectionBase` | A GraphQL operation                   | GraphQL-side generators                          |

Each base provides the `insertOperation` / `insertModel` /
`insertNormalizedModel` methods with `destinationPath` auto-filled from
`this.settings.exportPath` — a convenience over calling the underlying methods
on `context` directly.

## Snippets

The anonymous fragment class:

- Extends `SnippetBase` directly (or a subclass that doesn't introduce
  projection mechanics)
- No required static methods
- No `settings` property
- Receives constructor arguments like `destinationPath` from the parent that
  will embed it
- Embedded into a parent via `${this.snippet}` template-literal interpolation
- The parent calls `toString()` on the snippet implicitly via the template
  literal

### Examples in stock generators

- `FormFields` (`gen-shadcn-form`) — a list of field renderings inside a form
- `StringInput`, `SelectInput`, `CheckboxInput`, etc. — individual JSX field
  elements
- `CustomValue` — escape hatch wrapping arbitrary TS fragments that don't fit
  the OAS-derived schema model
- `Identifier` — a name with entity-type tracking (technically a Snippet, though
  rarely thought of that way)
- `Definition` — yes, even Definition is technically a Snippet (see below)

## How Definition bridges them

`Definition` extends `SnippetBase` but plays a special bridging role: it's the
wrapper that makes a Projection's value exportable.

```
Projection.toString()
       ↓ produces VALUE (e.g., "z.object({...})")
Definition.toString()
       ↓ produces "export const NAME = VALUE;\n"
File.toString()
       ↓ produces the complete file with imports + definitions
```

So `Definition` is the bridge between "unit of output" (Projection) and
"rendered TypeScript declaration." It's a Snippet in the sense that it extends
`SnippetBase`, but its role is specifically projection-wrapping. You rarely
construct one directly — Drivers do.

## The composition model

JavaScript template literals call `String()` on interpolated values, which falls
back to `.toString()`. Every `SnippetBase` descendant implements `toString()`,
so they compose naturally:

```ts
class CreateUserForm extends ShadcnFormBase {
  fields: FormFields; // ← a Snippet
  clientName: string;

  constructor(args) {
    super(args);
    this.fields = new FormFields(args);
    this.clientName = this.insertOperation(TanstackQuery, args.operation)
      .toName();
  }

  override toString() {
    return `(props: CreateUserFormProps) => {
      const form = useForm({...})
      const mutator = ${this.clientName}()
      return (
        <Form {...form}>
          <form onSubmit={...}>
            ${this.fields}        // ← Snippet's toString() embedded here
            <Button>Submit</Button>
          </form>
        </Form>
      )
    }`;
  }
}
```

The interpolation pattern is the entire composition mechanism. No registry, no
slot system, no callback API. Anything that has a `toString()` (which is
everything that extends `SnippetBase`) can be embedded.

## When to use which

- **Other generators might reference it by name** → Projection
- **It needs a file-scope export (`export const X = ...`)** → Projection
- **It's a fragment inside another generator's output** → Snippet
- **Unsure** → Probably Snippet. Promote to Projection only when cross-file
  identity is needed.

The cost asymmetry: turning a Snippet into a Projection later is simple
(subclass a base, add static methods). Turning a Projection into a Snippet is
also simple but removes it from the cross-generator coordination cache. Default
to Snippet unless you have a reason.

## Choosing the right primitive — mechanical traps to avoid

Three shapes that look reasonable but break the framework's invariants in
specific ways. Each has the same root: reaching for an ad-hoc construction when
a Projection or `SnippetBase` descendant fits.

### File-scope export via a Snippet + `defineAndRegister`

```ts
// ❌ A supplemental file-scope type, registered as a sibling Definition
// in the parent's exportPath, wrapping a Snippet instead of a Projection
class FormValuesSnippet extends SnippetBase {
  override toString() {
    return `{ firstName: string; email: string }`;
  }
}

context.defineAndRegister({
  identifier: createType(`${name}Values`),
  value: new FormValuesSnippet({ context }),
  destinationPath: settings.exportPath,
});
```

This _does_ land an `export type CreateCustomerFormValues = {...}` line in the
File. It also fails on three framework guarantees:

| Guarantee                                                                          | Why it fails                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cache-key identity is `(Producer.toIdentifier(op), Producer.toExportPath(op))`** | A Snippet has no static `toIdentifier` / `toExportPath`. The Definition is keyed by whatever name string the caller built. `context.findDefinition({ name, exportPath })` works only for callers who know the exact name string — there's no Producer class to drive the lookup. |
| **`insertOperation(Producer, op)` requires a Projection class as the first arg**   | There is no class to pass. The Definition is unreachable through the operation-reference protocol; future generators that want this same type must re-derive the name string at their own call site.                                                                             |
| **Rename safety**                                                                  | The identifier name lives at the caller (`${name}Values`). Renaming the convention means editing every caller plus every consumer reading by that name. A Projection's `toIdentifier` is one site.                                                                               |

Fix: extend the appropriate projection base.
`class FormValuesType
extends MyFormBase { static override toIdentifier(...) {...} override
toString() {...} }`,
then `insertOperation(FormValuesType, op)`. The mechanics now match the rest of
cross-generator composition.

### Ad-hoc `{ toString: () => '…' }` returned from a helper function

```ts
// ❌ A helper that returns a duck-typed Stringable
const renderRow = (cols: number, inner: string) => ({
  toString: () =>
    `<div className="grid gap-4 sm:grid-cols-${cols}">${inner}</div>`,
});
```

This satisfies `Stringable` structurally and renders correctly when
interpolated. It also lacks every framework affordance a real Snippet provides:

| Affordance                                                                    | Why it fails                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`context` access (and therefore `register({ imports, destinationPath })`)** | The object has no `context`. If the markup ever needs to import a peer component (a UI library `<Row>`, a hand-written helper), the import has to bubble up to whichever caller has `context` — coupling the caller to the helper's internals.         |
| **`generatorKey`**                                                            | The integrity machinery (`affirmDefinition`, `findDefinition`'s mismatch detection) operates on values carrying a `generatorKey`. The duck-typed object has none, so it's invisible to the integrity layer if it ever ends up wrapped in a Definition. |
| **`instanceof SnippetBase`**                                                  | Generic code that operates on "SnippetBase or its descendants" can't treat the duck-typed object as a member of the family.                                                                                                                            |

Fix: a real `SnippetBase` descendant with its `register` calls in the
constructor.

```ts
class FormRow extends SnippetBase {
  constructor({ context, cols, inner, destinationPath }) {
    super({ context });
    this.cols = cols;
    this.inner = inner;
    // any imports the markup needs go here
  }
  override toString() {
    return `<div className="grid gap-4 sm:grid-cols-${this.cols}">${this.inner}</div>`;
  }
}
```

Same line count once the class is written; every framework guarantee restored.

### Snippet over-parameterized with sole-caller hardcoded values

This one is _not_ about the Projection-vs-Snippet choice — the Snippet is the
right primitive, but its constructor signature is wider than necessary:

```ts
// ❌ Five constructor args; four are hardcoded by the sole caller
class FormFooter extends SnippetBase {
  constructor({
    context, destinationPath,
    formIdVar,        // always 'formId'
    isSavingVar,      // always 'isSaving'
    cancelHandlerExpr,// always 'props.onCancel'
    submitLabelExpr   // genuinely varies
  }) { ... }
}
```

Mechanically: every parameter that all callers pass identically still gets typed
in the signature, passed at every call site, closed over by the constructor, and
read by `toString()`. The cost is in the type surface and the call-site
verbosity — not in framework invariants.

Diagnostic question per parameter: _would a hypothetical second caller pass a
different value here?_ If no → inline the value in the Snippet, remove the
parameter.

This is adjacent to the two anti-patterns above (each is about reaching for the
wrong shape) but the failure mode is API-design debt, not framework breakage.
Listed here because the same triage question — "is this the right shape?" —
catches all three.

## Snippets need destinationPath passed in

Because Snippets don't have their own `exportPath`, they can't register imports
against their own file — they need to know where their parent is going to land.
The convention: the parent passes `destinationPath` as a constructor argument.

```ts
class StringInput extends SnippetBase {
  constructor({ context, name, destinationPath }) {
    super({ context });
    this.name = name;

    // Register against the parent's destination file
    this.register({
      imports: { "@/components/fields/string-field": ["StringField"] },
      destinationPath,
    });
  }

  override toString() {
    return `<StringField name="${this.name}" />`;
  }
}
```

The parent Projection has its own `exportPath` from `this.settings.exportPath`,
so it doesn't need this dance. Snippets nested inside a Projection (or another
Snippet) follow the chain — each parent passes `destinationPath` down to its
children.

This is the "side-effect on context with explicit destination" pattern: Snippets
register their imports immediately during construction, before the parent's
`toString()` even runs. By the time `File.toString()` assembles the final
output, all imports across all nested Snippets have already accumulated in the
file's import map.

## Common questions

### Can a Snippet reach other generators?

Indirectly. A Snippet inside a Projection can call
`this.context.insertOperation(...)` or `this.context.insertNormalizedModel(...)`
directly (Snippets don't have the projection-base wrappers, so they use the
methods on `context`). The returned `Inserted<V, E>` gives access to the peer's
identifier name just like in a Projection.

That said: most cross-generator coordination _happens_ in Projection
constructors, where the projection-base wrappers auto-fill `destinationPath`.
Snippets that compose generators are unusual but not forbidden.

### Why isn't `register` on Projections only?

`register` is defined on `SnippetBase` because both layers need it. Snippets
register imports for themselves (against the parent's file). Projections
register imports and definitions for their target file. The same primitive
serves both — only `destinationPath` differs.

### Is `Definition` really a Snippet?

By inheritance, yes. By role, no — it's a bridging wrapper that Drivers create
automatically. The fact that `Definition extends
SnippetBase` is more of a
technical detail than a conceptual claim. In practice, you compose Projections
(which become Definitions via Drivers) with anonymous Snippets, and you never
touch `Definition` directly.

### Can I have multiple Projections in one file?

Yes. Each Projection has its own `Definition`; the `File` holds a
`Map<name, Definition>`. Multiple Projections targeting the same `exportPath`
add their entries to the same File's `definitions` map. The file's `toString()`
joins them with blank lines.

### What if I want a named export but not a full Projection?

Use `register({ definitions: [new TsDefinition({...})] })` directly. This is the
escape hatch — you produce a Definition without going through a Projection base.
The trade-off: no cross-generator coordination (no cache, no integrity check)
for that definition.

Useful when producing boilerplate that doesn't need to be addressable from other
generators (e.g., a constants table, a default-values object).

### Can a Snippet contain another Snippet?

Yes — composition is unlimited depth. A `FormFields` snippet contains multiple
`StringInput` / `SelectInput` snippets. Each child Snippet embeds itself via
`${this.fields}` in the parent's `toString()`. Imports propagate up via shared
`destinationPath`; the file's import map accumulates contributions from every
nested snippet.

## Further reading

- [How generators produce output](how-generators-produce-output.md) — who
  instantiates Projections and when; the pull-based model
- [Composing output with Stringable](stringable-composition.md) — how Projection
  and Snippet `toString()` methods compose into rendered output
- [Cross-generator coordination](cross-generator-coordination.md) — how
  Projections find each other
- [The three phases](the-three-phases.md) — where Projections and Snippets fit
  in Parse / Generate / Render
- [API reference: projection-bases](../reference/api/projection-bases.md)
- [API reference: dsl-snippet-base](../reference/api/dsl-snippet-base.md)
- [API reference: dsl-definition](../reference/api/dsl-definition.md)
- [`skmtc-generator` skill](../skills/skmtc-generator/SKILL.md) — operational
  guidance for authoring
