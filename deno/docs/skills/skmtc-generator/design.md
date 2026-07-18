# skmtc-generator skill outline

> Plan for the skill guiding generator authoring — writing
> Projections, Snippets, transform functions, enrichment schemas, and
> the customization seams in cloned generators.

## Purpose

Guide AI assistants helping users *write or edit* SKMTC generators.
Covers the DSL (Projection vs Snippet, Definition, ContentSettings),
the cross-generator coordination model, the customization seams in
stock generators, code scaffolds for common generator shapes, and the
operational principles that override default TypeScript / codegen
intuitions imported from training data.

This is the skill most likely to prevent the "well-intentioned but
incorrect TS conventions" problem the project has observed in
LLM-authored generators. The operational principles table is the
canonical defense against that failure mode and is the most
load-bearing section.

## Audience

Authors in the `authoring/` doc tree. Specifically:

- Someone cloning a stock generator to customize it
- Someone authoring a new generator from scratch
- Someone editing a cloned generator's `toIdentifier` / `toExportPath`
- Someone adding a new field type to a form generator
- Someone swapping the HTTP peer dependency in a form generator

Not casual users (they belong to `skmtc-cli`), not debuggers (they
belong to `skmtc-debug` when output is broken).

## Triggers

Intent phrases that should load this skill:

- "write a skmtc generator"
- "author a generator"
- "clone gen-x" / "customize gen-x"
- "edit a generator"
- "add a field type"
- "swap the HTTP layer"
- "change export paths"
- "add enrichment options"
- "compose with another generator"
- Any direct edit to `.skmtc/<project>/<gen-name>/src/*.ts`

Should NOT auto-load on:

- "install a generator" → `skmtc-cli`
- "why doesn't my generator work" → `skmtc-debug` (verify-first stance)
- "let's retro" → `skmtc-retro`

## Scope boundary

### In skill (operational, just-in-time content)

- The five facts that override default LLM intuitions (verbatim from
  `llms.md`)
- The DSL essentials: Projection vs Snippet, when to use which
- Cross-generator coordination — the memoization model, why order
  doesn't matter, how `insertOperation` / `insertNormalizedModel` work
- **The operational principles table** — the *full* version. This is
  canonical for authoring. It defends against the most common
  LLM-generator-authoring mistakes.
- Decision trees: Projection or Snippet, where do strings go, install
  or clone, why-output-wrong
- Code scaffolds: operation projection, model projection, anonymous
  snippet, enrichment schema, base.ts factory
- Customization seams in stock generators — table of where to edit
  what (paths, identifiers, peer deps, components, capability gates)
