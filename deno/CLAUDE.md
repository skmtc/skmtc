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

1. Bump the `version` in `deno.json` of **only** the package(s) whose source
   you directly changed. Leave downstream consumers alone.
2. From `skmtc/deno/`, run `deno task release`.

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
- Use absolute import paths prefixed with `@/`, not of relative path imports

Use US English spelling in code, prose and documentation

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>