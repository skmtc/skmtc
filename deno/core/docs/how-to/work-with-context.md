# Work with Context

**Learning Outcome:** Access parsed data and add logging using the Context system.

## Understanding Context

Each generator receives a context object that provides access to:

- **Parsed data** - All schemas, operations, and components
- **Logging** - Built-in tracing and error reporting
- **Registration** - Add new artifacts during generation

## Access Parsed Data

The context gives you access to the full OpenAPI document:

```typescript
class MyGenerator extends ModelBase {
  constructor({ context, schema, settings }) {
    super({ context, schema, settings })
    
    // Access all schemas
    const allSchemas = context.document.components?.schemas
    
    // Access all operations  
    const allOperations = context.document.paths
    
    // Access document info
    const apiInfo = context.document.info
  }
}
```

## Add Logging

Use the built-in logging system for debugging:

```typescript
class MyGenerator extends ModelBase {
  override toString(): string {
    // Log info
    this.context.log.info(`Generating ${this.schema.name}`)
    
    // Log warnings
    if (!this.schema.description) {
      this.context.log.warn(`Schema ${this.schema.name} has no description`)
    }
    
    // Log errors
    try {
      return this.generateCode()
    } catch (error) {
      this.context.log.error(`Failed to generate ${this.schema.name}`, error)
      throw error
    }
  }
}
```

## Register Additional Artifacts

Create multiple files from a single generator:

```typescript
class MyGenerator extends ModelBase {
  constructor(args) {
    super(args)
    
    // Register an additional type file
    this.register({
      exportPath: `@/types/${this.schema.name}Types.generated.ts`,
      content: this.generateHelperTypes()
    })
    
    // Register a validation file
    this.register({
      exportPath: `@/validation/${this.schema.name}Validator.generated.ts`, 
      content: this.generateValidator()
    })
  }
  
  private generateHelperTypes(): string {
    return `export type ${this.schema.name}Keys = keyof ${this.schema.name}`
  }
  
  private generateValidator(): string {
    return `export const validate${this.schema.name} = (data: unknown) => { /* validation logic */ }`
  }
}
```

## Handle Context Settings

Access generator-specific configuration:

```typescript
class MyGenerator extends ModelBase {
  constructor({ context, schema, settings }) {
    super({ context, schema, settings })
  }
  
  override toString(): string {
    // Access custom settings
    const useOptional = settings?.useOptionalProperties ?? true
    const includeComments = settings?.includeComments ?? false
    
    let code = this.generateInterface()
    
    if (includeComments) {
      code = `// Generated interface for ${this.schema.name}\n${code}`
    }
    
    return code
  }
}
```

## Error Handling

Handle errors gracefully with context logging:

```typescript
class MyGenerator extends ModelBase {
  override toString(): string {
    try {
      this.validateSchema()
      return this.generateCode()
    } catch (error) {
      this.context.log.error(
        `Generation failed for ${this.schema.name}`, 
        { error, schema: this.schema }
      )
      
      // Return a fallback or re-throw
      return `// ERROR: Could not generate ${this.schema.name}`
    }
  }
  
  private validateSchema(): void {
    if (!this.schema.properties) {
      throw new Error('Schema must have properties')
    }
    
    if (this.schema.properties.length === 0) {
      this.context.log.warn(`Schema ${this.schema.name} has no properties`)
    }
  }
}
```

## Tracing and Performance

Use tracing for performance monitoring:

```typescript
class MyGenerator extends ModelBase {
  override toString(): string {
    return this.context.trace(`generate-${this.schema.name}`, () => {
      // This will be traced with timing information
      const properties = this.generateProperties()
      const methods = this.generateMethods()
      
      return `${properties}\n${methods}`
    })
  }
}
```

## What You Learned

- Context provides access to the full parsed OpenAPI document
- Built-in logging with info, warn, and error levels
- `register()` method creates additional artifacts
- Settings can be accessed for generator configuration
- Tracing helps with performance monitoring

## What's Next

- **[Customize Output →](customize-output.md)** - Control file paths and naming
- **[Handle Complex Schemas →](handle-complex-schemas.md)** - Deal with allOf and references