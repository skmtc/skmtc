# Handle Complex Schemas

**Learning Outcome:** Deal with allOf merging, schema references, and validation patterns.

## Understanding allOf Merging

@skmtc/core automatically merges `allOf` schemas during parsing:

```typescript
// Input schema with allOf
const schema = {
  components: {
    schemas: {
      User: {
        allOf: [
          { $ref: "#/components/schemas/BaseEntity" },
          {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" }
            }
          }
        ]
      },
      BaseEntity: {
        type: "object", 
        properties: {
          id: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      }
    }
  }
}

// After parsing, your generator receives a merged schema
class MyGenerator extends ModelBase {
  override toString(): string {
    // this.schema now contains ALL properties from allOf
    // properties: [id, createdAt, name, email]
    return this.generateInterface()
  }
}
```

## Handling Schema References

References are automatically resolved during parsing:

```typescript
// Schema with $ref
const schema = {
  components: {
    schemas: {
      Order: {
        type: "object",
        properties: {
          customer: { $ref: "#/components/schemas/Customer" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Product" }
          }
        }
      }
    }
  }
}

// In your generator, references are resolved
class MyGenerator extends ModelBase {
  override toString(): string {
    // Access resolved reference types
    const properties = this.schema.properties.map(prop => {
      if (prop.isReference) {
        // prop.resolvedType contains the actual referenced schema
        return `${prop.name}: ${prop.resolvedType.name}`
      }
      return `${prop.name}: ${prop.type}`
    })
    
    return `interface ${this.identifier.name} {\n  ${properties.join('\n  ')}\n}`
  }
}
```

## Working with oneOf/anyOf

Handle union types from oneOf and anyOf:

```typescript
// Schema with oneOf
const schema = {
  components: {
    schemas: {
      Pet: {
        oneOf: [
          { $ref: "#/components/schemas/Cat" },
          { $ref: "#/components/schemas/Dog" }
        ],
        discriminator: {
          propertyName: "type"
        }
      }
    }
  }
}

// Generate union types
class MyGenerator extends ModelBase {
  override toString(): string {
    if (this.schema.oneOf) {
      const unionTypes = this.schema.oneOf.map(variant => variant.name)
      return `export type ${this.identifier.name} = ${unionTypes.join(' | ')}`
    }
    
    return this.generateRegularInterface()
  }
}
```

## Handling Discriminated Unions

Work with discriminator properties:

```typescript
class MyGenerator extends ModelBase {
  override toString(): string {
    if (this.schema.discriminator) {
      return this.generateDiscriminatedUnion()
    }
    
    return this.generateRegularInterface()
  }
  
  private generateDiscriminatedUnion(): string {
    const { propertyName } = this.schema.discriminator
    const variants = this.schema.oneOf || this.schema.anyOf || []
    
    const unionMembers = variants.map(variant => {
      // Each variant should include the discriminator property
      return `${variant.name} & { ${propertyName}: '${variant.discriminatorValue}' }`
    })
    
    return `export type ${this.identifier.name} = ${unionMembers.join(' | ')}`
  }
}
```

## Nullable and Optional Properties

Handle nullable and optional properties correctly:

```typescript
class MyGenerator extends ModelBase {
  private generateProperty(prop: Property): string {
    let type = prop.type
    
    // Handle nullable types
    if (prop.nullable) {
      type = `${type} | null`
    }
    
    // Handle optional properties
    const optional = prop.required ? '' : '?'
    
    // Handle array types
    if (prop.type === 'array') {
      const itemType = prop.items?.type || 'unknown'
      type = `${itemType}[]`
    }
    
    return `${prop.name}${optional}: ${type}`
  }
}
```

## Validation Constraints

Access schema validation rules:

```typescript
class MyGenerator extends ModelBase {
  private generateProperty(prop: Property): string {
    let type = this.getTypeFromProperty(prop)
    
    // Add validation information as comments
    const constraints = []
    
    if (prop.minLength) constraints.push(`minLength: ${prop.minLength}`)
    if (prop.maxLength) constraints.push(`maxLength: ${prop.maxLength}`)
    if (prop.pattern) constraints.push(`pattern: ${prop.pattern}`)
    if (prop.minimum) constraints.push(`min: ${prop.minimum}`)
    if (prop.maximum) constraints.push(`max: ${prop.maximum}`)
    if (prop.enum) constraints.push(`enum: [${prop.enum.join(', ')}]`)
    
    const comment = constraints.length > 0 
      ? ` // ${constraints.join(', ')}`
      : ''
    
    return `${prop.name}: ${type}${comment}`
  }
}
```

## Complex Nested Objects

Handle deeply nested object structures:

```typescript
class MyGenerator extends ModelBase {
  private generateProperty(prop: Property): string {
    if (prop.type === 'object' && prop.properties) {
      // Inline object type
      const nestedProps = prop.properties.map(nested => 
        `    ${nested.name}: ${nested.type}`
      ).join(';\n')
      
      return `${prop.name}: {\n${nestedProps}\n  }`
    }
    
    if (prop.type === 'array' && prop.items?.type === 'object') {
      // Array of inline objects
      const itemProps = prop.items.properties?.map(nested =>
        `    ${nested.name}: ${nested.type}`
      ).join(';\n') || ''
      
      return `${prop.name}: Array<{\n${itemProps}\n  }>`
    }
    
    return `${prop.name}: ${prop.type}`
  }
}
```

## Error Handling for Invalid Schemas

Handle malformed or invalid schemas gracefully:

```typescript
class MyGenerator extends ModelBase {
  override toString(): string {
    try {
      this.validateSchema()
      return this.generateInterface()
    } catch (error) {
      this.context.log.error(`Schema validation failed for ${this.schema.name}`, error)
      
      // Return a fallback interface
      return `// ERROR: Invalid schema for ${this.identifier.name}\nexport interface ${this.identifier.name} {}`
    }
  }
  
  private validateSchema(): void {
    if (!this.schema.type && !this.schema.allOf && !this.schema.oneOf) {
      throw new Error('Schema must have type, allOf, or oneOf')
    }
    
    if (this.schema.type === 'object' && !this.schema.properties) {
      this.context.log.warn(`Object schema ${this.schema.name} has no properties`)
    }
  }
}
```

## What You Learned

- allOf schemas are automatically merged during parsing
- Schema references ($ref) are resolved before generation
- oneOf/anyOf create union types with discriminator support
- Nullable and optional properties need special handling
- Validation constraints are accessible as schema metadata
- Nested objects can be handled with inline types
- Error handling prevents generator crashes on invalid schemas

## What's Next

- **[Test Generators →](test-generators.md)** - Write unit tests for your generators
- **[API Reference →](../api/contexts.md)** - Complete technical documentation