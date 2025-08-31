# Core Concepts

**Learning Outcome:** Understand the 3-phase pipeline that powers @skmtc/core.

## The Three-Phase Pipeline

@skmtc/core processes OpenAPI schemas through three distinct phases:

### Parse Phase
**What it does:** Converts OpenAPI v3 JSON into internal objects.

```
OpenAPI JSON → Schema objects → Operation objects
```

**Key class:** `ParseContext` - handles schema validation and object creation.

### Generate Phase  
**What it does:** Transforms internal objects into generator artifacts.

```
Schema objects → Generator logic → Artifact objects
```

**Key class:** `GenerateContext` - manages generator execution and artifact collection.

### Render Phase
**What it does:** Converts artifacts into formatted files.

```
Artifact objects → File formatting → Written files
```

**Key class:** `RenderContext` - handles file writing and code formatting.

## Why Three Phases?

**Separation of concerns:** Each phase has a single responsibility.

**Flexibility:** Generators only care about the Generate phase - parsing and rendering are handled automatically.

**Debugging:** You can inspect objects between phases to understand what went wrong.

## Context System

Each phase gets a context object that provides:

- **Data access** - Parsed schemas, generated artifacts
- **Logging** - Built-in tracing and error reporting  
- **Registration** - Add new artifacts during generation

```typescript
// Generators receive GenerateContext
class MyGenerator extends ModelBase {
  constructor({ context, schema, settings }) {
    // context gives you access to parsed data
    super({ context, schema, settings })
  }
}
```

## What's Next

- **[Create Model Generator →](../how-to/create-model-generator.md)** - Build your first custom generator
- **[Work with Context →](../how-to/work-with-context.md)** - Access parsed data and logging