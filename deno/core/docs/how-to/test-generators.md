# Test Generators

**Learning Outcome:** Write unit tests for your generators using Deno's built-in testing framework.

## Basic Generator Test

Test a simple model generator:

```typescript
// MyGenerator.test.ts
import { assertEquals } from "@std/assert"
import { toArtifacts } from "@skmtc/core"
import myGenerator from "./mod.ts"

Deno.test("MyGenerator - generates TypeScript interface", async () => {
  const schema = {
    openapi: "3.0.0",
    info: { title: "Test", version: "1.0.0" },
    components: {
      schemas: {
        User: {
          type: "object",
          required: ["name"],
          properties: {
            id: { type: "string" },
            name: { type: "string" }
          }
        }
      }
    }
  }
  
  const artifacts = await toArtifacts({
    schema,
    generators: [myGenerator]
  })
  
  // Check file was generated
  assertEquals(artifacts.size, 1)
  
  // Check file path
  const [[path, content]] = artifacts
  assertEquals(path, "@/types/user.generated.ts")
  
  // Check content
  assertEquals(content, `export interface User {
  id?: string
  name: string
}`)
})
```

## Testing with Mock Context

Create mock contexts for isolated testing:

```typescript
// mockContext.ts
import { ParseContext, GenerateContext } from "@skmtc/core"

export function createMockParseContext(schema: any) {
  return new ParseContext({
    document: schema,
    settings: {},
    log: {
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  })
}

export function createMockGenerateContext(schema: any) {
  const parseContext = createMockParseContext(schema)
  
  return new GenerateContext({
    parseContext,
    settings: {},
    log: parseContext.log
  })
}
```

## Unit Testing Generator Logic

Test individual generator methods:

```typescript
// MyGenerator.test.ts
import { assertEquals } from "@std/assert"
import { MyGenerator } from "./MyGenerator.ts"
import { createMockGenerateContext } from "./mockContext.ts"

Deno.test("MyGenerator - generateProperties", () => {
  const schema = {
    openapi: "3.0.0",
    info: { title: "Test", version: "1.0.0" },
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" }
          },
          required: ["name"]
        }
      }
    }
  }
  
  const context = createMockGenerateContext(schema)
  const userSchema = schema.components.schemas.User
  
  const generator = new MyGenerator({
    context,
    schema: userSchema,
    settings: {}
  })
  
  // Test private method through toString()
  const result = generator.toString()
  
  assertEquals(result.includes("id?: string"), true)
  assertEquals(result.includes("name: string"), true)
})
```

## Testing Error Handling

Verify generators handle invalid schemas:

```typescript
Deno.test("MyGenerator - handles invalid schema", () => {
  const invalidSchema = {
    openapi: "3.0.0",
    info: { title: "Test", version: "1.0.0" },
    components: {
      schemas: {
        InvalidUser: {
          // Missing type property
          properties: {
            name: { type: "string" }
          }
        }
      }
    }
  }
  
  const context = createMockGenerateContext(invalidSchema)
  const schema = invalidSchema.components.schemas.InvalidUser
  
  const generator = new MyGenerator({
    context,
    schema,
    settings: {}
  })
  
  // Should not throw, should return fallback
  const result = generator.toString()
  assertEquals(result.includes("// ERROR:"), true)
})
```

## Testing Complex Schemas

Test allOf merging and references:

```typescript
Deno.test("MyGenerator - handles allOf merging", async () => {
  const schema = {
    openapi: "3.0.0",
    info: { title: "Test", version: "1.0.0" },
    components: {
      schemas: {
        BaseEntity: {
          type: "object",
          properties: {
            id: { type: "string" },
            createdAt: { type: "string" }
          }
        },
        User: {
          allOf: [
            { $ref: "#/components/schemas/BaseEntity" },
            {
              type: "object",
              properties: {
                name: { type: "string" }
              }
            }
          ]
        }
      }
    }
  }
  
  const artifacts = await toArtifacts({
    schema,
    generators: [myGenerator]
  })
  
  const userContent = [...artifacts.values()].find(content => 
    content.includes("interface User")
  )
  
  // Should contain merged properties
  assertEquals(userContent?.includes("id"), true)
  assertEquals(userContent?.includes("createdAt"), true)
  assertEquals(userContent?.includes("name"), true)
})
```

## Testing Generator Settings

Test generator configuration options:

```typescript
Deno.test("MyGenerator - respects settings", async () => {
  const schema = {
    openapi: "3.0.0",
    info: { title: "Test", version: "1.0.0" },
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            name: { type: "string" }
          }
        }
      }
    }
  }
  
  const artifacts = await toArtifacts({
    schema,
    generators: [myGenerator],
    settings: {
      includeComments: true,
      useOptionalProperties: false
    }
  })
  
  const [[_, content]] = artifacts
  
  // Should include comments when setting enabled
  assertEquals(content.includes("// Generated"), true)
})
```

## Snapshot Testing

Test output consistency with snapshots:

```typescript
// MyGenerator.test.ts
import { assertEquals } from "@std/assert"

Deno.test("MyGenerator - snapshot test", async () => {
  const schema = {
    // ... schema definition
  }
  
  const artifacts = await toArtifacts({
    schema,
    generators: [myGenerator]
  })
  
  // Save expected output to file during development
  const expectedOutput = await Deno.readTextFile("./test-fixtures/expected-user.ts")
  const [[_, actualOutput]] = artifacts
  
  assertEquals(actualOutput.trim(), expectedOutput.trim())
})
```

## Integration Testing

Test multiple generators together:

```typescript
Deno.test("Full integration - types and validators", async () => {
  const schema = {
    // ... complex schema
  }
  
  const artifacts = await toArtifacts({
    schema,
    generators: [typeGenerator, validatorGenerator, apiGenerator]
  })
  
  // Should generate multiple files
  assertEquals(artifacts.size, 6) // 2 schemas × 3 generators
  
  // Check all expected paths exist
  const paths = [...artifacts.keys()]
  assertEquals(paths.includes("@/types/user.generated.ts"), true)
  assertEquals(paths.includes("@/validators/user.generated.ts"), true)
  assertEquals(paths.includes("@/api/user.generated.ts"), true)
})
```

## Running Tests

Execute tests with Deno:

```bash
# Run all tests
deno test

# Run specific test file
deno test MyGenerator.test.ts

# Run with coverage
deno test --coverage=cov_profile

# Generate coverage report
deno coverage cov_profile
```

## Test Organization

Structure your test files:

```
my-generator/
├── src/
│   ├── MyGenerator.ts
│   └── base.ts
├── tests/
│   ├── MyGenerator.test.ts
│   ├── mockContext.ts
│   └── fixtures/
│       ├── simple-schema.json
│       └── expected-output.ts
└── mod.ts
```

## What You Learned

- Use `toArtifacts()` for end-to-end generator testing
- Create mock contexts for isolated unit tests
- Test error handling with invalid schemas
- Verify complex schema processing (allOf, references)
- Use settings to test generator configuration
- Snapshot testing ensures consistent output
- Integration testing validates multiple generators

## What's Next

- **[API Reference →](../api/content-base.md)** - Complete technical documentation
- **[ContentBase API →](../api/content-base.md)** - Understand the base generator class