# Why three phases

> The rationale for separating Parse, Generate, and Render — and
> why combining any two of them breaks something important.

## The question

The naive view of a code generator is one phase: take a schema in,
spit code out. SKMTC explicitly breaks this into three phases —
**Parse**, **Generate**, **Render** — each with its own context
class, its own lifecycle, and its own invariants. Why?

## The short answer

Each phase has a **distinct invariant** the other two would break.
Parse needs to be lenient (one bad schema can't kill the run).
Generate needs to be idempotent (order shouldn't matter). Render
needs to be pure (no logic, just serialization). Combining any two
forces one to give up its invariant — and the invariants are
load-bearing for different reasons.

The three-phase split looks like overhead from the outside; from
inside it's how each phase stays simple enough to reason about.

## Each phase's distinct concern

### Parse: error tolerance + typed model

The Parse phase walks an OAS document (or GraphQL SDL) and
produces a typed in-memory model — `OasDocument`, `OasOperation`,
`OasSchema`, etc. Its invariant: **lenient input, strict
diagnostics**. One badly-formed schema doesn't kill the run; it
gets logged as a `ParseIssue`, the affected items are removed
from the model, and the rest proceeds.

This leniency is essential for real-world specs, which routinely
have minor schema issues. A strict-parse approach (fail on first
error) would be impractical — many users would never get past
their existing spec.

The output of Parse is a typed model that downstream code can
trust:

- Every `OasSchema` variant is well-typed
- Refs are tracked, with broken refs already pruned
- The model is JSON-serializable (load-bearing for the worker
  boundary — see [the GraphQL asymmetry](the-graphql-asymmetry.md))

### Generate: cross-generator coordination

The Generate phase runs each installed generator's `transform`
against the parsed model. Its invariant: **order-independence**.
Two runs of the same generator set against the same parsed model
produce byte-identical output, regardless of which generator's
`transform` ran first.

The mechanism is memoization: every `insertOperation` /
`insertModel` call is keyed by `(identifier.name, exportPath)`.
First-writer-wins; subsequent calls with the same key return the
existing entry. See [how idempotency works](how-idempotency-works.md)
for the full mechanism.

Generate's complexity isn't in walking the model — that's
straightforward iteration. It's in **coordinating multiple
generators that may both want to produce the same name in the same
file**. The phase has to support this because the form generator
needs the same Zod schema the validation generator produces, and
both should converge on one definition.

### Render: serialization

The Render phase walks the file map produced by Generate and
serializes each `File` to a string. Its invariant: **no
business logic, just traversal**. Render reads what Generate
produced and writes it out; it doesn't make decisions about what
the output should be.

This separation lets Render be tested in isolation (pure
input/output), kept simple (no decisions to make), and reused
(swap a renderer for JSON output, or for a different language
target).

The Render phase notably does **not** run Prettier or any other
formatter. The pipeline renders unformatted (but syntactically
valid) TypeScript; consumers run their own formatter as a
post-generation step.

## What's lost by combining phases

### Combining Parse + Generate

If Parse and Generate were one phase, parse errors would surface
*during* rendering. Generator code would need to handle "this
operation's schema failed to parse" mid-`toString()` — turning
every render point into an error-handling site.

Worse: the parsed model wouldn't be a stable artifact. Each
generator would receive a different view depending on what had
been parsed when its `transform` ran. Cross-generator coordination
would be impossible to reason about, because the model itself
would be in motion.

The current split keeps the model frozen by the time Generate
starts. Generators read; they don't worry about parse-time
failures.

### Combining Generate + Render

If Generate and Render were one phase, rendering would happen
during transform. The first generator's `toString()` would run
before the second generator's `transform` had a chance to
contribute imports or sibling definitions.

This breaks idempotency in a specific way: **the order in which
`toString()` is called determines what each Projection sees**. If
Generator A renders before Generator B has added an import,
Generator A's output is missing that import. The result depends
on iteration order.

The current split runs all `transform`s first (building up the
file map), then renders everything once at the end. By Render
time, all imports, definitions, and cross-references have
converged. Order doesn't matter because nothing is serialized
mid-stream.

## What's gained by separating them

### Each phase's invariants

Because each phase is its own scope, its invariant is **local**:

- **Parse:** input may be invalid; output is well-typed
- **Generate:** input is well-typed; output is order-independent
- **Render:** input is order-independent; output is serialized

If something violates an invariant, you know which phase to look
at. If the parsed model has a non-OasSchema where one belongs,
that's a Parse bug. If two runs produce different output, that's
a Generate bug (memoization broken somewhere). If output has the
right structure but wrong characters, that's a Render bug.

### Testability

Each phase can be tested in isolation. Parse tests feed broken
specs and check `ParseIssue`s. Generate tests feed a fixed model
and check the file map. Render tests feed a fixed file map and
check the strings.

Without the split, every test would need a real OAS spec, real
generators, and real expected output. Each test would couple the
whole pipeline.

### The structuredClone boundary at Generate's start

For OAS, the parsed model is produced **host-side** (in the CLI
process) and **then crossed into the Worker** via
`structuredClone`. This works because the parsed `OasDocument` is
a tree of plain objects with discriminators — JSON-cloneable.

Without the three-phase split, the boundary couldn't sit cleanly
between Parse and Generate. The Generate phase could begin
host-side and continue worker-side mid-stream, which would force
*all* of Generate's state to be cloneable. The current split puts
the boundary at the cleanest place: after Parse completes,
crossing into the Worker is one `postMessage` of a stable model.

GraphQL takes a different path (parses worker-side) for reasons
covered in [the GraphQL asymmetry](the-graphql-asymmetry.md), but
the principle holds: phase boundaries are also good cross-process
boundaries.

### Composability of replacement phases

Theoretically: each phase could be replaced independently. A
different Parse phase could ingest GraphQL the way OAS is ingested
today. A different Render phase could render JSON instead of TS.
The three-way split makes such swaps a single-phase concern, not
a system-wide rewrite.

In practice these swaps are rare, but the option's existence
matters — it means SKMTC isn't locked to OAS+TS forever.

## See also

- [The three phases concept](../concepts/the-three-phases.md) —
  the practical walkthrough
- [How idempotency works](how-idempotency-works.md) — the
  mechanism that makes Generate's invariant hold
- [The GraphQL asymmetry](the-graphql-asymmetry.md) — why one
  phase boundary is also a cross-process boundary
- [Error handling philosophy](error-handling-philosophy.md) —
  how Parse's leniency cascades into Generate
- [Design philosophy](design-philosophy.md) — the broader
  principles
- [API: toArtifacts](../reference/api/to-artifacts.md) — the function that
  orchestrates all three phases
