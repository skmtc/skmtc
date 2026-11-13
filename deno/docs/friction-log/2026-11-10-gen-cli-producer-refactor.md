# 2026-11-10 — gen-cli producer refactor

The session made the producers of `@skmtc/gen-cli` (a local generator in
`skmtc-root/cli-sandbox`) idiomatic, at the owner's request. Commits
`c0723c3` to `d9d5e2d` gave each producer domain fields and a template
literal, and split the large constructors. The functions that score more than
10 went from 12 to 1, and the output did not change after `deno fmt`. The owner
first asked what the Skmtc skills did not make clear. Entries 1 to 4 are the
answer.

## Knowledge acquired

The session worked on the shape of producers and value classes in an
operation generator with accumulators and a peer.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | A snippet can insert a peer. It has no `insertNormalizedModel` method, but `context.insertNormalizedModel(Peer, { schema, fallbackName, destinationPath })` works. The projection's method is the same call with its own export path (`toOasOperationProjectionBase.ts:292`). | Operation skill §3 says "go through the projection's `insertNormalizedModel`". Say that a snippet can do it through `context`. See #5 |
| K2 | `skmtc/tostring-purity` reports each `new X(…)` in `toString()`, also `new List([...fields])`. Its test makes `new KtParameterList(this.parameters)` an error on purpose. It does not report a static builder, such as `List.toFilteredRecord(…)`. | Lang skill §5: build a `List` in the constructor. See #4 |
| K3 | `List` drops `undefined` when you build it. It does not drop an item that gives `''`, and `skipEmpty` acts only on an empty list. | Lang skill §5 |
| K4 | The parsers give `''` for a missing `info.title` or `info.version` (`toInfoV3`: `new OasInfo({ title: '', version: '' })`), not `undefined`. A `?? 'cli'` fallback never applies to an OpenAPI document. | API reference for `OasInfo` |
| K5 | An OpenAPI operation entry only sees `context.document.type === 'oas'`. One `invariant` on it, in one value class, removes each `document?.` check after it. gen-cli had three classes that checked it at each use. | Generator skill: a pattern for a precondition |
| K6 | `CustomValue` has `isReadOnly()` and `resolve()`. Thus one rule can gate a property whose schema is `OasSchema \| OasRef<'schema'> \| CustomValue`. | API reference |
| K7 | `notes/maybe/complexity/measure.ts` scores only classes with `toString` and module functions, and does not count `?.`. In gen-cli, most decisions are in value classes, so the tool does not see them. | `notes/maybe` README; see #7 |
| K8 | `notes/*` is in the skmtc repo's `.gitignore`. The tracked notes are force-added (`git add -f`). | Repo `CLAUDE.md` |
| K9 | The installed `skmtc-generator` skill is 0.14.0. Section 5, "Where branches go", is only on the unmerged branch `docs/skills-generator-design`, so an agent with the installed skill does not see it. | A discoverability gap; see #3 |
| K10 | `deno fmt` does not format a file that `.gitignore` names. In the sandbox, `src/**/*.generated.ts` is ignored, so a format step after generation must name the files or change the setting. | CLI skill: format after generation |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | The one law does not test the shape of the tree, so `this.chain` passed every rule | friction | open |
| 2 | The lang skill offers `List` as the general way to compose, so a fixed chain went into one `List` | friction | open |
| 3 | No skill gives one rule for a part that can be absent, and the sources disagree | friction | open |
| 4 | `tostring-purity` reports `new List` in `toString()` but not `List.toFilteredRecord` | friction | open |
| 5 | The operation skill made me think that only a projection can insert a peer | friction | open |
| 6 | No skill says where code goes that reads the document and renders nothing | friction | open |
| 7 | No tool measures the complexity of every function in a generator | polish | open |
| 8 | Read the document in one value class, and apply each override with one statement | win | open |
| 9 | Check a refactor against a large real document's output, formatted, and against a reference CLI | win | open |

---

### 1. The one law does not test the shape of the tree, so `this.chain` passed every rule [friction]

The owner asked what the skills did not make clear, before the refactor.

**What happened:** `CliCommand` had one field, `chain: List<Stringable[]>`,
that held every call of the commander chain. The constructor was 230 lines,
with each condition inline (`summary === '' ? undefined : new CliSummary(…)`).
Its complexity was 30. `toString()` was `${this.chain}`.

The code obeyed the one law of `skmtc-generator` §3: no stored string held
target syntax. Lint was clean. The owner said that `this.chain` is not a thing
in the domain, and that it puts all the parts together like one large function.

**What I expected:** That a tree with no stored syntax strings is a correct
tree.

**Why it matters:** The skills check one level: strings or objects. They do
not check the level above: what the objects are. An agent can obey every rule
and still make one large constructor and one field that tells the reader
nothing. The owner's test is a question about each field: "Is this property a
thing in the output's domain?" `summary`, `options` and `action` are. `chain`
is not.

