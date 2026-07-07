# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the SKMTC CLI - a Deno-based command-line tool for generating code from OpenAPI schemas. It's built using TypeScript and uses the Cliffy CLI framework for command handling and prompts.

## Key Commands

### Development & Testing
- `deno task test` - Run all tests with coverage
- `deno task test:watch` - Run tests in watch mode
- `deno task test:coverage` - Run tests with coverage report
- `deno test path/to/specific-test.ts` - Run a specific test file

### Building & Publishing
- `deno task build` - Build Node.js distribution in ../../packages/cli
- `deno task publish` - Full publish (build + publish to JSR + NPM)
- `deno task publish:deno` - Publish to JSR only
- `deno task publish:npm` - Publish to NPM only (from ../../packages/cli)

### CLI Usage
- `deno run mod.ts` - Run the CLI in interactive mode
- `deno run mod.ts <command>` - Run specific CLI commands

## Architecture

### Core Components

- **mod.ts** - Main entry point that sets up the CLI with all available commands and interactive prompts
- **Manager** (`lib/manager.ts`) - Central management class that handles cleanup actions
- **SkmtcRoot** (`lib/skmtc-root.ts`) - Root workspace manager that handles project creation and discovery
- **Project** (`lib/project.ts`) - Individual project management

### Command Structure

Commands are organized into categories:
- `commands/*` - One module per CLI command (init, create, clone, install, list, remove, generate, bundle, clean, dev, doctor, agent-context, publish)
- `workspaces/*` - Workspace management (serve)
- `lib/*` - Core business logic and utilities

### Interactive UI Architecture

The CLI features a React/Ink-based interactive interface:
- **Main UI** (`components/App.tsx`) - React component using Ink for terminal UI
- **Prompt System** (`prompt/run-prompt.tsx`) - Interactive command selection with React rendering
- **Command Pattern** - Each command has both programmatic and interactive variants

**IMPORTANT**: This project uses Ink CLI to create terminal user interface components. Ink uses special React components designed for terminal rendering (like `<Box>`, `<Text>`, `<Input>`, etc.) instead of HTML elements. When working with React components in this project, NEVER use HTML React components like `<div>`, `<span>`, `<button>`, etc. Always use Ink-specific components from the `ink` and `@inkjs/ui` packages.

### Authentication

The only credential is a skmtc-hub personal access token (PAT), used by
the hub commands (`publish`, `push`, `pull`, `project`). Resolution
order: `--token`, then `$SKMTC_HUB_TOKEN`, then the store written by
`skmtc login` (`~/.skmtc/auth.json`, mode 0600). `skmtc login` validates
and stores a pasted PAT (`--with-token` reads it from stdin); `skmtc
logout` deletes it. There is no OAuth browser flow — login is
paste-a-PAT only.

### Generator System

The CLI supports multiple code generators:
- **Remote Generators** - Fetched from the JSR registry (`JSR_URL`, defaults to `https://jsr.io/`)
- **Local Projects** - Created and managed locally within the SKMTC root directory

Key generator operations:
- `create` - Scaffold a new local generator in a project
- `clone` - Pull generator source into the project for editing
- `install` - Add JSR generators to a project
- `publish` - Build and publish an immutable stack version to skmtc-hub

## Development Patterns

### Command Pattern
Each command follows a consistent pattern:
- `to<Command>Command()` - Returns Cliffy Command instance
- `to<Command>Prompt()` - Interactive prompt version
- Command logic is separated from CLI setup

### State Management
- File system for persistent storage
- Manager class handles cleanup actions

### Error Handling
- Manager has `success()` and `fail()` methods for cleanup
- Sentry integration for error tracking
- Graceful exit with proper cleanup


## Key Dependencies

### CLI Framework
- `@cliffy/command` - CLI framework for command handling

### UI & Rendering
- `ink` - React for terminal interfaces
- `@inkjs/ui` - UI components for Ink
- `ink-select-input` - Selection input component
- `react` - React for component-based UI

### Core Functionality
- `@skmtc/core` - Core SKMTC functionality for OpenAPI processing
- `@std/*` - Deno standard library modules
- `tiny-invariant` - Runtime assertions

## Project Structure

### Key Directories
- `/lib/` - Core business logic (Manager, SkmtcRoot, Project)
- `/commands/` - CLI command modules
- `/workspaces/` - Workspace operations (serve)
- `/components/` - React/Ink UI components
- `/prompt/` - Interactive prompt system
- `/services/` - API service clients (JSR registry)

## Installing the CLI from local source

Use `deno compile`, **not** `deno install`:

```bash
deno compile --no-check \
  --allow-read --allow-write --allow-net --allow-env --allow-run=deno,sh --allow-sys=homedir \
  --unstable-worker-options \
  --config /path/to/skmtc/deno/cli/deno.json \
  --include /path/to/skmtc/deno/cli \
  -o ~/.deno/bin/skmtc \
  /path/to/skmtc/deno/cli/mod.ts
```

The scoped permissions (instead of `-A`) match the published install: skmtc
needs read/write/net/env, spawns only `deno` + `sh`, and `homedir` to find
the workspace root — no FFI, no remote imports. `--unstable-worker-options`
**must** be passed here: `cli/deno.json` carries no `unstable` field, so
without it the compiled binary fails the first `generate` on
`Worker.deno.permissions`. (For a throwaway dev run, `deno run --allow-all`
below is fine — it's ephemeral, not a distributed binary.)

`mod.ts` lazy-loads commands via `await import('@/commands/<name>.tsx')`. The `@/` alias is resolved by `deno publish` at publish time — the JSR-published artifact contains relative paths, which is why `deno install jsr:@skmtc/cli` works. Against local source there is no resolution step, so `deno install` produces a launcher whose runtime cwd cannot resolve `@/` and dynamic imports fail with `Module not found ".../.deno/bin/.skmtc/commands/<name>.tsx"`.

`deno compile --include <cli-dir>` bundles the entire CLI tree at build time, so dynamic alias-imports just work. Cost: the binary is ~175 MB (Deno runtime is bundled in) and you must recompile after editing `mod.ts` or any statically-imported file. For iterative work on a specific command, `deno run --allow-all --config <cli/deno.json> <cli/mod.ts> <args>` picks up edits without recompilation.

## TypeScript

- Do not use `any` types
- Avoid casting with `as` unless absoloutely necessary. Use `as const` is fine

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### May 6, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #18751 | 11:07 AM | ✅ | Configured all monorepo packages to publish to local JSR instance | ~480 |

### May 9, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #19895 | 9:22 AM | 🔵 | SKMTC CLI architecture and command structure reviewed | ~461 |

### May 12, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #20644 | 8:34 AM | 🔵 | SKMTC architecture - three-phase pipeline and CLI commands | ~812 |
</claude-mem-context>