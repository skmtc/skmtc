# @skmtc/core

TypeScript code generation library that transforms OpenAPI v3 schemas into type-safe artifacts.

## Problems We Solve

**Stop writing the same code over and over.** Generate TypeScript types, API clients, validation schemas, and more directly from your OpenAPI specifications.

### Manual Type Definitions
**Pain:** Hours spent manually writing TypeScript interfaces from OpenAPI docs, fighting typos and sync issues.  
**Solution:** Generate accurate types with perfect synchronization.

### Schema Evolution Management
**Pain:** API changes break frontend types, validation, mocks, and docs across dozens of files.  
**Solution:** Single regeneration command updates all artifacts simultaneously.

### Type-Unsafe Runtime API Integration  
**Pain:** No compile-time guarantees that API calls match backend schemas.  
**Solution:** End-to-end type safety from schema through clients to UI components.

## Quick Start

**Learning Outcome:** Generate TypeScript types from an OpenAPI schema in 5 minutes.

### Install

```bash
# Import in your Deno project
import { toArtifacts } from "jsr:@skmtc/core"
```

### Generate Types

```typescript
import { toArtifacts } from "@skmtc/core"
import typescriptGenerator from "@skmtc/gen-typescript"

// Your OpenAPI v3 schema
const schema = {
  openapi: "3.0.0",
  info: { title: "API", version: "1.0.0" },
  components: {
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" }
        }
      }
    }
  }
}

// Generate TypeScript types
const artifacts = await toArtifacts({
  schema,
  generators: [typescriptGenerator]
})

// Write generated files
for (const [path, content] of artifacts) {
  await Deno.writeTextFile(path, content)
}
```

### Result

```typescript
// @/types/user.generated.ts
export interface User {
  id?: string
  name?: string
}
```

## What's Next

- **[Getting Started →](docs/getting-started/installation.md)** - Complete setup guide
- **[How-To Guides →](docs/how-to/)** - Task-oriented tutorials  
- **[API Reference →](docs/api/)** - Complete technical documentation

## License

MIT







