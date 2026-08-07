# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SKMTC is a Deno-based monorepo that generates code artifacts from OpenAPI v3 documents. It consists of a core library for schema processing and a CLI tool for interactive code generation.

## Key Commands

### Root Workspace
```bash
# Release: cascade version bumps + publish in dependency order (see "Releasing")
deno task release

# Run tests across workspace
deno test

# Format code across workspace  
deno fmt

# Lint code across workspace
deno lint

# Type check
deno check mod.ts
```

## Releasing

**Always release through `deno task release` (the `.scripts/release.ts`
cascade). Never publish a workspace package by hand with `deno publish` /
`deno task publish`** — manual publishing skips the cascade and silently
leaves downstream `@skmtc/*` consumers pinned to the old version.

The canonical flow:

1. Bump the `version` of **only** the package(s) whose source you directly
   changed, with `deno task bump <package>` (cascades pins + dependent
   versions). Leave downstream consumers alone.
2. Commit and merge to main — the `Publish` workflow runs `deno task release`
   automatically on every merge (no-op when nothing is pending). Running
   `deno task release` locally from `skmtc/deno/` does the same against the
   ambient `JSR_URL` registry.

The script then, against the JSR registry as the source of truth:
- treats any package whose `deno.json` version is **not yet published** as a
  direct release;
- **cascades** — every workspace package that depends (directly or
  transitively) on a releasing package gets its `@skmtc/*` import pins
  rewritten to the new versions and its own patch version bumped;
- publishes in dependency order so a dependency is live before its dependents
  resolve against it.

Flags: `--reinstall-cli=none|local-compile|jsr-install` controls whether the
local `skmtc` binary is rebuilt when `@skmtc/cli` is part of the release
(default `none`, which just prints the install command).

**Private packages:** a workspace member with `"private": true` in its
`deno.json` (npm semantics) still participates in the cascade — its
`@skmtc/*` pins are rewritten and its version patch-bumped like any other
dependent, and `deno task bump` works on it — but `release` never
registry-checks or publishes it. Used for packages that don't exist on
public jsr.io (the stub `lang-*` veneers, `mcp`, `openapi-overlays`);
publish those manually to the local/private JSR mirror when needed. The
release fails fast if a publishable package pins a private one. To start
publishing a private package on jsr.io: create it
(`https://jsr.io/new?scope=skmtc`), link this GitHub repo in its package
settings (OIDC), then drop the flag.

**Bump without publishing (`deno task bump`):** when CI does the publish (the
`Publish` workflow runs the cascade), do step 1 with `deno task bump <package>
[--minor|--major] [--dry-run]` instead of hand-editing `deno.json`. It performs
the **same cascade as release** — bumps the named package(s) and rewrites every
downstream `@skmtc/*` pin + patch-bumps each dependent across `deno/` — but only
edits the `deno.json` files; it never queries the registry or publishes. Commit
and merge the result; CI then sees the bumped versions as unpublished and ships
them. A package may be named by its directory (`core`) or full name
(`@skmtc/core`).

**Cascade trigger caveat:** the cascade fires only for dependents of packages
that are *pending* on the registry. If you publish a dependency manually, that
trigger is spent — re-running `release` will report "nothing to publish" while
downstream pins stay drifted. To recover, bump the directly-affected
consumer's `version` by hand and run `release` again; the cascade picks up the
rest.

### Core Library (`/core/`)
```bash
# Build and publish to both JSR and NPM
deno task publish

# Build for NPM (in ../../packages/core)
deno task build

# Publish to JSR only
deno task publish:deno

# Publish to NPM only
deno task publish:npm

# Run tests
deno test

# Run specific test
deno test path/to/test.ts
```

### CLI (`/cli/`)
```bash
# Publish to JSR
deno task publish

# Run CLI interactively
deno run mod.ts

# Run specific command
deno run mod.ts <command>
```

## Architecture

### Monorepo Structure
- `/core/` - Core SKMTC library for OpenAPI schema processing
- `/cli/` - Command-line interface for interactive code generation
- `/mcp/` - MCP (Model Context Protocol) server implementation
- `/server/` - Server components

### Core Library Architecture

The core follows a three-phase pipeline:

1. **Parse Phase** (`ParseContext`): OpenAPI v3 JSON → internal OAS objects
2. **Generate Phase** (`GenerateContext`): OAS objects → generator artifacts 
3. **Render Phase** (`RenderContext`): Artifacts → `{ path: content }` map (no formatter runs in-pipeline; host writes to disk after worker returns)

Key components:
- **Context System** (`context/`) - Pipeline orchestration with logging/tracing
- **DSL Layer** (`dsl/`) - Code generation domain-specific language
- **OAS Processing** (`oas/`) - OpenAPI schema handling with `allOf` merging
- **Generator System** - Pluggable architecture for different output targets

### CLI Architecture

