# Create Model Generator

**Learning Outcome:** Build a generator that creates TypeScript interfaces from OpenAPI schemas.

## Understanding ModelBase

Model generators extend `ModelBase` and process schema definitions:

```typescript
import { ModelBase, toModelBase } from "@skmtc/core"

class MyModelGenerator extends ModelBase {
  // Your generator logic here
}
```

## Create Generator Base

First, define your generator's configuration:

```typescript
// base.ts
import { toModelBase, Identifier, capitalize, camelCase } from "@skmtc/core"
import type { RefName } from "@skmtc/core"
import denoJson from '../deno.json' with { type: 'json' }

export const MyGeneratorBase = toModelBase({
  id: denoJson.name,
  
  toIdentifier(refName: RefName): Identifier {
    const name = capitalize(camelCase(refName))
    return Identifier.createType(name)
  },
  
  toExportPath(refName: RefName): string {
    const { name } = this.toIdentifier(refName)
    return `@/types/${name.toLowerCase()}.generated.ts`
  }
})
```

## Create Model Class

Build the generator that outputs TypeScript interfaces:

```typescript
// MyModel.ts
import { ModelInsertableArgs } from "@skmtc/core"
import { MyGeneratorBase } from "./base.ts"

export class MyModel extends MyGeneratorBase {
  constructor(args: ModelInsertableArgs) {
    super(args)
  }
  
  override toString(): string {
    const { name } = this.identifier
    const properties = this.generateProperties()
    
    return `export interface ${name} {\n${properties}\n}`
  }
  
  private generateProperties(): string {
    return this.schema.properties
      ?.map(prop => `  ${prop.name}${prop.required ? '' : '?'}: ${prop.type}`)
      .join('\n') || ''
  }
}
```

## Create Entry Point

Export your generator as the default:

```typescript
// mod.ts
import { toModelEntry } from "@skmtc/core"
import { MyModel } from "./MyModel.ts"

export const myModelEntry = toModelEntry({
  model: MyModel
})

export default myModelEntry
```

## Test Your Generator

```typescript
// test.ts
import { toArtifacts } from "@skmtc/core"
import myModelGenerator from "./mod.ts"

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
  generators: [myModelGenerator]
})

console.log(artifacts)
```

## Expected Output

```typescript
// @/types/user.generated.ts
export interface User {
  id?: string
  name: string
}
```

## What You Learned

- `ModelBase` handles schema-to-type generation
- `toModelBase()` configures naming and file paths
- `ModelInsertableArgs` provides parsed schema data
- `toString()` method generates the final code

## What's Next

- **[Create Operation Generator →](create-operation-generator.md)** - Build API client generators
- **[Customize Output →](customize-output.md)** - Control file paths and naming