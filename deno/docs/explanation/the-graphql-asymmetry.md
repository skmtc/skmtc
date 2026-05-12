# The GraphQL asymmetry

> Why OAS is parsed host-side but GraphQL is parsed worker-side —
> and why this asymmetry is structural, not an oversight.

## The question

The engine's [three-phase pipeline](why-three-phases.md) crosses
a Worker boundary between Parse and Generate — except it doesn't
*always* cross there. For OAS, Parse runs host-side and the
parsed document is `postMessage`'d into the Worker. For GraphQL,
the SDL string is `postMessage`'d as-is and Parse runs **inside**
the Worker.

Two different paths to the same destination. Why?

## The short answer

`structuredClone` (the algorithm used by Worker `postMessage`)
can transfer plain objects but loses class identity. OAS's parsed
model is a tree of plain objects with discriminators — JSON-
cloneable. GraphQL's parsed AST is a graph of class instances
with parent back-references — **not** structuredClone-safe.

So the engine pre-parses OAS host-side (cheap; produces cloneable
output) and defers GraphQL parsing until inside the Worker
(necessary; the AST can't cross the boundary).

This asymmetry isn't elegant. It's a forced choice driven by
external library shapes (graphql-js's AST representation), and
the engine surfaces it as a deliberate split rather than papering
over it.

## The constraint: `structuredClone`

`Worker.postMessage` uses the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
to copy values from the host into the Worker (and back). It's a
deep-copy mechanism with specific rules.

### What survives a Worker postMessage

The algorithm handles:

- **Primitives** — numbers, strings, booleans, null, undefined,
  BigInt
- **Plain objects** — created with `{}` or `Object.create(null)`
- **Arrays**
- **Maps**, **Sets**
- **ArrayBuffers**, typed arrays
- **Dates**, **RegExp**s
- **Circular references** — preserved, not duplicated

For each value, structuredClone copies the *data* — properties,
elements, entries. The receiving side reconstructs a new object
with the same shape.

### What doesn't survive

The algorithm **fails** or **strips class identity** on:

- **Class instances** — the prototype chain is lost. A
  `new MyClass()` becomes a plain object with `MyClass`'s own
  properties but no `instanceof MyClass` relationship.
- **Functions** — `postMessage` throws on functions.
- **Symbols** — not transferable.
- **DOM nodes** — not transferable.

The class-instance behavior is the one that matters for SKMTC.
TypeScript classes carry their methods on the prototype; losing
the prototype means losing the methods. A `OasOperation` that
arrives in the Worker as a plain object can't have
`.toRequestBody()` called on it — the method exists on the
class, not on each instance.

## Why OAS can cross the boundary as parsed JSON

The OAS parser produces a tree of plain objects with
discriminators. Each node has an `oasType` field
(`'schema'`, `'operation'`, `'requestBody'`, etc.) that
identifies what it is.

```ts
// Roughly what the parser produces
{
  oasType: 'operation',
  path: '/users/{id}',
  method: 'get',
  parameters: [
    { oasType: 'parameter', name: 'id', location: 'path', ... }
  ],
  responses: {
    '200': { oasType: 'response', content: {...} }
  }
}
```

The TypeScript classes (`OasOperation`, `OasParameter`, etc.)
exist host-side, but the *data* the parser emits is structural —
plain objects with discriminators. This data is fully cloneable.

Inside the Worker, the engine rewraps the cloned data into class
instances if needed. The classes' methods (`toRequestBody`,
`resolve`, etc.) attach back via the worker-side instantiation.

The discriminator pattern is what makes this work. If
`OasOperation` carried logic on the prototype that the parsed
model relied on, cloning would lose it. By making the parsed
model purely data-shaped, cloning is lossless.

## Why GraphQL can't

GraphQL's AST (produced by `graphql-js`'s `parse` function) is a
graph of class instances. Nodes carry references to their
parents, neighbors, and the document root. Cloning this graph
either:

- **Loses prototypes** — the rebuilt graph has the same shape
  but no method dispatch. `instanceof ObjectTypeDefinitionNode`
  becomes false; library code that checks `node.kind` against
  enum values may still work, but library code that checks
  `node instanceof X` breaks.
- **Throws on cycles or unsupported types** — depending on the
  exact AST shape.

### Class instances with back-references

A simplified picture:

```ts
type DocumentNode = {
  kind: 'Document'
  definitions: DefinitionNode[]
  loc: SourceLocation
}

type ObjectTypeDefinitionNode = {
  kind: 'ObjectTypeDefinition'
  name: NameNode
  fields: FieldDefinitionNode[]
  // Some implementations carry parent pointers, source location refs, etc.
}
```

