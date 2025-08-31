# ContentBase API

**Learning Outcome:** Understand the ContentBase class methods and properties.

## Constructor

```typescript
class ContentBase {
  constructor({ context, generatorKey }: ContentBaseArgs)
}
```

**Parameters:**
- `context: GenerateContext` - The generation context providing access to parsed data
- `generatorKey?: GeneratorKey` - Optional generator identifier

## Properties

### context: GenerateContext
Access to the generation context with parsed OpenAPI data.

```typescript
class MyGenerator extends ContentBase {
  someMethod() {
    // Access parsed document
    const document = this.context.document
    
    // Access all schemas
    const schemas = this.context.document.components?.schemas
  }
}
```

### skipped: boolean
Indicates whether this content should be skipped during generation.

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    // Skip generation based on conditions
    if (someCondition) {
      this.skipped = true
    }
  }
}
```

### generatorKey: GeneratorKey | undefined
The generator identifier, if provided.

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    console.log(`Generator: ${this.generatorKey}`)
  }
}
```

## Methods

### register(args: RegisterArgs)
Register additional artifacts to be generated.

```typescript
interface RegisterArgs {
  exportPath: string
  content: string | ContentBase
}
```

**Example:**

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    // Register additional type file
    this.register({
      exportPath: "@/types/helpers.generated.ts",
      content: "export type StringKeys<T> = Extract<keyof T, string>"
    })
    
    // Register another generator instance
    this.register({
      exportPath: "@/validators/schema.generated.ts", 
      content: new ValidatorGenerator(args)
    })
  }
}
```

## Usage Patterns

### Conditional Registration

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    // Only register if schema has certain properties
    if (this.hasComplexProperties()) {
      this.register({
        exportPath: "@/types/complex.generated.ts",
        content: this.generateComplexTypes()
      })
    }
  }
  
  private hasComplexProperties(): boolean {
    // Check schema properties
    return this.context.document.components?.schemas
      ?.some(schema => schema.properties?.length > 10) || false
  }
}
```

### Multiple File Generation

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    // Generate multiple related files
    this.generateTypeFiles()
    this.generateValidationFiles() 
    this.generateDocumentationFiles()
  }
  
  private generateTypeFiles() {
    const schemas = this.context.document.components?.schemas || {}
    
    Object.entries(schemas).forEach(([name, schema]) => {
      this.register({
        exportPath: `@/types/${name.toLowerCase()}.generated.ts`,
        content: this.generateTypeFromSchema(schema)
      })
    })
  }
}
```

### Error Handling

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    try {
      this.validateContext()
      this.generateContent()
    } catch (error) {
      this.context.log.error('Generator failed', error)
      this.skipped = true
    }
  }
  
  private validateContext() {
    if (!this.context.document.components) {
      throw new Error('Document must have components section')
    }
  }
}
```

### Settings Access

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    // Access generator settings from context
    const settings = this.context.settings
    
    if (settings.generateDocs) {
      this.register({
        exportPath: "@/docs/api.md",
        content: this.generateDocumentation()
      })
    }
  }
}
```

## Inheritance Patterns

### ModelBase Extension

```typescript
import { ModelBase } from "@skmtc/core"

class MyModelGenerator extends ModelBase {
  // ModelBase extends ContentBase and adds model-specific functionality
  
  override toString(): string {
    // Generate model code
    return `interface ${this.identifier.name} { /* properties */ }`
  }
}
```

### OperationBase Extension  

```typescript
import { OperationBase } from "@skmtc/core"

class MyOperationGenerator extends OperationBase {
  // OperationBase extends ContentBase and adds operation-specific functionality
  
  override toString(): string {
    // Generate operation code
    return `function ${this.identifier.name}() { /* implementation */ }`
  }
}
```

### Direct Extension

```typescript
class CustomGenerator extends ContentBase {
  override toString(): string {
    // Direct ContentBase usage for custom generators
    return "/* custom generated content */"
  }
}
```

## Best Practices

### Always Call Super

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    // Always call super first
    super(args)
    
    // Then add your logic
    this.setupGenerator()
  }
}
```

### Use Skipped for Conditional Generation

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    // Skip if no relevant data
    if (!this.hasRelevantData()) {
      this.skipped = true
      return
    }
    
    this.generateContent()
  }
}
```

### Register Related Files Together

```typescript
class MyGenerator extends ContentBase {
  constructor(args) {
    super(args)
    
    // Generate related files as a group
    this.register({
      exportPath: "@/types/model.ts",
      content: this.generateTypes()
    })
    
    this.register({
      exportPath: "@/types/model.test.ts", 
      content: this.generateTests()
    })
  }
}
```

## What You Learned

- ContentBase is the foundation for all generators
- `register()` method creates additional artifacts
- `skipped` property controls generation
- Context provides access to parsed OpenAPI data
- Error handling should set `skipped = true`
- ModelBase and OperationBase extend ContentBase

## What's Next

- **[Contexts API →](contexts.md)** - Complete context system reference
- **[DSL Components →](dsl-components.md)** - Definition and Identifier classes