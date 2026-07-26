# @skmtc/lint-plugin

The SKMTC generator doctrine as `deno lint` rules, so a generator-authoring
session — human or agent — gets it as live diagnostics instead of prose it
has to go and read.

```json
// <root>/.skmtc/<project>/<generator>/deno.json
{ "lint": { "plugins": ["jsr:@skmtc/lint-plugin"] } }
```

Then `deno lint` reports each violation at its site, and the Deno LSP shows
it in the editor as you type. Rule ids read `skmtc/<rule>`.

Every rule delivers the rule text as the diagnostic `hint` — that is the
point of the package. A rule that is not violated costs nothing to read; a
rule that is violated explains itself where the violation is.

## Rules

| Rule | Asserts |
| --- | --- |
| `skmtc/tostring-purity` | `toString()` is a pure read of state settled in the constructor: no construction, no `this.*` assignment or mutation, no register/insert. |
| `skmtc/single-dispatch` | `schema.type` decides what renders a node only inside the `SchemaToValueFn` router (`to<X>Value`) or the metadata policies (`toIdentifierType`, `isSupported`). |
| `skmtc/method-discipline` | A producer carries no methods beyond `constructor` and `toString()`. Getters mirroring a nested field are the canonical offender. |
| `skmtc/no-adhoc-tostring` | A stringable fragment is a Snippet, not an object literal with a `toString` key. |
| `skmtc/no-as-casts` | Generator code narrows (`.isRef()`, `.resolve()`, the router) instead of asserting. `as const` is fine. |
| `skmtc/no-template-imports` | Imports reach emitted files through `register`, never as template text. |
| `skmtc/no-emitted-todos` | Generated output is complete: a `TODO` left for the consumer is wiped on the next run. |
| `skmtc/no-redundant-ref-guard` | `.resolve()` is called unconditionally — it is identity on every concrete schema. Auto-fixable. |
| `skmtc/runtime-discipline` | Generator code is valid synchronous Deno; its only side effects are logs and register/insert. |

Each rule module's doc comment carries the doctrine, the source check it was
ported from, and its **known false negatives**. The precision policy is
one-directional: a rule that fires wrongly teaches the reader to ignore the
linter, so when a pattern cannot be matched precisely the rule is narrowed
and the gap is written down.

## Scope

The rules are silent in `*.test.ts` / `*.spec.ts` / `*.bench.ts`, and under
`demo/`, `examples/`, `scripts/`, `dist/`, `coverage/`, `node_modules/` and
any other dot-directory except `.skmtc`. Those trees legitimately do what the
rules forbid: a demo runner awaits and reads files, a test builds a
`{ toString }` double and casts with `as`. See `src/shared/target.ts`.

## Signing off a violation

Two escape hatches, in order of preference:

```ts
// deno-lint-ignore skmtc/no-as-casts -- upstream types carry no narrowing API
const value = raw as Narrowed
```

```json
// deno.json — drop a rule wholesale (the informational ones)
{ "lint": { "plugins": ["jsr:@skmtc/lint-plugin"], "rules": { "exclude": ["skmtc/no-emitted-todos"] } } }
```

`deno lint` has no warn severity, so a check the harness holds
*informational* (`no-emitted-todos`, and the per-cast approval policy behind
`no-as-casts`) ships as an error rule plus an inline sign-off. Prefer the
inline ignore with a reason: it keeps the decision at the site.

## Relationship to the gen-eval harness

Seven of these rules are ports of the per-file structural checks in
`packages/gen-eval/src/checks/`, whose canonical rule text lives in
`packages/gen-eval/docs/<check>.md`. Two go further: `single-dispatch` has
no counterpart in the harness, and `tostring-purity`'s construction clause
is not in check 8. Both were written against the `feat/gen-eval-round-3`
branch and say so in their doc comments, which is where their doctrine
lives.

The linter enforces *what*; the `skmtc-generator` skill teaches *why*; the
hint text is the bridge.

Cross-file and aggregate checks are not expressible per-file and stay in the
harness: package structure, producer share, the accumulator verdict,
string-composition share, producer sizes, registration channels, and the
"exactly one router exists" half of single dispatch.

## Development

```bash
deno task test    # or: deno test --allow-all
```

`Deno.lint.runPlugin` — the rule-testing API — exists only inside
`deno test`; it throws under `deno run`. `src/test/lint.ts` wraps it.

`src/test/scaffold.test.ts` is the load-bearing test: it runs the CLI's real
scaffolders and pins what the plugin finds in what `skmtc create` writes.
Both TypeScript scaffolders are clean; the Kotlin one trips four rules and
those findings are pinned with an explanation, because that scaffolder is
the thing that drifted — a rewrite is in flight.
