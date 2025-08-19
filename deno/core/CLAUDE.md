# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
```bash
# Build the project
deno task build

# Publish to both Deno (JSR) and NPM
deno task publish

# Publish to JSR only
deno task publish:deno

# Publish to NPM only (from ../../packages/core)
deno task publish:npm
```

### Testing
```bash
# Run tests (uses Deno's built-in test runner)
deno test

# Run specific test file
deno test path/to/test.ts
```

### Type Checking and Linting
```bash
# Type check (Deno has built-in TypeScript support)
deno check mod.ts

# Format code
deno fmt

# Lint code
deno lint
```

## Architecture Overview

This is the core library for the SKMTC (Schema Kit Mapping & Type Conversion) project, a TypeScript/Deno-based OpenAPI schema processor that generates code artifacts from OpenAPI v3 documents.

### Core Processing Pipeline

The system follows a three-phase pipeline orchestrated by `CoreContext`:

1. **Parse Phase** (`ParseContext`): Converts OpenAPI v3 JSON documents into internal OAS (OpenAPI Schema) objects
2. **Generate Phase** (`GenerateContext`): Transforms OAS objects into generator-specific artifacts using pluggable generators
3. **Render Phase** (`RenderContext`): Renders artifacts to files with formatting (Prettier) and file system operations

### Key Architectural Components

- **Context System**: Three context classes manage the pipeline phases with logging, tracing, and error handling
- **DSL Layer**: Domain-specific language for code generation with base classes (`ContentBase`, `Definition`) and type-safe builders
- **OAS Processing**: Comprehensive OpenAPI v3 schema handling with advanced features like `allOf` merging and schema validation
- **Generator System**: Pluggable architecture for different output targets (models, operations, etc.)
- **Type System**: Strong TypeScript typing throughout with branded types and validation using Valibot

### Directory Structure

- `context/` - Pipeline orchestration and execution contexts
- `dsl/` - Code generation DSL and content builders
- `oas/` - OpenAPI schema processing and transformations
- `run/` - Main execution entry points (`toArtifacts`, `toV3JsonDocument`)
- `types/` - Type definitions and branded types
- `helpers/` - Utilities for naming, tracing, and string manipulation
- `typescript/` - TypeScript-specific code generation utilities

### Key Entry Points

- `mod.ts` - Main module exports
- `run/toArtifacts.ts` - Primary transformation function
- `context/CoreContext.ts` - Main orchestration class

### Advanced Features

- **Schema Merging**: Complex `allOf` merging with conflict detection in `oas/_merge-all-of/`
- **Tracing & Logging**: Built-in distributed tracing with Sentry integration
- **Generator Plugins**: Extensible generator system with enrichment support
- **Brand Types**: Type-safe identifiers and references using TypeScript branded types