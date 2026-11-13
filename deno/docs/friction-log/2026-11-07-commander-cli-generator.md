# 2026-11-07: Commander CLI generator

This session wrote a spec for `@skmtc/gen-commander-fetch-zod`, then built its
milestones M0 and M1. The generator writes one commander `Command` for each
operation. Its model is Cloudflare's Forge and the `cf` CLI. At the end, the
real `skmtc generate` built a CLI in a sandbox (`skmtc-root/cli-sandbox`).

## Knowledge acquired

The session worked on a TypeScript generator. The topics were one tree from
many subjects, parts that `List` joins, and the CLI host that runs it.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | A file can list its contents during generation: `context.getFile(path)` returns the file, and `findDefinitions()` with no query returns every definition (`core/dsl/CodeFileBase.ts`). `context.inspectedFiles` lists every file, but its own docs say it is "NOT a coordination surface". | Generator skill: state what a producer may read from files, and that it should not need to |
| K2 | Core 0.37 has container projections (`toOasOperationContainerBase`, `toContainer`, `toGroupName`). The key of a container comes from the group. Its members are in its file, and no other file can import a member. A container takes no caller options. A TypeScript member renders as `export const ...;` inside the container. The identity of a container comes from the operation, so containers cannot nest at a depth that comes from data. Only core's own test uses them, and core's docs explain them with Kotlin and C#. | Generator skill: a short section, or a note that TypeScript generators use the get-or-create accumulator for now |
| K3 | `List` drops `undefined` values when it is built. `skipEmpty` returns `''` only when the values array is empty. A value that renders `''` still gets a separator on each side. So a part that may be absent must be `undefined` in the `List`, never a class that renders `''`. | lang-typescript skill §5 (Composition helpers): state it with an example |
| K4 | `resolve()` returns `this` on every concrete schema, and the lint rule `skmtc/no-redundant-ref-guard` rejects `x.isRef() ? x.resolve() : x`. Call `resolve()` without a guard. | Operation and model skills: use `resolve()` without a guard in examples |
| K5 | A snippet renders only its own part, never a separator: `.description("...")`, not `\n  .description("...")`. The owner joins parts with a `List` separator. The owner stated this rule in the session. | lang-typescript skill §5, next to K3 |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | The installed `skmtc` launcher lacks `--unstable-worker-options`, so `generate` fails in every project | friction | open |
| 2 | `skmtc init` in a subfolder of a Skmtc root writes the project into the ancestor root, and says nothing | friction | open |
| 3 | The generator skill says caret ranges for `@skmtc/*`; the generators repo and the owner's rule pin exact versions | friction | open |
| 4 | The generator skill points at Kotlin generators as exemplars, which the owner calls work in progress | polish | open |
| 5 | A projection field named `options` collides with the base's caller options | polish | open |
| 6 | `runE2eFixture` takes no settings, so a test of enrichments has to call `toArtifacts` itself | polish | open |
| 7 | `OasString.enums` is a conditional union, so a `.filter` type guard does not narrow it | polish | open |
| 8 | An accumulator child claims its name first and adds itself last | win | open |
| 9 | Test generated runtime code by running it, not only by pinning strings | win | open |

---

### 1. The installed `skmtc` launcher lacks `--unstable-worker-options`, so `generate` fails in every project [friction]

Context: `skmtc generate cli --json` in a new sandbox project.

**What happened:** The run stopped at once with
`Unstable API 'Worker.deno.permissions'. The --unstable-worker-options flag must be provided.`
The launcher is a `deno install` shim:
`exec deno run --allow-all --config ~/.deno/bin/.skmtc/deno.json 'jsr:@skmtc/cli@0.10.21' "$@"`.
That config is `{ "workspace": [] }`, with no `unstable` key. The same CLI
with the flag added worked:
`deno run --allow-all --unstable-worker-options jsr:@skmtc/cli@0.10.21 generate cli --json`.

**What I expected:** I expected that an installed CLI can run `generate`. The
error names a Deno flag, but not the reinstall command that fixes the install.

**Why it matters:** this breaks `generate`, the main command of the CLI, in
every project on the machine. An agent that meets it first will suspect its
own project config, as I did with the new root `deno.json` of the sandbox.
`skmtc/deno/cli/CLAUDE.md` notes the flag for `deno compile`. So the team
knows the trap for one install path, but nothing catches it for this one.

