# Task: author @eval/gen-kotlin-jackson from scratch

You are in a fresh SKMTC workspace. Author a **model generator** named
`@eval/gen-kotlin-jackson` that emits **Kotlin data classes with
Jackson annotations** for every schema in `./openapi.json`'s
`components.schemas` — including the polymorphic ones.

**Load the `skmtc-generator` and `skmtc-cli` skills before writing any
code**, and follow them: projection base via the lang package's
factory, snippets for fragments, imports via register calls, no string
composition outside `toString()`, `transform` returns void.

## Environment (already set up — do not re-init)

- SKMTC project: `lab` (`.skmtc/lab/`), schema pinned in
  `client.json#source`, `basePath` = `consumer/src/main/kotlin`.
- The Kotlin language layer `@skmtc/lang-kotlin` is **vendored** at
  `.skmtc/lab/lang-kotlin/` and declared as a deno workspace member.
  It is pre-alpha with no skill — **read its source** for the API
  (`toKtModelProjectionBase`, `KtSnippet`, `KtFile`, `KtAnnotation`,
  `createIdentifier`, `register`, `sanitizePropertyName`,
  `toPackageName`, …).
- Create your generator at `.skmtc/lab/gen-kotlin-jackson/` and add it
  to `.skmtc/lab/deno.json` (`imports` entry
  `"@eval/gen-kotlin-jackson": "./gen-kotlin-jackson/mod.ts"` plus a
  `workspace` entry) — see the skmtc-cli skill's "Registering an
  agent-authored local generator" card.
- A consumer gradle app lives at `consumer/` with acceptance tests in
  `consumer/src/test/kotlin/RoundTripTest.kt`. **Read the test** — it
  defines the target: package `models`, refName-derived class names
  (`User`, `Animal`, `Dog`, `Cat`, `Price`, …), JSON round-trip
  fidelity including snake_case property names, the `object` property
  (a Kotlin hard keyword), and `petType`-discriminated `Animal`
  polymorphism.

## Output requirements

- One file per schema under `models/` relative to basePath (e.g.
  `models/User.generated.kt`), each declaring `package models`.
- Complete working output — no TODO stubs.

## Acceptance (verify yourself; stop when all green)

```bash
skmtc bundle lab --json          # after generator source changes
skmtc generate lab --json        # errors must be [], one file per schema
cd consumer && gradle test       # compiles AND round-trip tests pass
```

## Narrate and log as you work (part of the task)

- **Narrate intent.** Before each significant action or change of
  approach, output one visible sentence starting `WHY:` giving the
  *reason* you chose it — not a description of the action. Example:
  `WHY: reading KtFile.ts because the projection base needs its
  constructor shape`.
- **Log friction immediately.** Keep `FRICTION.md` at the workspace
  root. The moment you hit friction — missing info, a surprising API,
  a failed attempt, docs that didn't answer your question, a guess
  you were forced to make — append an entry:

  ```
  ## <n>. <short title>
  - Trying: <what you were trying to do>
  - Expected: <what you expected>
  - Actual: <what happened>
  - Unblocker: <the exact info/doc/example that would have unblocked you instantly>
  ```

- **Exit retro.** Before your final summary, write `RETRO.md`: your
  top 3 pain points, the single piece of information that would have
  saved you the most time, what was missing from the skills you
  loaded, and a short paragraph of advice to the next agent
  attempting this task.

Honesty over polish — these logs feed skill improvements and do not
affect grading.

## Hard rules

- Do NOT modify anything under `consumer/src/test/`, the gradle build
  files, or `openapi.json` — they are checksum-verified; edits
  disqualify the run.
- Do not copy from other generator implementations.
- Iterate until acceptance passes, then print a short summary of what
  you built and the final test output.
