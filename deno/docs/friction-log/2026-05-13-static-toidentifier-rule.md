# 2026-05-13 — Static `toIdentifier` vs `insertOperation` decision rule

Continuation of the gen-shadcn-form refactor from earlier today
(`2026-05-13-promote-snippets-to-projections.md`). The previous session
promoted supplemental Snippets to Projections, all dispatched via
`insertOperation`. The user then asked whether `insertOperation` is
the right call when we only need the producer's identifier name —
which led to a refinement of when static `Producer.toIdentifier(op).name`
is safe and when `insertOperation` is required. The session also
surfaced an LLM vocabulary-discipline pattern and one more member of
the "right primitive for the role" anti-pattern family.

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Three-condition rule for static `Producer.toIdentifier` vs `insertOperation` | friction | resolved 2026-05-13 (rolled back; see #4) |
| 2 | Casual codegen verbs ("emit", "dispatch", "stitch") mask SKMTC's actual primitives | friction | open |
| 3 | Duck-typed `{ toString: () => '…' }` returns as a "use a Snippet" smell | friction | open |
| 4 | Conjunctive-condition rules with silent failure modes are operationally worse than simpler universal rules | friction | open |
| 5 | `insertOperation` serves a documentation role beyond ensuring registration | win | open |

---

### 1. Three-condition rule for static `Producer.toIdentifier` vs `insertOperation` [friction]

Refining the cross-Projection composition pattern from
`2026-05-13-promote-snippets-to-projections.md#7` ("Self-contained
Projections via cache-idempotent dispatch"). The earlier framing
recommended `insertOperation` everywhere; the user pushed back that
when you only need the producer's identifier *name*, the static
`Producer.toIdentifier(op).name` is cheaper and clearer.

**What happened:** Through three rounds of dialogue we refined a
naïve "always use `insertOperation`" rule into a three-condition
guard:

> **`Producer.toIdentifier(op).name` is safe only when ALL of:**
>
> 1. **Producer is in the same package as the consumer.** SKMTC's
>    convention is one projection-base class per package, which means
>    a shared `toExportPath` and therefore a shared File. No import
>    line is needed; the producer's Definition is a sibling.
>
> 2. **An orchestrator's dispatch chain already calls
>    `insertOperation(Producer, op)`** before render. Static
>    `toIdentifier` doesn't register the producer's Definition; if no
>    one else does, the rendered code references an undefined
>    identifier.
>
> 3. **The reference in the consumer's `toString()` is a type
>    position OR sits inside a function body** — not a top-level
>    eager value-position expression. TS hoists types and resolves
>    function-body references lazily; eager top-level initializers
>    can hit TDZ if the producer's Definition is registered after the
>    consumer's.
>
> If all three hold → static `toIdentifier` is cleaner.
> Any one fails → `insertOperation(Producer, op).toName()` is required.

Each condition rules out a distinct silent-failure mode:

| Condition violated | Failure mode |
|---|---|
| (1) Different package | Consumer's File lacks the import; rendered code fails consumer's `tsc` |
| (2) No orchestrator dispatches | Producer's Definition never registered; rendered code references an undefined identifier |
| (3) Eager top-level expression | Producer registered after consumer in the File; TDZ at module load |

The third condition is the subtle one — the user surfaced it; I'd
have missed it. For our current Projections every static cross-
reference is either a type annotation, a `Required<Pick<...>>`-type
position, or a name inside a generated function body. All three
safe. But a future Projection emitting something like:

```ts
export const RESOLVED_CONFIG = { ...BASE_CONFIG, custom: 'value' }
```

…would TDZ silently if `BASE_CONFIG` is referenced via static
`toIdentifier` and the orchestrator registers it later. The
rendered file looks correct (`BASE_CONFIG` IS in the file); the
runtime error is "Cannot access `BASE_CONFIG` before initialization."

**What was expected:** that "same package = static is safe" was the
whole rule. I had drafted a two-condition version (package + orchestrator)
before the user added condition (3).

**Why it matters:** this is the SKMTC-equivalent of "when is it
safe to skip the framework's recommended call." `insertOperation`
mediates three concerns — name retrieval, registration, and import
stitching at the cross-File boundary. Static `toIdentifier` covers
only the first. Knowing which of the other two are handled "for free"
by the orchestrator is the load-bearing decision.

The deeper underlying point: `insertOperation` does more than its
return value suggests. The visible API is "construct an Inserted
handle." The invisible side effects are (a) register a Definition
at `exportPath`, (b) register an import at `destinationPath` if
they differ. Static `toIdentifier` does none of those — it's pure.
Both are "compute the name," but only one is also "ensure the name
resolves at render time."

This pattern — "method does more than its return value suggests" —
recurs across SKMTC. `insertNormalizedModel` is the same shape:
returns an Inserted, but the load-bearing work is the registration +
import. The skill's helper table (§3) names the methods but doesn't
spell out *which side effects each one absorbs that you don't see in
the return type*.

**Possible fixes:** unresolved. The skmtc-generator skill's §3
helper table could grow a fourth column: "side effects beyond the
return value." Something like:

| Situation | Use | Side effects |
|---|---|---|
| Bring in another generator's output for a named ref | `context.insertModel(P, ref)` | Registers Definition at `P.toExportPath(ref)`; registers import in `destinationPath` if different |
| Read just the name | `Producer.toIdentifier(op).name` | None (pure) |

The decision tree §5 could add a "Producer same package + lazy
reference + orchestrator dispatches?" gate before recommending
static.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** resolved 2026-05-13 — the rule is technically correct but was rolled back on the same day after deciding the third condition (TDZ) makes it operationally too risky; defaulted to `insertOperation` in constructors everywhere. See #4 for the rollback reasoning and #5 for the auxiliary observation that motivated keeping `insertOperation`.

---

### 2. Casual codegen verbs ("emit", "dispatch", "stitch") mask SKMTC's actual primitives [friction]

The user explicitly called out two casual verbs I'd used in this
session — "dispatch" (for what `insertOperation` does) and "stitch"
(for what the Driver's import-registration does). Earlier in the
session they'd corrected "emit" (for what was actually `register` +
Render). Three separate instances of the same pattern.

**What happened:** I kept reaching for evocative codegen verbs
instead of naming the actual primitive:

| My verb | Primitive it was masking |
|---|---|
| "emit" | `register({ definitions, ... })` (registers a Definition into a File during Generate; rendered text appears during Render) |
| "dispatch" | `insertOperation` / `insertModel` / `insertNormalizedModel` (the methods that drive cross-Projection composition) |
| "stitch" | `register({ imports, destinationPath })` (specifically, the imports-side of register, called by the Driver when exportPath ≠ destinationPath) |
| "generate" / "write" (informal) | Pipeline phases: Parse, Generate, Render — and the on-disk write at Render's end |

Every one of these is a metaphor I picked up from generic codegen
literature. None of them is in the skill's primitives list or the
DSL's exported surface. Each one drifts the mental model away from
what's actually happening.

The user spotted the pattern explicitly after the third instance
("stitch is also not one of ours"). The earlier "emit" correction
came mid-session and I'd already half-internalized that. Then I
walked into "dispatch" and "stitch" — same failure mode, different
words.

**What was expected:** that mainstream codegen vocabulary maps to
SKMTC's primitives. It doesn't. SKMTC has its own load-bearing
terms; using anything else means I'm carrying training-data
metaphors into a system that doesn't use them.

**Why it matters:** vocabulary precision drives mental-model
precision. When I say "the Driver stitches the import," I'm imagining
some bespoke import-grafting mechanism. The actual primitive is
`register({ imports, destinationPath })` — same primitive as
"register a Definition," with a different key on the args object.
The mental model collapses to "register is the universal
add-something-to-a-File primitive; it takes imports, definitions,
re-exports as different keys." That's the right model. "Stitch"
suggests something else.

The same pattern in reverse: when I correctly use SKMTC's vocabulary
("the producer's Definition lands at `exportPath` and the Driver
calls `register({ imports, destinationPath })` to add the import to
the consumer's File"), the mechanics fall out of the sentence. The
reader doesn't have to translate from metaphor to primitive.

The load-bearing SKMTC vocabulary, best I can tell, is:

- **Pipeline phases:** Parse, Generate, Render.
- **Primitive methods:** `register`, `insertOperation`, `insertModel`,
  `insertNormalizedModel`, `defineAndRegister`, `findDefinition`.
- **DSL nouns:** `File`, `Definition`, `Identifier`, `Snippet`,
  `Projection`, `Inserted`, `ContentSettings`, `Stringable`.
- **Static-method contracts:** `toIdentifier`, `toExportPath`,
  `toEnrichmentSchema`, `toEnrichments`, `isSupported`.

Anything I write outside this list — "emit", "dispatch", "stitch",
"weave", "graft", "thread" — is almost certainly a metaphor that
loses precision.

**Possible fixes:** unresolved. The skmtc-generator skill doesn't
have a "Vocabulary" section. Adding one — a numbered list of the
load-bearing terms with a one-sentence definition each, plus an
explicit "avoid these casual verbs" line — would be high-leverage
for any LLM (or human) author. The skill currently teaches the
*primitives* well (§3 helper table, §6 scaffolds) but doesn't teach
the *language* of using them. A reader who internalizes the
primitives but uses casual verbs in their reasoning will drift the
mental model anyway.

This is also a recursive-skill-improvement entry: the skill could
flag "casual codegen verbs leak training-data metaphors that
contradict SKMTC's primitive model" as a known LLM failure mode.

**Version anchor:** N/A (vocabulary observation, not a code state)

**Status:** verified-fixed 2026-05-13 — canonical SKMTC vocabulary + explicit avoid list added to `reference/glossary.md` § SKMTC vocabulary — load-bearing terms; `dispatch` / `emit` / `dispatcher` / `emission` swept out of `skmtc-generator` SKILL, `llms.md`, and 12 concept docs (`how-generators-produce-output.md`, `the-manifest.md`, `the-type-system.md`, `the-graphql-pipeline.md`, `cross-generator-coordination.md`, `enrichments.md`, `stringable-composition.md`, `clone-vs-install.md`, `files-and-dedup.md`, `generators-as-packages.md`, `the-stack-trail.md`, `the-three-phases.md`). Mirrored as an operational-principle row in `llms.md`. Light occurrences in some `reference/api/*` and `reference/stock-generators/*` docs still pending — cleaned as encountered.

---

### 3. Duck-typed `{ toString: () => '…' }` returns as a "use a Snippet" smell [friction]

Reviewing the `renderRow` helper in `FormBody.ts`. The multi-field
branch returned:

```ts
return {
  toString: () =>
    `<div className="grid gap-4 sm:grid-cols-${cols}">
      ${inner}
    </div>`
}
```

— a duck-typed Stringable. Renders correctly because it has a
`toString()` and the parent's template literal calls it. But it's
not a Snippet: no `context`, no `generatorKey`, no `register`
access.

**What happened:** the function was the third member of the "right
primitive for the role" anti-pattern family alongside the two from
the previous retro file:

- `2026-05-13-promote-snippets-to-projections.md#5` — "file-scope
  export disguised as a Snippet+`defineAndRegister`."
- `2026-05-13-promote-snippets-to-projections.md#6` — "Snippet
  parameterized by hardcoded values its sole caller always passes."
- This entry — "ad-hoc Stringable from a plain function instead of
  a Snippet class."

Same shape each time: the right primitive existed in the codebase
(Projection, Snippet); the author reached for an ad-hoc shape
(`defineAndRegister`-of-a-Snippet, over-parameterized Snippet,
duck-typed object) that works *now* but trades the primitive's
benefits for present brevity.

**What was expected:** plain functions producing Stringable values
were fine as "helpers." They aren't — they're Snippets without the
SnippetBase plumbing.

**Why it matters:** the duck-typed return has all the costs of a
Snippet (lives in render-time logic, produces JSX) with none of the
benefits:

- No access to `context` for `register({ imports, destinationPath })`.
  If the row markup ever needs to import a library component (e.g.,
  `<Row>` from a UI lib), the import has to bubble up to the
  caller.
- Not discoverable as a Snippet — `ls gen-shadcn-form/src/*.ts`
  enumerates the Snippets/Projections; `renderRow` is a private
  helper buried in a file.
- No `generatorKey` — invisible to integrity checks that walk the
  Snippet tree.
- Type signature lies: claims to return `Stringable`, but the
  object literal isn't a SnippetBase descendant. Anything generic
  over "SnippetBase or its descendants" treats this as outside the
  family.

The diagnostic question that catches all three anti-patterns:
**"is there a SnippetBase descendant (or a Projection) that this
role naturally fits? If yes, am I using it?"** For `renderRow`,
yes (it's a JSX fragment with a context-shaped role) and no (it's
a plain function returning an object literal).

**Possible fixes:** unresolved. The skill's anti-patterns section
(§8) could grow a row: "Ad-hoc `{ toString: () => '...' }` returned
from a helper function in a render path — use a SnippetBase
descendant class instead." Same level of zoom as the existing
"raw `import` statements in template literals" anti-pattern.

The broader pattern — the three anti-patterns share a root cause
("reaching for an ad-hoc shape when the right primitive exists in
the codebase but adds boilerplate") — could be a named principle
in §4 (operational principles): something like "ad-hoc Stringable
constructions are always a Snippet trying to escape."

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** verified-fixed 2026-05-13 — anti-pattern codified mechanically in `concepts/projections-and-snippets.md` § Choosing the right primitive — mechanical traps to avoid, alongside the two related anti-patterns from `2026-05-13-promote-snippets-to-projections.md` (#5, #6). The mechanical WHY (no `context` → no `register`, no `generatorKey` → invisible to integrity layer, not `instanceof SnippetBase`) is now on the doc rather than just in the friction log. Mirrored as an operational-principle row in `llms.md`.

---

### 4. Conjunctive-condition rules with silent failure modes are operationally worse than simpler universal rules [friction]

The closing decision of the session. After drafting #1 (the
three-condition rule for when `Producer.toIdentifier(op).name` is
safe), the user asked whether the rule was worth following or
whether `insertOperation` should remain the default. The conclusion:
default `insertOperation` everywhere except inside static methods
where `this` doesn't exist.

**What happened:** The three-condition rule in #1 is correct — each
condition rules out a specific silent-failure mode. But the costs
of *following* the rule turned out to outweigh the costs of just
using `insertOperation` universally:

| Cost | Static `toIdentifier` | `insertOperation` |
|---|---|---|
| Performance per call | ~zero (pure function) | ~microseconds (Map lookup + branch) |
| Source-level boilerplate | one method call | one method call |
| Auditability of safety | 3 conjunctive conditions to verify per call site, one of them (TDZ) runtime-only | always safe |
| Refactor resilience | breaks silently when (2) or (3) violated | unchanged |
| Failure mode if misapplied | mix of compile-time and silent-runtime | impossible to misapply |

Condition (3) — "reference is in a type position or function body,
not a top-level eager value expression" — was the load-bearing
risk. It's:

- **Position-sensitive:** a future Projection emitting
  `export const X = { ...OTHER_CONST, … }` would TDZ silently if
  `OTHER_CONST` were referenced via static `toIdentifier`.
- **Audit-invisible:** typecheck doesn't catch TDZ for module-level
  consts. The bug surfaces at consumer-app runtime, far from the
  generator change that introduced it.
- **Drift-prone:** "is this reference in an eager top-level position?"
  is true today and silently false tomorrow under unrelated
  refactors (someone composes a const value from other consts).

The rule's correctness wasn't in question. What got reweighed was
the audit overhead: "verify three conjunctive conditions on every
call site of this pattern" vs "just use `insertOperation`."
The latter trades a microsecond of generate-time work for the
ability to skip the verification altogether.

**What was expected:** that "correct rule" implied "worth adopting."

**Why it matters:** rule-evaluation pitfalls compound across an
LLM's contributions. Each "small optimization" the LLM introduces
(static `toIdentifier` instead of `insertOperation` because "it's
cleaner") looks locally fine. The cost shows up at the *aggregate*:
N call sites, each conditionally safe, each one potentially broken
by an unrelated refactor.

The principle: when evaluating a rule, weight not just correctness
but:

1. **Auditability** — can each condition be verified at code-review
   time? Conditions that depend on runtime behavior or distant
   side-effects fail this.
2. **Failure mode** — loud or silent? Compile-time or runtime? At
   the generator (immediate feedback) or in consumer code (delayed
   feedback)?
3. **Conjunctive vs disjunctive** — any condition failing means the
   rule is broken. More conditions = more failure surface.
4. **Cost of the safer default** — what does the "always insertOperation"
   alternative actually cost? If it's ~zero, the rule isn't earning
   its complexity.

If a rule has conjunctive conditions including silent-runtime failure
modes, and the safer-default alternative is ~zero-cost, the default
wins. The "rule" effectively becomes "use the safer default; verify
conditions are unnecessary, not whether the rule holds."

**Possible fixes:** unresolved. The skmtc-generator skill could
incorporate this as a meta-principle in §4 (operational principles):
when evaluating whether to use `Producer.toIdentifier` vs
`insertOperation`, default to the latter; the static call is justified
only when forced (inside a static method where `this` doesn't exist).

There's also a wider implication for LLM design heuristics: an LLM
that's eager to "optimize away" framework calls (because the
training-data prior says framework calls are heavy) needs explicit
counter-pressure when the framework call is *also* a safety net.
"Use `insertOperation` even when you only need the name" is the
SKMTC equivalent of "don't suppress TypeScript errors just because
the code seems to work" — both trade tiny convenience for real
risk.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** verified-fixed 2026-05-13 — codified as a mechanical four-row table in `concepts/cross-generator-coordination.md` § Why call `insertOperation` instead of `Producer.toIdentifier(op).name` and elevated to a design philosophy principle in `explanation/design-philosophy.md` § 8 "Primitives bundle their side effects, on purpose." The mechanical framing (Definition registration / cross-File import / insertion order / refactor re-resolution) replaced earlier heuristic framings (grep-discoverability, blast-radius, rule auditability) — the latter were ergonomic side benefits, not the framework guarantee. Mirrored as an operational-principle row in `llms.md`.

---

### 5. `insertOperation` serves a documentation role beyond ensuring registration [win]

Auxiliary observation that emerged from the rollback discussion in
#4 — not the deciding factor for the rollback, but worth naming as
a reason `insertOperation` is *more* valuable than a "compute the
name" replacement would suggest.

**What worked:** `this.insertOperation(Peer, op)` in a constructor
does three things at runtime (name retrieval, Definition
registration, import auto-registration) — and one thing in source
code: it serves as a *visible dependency marker*.

Grepping for `insertOperation(SomePeer,` across a package answers
"where does this Projection use SomePeer's output?" in one
command. Grepping for `.toIdentifier(...).name` answers nothing —
the same call could be made from any number of Projections for any
number of reasons, and many of those calls have nothing to do with
SomePeer-the-dependency.

The visibility difference matters more in package-internal refactors
than across packages. When someone removes or restructures a
Projection (e.g., decides `FormValuesType` should split into
`FormCreateValuesType` and `FormEditValuesType`), grepping for
`insertOperation(FormValuesType,` finds every consumer. The
refactor's blast radius is computable. Static `toIdentifier` calls
need a slower, more careful search (and might be missed in tests
where the name string is built differently).

This isn't a *correctness* property — both call shapes resolve to
the same identifier. It's a *toolability* property: which idiom
makes the code easier to reason about, refactor, and review.

**Why it matters:** "consistency across call sites makes refactors
cleaner" is the standard argument for picking one idiom over
another at small scale. It's the same argument that drove the
rollback in #4. Recognizing that `insertOperation` has documentation
value *in addition to* registration value reinforces why it wins
the trade-off — the static call would save microseconds of
generate-time work but lose grep-discoverability.

In SKMTC specifically, this matters because the cross-Projection
graph is the primary artifact a reader navigates when understanding
a generator. Anything that makes that graph greppable is high-leverage.
The operation-reference protocol (§3.5) already documents
`insertOperation(Producer, op).toName()` as the canonical
composition primitive; calling out its grep-affordance makes the
reason explicit.

**Possible fixes:** N/A (win). Worth mentioning in the skmtc-generator
skill's §3 helper table as a property of the `insert*` family:
"calls also serve as visible dependency markers — grep
`insertOperation(SomePeer,` to enumerate consumers."

Related observation from the previous retro file
(`2026-05-13-promote-snippets-to-projections.md#7`) on
self-contained Projections via cache-idempotent dispatch: that entry
captured the runtime-cost story (the cache makes dispatch free);
this entry captures the design-time story (the dispatches make
dependencies visible). Both pull in the same direction.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** verified-fixed 2026-05-13 — the *documentation/grep-discoverability* win observed here is real but secondary; the mechanical reasons (Definition registration, import registration, insertion order, refactor re-resolution) are the load-bearing ones. The four mechanical guarantees are now codified in `concepts/cross-generator-coordination.md` § Why call `insertOperation` and `explanation/design-philosophy.md` § 8; the grep-discoverability observation is a side-benefit footnote. See #4 for the broader reasoning.
