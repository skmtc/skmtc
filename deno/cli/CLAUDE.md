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
- **Manager** (`lib/manager.ts`) - Central management class that handles authentication, and cleanup actions
- **SkmtcRoot** (`lib/skmtc-root.ts`) - Root workspace manager that handles project creation and discovery
- **Project** (`lib/project.ts`) - Individual project management

### Command Structure

Commands are organized into categories:
- `generators/*` - Code generation commands (add, clone, deploy, install, list, remove)
- `workspaces/*` - Workspace management (generate, serve, runtime-logs)
- `auth/*` - Authentication (login, logout)
- `lib/*` - Core business logic and utilities

### Interactive UI Architecture

The CLI features a React/Ink-based interactive interface:
- **Main UI** (`components/App.tsx`) - React component using Ink for terminal UI
- **Prompt System** (`prompt/run-prompt.tsx`) - Interactive command selection with React rendering
- **Command Pattern** - Each command has both programmatic and interactive variants

**IMPORTANT**: This project uses Ink CLI to create terminal user interface components. Ink uses special React components designed for terminal rendering (like `<Box>`, `<Text>`, `<Input>`, etc.) instead of HTML elements. When working with React components in this project, NEVER use HTML React components like `<div>`, `<span>`, `<button>`, etc. Always use Ink-specific components from the `ink` and `@inkjs/ui` packages.

### Authentication & Storage

- Uses Supabase for authentication (`auth/supabase-client.ts`)
- Deno KV or file system for local state storage
- Sentry integration for error tracking

### Generator System

The CLI supports multiple code generators with automatic dependency resolution:
- **Remote Generators** - Fetched from JSR registry (e.g., `@skmtc/supabase-backend`)
- **Local Projects** - Created and managed locally within the SKMTC root directory
- **Generator Types** - Shadcn UI, MSW, Tanstack Query, Supabase/Hono, Zod, TypeScript

Key generator operations:
- `add` - Add generators to existing projects
- `clone` - Clone generators from remote sources
- `install` - Install generator dependencies
- `deploy` - Deploy projects to Supabase/Deno platforms

## Development Patterns

### Command Pattern
Each command follows a consistent pattern:
- `to<Command>Command()` - Returns Cliffy Command instance
- `to<Command>Prompt()` - Interactive prompt version
- Command logic is separated from CLI setup

### State Management
- Uses Deno KV or file system for persistent storage
- Manager class handles cleanup actions
- Auth state is managed through Auth class

### Error Handling
- Manager has `success()` and `fail()` methods for cleanup
- Sentry integration for error tracking
- Graceful exit with proper cleanup


## Key Dependencies

### CLI Framework
- `@cliffy/command` - CLI framework for command handling
- `@cliffy/prompt` - Interactive prompts and selection

### UI & Rendering
- `ink` - React for terminal interfaces
- `@inkjs/ui` - UI components for Ink
- `ink-select-input` - Selection input component
- `react` - React for component-based UI

### Core Functionality
- `@skmtc/core` - Core SKMTC functionality for OpenAPI processing
- `@sentry/node` - Error tracking and monitoring
- `@std/*` - Deno standard library modules
- `ts-pattern` - Pattern matching utilities
- `tiny-invariant` - Runtime assertions

## Project Structure

### Key Directories
- `/lib/` - Core business logic (Manager, SkmtcRoot, Project, Auth)
- `/generators/` - Generator-specific commands (add, clone, deploy, install, list, remove)
- `/workspaces/` - Workspace operations (generate, serve, runtime-logs)
- `/auth/` - Authentication with Supabase integration
- `/components/` - React/Ink UI components
- `/prompt/` - Interactive prompt system
- `/services/` - Generated API service clients