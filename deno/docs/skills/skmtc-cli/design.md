# skmtc-cli skill — design document

> Plan for the skill guiding CLI usage — installing generators,
> configuring projects, running generation, integrating with CI.
>
> The corresponding loadable skill is [`SKILL.md`](SKILL.md) in this
> directory. This design document describes *what the skill should
> contain and why*; the SKILL.md is the operational artifact.

## Legacy content sources

This skill's content was distilled from `skmtc-platform/packages/skmtc-cli-skill/SKILL.md`
(legacy, 1096 lines). The legacy file had substantial operational
content alongside material that should live in docs. The mapping
applied during distillation:

| Legacy section | Destination |
|---|---|
| Mental model table | SKILL.md §2 (with `basePath ↔ @ alias` and `Global state` rows promoted to load-bearing) |
| Installation modes | `using/how-to/install-skmtc.md` (defer; long-form how-to) |
| Per-command reference (10+ subsections) | SKILL.md §4 (compact summaries); full flags → `reference/cli/<command>.md` |
| Agent-native operation modes | SKILL.md §3 (load-bearing for agent UX) |
| Typical workflows | SKILL.md §10 (task cards) |
| Non-TTY / automation use | SKILL.md §3 (folded into operation modes) |
| Hand-editing `deno.json` | `using/how-to/edit-deno-json.md` (defer; edge case) |
| Diagnostics section | Split: top patterns → `skmtc-debug` skill; full list → `reference/error-codes.md` |
| The manifest section | Top diagnostic workflow → `skmtc-debug` skill; full shape → `reference/manifest-format.md`; jq queries → `reference/manifest-format.md` (inspection section) |
| Schema source formats | `reference/settings/source-resolution.md` |
| Boundary with skmtc-generator | SKILL.md §13 |

Friction-number historical references (e.g., "friction #4 was that…")
were dropped — they require context that future readers lack.

## Purpose

Guide AI assistants helping users *use* SKMTC. Covers the command
surface (`init`, `create`, `clone`, `install`, `list`, `remove`,
`generate`, `bundle`, `dev`, `doctor`, `agent-context`), the
`.skmtc/<project>/.settings/client.json` shape, enrichment routing,
skip/include filters, and the common task cards a user invokes.

The skill assumes the user is operating SKMTC as a tool — they may
install generators, configure enrichments, and run generation, but
they typically do not write or edit generator source code. When the
user crosses into source editing, the `skmtc-generator` skill takes
over. When something is broken, `skmtc-debug` takes over.

## Audience

Users in the `using/` doc tree. Specifically:

- Someone with an OpenAPI v3 or GraphQL schema who wants code
  generated from it
- A team integrating SKMTC into CI/CD
- An evaluator deciding whether SKMTC fits their stack
- An operator maintaining a SKMTC project's day-to-day workflow

Not authors (they belong to `skmtc-generator`), not debuggers (they
belong to `skmtc-debug`).

## Triggers

Intent phrases that should load this skill:

- "run skmtc"
- "generate code from an OpenAPI schema"
- "install a skmtc generator"
- "scaffold a skmtc project"
- "configure skmtc" / "set up client.json"
- "watch a skmtc project"
- "use skmtc in CI"
- Direct invocation of any CLI subcommand: `init`, `clone`, `install`,
  `generate`, etc.

Should NOT auto-load on:

- "write a skmtc generator" → `skmtc-generator`
- "why is my generation failing" → `skmtc-debug`
- "let's retro this session" → `skmtc-retro`

## Scope boundary

### In skill (operational, just-in-time content)

- The five facts that override default LLM intuitions (load-bearing
  for both audiences; duplicated from `llms.md`)
- High-level mental model of SKMTC (root, project, generators,
  bundle, schema source)
- Command surface — one-line summary per command, with pointers to
  full reference
- The `client.json` shape with annotated example
- Enrichment routing structure (three per-factory shapes: `[path][method]` for OAS ops, `[refName]` for models, `[rootKind][fieldName]` for GraphQL ops)
- Skip/include filter shapes (whole-generator vs per-item)
- The top user-facing operational principles (no Prettier in pipeline,
  customization-via-cloning, no config flags for stock generators)
- Decision trees: install vs clone, why-no-output, schema-source resolution
- The 6–8 most common user task cards (setup, install, configure
  enrichments, generate, update schema, integrate with CI, debug
  handoff)

### Deferred to docs

- Full per-command reference (flags, exit codes, examples) →
  `reference/cli/<command>.md`
- Per-generator reference (what each stock generator emits, its
  enrichments, its clone seams) → `reference/stock-generators/<gen>.md`
- Tutorials (the "guided path" content) → `using/tutorials/`
- Recipes (full worked examples) → `using/recipes/`
- The full design philosophy → `explanation/design-philosophy.md`
- The full anti-pattern catalog → `llms.md`
- Comparison to other tools → `explanation/comparison-to-other-tools.md`

### Boundary with adjacent skills

