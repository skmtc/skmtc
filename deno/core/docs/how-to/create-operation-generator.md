# Create Operation Generator

**Learning Outcome:** Build a generator that creates API clients from OpenAPI operations.

## Understanding OperationBase

Operation generators extend `OperationBase` and process API endpoints:

```typescript
import { OperationBase, toOperationBase } from "@skmtc/core"

class MyOperationGenerator extends OperationBase {
  // Your generator logic here
}
```

## Create Generator Base

Define configuration for API client generation:

```typescript
// base.ts
import { toOperationBase, Identifier, camelCase } from "@skmtc/core"
import type { RefName } from "@skmtc/core"
import denoJson from '../deno.json' with { type: 'json' }

export const MyApiBase = toOperationBase({
  id: denoJson.name,
  
  toIdentifier(refName: RefName): Identifier {
    const name = camelCase(refName)
    return Identifier.createValue(name)
  },
  
  toExportPath(refName: RefName): string {
    const { name } = this.toIdentifier(refName)
    return `@/api/${name}.generated.ts`
  }
})
```

## Create Operation Class

Build the generator that outputs API client functions:

```typescript
// MyApiClient.ts
import { OperationInsertableArgs } from "@skmtc/core"
import { MyApiBase } from "./base.ts"

export class MyApiClient extends MyApiBase {
  constructor(args: OperationInsertableArgs) {
    super(args)
  }
  
  override toString(): string {
    const { name } = this.identifier
    const { method, path } = this.operation
    
    const params = this.generateParameters()
    const returnType = this.generateReturnType()
    const fetchCall = this.generateFetchCall()
    
    return `
export async function ${name}(${params}): Promise<${returnType}> {
  ${fetchCall}
}`.trim()
  }
  
  private generateParameters(): string {
    const pathParams = this.operation.pathParams?.map(p => 
      `${p.name}: ${p.type}`
    ).join(', ') || ''
    
    const bodyParam = this.operation.requestBody ? 
      'body: ' + this.operation.requestBody.type : ''
    
    return [pathParams, bodyParam].filter(Boolean).join(', ')
  }
  
  private generateReturnType(): string {
    return this.operation.responses?.['200']?.type || 'void'
  }
  
  private generateFetchCall(): string {
    const { method, path } = this.operation
    const url = this.interpolatePath(path)
    
    const options: string[] = [`method: '${method.toUpperCase()}'`]
    
    if (this.operation.requestBody) {
      options.push(`body: JSON.stringify(body)`)
      options.push(`headers: { 'Content-Type': 'application/json' }`)
    }
    
    return `
  const response = await fetch(\`${url}\`, {
    ${options.join(',\n    ')}
  })
  
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
  }
  
  return response.json()
`.trim()
  }
  
  private interpolatePath(path: string): string {
    // Replace {param} with ${param} for template literals
    return path.replace(/{(\w+)}/g, '${$1}')
  }
}
```

## Create Entry Point

```typescript
// mod.ts
import { toOperationEntry } from "@skmtc/core"
import { MyApiClient } from "./MyApiClient.ts"

export const myApiEntry = toOperationEntry({
  operation: MyApiClient
})

export default myApiEntry
```

## Test Your Generator

```typescript
// test.ts
import { toArtifacts } from "@skmtc/core"
import myApiGenerator from "./mod.ts"

const schema = {
  openapi: "3.0.0",
  info: { title: "API", version: "1.0.0" },
  paths: {
    "/users/{id}": {
      get: {
        operationId: "getUserById",
        parameters: [{
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" }
        }],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" }
              }
            }
          }
        }
      }
    }
  },
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

const artifacts = await toArtifacts({
  schema,
  generators: [myApiGenerator]
})

console.log(artifacts)
```

## Expected Output

```typescript
// @/api/getUserById.generated.ts
export async function getUserById(id: string): Promise<User> {
  const response = await fetch(`/users/${id}`, {
    method: 'GET'
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}
```

## What You Learned

- `OperationBase` handles API endpoint-to-client generation
- `toOperationBase()` configures function naming and file paths
- `OperationInsertableArgs` provides parsed operation data
- HTTP method, path, and parameters are all accessible

## What's Next

- **[Work with Context →](work-with-context.md)** - Access parsed data and logging
- **[Handle Complex Schemas →](handle-complex-schemas.md)** - Deal with allOf and references