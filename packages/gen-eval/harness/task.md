# Task: author @eval/gen-kotlin-jackson — recreate the Dtos.kt declarations from the schema

You are in a fresh SKMTC workspace. Author a **model generator** named
`@eval/gen-kotlin-jackson` that generates
`kotlin-person-api/src/main/kotlin/com/example/api/dto/Dtos.generated.kt`
— a **single Kotlin file containing every DTO** — from
`kotlin-person-api/openapi.json`. (Kotlin resolves by package, not
filename, so the generated file replaces the hand-written `Dtos.kt`
without matching its name — keep the default generated-file suffix.)

The target is real: `reference/Dtos.kt` is the hand-written file your
generator must recreate. Get as close to it as the schema allows —
the declarations, annotations, types, and defaults are all derivable;
the KDoc prose is authored commentary that is not in the schema, and
the run reports a diff against the reference for inspection. The file
exercises: an enum with pinned lower-case wire values and a
forward-compatible `@JsonEnumDefaultValue` fallback; a
`oneOf`+discriminator hierarchy as a sealed interface with
`@JsonTypeInfo`/`@JsonSubTypes` (members drop the discriminator
property — Jackson owns the tag); a money field serialized as a
fixed-scale decimal string via the hand-written serde classes;
`readOnly`/`writeOnly` access control; an ISO `@JsonFormat` timestamp;
and `additionalProperties` as a defaulted `Map`.

**Load the `skmtc-generator`, `skmtc-lang-kotlin`, and `skmtc-cli`
skills before writing any code**, and follow them: projection base via
the lang package's factory, snippets for fragments, imports via
register calls, no string composition outside `toString()`,
`transform` returns void.

## Environment (already set up — do not re-init)

- SKMTC project: `lab` (`.skmtc/lab/`), schema pinned in
  `client.json#source`, `basePath` = `kotlin-person-api/src/main/kotlin`
  — so a destination path of `@/com/example/api/dto/Dtos.kt` lands in
  package `com.example.api.dto`, and the engine injects the default
  generated-file suffix (`.generated` — leave
  `client.json#settings.generatedSuffix` alone), so the file lands as
  `Dtos.generated.kt`. Register every definition into that ONE file.
- The Kotlin language layer `@skmtc/lang-kotlin` is **vendored** at
  `.skmtc/lab/lang-kotlin/` and declared as a deno workspace member.
  The `skmtc-lang-kotlin` skill covers its API — prefer the skill over
  re-deriving the API from source; the vendored source is the ground
  truth for anything the skill leaves open.
- **Scaffold first, then implement.** Run
  `skmtc create lab @eval/gen-kotlin-jackson model --lang kotlin` —
  it writes a SKELETON (entry, projection base, one projection making
  a single router call, a `toKtValue` router typed `SchemaToValueFn`)
  and registers it in `.skmtc/lab/deno.json`. One router case is
  implemented as the worked example — `'object'` → `DataClassValue` —
  and every other case throws, so the skeleton bundles but `generate`
  fails loudly, naming each unmapped schema type. Your task is the
  generator itself: implement the rest of the schema→snippet mapping
  (one self-rendering snippet per schema variant, following the
  example and the reference generators), the declaration kinds beyond
  data-class/typealias, the single `Dtos.generated.kt` output, the
  Jackson annotations, and the policy seams. Do not hand-write the
  wiring files the scaffolder already provides.
- `kotlin-person-api/` is the real Spring Boot app with its `Dtos.kt`
  removed. Everything else is hand-written and checksum-pinned: the
  controller and services compile against your generated DTOs,
  `com.example.api.serde` holds the money (de)serializers your
  generated `Pet.adoptionFee` must reference, and
  `com.example.api.config.JacksonConfig` carries the cross-cutting
  Jackson policy the annotations pair with.
- **Reference generators** are vendored at `reference/gen-typescript/`
  and `reference/gen-zod/` — two stock TypeScript model generators.
  Study how they walk schemas and compose producers, but be mindful:
  **some principles do not transfer 1:1 across languages** (TypeScript
  has type-only imports and per-schema files; Kotlin here wants one
  file, path-derived packages, and annotation-driven serialization).