- **skmtc-generator**: this skill stops at the CLI surface. Editing
  generator source, writing Projections, understanding the DSL → that
  skill.
- **skmtc-debug**: this skill assumes the happy path. When a user
  reports a failure (no output, wrong output, error message),
  diagnostic stance takes priority → that skill.
- **skmtc-retro**: end-of-session reflection. Not invoked during
  active work.

When ambiguous (e.g., "how do I configure X?"), this skill handles if
X is a CLI/settings concern; defers if X is a generator-source concern.

## Outline structure

The actual `SKILL.md` should have approximately these sections, in
order:

### 1. The five facts that override default LLM intuitions

The same five from `llms.md` ("Read this first"). Verbatim, with the
note that they're load-bearing across all SKMTC interactions.

### 2. Mental model

A short table mapping concepts to where they live:

- SKMTC root (`<root>/.skmtc/`)
- Project (`<root>/.skmtc/<project>/`)
- Project deps (`deno.json`)
- Schema pin (`.settings/client.json#source`)
- Bundle (`bundle.js`)
- Worker (`worker.ts`, regenerated from imports)
- Generators (JSR or cloned)

Cross-reference to `concepts/projects-and-workspaces.md` for depth.

### 3. Commands at a glance

A table of commands with one-line summaries. Per-command details
(flags, exit codes) are *not* here — cross-reference to
`reference/cli/<command>.md`.

| Command | Purpose |
|---|---|
| `init` | Scaffold a new project |
| `create` | Create a local generator |
| `clone` | Pull a generator's source from JSR into the project |
| `install` | Add a JSR-hosted generator |
| `list` | Show installed generators |
| `remove` | Remove a generator |
| `generate` | Run the pipeline |
| `bundle` | Build worker.ts and bundle.js |
| `dev` | Watch source and regenerate |
| `doctor` | Diagnose project setup |
| `agent-context` | Emit JSON project state for AI agents |

### 4. The client.json shape

Annotated example, ~25 lines. Cross-reference to
`reference/settings/client-json-schema.md` for full schema.

### 5. Enrichments routing

The scoped structure with a concrete example. Cross-reference to
`reference/settings/enrichments-shape.md` and to each generator's
`enrichments.ts` as the canonical source.

### 6. Skip and include filters

Both forms (whole-generator strings vs per-item objects), with order
of evaluation (`isSupported` → `include` → `skip`).

### 7. Decision trees

The user-facing decision trees:

- "Install or clone?"
- "Why is my output empty?" (light-touch, hands off to `skmtc-debug`)
- "Where does my schema source come from?" (CLI arg → settings.source → prompt)
- "Does this command rebuild the bundle?"

### 8. Task cards

The 6–8 most common user tasks, each as a self-contained playbook:

- Setting up SKMTC in a project
- Adding a generator to an existing project
- Configuring enrichments
- Pinning a schema source
- Skip/include for filtering operations
- Updating a schema and regenerating
- Using SKMTC in CI
- Debug handoff ("when to invoke skmtc-debug")

### 9. Operational principles (user-facing subset)

The subset of the operational principles table that's relevant to
users (vs authors). Examples:

- "Don't ask for a config flag to customize a stock generator — clone it"
- "Don't expect generated output to be formatted — run Prettier separately"
- "Don't manually edit bundle.js or worker.ts — they're derived"
- "Don't mock the database in tests — use real fixtures"

Cross-reference to `llms.md` for the full table.

### 10. Cross-references

- Tutorials: `using/tutorials/01-your-first-generation.md`, etc.
- How-tos: `using/how-to/*`
- Recipes: `using/recipes/*`
- Reference: `reference/cli/`, `reference/settings/`, `reference/stock-generators/`
- Concepts: `concepts/the-three-phases.md`, `concepts/clone-vs-install.md`
- Explanation: `explanation/design-philosophy.md`, `explanation/comparison-to-other-tools.md`

## Open design questions

### How much of the FAQ should be in the skill?

The README has a 10-entry FAQ. Some FAQs are operational ("does SKMTC
format the output?" — relevant in-the-moment); some are evaluative
("is SKMTC production-ready?" — not relevant at action time). The
skill should include the operational subset; the evaluative ones stay
in the README.

### Should the task cards be inline or in a `references/` subdirectory?

Currently inline keeps the skill self-contained. If task cards grow
(more than 8, longer than half a page each), splitting into a
`skmtc-cli-skill/references/tasks/` directory is worth considering.

### How does this skill handle the "I'm evaluating SKMTC" intent?

Evaluators don't have a project yet. They want to know what SKMTC is
and whether it fits. This is README + `explanation/comparison-to-other-tools.md`
territory, not skill territory — but the skill should recognize the
intent and point at those docs rather than try to onboard the user
directly.

### Sandbox API path coverage

The skill currently doesn't surface the remote-execution path
(`generateWithSandboxApi`). If users start using the hosted version,
the skill needs a section for it.
