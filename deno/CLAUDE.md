# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SKMTC (Schema Kit Mapping & Type Conversion) is a Deno-based monorepo that generates code artifacts from OpenAPI v3 documents. It consists of a core library for schema processing and a CLI tool for interactive code generation.

## Key Commands

### Root Workspace
```bash
# Publish all packages
deno task publish

# Run tests across workspace
deno test

# Format code across workspace  
deno fmt

# Lint code across workspace
deno lint

# Type check
deno check mod.ts
```

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
3. **Render Phase** (`RenderContext`): Artifacts → formatted files

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
- `/lib/` - Core business logic and utilities
- `/generators/` - Generator-specific commands  
- `/auth/` - Authentication code
- `/schemas/` - Schema processing
- `/workspaces/` - Workspace management
- `/context/` - Pipeline contexts
- `/dsl/` - DSL components
- `/oas/` - OpenAPI processing
- `/types/` - Type definitions

### Key Dependencies
- `@cliffy/command` & `@cliffy/prompt` - CLI framework
- `@skmtc/core` - Core functionality
- `@std/*` - Deno standard library (from JSR)
- `valibot` - Schema validation
- `ts-pattern` - Pattern matching
- `prettier` - Code formatting
- `@sentry/node` - Error tracking

## Entry Points

- Root: `deno.json` with workspace configuration
- Core: `core/mod.ts`, `core/run/toArtifacts.ts`
- CLI: `cli/mod.ts`
- MCP: `mcp/mod.ts`
- Server: `server/mod.ts`