Correction, later in the session: both install commands in the repo already
carry the flag. These are `toCliInstallCommand` in `cli/lib/dependency-age.ts`
and `toJsrInstallArgs` in `.scripts/release.ts`. So this launcher came from
some other install, and the session did not find which one. A reinstall with
`deno install -gAf --minimum-dependency-age=0 --unstable-worker-options --name skmtc jsr:@skmtc/cli@0.10.21`
fixed the machine. The gap that stays open is the diagnosis: nothing tells
the user that the install is the cause.

**Possible fixes:** unresolved. Some options:

- The CLI catches this error and prints the output of `toCliInstallCommand`.
- `skmtc doctor` checks that the launcher carries the flag.
- The config of the published package sets `unstable: ["worker-options"]`, so
  that no install can leave it out.

**Version anchor:** `@skmtc/cli@0.10.21`, Deno 2.9.8

**Status:** open

### 2. `skmtc init` in a subfolder of a Skmtc root writes the project into the ancestor root, and says nothing [friction]

Context: a new folder, `skmtc-root/cli-sandbox`, and `skmtc init cli ./src --json` in it.

**What happened:** `skmtc-root` already has a `.skmtc/` folder. `init` used
the nearest ancestor that has one, so it wrote `skmtc-root/.skmtc/cli/` and
not `cli-sandbox/.skmtc/cli/`. The JSON result was
`{ "type": "created", "projectName": "cli", "basePath": "./src" }`, with no
path. I found it only because the files I expected were not there. The fix
was to delete the stray project, `mkdir cli-sandbox/.skmtc`, and run `init`
again.

**What I expected:** I expected that `init`, the command that creates a root,
uses the current folder. Or, at least, that the result names the folder it
wrote to.

**Why it matters:** a sandbox next to other projects is the usual layout in
`skmtc-root`. A wrong root puts a project, with its `basePath`, in the tree of
another app, and a later `generate` writes files there.

**Possible fixes:** unresolved. Some options:

- The result includes the project path.
- `init` warns when the root it found is not the current folder.
- A flag selects the current folder as a new root.

**Version anchor:** `@skmtc/cli@0.10.21`

**Status:** open

### 3. The generator skill says caret ranges for `@skmtc/*`; the generators repo and the owner's rule pin exact versions [friction]

Context: the `deno.json` of the new package in `skmtc-generators`.

**What happened:** `skmtc-generator` §2 says to declare `@skmtc/*`
dependencies as caret ranges, "even where the clone source pins them
exactly". Every package in `skmtc-generators` pins exactly
(`jsr:@skmtc/core@0.37.0`). The saved rule of the owner says "no caret ranges
between `@skmtc/*` packages". I followed the repo and the owner.

**Why it matters:** an agent that follows the skill makes the only package in
the repo with caret ranges. That goes against the rule of the owner. One of
the two sources is wrong, and the skill gives no sign that the repo differs.

**Possible fixes:** unresolved. Agree one rule and write it in both places.
Or let the skill say when each form applies: a published package, or a
workspace member.

**Version anchor:** `@skmtc/core@0.37.0`, `skmtc-generator` skill as loaded on 2026-11-07

**Status:** open

### 4. The generator skill points at Kotlin generators as exemplars, which the owner calls work in progress [polish]

Context: the skills, as a source of patterns.

**What happened:** `skmtc-generator` §2 lists `@skmtc/gen-kotlin-jackson` as
the clone source for Kotlin, and §4 cites its `toSynthesizedName.ts` as a
worked example. The container docs in core also explain containers with Kotlin
and C#. I repeated that explanation. The owner said that the Kotlin and C#
generators are work in progress, and must not serve as examples.

**Why it matters:** an agent trusts the skills first. An agent that follows
them takes patterns from code that its owner does not stand behind.

**Possible fixes:** unresolved. Mark those references as work in progress, or
move them out of the main path of the skill.

**Version anchor:** `skmtc-generator` skill as loaded on 2026-11-07

**Status:** open

### 5. A projection field named `options` collides with the base's caller options [polish]

Context: the fields of `CliCommand`, an operation projection.

**What happened:** I planned a field `options` for the CLI options of the
command. The skill says that the projection base keeps caller options as
`this.options`, so I named the fields `cliOptions` and `cliArguments`. No type
error would have warned me. The field would have replaced the value of the
base.

**Why it matters:** the projection bases own some field names: `options`,
`settings`, `context` and `operation`. A domain such as CLIs uses the same
words for its own concepts. The skill names `this.options` only once, in the
section on caller options.

**Possible fixes:** unresolved. List the reserved field names in the pitfalls
table of the generator skill. Or make the base fields read-only, so that a
collision fails the type check.

**Version anchor:** `@skmtc/lang-typescript@0.12.40`

**Status:** open

### 6. `runE2eFixture` takes no settings, so a test of enrichments has to call `toArtifacts` itself [polish]