Even when nodes look structural, `graphql-js` may attach
non-enumerable methods or wrap nodes in subclasses for
performance. The library treats its AST as "internal" — the
exact shape isn't guaranteed across versions, and isn't
guaranteed to survive a generic deep-clone.

### Why we don't refactor to avoid them

The fix-in-principle would be: build an SKMTC-specific GraphQL
AST representation that's structuredClone-safe, similar to how
OAS has its own discriminator-based model.

This is out of scope. `graphql-js` is the de-facto GraphQL
parser. Rewriting GraphQL parsing inside SKMTC would mean
reimplementing the spec — substantial work, with ongoing
maintenance burden as the spec evolves. The engineering ROI
isn't there.

The current path — pass the SDL string into the Worker, parse
there — sidesteps the issue entirely. `graphql-js` runs inside
the Worker; the AST never crosses any boundary; class identity
is preserved.

## Consequences

### Pre-parse step exists only for OAS

The CLI's pipeline diverges based on document type:

```
OAS:    Read source → Parse → postMessage(parsed doc) → Generate → Render
GQL:    Read source → postMessage(SDL string)      → Parse → Generate → Render
```

The OAS pre-parse step is host-side. It happens before the
Worker spawns. The Worker receives a fully-typed
`OasDocument`-shaped value.

For GraphQL, the pre-parse step is **absent** — the Worker
receives a raw string. The Worker's first action is to call
`graphql.parse(sdl)`, producing an AST inside its own process.

### GraphQL pipeline does more work inside the Worker

GraphQL adds a parse step to the Worker's runtime cost. The
Worker has to include `graphql-js` in its bundle (it's not in
the engine's host-side bundle). The Worker's first response time
is slightly slower for GraphQL inputs.

In practice this is unmeasurable for typical schemas — GraphQL
parsing is fast. But it's a real difference.

### Tradeoffs

The asymmetry is uncomfortable, and we've considered three
alternatives:

1. **Parse both host-side, ship plain-object models across.**
   Requires the SKMTC-specific GraphQL AST mentioned above.
   Substantial work; rejected on engineering cost.
2. **Parse both worker-side, ship strings across.** Forces OAS
   parsing into the Worker. The Worker needs the OAS parser
   bundled. More importantly: the [three-phase
   split](why-three-phases.md) has the Parse boundary at the
   start of Generate for a reason — having Parse start host-side
   for OAS keeps the boundary clean. Moving everything into the
   Worker would couple parse failures to Worker spawn failures.
3. **Keep the asymmetry, document it clearly.** What we chose.
   The asymmetry is explicit and confined to one place (the
   CLI's document-type dispatch). Generator code doesn't see it.

Generator authors don't need to think about which side parsing
happens on — by the time their `transform` runs, the document is
parsed and accessible via `OasDocument` / `GqlDocument`. The
asymmetry lives in the CLI's setup code, not in generator-facing
APIs.

### Worker startup time

For OAS, the Worker can start while parsing is happening
host-side. Some parallelism. For GraphQL, the Worker must boot
*before* parsing — parsing is its first action.

In practice this is microseconds. Not a meaningful operational
difference.

## Why this matters beyond the implementation detail

The asymmetry illustrates a broader pattern: **SKMTC builds on
the substrate rather than rebuilding it**. The substrate here is
Deno Workers + `structuredClone`. Where the substrate has a
constraint (`structuredClone` is the only host-Worker channel),
SKMTC accepts the constraint and adapts the design around it
rather than building its own message transport.

This same pattern shows up elsewhere:

- `deno bundle` as the bundler (not a bespoke bundler)
- Deno permissions as the sandbox (not a custom security layer)
- JSR as the distribution channel (not a SKMTC-specific registry)

Adopting the substrate is what keeps the engine small. The cost
is occasional asymmetries like this one. The benefit is the
engine staying readable and maintainable.

## See also

- [The worker runtime concept](../concepts/the-worker-runtime.md) —
  the broader Worker boundary discussion
- [Why three phases](why-three-phases.md) — Parse/Generate/Render
  separation and why the boundary sits between them
- [Source resolution reference](../reference/settings/source-resolution.md) —
  where the OAS pre-parse and GraphQL string-passthrough are
  documented at the API level
- [API: toArtifacts](../reference/api/to-artifacts.md) — the
  function that accepts both `{ type: 'oas', document }` and
  `{ type: 'gql', sdl }`
- [Design philosophy](design-philosophy.md) — "build on the
  substrate, don't rebuild it" as a principle