- **Framework source** is readable at `reference/skmtc-deno/` (a
  read-only link to the SKMTC monorepo's deno workspace): `core/src`
  is the engine — the `OasSchema` classes, drivers, and context whose
  API surface `@skmtc/core` exposes — and `lang-kotlin/` is the same
  package vendored into your project. Look things up THERE; never go
  hunting in package caches (`~/.cache/deno`, `~/Library/Caches/deno`
  are off-limits and audited).

## Working method

- **Inspect files you intend to edit or overwrite individually** —
  the scaffolded generator sources especially. The Write and Edit
  tools require the file to have been read first, and the rule is
  precise: the Read tool always counts, and a **bare single-file
  `cat`/`head`/`sed -n` (no `&&`, no pipes, no redirects) also
  counts** — but a batched compound command
  (`cat a.ts && echo === && cat b.ts`) does NOT, and the write will
  be rejected even though you have seen the content.
- **The working directory does not persist between Bash calls.** Use
  absolute paths (or `gradle -p <path>`) instead of `cd`-then-run —
  a bare `cd kotlin-person-api` will fail whenever an earlier call
  left the cwd elsewhere.

## Policy decisions are yours to encode

The schema cannot express everything in the reference output. The
money field is marked `format: decimal` — map it to `BigDecimal`.
Which serde classes pair with it, the `@JsonFormat` pattern, and
marking the `unknown` enum constant as the fallback are **generator
policy** — encode them in your generator source as deliberate seams
(the stock-generator convention), not by mutating the schema or the
app.

## Output requirements

- One generated file: `com/example/api/dto/Dtos.generated.kt` under
  basePath, declaring `package com.example.api.dto`, containing all
  six schema declarations. Keep the default `generatedSuffix`; the
  exact hand-written filename is NOT required (package resolution).
- Complete working output — no TODO stubs.

## Acceptance (verify yourself; stop when all green)

```bash
skmtc bundle lab --json               # after generator source changes
(cd .skmtc/lab && deno check gen-kotlin-jackson/mod.ts)
# ^ bundle/generate do NOT typecheck (esbuild) — a green generate can
#   ride a type-broken generator. The parentheses matter: Bash cwd
#   persists across tool calls, and a leaked `cd` makes the next
#   skmtc command fail with misleading "missing schema" errors
skmtc generate lab --json             # errors must be [], Dtos.generated.kt created
node reference/structural-eval/cli.ts --scan .skmtc/lab
# ^ the SAME structural eval that grades this run — re-run it and fix
#   what it reports until there are no FAILs and no warnings. Its
#   OUTPUT is the complete feedback surface: the table prints each
#   flagged check's rule text, and `--md <file>` lists the offending
#   sites. Its implementation is off-limits (reading it disqualifies
#   the run) — the rules it enforces are taught by the skills
gradle -p kotlin-person-api compileKotlin && gradle -p kotlin-person-api test
# ^ the app compiles AND its DtoContractTest passes against your DTOs
diff reference/Dtos.kt kotlin-person-api/src/main/kotlin/com/example/api/dto/Dtos.generated.kt
# ^ inspect what remains — close the derivable gaps (declarations,
#   annotations, types, defaults); KDoc prose gaps are expected
```

## Narrate and log as you work (part of the task)

- **Write the plan down before you implement it.** After you have read
  the scaffolded sources and before you write generator code, write
  `PLAN.md` at the workspace root: the module list (one line per file
  you intend to create, with what it renders), the router case →
  snippet mapping (one line per schema type), and the policy decisions
  you have identified with where each will live. One line each — this
  is a plan, not a design document, and it does not need to be right;
  amend it in place as you learn. Planning in your head instead is the
  expensive path: reasoning is not visible in the transcript, so a
  plan that stays unwritten cannot be reviewed, compared between runs,
  or resumed after a mistake.
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

- Do NOT modify anything under `kotlin-person-api/` except generating
  `Dtos.kt` (its sources, build files, and `openapi.json` are
  checksum-verified), and nothing under `reference/` — edits
  disqualify the run. `reference/skmtc-deno` in particular links to
  live framework source: read-only, any write there disqualifies.
- Derive the output from the schema. Do NOT embed `reference/Dtos.kt`
  (wholly or per-declaration) as literal template text — the
  structural eval reads your generator source and a verbatim blob is
  exactly what it flags.
- Do not read generator implementations other than the two vendored
  references (the originals outside the workspace are off-limits and
  audited).
- Iterate until acceptance passes, then print a short summary of what
  you built and the final test output.
