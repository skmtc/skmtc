# Clone vs install

> SKMTC's customization model: a graduated set of levers from "accept
> stock defaults" through "edit per-operation overrides" to "edit the
> generator source itself." Install for stock; configure for narrow
> tweaks; clone for source-level changes.

The choice between cloning and installing is the first customization
decision a SKMTC user makes after picking a generator. It determines
how much control they have over output and how much maintenance they
take on.

## The customization gradient

SKMTC offers a graduated set of customization levers, in order of
escalating effort:

```
1. Use stock          → install + accept defaults
2. Configure          → enrichments in client.json (per-operation overrides)
3. Customize behavior → clone + edit source              ← clone-vs-install boundary
4. Author new         → write a generator from scratch
```

The first two leave the source in JSR; the latter two bring source
into your project. The gradient is intentional: low-effort options
first, escalating to full control only when needed.

## Install (JSR-only)

The mechanism:

```bash
skmtc install @skmtc/gen-zod my-project
```

This adds a JSR import to `.skmtc/my-project/deno.json`:

```json
{
  "imports": {
    "@skmtc/gen-zod": "jsr:@skmtc/gen-zod@^0.0.55"
  }
}
```

No local source. At generate time, the engine loads the
JSR-published bundle directly (via Deno's content-addressed cache).

### Customization surface when installed

Only what the generator's enrichments expose. Read
`gen-zod/src/enrichments.ts` (via `deno info jsr:@skmtc/gen-zod` or
in the JSR source view) to see what's accepted. Enrichments are
typically per-operation overrides: titles, labels, field-level
options. They do *not* let you change identifier naming, export
paths, or the output template's structure.

If you need to change those, install isn't enough — you need to
clone.

### Bundle behavior when installed

If the project has *only* installed generators (no clones), there's
no local `bundle.js`. The JSR-published bundle is used at generate
time. `skmtc bundle` reports
`{ kind: 'noop', reason: 'remote-only' }` and exits cleanly without
writing anything.

This is intentional: for a fully-stock project, there's nothing to
build locally, so why pay the bundling time?

## Clone (local source)

The mechanism:

```bash
skmtc clone my-project -g @skmtc/gen-zod
```

This:

- Copies the generator source from JSR into
  `.skmtc/my-project/gen-zod/`
- Changes the `deno.json` import entry from a JSR specifier to a
  local path:

  ```json
  { "@skmtc/gen-zod": "./gen-zod/mod.ts" }
  ```

- Triggers an **automatic rebundle** (the post-clone bundle step)
- Performs a **pre-flight peer-pin check** that the cloned
  generator's `@skmtc/core` peer version matches your project's pin

After cloning, the generator's source is **your code**. Edit
`gen-zod/src/base.ts` to change paths and identifiers. Edit the
output template files to change the rendered code shape. Add new
field types. Swap peer imports.

### Customization surface when cloned

Everything. The whole TypeScript source is editable. Anything you
can do in TypeScript, you can do to a cloned generator.

### Bundle behavior when cloned

Every `skmtc bundle` (and `skmtc dev`) rebuilds `worker.ts` from
`deno.json#imports` and runs `deno bundle worker.ts -o bundle.js`.
The locally-built `bundle.js` is what runs at generate time — the
JSR-published bundle is bypassed.

## Customization seams in stock generators

Stock generators have **deliberately hardcoded values** that mark
the customization seams. These are not bugs to "fix" with config
flags — they're the places you edit when you clone.

| Seam | Location | What you change |
|---|---|---|
| Export path | `gen-x/src/base.ts` → `toExportPath` | Where generated files land on disk (must match your bundler's `@` alias) |
| Identifier naming | `gen-x/src/base.ts` → `toIdentifier` | What generated symbols are called |
| Peer dependency | `gen-x/src/<Main>.ts` top-level imports | Which other generators are pulled in (e.g., HTTP layer for forms) |
| Consumer-side component path | `gen-x/src/fields/<X>.ts` `register` call | What the generated output imports against |
| Capability gate | `gen-x/src/mod.ts` → `isSupported` | Which operations this generator handles |
| Enrichment shape | `gen-x/src/enrichments.ts` | What user options the generator accepts |
| Field-type routing (form generators) | `gen-x/src/schemaToField.ts` | What schema shapes route to which field renderers |

The clone-to-customize philosophy bets that source editing is
preferable to configuration:

- **No config-flag surface to maintain**: stock generators stay simple
- **Full TypeScript safety on your edits**: changes live in TS, get
  checked by `tsc`
- **No "almost-customizable" trap**: instead of waiting for the
  maintainer to add a flag, edit the source

## When each is right

### Install when:

- The stock defaults match your project's conventions
- You only need per-operation overrides (titles, labels, field
  references) — these go through enrichments
- You don't want to maintain a fork
- You want automatic version updates by bumping the JSR pin

### Clone when:

- You need different output paths, identifier names, or peer deps
- You want to add a field type, change a routing pattern, or swap
  an architectural choice
- You're willing to merge upstream changes manually
- You want your codebase to fully own the generator's behavior

### Author new when:

- No existing generator does what you need
- You'd be cloning + heavily rewriting anyway
- The output shape is novel enough that no stock generator is a
  good starting point

## What clone costs

Cloning has real costs:

- **Manual upgrade merges**: when stock evolves, your clone
  diverges. You merge upstream changes by hand or live with the
  divergence.
- **Maintenance burden**: your team owns the cloned generator's bugs.
- **Disk footprint**: source files live in your repo.
- **Build time**: local bundling adds ~300ms per `bundle` (vs zero
  for install).
- **Documentation**: stock-generator docs are written against the
  unmodified version. Your clone may diverge from the docs in subtle
  ways.

The benefit: full control. For "this is a temporary tweak" needs,
install with creative enrichments may be enough. For "this generator
is core to our codebase and needs to fit our style exactly" needs,
clone is right.

## The license partition rationale

The Apache 2.0 / MIT split reflects the customization model:

- **Engine and CLI: Apache 2.0**. Patent grant, contributor license
  requirements. Appropriate for foundational platform code expected
  to have many contributors and downstream patent-sensitive users.
- **Stock generators: MIT**. Permissive, fork-friendly. Appropriate
  for templated code actively encouraged to be cloned and modified.

This is the same logic as shadcn/ui under MIT — components are
meant to be vendored, not configured. Your cloned generators
inherit the MIT terms, which keeps the fork-friendly model intact.

See [licence rationale](../explanation/design-philosophy.md#licence-rationale)
in the design philosophy.

## Common questions

### Can I clone and then continue receiving updates?

Not automatically. The clone is a snapshot. To get upstream
changes, you re-clone with `--force` (which overwrites your local
edits) or merge manually. There's no built-in "rebase my clone on
upstream" command.

In practice: re-clone periodically to check what upstream changed,
then redo your edits on top. This is the same workflow as
shadcn/ui-style vendored components.

### Can a project have both installed and cloned generators?

Yes. They coexist in `deno.json#imports` — install entries use JSR
specifiers, cloned entries use local paths. The bundle process
handles both: any local generator triggers a `bundle.js` build;
remote generators in the same project are bundled in alongside.

### Do enrichments work the same for cloned generators?

Yes. Enrichments are runtime config; they apply regardless of
whether the generator source is local or JSR-installed. If you
clone, you can also add new enrichment keys by editing the Valibot
schema in `gen-x/src/enrichments.ts`.

### Is `--force` clone destructive?

Yes. `skmtc clone --force` overwrites the local source with the JSR
version. Use it only when you want to discard local changes and
re-pull upstream.

### Can two projects share a cloned generator?

Not directly. Each project's clone is its own copy under
`.skmtc/<project>/gen-name/`. If you want to share:

1. Publish your clone to your own JSR scope (e.g.,
   `@myorg/gen-myform`)
2. `skmtc install @myorg/gen-myform` in both projects

The clone-to-customize model assumes the clone is project-local. The
"share across projects" path is publishing your customized version.

### Why is there a peer-pin check on clone?

`@skmtc/core` is the engine's public API. Generators are written
against specific core versions. Cloning a generator built for a
different `@skmtc/core` version than your project pins would produce
a clone that fails to bundle with cryptic
`No matching export … SnippetBase` errors deep in `deno bundle`
output.

The pre-flight check catches the mismatch at `skmtc clone` time —
before any state mutation — and surfaces a recipe error with the
canonical remediation. Override with `--force` only for intentional
cross-version testing.

### What does "customization seam" actually mean in source?

A seam is a place where the generator's behavior is parameterised
by a value that the author *could* have made configurable but
chose to hardcode. The hardcode is the seam: editing the hardcoded
value (in your clone) is the customization.

Example: in `gen-shadcn-form/src/base.ts:18-22`:

```ts
toExportPath({ operation, enrichments }): string {
  const { name } = this.toIdentifier({ operation, enrichments })
  return join('@', 'forms', `${name}.generated.tsx`)
}
```

The `'forms'` and `'.generated.tsx'` parts are seams. To put forms
in `'features/'` and use `.tsx` (without `.generated`), edit those
literals in your clone. There's no `config.formsDirectory` flag —
the literal *is* the configurability surface.

## Further reading

- [Generators as packages](generators-as-packages.md) — the JSR distribution layer
- [Why clone-to-customize](../explanation/why-clone-to-customize.md) — design rationale
- [Customization seams (skmtc-generator skill §7)](../skills/skmtc-generator/SKILL.md) — operational guide
- [skmtc-cli skill §9](../skills/skmtc-cli/SKILL.md) — install vs clone decision tree
- [`skmtc clone` reference](../reference/cli/clone.md)
- [`skmtc install` reference](../reference/cli/install.md)
