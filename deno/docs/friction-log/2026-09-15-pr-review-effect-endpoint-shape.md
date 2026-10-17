# 2026-09-15 — Addressing a PR review over the Effect generators

Worked twelve second-round review findings on a consumer monorepo's PR
(`tradespring` #60): a coerced-ref twin design in an in-house Effect model
generator, a recursion alias collision, vendor projects sharing one output root
between two generators, hardcoded package roots in two operation generators, and
an operation generator whose `toString()` assembled the whole function body from
string fragments. Two findings about mutual recursion and one about a depth leak
were closed won't-fix after establishing no document generated from has a
recursive component.

## Knowledge acquired

Authoring against `@skmtc/core@0.28.7` / `@skmtc/lang-typescript@0.12.21`, eight
in-house generators at 0.3.3, with the stock generators checked out beside them.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **`skmtc/no-adhoc-tostring` and the skill's litmus pass a `toString()` that assembles everything at render time.** The rules police syntax *stored* on an object; a projection whose constructor stores only names and whose `toString()` builds the parameter list, the URL, three pipeline steps and the response read as six string fragments is lint-clean and still the wrong shape. The right shape (one snippet per rendered part, `List` for collections, the projection composes) is visible only by reading a stock generator such as `gen-express`. | skmtc-operation: a worked decomposition of a *function-building* operation (request steps, response read), not only the query-hook family; skmtc-generator §3: say the litmus is necessary, not sufficient |
| K2 | **`modelDepth` marks the back-edges of the engine's own depth-first walk, and that is all cycle handling needs.** For mutual recursion the suspended ref is already correct; what breaks is the barrel order — the inner projection registers its barrel line first (end of constructor), so ESM enters the cycle at the eager side. Registering the barrel line before building the value makes the barrel the walk's pre-order, which ESM retraces. No structural walk over the document is needed, and one that I wrote (`reaches` / `reachesCycle`) was rightly rejected as a second mechanism beside the engine's. | skmtc-generator §4: name "a document walk answering what `modelDepth` / the cache already answers" as a counterfeit, beside the fabricated-refName example; skmtc-model §3: the recursion bullet could say "mutual recursion is handled by the same back-edge — only barrel order matters" |
| K3 | **`matchPackage` resolves an import by the *outermost* root** (the package), so a nested root declared under a vendor's root is reached as `@/<vendor>/types/<name>.generated.ts`, not through its `moduleName` barrel. A nested root therefore needs no `package.json` export or tsdown entry to be importable from within the package — its `moduleName` only matters to an importer outside it. | skmtc-cli / packages reference: state the outermost-root rule for intra-package imports; "a nested root is a subpath export" reads as if the export must exist |
| K4 | **Deno's `fmt` applies the nearest `deno.json`'s `fmt` block, and a workspace root without one formats every unconfigured member with defaults.** Running `deno fmt` at a workspace root where only two members carry `fmt: { singleQuote, semiColons: false }` rewrote every other member to double quotes and semicolons — a 129-file collateral diff that had to be reverted file by file. | Not an SKMTC doc item, but the skmtc-generator skill's "keep the package convention exactly as cloned" could add: run `deno fmt` per package, or give the workspace root the same `fmt` block |
| K5 | `handlePropertyName(name, parent)` and `List.toObject` exist for exactly the `params.key` / `params['x-y']` / `{ a: …, b: … }` renderings I had hand-rolled with a regex and `join(', ')`. Their output differs from the hand-rolled one only in spacing and quote style, which the consumer's formatter normalises. | skmtc-lang-typescript §5: list `handlePropertyName` beside `handleKey` with the one-line contrast (key position vs access position) |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | A rule-compliant `toString()` can still be the wrong shape — the lint rules and litmus don't teach decomposition | friction | open |
| 2 | I reached for a document walk where the engine's walk already had the answer | friction | open |
| 3 | `registerInto` is a second spelling of `context.register` with a destination | polish | resolved 2026-09-15 (skmtc/skmtc#146 filed) |
| 4 | Identity computed inline in a snippet instead of in the base | friction | open |
| 5 | Workspace-root `deno fmt` reformats every member without its own `fmt` block | friction | open |

---

### 1. A rule-compliant `toString()` can still be the wrong shape — the lint rules and litmus don't teach decomposition [friction]

Reworking `EffectEndpoint` (gen-effect-http) after the reviewer called its
`toString()` out.

**What happened:** The projection's constructor inserted three peer schemas and
stored their names; `toString()` then built the parameter list
(`params: typeof X.Type, body: …`), the URL (template vs literal), the
`HttpClientRequest` pipeline steps (`setUrlParams({…})`, `setHeaders({…})`,
`schemaBodyJson(…)`), the `yield*` choice and the response read, as separate
string fragments joined with `\n` and `, `. `deno lint` with the skmtc plugin
reported nothing but an unused import. The rewrite that was accepted is a
transplant of `gen-express`'s shape: `TypedParameter`, `EffectRequest` holding a
`List` of `UrlParamsStep` / `HeadersStep` / `BodyStep`, `ResponseRead` /
`ResponseVoid`, each with its own `toString()`, the projection composing them.

**What was expected:** that passing `no-template-imports` / `no-adhoc-tostring`
and the skill's "strings are legitimate as final syntax assembled inside a
`toString()` body" meant the shape was acceptable.

**Why it matters:** The one law is about *where* syntax lives (never stored, only
rendered), and the checks enforce exactly that. Decomposition — which parts are
their own snippet — is a separate axis the rules cannot see, and it is what makes
a generator readable, testable per part, and extensible (a new pipeline step is a
class, not another branch in a string join). The skill points at imitation as the
method, but an agent that has the skill and not the stock source has nothing
concrete to imitate; I only got the shape right after being sent to
`skmtc-generators` and reading `ExpressRoute` / `RequestBody` / `Response`.

**Possible fixes:** unresolved — a worked function-building decomposition in
skmtc-operation; a lint heuristic on `toString()` size or on the number of
template literals inside one `toString()`; or the skill stating plainly that the
litmus is necessary, not sufficient, and that a `toString()` longer than a few
lines is a decomposition smell.

**Version anchor:** `@skmtc/core@0.28.7`, `@skmtc/lang-typescript@0.12.21`,
`@tradespring/gen-effect-http@0.3.3`

**Status:** open

### 2. I reached for a document walk where the engine's walk already had the answer [friction]

Working the "cross-file cycle crashes at module load" finding (Node ↔ Edge).

**What happened:** I understood `modelDepth` and the back-reference branch,
reasoned that the reviewer's "did the driver bump my depth" signal misses cache
hits (a second ref to `Edge` never constructs), and wrote `reach.ts` —
`reaches(schema, test)` and `reachesCycle(schema)` — to decide structurally
whether a forward ref lay on a cycle and suspend it too. The user stopped me
("stop inventing new wheels"). The engine-shaped answer was that `modelDepth`
already suspends the walk's back-edges correctly and only the barrel order was
wrong: `EffectProjection` registers its barrel line at the *end* of its
constructor, so the inner model's line comes first. Registering it before
building the value would make the barrel the walk's pre-order, which ESM's
import traversal retraces. The finding was then closed won't-fix because no
generated document has a recursive component, but the shape of the correct fix
is the lesson.

**What was expected:** that a gap in the engine's signal justified a generator-
side mechanism.

**Why it matters:** skmtc-generator §4 says "never re-create engine machinery
inside a generator" and gives the fabricated-refName example; I read that as
"don't copy core code", not "don't build a parallel answer to a question the
engine's walk already answers". The tell was there: a new recursive DFS over
`OasRef.resolveOnce()` inside a snippet constructor, with its own `seen` set,
duplicating the traversal the Drivers perform. The right move was to ask what the
engine's existing shape (construction order = registration order) implied.

**Possible fixes:** unresolved — skmtc-generator §4 could add the walk as a
named counterfeit ("a DFS over refs inside a snippet is the Driver's job done
twice"); skmtc-model §3's recursion bullet could say what mutual recursion needs
(barrel order) so an agent does not go looking for detection.

**Version anchor:** `@skmtc/core@0.28.7`, `@tradespring/gen-effect-schema@0.3.3`

**Status:** open

### 3. `registerInto` is a second spelling of `context.register` with a destination [polish]

Explaining `registerInto` to the user while walking through the barrel-order fix.

**What happened:** `toTsModelProjectionBase` gives a projection `register(args)`
(own file) and `registerInto(path, args)` (explicit file). The second converts
the concise form, ensures the file, and calls `context.register` with
`destinationPath` — the same thing the free `register(context, { …,
destinationPath })` and `context.register` do. The user asked for it to be
removed in favour of `context.register`.

**Why it matters:** two spellings of one operation are one more thing to learn
and document, and the veneer's only content is argument reordering.

**Possible fixes:** filed as skmtc/skmtc#146 — deprecate on 0.12.x naming
`context.register`, remove next minor.

**Version anchor:** `@skmtc/lang-typescript@0.12.21`

**Status:** resolved 2026-09-15 (skmtc/skmtc#146 filed)

### 4. Identity computed inline in a snippet instead of in the base [friction]

Fixing the `${Name}Type` alias collision in gen-effect-schema's `EffectRef`.

**What happened:** The alias under which a recursive model's gen-typescript
type is imported was built inline in the ref snippet
(`const alias = \`${tsType.toName()}Type\``), and my first fix kept it there with
a different marker. The user's correction: names are the base's business —
"schema names should be defined in `toIdentifierName` in base". The alias moved
to `base.ts` as `toTypeAlias(schemaName)` beside the naming policy, derived from
the identifier the base already built. The same instinct produced
`enrichments?: ClientSettings['enrichments']` in a test harness, corrected to
the generator's own `EnrichmentSchema['generator']` — enrichments are declared by
each generator, not by core.

**What was expected:** that a name used in one place could be spelled in that
place.

**Why it matters:** skmtc-generator §4 makes identity a base static so it is
computable without construction and visible to peers. An alias is identity too —
it is a name the generator emits — and the same argument applies: one place,
computed from `refName`, next to the rule it must not collide with. The skill
says this for `toIdentifierName` / `toExportPath`; it does not say that *every*
emitted name the generator chooses belongs there.

**Possible fixes:** unresolved — skmtc-generator §4 "Identity before
construction" could generalise: any name the generator invents (aliases,
synthesized siblings, suffixes) is a base-level function, never a template in a
snippet.

**Version anchor:** `@skmtc/core@0.28.7`, `@tradespring/gen-effect-schema@0.3.3`

**Status:** open

### 5. Workspace-root `deno fmt` reformats every member without its own `fmt` block [friction]

Formatting after an edit that touched three generator packages.

**What happened:** `.skmtc/tradespring/deno.json` is a Deno workspace of eight
generators; two carry `fmt: { semiColons: false, singleQuote: true }`, six carry
nothing. `deno fmt` at the root rewrote the six to Deno's defaults (double
quotes, semicolons) — 129 files including `CLAUDE.md`s — and I had to revert by
path and re-apply three edits by hand. The stock generators are single-quote /
no-semicolon by convention, so the defaults are the wrong style for all of them.

**What was expected:** that members without a `fmt` block inherit nothing and are
left alone, or that the convention is declared once at the workspace root.

**Why it matters:** the skill's "keep the package convention exactly as cloned"
extends to formatting, and a cloned `deno.json` that lacks the `fmt` block is a
trap the first time someone formats from above.

**Possible fixes:** unresolved — a `fmt` block in the stock generators'
`deno.json` (so clones carry it); the skill's clone checklist naming it; or a
note that `deno fmt` runs per package.

**Version anchor:** Deno 2.9, `@tradespring/gen-*@0.3.3`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — a rule-compliant `toString()` can still be the wrong shape | The one shape the rules cannot police is the one that decides whether a generator is readable; without a worked function-building example an agent will pass lint and ship a string assembler | skmtc-operation: worked decomposition (request steps, response read); skmtc-generator §3: "necessary, not sufficient" |
| 2 | #2 — a document walk where the engine's walk already had the answer | The "no counterfeit machinery" rule is stated for refNames only; the traversal case is the more tempting one and cost a full detour | skmtc-generator §4: name the walk as a counterfeit; skmtc-model §3: mutual recursion is barrel order |
| 3 | #4 — identity inline in a snippet | Generalising "identity lives in the base" to every invented name (aliases, suffixes) closes a gap the alias collision walked through | skmtc-generator §4 "Identity before construction" |