The CLI uses Cliffy framework with these patterns:
- **Manager** (`lib/manager.ts`) - Central management with Deno KV storage
- **Command Pattern** - `to<Command>Command()` and `to<Command>Prompt()` functions
- **Generator System** - Multiple code generators (Shadcn, MSW, Tanstack Query, etc.)
- **Authentication** - Supabase integration with local KV storage

## Development Standards

### Import Rules (from Cursor rules)
- MUST import `@std` dependencies from JSR (not npm)
- MUST use latest versions when adding imports
- MUST use `type` keyword when importing types

### Code Organization

`cli/` subdirectories:
- `commands/` - One file per CLI subcommand (`init`, `clone`, `install`, `generate`, etc.)
- `lib/` - Shared CLI utilities (`manager.ts`, `generator.ts`, `bundle-headless.ts`, `doctor-headless.ts`)
- `auth/` - Supabase authentication
- `components/` - Ink/React terminal-UI components
- `prompt/` - Interactive prompt system
- `services/` - Generated API service clients (used by the CLI itself)
- `workspaces/` - Workspace operations (generate, serve, runtime-logs)
- `deploy/` - Deploy commands
- `tasks/` - Deno-task helpers
- `tests/` - Test fixtures
- `types/` - CLI-specific type definitions

`core/` subdirectories (separate package):
- `context/` - `ParseContext`, `GenerateContext`, `RenderContext`, `CoreContext`
- `dsl/` - `Identifier`, `SnippetBase`, the neutral bases (`DefinitionBase`/`CodeFileBase`/`ImportBase`/`ReExportBase`), projection-base factories (concrete `TsFile`/`TsImport`/`TsDefinition` live in `lang-typescript/`)
- `oas/` - OpenAPI v3 schema types and parsing
- `gql/` - GraphQL types and parsing
- `run/` - `toArtifacts`, `toV3JsonDocument` entry points
- `helpers/` - Naming and string utilities
- `types/` - Manifest, Settings, branded types

### Key Dependencies
- `@cliffy/command` & `@cliffy/prompt` - CLI framework
- `@skmtc/core` - Core functionality
- `@std/*` - Deno standard library (from JSR)
- `valibot` - Schema validation
- `ts-pattern` - Pattern matching in generator dispatch

## Entry Points

- Root: `deno.json` with workspace configuration
- Core: `core/mod.ts`, `core/run/toArtifacts.ts`
- CLI: `cli/mod.ts`
- MCP: `mcp/mod.ts`
- Server: `server/mod.ts`

## Instructions

- Always run a type check using `deno check ./**/*.ts ./**/*.tsx` at the end of session to verify results
- `deno task check` runs the full CI suite locally (doc-sync + workspace type-check & tests). A version-controlled `pre-push` hook (`<repo>/.githooks/pre-push`) runs it before every push so failures surface locally, not in GitHub Actions. Enable it per-clone with `git config core.hooksPath .githooks`; bypass a single push with `git push --no-verify`.
- Use absolute import paths prefixed with `@/`, not of relative path imports

## Deno 2.9 dependency age gate (three faces, one cause)

Deno ≥ 2.9 refuses to resolve a dependency version published in the last
24 hours by default (`--minimum-dependency-age`, unstable). Because
`@skmtc/*` publishes on every merge to main, a just-released version
ALWAYS trips it on jsr.io. It shows up three different ways:

| resolution | symptom |
| --- | --- |
| exact pin (project `deno.json`, `deno bundle`) | hard error naming the policy on ≥ 2.9.3; on 2.9.0–2.9.2 the misleading `Do not know how to load path: deno:jsr:@skmtc/…` |
| unpinned (`deno install jsr:@skmtc/cli`) | **silent** — resolves the previous version and reports success |
| existing lockfile | keeps the older resolution; clearing the lock without the flag lands on it again |

The silent one is the dangerous one: the install succeeds, `skmtc
--version` reports the older version truthfully, and a fresh release
looks like it never published.

`deno/cli/lib/dependency-age.ts` is the single source, and the invariant
is "goes through this module", not "through one function in it": every
`deno` subprocess the CLI spawns splices `toDependencyAgeArgs()`, and
every `deno install` the CLI or the docs PRINT is built here —
`toCliInstallCommand()` for the global CLI, `toProjectInstallCommand()`
for a project directory, `toJsrReinstallCommand()` (in
`.scripts/release.ts`) for the just-published pin. A printed command
without the flag hands the reader a recovery step that reproduces the
failure. `skmtc doctor`'s
`cli-version-current` check compares the running CLI against the
registry and names the gate when the newest release is inside the
window.

Other escape hatches: deno ≤ 2.8, or `"minimumDependencyAge": "0"` in
the relevant `deno.json` (this workspace sets it; generated project
configs deliberately do NOT — that is the user's file). Verified
2026-07-12, extended 2026-08-07 — write-up in
`deno/docs/friction-log/2026-07-12-docs-journey-program.md` entry 6.

Use US English spelling in code, prose and documentation

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>