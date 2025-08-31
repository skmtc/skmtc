# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the SKMTC CLI - a Deno-based command-line tool for generating code from OpenAPI schemas. It's built using TypeScript and uses the Cliffy CLI framework for command handling and prompts.

## Key Commands

- `deno publish --allow-slow-types --allow-dirty --token=$JSR_AUTH_TOKEN` - Publish package to JSR registry
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
- `generators/*` - Code generation commands (add, clone, deploy, generate, install, list, remove)
- `base-files/*` - Base file management (push)
- `schemas/*` - Schema operations (upload)
- `workspaces/*` - Workspace management (generate, info, message, select)
- `auth/*` - Authentication (login, logout)

### Authentication & Storage

- Uses Supabase for authentication (`auth/supabase-client.ts`)
- Deno KV or file system for local state storage
- Sentry integration for error tracking

### Generator System

The CLI supports multiple code generators defined in `available-generators.ts`:
- Shadcn UI components (table, form, select)
- MSW mock handlers
- Tanstack Query hooks
- Supabase/Hono functions
- Zod schemas
- TypeScript types

Each generator has dependencies that are automatically resolved.

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

## File Organization

- `/lib/` - Core business logic and utilities
- `/generators/` - Generator-specific commands
- `/auth/` - Authentication-related code
- `/schemas/` - Schema processing
- `/workspaces/` - Workspace management
- `/deploy/` - Deployment utilities

## Dependencies

- `@cliffy/command` - CLI framework
- `@cliffy/prompt` - Interactive prompts
- `@skmtc/core` - Core SKMTC functionality
- `@sentry/node` - Error tracking
- `@std/fs` - File system utilities
- `ts-pattern` - Pattern matching