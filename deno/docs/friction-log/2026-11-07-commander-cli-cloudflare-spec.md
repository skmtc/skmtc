# 2026-11-07 — Commander CLI generator on the Cloudflare spec

The session continued `gen-commander-fetch-zod`, a local generator in
`skmtc-root/cli-sandbox`: request bodies (M3), confirmation (M4), then a run
over Cloudflare's Forge-annotated OpenAPI document (3,636 operations). The run
led to a port of `forge normalize` as an enrichment seed, and to `auth` and
`security` enrichments. The first retro of the day is
`2026-11-07-commander-cli-generator.md`.

## Knowledge acquired

The session worked on an operation generator with a large real document, and
on the line between the generator and the host.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | An entry and a projection base can declare `toEnrichmentDefaults({ operation, context, variant })`. It returns the enrichment umbrella. Core keeps only `subject`, for each operation that `isSupported` accepts, at `[id][path][method]['main']`. A hook that throws logs an error and gives no seed for that subject. `skmtc describe --json` reports the result as `enrichmentDefaults`. `skmtc generate` does not read it: it is a seed for the hub to save. No stock generator declares the hook. | Generator skill: a section on the hook, and who folds the seed |
| K2 | No CLI command writes the `enrichmentDefaults` of `describe` into `client.json`. A local consumer copies them by hand or with a script. | CLI skill: say so next to `describe`. See #3 |
| K3 | Core reads only the first object entry in `settings.skip`, and in `settings.include`, that names a generator (`GenerateContext.ts:437` and `:449`, with `.find`). Core ignores a later entry for the same generator, and gives no warning. An operation that a filter leaves out has the result `skipped`. | CLI reference §7. Engine fix in skmtc#330 |
| K4 | `toArtifacts` returns `logs: LogLine[]`, each with `level`, `trail`, `message` and `error`. A harness can group the errors of a run by `error.message`. | Architecture skill §8, next to the manifest |
| K5 | The lint rule `skmtc/runtime-discipline` rejects `node:process`, `await` and `Deno` file calls in generator source. The rule is silent in test files and under `scripts/`, `demo/`, `examples/`, `dist/` and `coverage/`. So host tooling that reads or writes files goes under `scripts/`. Only the plugin source says this. | Generator skill: where host tooling goes |
| K6 | Core exports the valibot schema `clientSettings`, the types `SkipPaths` (`path → Partial<Record<Method, string[]>>`), `IncludePaths` and `GeneratorEnrichments`, and the guard `isMethod`. A host script can build settings and check them with `v.parse(clientSettings, …)`, with no cast. | API reference |
| K7 | When two operations of one generator get the same name and export path from the identity statics, the Driver fails the second with `Registered definition mismatch`, and names the two keys. The generator's own clash check does not run, because core does not build the second projection. | Generator skill §4: the message also covers a collision inside one generator |
| K8 | `deno info --json jsr:@skmtc/core@<version>` gives the local cache path of each module. An agent can then read core source at the pinned version with `grep`. | Debug skill: a tip next to `deno doc` |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Only the first `skip` or `include` entry for a generator applies, with no warning | friction | open (skmtc#330) |
| 2 | The rule "filters hold intent, not `isSupported`" does not say that document flags are intent too | friction | open |
| 3 | Enrichment defaults are a seed, and only the hub folds them into the project | friction | open |
| 4 | `silent: true` still prints error log lines with stacks | polish | open |
| 5 | A run over a large real document found three bugs that the fixtures did not | win | open |

---

### 1. Only the first `skip` or `include` entry for a generator applies, with no warning [friction]

The Cloudflare harness, which plays the consumer of the generator.

**What happened:** The `client.json` had one `skip` entry for cf's audience
filter. A seed step then added a second entry for the same generator, for the
516 operations that the document marks `x-fern-ignore`. Core ignored the second
entry, so those operations generated.

Some of them had the same command name as other operations, and 42 operations
failed with `Registered definition mismatch`. The errors named two operation
keys. They did not point at the skip list. A small repro has two entries with
one path each. The first entry applies, and the second does not. A swap of the
order swaps the result.

**What I expected:** I expected that each entry in the list applies.

**Why it matters:** The input passes the `Skip[]` schema, so the user has no
sign that a filter did not apply. The symptom shows far from the cause: here, as
a name collision between operations. The same `.find` reads `include`, so an
allow list in two entries also loses its second part.

**Possible fixes:** Merge every entry for a generator. Or reject a second entry
when core parses the settings, with the generator name and the entry index.
Filed as skmtc#330.

**Version anchor:** `@skmtc/core@0.37.0`, `@skmtc/cli@0.10.21`

**Status:** open (skmtc#330)

### 2. The rule "filters hold intent, not `isSupported`" does not say that document flags are intent too [friction]

M1 of the generator, then the port of `forge normalize`.

**What happened:** Forge has `x-forge-skip`, and Fern has `x-fern-ignore`. In
M1, I read `x-forge-skip` in `isSupported`. Later I moved it into a seed step
that wrote `client.json` `skip` entries.

The owner corrected both. `isSupported` is for structure only: for example, a
table generator accepts only the GETs that return a list. And there is no
document-level skip. The consumer chooses the operations with `include` or
`skip`.

**What I expected:** I took a document flag for document data, as Forge does,
and not for intent.

**Why it matters:** The CLI skill says that filters hold user intent, never
`isSupported`. A flag in the document looks like data, so the rule did not stop
me, two times. An agent that ports a tool with a skip key (Forge, Fern,
Stainless) will likely make the same mistake.

**Possible fixes:** One sentence in the generator skill: a document key that
means "leave this out" is intent too. The generator does not read it, and the
consumer writes `include` or `skip`. An example of a structural `isSupported`
next to it.

**Version anchor:** `@skmtc/core@0.37.0`

**Status:** open

### 3. Enrichment defaults are a seed, and only the hub folds them into the project [friction]

The port of `forge normalize`.

**What happened:** Cloudflare's document names its commands with
`x-fern-sdk-group-name` and `x-fern-sdk-method-name`. Forge's `normalize`
rewrites these keys to `x-forge-*`. In Skmtc, the generator's
`toEnrichmentDefaults` gives the same settings as a seed, and `describe` reports
it. But `generate` does not read the seed, and the CLI has no command that
writes it into `client.json`.

So I first built the fold (read, merge and write `client.json`) inside the
generator. The owner pointed out that core and the host handle `client.json`,
not a generator. The lint rule `runtime-discipline` had already moved the file
calls out to `scripts/`.

**What I expected:** I expected that a seed hook has a local path into
generation.

**Why it matters:** With no fold step, a document with vendor keys generates
with names from method and path on the CLI. The seed has an effect only through
the hub. A generator author who wants the seed to work locally will want to
build host code inside the generator, which is the wrong layer.

**Possible fixes:** Unresolved. A CLI command, or a `describe` option, that
writes the seed into `client.json` and keeps the values already set. Or a doc
that says the fold is a hub step, and shows how to do it by hand.

**Version anchor:** `@skmtc/core@0.37.0`, `@skmtc/cli@0.10.21`

**Status:** open

### 4. `silent: true` still prints error log lines with stacks [polish]

The engine tests and the Cloudflare harness.

**What happened:** The test helper calls `toArtifacts` with `silent: true`. Each
run over a fixture with a wrong-typed extension printed `[ERROR] … ValiError …`
with a stack to the console. The first harness run printed about 600 such lines.
The same errors are also in the returned `logs`.

**What I expected:** I expected that `silent: true` stops console output, as
its doc says: "Whether to suppress console output".

**Why it matters:** A harness that reads errors from `logs` gets console noise
as well, and a real failure hides in it.

**Possible fixes:** Unresolved. I did not find the cause. Perhaps the ERROR
level goes to the console whatever `silent` is.

**Version anchor:** `@skmtc/core@0.37.0`

**Status:** open

### 5. A run over a large real document found three bugs that the fixtures did not [win]

After M4, before I called the generator done.

**What happened:** The harness `deno task real` is `scripts/cloudflare.ts` in
the generator folder. It downloads a pinned real document. Then it plays the
consumer: an `include` entry for the operations to build, the seed in the
enrichments, and the generator settings.

It runs `toArtifacts` and reports the results and the errors by message. Then it
writes the output with the base files into a project, runs `deno check` on it,
and runs the CLI's `--help`. On 3,636 operations it found three bugs. Each
fixture test had passed before.

- A snippet rendered `new Option(...)` but did not register the `Option`
  import. Only a body with two media types and no field options reaches that
  path.
- Core ignored 516 skips (#1).
- On 30% of the operations, the document's security sends no credentials. One
  requirement asks for the token, the email and the key at once.

**Why it matters:** Generation is fast (about 1 s for 3,636 operations), so a
real document is a cheap test. The type check of the generated output is the
gate that finds an import that a snippet did not register. Pinned strings in
fixtures do not find it. The generator skill already asks to register imports
at each leaf; only a run like this shows where a generator does not.

**Possible fixes:** Codify it. The generator skill can ask for one run over a
large real document, with a type check of the output. The author does this run
before they call the generator done.

**Version anchor:** `@skmtc/core@0.37.0`, `@skmtc/lang-typescript@0.12.40`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Only the first `skip` or `include` entry applies | Valid input silently loses filters, and the symptom shows far from the cause | SKMTC code (skmtc#330) |
| 2 | #3 and K1 — Enrichment defaults are a seed | The hook is not in any skill, and with no local fold step a generator author builds host code in the generator | Generator skill section; CLI fold command or how-to doc |
| 3 | #2 — Document flags are intent too | The current rule did not stop the mistake two times | Generator skill update |
