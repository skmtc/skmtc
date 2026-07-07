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

The actual `SKILL.md` should have approximately these sections:

### 1. The five facts that override default LLM intuitions

Verbatim from `llms.md`. These are the highest-priority overrides for
LLM defaults; they appear at the top so positional attention prioritizes
them.

### 2. The DSL: Projection vs Snippet

The two-level model. Table comparing them (extends, static methods,
file-level export, caching, embedding). Cross-reference to
`concepts/projections-and-snippets.md` for full prose.

### 3. Cross-generator coordination

The memoization model — `(identifier.name, exportPath)` cache, pure
functions, idempotency by construction. The Driver lifecycle.
Cross-reference to `concepts/cross-generator-coordination.md`.

### 4. Operational principles (full table)

The canonical operational principles table — every row from `llms.md`'s
"Operational principles for proposing changes" section. This is the
**most load-bearing section** because it directly defends against
LLM-training-data-default mistakes.

Includes the "Don't suggest config flags," "Don't add a base class for
OasSchema," "Use `createVariable` not raw strings," etc.

Each row: default intuition → SKMTC's stance → why.

### 5. Decision trees

The authoring decision trees:

- "Projection or Snippet?"
- "Where do strings go?" (toString() / register / Identifier / CustomValue)
- "Should I clone or install?"
- "Where's the customization seam in gen-X?"

### 6. Code scaffolds

Boilerplate the LLM can adapt:

- **Operation Projection scaffold** (the `base.ts` factory call +
  Projection class skeleton)
- **Model Projection scaffold**
- **Anonymous Snippet scaffold**
- **Enrichment Valibot schema scaffold**

Each scaffold is ~15–25 lines. Annotated with comments showing where
common modifications go.

### 7. Customization seams in stock generators

Table of where to edit what in a cloned generator:

| Seam | Location | Customize by |
|---|---|---|
| Export path | `gen-x/src/base.ts` → `toExportPath` | Edit `join('@', ...)` |
| Identifier shape | `gen-x/src/base.ts` → `toIdentifier` | Edit name-building |
| Peer dependency | `gen-x/src/<Main>.ts` top imports | Swap import target |
| Consumer-side component path | `gen-x/src/fields/<X>.ts` register | Change import key |
| Capability gate | `gen-x/src/mod.ts` → `isSupported` | Change predicate |
| Enrichment schema | `gen-x/src/enrichments.ts` | Add Valibot fields |

### 8. Anti-patterns (top ~15 with failure modes)

The top entries from `llms.md`'s anti-patterns section. Each: wrong
pattern, specific failure mode.

Cross-reference to `llms.md` for the full catalog.

### 9. Verification checklist

After writing or editing a generator, verify:

- [ ] All imports go through `register({ imports, destinationPath })`
- [ ] No `as` casts in non-test code
- [ ] No raw identifier strings — `createVariable/createType`
- [ ] No `if/else` chains of length ≥ 3 — use `switch` + `never` default
- [ ] `toString()` is pure (no mutation of `this`)
- [ ] `transform()` returns nothing (uses `register` / `insertOperation`)
- [ ] No literal `import` statements in template literals
- [ ] Constructor side effects are idempotent (register and insertOperation are safe to repeat)
- [ ] `toIdentifier` and `toExportPath` are pure functions of `(operation, enrichments)`
- [ ] Cross-references use `insertOperation(Other, op).toName()`, not source text

### 10. Task cards

The 5–7 most common authoring tasks:

- Adding a new field type to a form generator
- Customizing export paths
- Swapping the HTTP layer
- Authoring a new model generator
- Authoring a new operation generator
- Adding enrichment options
- Composing with another generator

### 11. Cross-references

- Authoring tutorials: `authoring/tutorials/01-cloning-a-generator.md`, etc.
- How-tos: `authoring/how-to/*`
- Recipes: `authoring/recipes/*`
- API reference: `reference/api/`
- Concepts: `concepts/projections-and-snippets.md`,
  `concepts/cross-generator-coordination.md`,
  `concepts/the-three-phases.md`
- Explanation: `explanation/design-philosophy.md`,
  `explanation/why-clone-to-customize.md`

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
