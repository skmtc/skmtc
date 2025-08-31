# First Generator

**Learning Outcome:** Generate your first TypeScript types from an OpenAPI schema.

## Create the Schema

Start with a simple OpenAPI v3 schema:

```typescript
// schema.ts
export const petSchema = {
  openapi: "3.0.0",
  info: { title: "Pet API", version: "1.0.0" },
  components: {
    schemas: {
      Pet: {
        type: "object",
        required: ["name"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          status: { 
            type: "string", 
            enum: ["available", "pending", "sold"] 
          }
        }
      }
    }
  }
}
```

## Generate Types

Create a generator script:

```typescript
// generate.ts
import { toArtifacts } from "@skmtc/core"
import typescriptGenerator from "@skmtc/gen-typescript"
import { petSchema } from "./schema.ts"

const artifacts = await toArtifacts({
  schema: petSchema,
  generators: [typescriptGenerator]
})

// Write generated files
for (const [path, content] of artifacts) {
  console.log(`Writing: ${path}`)
  await Deno.writeTextFile(path, content)
}
```

## Run Generation

```bash
deno run -A generate.ts
```

## View Results

You'll see generated TypeScript files:

```typescript
// @/types/pet.generated.ts
export interface Pet {
  id?: number
  name: string
  status?: "available" | "pending" | "sold"
}
```

## What You Learned

- OpenAPI schemas define the structure
- `toArtifacts()` transforms schemas into code
- Generators control the output format
- Files are written to predictable paths

## What's Next

- **[Core Concepts →](core-concepts.md)** - Understand the 3-phase pipeline
- **[Create Model Generator →](../how-to/create-model-generator.md)** - Build custom generators