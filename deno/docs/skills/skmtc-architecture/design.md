# skmtc-architecture skill — design document

> Plan for the skill that gives agents a system-level mental model of
> SKMTC — for building and extending infrastructure *around* the
> engine rather than authoring generators or running the CLI.
>
> The corresponding loadable skill is [`SKILL.md`](SKILL.md) in this
> directory. This design document describes *what the skill should
> contain and why*; the SKILL.md is the operational artifact.

## Purpose

Give an AI assistant enough of SKMTC's architecture to **reason about
the system and build infrastructure around it** — a hosted generation
service, a schema or generator registry, tracing and provenance
tooling, a web app or SaaS wrapping the engine.

The skill exists because SKMTC is *deeply counter-intuitive*. An
agent extrapolating from generic codegen knowledge (Mustache
templates, plugin registries, dependency graphs) or generic backend
infra knowledge (warm pools, incremental builds, retry-on-failure,
fail-closed error handling) will make confidently wrong
architectural proposals. The existing `skmtc-cli` and
`skmtc-generator` skills correct codegen intuitions for their own
task domains, but neither equips an agent to reason about the engine
*as a system to host* — they assume the engine is a given and stop at
their own surface.

## Audience

Agents working on SKMTC platform infrastructure:

- Building the hosted Sandbox / run API (`@skmtc/server` and beyond).
- Building a schema or generator registry — the "GitHub for
  OpenAPI / generators" product.
- Building tracing, provenance, or run-history tooling.
- Building a web app or SaaS that wraps `toArtifacts`.
- Platform-level CI integration.

Explicitly **not** the audience: generator authors (`skmtc-generator`),
day-to-day CLI users (`skmtc-cli`), people debugging a broken run
(`skmtc-debug`).

## Triggers

Intent phrases that should load this skill:

- "what is SKMTC" / "explain SKMTC"
- "how does the SKMTC engine work" / "SKMTC architecture"
- "build a service / API / SaaS around SKMTC"
- "host SKMTC" / "run SKMTC on a server"
- "SKMTC tracing" / "SKMTC provenance" / "gen-maps"
- "the SKMTC package graph / dependencies"
- editing files under `core/run/`, `worker/`, `server/`, `mcp/`,
  `convert/`, or `core/anchors/` for *infrastructure* reasons

Should NOT auto-load on:

- "write / clone / customize a generator" → `skmtc-generator`
- "run skmtc" / "install a generator" / CLI subcommands → `skmtc-cli`
- "why is my generation failing / wrong / empty" → `skmtc-debug`
- "retro this session" → `skmtc-retro`

## Scope boundary

### In skill (load-bearing system model)

- The five facts (canonical four + a fifth tuned to infra:
  cold-start determinism).
- What SKMTC is — the engine / hosts decomposition.
- Benefits and the when-to-use / when-not table.
- The three-phase pipeline; the host/Worker boundary; the
  structured-clone OAS/GraphQL asymmetry; sandboxing.
- The `toArtifacts` entry-point signature.
- Cross-generator coordination by memoization (enough to know it is
  *not* a dependency graph, and that result-caching belongs outside
  the engine).
- The DSL in one screen — Projection vs Snippet, vocabulary
  discipline — as recognition only, with a hand-off to
  `skmtc-generator`.
- The manifest as the run contract: tracing IDs, the results tree,
  parseIssues-derived exit status, no run history.
- The attribution / gen-maps provenance subsystem.
- The package graph, the Deno + JSR substrate, key third-party
  dependencies, the version-pin discipline.
- The infrastructure integration map — engine concept → platform
  concern, and explicitly where the engine stops.
- A counter-intuitive-facts table aimed at infra reflexes (distinct
  from §1's codegen reflexes).

### Deferred to other skills / docs

- Generator authoring (Projections, Snippets, scaffolds,
  anti-patterns) → `skmtc-generator`.
- CLI command surface, `client.json` shape, enrichment routing →
  `skmtc-cli`.
- Failure diagnosis → `skmtc-debug`.
- Full pipeline / worker / manifest detail → `concepts/`.
- Design rationale and rejected alternatives →
  `explanation/design-philosophy.md`.
- The full manifest Valibot schema → `reference/manifest-format.md`.
- The gen-maps wire format → `core/anchors/` source + the gen-maps
  plan notes.

### Boundary with adjacent skills

`skmtc-architecture` is the *understand* skill; the others are *do*
(`cli`, `generator`), *diagnose* (`debug`), and *reflect* (`retro`).
When triggers overlap, the test is **which stance the agent should
be in**: reasoning about the system as a whole → this skill;
producing or operating a concrete artifact → the matching task
skill.

## Content-source mapping

The skill was distilled from the SKMTC source and the docs tree:

| SKILL.md section | Primary sources |
|---|---|
| §1 Five facts | `llms.md` ("four facts"); fact 5 from `concepts/the-worker-runtime.md` |
| §2 What SKMTC is | `core/CLAUDE.md` (name expansion); `docs/README.md`; the package `deno.json` files |
| §3–4 Benefits / when to use | `docs/README.md`; `explanation/design-philosophy.md`; `explanation/comparison-to-other-tools.md` |
| §5 Pipeline | `concepts/the-three-phases.md`; `concepts/the-worker-runtime.md`; `core/run/toArtifacts.ts` |
| §6 Coordination | `concepts/cross-generator-coordination.md`; `explanation/design-philosophy.md` §2, §8 |
| §7 DSL | `concepts/projections-and-snippets.md`; `reference/glossary.md` |
| §8 Manifest | `concepts/the-manifest.md`; `core/run/toArtifacts.ts`; `worker/mod.ts` |
| §9 Provenance | `core/anchors/*` file-headers; `worker/mod.ts` `buildAttributionState` |
| §10 Package graph / deps | every package `deno.json`; `explanation/design-philosophy.md` §6 |
| §11 Infra map | `server/src/createServer.ts`; `mcp/src/mcp-server.ts`; `convert/mod.ts` |
| §12 Counter-intuitive infra facts | `concepts/the-worker-runtime.md`; `the-manifest.md`; `explanation/design-philosophy.md` |

## Open design questions

### Should this skill front the five facts at all?

The other skills front the canonical five facts as a duplication
discipline. This skill keeps them but reframes — facts 1, 2, 5 carry
most weight for an infra audience, and fact 5 is replaced with a
cold-start-determinism statement (the slot is skill-specific in the
sibling skills too). If `llms.md`'s canonical list changes, fact
1–4 wording here should be reviewed.

### Versioning of the package graph

§10 deliberately omits version numbers (they drift; `deno.json` is
canonical). If a future reader needs a pinned snapshot, that belongs
in a reference doc, not the skill.

### Does the gen-maps subsystem deserve its own concept doc?

**Resolved.** `concepts/attribution-and-gen-maps.md` was authored as
the full treatment of the subsystem. §9 of this skill is kept as the
compressed mental model (the selective-duplication policy says skills
stay self-contained — see `skills/README.md`) and now cross-
references the concept doc for depth rather than being trimmed away.

### Sandbox API maturity

`status-and-roadmap.md` lists the hosted Sandbox API as
experimental. As the SaaS infrastructure this skill targets is built
out, §11 ("Building infrastructure around SKMTC") will need to track
what becomes real — and may eventually split into its own
`extending/` or `platform/` documentation tree.