**Possible fixes:** A draft section, "Producer shape", is in
`cli-sandbox/notes/skill-producer-shape.md`. Nobody has merged it, and one of
its rules waits on #3.

**Version anchor:** `@skmtc/core@0.37.0` (local copy), `@skmtc/lang-typescript@0.12.40` (local copy), `@skmtc/gen-cli@0.0.1` (local), `skmtc-generator` skill 0.14.0

**Status:** open

### 2. The lang skill offers `List` as the general way to compose, so a fixed chain went into one `List` [friction]

The same `CliCommand`, and `CliOption` and `CliArgument`.

**What happened:** `skmtc-lang-typescript` §5 says to use `List` "instead of
`array.join` whenever items are snippets". So a fixed sequence of different
calls (the command's name, summary, options, handler and action) went into one
`List` with `undefined` holes. `CliArgument` had a `List` that always held one
item. The owner said not to use `List` for things that are not lists. Then the
owner said: "I would just use string templates in toString without new List".

**What I expected:** That `List` is the tool to join any set of snippets.

**Why it matters:** A `List` hides the shape of the output. A template literal
over named fields shows the shape in the code. A `List` is right for items of
one kind whose number the document sets: positionals, options, object entries.

**Possible fixes:** unresolved — needs reflection. The lang skill could tell a
real list from a fixed set of parts.

**Version anchor:** `@skmtc/lang-typescript@0.12.40` (local copy), `skmtc-lang-typescript` skill as installed on 2026-11-10

**Status:** open

### 3. No skill gives one rule for a part that can be absent, and the sources disagree [friction]

The refactor of each chain, when a call (a summary, `--force`, `--text`) is
absent for some commands.

**What happened:** The installed skills say nothing about an absent part. My
memory had three rules from earlier corrections, and they did not agree:

- An absent part is `undefined` in a `List`, never a class that gives `''`.
- Never render to decide presence.
- From the owner today: put the condition in the part's constructor, and the
  part gives `''`.

The unmerged section 5 of `skmtc-generator` and `notes/maybe/design.md` say
that the parent decides if a child exists. The cause there was a separator
around an empty snippet in a `Loop`.

Today the owner accepted the empty line that an absent part leaves, because a
formatter removes it. The owner then said that the rule is still in progress,
with the `Maybe` work.

**What I expected:** One rule for absence in the skills.

**Why it matters:** Absence is the largest kind of branch in generator code
(`notes/maybe/README.md`: 43% text or nothing, 37% fallbacks). An agent with no
rule makes a different choice in each producer. The refactor used three
patterns in turn before it settled on one.

**Possible fixes:** unresolved — the owner decides with the `Maybe` work.
`notes/maybe/gen-cli.md` (commit `aba46a36` on `docs/skills-generator-design`)
gives the two rules side by side.

**Version anchor:** `skmtc-generator` skill 0.14.0 (installed), 0.15.0 (branch `docs/skills-generator-design`)

**Status:** open

### 4. `tostring-purity` reports `new List` in `toString()` but not `List.toFilteredRecord` [friction]

The owner suggested: "you could move the list into toString".

**What happened:** `deno lint` gave 5 errors. Each said that `new List(…)` is
in `toString()`, and that the constructor must build the render tree. The
owner asked: "Why is new List in toString not pure? It remains pure in terms
of its properties and does not write to any files. right?"

It is pure: the `List` constructor only drops `undefined` and keeps the
separator. But the rule's test makes `new KtParameterList(this.parameters)` an
error on purpose. In the same code, `List.toFilteredRecord({ params, body })`
in `toString()` builds the same kind of `List`, and the rule says nothing.

**What I expected:** That the rule reports what can break a render: a register
call, or a refusal that comes too late.

**Why it matters:** The plugin's README says that a rule that fires wrongly
teaches the reader to ignore the linter. Here the rule fires on a pure
expression, and is silent on an equal one.

**Possible fixes:** unresolved — needs reflection. One way: report
`new X(…)` only when its argument has a `context` key, because only a producer
can register. Another way: keep the rule, and also report the `List.to*`
builders.

**Version anchor:** `jsr:@skmtc/lint-plugin@0.1.0`

**Status:** open

### 5. The operation skill made me think that only a projection can insert a peer [friction]

The move of the gen-zod inserts out of `CliCommand`.

**What happened:** I told the owner: "Snippets can't call the projection's
insert, so the gen-zod inserts stay in `CliCommand`." The owner asked what I
meant. A snippet has no `this.insertNormalizedModel`, but it can call
`context.insertNormalizedModel(Peer, { schema, fallbackName,
destinationPath })`. The inserts then moved into `CliCheckSchemas`, the
producer that uses them.

**What I expected:** `skmtc-operation` §3 says "Inline (unnamed) schemas go
through the projection's `insertNormalizedModel`". I read that as a rule that
only a projection can insert.

**Why it matters:** The producer that uses a schema can insert it. Without
this, an agent keeps each insert in the projection, and the projection grows
into the large constructor of #1.

**Possible fixes:** One sentence in the operation skill §3, next to the
projection form.

**Version anchor:** `@skmtc/core@0.37.0` (local copy), `skmtc-operation` skill as installed on 2026-11-10

**Status:** open

### 6. No skill says where code goes that reads the document and renders nothing [friction]

The largest constructors after the render-side refactor.

**What happened:** 51 of gen-cli's 92 classes rendered nothing. They read the
document into facts: `CliRequestBody.ts` had 11 classes and no producer. The
most complex functions were in them: `CliParameterField.constructor` 32,
`ProgramSettings.constructor` 31, `CommandSettings.constructor` 23. A third
place, the `CliCommand` constructor, put together the text that used their
facts.

**What I expected:** That "when in doubt, make it a producer"
(`skmtc-generator` §4) also tells where analysis code goes.

**Why it matters:** The skills cover producers and the engine. They do not
cover the value classes that most generators need. An agent then puts each
precedence chain (`override?.x ?? forge.x ?? document.x ?? default`) in one
constructor.

**Possible fixes:** See #8 for the shape that worked. The draft in
`cli-sandbox/notes/skill-producer-shape.md` has a rule for it.

**Version anchor:** `skmtc-generator` skill 0.14.0

**Status:** open

### 7. No tool measures the complexity of every function in a generator [polish]

The owner said: "keep an eye on cyclomatic complexity. Low is good and
correlates with better design".

**What happened:** The lint plugin has no complexity rule. The tool in
`notes/maybe/complexity/` does not score value classes or `?.` (K7). I wrote
`cli-sandbox/scripts/complexity.ts` (each function, with `?.` and ts-pattern
arms), `classify-branches.ts` and `split-fallbacks.ts`.

**What I expected:** A measure that a generator author can run.

**Why it matters:** Each step of the refactor used the score to choose the
next target and to check the result. The two tools give different numbers for
the same code (884 against 120 for gen-cli), so a number needs its tool.

**Possible fixes:** unresolved — needs reflection.

**Version anchor:** `jsr:@skmtc/lint-plugin@0.1.0`

**Status:** open

### 8. Read the document in one value class, and apply each override with one statement [win]

The split of `CliParameterField`, `CliPropertyField`, `ProgramSettings` and
`CommandSettings`.

**What happened:** Each constructor mixed three sources: the override, the
`x-forge-*` keys, and the document. It also tested the optional override again
at each setting (`override?.required ?? parameter.required ?? …`, 11 times in
one constructor). The shape that worked has three parts:

- A value class that holds what the document says: `ParameterDocument`,
  `SchemaDocument`, `ProgramDocument`.
- One statement for each setting: `override.required ?? document.required`.
- A default for the optional input, so that the code tests it one time:
  `{ override = {} }` in the constructor's arguments.

`CliParameterField.constructor` went from 32 to 9, and
`ProgramSettings.constructor` from 31 to 9. The output did not change.

**Why it matters:** Each generator that has enrichments over document values
has this precedence. With no written shape, the precedence grows into one
constructor, as in #6.

**Possible fixes:** unresolved — needs reflection.

**Version anchor:** `@skmtc/core@0.37.0` (local copy), `@skmtc/gen-cli@0.0.1` (local)

**Status:** open

### 9. Check a refactor against a large real document's output, formatted, and against a reference CLI [win]

Each of the 22 commits of the refactor.

**What happened:** Before the first change, the session kept a copy of the
output for Cloudflare's document (6,609 files). After each change, it formatted
the copy and the new output with `deno fmt --no-config`, and compared the two
trees with `diff -r`. It also counted the commands that have cf's flags,
conflicts and implies (2,709 of 2,811 each time). The format hides the empty
lines of absent parts, so the diff shows only real changes: one, on purpose
(`{}` for 14 commands). The two tree tests now compare the output after
`deno fmt` too. `cli-sandbox/scripts/verify.sh` does all of it.

**Why it matters:** The unit tests cover a few fixtures. A refactor of 22
commits across 40 files needs a check that covers every shape in a real
document. Without the format step, an output change from layout alone looks
like a regression.

**Possible fixes:** unresolved — needs reflection. The generator skill's
section on checks against the run (§5) could name a baseline of a real
document.

**Version anchor:** `@skmtc/gen-cli@0.0.1` (local), cf's Forge document `8340c3b1`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — The one law does not test the shape of the tree | An agent can obey every rule and still write one large constructor; the owner's question about each field is the missing test | skill update (draft: `cli-sandbox/notes/skill-producer-shape.md`) |
| 2 | #3 — No rule for a part that can be absent | It is the largest kind of branch, and today the sources disagree; the `Maybe` work decides it | design decision, then skill update |
| 3 | #4 — `tostring-purity` and `List` | The rule fires on a pure expression and not on an equal one, which teaches the reader to ignore it | SKMTC code (lint plugin) and skill update |