- Top ~15 anti-patterns with failure modes (the canonical "what NOT
  to do when writing a generator")
- Verification checklist — what to check after writing
- The 5–7 most common authoring task cards

### Deferred to docs

- Full DSL API reference (every method, every parameter, every type)
  → `reference/api/`
- Per-generator clone seam reference → `reference/stock-generators/<gen>.md`
- Authoring tutorials → `authoring/tutorials/`
- Full design philosophy → `explanation/design-philosophy.md`
- Comparison to other codegen DSLs → `explanation/comparison-to-other-tools.md`
- Full anti-pattern catalog (both pattern-level and SKMTC-specific) →
  `llms.md`
- Detailed worked examples → `authoring/recipes/`

### Boundary with adjacent skills

- **skmtc-cli**: assumes you know how to install, clone, bundle, dev.
  This skill focuses on the source-editing.
- **skmtc-debug**: when "I'm writing this generator and it doesn't
  work" — the debug skill takes priority. Verify-first stance differs
  from the propose-solutions stance this skill encourages.
- **skmtc-retro**: end-of-session. The retro often happens after a
  generator-authoring session and references this skill's gaps.

When ambiguous (e.g., "this isn't compiling"): if the question is
about *what to write*, this skill. If about *why something is broken*,
hand off to `skmtc-debug`.

## Outline structure

The `SKILL.md` (v0.6.0 restructure) leads with the **constructive
generation model** and derives the rules from it, instead of opening
with defensive tables. Rationale: an agent that only holds a rulebook
can check its work but cannot *derive* what to write; the model
section gives it the game, the rules then read as consequences.

### 1. The generation model

The narrative, in pipeline order: parse → typed IR → the
(generator × item × variant) loop → `transform` converts each IR
object into a **producer** (Projection or Snippet) → a Projection's
value is wrapped in a **Definition** (key = identifier, value =
what's assigned to it) written into a **File** → Files have two roles
(render unit + cache) → producers self-provision their dependencies
via `register` / `insert*` → therefore order cannot matter →
settings tell a Projection where it lands → enrichments (consumer
customization) vs clone-and-edit (author customization) → the engine
is language-blind (the import graph declares the language).

Plus the two engine facts that don't derive from the model:
`OasSchema` is a union of siblings; the variant axis fans out at the
engine.

Sync contract: `verify-docs.ts` check 1 asserts every `llms.md`
"Read this first" fact's bold lead clause appears somewhere in this
skill (the skill no longer mirrors the list shape).

### 2. Producers: Projection vs Snippet

The two-level DSL. Comparison table, when-to-write-which, the
constructor/`toString()` contract, `Stringable` / `ContentSettings`.

### 3. Writing producers into Files: register and insert

The Driver flow, the which-helper-for-which-job table, variant
threading, peer `isSupported` enforcement, and the
operation-reference protocol.

### 4. Operational rules

The former "operational principles table" and "anti-patterns"
sections merged — every distinct rule stated once, grouped by theme
(producing output / naming and caching / composition / schema
handling / gates and customization / code style), with compact
wrong→right code only where the mistake is syntactic. The full
default-intuition → stance table stays canonical in `llms.md`; this
section is the authoring-weighted digest.

### 5. Decision trees

Clone-or-install (with the peers-are-installed note), Projection-or-
Snippet, where-do-strings-go, why-is-output-empty.

### 6. Code scaffolds

`base.ts` factory / operation Projection / entry (`mod.ts`) with GQL
and model variants / entry-factory routing cheat sheet / Valibot
enrichments umbrella / Snippet. Annotated at the extension points.

### 7. Customization seams in stock generators

The where-to-edit-what table plus the path-param-coupling and
monorepo-output callouts.

### 8. Emitting a language other than TypeScript

What a lang package owns; everything else in the skill is
language-agnostic and transliterates by swapping the lang imports.
Supports the "write a server/DTO generator in another language" test
case without a per-language skill existing yet.

### 9. Verification checklist

Grouped by theme (model conformance / naming / registration /
schema / enrichments / variants / style) — every distinct check from
the rules, one line each.

### 10. Task cards

Clone-and-customize, new-from-scratch, field type, peer swap,
enrichment options (compact); orchestrator–delegate, variants-aware,
barrel, accumulator (with code — these patterns exist nowhere else).

### 11–12. Boundaries and cross-references

Skill handoffs; concept/reference/tutorial pointers; the enforcement
tests that pin the invariants.

## Open design questions

### Should the operational principles table be canonical here or in llms.md?

Currently I've described it as canonical in `llms.md` with this skill
deriving from it. But for authoring specifically, the table is the
most operationally-needed content — arguably it should be canonical
*here* and `llms.md` should derive.

The right answer depends on which doc gets updated more often. If skill
changes drive the table, canonical here. If reasoning across multiple
skills drives the table, canonical in `llms.md`.

### How deeply should code scaffolds be inline?

Currently the outline says ~15–25 lines per scaffold. If they grow,
options:

1. Move to `skmtc-generator-skill/references/scaffolds/` (separate
   files referenced by the skill)
2. Keep inline but trim
3. Use the actual stock generators as canonical scaffolds (reference
   their source)

Option 3 is appealing: the scaffolds *are* the stock generators. The
skill points at specific files in `skmtc-generators/gen-shadcn-form/src/`
as the canonical patterns.

### How does this skill interact with skmtc-retro?

Most retros happen after authoring sessions. The retro skill produces
friction-log entries that often suggest gaps in this skill. The
feedback loop is: this skill drives authoring → retro captures gaps →
this skill updates → next authoring is smoother.

Worth making this loop explicit in both skills.

### Should the verification checklist be runnable?

Currently a manual checklist. A linter / pre-commit hook that
mechanically enforces the same rules would be stronger. The checklist
is then the *spec* the linter implements, and the skill can say "run
the linter; resolve all warnings."

### How much do generator types diverge?

Operation generators, model generators, and (eventually) GraphQL
generators have different shapes. The current outline treats them
mostly uniformly. If their scaffolds and decision trees diverge enough,
the skill may want a per-type sub-section.