Context: a test that an enrichment overrides an `x-forge-*` extension.

**What happened:** `runE2eFixture({ id, entry, document })` from
`@skmtc/test-support` always passes `settings: { basePath: './src' }`. For a
test of enrichments, I wrote a second runner that calls `toArtifacts` with
`settings.enrichments[id]`. I also copied the `@ts-expect-error` on
`toGeneratorConfigMap` from test-support.

**Why it matters:** enrichments are the main surface for customization, so
most generators that declare any need this. Each copy of the runner repeats
the `@ts-expect-error`.

**Possible fixes:** unresolved. `runE2eFixture` can take an optional
`enrichments` or `settings` argument.

**Version anchor:** `@skmtc/core@0.37.0`, `test-support` in `skmtc-generators` at `45c910c`

**Status:** open

### 7. `OasString.enums` is a conditional union, so a `.filter` type guard does not narrow it [polish]

Context: a string enum that becomes commander `.choices([...])`.

**What happened:** `OasString.enums` has the type
`Nullable extends true ? (string | null)[] | undefined : string[] | undefined`.
After a `ts-pattern` match, the value is a union of the two array types. The
line `(schema.enums ?? []).filter((value): value is string => value !== null)`
still failed with TS2322. `filter` on a union of array types does not take the
type predicate. `flatMap(value => value === null ? [] : [value])` gave
`string[]`.

**Why it matters:** every generator must remove `null` from an enum. The type
makes the obvious line fail, and the error does not say why. The rules of the
owner forbid an `as` cast.

**Possible fixes:** unresolved. A typed accessor on `OasString` for the
values that are not `null`, or a line in the TypeScript pitfalls of the skill.

**Version anchor:** `@skmtc/core@0.37.0`

**Status:** open

### 8. An accumulator child claims its name first and adds itself last [win]

Context: the command tree, which builds from the bottom up. Each command finds
or creates its group, and each new group does the same for its parent. This is
the get-or-create of gen-msw.

**What happened:** the first version added the command to its group at the end
of the constructor. A name clash then failed the subject. But the subject had
already registered its gen-zod params schema. So the run left a stray file
that held only that schema.

If the command adds itself at the start and then fails, the parent imports a
name that nobody defines. The fix has two steps. First, a `CliSlot` finds or
creates the parent and claims the name. A clash throws before any
registration. Last, a `CliChildRef` adds the child and registers its import.

**Why it matters:** the engine isolates a throw to its subject. But it does
not undo what the subject registered before the throw. An accumulator that
adds in one step leaves stray files or broken imports. gen-msw does not show
the problem, because its route adds itself in the transform, after the insert
is complete.

**Possible fixes:** put the two steps in the accumulator paragraph of the
generator skill. The source is `gen-commander-fetch-zod/src/CliSlot.ts` and
`CliChildRef.ts`, on the branch `docs/gen-cli-spec` in `skmtc-generators`.

**Version anchor:** `@skmtc/core@0.37.0`, `@skmtc/lang-typescript@0.12.40`

**Status:** open

### 9. Test generated runtime code by running it, not only by pinning strings [win]

Context: proof that `--help` and `--schema` work in the generated CLI.

**What happened:** an end-to-end test writes the artifacts of a run into a
temporary folder. It adds stand-in base files, and a `deno.json` that maps
`@/` to `./src/`, the same alignment as `basePath`. Then it runs `deno check`,
and then the program. That test found what string pins cannot: whether
`--schema` prints before commander checks required options and positionals.
It also checks that the generated imports resolve.

**Why it matters:** the tests of the skmtc-model skeleton and of the stock
generators pin rendered strings. For a generator whose output is a program,
the render can be exact and the program can still fail. Another agent would
stop at string pins.

**Possible fixes:** a short section in the generator skill on tests of
generated code. The source is `gen-commander-fetch-zod/test/e2e/cli.e2e.ts`
on the same branch.

**Version anchor:** `@skmtc/core@0.37.0`, Deno 2.9.8

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 The installed `skmtc` launcher lacks `--unstable-worker-options` | It breaks `generate` in every project on the machine, and the error does not name the fix (the install commands are correct; the diagnosis is missing) | SKMTC code |
| 2 | K3 and K5 `List` drops `undefined` but not `''`; snippets render no separators | Every generator that composes optional parts meets this, and the types do not show the failure | skill update (lang-typescript §5) |
| 3 | #2 `skmtc init` writes into the ancestor root without a word | A new sandbox in `skmtc-root` is the usual case, and the wrong root sends generated files into the tree of another app | SKMTC code |
